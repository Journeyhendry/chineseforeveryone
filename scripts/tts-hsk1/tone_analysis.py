"""Task 4c · analisis nada: audio -> ukuran per suku kata (kontur F0, durasi, rentang), templat, pengenal nada.

Dipakai oleh tone_refs.py (rujukan penutur asli), tone_score.py (audio sekarang) dan rebuild_tone.py (perbaikan).
Fungsi murni (numpy) dipisah dari yang memakai Parselmouth supaya bisa dites (test_tone_4c.py).

Satuan: semitone terhadap 100 Hz (st = 12*log2(Hz/100)); "relatif" = dikurangi median penutur
(median semua titik kontur penutur itu), jadi tinggi-rendah suara penutur tidak berpengaruh.

Pemotongan suku kata (pilihan 4c, tertulis supaya bisa diperiksa):
  * Satu suku kata: bagian bersuara terbesar klip. Tanpa pemotongan.
  * Beberapa suku kata: jumlah suku kata DIKETAHUI (dari pinyin; erhua 儿 tidak dihitung). Rentang ujaran =
    bingkai dengan intensitas > puncak-30 dB. Titik potong dipilih DP (programa dinamis) yang memaksimalkan
    kedalaman lembah intensitas (+bonus bingkai tak bersuara) dikurangi penalti kuadrat log(durasi/durasi
    yang diharapkan); durasi yang diharapkan sebanding dengan bobot nada (ringan 0.6, nada 3 1.2, ...).
    Dipilih ketimbang timestamp Whisper karena jalan lokal tanpa model, deterministik, dan tidak
    tergantung tulisan huruf (Whisper tidak memberi batas per suku kata yang andal untuk Mandarin).
    Kelemahan: suku kata tanpa lembah jelas (mis. "ao" + "a") dipotong kira-kira di tengah.
"""
from __future__ import annotations

import math
import re
import subprocess
import unicodedata
from pathlib import Path

import numpy as np

STEP = 0.01
NPTS = 10
SPAN_DROP_DB = 30.0
PAUSE_DB = 35.0
PAUSE_MIN = 0.12
MIN_VOICED_FRAMES = 4
TONE_WEIGHT = {0: 0.6, 1: 1.0, 2: 1.0, 3: 1.2, 4: 0.9}

TONE_MARKS = {
    "ā": ("a", 1), "á": ("a", 2), "ǎ": ("a", 3), "à": ("a", 4),
    "ē": ("e", 1), "é": ("e", 2), "ě": ("e", 3), "è": ("e", 4),
    "ī": ("i", 1), "í": ("i", 2), "ǐ": ("i", 3), "ì": ("i", 4),
    "ō": ("o", 1), "ó": ("o", 2), "ǒ": ("o", 3), "ò": ("o", 4),
    "ū": ("u", 1), "ú": ("u", 2), "ǔ": ("u", 3), "ù": ("u", 4),
    "ǖ": ("v", 1), "ǘ": ("v", 2), "ǚ": ("v", 3), "ǜ": ("v", 4),
}


# --------------------------------------------------------------------------
# Nada yang diharapkan (murni)
# --------------------------------------------------------------------------

def parse_numbered(tok: str) -> tuple[str, int]:
    """'hao3' -> ('hao', 3); 'ba5'/'ba' -> ('ba', 0); 'nv3' -> ('nv', 3)."""
    m = re.match(r"^([a-zü:]+?)([0-5])?$", tok.strip().lower())
    if not m:
        raise ValueError(tok)
    t = int(m.group(2) or 0)
    return m.group(1).replace("ü", "v").replace("u:", "v"), 0 if t == 5 else t


def parse_marked(syl: str) -> tuple[str, int]:
    tone, out = 0, []
    for ch in unicodedata.normalize("NFC", syl.lower()):
        if ch in TONE_MARKS:
            base, tone = TONE_MARKS[ch]
            out.append(base)
        else:
            out.append("v" if ch == "ü" else ch)
    return "".join(out), tone


def apply_third_tone_sandhi(tones: list[int]) -> list[int]:
    """3 + 3 -> 2 + 3 (tiap nada 3 yang diikuti nada 3 menjadi nada 2). 不/一 sudah ditangani sumber
    pinyin (data kata = tabel resmi 2025; pypinyin juga sudah mengubah 不/一)."""
    out = list(tones)
    for i in range(len(out) - 1):
        if out[i] == 3 and out[i + 1] == 3:
            out[i] = 2
    return out


