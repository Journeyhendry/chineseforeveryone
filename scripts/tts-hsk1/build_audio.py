#!/usr/bin/env python3
"""Audio HSK 1 (task 4b): suara P3 (zf_001) + L3 (zm_010) dari Kokoro-82M v1.1-zh.

Tiga tahap (dijalankan .github/workflows/build-audio.yml):

  build_audio.py plan  [--shards N]          -> cetak daftar shard (JSON) untuk matrix
  build_audio.py shard --shard I --shards N --work DIR
        buat audio item yang belum ada/berubah (bagian ke-I), cek Whisper, tulis DIR/out
  build_audio.py merge --inputs DIR [DIR ...]
        gabung hasil shard ke public/audio/hsk1, tulis manifest.json, index.json, audio-issues.json

Item yang hash-nya sama dengan manifest dan file mp3-nya ada dilewati, jadi menjalankan ulang
tanpa perubahan data tidak mengubah file apa pun.
"""
from __future__ import annotations

import argparse
import difflib
import json
import math
import os
import re
import shutil
import sys
import time
import traceback
import unicodedata
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(ROOT / "scripts" / "tts"))
sys.path.insert(0, str(HERE))

import hsk1_items  # noqa: E402

AUDIO_DIR = ROOT / "public" / "audio" / "hsk1"
ITEMS_FILE = ROOT / "data" / "hsk1" / "audio-items.json"
ISSUES_FILE = ROOT / "data" / "hsk1" / "audio-issues.json"
SAMPLE_RATE = 24000
MAX_ATTEMPTS = 3
MAX_SHARDS = 12
ITEMS_PER_SHARD = 200
# Batas durasi (detik, termasuk jeda 0,3 dtk): di luar ini hasilnya dianggap gagal (biasanya ngawur).
DURATION_LIMITS = {
    "word": (0.3, 3.0), "word-slow": (0.3, 4.0),
    "casual": (0.3, 5.0), "casual-slow": (0.3, 7.0),
    "sentence": (0.3, 12.0), "dialog": (0.3, 12.0),
}
# Whisper sering salah/mengarang pada klip sangat pendek (kata tunggal ~0,7 dtk). Untuk teks
# pendek, klip yang dicek = kalimat pembawa (suara yang sama) + jeda + klip itu; kalimat pembawa
# dibuang dari transkrip sebelum dibandingkan. File yang disimpan tetap klip aslinya saja.
CARRIER = "这个词是"
CARRIER_MAX_LETTERS = 6
PASS_WORDS = 0.95
PASS_ALL = 0.90


def log(*a):
    print(*a, file=sys.stderr, flush=True)


def load_json(p: Path):
    return json.loads(p.read_text(encoding="utf-8"))


def dump_json(p: Path, obj, indent=1):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(obj, ensure_ascii=False, indent=indent) + "\n", encoding="utf-8")


def mp3_rel(it: dict) -> str:
    kind = it["kind"]
    return f"{kind}/{it['key'][len(kind) + 1:]}.mp3"


def read_items() -> list[dict]:
    doc = load_json(ITEMS_FILE)
    return doc["items"]


def read_manifest() -> dict:
    p = AUDIO_DIR / "manifest.json"
    return load_json(p) if p.exists() else {"files": {}}


def todo_items(items: list[dict]) -> list[dict]:
    files = read_manifest().get("files", {})
    retry = os.environ.get("RETRY_FAILED") == "1"
    out = []
    for it in items:
        e = files.get(it["key"])
        if e and e["hash"] == it["hash"] and (AUDIO_DIR / e["path"]).exists() and (e["ok"] or not retry):
            continue
        out.append(it)
    return out


# --------------------------------------------------------------------------
# plan
# --------------------------------------------------------------------------

