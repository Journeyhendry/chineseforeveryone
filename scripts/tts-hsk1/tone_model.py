#!/usr/bin/env python3
"""Task 4c ronde 2 · pengenal nada dengan konteks + verifikasi (GOP-gaya).

Fungsi murni (numpy/sklearn) dipakai tone_templates.py (latih + LOSO), tone_score.py dan tone_report_md.py.

  features(sib, i)            vektor fitur suku kata i dalam ujaran sib (daftar dict: tone, c_rel, d, vd, r)
                              = fitur kontur lama (26) + nada tetangga (kiri/kanan, 1 dan 2 jauhnya, one-hot) +
                                kontur/durasi tetangga + posisi dalam kata + durasi/rasio bersuara/rentang +
                                ringkasan ujaran. Fitur TIDAK boleh memakai nada suku kata itu sendiri (kebocoran label).
                                Nada 3 dipecah lewat posisi (akhir = 3 penuh, tengah = setengah-3) dan nada tetangga;
                                3 -> 2 (sandhi) sudah menjadi label 2 pada nada yang diharapkan.
  loso_predict(...)           prediksi 4 kelas out-of-fold lintas penutur (lipatan sama dengan ronde 1)
  verification_scores(...)    GOP-gaya: log( P(nada diharapkan) / sum P(3 nada lain) )
  threshold_p10(...)          ambang verifikasi = persentil-10 rujukan asli (standar 1c)
"""
from __future__ import annotations

from collections import defaultdict

import numpy as np

import tone_analysis as ta

CLASSES = (1, 2, 3, 4)


def _onehot(t: int) -> list[float]:
    v = [0.0] * 6  # -1 (tak ada) , 0 ringan, 1..4
    v[t + 1] = 1.0
    return v


def _nb(s) -> list[float]:
    if s is None or not s.get("c_rel"):
        return [0.0] * 14
    return list(map(float, s["c_rel"])) + [s["d"], s["vd"], s["r"], 1.0]


def utterance_stats(sib: list[dict]) -> tuple[list[float], float]:
    pts = [x for s in sib if s.get("c_rel") for x in s["c_rel"]]
    a = np.asarray(pts if pts else [0.0], dtype=float)
    return [float(a.mean()), float(a.min()), float(a.max()), float(a.std())], float(sum(s["d"] for s in sib))


def features(sib: list[dict], i: int, ustat=None) -> np.ndarray:
    r = sib[i]
    n = len(sib)
    g = lambda k: sib[k] if 0 <= k < n else None  # noqa: E731
    tn = lambda k: sib[k]["tone"] if 0 <= k < n else -1  # noqa: E731
    utt, tot = ustat or utterance_stats(sib)
    base = ta.clf_features(r["c_rel"], r["vd"])
    cm = np.asarray(r["c_rel"], dtype=float)
    return np.concatenate([
        base, _onehot(tn(i - 1)), _onehot(tn(i + 1)), _onehot(tn(i - 2)), _onehot(tn(i + 2)),
        _nb(g(i - 1)), _nb(g(i + 1)), _nb(g(i - 2)), _nb(g(i + 2)),
        [i, n - 1 - i, n, float(i == n - 1), float(i == 0)],
        [r["d"], r["vd"], r["vd"] / max(r["d"], 0.03), r["r"], r["d"] / max(tot, 0.03)],
        utt, [float(cm.mean() - utt[0])],
    ]).astype(float)


def usable(s: dict) -> bool:
    return bool(s.get("c_rel")) and s.get("vd", 0) > 0


def build_matrix(rows: list[dict]):
    """rows (dari tone_templates.rows_from_refs; punya rid, pos) -> (X, y, spk, cls, idx baris)."""
    by = defaultdict(list)
    for k, r in enumerate(rows):
        by[r["rid"]].append((r["pos"], k))
    X, y, spk, cls, ids = [], [], [], [], []
    for rid, lst in by.items():
        lst.sort()
        sib = [rows[k] for _, k in lst]
        ust = utterance_stats(sib)
        for i, s in enumerate(sib):
            if s["tone"] in CLASSES and usable(s):
                X.append(features(sib, i, ust))
                y.append(s["tone"])
                spk.append(s["spk"])
                cls.append(s["cls"])
                ids.append(lst[i][1])
    return np.array(X), np.array(y), np.array(spk), np.array(cls), np.array(ids)


def make_folds(spk: np.ndarray) -> list[list[str]]:
    cnt: dict = defaultdict(int)
    for s in spk:
        cnt[s] += 1
    big = sorted([s for s, n in cnt.items() if n >= 400], key=lambda s: -cnt[s])
    small = sorted(s for s in cnt if s not in big)
    return [[s] for s in big] + [small[i::5] for i in range(5) if small[i::5]]


def make_gbm(seed: int = 0):
    from sklearn.ensemble import HistGradientBoostingClassifier

    return HistGradientBoostingClassifier(max_iter=300, learning_rate=0.06, max_leaf_nodes=15,
                                          l2_regularization=1.0, random_state=seed)


def loso_proba(X, y, spk, make=make_gbm, folds=None) -> np.ndarray:
    """Peluang out-of-fold (n x 4, kolom = nada 1..4), lipatan lintas penutur."""
    folds = folds or make_folds(spk)
    P = np.zeros((len(y), 4))
    for f in folds:
        te = np.isin(spk, f)
        m = make().fit(X[~te], y[~te])
        P[te] = m.predict_proba(X[te])
    return P


def verification_scores(P: np.ndarray, y: np.ndarray) -> np.ndarray:
    """GOP-gaya: log(P(diharapkan) / jumlah P(3 nada lain)), jenuh di +-9."""
    pe = P[np.arange(len(y)), y - 1]
    return np.log(np.clip(pe, 1e-6, 1) / np.clip(1 - pe, 1e-6, 1))


def threshold_p10(scores: np.ndarray) -> float:
    return float(np.percentile(scores, 10))


def summarize(pred, y, cls, spk) -> dict:
    return {"acc": float((pred == y).mean()),
            "perTone": {str(t): float((pred[y == t] == t).mean()) for t in CLASSES},
            "perClass": {c: float((pred[cls == c] == y[cls == c]).mean()) for c in ("syl", "single", "word", "sent") if (cls == c).any()},
            "perClassN": {c: int((cls == c).sum()) for c in ("syl", "single", "word", "sent")},
            "perSpeaker": {s: float((pred[spk == s] == y[spk == s]).mean()) for s in sorted(set(spk))}}
