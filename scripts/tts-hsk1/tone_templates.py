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
import re
import sys
from collections import defaultdict
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE))
import tone_analysis as ta  # noqa: E402
import tone_model as tm  # noqa: E402

DATA = ROOT / "data" / "hsk1"
MIN_SPK_SYL = 25


def log(*a):
    print(*a, file=sys.stderr, flush=True)


def norm_speaker(spk: str) -> str:
    """'ll:levi-highway-(列维劳德)' -> 'll:levi-highway' (nama sama, tulisan judul file berbeda)."""
    return re.sub(r"-?\(.*\)$", "", spk)


def hsk_texts() -> set[str]:
    p = DATA / "words.json"
    return {w["hanzi"] for w in json.loads(p.read_text(encoding="utf-8"))} if p.exists() else set()


def relabel_refs(refs: list[dict], trusted: set[str]) -> tuple[list[dict], int]:
    """Aturan pelabelan (dicatat di docs): nada yang diharapkan untuk teks yang BUKAN kata data HSK 1 (tanda nadanya dari
    pypinyin, yang tidak memberi sandhi 不/一 lengkap) dihitung ulang dengan ta.apply_yi_bu_sandhi. Kata data HSK 1 memakai
    tabel resmi 2025 apa adanya. Tidak ada rekaman yang dibuang. Hasil: (refs baru, jumlah rekaman yang labelnya berubah)."""
    out, changed = [], 0
    for r in refs:
        if r["text"] not in trusted and ("不" in r["text"] or "一" in r["text"]):
            new = ta.apply_yi_bu_sandhi(r["text"], r["tones"])
            if new != r["tones"]:
                changed += 1
                r = {**r, "tones": new, "tonesRaw": r["tones"]}
        out.append(r)
    return out, changed


def rows_from_refs(doc: dict, min_spk_syl: int = MIN_SPK_SYL, relabel: bool = True) -> tuple[list[dict], dict]:
    """Baris suku kata dari rujukan; kontur dinormalkan ke median penutur. Penutur dengan < min_spk_syl suku kata
    bernada 1-4 dibuang (median tidak andal)."""
    by_spk = defaultdict(list)
    seen_url: set[str] = set()
    refs = []
    src_refs = relabel_refs(doc["refs"], hsk_texts())[0] if relabel else doc["refs"]
    for r in src_refs:
        if r.get("url"):  # rekaman Lingua Libre yang sama bisa terukur dua kali (repo + Commons): satu saja
            if r["url"] in seen_url:
                continue
            seen_url.add(r["url"])
        r = {**r, "spk": norm_speaker(r["spk"])}
        refs.append(r)
        by_spk[r["spk"]].append(r)
    doc = {**doc, "refs": refs}
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
                         "r": s["r"], "pos": i, "n": len(r["tones"]), "rid": r["id"], "text": r["text"],
                         "vf": s.get("vf"), "inn": s.get("inn"), "hn": s.get("hn"), "vs": s.get("vs"), "ve": s.get("ve")})
    return rows, meds


def _acc_row(name: str, pred, y, cls) -> dict:
    return {"name": name, "acc": round(float((pred == y).mean()), 4),
            "word": round(float((pred[cls == "word"] == y[cls == "word"]).mean()), 4),
            "tone3": round(float((pred[y == 3] == 3).mean()), 4)}


