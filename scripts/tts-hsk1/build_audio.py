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

Ronde 3 (CHECK_VERSION 3) -- hanya item yang GAGAL yang diproses ulang; file yang lolos tidak disentuh:
  1. cek ulang file yang ada dengan cara tambahan "x3" (klip diulang 3x, lihat check.evaluate_x3);
  2. suku kata tunggal yang bunyinya lolos tetapi nadanya salah: kontur nada diluruskan (tone.retarget,
     PSOLA) lalu dicek ulang penuh; hanya dipakai bila lolos -> `pitchFixed: true` di manifest;
  3. variasi sintesis baru (R3_VARIANTS): bingkai "X，X。" lalu ujaran pertama dipotong, suku kata
     tengah dari "X，X，X。", seruan; dengan koreksi G2P tertulis (G2P_FIX) bila keluaran misaki
     berbeda dari pinyin data. Hasil terbaik disimpan; tetap gagal -> audio-issues.json.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import re
import shutil
import subprocess
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
R3_EXTRA_ATTEMPTS = 3  # ronde 3: variasi sintesis tambahan untuk item yang tetap gagal
# Koreksi G2P (misaki) bila bacaannya berbeda dari pinyin data (dicek di test_check.py):
#   哪些 misaki "ㄋㄟ3ㄒㄝ1" (něixiē), data nǎxiē; 哪个 misaki "ㄋㄟ3ㄍㄜ4", data nǎge;
#   谁 misaki "ㄕ为2" (shuí), data shéi; 只 misaki "ㄓ十3" (zhǐ), data zhī (kata bantu bilangan).
G2P_FIX = {"哪些": "ㄋㄚ3ㄒㄝ1", "哪个": "ㄋㄚ3ㄍㄜ5", "谁": "ㄕㄟ2", "只": "ㄓ十1"}
# Konsonan awal tak bersuara (frikatif/afrikat) tempat P3 kadang menambah bunyi "i" bersuara di depan.
DEVOICE_INITIALS = {"j", "q", "x", "zh", "ch", "sh", "z", "c", "s", "f", "h"}
KIND_ORDER = {"word": 0, "word-slow": 1, "casual": 2, "casual-slow": 3, "dialog": 4, "sentence": 5}
MAX_SHARDS = 20
ITEMS_PER_SHARD = 4  # item gagal diproses berat (beberapa sintesis + 3 cara cek); bagi rata ke banyak shard
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


def todo_items(items: list[dict], ck: "check.Checker | None" = None) -> list[tuple[dict, str]]:
    """(item, mode): 'build' (belum ada/hash berubah) | 'recheck' (cek ulang file yang ada).
    File yang lolos dengan versi cek yang cocok (check.PASS_COMPATIBLE) dan masih lolos aturan sekarang
    (dari transkrip tersimpan) tidak diproses ulang -> mp3-nya tidak berubah."""
    files = read_manifest().get("files", {})
    force = os.environ.get("RECHECK") == "1"
    retry = os.environ.get("RETRY_FAILED") == "1"
    ck = ck or check.Checker()
    out = []
    for it in items:
        e = files.get(it["key"])
        if not e or e["hash"] != it["hash"] or not (AUDIO_DIR / e["path"]).exists():
            out.append((it, "build"))
        elif force or (retry and not e["ok"]):
            out.append((it, "recheck"))
        elif ck.norm(it["text"]) in G2P_FIX and not e.get("g2pFix") and not e.get("g2pTried"):
            out.append((it, "recheck"))  # dibuat dengan G2P yang bacaannya beda dari data -> coba koreksi
        elif e["ok"] and not ck.still_passes(it["text"], it.get("pinyin"), e):
            out.append((it, "recheck"))  # lolos dengan aturan lama yang kini diperketat
        elif e.get("checkVersion") == check.CHECK_VERSION:
            continue
        elif e["ok"] and e.get("checkVersion") in check.PASS_COMPATIBLE:
            continue
        elif not e["ok"] and e.get("checkVersion") == 3 and len(ck.norm(it["text"])) != 1:
            continue  # versi 4 hanya menambah perbaikan suku kata tunggal
        else:
            out.append((it, "recheck"))
    out.sort(key=lambda x: KIND_ORDER.get(x[0]["kind"], 9))  # kata dulu (stabil: urutan asli per jenis)
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


