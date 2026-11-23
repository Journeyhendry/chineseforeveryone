"""Klasifikasi nada 1-4 dari kontur F0 suku kata tunggal (task 4b ronde 2).

Aturan sederhana, tertulis di sini dan diuji di test_check.py:
  - kontur = F0 (Hz) bagian bersuara klip, dihaluskan, dalam semitone relatif median
  - T1 datar tinggi : rentang kecil, tanpa kemiringan berarti
  - T2 naik         : akhir jauh lebih tinggi dari awal, titik terendah di paruh awal
  - T3 turun-naik   : titik terendah di tengah dan kedua ujung lebih tinggi (atau sangat rendah/terputus)
  - T4 turun        : awal jauh lebih tinggi dari akhir, titik tertinggi di paruh awal
Mengembalikan None bila kontur tak cukup untuk diputuskan (dianggap tidak lolos cek nada).
"""
from __future__ import annotations

import math
import subprocess
from pathlib import Path

PARSELMOUTH_FLOOR = 60.0
PARSELMOUTH_CEIL = 400.0
MIN_VOICED_FRAMES = 6


def f0_contour(audio: Path, tmp_wav: Path, floor=PARSELMOUTH_FLOOR, ceil=PARSELMOUTH_CEIL) -> list[float]:
    """F0 (Hz) bagian bersuara yang berurutan, dari berkas audio apa pun (lewat ffmpeg)."""
    import parselmouth

    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(audio), "-ac", "1", "-ar", "16000", str(tmp_wav)], check=True)
    snd = parselmouth.Sound(str(tmp_wav))
    pitch = snd.to_pitch_ac(time_step=0.01, pitch_floor=floor, pitch_ceiling=ceil, very_accurate=False)
    vals = pitch.selected_array["frequency"]
    voiced = [float(v) for v in vals if v > 0]
    return voiced


def to_semitones(hz: list[float]) -> list[float]:
    if not hz:
        return []
    ref = sorted(hz)[len(hz) // 2]
    return [12 * math.log2(h / ref) for h in hz]


def smooth(xs: list[float], k: int = 2) -> list[float]:
    out = []
    for i in range(len(xs)):
        seg = xs[max(0, i - k): i + k + 1]
        out.append(sorted(seg)[len(seg) // 2])
    return out


def drop_octave_jumps(st: list[float]) -> list[float]:
    """Lipat loncatan antar-bingkai > 9 semitone (galat deteksi oktaf); penurunan bertahap tidak disentuh."""
    out: list[float] = []
    for v in st:
        if out:
            while v - out[-1] > 9:
                v -= 12
            while out[-1] - v > 9:
                v += 12
        out.append(v)
    return out


def features(hz: list[float]) -> dict | None:
    if len(hz) < MIN_VOICED_FRAMES:
        return None
    st = smooth(drop_octave_jumps(to_semitones(hz)))
    n = len(st)
    th = max(1, n // 3)
    mid = st[th: n - th] or st[th: th + 1]
    start, end, m = sum(st[:th]) / th, sum(st[-th:]) / th, sum(mid) / len(mid)
    return {"start": start, "mid": m, "end": end, "rng": max(st) - min(st), "drop": max(st) - end, "rise": end - min(st),
            "hi_at": st.index(max(st)) / (n - 1), "lo_at": st.index(min(st)) / (n - 1)}


def classify(hz: list[float]) -> int | None:
    """Nada 1-4 dari kontur F0 (Hz); None bila terlalu pendek.

    Ukuran pada data nyata (Kokoro zf_001): T4 jelas terpisah (turun >= 5 semitone dari puncak),
    T1/T2/T3 hanya beda 1-3 semitone. Aturan T1-T3 di bawah adalah perkiraan terbaik; cek nada
    memakai tone_ok() yang membedakan "turun" (T4) dari "tidak turun" (T1-T3) secara andal.
    """
    f = features(hz)
    if f is None:
        return None
    if f["drop"] >= 4.5 and f["rng"] >= 5.5 and f["hi_at"] <= 0.6:
        return 4
    if f["mid"] - f["end"] >= 0.5 and f["start"] - f["mid"] < 1.0 and f["rise"] < 1.3:
        return 3 if f["lo_at"] < 0.5 or f["mid"] - f["end"] >= 1.0 else 1
    if f["end"] - f["mid"] >= 0.6 and f["rise"] >= 1.2:
        return 2
    if f["drop"] >= 4.0 and f["rng"] >= 5.0:
        return 4
    return 1


def tone_ok(expected: int, hz: list[float]) -> bool:
    """Kontur cocok dengan nada yang diharapkan: T4 harus turun; T1-T3 tidak boleh turun tajam
    (cocok persis, atau sama-sama di kelompok T1-T3)."""
    c = classify(hz)
    if c is None:
        return False
    if expected == 4:
        return c == 4
    return c != 4