def train(rows: list[dict], seed: int = 0) -> tuple[dict, dict]:
    """Ronde 2: pengenal nada bersadar konteks (GBM) + verifikasi GOP-gaya; evaluasi lintas penutur (LOSO, lipatan sama
    dengan ronde 1). Mengembalikan (model ekspor untuk numpy [MLP ronde 1, dipertahankan untuk tone_score lama], evaluasi).
    Model GBM sendiri tidak diekspor: tone_score melatihnya ulang dari tone-refs.json (deterministik, seed tetap)."""
    from sklearn.linear_model import LogisticRegression
    from sklearn.neural_network import MLPClassifier
    from sklearn.preprocessing import StandardScaler

    X, y, spk, cls, ids = tm.build_matrix(rows)
    pos = X[:, tm.columns("pos")[0]]
    last = X[:, tm.columns("pos")[3]] == 1
    folds = tm.make_folds(spk)
    cnt: dict = defaultdict(int)
    for s_ in spk:
        cnt[s_] += 1
    big = sorted([s_ for s_, n in cnt.items() if n >= 400], key=lambda s_: -cnt[s_])

    # --- ronde 1 (direproduksi): 26 fitur kontur, MLP / LR
    Xb = X[:, tm.columns("base")]
    sc = StandardScaler().fit(Xb)
    Xs = sc.transform(Xb)
    ab = []
    r1: dict = {}
    for kind in ("lr", "mlp"):
        mk = (lambda: LogisticRegression(C=1.0, max_iter=2000)) if kind == "lr" else (
            lambda: MLPClassifier(hidden_layer_sizes=(32,), alpha=1e-2, max_iter=800, random_state=seed))
        pred = np.zeros(len(y), dtype=int)
        for f in folds:
            te = np.isin(spk, f)
            pred[te] = mk().fit(Xs[~te], y[~te]).predict(Xs[te])
        r1[kind] = pred
        log(f"[clf] ronde 1 {kind}: {float((pred == y).mean()):.3f}")
    ab.append(_acc_row("ronde 1: MLP, 26 fitur kontur", r1["mlp"], y, cls))

    # --- ablasi GBM
    steps = [("GBM, 26 fitur kontur", ("base",)),
             ("+ konteks (nada tetangga, kontur tetangga, posisi, durasi, ringkasan ujaran)", ("base", "tones", "nbr", "pos", "dur", "utt")),
             ("+ fitur ronde 2 (bersuara per bagian, intensitas, HNR/derit, awal-akhir bersuara)", tuple(tm.GROUPS))]
    Pfull = None
    for name, groups in steps:
        cols = tm.columns(*groups)
        if groups == tuple(tm.GROUPS) and not np.any(X[:, tm.columns("extra")[0]:tm.columns("extra")[-1] + 1]):
            continue  # rujukan lama tanpa fitur tambahan
        P = tm.loso_proba(X[:, cols], y, spk, folds=folds)
        ab.append(_acc_row(name, P.argmax(1) + 1, y, cls))
        Pfull = P
        log(f"[clf] {name}: {ab[-1]['acc']:.3f} (word {ab[-1]['word']:.3f})")
    pred = Pfull.argmax(1) + 1
    summ = tm.summarize(pred, y, cls, spk)
    # --- verifikasi GOP-gaya (standar 1c)
    g = tm.verification_scores(Pfull, y)
    thr = tm.threshold_p10(g)
    ok = g >= thr
    ver = {"threshold": round(thr, 3), "passRate": round(float(ok.mean()), 4),
           "perTone": {str(t): round(float(ok[y == t].mean()), 4) for t in tm.CLASSES},
           "perClass": {c: round(float(ok[cls == c].mean()), 4) for c in ("syl", "single", "word", "sent") if (cls == c).any()},
           "note": "ambang = persentil-10 skor rujukan asli (lintas penutur); jadi ~90 % lolos menurut konstruksi, "
                   "yang dilaporkan adalah lolos per kelas/nada dan seberapa jauh suara kita turun di bawahnya"}
    # --- nada 3 dipecah
    t3 = {}
    for name, m in (("penuh (suku kata terakhir)", (y == 3) & last), ("setengah-3 (bukan terakhir)", (y == 3) & ~last)):
        t3[name] = {"n": int(m.sum()), "acc": round(float((pred[m] == 3).mean()), 4) if m.any() else None}
    s2 = (y == 2)
    nxt3 = X[:, tm.columns("tones")[0] + 6 + 4] == 1  # one-hot tetangga kanan bernada 3
    t3["nada 2 sebelum nada 3 (umumnya hasil sandhi 3+3)"] = {"n": int((s2 & nxt3).sum()), "acc": round(float((pred[s2 & nxt3] == 2).mean()), 4) if (s2 & nxt3).any() else None}
    ev = {"model": "gbm", "folds": [f if len(f) == 1 else f"{len(f)} penutur kecil" for f in folds],
          "n": int(len(y)), "acc": round(summ["acc"], 4), "accLR": round(float((r1["lr"] == y).mean()), 4),
          "accMLP": round(float((r1["mlp"] == y).mean()), 4),
          "perTone": {k: round(v, 4) for k, v in summ["perTone"].items()},
          "perClass": {k: round(v, 4) for k, v in summ["perClass"].items()}, "perClassN": summ["perClassN"],
          "perSpeaker": {s_: {"n": int(cnt[s_]), "acc": round(summ["perSpeaker"][s_], 4)} for s_ in big},
          "perSpeakerAll": {s_: {"n": int(cnt[s_]), "acc": round(summ["perSpeaker"][s_], 4)} for s_ in sorted(cnt, key=lambda k: -cnt[k])},
          "confusion": [[int(((y == a) & (pred == b)).sum()) for b in tm.CLASSES] for a in tm.CLASSES],
          "round1": {"acc": ab[0]["acc"], "perTone": {str(t): round(float((r1["mlp"][y == t] == t).mean()), 4) for t in tm.CLASSES},
                     "perClass": {c: round(float((r1["mlp"][cls == c] == y[cls == c]).mean()), 4) for c in ("syl", "single", "word", "sent") if (cls == c).any()}},
          "ablation": ab, "verification": ver, "tone3": t3,
          "wordAcc": round(float((pred[cls == "word"] == y[cls == "word"]).mean()), 4)}
    # model ekspor lama (MLP 26 fitur) untuk jalur numpy
    final = MLPClassifier(hidden_layer_sizes=(32,), alpha=1e-2, max_iter=800, random_state=seed).fit(Xs, y)
    model = {"kind": "mlp", "mean": [round(float(x), 5) for x in sc.mean_], "scale": [round(float(x), 5) for x in sc.scale_],
             "W": [[[round(v, 5) for v in row] for row in w] for w in [w.tolist() for w in final.coefs_]],
             "b": [[round(v, 5) for v in bb] for bb in [x.tolist() for x in final.intercepts_]]}
    # skor verifikasi out-of-fold disimpan untuk persentil per kelas (tone_score membandingkan suara kita)
    ev["verification"]["scoreP"] = {str(p): round(float(np.percentile(g, p)), 3) for p in (5, 10, 25, 50, 75, 90)}
    return model, ev