def initial_of(pinyin: str | None) -> str:
    """Konsonan awal suku kata pertama ('' bila tanpa konsonan awal / tanpa pinyin)."""
    if not pinyin:
        return ""
    base, _ = check.parse_pinyin(pinyin.split()[0])
    m = re.match(r"(zh|ch|sh|[bpmfdtnlgkhjqxrzcsyw])", base)
    return m.group(1) if m else ""


def r3_variants(it: dict) -> list[str]:
    """Nama variasi sintesis ronde 3 (lihat synth_variant)."""
    n = len(re.sub(r"[。！？!?…，,、\s]", "", it["text"]))
    if n == 1:
        return ["bingkai-awal", "bingkai-tengah", "bingkai-awal-pelan"]
    if n <= check.CARRIER_MAX_LETTERS:
        return ["bingkai-awal", "seru", "bingkai-awal-pelan"]
    return ["kecepatan-0.95", "kecepatan-1.05"]


def voiced_segments(wav: Path) -> list[tuple[float, float]]:
    """Bagian bersuara (detik) menurut silencedetect (disalin dari gagasan scripts/tts-basics, task 0)."""
    import make_samples as ms

    p = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(wav), "-af", "silencedetect=noise=-38dB:d=0.07",
                        "-f", "null", "-"], capture_output=True, text=True, check=True)
    total = ms.duration(wav)
    starts = [float(x) for x in re.findall(r"silence_start: (-?[\d.]+)", p.stderr)]
    ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", p.stderr)]
    silences = list(zip(starts, ends + [total] * (len(starts) - len(ends))))
    segs, cur = [], 0.0
    for a, b in silences:
        if a - cur > 0.05:
            segs.append((cur, a))
        cur = b
    if total - cur > 0.05:
        segs.append((cur, total))
    return segs


def _rms(x, hop):
    import numpy as np

    return np.array([np.sqrt(np.mean(x[i:i + hop] ** 2) + 1e-12) for i in range(0, len(x) - hop, hop)])


def _fade_write(y, sr, dst: Path):
    import numpy as np
    import soundfile as sf

    n_in, n_out = int(0.01 * sr), int(0.03 * sr)
    if len(y) < sr * 0.12:
        raise RuntimeError("potongan terlalu pendek")
    y = y.copy()
    y[:n_in] *= np.linspace(0, 1, n_in)
    y[-n_out:] *= np.linspace(1, 0, n_out)
    sf.write(str(dst), y, sr)


def first_segment(src: Path, dst: Path):
    """Ujaran pertama dari bingkai "X，X。": bagian bersuara pertama (jeda koma); tanpa jeda -> potong di
    energi terendah antara 30-70 % bagian bersuara. Fade 10/30 ms."""
    import numpy as np
    import soundfile as sf

    segs = voiced_segments(src)
    x, sr = sf.read(str(src), dtype="float32")
    if x.ndim > 1:
        x = x.mean(axis=1)
    if len(segs) >= 2:
        a, b = max(0.0, segs[0][0] - 0.03), min(segs[0][1] + 0.05, (segs[0][1] + segs[1][0]) / 2)
        y = x[int(a * sr):int(b * sr)]
    else:
        hop = sr // 100
        rms = _rms(x, hop)
        voiced = np.where(rms > rms.max() * 0.05)[0]
        if len(voiced) < 20:
            raise RuntimeError("bingkai terlalu pendek")
        lo, hi = voiced[0], voiced[-1]
        a = lo + int((hi - lo) * 0.3)
        v = a + int(np.argmin(rms[a:lo + int((hi - lo) * 0.7)]))
        y = x[:v * hop]
    _fade_write(y, sr, dst)


