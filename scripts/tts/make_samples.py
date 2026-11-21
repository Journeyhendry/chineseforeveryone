#!/usr/bin/env python3
"""Membuat contoh suara TTS (task 4a). Dijalankan oleh .github/workflows/tts-samples.yml.

Dua tahap, supaya MeloTTS (versi paket lama, bentrok) bisa hidup di venv sendiri:

  make_samples.py synth --engine kokoro|melo --work DIR
      Buat wav mentah per suara x item di DIR/raw/<kode>/<itemId>.wav dan
      catat status di DIR/status/<engine>.json. Gagal satu suara tidak
      menggagalkan tahap ini (suara itu ditandai skipped + alasan).

  make_samples.py finish --work DIR [--out public/audio/samples]
      Normalisasi (ffmpeg), mp3 mono 64 kbps 24 kHz, cek Whisper, tulis manifest.
      Kegagalan Whisper hanya dicatat; tidak menggagalkan skrip.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import shutil
import subprocess
import sys
import traceback
import unicodedata
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent

SAMPLE_RATE = 24000
BITRATE = "64k"
LUFS = -16
TRUE_PEAK = -1.5
PAD_SEC = 0.15
WHISPER_MODEL = "small"


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def log(*a):
    print(*a, flush=True)


# --------------------------------------------------------------------------
# Hugging Face
# --------------------------------------------------------------------------

def hf_snapshot_info(repo_id: str, revision: str | None):
    """Daftar file repo (dicatat di log) dan commit yang dipakai."""
    from huggingface_hub import HfApi

    info = HfApi().model_info(repo_id, revision=revision or "main")
    files = sorted(s.rfilename for s in (info.siblings or []))
    log(f"[hf] {repo_id} @ {info.sha}: {len(files)} file")
    for f in files:
        log(f"[hf]   {f}")
    return info.sha, files


# --------------------------------------------------------------------------
# Tahap 1: synth
# --------------------------------------------------------------------------

def write_wav(path: Path, audio, sr: int):
    import numpy as np
    import soundfile as sf

    path.parent.mkdir(parents=True, exist_ok=True)
    arr = np.asarray(audio, dtype="float32").reshape(-1)
    sf.write(str(path), arr, sr)


def synth_kokoro(voices, items, work: Path):
    status = {}
    import numpy as np
    import torch
    from huggingface_hub import hf_hub_download
    from kokoro import KModel, KPipeline

    log(f"[kokoro] torch {torch.__version__}")
    model_files = {
        "hexgrad/Kokoro-82M": "kokoro-v1_0.pth",
        "hexgrad/Kokoro-82M-v1.1-zh": "kokoro-v1_1-zh.pth",
    }
    repos: dict[str, dict] = {}
    for v in voices:
        repo = v["repoId"]
        if repo in repos:
            continue
        try:
            sha, files = hf_snapshot_info(repo, v.get("modelRevision"))
            if v.get("modelRevision"):
                sha = v["modelRevision"]
            cfg = hf_hub_download(repo, "config.json", revision=sha)
            ckpt = hf_hub_download(repo, model_files[repo], revision=sha)
            model = KModel(repo_id=repo, config=cfg, model=ckpt).eval()
            pipe = KPipeline(lang_code="z", repo_id=repo, model=model)
            repos[repo] = {"sha": sha, "files": files, "pipe": pipe}
        except Exception as e:  # noqa: BLE001
            traceback.print_exc()
            repos[repo] = {"error": f"{type(e).__name__}: {e}"[:300]}

    for v in voices:
        code, repo = v["code"], v["repoId"]
        r = repos[repo]
        if "error" in r:
            status[code] = {"status": "skipped", "reason": f"model gagal dimuat: {r['error']}"}
            continue
        vid = v["voiceId"]
        try:
            avail = [f for f in r["files"] if f.startswith("voices/")]
            if f"voices/{vid}.pt" not in avail:
                names = ", ".join(a[7:-3] for a in avail)
                raise FileNotFoundError(f"voices/{vid}.pt tidak ada di repo. Tersedia: {names}")
            pack = hf_hub_download(repo, f"voices/{vid}.pt", revision=r["sha"])
            for it in items:
                chunks = []
                for res in r["pipe"](it["hanzi"], voice=pack, speed=1.0, split_pattern=None):
                    if res.audio is not None:
                        chunks.append(res.audio.numpy())
                if not chunks:
                    raise RuntimeError(f"tidak ada audio untuk {it['id']}")
                write_wav(work / "raw" / code / f"{it['id']}.wav", np.concatenate(chunks), SAMPLE_RATE)
            status[code] = {"status": "ok", "modelRevision": r["sha"]}
            log(f"[kokoro] {code} ({vid}) selesai")
        except Exception as e:  # noqa: BLE001
            traceback.print_exc()
            status[code] = {"status": "skipped", "reason": f"{type(e).__name__}: {e}"[:400], "modelRevision": r["sha"]}
    return status


def synth_melo(voices, items, work: Path):
    status = {}
    try:
        from melo.api import TTS

        sha = None
        try:
            sha, _ = hf_snapshot_info(voices[0]["repoId"], voices[0].get("modelRevision"))
        except Exception as e:  # noqa: BLE001
            log(f"[melo] tidak bisa baca revisi: {e}")
        tts = TTS(language="ZH", device="cpu")
        sr = int(tts.hps.data.sampling_rate)
        spk = tts.hps.data.spk2id
        log(f"[melo] sample rate {sr}, speakers {dict(spk)}")
    except Exception as e:  # noqa: BLE001
        traceback.print_exc()
        for v in voices:
            status[v["code"]] = {"status": "skipped", "reason": f"MeloTTS gagal dimuat: {type(e).__name__}: {e}"[:400]}
        return status

    for v in voices:
        code = v["code"]
        try:
            for it in items:
                tmp = work / "raw" / code / f"{it['id']}.wav"
                tmp.parent.mkdir(parents=True, exist_ok=True)
                tts.tts_to_file(it["hanzi"], spk[v["voiceId"]], str(tmp), speed=1.0, quiet=True)
                if not tmp.exists() or tmp.stat().st_size < 1000:
                    raise RuntimeError(f"audio kosong untuk {it['id']}")
            status[code] = {"status": "ok", "modelRevision": sha, "sampleRate": sr}
            log(f"[melo] {code} selesai")
        except Exception as e:  # noqa: BLE001
            traceback.print_exc()
            status[code] = {"status": "skipped", "reason": f"{type(e).__name__}: {e}"[:400]}
    return status


def cmd_synth(args):
    work = Path(args.work)
    samples = load_json(HERE / "samples.json")
    voices_all = load_json(HERE / "voices.json")["voices"]
    voices = [v for v in voices_all if v["engine"] == args.engine]
    (work / "status").mkdir(parents=True, exist_ok=True)
    fn = synth_kokoro if args.engine == "kokoro" else synth_melo
    status = fn(voices, samples["items"], work)
    (work / "status" / f"{args.engine}.json").write_text(json.dumps(status, indent=2, ensure_ascii=False), encoding="utf-8")
    log(json.dumps(status, indent=2, ensure_ascii=False))


# --------------------------------------------------------------------------
# Tahap 2: finish
# --------------------------------------------------------------------------

def run(cmd, **kw):
    return subprocess.run(cmd, check=True, capture_output=True, text=True, **kw)


def normalize(src: Path, dst: Path, tmpdir: Path):
    """Pangkas sunyi, loudnorm dua lintasan (-16 LUFS, <= -1.5 dBTP), beri jeda, mp3."""
    trimmed = tmpdir / "trim.wav"
    sil = "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.03"
    run(["ffmpeg", "-y", "-v", "error", "-i", str(src), "-af", f"{sil},areverse,{sil},areverse",
         "-ac", "1", str(trimmed)])
    base = f"loudnorm=I={LUFS}:TP={TRUE_PEAK}:LRA=11"
    p = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(trimmed), "-af", base + ":print_format=json",
                        "-f", "null", "-"], capture_output=True, text=True, check=True)
    m = re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", p.stderr, re.S)
    stats = json.loads(m.group(0))
    second = (f"{base}:measured_I={stats['input_i']}:measured_TP={stats['input_tp']}:"
              f"measured_LRA={stats['input_lra']}:measured_thresh={stats['input_thresh']}:"
              f"offset={stats['target_offset']}:linear=true")
    pad_ms = int(PAD_SEC * 1000)
    chain = f"{second},aresample={SAMPLE_RATE},adelay={pad_ms}:all=1,apad=pad_dur={PAD_SEC}"
    dst.parent.mkdir(parents=True, exist_ok=True)
    run(["ffmpeg", "-y", "-v", "error", "-i", str(trimmed), "-af", chain, "-ac", "1", "-ar", str(SAMPLE_RATE),
         "-c:a", "libmp3lame", "-b:a", BITRATE, str(dst)])


def duration(path: Path) -> float:
    out = run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)]).stdout
    return round(float(out.strip()), 2)


def make_normalizer():
    from opencc import OpenCC

    t2s = OpenCC("t2s")

    def norm(text: str) -> str:
        text = unicodedata.normalize("NFKC", text)
        text = "".join(ch for ch in text if unicodedata.category(ch)[0] not in "PZSC")
        return t2s.convert(text)

    return norm


def cmd_finish(args):
    work = Path(args.work)
    out = Path(args.out)
    samples = load_json(HERE / "samples.json")
    voices = load_json(HERE / "voices.json")["voices"]
    items = samples["items"]

    statuses: dict[str, dict] = {}
    engines_run = set()
    for f in (work / "status").glob("*.json"):
        statuses.update(load_json(f))
        engines_run.add(f.stem)

    def effective(v):
        s = statuses.get(v["code"])
        if v["engine"] not in engines_run or s is None:
            return {"status": "skipped", "reason": f"mesin {v['engine']} tidak berjalan di runner (lihat log workflow)"}
        return s

    by_code = {v["code"]: effective(v) for v in voices}
    chosen = []
    for v in voices:
        # suara cadangan hanya dipakai bila suara yang digantikan gagal
        if v.get("onlyIfSkipped") and by_code[v["onlyIfSkipped"]]["status"] == "ok":
            continue
        chosen.append((v, by_code[v["code"]]))

    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)
    tmpdir = work / "tmp"
    tmpdir.mkdir(parents=True, exist_ok=True)

    whisper = None
    whisper_err = None
    try:
        from faster_whisper import WhisperModel

        whisper = WhisperModel(WHISPER_MODEL, device="cpu", compute_type="int8")
    except Exception as e:  # noqa: BLE001
        traceback.print_exc()
        whisper_err = f"{type(e).__name__}: {e}"[:300]
    norm = make_normalizer()

    total = passed = 0
    voice_entries = []
    for v, s in chosen:
        entry = {
            "code": v["code"], "gender": v["gender"], "engine": v["engine"], "model": v["model"],
            "modelRevision": s.get("modelRevision") or v.get("modelRevision"),
            "voiceId": v["voiceId"], "license": v["license"], "status": "skipped", "files": {},
        }
        if v.get("onlyIfSkipped"):
            entry["replaces"] = v["onlyIfSkipped"]
        if s["status"] != "ok":
            entry["reason"] = s.get("reason", "gagal")
            voice_entries.append(entry)
            continue
        try:
            files = {}
            for it in items:
                raw = work / "raw" / v["code"] / f"{it['id']}.wav"
                rel = f"{v['code']}/{it['id']}.mp3"
                normalize(raw, out / rel, tmpdir)
                transcript, ok = None, None
                if whisper is not None:
                    try:
                        segs, _ = whisper.transcribe(str(out / rel), language="zh", beam_size=5,
                                                     vad_filter=False, condition_on_previous_text=False)
                        transcript = "".join(sg.text for sg in segs).strip()
                        ok = norm(transcript) == norm(it["hanzi"])
                    except Exception as e:  # noqa: BLE001
                        traceback.print_exc()
                        transcript = f"(Whisper gagal: {type(e).__name__})"
                        ok = False
                else:
                    transcript = f"(Whisper tidak tersedia: {whisper_err})"
                    ok = False
                total += 1
                passed += 1 if ok else 0
                files[it["id"]] = {"path": rel, "durationSec": duration(out / rel),
                                   "transcript": transcript, "whisperOk": bool(ok)}
                log(f"[finish] {v['code']} {it['id']}: {files[it['id']]['durationSec']}s whisper={'ok' if ok else 'BEDA'} '{transcript}'")
            entry["files"] = files
            entry["whisperPassed"] = sum(1 for f in files.values() if f["whisperOk"])
            entry["whisperTotal"] = len(files)
            entry["status"] = "ok"
        except Exception as e:  # noqa: BLE001
            traceback.print_exc()
            for it in items:
                p = out / v["code"] / f"{it['id']}.mp3"
                if p.exists():
                    p.unlink()
            entry["files"] = {}
            entry["reason"] = f"pasca-proses gagal: {type(e).__name__}: {e}"[:400]
        voice_entries.append(entry)

    manifest = {
        "version": 1,
        "generatedAt": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "items": items,
        "voices": voice_entries,
        "whisper": {"model": f"faster-whisper {WHISPER_MODEL}", "passed": passed, "total": total},
    }
    (out / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    log(f"[finish] manifest ditulis; Whisper lolos {passed}/{total}")
    for e in voice_entries:
        log(f"[finish] {e['code']} {e['engine']} {e['voiceId']}: {e['status']} {e.get('reason', '')}")


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("synth")
    s.add_argument("--engine", choices=["kokoro", "melo"], required=True)
    s.add_argument("--work", required=True)
    s.set_defaults(fn=cmd_synth)
    f = sub.add_parser("finish")
    f.add_argument("--work", required=True)
    f.add_argument("--out", default=str(ROOT / "public" / "audio" / "samples"))
    f.set_defaults(fn=cmd_finish)
    args = ap.parse_args()
    args.fn(args)


if __name__ == "__main__":
    sys.exit(main())