def native_stats(rows: list[dict], tpl: dict) -> dict:
    """Angka rujukan asli untuk standar 1d/1f per kelas (single, word, sent, syl): median + simpangan jarak DTW ke templat nada
    (nada 1-4, templat menurut nada berikutnya), median rasio rentang (=1 menurut konstruksi), porsi suku kata di bawah p5 durasi."""
    out: dict = {}
    for c in ("syl", "single", "word", "sent"):
        sel = [r for r in rows if r["cls"] == c and r["tone"] in (1, 2, 3, 4) and r["c_rel"]]
        if not sel:
            continue
        ds = []
        for r in sel:
            ent = tpl["tones"].get(str(r["tone"]))
            if not ent:
                continue
            m = (ent["next"].get(str(r["next"])) or ent["all"])["mean"]
            ds.append(ta.dtw(r["c_rel"], m))
        shorts = 0
        tot = 0
        for r in sel:
            st = tpl["stats"].get(f"{c}/{r['tone']}") or tpl["stats"].get(f"word/{r['tone']}")
            if st and "p5" in st["dur"]:
                tot += 1
                shorts += r["d"] < st["dur"]["p5"] * (0.6 if c == "sent" else 1.0)
        out[c] = {"n": len(sel), "dtwMedian": round(float(np.median(ds)), 3), "dtwSd": round(float(np.std(ds)), 3),
                  "shortShare": round(shorts / max(1, tot), 4)}
    return out


def fit_final(rows: list[dict], seed: int = 0):
    """GBM akhir pada semua rujukan (untuk tone_score): (model, jumlah suku kata)."""
    X, y, _spk, _cls, _ids = tm.build_matrix(rows)
    return tm.make_gbm(seed).fit(X, y), len(y)


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
    out = {"version": 2, "npts": ta.NPTS, "relabeledRecordings": relabel_refs(doc["refs"], hsk_texts())[1],
           "refsVersion": doc.get("version"), "alignment": doc.get("alignment"), "refsUsed": len(doc["refs"]), "sources": doc.get("counts", {}),
           "speakers": dict(sorted(spk_info.items(), key=lambda kv: -kv[1]["nSyl"])[:60]), "nSpeakers": len(meds),
           "tones": tpl["tones"], "stats": tpl["stats"], "native": native_stats(rows, tpl), "classifier": {"model": model, "eval": ev}}
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