def is_erhua(text: str, i: int) -> bool:
    """儿 pada indeks i adalah penanda erhua (bukan 女儿 / 儿子 / 儿 di awal)."""
    return text[i] == "儿" and i > 0 and text[i - 1] != "女" and text[i + 1:i + 2] != "子"


def hanzi_only(text: str) -> str:
    return "".join(ch for ch in text if "一" <= ch <= "鿿")


def syllable_count(text: str) -> int:
    t = hanzi_only(text)
    return sum(1 for i in range(len(t)) if not is_erhua(t, i))


def expected_tones_from_numbered(numbered: str) -> list[int]:
    """'mian4 tiao2 r5' -> [4, 2] (erhua 'r' tidak dihitung), lalu sandhi 3+3."""
    toks = [t for t in numbered.split() if not re.match(r"^r[0-5]?$", t)]
    return apply_third_tone_sandhi([parse_numbered(t)[1] for t in toks])


def expected_tones_from_text(text: str) -> list[int] | None:
    """Nada dari pypinyin (TONE3, ringan=0), tanpa erhua, sandhi 3+3. None bila ada huruf/angka non-Han."""
    from pypinyin import Style, lazy_pinyin

    if any(ch.isalnum() and not ("一" <= ch <= "鿿") for ch in text):
        return None
    t = hanzi_only(text)
    if not t:
        return None
    py = lazy_pinyin(t, style=Style.TONE3, neutral_tone_with_five=True)
    tones = []
    for i, p in enumerate(py):
        if is_erhua(t, i):
            continue
        m = re.search(r"([0-5])$", p)
        tones.append(0 if not m or m.group(1) == "5" else int(m.group(1)))
    return apply_third_tone_sandhi(tones)


def next_tones(tones: list[int]) -> list[int]:
    """Nada suku kata berikutnya per suku kata; -1 = akhir ujaran."""
    return tones[1:] + [-1]


def length_class(n_syl: int) -> str:
    """'single' (1 suku kata) | 'word' (2-4) | 'sent' (>= 5)."""
    if n_syl <= 1:
        return "single"
    return "word" if n_syl <= 4 else "sent"


# --------------------------------------------------------------------------
# Kontur F0 (murni)
# --------------------------------------------------------------------------

def hz_to_st(hz) -> np.ndarray:
    hz = np.asarray(hz, dtype=float)
    out = np.full(hz.shape, np.nan)
    m = hz > 0
    out[m] = 12 * np.log2(hz[m] / 100.0)
    return out


def repair_octaves(st: np.ndarray, jump: float = 7.0) -> np.ndarray:
    """Lipat loncatan oktaf antar bingkai bersuara berurutan (selisih > jump semitone) dan buang lonjakan
    tunggal > 4 semitone dari median geser 5 bingkai. NaN = tak bersuara (dipertahankan)."""
    st = np.array(st, dtype=float)
    idx = np.where(~np.isnan(st))[0]
    if len(idx) == 0:
        return st
    prev_i = idx[0]
    for i in idx[1:]:
        if i - prev_i <= 4:
            while st[i] - st[prev_i] > jump:
                st[i] -= 12
            while st[prev_i] - st[i] > jump:
                st[i] += 12
        prev_i = i
    idx = np.where(~np.isnan(st))[0]
    vals = st[idx].copy()
    for k, i in enumerate(idx):
        win = vals[max(0, k - 2): k + 3]
        if len(win) >= 3 and abs(vals[k] - np.median(win)) > 4.0:
            st[i] = np.nan
    return st


def smooth_nan(st: np.ndarray, k: int = 1) -> np.ndarray:
    out = np.array(st, dtype=float)
    idx = np.where(~np.isnan(st))[0]
    vals = st[idx]
    for n, i in enumerate(idx):
        out[i] = np.median(vals[max(0, n - k): n + k + 1])
    return out


def main_voiced(times: np.ndarray, st: np.ndarray, max_gap: float = 0.12) -> tuple[float, float] | None:
    """(awal, akhir) kelompok bersuara terbesar (celah <= max_gap digabung)."""
    idx = np.where(~np.isnan(st))[0]
    if len(idx) < MIN_VOICED_FRAMES:
        return None
    groups, cur = [], [idx[0]]
    for a, b in zip(idx, idx[1:]):
        if (b - a) * STEP <= max_gap + 1e-9:
            cur.append(b)
        else:
            groups.append(cur)
            cur = [b]
    groups.append(cur)
    g = max(groups, key=len)
    if len(g) < MIN_VOICED_FRAMES:
        return None
    return float(times[g[0]]), float(times[g[-1]] + STEP)