def cmd_plan(args):
    items = read_items()
    fresh = hsk1_items.render()
    if ITEMS_FILE.read_text(encoding="utf-8") != fresh:
        sys.exit("data/hsk1/audio-items.json tidak sesuai data. Jalankan: python3 scripts/tts-hsk1/hsk1_items.py dan commit.")
    todo = todo_items(items)
    n = min(MAX_SHARDS, math.ceil(len(todo) / ITEMS_PER_SHARD)) if todo else 0
    log(f"[plan] {len(items)} item, {len(todo)} perlu dibuat, {n} shard")
    print(json.dumps({"count": len(todo), "shards": list(range(n)), "total": n}))


# --------------------------------------------------------------------------
# Pengecekan Whisper
# --------------------------------------------------------------------------

DIGITS = "零一二三四五六七八九"


def zh_cardinal(n: int) -> str:
    if n < 10:
        return DIGITS[n]
    if n < 20:
        return "十" + (DIGITS[n - 10] if n > 10 else "")
    if n < 100:
        t, o = divmod(n, 10)
        return DIGITS[t] + "十" + (DIGITS[o] if o else "")
    if n < 1000:
        h, r = divmod(n, 100)
        s = DIGITS[h] + "百"
        if r == 0:
            return s
        if r < 10:
            return s + "零" + DIGITS[r]
        return s + zh_cardinal(r) if r >= 20 else s + "一" + zh_cardinal(r)
    return "".join(DIGITS[int(c)] for c in str(n))


def number_variants(s: str) -> list[str]:
    """Angka Arab dibaca: kardinal (21 -> 二十一) dan per angka (2012 -> 二零一二)."""
    if not re.search(r"\d", s):
        return [s]
    card = re.sub(r"\d+", lambda m: zh_cardinal(int(m.group())), s)
    digit = re.sub(r"\d+", lambda m: "".join(DIGITS[int(c)] for c in m.group()), s)
    return list(dict.fromkeys([card, digit]))


class Checker:
    def __init__(self):
        from opencc import OpenCC
        from pypinyin import Style, pinyin

        self.t2s = OpenCC("t2s")
        self._pinyin = pinyin
        self._style = Style.TONE

    def norm(self, text: str) -> str:
        text = unicodedata.normalize("NFKC", text)
        text = "".join(ch for ch in text if unicodedata.category(ch)[0] not in "PZSC")
        return self.t2s.convert(text)

    def strip_carrier(self, transcript: str) -> str:
        """Buang kalimat pembawa dari awal transkrip (cocok persis atau sama bunyi)."""
        pre, t = self.norm(CARRIER), self.norm(transcript)
        if t.startswith(pre) or (len(t) >= len(pre) and self.py(t[: len(pre)]) == self.py(pre)):
            return t[len(pre):]
        return t

    def py(self, s: str) -> list[str]:
        return [unicodedata.normalize("NFC", x[0]).lower() for x in self._pinyin(s, style=self._style, errors=lambda c: [c])]

    def check(self, text: str, transcript: str, pinyin: str | None) -> tuple[bool, str, float]:
        """(lolos, 'exact'|'homophone'|'beda', kemiripan 0..1)."""
        a_vars = [self.norm(v).replace("两", "二") for v in number_variants(text)]
        b_vars = [self.norm(v).replace("两", "二") for v in number_variants(transcript)]
        sim = max(difflib.SequenceMatcher(None, a, b).ratio() for a in a_vars for b in b_vars)
        if any(a == b for a in a_vars for b in b_vars):
            return True, "exact", 1.0
        if len(a_vars[0]) == 1 and pinyin:
            want = [unicodedata.normalize("NFC", s).lower() for s in pinyin.split()]
            if any(self.py(b) == want for b in b_vars if b):
                return True, "homophone", sim
            return False, "beda", sim
        if any(self.py(a) == self.py(b) for a in a_vars for b in b_vars if b):
            return True, "homophone", sim
        return False, "beda", sim


# --------------------------------------------------------------------------
# shard
# --------------------------------------------------------------------------

def variants(it: dict):
    """(teks yang diucapkan, kecepatan, nama variasi) per percobaan."""
    t, s = it["text"], it["speed"]
    end = t if re.search(r"[。！？!?…]$", t) else t + "。"
    return [(t, s, "asli"), (end, round(s * 0.9, 3), "titik+pelan"), (end, round(s * 1.1, 3), "titik+cepat")]


