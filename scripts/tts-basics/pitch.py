"""Metode A (task 0 ronde 3): meluruskan nada suku kata tunggal P3 dengan kontur rekaman asli.

Suara tetap P3 (bunyi, warna suara, durasi tidak berubah). Yang diganti hanya kontur nada (F0):
  1. Kontur F0 rekaman asli suku kata bernada yang sama diambil dari `hugolpz/audio-cmn`
     (penutur Chen Wang, CC BY-SA). Rekaman itu HANYA contoh nada: diunduh di GitHub Actions
     (cache), tidak diputar di website dan tidak di-commit sebagai audio situs.
  2. Bentuk kontur dipetakan ke rentang suara P3 sendiri: tinggi rekaman asli diubah ke skala
     Chao 1-5 terhadap rentang penutur asli (persentil 5-95 semua suku kata contoh yang dimuat),
     lalu dikembalikan ke semiton di rentang P3 (persentil 5-95 suku kata tunggal P3, rentang yang
     sama dengan yang dipakai cek nada).
  3. Waktunya direntangkan ke bagian bersuara P3 (awal-akhir F0 P3), jadi durasi P3 tetap.
  4. PSOLA (praat-parselmouth "To Manipulation" -> "Replace pitch tier" -> overlap-add); titik
     kontur dihaluskan (median 5 bingkai + rata-rata 3) dan diinterpolasi linear oleh Praat.
Suku kata yang tidak ada di audio-cmn memakai kontur baku nada target (cara task 4b,
scripts/tts-hsk1/tone.py, disalin di sini: TONE_SHAPES / target_contour) di rentang P3 yang sama.

Fungsi kontur murni (numpy) supaya bisa dites tanpa model (test_pitch.py).
"""
from __future__ import annotations

import os
import re
import subprocess
import unicodedata
from pathlib import Path

import numpy as np

AUDIO_CMN_REPO = "https://github.com/hugolpz/audio-cmn.git"
AUDIO_CMN = {"repo": "hugolpz/audio-cmn", "speaker": "Chen Wang", "license": "CC BY-SA",
             "use": "contoh kontur nada saja (tidak diputar, tidak di-commit)"}
PITCH_FLOOR = 60.0
PITCH_CEIL = 600.0
STEP = 0.01
MIN_VOICED = 8
N_POINTS = 24
# Suku kata contoh tambahan (semua nada) supaya rentang penutur asli tidak hanya dari suku kata target.
RANGE_SYLLABLES = ["ma", "ba", "da", "yi", "shi", "wu", "fa", "li", "ge", "tang"]

TONE_MARKS = {"\u0304": 1, "\u0301": 2, "\u030c": 3, "\u0300": 4}


# --------------------------------------------------------------------------
# Nama file audio-cmn
# --------------------------------------------------------------------------

def syllable_key(pinyin: str) -> str | None:
    """'nǚ' -> 'nv3', 'jī' -> 'ji1' (huruf kecil, ü = v); None bila tanpa nada 1-4."""
    tone = 0
    base = []
    for c in unicodedata.normalize("NFD", pinyin.strip().lower()):
        if c in TONE_MARKS:
            tone = TONE_MARKS[c]
        elif c == "\u0308":  # titik dua ü
            if base and base[-1] == "u":
                base[-1] = "v"
        elif c.isalpha():
            base.append(c)
    if not tone or not base:
        return None
    return "".join(base) + str(tone)


_NAME = re.compile(r"^(?:cmn-)?([a-z:\u00fc]+?)([1-5])\.(mp3|wav|ogg|flac)$", re.I)
_EXT_RANK = {"wav": 0, "flac": 1, "ogg": 2, "mp3": 3}


def key_from_name(name: str) -> str | None:
    """Nama file (tanpa folder) -> kunci 'nv3'; None bila bukan rekaman suku kata bernada."""
    m = _NAME.match(name)
    if not m:
        return None
    base = m.group(1).lower().replace("\u00fc", "v").replace("u:", "v")
    if ":" in base:
        return None
    return base + m.group(2)


