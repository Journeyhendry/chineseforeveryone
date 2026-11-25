#!/usr/bin/env python3
"""Task 4c · B. data/hsk1/tone-refs.json -> data/hsk1/tone-templates.json + tabel di docs/tasks/task-4c-hasil.md (bagian rujukan).

  python3 scripts/tts-hsk1/tone_templates.py build [--refs data/hsk1/tone-refs.json]

Isi tone-templates.json:
  speakers   median kontur (semitone) tiap penutur rujukan yang dipakai (>= MIN_SPK_SYL suku kata bernada 1-4)
  tones      templat kontur per nada (rata-rata dan simpangan per titik, relatif median penutur), juga per nada berikut
  stats      persentil durasi (p5/p10/p50/p90), durasi bersuara, rentang nada per "kelas panjang/nada"
             (single = 1 suku kata, word = 2-4, sent = >= 5; 0 = nada ringan)
  classifier MLP/LR terlatih pada rujukan (bobot untuk numpy) + akurasi lintas penutur (leave-one-speaker-out)
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE))
import tone_analysis as ta  # noqa: E402

DATA = ROOT / "data" / "hsk1"
MIN_SPK_SYL = 25


def log(*a):
    print(*a, file=sys.stderr, flush=True)


def rows_from_refs(doc: dict, min_spk_syl: int = MIN_SPK_SYL) -> tuple[list[dict], dict]:
    """Baris suku kata dari rujukan; kontur dinormalkan ke median penutur. Penutur dengan < min_spk_syl suku kata
    bernada 1-4 dibuang (median tidak andal)."""
    by_spk = defaultdict(list)
    for r in doc["refs"]:
        by_spk[r["spk"]].append(r)
    meds, keep = {}, set()
    for spk, rs in by_spk.items():
        cs = [[x / 10 for x in s["c"]] for r in rs for s in r["syl"] if s["c"]]
        n14 = sum(1 for r in rs for t, s in zip(r["tones"], r["syl"]) if s["c"] and t in (1, 2, 3, 4))
        if n14 >= min_spk_syl:
            meds[spk] = ta.speaker_median(cs)
            keep.add(spk)
    rows = []
    for r in doc["refs"]:
        if r["spk"] not in keep:
            continue
        nx = ta.next_tones(r["tones"])
        # daftar suku kata terpisah (dibaca lambat satu-satu) tidak dicampur dengan rekaman kata: kelas "syl"
        cls = "syl" if r["src"] == "audio-cmn-syl" else ta.length_class(len(r["tones"]))
        for i, (t, s) in enumerate(zip(r["tones"], r["syl"])):
            c_rel = [round(x / 10 - meds[r["spk"]], 2) for x in s["c"]] if s["c"] else None
            rows.append({"tone": t, "next": nx[i], "cls": cls, "spk": r["spk"], "c_rel": c_rel, "d": s["d"], "vd": s["vd"],
                         "r": s["r"], "pos": i, "n": len(r["tones"]), "rid": r["id"]})
    return rows, meds


def train(rows: list[dict], seed: int = 0) -> tuple[dict, dict]:
    """Latih pengenal nada 1-4; kembalikan (model ekspor, evaluasi lintas penutur)."""
    from sklearn.linear_model import LogisticRegression
    from sklearn.neural_network import MLPClassifier
    from sklearn.preprocessing import StandardScaler

    data = [r for r in rows if r["tone"] in (1, 2, 3, 4) and r["c_rel"] and r["vd"] > 0]
    X = np.array([ta.clf_features(r["c_rel"], r["vd"]) for r in data])
    y = np.array([r["tone"] for r in data])
    spk = np.array([r["spk"] for r in data])
    cls = np.array([r["cls"] for r in data])
    sc = StandardScaler().fit(X)
    Xs = sc.transform(X)

    def make(kind):
        if kind == "lr":
            return LogisticRegression(C=1.0, max_iter=2000)
        return MLPClassifier(hidden_layer_sizes=(32,), alpha=1e-2, max_iter=800, random_state=seed)

    # lipatan lintas penutur: penutur besar masing-masing satu lipatan, penutur kecil dikelompokkan
    cnt = defaultdict(int)
    for s in spk:
        cnt[s] += 1
    big = sorted([s for s, n in cnt.items() if n >= 400], key=lambda s: -cnt[s])
    small = sorted(s for s in cnt if s not in big)
    folds = [[s] for s in big] + [small[i::5] for i in range(5) if small[i::5]]
    result = {}
    for kind in ("lr", "mlp"):
        pred = np.zeros(len(y), dtype=int)
        for f in folds:
            te = np.isin(spk, f)
            m = make(kind).fit(Xs[~te], y[~te])
            pred[te] = m.predict(Xs[te])
        acc = float((pred == y).mean())
        result[kind] = {"acc": round(acc, 4), "pred": pred}
        log(f"[clf] {kind}: akurasi lintas penutur {acc:.3f}")
    best = max(result, key=lambda k: result[k]["acc"])
    pred = result[best]["pred"]
    ev = {"model": best, "folds": [f if len(f) == 1 else f"{len(f)} penutur kecil" for f in folds],
          "n": int(len(y)), "acc": result[best]["acc"], "accLR": result["lr"]["acc"], "accMLP": result["mlp"]["acc"],
          "perTone": {str(t): round(float((pred[y == t] == t).mean()), 4) for t in (1, 2, 3, 4)},
          "perClass": {c: round(float((pred[cls == c] == y[cls == c]).mean()), 4) for c in ("syl", "single", "word", "sent") if (cls == c).any()},
          "perClassN": {c: int((cls == c).sum()) for c in ("syl", "single", "word", "sent")},
          "perSpeaker": {s: {"n": int(cnt[s]), "acc": round(float((pred[spk == s] == y[spk == s]).mean()), 4)} for s in big},
          "confusion": [[int(((y == a) & (pred == b)).sum()) for b in (1, 2, 3, 4)] for a in (1, 2, 3, 4)]}
    final = make(best).fit(Xs, y)
    if best == "lr":
        W, b = [final.coef_.T.tolist()], [final.intercept_.tolist()]
    else:
        W, b = [w.tolist() for w in final.coefs_], [x.tolist() for x in final.intercepts_]
    model = {"kind": best, "mean": [round(float(x), 5) for x in sc.mean_], "scale": [round(float(x), 5) for x in sc.scale_],
             "W": [[[round(v, 5) for v in row] for row in w] for w in W], "b": [[round(v, 5) for v in bb] for bb in b]}
    return model, ev


def build(refs_path: Path, out_path: Path) -> dict:
    doc = json.loads(refs_path.read_text(encoding="utf-8"))
    rows, meds = rows_from_refs(doc)
    log(f"[build] {len(doc['refs'])} rujukan -> {len(rows)} suku kata, {len(meds)} penutur dipakai")
    tpl = ta.build_templates(rows)
    model, ev = train(rows)
    spk_info = {}
    for s, m in meds.items():
        n = sum(1 for r in rows if r["spk"] == s)
        spk_info[s] = {"medianSt": round(m, 2), "medianHz": round(100 * 2 ** (m / 12), 1), "nSyl": n}
    out = {"version": 1, "npts": ta.NPTS, "refsUsed": len(doc["refs"]), "sources": doc.get("counts", {}),
           "speakers": dict(sorted(spk_info.items(), key=lambda kv: -kv[1]["nSyl"])[:60]), "nSpeakers": len(meds),
           "tones": tpl["tones"], "stats": tpl["stats"], "classifier": {"model": model, "eval": ev}}
    out_path.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    log(f"[build] -> {out_path} ({out_path.stat().st_size / 1e3:.0f} KB); pengenal {ev['model']} {ev['acc']:.3f}")
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["build"])
    ap.add_argument("--refs", default=str(DATA / "tone-refs.json"))
    ap.add_argument("--out", default=str(DATA / "tone-templates.json"))
    a = ap.parse_args()
    build(Path(a.refs), Path(a.out))


if __name__ == "__main__":
    main()