def middle_by_valleys(src: Path, dst: Path):
    """Suku kata tengah dari "X，X，X。": dua titik energi terendah sekitar 1/3 dan 2/3 bagian bersuara."""
    import numpy as np
    import soundfile as sf

    x, sr = sf.read(str(src), dtype="float32")
    if x.ndim > 1:
        x = x.mean(axis=1)
    hop = sr // 100
    rms = _rms(x, hop)
    voiced = np.where(rms > rms.max() * 0.05)[0]
    if len(voiced) < 30:
        raise RuntimeError("bingkai terlalu pendek")
    a, b = voiced[0], voiced[-1]
    span = b - a

    def valley(lo, hi):
        lo, hi = a + int(span * lo), a + int(span * hi)
        return lo + int(np.argmin(rms[lo:hi]))

    v1, v2 = valley(0.2, 0.47), valley(0.53, 0.8)
    if v2 - v1 < 15:
        raise RuntimeError("bingkai: suku kata tengah terlalu pendek")
    _fade_write(x[v1 * hop:v2 * hop], sr, dst)


def synth_variant(ctx: "Ctx", it: dict, name: str, raw: Path) -> float:
    """Buat wav mentah variasi ronde 3; kembalikan kecepatan yang dipakai."""
    t, s, v = it["text"], it["speed"], it["voice"]
    base = re.sub(r"[。！？!?…，,]+$", "", t)
    frame = raw.with_suffix(".frame.wav")
    if name == "bingkai-awal":
        ctx.synth(v, f"{base}，{base}。", s, frame, it)
        first_segment(frame, raw)
        return s
    if name == "bingkai-tengah":
        ctx.synth(v, f"{base}，{base}，{base}。", s, frame, it)
        middle_by_valleys(frame, raw)
        return s
    if name == "bingkai-awal-pelan":
        sp = round(s * 0.9, 3)
        ctx.synth(v, f"{base}，{base}，{base}。", sp, frame, it)
        first_segment(frame, raw)
        return sp
    if name == "seru":
        sp = round(s * 0.9, 3)
        ctx.synth(v, base + ("？" if base.endswith("吗") else "！"), sp, raw, it)
        return sp
    if name.startswith("kecepatan-"):
        sp = round(s * float(name.split("-")[1]), 3)
        ctx.synth(v, t, sp, raw, it)
        return sp
    raise ValueError(name)


def fix_phonemes(g2p, text: str, word: str, fixed: str) -> str:
    """Fonem misaki untuk `text` dengan bacaan `word` diganti `fixed` (koreksi G2P_FIX)."""
    ps = g2p(text)[0]
    wrong = g2p(word)[0]
    if wrong not in ps:
        raise RuntimeError(f"G2P: '{wrong}' tidak ada di '{ps}'")
    return ps.replace(wrong, fixed)


