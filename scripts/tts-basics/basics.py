#!/usr/bin/env python3
"""Audio Tahap 0 (task 0) dengan suara P3. Dijalankan oleh .github/workflows/basics-audio.yml.

    python scripts/tts-basics/basics.py [--out public/audio/basics] [--force]

- Item bersuara = setiap objek di data/basics/basics.json yang punya `audioId` (+ `hanzi`, `pinyin`).
- Suara: P3 dari scripts/tts/voices.json (Kokoro-82M v1.1-zh, zf_001, revisi yang dipatok), speed 1.0.
- Format sama dengan contoh suara (fungsi `normalize` dari scripts/tts/make_samples.py dipakai ulang):
  mp3 mono 64 kbps 24 kHz, pangkas sunyi, -16 LUFS, jeda 0,15 dtk.
- Cek: faster-whisper small (zh, CPU int8) + opencc t2s.
  * Kata/kalimat (>= 2 huruf): transkrip tanpa tanda baca = hanzi (angka Arab dibaca sebagai hanzi).
  * Suku kata tunggal: transkrip 1 huruf yang salah satu bacaannya (pypinyin, heteronym) = `pinyin`
    target. Bila gagal, file yang sama diulang 3x dengan jeda lalu ditranskrip lagi (Whisper lemah pada
    klip sangat pendek); lolos bila semua huruf transkrip (2-4 huruf) cocok.
- Gagal -> buat ulang dengan variasi (maksimal 3 percobaan):
    1. teks apa adanya, speed 1.0
    2. teks + "。", speed 0.9
    3. suku kata tunggal: "X，X，X。" lalu potong suku kata tengah (nada sitasi lebih jelas);
       kata: teks + "。", speed 0.8
  Tetap gagal -> file terbaik disimpan (ok: false) dan dicatat di data/basics/audio-issues.json.
- Item yang hanzi/pinyin-nya tidak berubah dan filenya ada tidak dibuat ulang (kecuali --force),
  supaya push berikutnya tidak mengubah mp3 yang sudah ada.
- Batas waktu (--budget-min): item yang belum sempat dibuat ditandai `pending` di manifest
  (`complete: false`); workflow lalu menjalankan dirinya lagi untuk melanjutkan.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import subprocess
import sys
import time
import traceback
import unicodedata
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(ROOT / "scripts" / "tts"))

import make_samples as ms  # noqa: E402  (fungsi format & normalisasi task 4a)

DATA = ROOT / "data" / "basics" / "basics.json"
ISSUES = ROOT / "data" / "basics" / "audio-issues.json"
VOICE_CODE = "P3"
SCRIPT_VERSION = 1
HAN = re.compile(r"[\u3400-\u9fff]")
DIGITS = {"0": "零", "1": "一", "2": "二", "3": "三", "4": "四", "5": "五", "6": "六", "7": "七", "8": "八", "9": "九"}

log = ms.log


def audio_items(node, out=None):
    """Semua objek ber-audioId, urut kemunculan."""
    if out is None:
        out = []
    if isinstance(node, dict):
        if "audioId" in node:
            out.append({"audioId": node["audioId"], "hanzi": node["hanzi"], "pinyin": node["pinyin"]})
        for v in node.values():
            audio_items(v, out)
    elif isinstance(node, list):
        for v in node:
            audio_items(v, out)
    return out


# --------------------------------------------------------------------------
# Sintesis
# --------------------------------------------------------------------------

class Kokoro:
    def __init__(self, voice: dict):
        import torch
        from huggingface_hub import hf_hub_download
        from kokoro import KModel, KPipeline

        log(f"[kokoro] torch {torch.__version__}")
        repo, sha = voice["repoId"], voice["modelRevision"]
        ms.hf_snapshot_info(repo, sha)
        cfg = hf_hub_download(repo, "config.json", revision=sha)
        ckpt = hf_hub_download(repo, "kokoro-v1_1-zh.pth", revision=sha)
        model = KModel(repo_id=repo, config=cfg, model=ckpt).eval()
        self.pipe = KPipeline(lang_code="z", repo_id=repo, model=model)
        self.pack = hf_hub_download(repo, f"voices/{voice['voiceId']}.pt", revision=sha)

    def synth(self, text: str, speed: float, wav: Path):
        import numpy as np

        chunks = []
        for res in self.pipe(text, voice=self.pack, speed=speed, split_pattern=None):
            if res.audio is not None:
                chunks.append(res.audio.numpy())
        if not chunks:
            raise RuntimeError(f"tidak ada audio untuk {text!r}")
        ms.write_wav(wav, np.concatenate(chunks), ms.SAMPLE_RATE)


def voiced_segments(wav: Path) -> list[tuple[float, float]]:
    """Bagian bersuara (detik) menurut silencedetect."""
    p = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(wav), "-af", "silencedetect=noise=-38dB:d=0.07",
                        "-f", "null", "-"], capture_output=True, text=True, check=True)
    total = float(ms.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0",
                          str(wav)]).stdout.strip())
    starts = [float(x) for x in re.findall(r"silence_start: (-?[\d.]+)", p.stderr)]
    ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", p.stderr)]
    silences = list(zip(starts, ends + [total] * (len(starts) - len(ends))))
    segs, cur = [], 0.0
    for s, e in silences:
        if s - cur > 0.05:
            segs.append((cur, s))
        cur = e
    if total - cur > 0.05:
        segs.append((cur, total))
    return segs


def cut(src: Path, dst: Path, start: float, end: float):
    a, b = max(0.0, start - 0.03), end + 0.05
    ms.run(["ffmpeg", "-y", "-v", "error", "-i", str(src), "-af", f"atrim={a:.3f}:{b:.3f},asetpts=PTS-STARTPTS",
            str(dst)])


def make_raw(tts: Kokoro, item: dict, attempt: int, wav: Path) -> str:
    """Buat wav mentah untuk percobaan ke-n; kembalikan keterangan variasi."""
    h = item["hanzi"]
    single = len(HAN.findall(h)) == 1
    if attempt == 1:
        tts.synth(h, 1.0, wav)
        return "plain, speed 1.0"
    if attempt == 2:
        tts.synth(h + "。", 0.9, wav)
        return "text + 。, speed 0.9"
    if single:
        frame = wav.with_suffix(".frame.wav")
        tts.synth(f"{h}，{h}，{h}。", 1.0, frame)
        segs = voiced_segments(frame)
        if len(segs) != 3:
            raise RuntimeError(f"bingkai: {len(segs)} bagian bersuara, bukan 3")
        cut(frame, wav, *segs[1])
        return "frame X，X，X。 -> middle syllable"
    tts.synth(h + "。", 0.8, wav)
    return "text + 。, speed 0.8"


# --------------------------------------------------------------------------
# Cek
# --------------------------------------------------------------------------

class Checker:
    def __init__(self):
        from faster_whisper import WhisperModel
        from opencc import OpenCC
        from pypinyin import Style, pinyin

        self.model = WhisperModel(ms.WHISPER_MODEL, device="cpu", compute_type="int8")
        self.t2s = OpenCC("t2s")
        self.readings = lambda ch: {r for r in pinyin(ch, style=Style.TONE, heteronym=True)[0]}

    def norm(self, text: str) -> str:
        text = unicodedata.normalize("NFKC", text)
        text = text.replace("10", "十")
        text = "".join(DIGITS.get(c, c) for c in text)
        text = "".join(c for c in text if unicodedata.category(c)[0] not in "PZSC")
        return self.t2s.convert(text)

    def transcribe(self, path: Path) -> str:
        segs, _ = self.model.transcribe(str(path), language="zh", beam_size=5, vad_filter=False,
                                        condition_on_previous_text=False)
        return "".join(s.text for s in segs).strip()

    def syllable_ok(self, chars: str, target: str) -> bool:
        return all(unicodedata.normalize("NFC", target.lower()) in self.readings(c) for c in chars)

    def check(self, mp3: Path, item: dict, tmp: Path) -> tuple[bool, str, str]:
        """(lolos, transkrip, cara cek)."""
        h = item["hanzi"]
        transcript = self.transcribe(mp3)
        got = self.norm(transcript)
        if len(HAN.findall(h)) != 1:
            return got == self.norm(h), transcript, "hanzi"
        if len(got) == 1 and self.syllable_ok(got, item["pinyin"]):
            return True, transcript, "pinyin"
        rep = tmp / "repeat.wav"
        ms.run(["ffmpeg", "-y", "-v", "error", "-i", str(mp3), "-filter_complex",
                "[0:a]apad=pad_dur=0.6,asplit=3[a][b][c];[a][b][c]concat=n=3:v=0:a=1", str(rep)])
        t2 = self.transcribe(rep)
        g2 = self.norm(t2)
        if 2 <= len(g2) <= 4 and self.syllable_ok(g2, item["pinyin"]):
            return True, f"{transcript} | x3: {t2}", "pinyin-repeat3"
        return False, f"{transcript} | x3: {t2}", "pinyin"


def score(ok: bool, transcript: str, item: dict, checker: Checker) -> int:
    if ok:
        return 2
    first = checker.norm(transcript.split("|")[0])
    return 1 if first == checker.norm(item["hanzi"]) else 0


# --------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(ROOT / "public" / "audio" / "basics"))
    ap.add_argument("--work", default=str(ROOT / ".basics-work"))
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--budget-min", type=float, default=38.0)
    args = ap.parse_args()
    out, work = Path(args.out), Path(args.work)
    out.mkdir(parents=True, exist_ok=True)
    work.mkdir(parents=True, exist_ok=True)

    items = audio_items(json.loads(DATA.read_text(encoding="utf-8")))
    ids = [i["audioId"] for i in items]
    if len(set(ids)) != len(ids):
        sys.exit("audioId ganda di basics.json")
    voice = next(v for v in json.loads((ROOT / "scripts" / "tts" / "voices.json").read_text())["voices"]
                 if v["code"] == VOICE_CODE)

    manifest_path = out / "manifest.json"
    old = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else None
    old_files = (old or {}).get("files", {}) if (old or {}).get("scriptVersion") == SCRIPT_VERSION else {}

    def reusable(it):
        f = old_files.get(it["audioId"])
        return (not args.force and f is not None and f.get("hanzi") == it["hanzi"]
                and f.get("pinyin") == it["pinyin"] and (out / f["path"]).exists())

    todo = [it for it in items if not reusable(it)]
    log(f"[basics] {len(items)} item, {len(todo)} perlu dibuat")
    tts = Kokoro(voice) if todo else None
    checker = Checker() if todo else None

    files: dict[str, dict] = {}
    pending: list[str] = []
    t0 = time.monotonic()
    for it in items:
        aid = it["audioId"]
        if it not in todo:
            files[aid] = old_files[aid]
            continue
        if time.monotonic() - t0 > args.budget_min * 60:
            pending.append(aid)
            if aid in old_files and (out / old_files[aid]["path"]).exists():
                files[aid] = old_files[aid]
            continue
        started = time.monotonic()
        best = None
        attempts = 0
        for attempt in (1, 2, 3):
            attempts = attempt
            tmp = work / aid
            tmp.mkdir(parents=True, exist_ok=True)
            raw, mp3 = tmp / f"raw{attempt}.wav", tmp / f"try{attempt}.mp3"
            try:
                variant = make_raw(tts, it, attempt, raw)
                ms.normalize(raw, mp3, tmp)
                ok, transcript, how = checker.check(mp3, it, tmp)
            except Exception as e:  # noqa: BLE001
                traceback.print_exc()
                log(f"[basics] {aid} percobaan {attempt} gagal: {type(e).__name__}: {e}")
                continue
            s = score(ok, transcript, it, checker)
            log(f"[basics] {aid} {it['hanzi']} {it['pinyin']} #{attempt} ({variant}): "
                f"{'OK' if ok else 'BEDA'} '{transcript}' [{how}]")
            if best is None or s > best["score"]:
                best = {"score": s, "mp3": mp3, "ok": ok, "transcript": transcript, "check": how, "variant": variant}
            if ok:
                break
        if best is None:
            log(f"[basics] {aid}: semua percobaan gagal, tidak ada file")
            continue
        log(f"[basics] {aid}: {time.monotonic() - started:.1f}s")
        rel = f"{aid}.mp3"
        (out / rel).write_bytes(best["mp3"].read_bytes())
        files[aid] = {
            "path": rel, "durationSec": ms.duration(out / rel), "transcript": best["transcript"],
            "ok": bool(best["ok"]), "attempts": attempts, "check": best["check"], "variant": best["variant"],
            "hanzi": it["hanzi"], "pinyin": it["pinyin"],
        }

    keep = {f["path"] for f in files.values()} | {"manifest.json"}
    for p in out.iterdir():
        if p.name not in keep:
            p.unlink()

    passed = sum(1 for f in files.values() if f["ok"])
    now = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    unchanged = (old is not None and old.get("files") == files and old.get("scriptVersion") == SCRIPT_VERSION
                 and old.get("pending", []) == pending)
    manifest = {
        "version": 1,
        "scriptVersion": SCRIPT_VERSION,
        "generatedAt": old["generatedAt"] if unchanged else now,
        "voice": {"code": VOICE_CODE, "model": voice["model"], "repoId": voice["repoId"],
                  "modelRevision": voice["modelRevision"], "voiceId": voice["voiceId"], "speed": 1.0,
                  "license": voice["license"]},
        "format": {"codec": "mp3", "channels": 1, "bitrate": ms.BITRATE, "sampleRate": ms.SAMPLE_RATE,
                   "loudnessLUFS": ms.LUFS},
        "whisper": {"model": f"faster-whisper {ms.WHISPER_MODEL}", "passed": passed, "total": len(items)},
        "complete": not pending,
        "pending": pending,
        "files": files,
    }
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    by_id = {i["audioId"]: i for i in items}
    issues = [{"audioId": aid, "hanzi": by_id[aid]["hanzi"], "pinyin": by_id[aid]["pinyin"],
               "transcript": f["transcript"], "attempts": f["attempts"], "file": f["path"]}
              for aid, f in files.items() if not f["ok"] and aid not in pending]
    issues += [{"audioId": i["audioId"], "hanzi": i["hanzi"], "pinyin": i["pinyin"], "transcript": None,
                "attempts": 3, "file": None} for i in items if i["audioId"] not in files and i["audioId"] not in pending]
    issues_doc = {
        "version": 1,
        "note": "Dibuat oleh scripts/tts-basics/basics.py. File tetap dipakai situs (suara terbaik dari 3 percobaan), tetapi belum lolos cek Whisper.",
        "whisper": manifest["whisper"],
        "pending": pending,
        "items": issues,
    }
    ISSUES.write_text(json.dumps(issues_doc, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    log(f"[basics] selesai: lolos {passed}/{len(items)}; {len(issues)} tercatat di audio-issues.json; "
        f"{len(pending)} belum dibuat (batas waktu)")
    gh_out = __import__("os").environ.get("GITHUB_OUTPUT")
    if gh_out:
        with open(gh_out, "a", encoding="utf-8") as fh:
            fh.write(f"complete={'true' if not pending else 'false'}\n")


if __name__ == "__main__":
    sys.exit(main())