def speech_span(times: np.ndarray, inten: np.ndarray, drop_db: float = SPAN_DROP_DB) -> tuple[float, float]:
    idx = np.where(inten > np.nanmax(inten) - drop_db)[0]
    if len(idx) == 0:
        return float(times[0]), float(times[-1] + STEP)
    return float(times[idx[0]]), float(times[idx[-1]] + STEP)


def segment(inten: np.ndarray, voiced: np.ndarray, weights: list[float], lam: float = 1.0, stride: int = 2,
            min_len: int = 3) -> list[tuple[int, int]]:
    """Titik potong DP untuk len(weights) suku kata pada bingkai 0..F-1 (rentang ujaran). Hasil: [(i0, i1), ...]
    (indeks bingkai, i1 eksklusif) yang menutup 0..F. stride = langkah grid titik potong (bingkai)."""
    F = len(inten)
    n = len(weights)
    if n <= 1:
        return [(0, F)]
    g = np.arange(0, F + 1, stride)
    if g[-1] != F:
        g = np.append(g, F)
    G = len(g)
    imax = float(np.max(inten))
    depth = np.clip((imax - inten) / 30.0, 0, 1)
    sc = depth + 0.3 * (~voiced).astype(float)
    cut_sc = np.zeros(G)
    for k, p in enumerate(g):
        if 0 < p < F:
            cut_sc[k] = sc[p]
    w = np.asarray(weights, dtype=float)
    exp_len = F * w / w.sum()
    L = (g[None, :] - g[:, None]).astype(float)
    NEG = -1e9
    dp = np.full((n + 1, G), NEG)
    back = np.zeros((n + 1, G), dtype=int)
    dp[0, 0] = 0.0
    for k in range(1, n + 1):
        pen = lam * np.log(np.where(L > 0, L, 1.0) / exp_len[k - 1]) ** 2
        cand = np.where(L >= min_len, dp[k - 1][:, None] - pen, NEG)
        bi = np.argmax(cand, axis=0)
        best = cand[bi, np.arange(G)]
        dp[k] = np.where(best > NEG / 2, best + (cut_sc if k < n else 0.0), NEG)
        if k < n:
            dp[k, 0] = NEG
            dp[k, G - 1] = NEG
        back[k] = bi
    if dp[n, G - 1] <= NEG / 2:  # terlalu pendek untuk n suku kata: bagi rata
        edges = [int(round(F * i / n)) for i in range(n + 1)]
        return list(zip(edges[:-1], edges[1:]))
    cuts = [G - 1]
    j = G - 1
    for k in range(n, 0, -1):
        j = int(back[k, j])
        cuts.append(j)
    cuts = [int(g[c]) for c in reversed(cuts)]
    return list(zip(cuts[:-1], cuts[1:]))


def contour_points(times: np.ndarray, st: np.ndarray, t0: float, t1: float, npts: int = NPTS):
    """(kontur npts titik semitone absolut, awal bersuara, akhir bersuara, rentang) dalam [t0, t1); None bila
    bagian bersuara < MIN_VOICED_FRAMES. Titik berjarak sama antara bingkai bersuara pertama dan terakhir;
    celah tak bersuara diinterpolasi."""
    m = (times >= t0 - 1e-9) & (times < t1 - 1e-9) & ~np.isnan(st)
    if m.sum() < MIN_VOICED_FRAMES:
        return None
    tv, sv = times[m], st[m]
    xs = np.linspace(tv[0], tv[-1], npts)
    c = np.interp(xs, tv, sv)
    rng = float(np.percentile(sv, 95) - np.percentile(sv, 5))
    return c, float(tv[0]), float(tv[-1] + STEP), rng


def effective_duration(inten: np.ndarray, i0: int, i1: int, imax: float) -> float:
    """Durasi segmen (detik) dikurangi jeda sunyi dalam segmen (intensitas < puncak-35 dB selama >= 0,12 dtk)."""
    seg = inten[i0:i1] < imax - PAUSE_DB
    pause, run = 0, 0
    for s in seg:
        if s:
            run += 1
        else:
            if run * STEP >= PAUSE_MIN:
                pause += run
            run = 0
    if run * STEP >= PAUSE_MIN:
        pause += run
    return (i1 - i0 - pause) * STEP