def make_x3_clip(mp3: Path, dst: Path):
    """Klip yang sama diulang 3x (jeda +-0,4 dtk; klip sudah berjeda 0,15 dtk di tiap ujung) + sunyi depan-belakang."""
    import make_samples as ms

    ms.run(["ffmpeg", "-y", "-v", "error", "-i", str(mp3), "-filter_complex",
            f"[0:a]aresample={SAMPLE_RATE},apad=pad_dur=0.1,asplit=3[a][b][c];[a][b][c]concat=n=3:v=0:a=1,"
            "adelay=300:all=1,apad=pad_dur=0.3", "-ac", "1", str(dst)])


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
        self._ref = None

    def kokoro(self):
        if self._kokoro is None:
            self._kokoro = load_kokoro(["L3", "P3"])
        return self._kokoro

    def synth(self, voice, text, speed, dst: Path, it: dict | None = None):
        pipe, packs = self.kokoro()
        word = self.checker.norm(it["text"]) if it else None
        if word in G2P_FIX:
            orig = pipe.g2p
            pipe.g2p = lambda chunk: (fix_phonemes(orig, chunk, word, G2P_FIX[word]), None)
            try:
                synth(pipe, packs[voice], text, speed, dst)
            finally:
                pipe.g2p = orig
            log(f"[g2p] {word}: '{G2P_FIX[word]}'")
        else:
            synth(pipe, packs[voice], text, speed, dst)

    def speaker_ref(self) -> tuple[float, float]:
        """Rentang F0 P3 dari file kata 1 huruf (kecepatan normal) yang lolos (untuk tone.retarget)."""
        if self._ref is None:
            files = read_manifest().get("files", {})
            cs = []
            for e in files.values():
                if e["ok"] and e["kind"] == "word" and e["voice"] == "P3" and len(self.checker.norm(e["text"])) == 1 \
                        and e.get("checkVersion") in check.PASS_COMPATIBLE and not e.get("pitchFixed"):
                    try:
                        cs.append(tone.f0_contour(AUDIO_DIR / e["path"], self.tmp / "ref.wav"))
                    except Exception as ex:  # noqa: BLE001
                        log(f"[ref] {e['path']}: {ex}")
            self._ref = tone.speaker_ref(cs)
            log(f"[ref] rentang F0 P3 dari {len(cs)} file: {self._ref[0]:.0f}-{self._ref[1]:.0f} Hz")
        return self._ref

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
    via, shown, carrier_tr, x3_tr = "plain", plain, None, None
    sound = bool(res.get("sound"))
    if not res["ok"] and ck.is_short(it["text"]):
        clip = ctx.tmp / "chk.wav"
        make_check_clip(ctx.carrier(it["voice"], speed), mp3, clip)
        carrier_tr = ctx.transcribe(clip)
        res2 = ck.evaluate(it["text"], it.get("pinyin"), ck.carrier_candidates(it["text"], carrier_tr), hz)
        sound = sound or bool(res2.get("sound"))
        if res2["ok"] or res2["sim"] > res["sim"]:
            res, via = res2, "carrier"
            shown = res2["heard"]
    if not res["ok"] and ck.is_short(it["text"]):
        clip = ctx.tmp / "x3.wav"
        make_x3_clip(mp3, clip)
        x3_tr = ctx.transcribe(clip)
        res3 = ck.evaluate_x3(it["text"], it.get("pinyin"), x3_tr, hz)
        sound = sound or bool(res3.get("sound"))
        if res3["ok"] or (res3.get("sound") and not res.get("sound")):
            res, via = res3, "x3"
            shown = x3_tr
    lo, hi = DURATION_LIMITS[it["kind"]]
    ok, how = res["ok"], res["how"]
    if not lo <= dur <= hi:
        ok, how = False, f"durasi {dur}s"
    cand = {"mp3": mp3, "dur": dur, "transcript": shown, "ok": ok, "check": how, "via": via, "sim": res["sim"]}
    if "tone" in res:
        cand["tone"] = res["tone"]
    if carrier_tr is not None and not ok:
        cand["carrierTranscript"] = carrier_tr
    if x3_tr is not None and not ok:
        cand["x3Transcript"] = x3_tr
    cand["soundOnly"] = (not ok) and sound and lo <= dur <= hi  # bunyi lolos, nada salah
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
    ck = ctx.checker
    dump_json(out / "meta.json", {"whisperRevision": ctx.whisper_rev})
    t0 = time.time()

    for n, (it, mode) in enumerate(todo, 1):
        if time.time() - t0 > BUDGET_MIN * 60:
            log(f"[shard] batas waktu {BUDGET_MIN:.0f} menit tercapai; sisa {len(todo) - n + 1} item dikerjakan di jalan berikutnya")
            break
        old = old_files.get(it["key"]) if mode == "recheck" else None
        want = ck.expected_tone(it.get("pinyin")) if len(ck.norm(it["text"])) == 1 else None
        # langkah: (nama, berkas yang sudah ada | None)
        g2p_redo = old is not None and ck.norm(it["text"]) in G2P_FIX and not old.get("g2pFix") and not old.get("g2pTried")
        if g2p_redo:
            # bacaan baru (G2P_FIX): sintesis ulang dulu; file lama hanya cadangan terakhir
            steps = [(nm, None) for _, _, nm in variants(it)][:2] + [(r3_variants(it)[0], None)]
            steps.append((old.get("variant", "asli"), AUDIO_DIR / old["path"]))
            attempt = 0
        elif old is not None:
            steps = [(old.get("variant", "asli"), AUDIO_DIR / old["path"])]
            steps += [(nm, None) for nm in r3_variants(it)[:R3_EXTRA_ATTEMPTS]]
            attempt = old.get("attempts", 1)
        else:
            steps = [(nm, None) for _, _, nm in variants(it)][:MAX_ATTEMPTS]
            steps += [(nm, None) for nm in r3_variants(it)[:R3_EXTRA_ATTEMPTS]]
            attempt = 0
        best = None
        fix_tried = False

        def consider(cand):
            nonlocal best
            rank = (cand["ok"], cand["sim"] if cand["mp3"] else -2)
            if best is None or rank > best[0]:
                if cand["mp3"] is not None and cand["resynth"]:
                    keep = ctx.tmp / "best.mp3"
                    shutil.copy(cand["mp3"], keep)
                    cand["mp3"] = keep
                best = (rank, cand)

        for name, existing in steps:
            attempt += 1 if existing is None else 0  # cek ulang file lama bukan percobaan baru
            try:
                if existing is not None:
                    mp3, speed = existing, next((sp for _, sp, nm in variants(it) if nm == name), it["speed"])
                else:
                    raw, mp3 = ctx.tmp / "raw.wav", ctx.tmp / f"a{attempt}.mp3"
                    if name in {nm for _, _, nm in variants(it)}:
                        text, speed = next((t, sp) for t, sp, nm in variants(it) if nm == name)
                        ctx.synth(it["voice"], text, speed, raw, it)
                    else:
                        speed = synth_variant(ctx, it, name, raw)
                    ms.normalize(raw, mp3, ctx.tmp)
                cand = evaluate(ctx, it, mp3, speed)
            except Exception as e:  # noqa: BLE001
                traceback.print_exc()
                cand = {"mp3": None, "dur": 0, "transcript": f"(gagal: {type(e).__name__}: {e})"[:200], "ok": False,
                        "check": "galat", "via": "plain", "sim": -1}
            cand.update(variant=name, resynth=existing is None)
            consider(cand)
            log(f"    {name}: {'OK' if cand['ok'] else 'GAGAL'}({cand['check']}, {cand['via']}) '{cand['transcript']}'"
                f"{' | ' + cand['carrierTranscript'] if cand.get('carrierTranscript') else ''}"
                f"{' | x3 ' + cand['x3Transcript'] if cand.get('x3Transcript') else ''}")
            if cand["ok"]:
                break
            if cand["mp3"] is None or want is None:
                continue
            # Perbaikan turunan untuk suku kata tunggal (file baru hanya dipakai bila LOLOS cek penuh):
            #   desah: bunyi "i" bersuara sebelum konsonan tak bersuara dibuang (tone.devoice_onset)
            #   nada : bunyi lolos tetapi nada salah -> kontur nada diluruskan (tone.retarget)
            done = False
            chain = [(cand, name)]
            if initial_of(it.get("pinyin")) in DEVOICE_INITIALS:
                try:
                    dv_wav, dv = ctx.tmp / "dv.wav", ctx.tmp / f"dv{attempt}.mp3"
                    if tone.devoice_onset(cand["mp3"], dv_wav, ctx.tmp / "dvt.wav"):
                        ms.normalize(dv_wav, dv, ctx.tmp)
                        c2 = evaluate(ctx, it, dv, speed)
                        c2.update(variant=f"{name}+desah", resynth=True, devoiced=True)
                        log(f"    {name}+desah: {'OK' if c2['ok'] else 'GAGAL'}({c2['check']}, {c2['via']}) '{c2['transcript']}'")
                        if c2["ok"]:
                            consider(c2)
                            done = True
                        else:
                            chain.append((c2, f"{name}+desah"))
                except Exception:  # noqa: BLE001
                    traceback.print_exc()
            if done:
                break
            for base, bname in chain:
                if not (want and base.get("soundOnly")):
                    continue
                fix_tried = True
                try:
                    pf_wav, pf = ctx.tmp / "pf.wav", ctx.tmp / f"pf{attempt}.mp3"
                    tone.retarget(base["mp3"], pf_wav, want, ctx.speaker_ref(), ctx.tmp / "pft.wav")
                    ms.normalize(pf_wav, pf, ctx.tmp)
                    c2 = evaluate(ctx, it, pf, speed)
                    c2.update(variant=f"{bname}+nada", resynth=True, pitchFixed=True, toneBefore=base.get("tone"),
                              devoiced=base.get("devoiced"))
                    log(f"    {bname}+nada: {'OK' if c2['ok'] else 'GAGAL'}({c2['check']}, {c2['via']}) '{c2['transcript']}'")
                    if c2["ok"]:
                        consider(c2)
                        done = True
                        break
                except Exception:  # noqa: BLE001
                    traceback.print_exc()
            if done:
                break
        b = best[1]
        if b["mp3"] is None:
            log(f"[{n}/{len(todo)}] {it['key']} GAGAL SINTESIS")
            continue
        entry = {"path": mp3_rel(it), "kind": it["kind"], "text": it["text"], "voice": it["voice"], "speed": it["speed"],
                 "durationSec": b["dur"], "transcript": b["transcript"], "ok": b["ok"], "check": b["check"], "via": b["via"],
                 "attempts": max(attempt, 1), "hash": it["hash"], "checkVersion": check.CHECK_VERSION}
        for k in ("tone", "carrierTranscript", "x3Transcript", "pitchFixed", "toneBefore", "devoiced"):
            if b.get(k) is not None:
                entry[k] = b[k]
        if fix_tried and not b.get("pitchFixed"):
            entry["pitchFixTried"] = True
        if ck.norm(it["text"]) in G2P_FIX and b["resynth"]:
            entry["g2pFix"] = G2P_FIX[ck.norm(it["text"])]
        elif g2p_redo or (old or {}).get("g2pTried"):
            entry["g2pTried"] = True  # bacaan terkoreksi dicoba tetapi tidak lolos; file lama dipertahankan
        if b["variant"] != "asli":
            entry["variant"] = b["variant"]
        entry["resynth"] = b["resynth"]
        if b["resynth"]:
            dst = out / entry["path"]
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy(b["mp3"], dst)
        entries[it["key"]] = entry
        log(f"[{n}/{len(todo)}] {it['key']} {mode} {entry['durationSec']}s {'OK' if b['ok'] else 'GAGAL'}({b['check']}, {b['via']}, {b['variant']}, x{entry['attempts']}) '{it['text']}' -> '{b['transcript']}' [{int(time.time() - t0)}s]")
        if n % 5 == 0:
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
            m = f"{e['check']}/{e.get('via', 'plain')}" + ("/pitchFixed" if e.get("pitchFixed") else "")
            methods[m] = methods.get(m, 0) + 1
    pitch_fixed = sum(1 for e in files.values() if e.get("pitchFixed"))
    manifest = {
        "version": 1,
        "settingsVersion": doc["settingsVersion"],
        "format": {"codec": "mp3", "channels": 1, "bitrate": "64k", "sampleRate": SAMPLE_RATE, "lufs": -16},
        "voices": voices,
        "whisper": {"model": WHISPER_LABEL, "repo": WHISPER_REPO, "revision": whisper_rev or WHISPER_REVISION,
                    "checkVersion": check.CHECK_VERSION, "passed": passed, "total": total,
                    "wordsPassed": wp, "wordsTotal": wt, "pitchFixed": pitch_fixed,
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
                           **{k: e[k] for k in ("carrierTranscript", "x3Transcript") if k in e},
                           "check": e["check"], **({"tone": e["tone"]} if "tone" in e else {}),
                           **({"pitchFixTried": True} if e.get("pitchFixTried") else {}), "attempts": e["attempts"]})
    dump_json(ISSUES_FILE, {"version": 1, "issues": issues})

    log(f"[merge] Whisper lolos {passed}/{total}; kata (300, normal) {wp}/{wt}; nada diluruskan {pitch_fixed}; masalah {len(issues)}")
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