def load_kokoro(voice_codes):
    import torch
    from huggingface_hub import hf_hub_download
    from kokoro import KModel, KPipeline

    voices = hsk1_items.voice_table()
    repo = {voices[c]["repoId"] for c in voice_codes}
    assert len(repo) == 1, "P3 dan L3 harus satu repo"
    repo = repo.pop()
    rev = voices[voice_codes[0]]["modelRevision"]
    log(f"[kokoro] torch {torch.__version__}, {repo}@{rev}")
    cfg = hf_hub_download(repo, "config.json", revision=rev)
    ckpt = hf_hub_download(repo, "kokoro-v1_1-zh.pth", revision=rev)
    model = KModel(repo_id=repo, config=cfg, model=ckpt).eval()
    pipe = KPipeline(lang_code="z", repo_id=repo, model=model)
    packs = {c: hf_hub_download(repo, f"voices/{voices[c]['voiceId']}.pt", revision=rev) for c in voice_codes}
    return pipe, packs


def synth(pipe, pack, text, speed, dst: Path):
    import numpy as np
    import make_samples as ms

    chunks = []
    for res in pipe(text, voice=pack, speed=speed, split_pattern=None):
        if res.audio is not None:
            chunks.append(res.audio.numpy())
    if not chunks:
        raise RuntimeError("tidak ada audio")
    ms.write_wav(dst, np.concatenate(chunks), SAMPLE_RATE)


def make_check_clip(prefix: Path, mp3: Path, dst: Path):
    """prefix + 0,3 dtk jeda + klip -> wav untuk Whisper."""
    import make_samples as ms

    ms.run(["ffmpeg", "-y", "-v", "error", "-i", str(prefix), "-i", str(mp3), "-filter_complex",
            f"[0]aresample={SAMPLE_RATE},apad=pad_dur=0.3[a];[1]aresample={SAMPLE_RATE}[b];[a][b]concat=n=2:v=0:a=1",
            "-ac", "1", str(dst)])