def index_paths(paths: list[str]) -> dict[str, str]:
    """Kunci -> path terbaik. Pilih folder bernama 'syllab*' bila ada, lalu format tak-lossy /
    bitrate tertinggi (angka terbesar di path), lalu path terpendek."""
    best: dict[str, tuple] = {}
    for p in paths:
        name = p.rsplit("/", 1)[-1]
        k = key_from_name(name)
        if not k:
            continue
        ext = name.rsplit(".", 1)[-1].lower()
        nums = [int(x) for x in re.findall(r"(\d+)k", p)]
        rank = (0 if "syllab" in p.lower() else 1, _EXT_RANK.get(ext, 9), -(max(nums) if nums else 0), len(p), p)
        if k not in best or rank < best[k]:
            best[k] = rank
    return {k: r[-1] for k, r in best.items()}


class AudioCmn:
    """Klon dangkal audio-cmn tanpa isi file (blob:none), lalu ambil hanya file yang dibutuhkan."""

    def __init__(self, cache_dir: Path, log=print):
        self.dir = Path(cache_dir)
        self.log = log
        if not (self.dir / ".git").exists():
            self.dir.parent.mkdir(parents=True, exist_ok=True)
            subprocess.run(["git", "clone", "--quiet", "--depth", "1", "--filter=blob:none", "--no-checkout",
                            AUDIO_CMN_REPO, str(self.dir)], check=True)
        self.commit = subprocess.run(["git", "-C", str(self.dir), "rev-parse", "HEAD"], check=True,
                                     capture_output=True, text=True).stdout.strip()
        names = subprocess.run(["git", "-C", str(self.dir), "ls-tree", "-r", "--name-only", "HEAD"], check=True,
                               capture_output=True, text=True).stdout.splitlines()
        self.index = index_paths(names)
        sample = sorted(self.index.items())[:5]
        self.log(f"[audio-cmn] commit {self.commit[:12]}: {len(names)} file, {len(self.index)} suku kata bernada; "
                 f"contoh {sample}")

    def fetch(self, keys: list[str]) -> dict[str, Path]:
        want = sorted({self.index[k] for k in keys if k in self.index})
        missing = [p for p in want if not (self.dir / p).exists()]
        for i in range(0, len(missing), 100):
            subprocess.run(["git", "-C", str(self.dir), "checkout", "HEAD", "--", *missing[i:i + 100]], check=True,
                           capture_output=True)
        for p in want:  # berkas Git LFS: isi asli diunduh dari media.githubusercontent.com
            f = self.dir / p
            if f.exists() and f.stat().st_size < 400 and f.read_bytes().startswith(b"version https://git-lfs"):
                import urllib.parse
                import urllib.request

                url = (f"https://media.githubusercontent.com/media/hugolpz/audio-cmn/{self.commit}/"
                       + urllib.parse.quote(p))
                req = urllib.request.Request(url, headers={"User-Agent": "chineseforeveryone-basics-audio"})
                with urllib.request.urlopen(req, timeout=60) as r:
                    f.write_bytes(r.read())
        return {k: self.dir / self.index[k] for k in keys if k in self.index and (self.dir / self.index[k]).exists()}


# --------------------------------------------------------------------------
# Kontur
# --------------------------------------------------------------------------

def f0_track(path: Path, tmp_wav: Path, sr: int = 24000):
    """(waktu, F0 Hz) per 10 ms dari berkas audio apa pun (lewat ffmpeg -> wav mono)."""
    import parselmouth

    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(path), "-ac", "1", "-ar", str(sr), str(tmp_wav)],
                   check=True)
    snd = parselmouth.Sound(str(tmp_wav))
    pitch = snd.to_pitch_ac(time_step=STEP, pitch_floor=PITCH_FLOOR, pitch_ceiling=PITCH_CEIL)
    return np.asarray(pitch.xs(), dtype=float), np.asarray(pitch.selected_array["frequency"], dtype=float)


