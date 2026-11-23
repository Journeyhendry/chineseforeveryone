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


# --------------------------------------------------------------------------
# Ronde 3: meluruskan nada suku kata tunggal (PSOLA lewat praat-parselmouth Manipulation)
# --------------------------------------------------------------------------
# Hanya untuk item 1 suku kata yang BUNYINYA lolos tetapi NADANYA salah (P3 sering membaca suku
# kata tunggal dengan nada turun). Kontur F0 diganti dengan kontur baku nada target (huruf nada Chao,
# tingkat 1 = terendah, 5 = tertinggi) di rentang suara P3 sendiri; durasi dan bunyi tidak diubah
# (overlap-add hanya menggeser tinggi nada), titik kontur diinterpolasi linear -> perpindahan halus.
# Hasilnya dicek ulang penuh (Whisper + F0) dan hanya dipakai bila lolos.
TONE_SHAPES = {
    1: [(0.0, 4.6), (1.0, 4.5)],                 # 55
    2: [(0.0, 3.0), (0.3, 2.8), (1.0, 4.8)],     # 35
    3: [(0.0, 2.3), (0.6, 0.8), (1.0, 3.0)],     # 21(4): turun ke bawah, naik sedikit di akhir
    4: [(0.0, 5.0), (0.2, 4.9), (1.0, 1.4)],     # 51
}
MIN_SPAN_ST = 8.0  # rentang minimal (semitone) tingkat 1-5 bila rentang penutur terukur lebih sempit


def speaker_ref(contours: list[list[float]]) -> tuple[float, float]:
    """(Hz bawah, Hz atas) = persentil 5 dan 95 F0 semua kontur (file P3 yang lolos), minimal MIN_SPAN_ST."""
    vals = sorted(12 * math.log2(h) for c in contours for h in c if h > 0)
    if len(vals) < 20:
        raise ValueError("terlalu sedikit data F0 untuk rentang penutur")
    lo, hi = vals[int(0.05 * (len(vals) - 1))], vals[int(0.95 * (len(vals) - 1))]
    if hi - lo < MIN_SPAN_ST:
        mid = (hi + lo) / 2
        lo, hi = mid - MIN_SPAN_ST / 2, mid + MIN_SPAN_ST / 2
    return 2 ** (lo / 12), 2 ** (hi / 12)


def target_contour(tone: int, ref: tuple[float, float], n: int = 12) -> list[tuple[float, float]]:
    """n titik (posisi 0..1, Hz) kontur baku nada `tone` di rentang ref."""
    lo, hi = (12 * math.log2(x) for x in ref)
    shape = TONE_SHAPES[tone]
    out = []
    for i in range(n):
        x = i / (n - 1)
        for (x0, l0), (x1, l1) in zip(shape, shape[1:]):
            if x0 <= x <= x1:
                lvl = l0 + (l1 - l0) * (x - x0) / (x1 - x0)
                break
        st = lo + (lvl - 1) / 4 * (hi - lo)
        out.append((x, 2 ** (st / 12)))
    return out


def retarget(src: Path, dst_wav: Path, tone: int, ref: tuple[float, float], tmp_wav: Path) -> None:
    """Ganti kontur F0 bagian bersuara klip dengan kontur baku `tone` (PSOLA overlap-add)."""
    import parselmouth
    from parselmouth.praat import call

    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(src), "-ac", "1", "-ar", "24000", str(tmp_wav)], check=True)
    snd = parselmouth.Sound(str(tmp_wav))
    pitch = snd.to_pitch_ac(time_step=0.01, pitch_floor=PARSELMOUTH_FLOOR, pitch_ceiling=PARSELMOUTH_CEIL)
    f = pitch.selected_array["frequency"]
    voiced = [t for t, v in zip(pitch.xs(), f) if v > 0]
    if len(voiced) < MIN_VOICED_FRAMES:
        raise RuntimeError("bagian bersuara terlalu pendek untuk diluruskan")
    t0, t1 = voiced[0], voiced[-1]
    manip = call(snd, "To Manipulation", 0.01, PARSELMOUTH_FLOOR, PARSELMOUTH_CEIL)
    tier = call(manip, "Extract pitch tier")
    call(tier, "Remove points between", snd.xmin, snd.xmax)
    for x, hz in target_contour(tone, ref):
        call(tier, "Add point", t0 + x * (t1 - t0), hz)
    call([tier, manip], "Replace pitch tier")
    out = call(manip, "Get resynthesis (overlap-add)")
    out.save(str(dst_wav), "WAV")


def voiced_runs(audio: Path, tmp_wav: Path) -> tuple[list[tuple[float, float]], float]:
    """Bagian bersuara (F0 terdeteksi) berurutan, (awal, akhir) detik; dan durasi klip."""
    import parselmouth

    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(audio), "-ac", "1", "-ar", "24000", str(tmp_wav)], check=True)
    snd = parselmouth.Sound(str(tmp_wav))
    pitch = snd.to_pitch_ac(time_step=0.01, pitch_floor=PARSELMOUTH_FLOOR, pitch_ceiling=PARSELMOUTH_CEIL)
    return runs_from_f0(list(pitch.xs()), list(pitch.selected_array["frequency"])), snd.duration


def runs_from_f0(xs: list[float], f0: list[float]) -> list[tuple[float, float]]:
    runs, cur = [], None
    for t, v in zip(xs, f0):
        if v > 0:
            cur = [t, t] if cur is None else [cur[0], t]
        elif cur:
            runs.append((cur[0], cur[1]))
            cur = None
    if cur:
        runs.append((cur[0], cur[1]))
    return runs


def devoice_span(runs: list[tuple[float, float]], max_gap: float = 0.1) -> float | None:
    """Waktu awal bagian bersuara utama bila ada bagian bersuara lain yang berakhir <= max_gap detik
    sebelumnya (bunyi "i" bersuara yang P3 tambahkan sebelum konsonan tak bersuara x/j/q/sh...);
    None bila tidak ada."""
    if len(runs) < 2:
        return None
    i = max(range(len(runs)), key=lambda k: runs[k][1] - runs[k][0])
    if i == 0 or runs[i][0] - runs[i - 1][1] > max_gap:
        return None
    return runs[i][0]


def devoice_onset(src: Path, dst_wav: Path, tmp_wav: Path) -> bool:
    """Ronde 3: buang suara rendah (< 2 kHz, high-pass 4x) dari bagian SEBELUM vokal utama untuk suku kata
    berkonsonan awal tak bersuara (x/j/q/zh/ch/sh/z/c/s/f/h). Desis konsonan (> 2 kHz) tetap; vokal tidak
    disentuh; sambungan crossfade 15 ms. False bila tidak ada bagian bersuara tambahan di depan."""
    runs, _ = voiced_runs(src, tmp_wav)
    t = devoice_span(runs)
    if t is None:
        return False
    t = max(0.02, t - 0.01)
    hp = ",".join(["highpass=f=2000"] * 4)
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(tmp_wav), "-filter_complex",
                    f"[0]asplit[x][y];[x]atrim=0:{t:.3f},{hp}[a];[y]atrim={t:.3f},asetpts=PTS-STARTPTS[b];"
                    "[a][b]acrossfade=d=0.015:c1=tri:c2=tri", str(dst_wav)], check=True)
    return True