def cmd_shard(args):
    import make_samples as ms
    from faster_whisper import WhisperModel

    items = read_items()
    todo = todo_items(items)[args.shard::args.shards]
    work = Path(args.work)
    out = work / "out"
    shutil.rmtree(out, ignore_errors=True)
    out.mkdir(parents=True)
    log(f"[shard {args.shard}/{args.shards}] {len(todo)} item")
    entries: dict[str, dict] = {}
    if not todo:
        dump_json(out / "entries.json", entries)
        return

    codes = sorted({it["voice"] for it in todo} | {"P3"})
    pipe, packs = load_kokoro(codes)
    whisper = WhisperModel(ms.WHISPER_MODEL, device="cpu", compute_type="int8")
    checker = Checker()
    tmp = work / "tmp"
    tmp.mkdir(parents=True, exist_ok=True)
    prefixes = {}
    for code in codes:
        raw, pm = tmp / f"carrier-{code}.wav", tmp / f"carrier-{code}.mp3"
        synth(pipe, packs[code], CARRIER, 1.0, raw)
        ms.normalize(raw, pm, tmp)
        prefixes[code] = pm
    t0 = time.time()

    for n, it in enumerate(todo, 1):
        best = None
        for attempt, (text, speed, name) in enumerate(variants(it)[:MAX_ATTEMPTS], 1):
            cand = {"attempt": attempt, "variant": name}
            try:
                raw = tmp / "raw.wav"
                mp3 = tmp / f"a{attempt}.mp3"
                synth(pipe, packs[it["voice"]], text, speed, raw)
                ms.normalize(raw, mp3, tmp)
                dur = ms.duration(mp3)
                carrier = len(checker.norm(it["text"])) <= CARRIER_MAX_LETTERS
                clip = mp3
                if carrier:
                    clip = tmp / f"chk{attempt}.wav"
                    make_check_clip(prefixes[it["voice"]], mp3, clip)
                segs, _ = whisper.transcribe(str(clip), language="zh", beam_size=5, vad_filter=False,
                                             condition_on_previous_text=False, temperature=0.0)
                transcript = "".join(s.text for s in segs).strip()
                heard = checker.strip_carrier(transcript) if carrier else transcript
                ok, how, sim = checker.check(it["text"], heard, it.get("pinyin"))
                lo, hi = DURATION_LIMITS[it["kind"]]
                if not lo <= dur <= hi:
                    ok, how = False, f"durasi {dur}s"
                cand.update(mp3=mp3, dur=dur, transcript=heard, ok=ok, check=how, sim=sim)
            except Exception as e:  # noqa: BLE001
                traceback.print_exc()
                cand.update(mp3=None, dur=0, transcript=f"(gagal: {type(e).__name__}: {e})"[:200], ok=False, check="galat", sim=-1)
            rank = (cand["ok"], cand["sim"] if cand["mp3"] else -2)
            if best is None or rank > best[0]:
                keep = tmp / f"best-{os.getpid()}.mp3"
                if cand["mp3"]:
                    shutil.copy(cand["mp3"], keep)
                best = (rank, {**cand, "mp3": keep if cand["mp3"] else None})
            if cand["ok"]:
                break
        b = best[1]
        entry = {"path": mp3_rel(it), "kind": it["kind"], "text": it["text"], "voice": it["voice"], "speed": it["speed"],
                 "durationSec": b["dur"], "transcript": b["transcript"], "ok": b["ok"], "check": b["check"],
                 "attempts": attempt, "hash": it["hash"]}
        if attempt > 1 or not b["ok"]:
            entry["variant"] = b["variant"]
        if b["mp3"] is None:
            log(f"[{n}/{len(todo)}] {it['key']} GAGAL SINTESIS")
            continue
        dst = out / entry["path"]
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(b["mp3"], dst)
        entries[it["key"]] = entry
        log(f"[{n}/{len(todo)}] {it['key']} {entry['durationSec']}s {'OK' if b['ok'] else 'GAGAL'}({b['check']}, x{attempt}) '{it['text']}' -> '{b['transcript']}' [{int(time.time() - t0)}s]")
    dump_json(out / "entries.json", entries)


# --------------------------------------------------------------------------
# merge
# --------------------------------------------------------------------------