def main_run(f0) -> tuple[int, int] | None:
    """Indeks [a, b) potongan bersuara terpanjang (celah <= 3 bingkai disambung)."""
    f0 = np.asarray(f0, dtype=float)
    runs, i, n = [], 0, len(f0)
    while i < n:
        if f0[i] <= 0:
            i += 1
            continue
        j, gap, last = i, 0, i
        while j < n and gap <= 3:
            if f0[j] > 0:
                last, gap = j, 0
            else:
                gap += 1
            j += 1
        runs.append((i, last + 1))
        i = last + 1
    if not runs:
        return None
    return max(runs, key=lambda r: r[1] - r[0])


def contour_shape(f0, n_points: int = N_POINTS) -> np.ndarray | None:
    """Kontur bagian bersuara utama dalam semiton (absolut, 12*log2 Hz), dibersihkan dan
    dihaluskan, disampel ulang ke n_points titik berjarak sama (posisi 0..1)."""
    r = main_run(f0)
    if r is None:
        return None
    seg = np.asarray(f0[r[0]:r[1]], dtype=float)
    idx = np.where(seg > 0)[0]
    if len(idx) < MIN_VOICED:
        return None
    st = 12 * np.log2(seg[idx])
    # loncatan oktaf: lipat ke dekat median
    med = np.median(st)
    st = np.where(st - med > 7, st - 12, st)
    st = np.where(med - st > 7, st + 12, st)
    keep = np.abs(st - np.median(st)) < 6
    idx, st = idx[keep], st[keep]
    if len(st) < MIN_VOICED:
        return None
    st = np.array([np.median(st[max(0, k - 2):k + 3]) for k in range(len(st))])
    st = np.convolve(np.pad(st, 1, mode="edge"), np.ones(3) / 3, mode="valid")
    pos = (idx - idx[0]) / max(1, idx[-1] - idx[0])
    xs = np.linspace(0, 1, n_points)
    return np.interp(xs, pos, st)


def speaker_range(shapes: list[np.ndarray], min_span: float = 3.0) -> tuple[float, float]:
    """(persentil 5, persentil 95) semiton semua kontur; minimal min_span semiton."""
    allst = np.concatenate([s for s in shapes if s is not None and len(s)])
    lo, hi = float(np.percentile(allst, 5)), float(np.percentile(allst, 95))
    if hi - lo < min_span:
        mid = (hi + lo) / 2
        lo, hi = mid - min_span / 2, mid + min_span / 2
    return lo, hi


def map_shape(shape: np.ndarray, src_ref: tuple[float, float], dst_ref: tuple[float, float]) -> np.ndarray:
    """Semiton penutur asli -> skala Chao (rentang penutur asli) -> semiton di rentang P3."""
    lvl = (np.asarray(shape) - src_ref[0]) / (src_ref[1] - src_ref[0])
    return dst_ref[0] + lvl * (dst_ref[1] - dst_ref[0])


# Kontur baku (task 4b, scripts/tts-hsk1/tone.py; disalin, tidak diubah): huruf nada Chao, 1 = terendah.
TONE_SHAPES = {
    1: [(0.0, 4.6), (1.0, 4.5)],                 # 55
    2: [(0.0, 3.0), (0.3, 2.8), (1.0, 4.8)],     # 35
    3: [(0.0, 2.3), (0.6, 0.8), (1.0, 3.0)],     # 21(4)
    4: [(0.0, 5.0), (0.2, 4.9), (1.0, 1.4)],     # 51
}


STANDARD_MIN_SPAN_ST = 8.0  # sama dengan tone.MIN_SPAN_ST (4b): rentang tingkat 1-5 minimal 8 semiton


