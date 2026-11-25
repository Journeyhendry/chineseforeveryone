"""Cek nada suku kata tunggal dari kontur F0 (task 0, ronde 2).

Dipakai oleh basics.py; logikanya murni (numpy) supaya bisa dites dengan sapuan sinus sintetis
(test_tonecheck.py). Ekstraksi F0: praat-parselmouth (autokorelasi Praat, langkah 10 ms,
75-600 Hz).

Langkah
1. F0 per 10 ms; hanya bingkai bersuara (F0 > 0). Ambil potongan bersuara terpanjang
   (celah <= 3 bingkai disambung), buang bingkai yang meloncat > 6 semiton dari median
   (salah oktaf), haluskan dengan median 5 bingkai.
2. Ubah ke semiton lalu ke skala Chao 1-5 terhadap **rentang penutur**:
   L = 1 + 4 * (st - p5) / (p95 - p5), p5/p95 = persentil 5 dan 95 semua bingkai bersuara
   dari semua suku kata tunggal penutur ini (dihitung sekali per jalan). Rentang < 3 semiton
   dianggap 3 semiton (supaya getaran kecil tidak dibesar-besarkan).
3. Inti suku kata = buang 20 % awal (transisi konsonan / awal F0) dan 10 % akhir (ekor).
   Fitur pada inti: s = median 20 % pertama, e = median 20 % terakhir, d = e - s,
   mn/mx = nilai terendah/tertinggi, pmn = posisi mn (0..1), mean = rata-rata.
4. Aturan (dicoba berurutan, satuan = skala Chao di atas):
   - nada 4 (turun):        d <= -FALL  dan  s >= 3.0  dan  e <= 2.0   (tinggi -> rendah)
   - nada 2 (naik):         e - mn >= RISE  dan  pmn <= 0.5  dan  e >= 3.0
                            (titik terendah di paruh awal, naik sampai di atas tengah)
   - nada 1 (datar tinggi): mx - mn <= FLAT_SPAN  dan  |d| <= FLAT_D  dan  mean >= 3.0
   - nada 3 (rendah / turun-naik): e < 3.0  dan  mn <= 2.0  dan  mean <= 3.0
                            (sudah bukan nada 4/2: rendah, turun pelan ke bawah, atau lembah rendah)
   - selain itu: tidak jelas (0) -> gagal.
   FALL = 2.0, RISE = 1.0, FLAT_SPAN = 1.5, FLAT_D = 1.0 (lihat konstanta di bawah).
"""
from __future__ import annotations

import numpy as np

PITCH_FLOOR = 75.0
PITCH_CEIL = 600.0
STEP = 0.01
MIN_RANGE_ST = 3.0
DEFAULT_REF = (12 * np.log2(220.0), 12 * np.log2(300.0))  # bila belum ada rentang penutur

FALL = 2.0
RISE = 1.0
FLAT_SPAN = 1.5
FLAT_D = 1.0
MIN_FRAMES = 8


def extract_f0(path) -> np.ndarray:
    import parselmouth

    snd = parselmouth.Sound(str(path))
    pitch = snd.to_pitch_ac(time_step=STEP, pitch_floor=PITCH_FLOOR, pitch_ceiling=PITCH_CEIL)
    return np.asarray(pitch.selected_array["frequency"], dtype=float)


def clean_semitones(f0) -> np.ndarray:
    """Langkah 1: potongan bersuara terpanjang, tanpa loncatan oktaf, dihaluskan; dalam semiton."""
    f0 = np.asarray(f0, dtype=float)
    voiced = f0 > 0
    runs, i, n = [], 0, len(f0)
    while i < n:
        if not voiced[i]:
            i += 1
            continue
        j, gap, last = i, 0, i
        while j < n and gap <= 3:
            if voiced[j]:
                last, gap = j, 0
            else:
                gap += 1
            j += 1
        runs.append((i, last + 1))
        i = last + 1
    if not runs:
        return np.array([])
    a, b = max(runs, key=lambda r: r[1] - r[0])
    seg = f0[a:b]
    st = 12 * np.log2(seg[seg > 0])
    st = st[np.abs(st - np.median(st)) < 6]
    return np.array([np.median(st[max(0, k - 2):k + 3]) for k in range(len(st))])


def speaker_ref(contours) -> tuple[float, float]:
    """Langkah 2: (p5, p95) semiton dari semua kontur penutur."""
    arr = [c for c in contours if len(c)]
    if not arr:
        return DEFAULT_REF
    allst = np.concatenate(arr)
    lo, hi = float(np.percentile(allst, 5)), float(np.percentile(allst, 95))
    if hi - lo < MIN_RANGE_ST:
        mid = (hi + lo) / 2
        lo, hi = mid - MIN_RANGE_ST / 2, mid + MIN_RANGE_ST / 2
    return lo, hi


def features(st, ref) -> dict | None:
    lo, hi = ref
    if len(st) < MIN_FRAMES:
        return None
    L = 1 + 4 * (np.asarray(st) - lo) / (hi - lo)
    n = len(L)
    core = L[int(n * 0.2):max(int(n * 0.9), int(n * 0.2) + MIN_FRAMES // 2)]
    m = len(core)
    k = max(1, int(round(m * 0.2)))
    imn = int(np.argmin(core))
    return {
        "s": float(np.median(core[:k])), "e": float(np.median(core[-k:])),
        "mn": float(core.min()), "mx": float(core.max()), "pmn": imn / max(1, m - 1),
        "mean": float(core.mean()), "frames": n,
    }


def classify(st, ref) -> tuple[int, dict | None]:
    """Langkah 3-4. Kembalikan (nada 1-4, atau 0 bila tidak jelas; fitur)."""
    f = features(st, ref)
    if f is None:
        return 0, None
    s, e, mn, mx, pmn, mean = f["s"], f["e"], f["mn"], f["mx"], f["pmn"], f["mean"]
    d = e - s
    if d <= -FALL and s >= 3.0 and e <= 2.0:
        return 4, f
    if e - mn >= RISE and pmn <= 0.5 and e >= 3.0:
        return 2, f
    if mx - mn <= FLAT_SPAN and abs(d) <= FLAT_D and mean >= 3.0:
        return 1, f
    if e < 3.0 and mn <= 2.0 and mean <= 3.0:
        return 3, f
    return 0, f


def round_features(f: dict | None) -> dict | None:
    if f is None:
        return None
    return {k: (round(v, 2) if isinstance(v, float) else v) for k, v in f.items()}