def cmd_merge(args):
    doc = load_json(ITEMS_FILE)
    items = doc["items"]
    old = read_manifest().get("files", {})
    new: dict[str, dict] = {}
    srcs: dict[str, Path] = {}
    for d in args.inputs:
        d = Path(d)
        ef = next(iter(d.rglob("entries.json")), None)
        if ef is None:
            log(f"[merge] {d}: tidak ada entries.json (dilewati)")
            continue
        for k, e in load_json(ef).items():
            new[k] = e
            srcs[k] = ef.parent / e["path"]
    log(f"[merge] {len(new)} entri baru dari shard")

    files: dict[str, dict] = {}
    for it in items:
        k = it["key"]
        if k in new and new[k]["hash"] == it["hash"]:
            e = new[k]
            dst = AUDIO_DIR / e["path"]
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(srcs[k], dst)
            files[k] = e
        elif k in old and old[k]["hash"] == it["hash"] and (AUDIO_DIR / old[k]["path"]).exists():
            files[k] = old[k]
        else:
            log(f"[merge] BELUM ADA: {k} '{it['text']}'")
    keep = {AUDIO_DIR / e["path"] for e in files.values()}
    for p in AUDIO_DIR.rglob("*.mp3"):
        if p not in keep:
            p.unlink()
            log(f"[merge] hapus file basi {p.relative_to(AUDIO_DIR)}")
    for d in sorted(AUDIO_DIR.glob("*")):
        if d.is_dir() and not any(d.iterdir()):
            d.rmdir()

    voices_all = hsk1_items.voice_table()
    voices = {c: {"model": v["model"], "modelRevision": v["modelRevision"], "voiceId": v["voiceId"], "gender": v["gender"]}
              for c, v in voices_all.items()}
    by_kind: dict[str, dict] = {}
    for e in files.values():
        b = by_kind.setdefault(e["kind"], {"passed": 0, "total": 0})
        b["total"] += 1
        b["passed"] += 1 if e["ok"] else 0
    for kind in hsk1_items.KINDS:
        by_kind.setdefault(kind, {"passed": 0, "total": 0})
    passed = sum(b["passed"] for b in by_kind.values())
    total = sum(b["total"] for b in by_kind.values())
    wk = [by_kind[k] for k in ("word", "word-slow")]
    wp, wt = sum(b["passed"] for b in wk), sum(b["total"] for b in wk)
    manifest = {
        "version": 1,
        "settingsVersion": doc["settingsVersion"],
        "format": {"codec": "mp3", "channels": 1, "bitrate": "64k", "sampleRate": SAMPLE_RATE, "lufs": -16},
        "voices": voices,
        "whisper": {"model": "faster-whisper small (zh, cpu int8)", "passed": passed, "total": total,
                    "wordsPassed": wp, "wordsTotal": wt,
                    "byKind": {k: by_kind[k] for k in hsk1_items.KINDS}},
        "files": {it["key"]: files[it["key"]] for it in items if it["key"] in files},
    }
    dump_json(AUDIO_DIR / "manifest.json", manifest, indent=1)

    # Indeks ringkas untuk website: teks -> berkas (tanpa .mp3), dimuat malas.
    # Urutan prioritas P3: kata > ungkapan > kalimat > dialog; L3 hanya dialog laki-laki.
    idx: dict = {"v": 1, "P3": {}, "L3": {}, "slow": {}}
    order = {"word": 0, "casual": 1, "sentence": 2, "dialog": 3}
    for it in sorted((i for i in items if i["key"] in files and i["kind"] in order), key=lambda i: order[i["kind"]]):
        tbl = idx[it["voice"]]
        tbl.setdefault(it["text"], mp3_rel(it)[:-4])
    for it in items:
        if it["kind"] in ("word-slow", "casual-slow") and it["key"] in files:
            idx["slow"].setdefault(it["text"], mp3_rel(it)[:-4])
    dump_json(AUDIO_DIR / "index.json", idx, indent=None)

    issues = [{"key": it["key"], "kind": it["kind"], "text": it["text"], "transcript": files[it["key"]]["transcript"],
               "check": files[it["key"]]["check"], "attempts": files[it["key"]]["attempts"]}
              for it in items if it["key"] in files and not files[it["key"]]["ok"]]
    dump_json(ISSUES_FILE, {"version": 1, "issues": issues})

    log(f"[merge] Whisper lolos {passed}/{total}; kata {wp}/{wt}; masalah {len(issues)}")
    for k, b in by_kind.items():
        log(f"[merge]   {k}: {b['passed']}/{b['total']}")
    size = sum(p.stat().st_size for p in AUDIO_DIR.rglob("*.mp3"))
    log(f"[merge] total mp3 {size / 1e6:.1f} MB, {len(files)} berkas")
    if len(files) < len(items):
        log(f"[merge] PERINGATAN: {len(items) - len(files)} item belum punya audio")
    if total and (wt and wp / wt < PASS_WORDS or passed / total < PASS_ALL):
        log("[merge] PERINGATAN: tingkat lolos Whisper di bawah target (kata >= 95%, semua >= 90%)")


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("plan").set_defaults(fn=cmd_plan)
    s = sub.add_parser("shard")
    s.add_argument("--shard", type=int, required=True)
    s.add_argument("--shards", type=int, required=True)
    s.add_argument("--work", required=True)
    s.set_defaults(fn=cmd_shard)
    m = sub.add_parser("merge")
    m.add_argument("--inputs", nargs="*", default=[])
    m.set_defaults(fn=cmd_merge)
    args = ap.parse_args()
    args.fn(args)


if __name__ == "__main__":
    sys.exit(main())