def standard_shape(tone: int, dst_ref: tuple[float, float], n_points: int = N_POINTS) -> np.ndarray:
    """Kontur baku nada `tone` (semiton) di rentang dst_ref, diperlebar ke minimal 8 semiton di sekitar
    tengahnya seperti tone.speaker_ref (4b)."""
    lo, hi = dst_ref
    if hi - lo < STANDARD_MIN_SPAN_ST:
        mid = (hi + lo) / 2
        lo, hi = mid - STANDARD_MIN_SPAN_ST / 2, mid + STANDARD_MIN_SPAN_ST / 2
    dst_ref = (lo, hi)
    xs = np.linspace(0, 1, n_points)
    px, pl = zip(*TONE_SHAPES[tone])
    lvl = np.interp(xs, px, pl)
    return dst_ref[0] + (lvl - 1) / 4 * (dst_ref[1] - dst_ref[0])


def apply_contour(src: Path, dst_wav: Path, contour_st: np.ndarray, tmp_wav: Path) -> dict:
    """Ganti kontur F0 bagian bersuara utama klip P3 dengan contour_st (semiton, posisi 0..1 berjarak
    sama), direntangkan ke awal-akhir bagian bersuara P3. PSOLA overlap-add; durasi tetap."""
    import parselmouth
    from parselmouth.praat import call

    xs, f0 = f0_track(src, tmp_wav)
    r = main_run(f0)
    if r is None or r[1] - r[0] < MIN_VOICED:
        raise RuntimeError("bagian bersuara P3 terlalu pendek untuk diluruskan")
    t0, t1 = float(xs[r[0]]), float(xs[r[1] - 1])
    snd = parselmouth.Sound(str(tmp_wav))
    manip = call(snd, "To Manipulation", STEP, PITCH_FLOOR, PITCH_CEIL)
    tier = call(manip, "Extract pitch tier")
    call(tier, "Remove points between", snd.xmin, snd.xmax)
    pos = np.linspace(0, 1, len(contour_st))
    for x, st in zip(pos, contour_st):
        call(tier, "Add point", t0 + float(x) * (t1 - t0), float(2 ** (st / 12)))
    call([tier, manip], "Replace pitch tier")
    out = call(manip, "Get resynthesis (overlap-add)")
    out.save(str(dst_wav), "WAV")
    return {"voicedStart": round(t0, 3), "voicedEnd": round(t1, 3), "duration": round(snd.duration, 3)}


def native_contours(cmn: AudioCmn, keys: list[str], work: Path, log=print):
    """Kontur (semiton absolut) rekaman asli untuk keys + rentang penutur asli.
    Hasil: ({key: shape}, (lo, hi)); key yang tidak ada / gagal diekstrak tidak ada di dict."""
    extra = [f"{s}{t}" for s in RANGE_SYLLABLES for t in range(1, 5)]
    paths = cmn.fetch(sorted(set(keys) | set(extra)))
    work.mkdir(parents=True, exist_ok=True)
    shapes = {}
    for k, p in paths.items():
        try:
            _, f0 = f0_track(p, work / "cmn.wav", sr=16000)
            s = contour_shape(f0)
        except Exception as e:  # noqa: BLE001
            log(f"[audio-cmn] {k}: {e}")
            s = None
        if s is not None:
            shapes[k] = s
    if not shapes:
        raise RuntimeError("tidak ada kontur audio-cmn yang bisa dipakai")
    ref = speaker_range(list(shapes.values()))
    log(f"[audio-cmn] {len(shapes)} kontur; rentang penutur asli {2 ** (ref[0] / 12):.0f}-{2 ** (ref[1] / 12):.0f} Hz")
    return {k: v for k, v in shapes.items() if k in set(keys)}, ref


def cache_dir() -> Path:
    return Path(os.environ.get("AUDIO_CMN_DIR", str(Path.home() / ".cache" / "audio-cmn")))