def measure(times, st, inten, tones: list[int], npts: int = NPTS) -> dict | None:
    """Ukur ujaran: {span, span_st, syl:[{tone, d, vd, r, c (st absolut) | None, t0, t1}]}. tones = nada yang
    diharapkan per suku kata (0 = ringan)."""
    n = len(tones)
    if n == 0 or len(times) < 10:
        return None
    t0, t1 = speech_span(times, inten)
    i0 = max(0, min(int(round(t0 / STEP)), len(times) - 1))
    i1 = min(len(times), int(round(t1 / STEP)))
    if i1 - i0 < 3 * n:
        return None
    imax = float(np.nanmax(inten))
    voiced = ~np.isnan(st[i0:i1])
    if n == 1:
        mv = main_voiced(times, st)
        if mv is None:
            return None
        segs_t = [mv]
        durs = [effective_duration(inten, i0, i1, imax)]  # ujaran penuh (konsonan awal ikut)
    else:
        segs = segment(inten[i0:i1], voiced, [TONE_WEIGHT[t] for t in tones])
        segs_t = [(float(times[i0] + a * STEP), float(times[i0] + b * STEP)) for a, b in segs]
        durs = [effective_duration(inten, i0 + a, i0 + b, imax) for a, b in segs]
    syl = []
    for tone, (a, b), d in zip(tones, segs_t, durs):
        cp = contour_points(times, st, a, b, npts)
        rec = {"tone": tone, "d": round(d, 3), "t0": round(float(a), 3), "t1": round(float(b), 3)}
        if cp is None:
            rec.update(c=None, vd=0.0, r=0.0)
        else:
            c, v0, v1, rng = cp
            rec.update(c=[round(float(x), 2) for x in c], vd=round(v1 - v0, 3), r=round(rng, 2), v0=round(v0, 3))
        syl.append(rec)
    allv = st[~np.isnan(st)]
    span_st = float(np.percentile(allv, 95) - np.percentile(allv, 5)) if len(allv) > 10 else 0.0
    return {"span": round(t1 - t0, 3), "span_st": round(span_st, 2), "syl": syl}


# --------------------------------------------------------------------------
# Audio -> trek (Parselmouth)
# --------------------------------------------------------------------------

def load_sound(path: Path, tmp_wav: Path, sr: int = 16000):
    import parselmouth

    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(path), "-ac", "1", "-ar", str(sr), str(tmp_wav)], check=True)
    return parselmouth.Sound(str(tmp_wav))


def track(snd) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """(waktu, F0 semitone-absolut dengan NaN tak bersuara, intensitas dB), langkah 10 ms. Dua lintasan:
    pertama 60-500 Hz untuk median, kedua rentang sempit sekitar median (kurangi galat oktaf)."""
    p1 = snd.to_pitch_ac(time_step=STEP, pitch_floor=60.0, pitch_ceiling=500.0)
    f1 = np.asarray(p1.selected_array["frequency"], dtype=float)
    v = f1[f1 > 0]
    if len(v) >= 5:
        med = float(np.median(v))
        p = snd.to_pitch_ac(time_step=STEP, pitch_floor=max(50.0, med * 0.6), pitch_ceiling=min(700.0, med * 1.9))
    else:
        p = p1
    times = np.asarray(p.xs(), dtype=float)
    f0 = np.asarray(p.selected_array["frequency"], dtype=float)
    it = snd.to_intensity(minimum_pitch=120.0, time_step=STEP)
    inten = np.interp(times, np.asarray(it.xs(), dtype=float), np.asarray(it.values[0], dtype=float))
    st = smooth_nan(repair_octaves(hz_to_st(f0)))
    return times, st, inten


def analyze_file(path: Path, tones: list[int], tmp_wav: Path) -> dict | None:
    snd = load_sound(path, tmp_wav)
    times, st, inten = track(snd)
    return measure(times, st, inten, tones)


# --------------------------------------------------------------------------
# Statistik: median penutur, templat, persentil
# --------------------------------------------------------------------------

def speaker_median(contours: list) -> float:
    pts = [x for c in contours if c for x in c]
    return float(np.median(pts)) if pts else 0.0


