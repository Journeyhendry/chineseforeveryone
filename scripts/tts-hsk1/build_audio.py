#!/usr/bin/env python3
"""Audio HSK 1 (task 4b): suara P3 (zf_001) + L3 (zm_010) dari Kokoro-82M v1.1-zh.

Tiga tahap (dijalankan .github/workflows/build-audio.yml):

  build_audio.py plan                        -> cetak daftar shard (JSON) untuk matrix
  build_audio.py shard --shard I --shards N --work DIR
        item baru/berubah: sintesis + cek Whisper; item yang hash-nya sama tetapi pengecek berubah
        (checkVersion) atau RECHECK=1: hanya ditranskripsi ulang, mp3 tidak disentuh kecuali tetap
        gagal (lalu disintesis ulang dengan variasi, maks 3 percobaan). Tulis DIR/out
  build_audio.py merge --inputs DIR [DIR ...]
        gabung hasil shard ke public/audio/hsk1, tulis manifest.json, index.json, audio-issues.json

Pengecekan (normalisasi, erhua, homofon, suku kata tunggal) ada di check.py dan tone.py (diuji di
test_check.py). Item yang hash-nya sama, pengecek-nya sama, dan file-nya ada dilewati.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import re
import shutil
import sys
import time
import traceback
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(ROOT / "scripts" / "tts"))
sys.path.insert(0, str(HERE))

import hsk1_items  # noqa: E402
import check  # noqa: E402
import tone  # noqa: E402

AUDIO_DIR = ROOT / "public" / "audio" / "hsk1"
ITEMS_FILE = ROOT / "data" / "hsk1" / "audio-items.json"
ISSUES_FILE = ROOT / "data" / "hsk1" / "audio-issues.json"
SAMPLE_RATE = 24000
MAX_ATTEMPTS = 3
MAX_SHARDS = 20
ITEMS_PER_SHARD = 120
# Batas durasi (detik, termasuk jeda 0,3 dtk): di luar ini hasilnya dianggap gagal (biasanya ngawur).
DURATION_LIMITS = {
    "word": (0.3, 3.0), "word-slow": (0.3, 4.0),
    "casual": (0.3, 5.0), "casual-slow": (0.3, 7.0),
    "sentence": (0.3, 12.0), "dialog": (0.3, 12.0),
}
# Whisper sering salah/mengarang pada klip sangat pendek. Bila transkripsi polos gagal, teks
# pendek dicek lagi dengan kalimat pembawa (suara DAN kecepatan sama dengan item) di depannya.
# Lolos bila salah satu cara lolos; cara yang lolos dicatat. File yang disimpan tetap klip aslinya.
WHISPER_REPO = "Systran/faster-whisper-large-v3"
WHISPER_REVISION = None  # dipatok ke SHA commit setelah jalan pertama (SHA tercetak di log dan manifest)
WHISPER_LABEL = "faster-whisper large-v3 (zh, cpu int8, beam 5)"
BUDGET_MIN = float(os.environ.get("SHARD_BUDGET_MIN", "100"))
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


def todo_items(items: list[dict]) -> list[tuple[dict, str]]:
    """(item, mode): 'build' (belum ada/hash berubah) | 'recheck' (cek ulang file yang ada)."""
    files = read_manifest().get("files", {})
    force = os.environ.get("RECHECK") == "1"
    retry = os.environ.get("RETRY_FAILED") == "1"
    out = []
    for it in items:
        e = files.get(it["key"])
        if not e or e["hash"] != it["hash"] or not (AUDIO_DIR / e["path"]).exists():
            out.append((it, "build"))
        elif force or e.get("checkVersion") != check.CHECK_VERSION or (retry and not e["ok"]):
            out.append((it, "recheck"))
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
    modes = {m: sum(1 for _, x in todo if x == m) for m in ("build", "recheck")}
    log(f"[plan] {len(items)} item, {len(todo)} perlu dikerjakan {modes}, {n} shard")
    print(json.dumps({"count": len(todo), "shards": list(range(n)), "total": n}))


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
    """pembawa + 0,3 dtk jeda + klip -> wav untuk Whisper."""
    import make_samples as ms

    ms.run(["ffmpeg", "-y", "-v", "error", "-i", str(prefix), "-i", str(mp3), "-filter_complex",
            f"[0]aresample={SAMPLE_RATE},apad=pad_dur=0.3[a];[1]aresample={SAMPLE_RATE}[b];[a][b]concat=n=2:v=0:a=1",
            "-ac", "1", str(dst)])


def load_whisper():
    from faster_whisper import WhisperModel
    from huggingface_hub import snapshot_download

    path = snapshot_download(WHISPER_REPO, revision=WHISPER_REVISION)
    rev = Path(path).name
    log(f"[whisper] {WHISPER_REPO}@{rev}")
    return WhisperModel(path, device="cpu", compute_type="int8"), rev


class Ctx:
    """Model dan berkas kerja satu shard (Kokoro dimuat malas: cek ulang murni tidak memerlukannya)."""

    def __init__(self, work: Path):
        self.tmp = work / "tmp"
        self.tmp.mkdir(parents=True, exist_ok=True)
        self.whisper, self.whisper_rev = load_whisper()
        self.checker = check.Checker()
        self._kokoro = None
        self._carriers: dict = {}

    def kokoro(self):
        if self._kokoro is None:
            self._kokoro = load_kokoro(["L3", "P3"])
        return self._kokoro

    def synth(self, voice, text, speed, dst: Path):
        pipe, packs = self.kokoro()
        synth(pipe, packs[voice], text, speed, dst)

    def carrier(self, voice: str, speed: float) -> Path:
        """Kalimat pembawa dengan suara dan kecepatan yang sama dengan item."""
        import make_samples as ms

        k = (voice, speed)
        if k not in self._carriers:
            raw, pm = self.tmp / f"carrier-{voice}-{speed}.wav", self.tmp / f"carrier-{voice}-{speed}.mp3"
            self.synth(voice, check.CARRIER, speed, raw)
            ms.normalize(raw, pm, self.tmp)
            self._carriers[k] = pm
        return self._carriers[k]

    def transcribe(self, path: Path) -> str:
        segs, _ = self.whisper.transcribe(str(path), language="zh", beam_size=5, vad_filter=False,
                                          condition_on_previous_text=False, temperature=0.0,
                                          initial_prompt=check.INITIAL_PROMPT)
        return "".join(s.text for s in segs).strip()


def evaluate(ctx: Ctx, it: dict, mp3: Path, speed: float) -> dict:
    """Transkripsi polos; bila gagal dan teks pendek, ulangi dengan kalimat pembawa. Lolos bila salah satu lolos."""
    import make_samples as ms

    ck = ctx.checker
    dur = ms.duration(mp3)
    hz_cache: list = []

    def hz():
        if not hz_cache:
            hz_cache.append(tone.f0_contour(mp3, ctx.tmp / "f0.wav"))
        return hz_cache[0]

    plain = ctx.transcribe(mp3)
    res = ck.evaluate(it["text"], it.get("pinyin"), [plain], hz)
    via, shown, carrier_tr = "plain", plain, None
    if not res["ok"] and ck.is_short(it["text"]):
        clip = ctx.tmp / "chk.wav"
        make_check_clip(ctx.carrier(it["voice"], speed), mp3, clip)
        carrier_tr = ctx.transcribe(clip)
        res2 = ck.evaluate(it["text"], it.get("pinyin"), ck.carrier_candidates(it["text"], carrier_tr), hz)
        if res2["ok"] or res2["sim"] > res["sim"]:
            res, via = res2, "carrier"
            shown = res2["heard"]
    elif res["ok"]:
        shown = plain
    lo, hi = DURATION_LIMITS[it["kind"]]
    ok, how = res["ok"], res["how"]
    if not lo <= dur <= hi:
        ok, how = False, f"durasi {dur}s"
    cand = {"mp3": mp3, "dur": dur, "transcript": shown, "ok": ok, "check": how, "via": via, "sim": res["sim"]}
    if "tone" in res:
        cand["tone"] = res["tone"]
    if carrier_tr is not None and not ok:
        cand["carrierTranscript"] = carrier_tr
    return cand


def cmd_shard(args):
    import make_samples as ms

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

    old_files = read_manifest().get("files", {})
    ctx = Ctx(work)
    dump_json(out / "meta.json", {"whisperRevision": ctx.whisper_rev})
    t0 = time.time()

    for n, (it, mode) in enumerate(todo, 1):
        if time.time() - t0 > BUDGET_MIN * 60:
            log(f"[shard] batas waktu {BUDGET_MIN:.0f} menit tercapai; sisa {len(todo) - n + 1} item dikerjakan di jalan berikutnya")
            break
        plan = variants(it)
        steps = []  # (nama, teks, speed, berkas yang sudah ada | None)
        if mode == "recheck":
            old = old_files[it["key"]]
            first = old.get("variant", "asli")
            spd = next((s for _, s, nm in plan if nm == first), it["speed"])
            steps.append((first, None, spd, AUDIO_DIR / old["path"]))
            steps += [(nm, t, s, None) for t, s, nm in plan if nm != first]
        else:
            steps = [(nm, t, s, None) for t, s, nm in plan]
        best = None
        attempt = 0
        for name, text, speed, existing in steps[:MAX_ATTEMPTS]:
            attempt += 1
            try:
                if existing is not None:
                    mp3 = existing
                else:
                    raw, mp3 = ctx.tmp / "raw.wav", ctx.tmp / f"a{attempt}.mp3"
                    ctx.synth(it["voice"], text, speed, raw)
                    ms.normalize(raw, mp3, ctx.tmp)
                cand = evaluate(ctx, it, mp3, speed)
            except Exception as e:  # noqa: BLE001
                traceback.print_exc()
                cand = {"mp3": None, "dur": 0, "transcript": f"(gagal: {type(e).__name__}: {e})"[:200], "ok": False,
                        "check": "galat", "via": "plain", "sim": -1}
            cand.update(variant=name, resynth=existing is None)
            rank = (cand["ok"], cand["sim"] if cand["mp3"] else -2)
            if best is None or rank > best[0]:
                if cand["mp3"] is not None and existing is None:
                    keep = ctx.tmp / "best.mp3"
                    shutil.copy(cand["mp3"], keep)
                    cand["mp3"] = keep
                best = (rank, cand)
            if cand["ok"]:
                break
        b = best[1]
        if b["mp3"] is None:
            log(f"[{n}/{len(todo)}] {it['key']} GAGAL SINTESIS")
            continue
        entry = {"path": mp3_rel(it), "kind": it["kind"], "text": it["text"], "voice": it["voice"], "speed": it["speed"],
                 "durationSec": b["dur"], "transcript": b["transcript"], "ok": b["ok"], "check": b["check"], "via": b["via"],
                 "attempts": attempt, "hash": it["hash"], "checkVersion": check.CHECK_VERSION}
        for k in ("tone", "carrierTranscript"):
            if k in b:
                entry[k] = b[k]
        if b["variant"] != "asli":
            entry["variant"] = b["variant"]
        entry["resynth"] = b["resynth"]
        if b["resynth"]:
            dst = out / entry["path"]
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy(b["mp3"], dst)
        entries[it["key"]] = entry
        log(f"[{n}/{len(todo)}] {it['key']} {mode} {entry['durationSec']}s {'OK' if b['ok'] else 'GAGAL'}({b['check']}, {b['via']}, x{attempt}) '{it['text']}' -> '{b['transcript']}' [{int(time.time() - t0)}s]")
        if n % 10 == 0:
            dump_json(out / "entries.json", entries)
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
    whisper_rev = None
    for d in args.inputs:
        d = Path(d)
        ef = next(iter(d.rglob("entries.json")), None)
        if ef is None:
            log(f"[merge] {d}: tidak ada entries.json (dilewati)")
            continue
        mf = ef.parent / "meta.json"
        if mf.exists():
            whisper_rev = whisper_rev or load_json(mf).get("whisperRevision")
        for k, e in load_json(ef).items():
            new[k] = e
            srcs[k] = ef.parent / e["path"]
    log(f"[merge] {len(new)} entri baru dari shard")

    files: dict[str, dict] = {}
    for it in items:
        k = it["key"]
        if k in new and new[k]["hash"] == it["hash"]:
            e = dict(new[k])
            if e.pop("resynth", True):
                dst = AUDIO_DIR / e["path"]
                dst.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(srcs[k], dst)  # hanya file yang disintesis ulang yang berubah
            elif not (AUDIO_DIR / e["path"]).exists():
                log(f"[merge] {k}: cek ulang tanpa file lama, dilewati")
                continue
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
    wp, wt = by_kind["word"]["passed"], by_kind["word"]["total"]  # 300 kata, kecepatan normal
    methods: dict[str, int] = {}
    for e in files.values():
        if e["ok"]:
            m = f"{e['check']}/{e.get('via', 'plain')}"
            methods[m] = methods.get(m, 0) + 1
    manifest = {
        "version": 1,
        "settingsVersion": doc["settingsVersion"],
        "format": {"codec": "mp3", "channels": 1, "bitrate": "64k", "sampleRate": SAMPLE_RATE, "lufs": -16},
        "voices": voices,
        "whisper": {"model": WHISPER_LABEL, "repo": WHISPER_REPO, "revision": whisper_rev or WHISPER_REVISION,
                    "checkVersion": check.CHECK_VERSION, "passed": passed, "total": total,
                    "wordsPassed": wp, "wordsTotal": wt,
                    "byKind": {k: by_kind[k] for k in hsk1_items.KINDS}, "byMethod": dict(sorted(methods.items()))},
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

    issues = []
    for it in items:
        e = files.get(it["key"])
        if e and not e["ok"]:
            issues.append({"key": it["key"], "kind": it["kind"], "text": it["text"], "transcript": e["transcript"],
                           **({"carrierTranscript": e["carrierTranscript"]} if "carrierTranscript" in e else {}),
                           "check": e["check"], **({"tone": e["tone"]} if "tone" in e else {}), "attempts": e["attempts"]})
    dump_json(ISSUES_FILE, {"version": 1, "issues": issues})

    log(f"[merge] Whisper lolos {passed}/{total}; kata (300, normal) {wp}/{wt}; masalah {len(issues)}")
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