def pct(xs: list[float], ps=(5, 10, 50, 90)) -> dict:
    if not xs:
        return {}
    a = np.asarray(xs, dtype=float)
    out = {f"p{p}": round(float(np.percentile(a, p)), 3) for p in ps}
    out["n"] = len(xs)
    return out


def build_templates(syls: list[dict], min_n: int = 8, min_stat_n: int = 40) -> dict:
    """syls: {tone, next, cls, spk, c_rel (10), d, vd, r}. Hasil: templat per nada (+ per nada berikut) dan
    persentil durasi / rentang per (kelas panjang, nada)."""
    out: dict = {"tones": {}, "stats": {}}

    def tpl(rows):
        a = np.asarray([r["c_rel"] for r in rows], dtype=float)
        return {"n": len(rows), "mean": [round(float(x), 2) for x in a.mean(0)],
                "sd": [round(float(x), 2) for x in a.std(0)]}

    for t in (1, 2, 3, 4):
        base = [s for s in syls if s["tone"] == t and s.get("c_rel")]
        if len(base) < min_n:
            continue
        ent = {"all": tpl(base), "next": {}}
        for nx in (1, 2, 3, 4, 0, -1):
            rows = [s for s in base if s["next"] == nx]
            if len(rows) >= min_n:
                ent["next"][str(nx)] = tpl(rows)
        out["tones"][str(t)] = ent
    for cls in ("syl", "single", "word", "sent"):
        for t in (0, 1, 2, 3, 4):
            rows = [s for s in syls if s["cls"] == cls and s["tone"] == t]
            if len(rows) < min_stat_n:  # persentil dari sedikit contoh tidak andal (kelas sent: rujukan sangat sedikit)
                continue
            out["stats"][f"{cls}/{t}"] = {"dur": pct([r["d"] for r in rows]),
                                          "vdur": pct([r["vd"] for r in rows if r["vd"] > 0]),
                                          "range": pct([r["r"] for r in rows if r.get("c_rel")])}
    return out


# --------------------------------------------------------------------------
# DTW + pengenal nada (inferensi murni numpy)
# --------------------------------------------------------------------------

def dtw(a, b, band: int = 2) -> float:
    """Jarak DTW rata-rata per langkah jalur (semitone) antara dua kontur, pita Sakoe-Chiba."""
    a, b = np.asarray(a, dtype=float), np.asarray(b, dtype=float)
    n, m = len(a), len(b)
    INF = 1e18
    D = np.full((n + 1, m + 1), INF)
    S = np.zeros((n + 1, m + 1))
    D[0, 0] = 0
    for i in range(1, n + 1):
        for j in range(max(1, i - band), min(m, i + band) + 1):
            c = abs(a[i - 1] - b[j - 1])
            prev = min((D[i - 1, j], S[i - 1, j]), (D[i, j - 1], S[i, j - 1]), (D[i - 1, j - 1], S[i - 1, j - 1]),
                       key=lambda x: x[0])
            D[i, j] = prev[0] + c
            S[i, j] = prev[1] + 1
    return float(D[n, m] / max(1.0, S[n, m]))


def clf_features(c_rel, vd: float) -> np.ndarray:
    """Fitur pengenal nada: kontur relatif (10), kontur tanpa rata-rata (10), rata-rata, kemiringan akhir-awal,
    rentang, posisi min/maks (0..1), log durasi bersuara."""
    c = np.asarray(c_rel, dtype=float)
    m = float(c.mean())
    n = len(c)
    return np.concatenate([c, c - m, [m, c[-3:].mean() - c[:3].mean(), c.max() - c.min(), np.argmin(c) / (n - 1),
                                      np.argmax(c) / (n - 1), math.log(max(vd, 0.03))]])


def clf_predict(model: dict, feats) -> tuple[int, list[float]]:
    """Inferensi pengenal (MLP/LR hasil ekspor): (nada 1-4, peluang keempat nada)."""
    x = (np.asarray(feats, dtype=float) - np.asarray(model["mean"])) / np.asarray(model["scale"])
    for i, (W, b) in enumerate(zip(model["W"], model["b"])):
        x = x @ np.asarray(W) + np.asarray(b)
        if i < len(model["W"]) - 1:
            x = np.maximum(x, 0)
    x = x - x.max()
    p = np.exp(x) / np.exp(x).sum()
    return int(np.argmax(p)) + 1, [round(float(v), 3) for v in p]
