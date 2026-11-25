#!/usr/bin/env python3
"""Task 4c · C. Ukur audio P3/L3 terhadap rujukan penutur asli (fungsi murni + CLI).

  python3 scripts/tts-hsk1/tone_score.py score [--cache DIR] [--only KIND ...]   -> data/hsk1/audio-tone-report.json

Bendera per file (hanya dari angka, ambang tertulis di FLAG_* di bawah):
  terlalu_pendek  ada suku kata lebih pendek dari persentil-5 rujukan (kelas panjang yang sama); kalimat (>= 5 suku
                  kata): rujukan kalimat tidak ada (Tatoeba bebas = 0), dipakai p5 kelas "word" x SENT_SHORT_FACTOR
  nada_salah      pengenal nada memilih nada lain untuk suku kata nada 1-4 (<= 4 suku kata: satu salah cukup;
                  lebih panjang: >= 25 % salah)
  nada_lemah      nada dikenali benar tetapi peluang rata-rata nada yang dimaksud < FLAG_CONF atau rentang nada
                  median < FLAG_RANGE x rujukan

Ronde 2 (standar docs/STANDAR-UKUR-SUARA.md): pengenal = GBM bersadar konteks (tone_model) dilatih ulang dari tone-refs.json
(Judge); `nada_salah` = nada dikenali lain DAN skor verifikasi (GOP-gaya) di bawah ambang persentil-10 rujukan asli.
Batas suku kata dari penyelarasan paksa bila TONE_ALIGN=1 (tone_align), sama dengan jalur rujukan asli.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE))
import tone_align as tal  # noqa: E402
import tone_analysis as ta  # noqa: E402
import tone_model as tm  # noqa: E402

DATA = ROOT / "data" / "hsk1"
AUDIO = ROOT / "public" / "audio" / "hsk1"
FLAG_CONF = 0.60
FLAG_RANGE = 0.70
SENT_SHORT_FACTOR = 0.6
WRONG_FRAC_LONG = 0.25


def log(*a):
    print(*a, file=sys.stderr, flush=True)


# --------------------------------------------------------------------------
# Nada yang diharapkan per item
# --------------------------------------------------------------------------

def load_lookup():
    words = {w["id"]: w for w in json.loads((DATA / "words.json").read_text(encoding="utf-8"))}
    casual = {c["id"]: c for c in json.loads((DATA / "casual.json").read_text(encoding="utf-8"))["items"]}
    return words, casual


def item_tones(it: dict, words: dict, casual: dict) -> list[int] | None:
    """Nada yang diharapkan: kata/ungkapan dari data (pinyinNumbered, sandhi resmi), kalimat/dialog dari pypinyin."""
    kind, sid = it["kind"], it["sourceId"]
    if kind in ("word", "word-slow") and sid in words:
        return ta.expected_tones_from_numbered(words[sid]["pinyinNumbered"])
    if kind in ("casual", "casual-slow") and sid in casual:
        return ta.expected_tones_from_numbered(casual[sid]["pinyinNumbered"])
    return ta.expected_tones_from_text(it["text"])


# --------------------------------------------------------------------------
# Templat (dari tone-templates.json)
# --------------------------------------------------------------------------

def get_template(tpl: dict, tone: int, nxt: int) -> list[float] | None:
    ent = tpl["tones"].get(str(tone))
    if not ent:
        return None
    return (ent["next"].get(str(nxt)) or ent["all"])["mean"]


def get_stat(tpl: dict, cls: str, tone: int) -> dict | None:
    for c in ([cls, "word"] if cls == "sent" else [cls]):
        s = tpl["stats"].get(f"{c}/{tone}")
        if s:
            return s
    return tpl["stats"].get(f"word/{tone}")


def short_limit(tpl: dict, cls: str, tone: int) -> float | None:
    s = get_stat(tpl, cls, tone)
    if not s or "p5" not in s["dur"]:
        return None
    return s["dur"]["p5"] * (SENT_SHORT_FACTOR if cls == "sent" else 1.0)


class Judge:
    """Pengenal ronde 2: GBM konteks dilatih pada semua rujukan asli (relatif median penutur) + ambang verifikasi p10."""

    def __init__(self, tpl: dict, refs_path: Path | None = None):
        import tone_templates as tt

        doc = json.loads((refs_path or DATA / "tone-refs.json").read_text(encoding="utf-8"))
        rows, _ = tt.rows_from_refs(doc)
        self.model, n = tt.fit_final(rows)
        self.n_train = n
        self.thr = float(tpl["classifier"]["eval"]["verification"]["threshold"])

    def proba(self, sib: list[dict], i: int) -> list[float]:
        return [float(x) for x in self.model.predict_proba([tm.features(sib, i)])[0]]


def syl_dicts(meas: dict, med: float) -> list[dict]:
    out = []
    for s in meas["syl"]:
        out.append({"tone": s["tone"], "c_rel": (np.asarray(s["c"]) - med).tolist() if s["c"] is not None else None,
                    "d": s["d"], "vd": s["vd"], "r": s["r"], "vf": s.get("vf"), "inn": s.get("inn"), "hn": s.get("hn"),
                    "vs": s.get("vs"), "ve": s.get("ve")})
    return out


def score_syllables(meas: dict, med: float, tpl: dict, judge: "Judge | None" = None) -> list[dict]:
    """Per suku kata: nada diharapkan, nada dikenali, peluang, skor verifikasi g, jarak DTW ke templat, rasio rentang, durasi, pendek?
    judge=None -> pengenal MLP ronde 1 (26 fitur kontur)."""
    model = tpl["classifier"]["model"]
    tones = [s["tone"] for s in meas["syl"]]
    nx = ta.next_tones(tones)
    cls = ta.length_class(len(tones))
    sib = syl_dicts(meas, med) if judge else None
    out = []
    for i, s in enumerate(meas["syl"]):
        t = s["tone"]
        rec = {"exp": t, "d": s["d"], "r": s["r"], "pred": None, "p": None, "g": None, "dist": None, "rr": None, "short": False}
        lim = short_limit(tpl, cls, t if t else 0)
        if lim is not None and s["d"] < lim:
            rec["short"] = True
        if s["c"] is not None and t in (1, 2, 3, 4):
            c_rel = np.asarray(s["c"]) - med
            if judge and s["vd"] > 0:
                probs = judge.proba(sib, i)
                pred = int(np.argmax(probs)) + 1
                pe = probs[t - 1]
                rec["g"] = round(float(np.log(max(pe, 1e-6) / max(1 - pe, 1e-6))), 3)
            else:
                pred, probs = ta.clf_predict(model, ta.clf_features(c_rel, s["vd"]))
            rec["pred"], rec["p"] = pred, probs[t - 1]
            tm_ = get_template(tpl, t, nx[i])
            if tm_:
                rec["dist"] = round(ta.dtw(c_rel, tm_), 2)
            st = get_stat(tpl, cls, t)
            if st and st["range"].get("p50"):
                rec["rr"] = round(s["r"] / st["range"]["p50"], 2)
        elif t in (1, 2, 3, 4):
            rec["pred"], rec["p"], rec["g"] = 0, 0.0, -9.0  # tak ada bagian bersuara: dianggap salah
        out.append(rec)
    return out


def file_summary(syl: list[dict], thr: float | None = None) -> dict:
    tone_syl = [s for s in syl if s["exp"] in (1, 2, 3, 4)]
    n = len(tone_syl)
    wrong = sum(1 for s in tone_syl if s["pred"] != s["exp"])
    if thr is not None:  # ronde 2: salah = dikenali lain DAN skor verifikasi di bawah ambang rujukan (p10)
        wrong = sum(1 for s in tone_syl if s["pred"] != s["exp"] and (s.get("g") is None or s["g"] < thr))
    acc = 1.0 if n == 0 else 1 - wrong / n
    ps = [s["p"] for s in tone_syl if s["p"] is not None]
    conf = float(np.mean(ps)) if ps else 1.0
    rrs = [s["rr"] for s in tone_syl if s["rr"] is not None]
    rr = float(np.median(rrs)) if rrs else 1.0
    ds = [s["dist"] for s in tone_syl if s["dist"] is not None]
    dist = float(np.mean(ds)) if ds else 0.0
    short = sum(1 for s in syl if s["short"])
    flags = []
    if short:
        flags.append("terlalu_pendek")
    if n and ((n <= 4 and wrong >= 1) or (n > 4 and wrong / n >= WRONG_FRAC_LONG)):
        flags.append("nada_salah")
    elif n and (conf < FLAG_CONF or rr < FLAG_RANGE):
        flags.append("nada_lemah")
    return {"n": n, "wrong": wrong, "acc": round(acc, 3), "conf": round(conf, 3), "rr": round(rr, 3), "dist": round(dist, 2),
            "short": short, "S": round(combined_score(acc, conf, rr, dist, short, len(syl)), 4), "flags": flags}


def combined_score(acc: float, conf: float, rr: float, dist: float, short: int, n_syl: int) -> float:
    """Skor gabungan 0..1 (lebih besar = lebih baik): ketepatan nada 0.35, keyakinan pengenal 0.25, rentang nada
    (terpotong di 1.0) 0.2, durasi tidak pendek 0.1, kedekatan kontur (jarak DTW 0 -> 1, >= 6 st -> 0) 0.1."""
    short_frac = short / max(1, n_syl)
    return (0.35 * acc + 0.25 * conf + 0.2 * min(max(rr, 0.0), 1.0) + 0.1 * (1 - short_frac)
            + 0.1 * max(0.0, 1 - dist / 6.0))


def voice_median(meas_list: list[dict]) -> float:
    return ta.speaker_median([s["c"] for m in meas_list for s in m["syl"] if s["c"]])


def better(after: dict, before: dict, margin: float = 0.02) -> bool:
    """Boleh mengganti file? Skor naik >= margin, ketepatan nada tidak turun, tidak ada suku kata pendek baru."""
    return (after["S"] >= before["S"] + margin and after["acc"] >= before["acc"] - 1e-9 and after["short"] <= before["short"])


# --------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------

TECH_LUFS = -16.0
TECH_LUFS_TOL = 1.0
TECH_TP_MAX = -1.5
TECH_CUT = 0.05     # amplitudo (0..1) 2 ms pertama/terakhir di atas ini = terpotong mendadak
TECH_CLICK = 0.5    # lompatan antar-sampel di atas ini = klik
SAMPLE_RATE_TECH = 24000


def technical(path: Path) -> dict:
    """Standar 1g: loudness terpadu (LUFS), puncak sejati (dBTP), klip, klik, potong mendadak di awal/akhir."""
    import re
    import subprocess

    r = subprocess.run(["ffmpeg", "-nostats", "-hide_banner", "-i", str(path), "-af", "ebur128=peak=true", "-f", "null", "-"],
                       capture_output=True, text=True)
    tail = r.stderr[r.stderr.rfind("Summary:"):]
    m1 = re.search(r"I:\s+(-?[\d.]+) LUFS", tail)
    m2 = re.search(r"Peak:\s+(-?[\d.]+|-inf) dBFS", tail)
    lufs = float(m1.group(1)) if m1 else None
    tp = float(m2.group(1)) if m2 and m2.group(1) != "-inf" else None
    if lufs is not None and lufs < -60:
        lufs = None  # terlalu pendek untuk loudness terpadu (< 400 ms)
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-f", "f32le", "-ac", "1", "-ar", str(SAMPLE_RATE_TECH), "-"],
                         capture_output=True).stdout
    x = np.frombuffer(raw, dtype=np.float32)
    out = {"lufs": lufs, "tp": tp, "clip": 0, "click": False, "cutStart": False, "cutEnd": False}
    if len(x) > 2400:
        edge = int(0.002 * SAMPLE_RATE_TECH)
        out["clip"] = int((np.abs(x) >= 0.999).sum())
        out["cutStart"] = bool(np.abs(x[:edge]).max() > TECH_CUT)
        out["cutEnd"] = bool(np.abs(x[-edge:]).max() > TECH_CUT)
        mid = x[int(0.01 * SAMPLE_RATE_TECH):-int(0.01 * SAMPLE_RATE_TECH)]
        out["click"] = bool(len(mid) > 1 and np.abs(np.diff(mid)).max() > TECH_CLICK)
    return out


def tech_ok(t: dict) -> bool:
    return (t.get("lufs") is None or abs(t["lufs"] - TECH_LUFS) <= TECH_LUFS_TOL) and (t.get("tp") is None or t["tp"] <= TECH_TP_MAX) \
        and not t.get("clip") and not t.get("click") and not t.get("cutStart") and not t.get("cutEnd")


def item_letters(it: dict, words: dict, casual: dict) -> list[str] | None:
    kind, sid = it["kind"], it["sourceId"]
    if kind in ("word", "word-slow") and sid in words:
        return tal.letters_from_numbered(words[sid]["pinyinNumbered"])
    if kind in ("casual", "casual-slow") and sid in casual:
        return tal.letters_from_numbered(casual[sid]["pinyinNumbered"])
    return tal.letters_from_text(it["text"])


def measure_item(args):
    key, path, tones, letters = args
    try:
        import tempfile as tf

        with tf.TemporaryDirectory() as d:
            m = ta.analyze_file(Path(path), tones, Path(d) / "x.wav", letters=letters)
            tech = technical(Path(path))
    except Exception as e:  # noqa: BLE001
        return key, None, f"{type(e).__name__}: {e}", None
    return key, m, None, tech


SCORER_VERSION = "r2"


def measure_jobs(jobs: list[tuple], sigs: dict, cached: dict, cache: Path | None, procs: int) -> dict:
    """jobs = [(key, path, tones, letters)], sigs = {key: sig}. Memperbarui `cached` dan menyimpannya berkala."""
    from multiprocessing import Pool

    with Pool(procs) as p:
        for n, (key, m, err, tech) in enumerate(p.imap_unordered(measure_item, jobs, chunksize=4), 1):
            cached[key] = {"sig": sigs[key], "m": m, "err": err, "tech": tech}
            if n % 200 == 0:
                log(f"[score] {n}/{len(jobs)}")
                if cache:
                    cache.write_text(json.dumps(cached, separators=(",", ":")), encoding="utf-8")
    if cache:
        cache.write_text(json.dumps(cached, separators=(",", ":")), encoding="utf-8")
    return cached


def measure_all(only: set[str] | None, cache: Path | None, procs: int):
    manifest = json.loads((AUDIO / "manifest.json").read_text(encoding="utf-8"))
    items = {i["key"]: i for i in json.loads((DATA / "audio-items.json").read_text(encoding="utf-8"))["items"]}
    words, casual = load_lookup()
    cached = json.loads(cache.read_text(encoding="utf-8")) if cache and cache.exists() else {}
    jobs, sigs, skipped = [], {}, {}
    al = os.environ.get("TONE_ALIGN", "0")
    for key, e in manifest["files"].items():
        if only and e["kind"] not in only:
            continue
        sig = f"{e['hash']}|{e.get('tuning', {}).get('method', '')}|{e.get('tuning', {}).get('sha', '')}|{SCORER_VERSION}|al{al}"
        sigs[key] = sig
        if key in cached and cached[key].get("sig") == sig:
            continue
        tones = item_tones(items[key], words, casual)
        if not tones:
            skipped[key] = "tanpa nada (angka/non-Han)"
            continue
        jobs.append((key, str(AUDIO / e["path"]), tones, item_letters(items[key], words, casual)))
    log(f"[score] {len(jobs)} file diukur ({len(cached)} dari cache, {len(skipped)} dilewati)")
    measure_jobs(jobs, sigs, cached, cache, procs)
    return manifest, items, cached, skipped


# --------------------------------------------------------------------------
# Metrik standar 1b-1g (per kelompok)
# --------------------------------------------------------------------------

CLASSES = ("single", "word", "sent")


def group_metrics(files: list[dict], tpl: dict, thr: float) -> dict:
    """files: [{syl:[{exp,pred,g,d,r,dist,rr,short}], tech}]. Metrik per kelompok file (semua kelas dicampur)."""
    syl = [x for f in files for x in f["syl"] if x["exp"] in (1, 2, 3, 4)]
    allsyl = [x for f in files for x in f["syl"]]
    out: dict = {"files": len(files), "syl14": len(syl)}
    if syl:
        out["toneAcc"] = round(sum(1 for x in syl if x["pred"] == x["exp"]) / len(syl), 4)
        gs = [x for x in syl if x.get("g") is not None]
        out["verifPass"] = round(sum(1 for x in gs if x["g"] >= thr) / len(gs), 4) if gs else None
        ds = [x["dist"] for x in syl if x["dist"] is not None]
        out["dtwMedian"] = round(float(np.median(ds)), 3) if ds else None
        rr = [x["rr"] for x in syl if x["rr"] is not None]
        out["rangeRatioMedian"] = round(float(np.median(rr)), 3) if rr else None
        out["perTone"] = {str(t): {"n": sum(1 for x in syl if x["exp"] == t),
                                   "acc": round(sum(1 for x in syl if x["exp"] == t and x["pred"] == t) / max(1, sum(1 for x in syl if x["exp"] == t)), 4)}
                          for t in (1, 2, 3, 4)}
    out["shortSyl"] = sum(1 for x in allsyl if x["short"])
    out["shortShare"] = round(out["shortSyl"] / max(1, len(allsyl)), 4)
    out["flaggedFiles"] = {f: sum(1 for x in files if f in x["flags"]) for f in ("terlalu_pendek", "nada_salah", "nada_lemah")}
    techs = [x["tech"] for x in files if x.get("tech")]
    if techs:
        out["tech"] = {"n": len(techs), "ok": sum(1 for t in techs if tech_ok(t)),
                       "lufsOut": sum(1 for t in techs if t.get("lufs") is not None and abs(t["lufs"] - TECH_LUFS) > TECH_LUFS_TOL),
                       "tpOver": sum(1 for t in techs if t.get("tp") is not None and t["tp"] > TECH_TP_MAX),
                       "clip": sum(1 for t in techs if t.get("clip")), "click": sum(1 for t in techs if t.get("click")),
                       "cutStart": sum(1 for t in techs if t.get("cutStart")), "cutEnd": sum(1 for t in techs if t.get("cutEnd")),
                       "lufsUnmeasured": sum(1 for t in techs if t.get("lufs") is None)}
    return out


def standard_table(m_by_class: dict, tpl: dict) -> dict:
    """Bandingkan metrik suara kita per kelas dengan rujukan asli (tpl classifier.eval + native) dan beri lulus/gagal."""
    ev = tpl["classifier"]["eval"]
    nat = tpl.get("native", {})
    out = {}
    for c, m in m_by_class.items():
        n_acc = ev["perClass"].get(c if c != "all" else "word") if c != "all" else ev["acc"]
        n_ver = ev["verification"]["perClass"].get(c) if c != "all" else ev["verification"]["passRate"]
        n_nat = nat.get(c if c != "all" else "word", {})
        row = {"n": m["syl14"], "files": m["files"]}
        if m.get("toneAcc") is not None:
            row["1b"] = {"ours": m["toneAcc"], "native": n_acc, "passRel": bool(n_acc and m["toneAcc"] >= 0.9 * n_acc),
                         "pass90": m["toneAcc"] >= 0.9}
            row["1c"] = {"ours": m["verifPass"], "native": n_ver, "pass": bool(m["verifPass"] is not None and m["verifPass"] >= 0.9)}
            nd = n_nat.get("dtwMedian")
            row["1d"] = {"ours": m["dtwMedian"], "native": nd, "limit": (round(nd + n_nat["dtwSd"], 3) if nd is not None else None),
                         "pass": bool(nd is not None and m["dtwMedian"] is not None and m["dtwMedian"] <= nd + n_nat["dtwSd"])}
            row["1e"] = {"ours": m["rangeRatioMedian"], "native": 1.0, "pass": bool(m["rangeRatioMedian"] and m["rangeRatioMedian"] >= 0.85)}
        row["1f"] = {"shortSyl": m["shortSyl"], "share": m["shortShare"], "native": n_nat.get("shortShare", 0.05),
                     "pass": m["shortShare"] <= 0.05}
        if m.get("tech"):
            row["1g"] = {**m["tech"], "pass": m["tech"]["ok"] == m["tech"]["n"]}
        out[c] = row
    return out


def summarize(per_file: dict, manifest: dict) -> dict:
    out = {}
    for kind in sorted({e["kind"] for e in manifest["files"].values()}):
        rows = [(k, v) for k, v in per_file.items() if manifest["files"][k]["kind"] == kind]
        syl = [s for _, v in rows for s in v["syl"]]
        t14 = [s for s in syl if s["exp"] in (1, 2, 3, 4)]
        rr = [s["rr"] for s in t14 if s["rr"] is not None]
        out[kind] = {"files": len(rows), "syl14": len(t14),
                     "toneAcc": round(sum(1 for s in t14 if s["pred"] == s["exp"]) / max(1, len(t14)), 4),
                     "fileAllRight": round(sum(1 for _, v in rows if v["wrong"] == 0) / max(1, len(rows)), 4),
                     "shortSyl": sum(1 for s in syl if s["short"]), "filesShort": sum(1 for _, v in rows if v["short"]),
                     "rangeRatioMedian": round(float(np.median(rr)), 3) if rr else None,
                     "meanS": round(float(np.mean([v["S"] for _, v in rows])), 4) if rows else None,
                     "flags": {f: sum(1 for _, v in rows if f in v["flags"]) for f in ("terlalu_pendek", "nada_salah", "nada_lemah")}}
    return out


def whisper_by_kind(manifest: dict) -> dict:
    """Standar 1a (angka dari manifest yang ada, bukan dijalankan ulang): lulus Whisper large-v3 per jenis."""
    return manifest.get("whisper", {}).get("byKind", {})


def build_file_records(meas: dict, cached: dict, manifest_files: dict, tpl: dict, judge: "Judge | None", med: dict,
                       voice_of) -> dict:
    per_file = {}
    for k, m in meas.items():
        syl = score_syllables(m, med[voice_of(k)], tpl, judge)
        per_file[k] = {"syl": syl, **file_summary(syl, judge.thr if judge else None), "tech": cached[k].get("tech"), "al": m.get("al", 0)}
    return per_file


def report_files(per_file: dict) -> dict:
    return {k: {"S": v["S"], "acc": v["acc"], "conf": v["conf"], "rr": v["rr"], "dist": v["dist"], "short": v["short"],
                "flags": v["flags"], "al": v["al"],
                "syl": [[s["exp"], s["pred"], s["d"], s["r"], s.get("g")] for s in v["syl"]],
                "tech": ([v["tech"]["lufs"], v["tech"]["tp"], int(tech_ok(v["tech"]))] if v.get("tech") else None)}
            for k, v in sorted(per_file.items())}


def classes_of(files: list[dict]) -> dict:
    by: dict[str, list[dict]] = {c: [] for c in CLASSES}
    for f in files:
        by[ta.length_class(len(f["syl"]))].append(f)
    out = {c: group_metrics(v, {}, 0) for c, v in by.items() if v}
    return out


def cmd_score(a):
    tpl = json.loads((DATA / "tone-templates.json").read_text(encoding="utf-8"))
    cache = Path(a.cache) / "meas.json" if a.cache else None
    if cache:
        cache.parent.mkdir(parents=True, exist_ok=True)
    manifest, items, cached, skipped = measure_all(set(a.only) if a.only else None, cache, a.procs)
    meas = {k: v["m"] for k, v in cached.items() if v.get("m") and k in manifest["files"]}
    med = {}
    for voice in ("P3", "L3"):
        ms = [m for k, m in meas.items() if manifest["files"][k]["voice"] == voice]
        med[voice] = round(voice_median(ms), 2) if ms else 0.0
    judge = None if a.legacy else Judge(tpl)
    thr = judge.thr if judge else 0.0
    per_file = build_file_records(meas, cached, manifest["files"], tpl, judge, med, lambda k: manifest["files"][k]["voice"])
    failed = {k: v["err"] for k, v in cached.items() if v.get("err")}
    unmeasured = [k for k in manifest["files"] if k not in meas]
    files_by_kind: dict[str, list[dict]] = {}
    for k, v in per_file.items():
        files_by_kind.setdefault(manifest["files"][k]["kind"], []).append(v)
    allf = list(per_file.values())
    m_cls = {"all": group_metrics(allf, tpl, thr)}
    for c in CLASSES:
        sel = [f for f in allf if ta.length_class(len(f["syl"])) == c]
        if sel:
            m_cls[c] = group_metrics(sel, tpl, thr)
    m_kind = {k: group_metrics(v, tpl, thr) for k, v in sorted(files_by_kind.items())}
    report = {"version": 2, "scorer": SCORER_VERSION, "manifestVersion": manifest["version"], "voiceMedianSt": med,
              "templatesRefs": tpl["refsUsed"], "aligned": sum(1 for v in per_file.values() if v.get("al")),
              "classifier": "gbm-konteks (ronde 2)" if judge else "mlp ronde 1",
              "thresholds": {"conf": FLAG_CONF, "range": FLAG_RANGE, "sentShortFactor": SENT_SHORT_FACTOR, "verification": thr},
              "summary": summarize(per_file, manifest), "standard": standard_table(m_cls, tpl), "byClass": m_cls, "byKind": m_kind,
              "standardByKind": standard_table(m_kind, tpl),
              "whisper1a": {"byKind": whisper_by_kind(manifest), "passed": manifest.get("whisper", {}).get("passed"),
                            "total": manifest.get("whisper", {}).get("total"), "baseline4b": 0.963,
                            "source": "manifest.whisper (hasil 4b/4c; tidak dijalankan ulang di ronde 2)"},
              "unmeasured": sorted(unmeasured), "files": report_files(per_file)}
    Path(a.out).write_text(json.dumps(report, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    log(json.dumps(report["standard"], ensure_ascii=False, indent=1))
    log(f"[score] {len(per_file)} file; terselaras {report['aligned']}; tidak terukur {len(unmeasured)}; galat {len(failed)}")


# --------------------------------------------------------------------------
# Tahap 0 (public/audio/basics)
# --------------------------------------------------------------------------

BASICS_AUDIO = ROOT / "public" / "audio" / "basics"
BASICS_DATA = ROOT / "data" / "basics"
KNOWN_BAD = {"py-i-w", "py-f-u", "py-f-ai", "tn-yi3", "tn-n-mama", "rd-ji1-673a", "rd-shei2-8c01", "ph-n5"}
BASICS_GROUPS = {"py": "pinyin (inisial/final + contoh)", "tn": "nada & pasangan nada", "rd": "radikal", "sd": "sandhi",
                 "ph": "ungkapan kelas & angka", "cp": "pasangan minimal / lain"}


def basics_tones(hanzi: str, pinyin: str) -> tuple[list[int], list[str]] | None:
    """Nada PERMUKAAN dan huruf per suku kata dari tulisan pinyin bertanda nada di data Tahap 0 (sandhi sudah tertulis,
    mis. 'ní hǎo', 'bú shì'). Suku kata dipisah memakai pypinyin(hanzi) bila satu token memuat beberapa suku kata ('māma')."""
    letters = tal.letters_from_text(hanzi)
    if not letters:
        return None
    marked = [(ch, *ta.parse_marked(ch)) for ch in pinyin if not ch.isspace() and ch != "'"]
    tones, k = [], 0
    for lt in letters:
        n = len(lt)
        seg = marked[k:k + n]
        if len(seg) < n:
            return None
        tones.append(max((t for _, _, t in seg), default=0))
        k += n
    if k != len(marked):
        return None
    return tones, letters


def cmd_basics(a):
    tpl = json.loads((DATA / "tone-templates.json").read_text(encoding="utf-8"))
    man = json.loads((BASICS_AUDIO / "manifest.json").read_text(encoding="utf-8"))
    cache = Path(a.cache) / "basics.json" if a.cache else None
    if cache:
        cache.parent.mkdir(parents=True, exist_ok=True)
    cached = json.loads(cache.read_text(encoding="utf-8")) if cache and cache.exists() else {}
    al = os.environ.get("TONE_ALIGN", "0")
    jobs, sigs, skipped = [], {}, {}
    for key, e in man["files"].items():
        bt = basics_tones(e["hanzi"], e["pinyin"])
        if not bt:
            skipped[key] = "nada tak terurai dari pinyin"
            continue
        sig = f"{key}|{e.get('durationSec')}|{(BASICS_AUDIO / e['path']).stat().st_size}|{SCORER_VERSION}|al{al}"
        sigs[key] = sig
        if key in cached and cached[key].get("sig") == sig:
            continue
        jobs.append((key, str(BASICS_AUDIO / e["path"]), bt[0], bt[1]))
    log(f"[basics] {len(jobs)} file diukur, {len(skipped)} dilewati")
    measure_jobs(jobs, sigs, cached, cache, a.procs)
    meas = {k: v["m"] for k, v in cached.items() if v.get("m") and k in man["files"]}
    med = {"P3": round(voice_median(list(meas.values())), 2) if meas else 0.0}
    judge = None if a.legacy else Judge(tpl)
    thr = judge.thr if judge else 0.0
    per_file = build_file_records(meas, cached, man["files"], tpl, judge, med, lambda k: "P3")
    by_grp: dict[str, list[dict]] = {}
    for k, v in per_file.items():
        by_grp.setdefault(k.split("-")[0], []).append(v)
    allf = list(per_file.values())
    m_grp = {g: group_metrics(v, tpl, thr) for g, v in sorted(by_grp.items())}
    m_cls = {"all": group_metrics(allf, tpl, thr)}
    for c in CLASSES:
        sel = [f for f in allf if ta.length_class(len(f["syl"])) == c]
        if sel:
            m_cls[c] = group_metrics(sel, tpl, thr)
    issues = {i["audioId"]: i for i in json.loads((BASICS_DATA / "audio-issues.json").read_text(encoding="utf-8"))["items"]}
    known = {}
    for k in sorted(KNOWN_BAD):
        v = per_file.get(k)
        e = man["files"].get(k)
        known[k] = {"hanzi": e["hanzi"] if e else None, "pinyin": e["pinyin"] if e else None,
                    "reason4b": issues.get(k, {}).get("reason"),
                    "measured": bool(v), **({"flags": v["flags"], "S": v["S"], "syl": [[s["exp"], s["pred"], s["d"], s["r"], s.get("g")] for s in v["syl"]],
                                             "tech": v.get("tech")} if v else {})}
    flagged_ids = sorted(k for k, v in per_file.items() if v["flags"])
    report = {"version": 1, "scorer": SCORER_VERSION, "manifestVersion": man["version"], "voiceMedianSt": med,
              "classifier": "gbm-konteks (ronde 2)" if judge else "mlp ronde 1", "aligned": sum(1 for v in per_file.values() if v.get("al")),
              "thresholds": {"conf": FLAG_CONF, "range": FLAG_RANGE, "verification": thr},
              "groups": BASICS_GROUPS, "byGroup": m_grp, "byClass": m_cls, "standard": standard_table(m_cls, tpl),
              "standardByGroup": standard_table(m_grp, tpl),
              "whisper1a": {"passed": man["whisper"]["passed"], "total": man["whisper"]["total"], "baseline4b": 0.963,
                            "source": "manifest basics (4b/0); tidak dijalankan ulang di ronde 2"},
              "knownBad": known, "flaggedIds": flagged_ids, "skipped": skipped, "unmeasured": sorted(k for k in man["files"] if k not in meas),
              "files": report_files(per_file)}
    Path(a.out).write_text(json.dumps(report, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    log(json.dumps(report["standard"], ensure_ascii=False, indent=1))
    log(f"[basics] {len(per_file)} file; ditandai {len(flagged_ids)}; tidak terukur {report['unmeasured']}")


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("score")
    s.add_argument("--cache", default=None)
    s.add_argument("--only", nargs="*")
    s.add_argument("--procs", type=int, default=4)
    s.add_argument("--out", default=str(DATA / "audio-tone-report.json"))
    s.add_argument("--legacy", action="store_true", help="pakai pengenal MLP ronde 1 (tanpa GBM konteks)")
    s.set_defaults(fn=cmd_score)
    b = sub.add_parser("basics")
    b.add_argument("--cache", default=None)
    b.add_argument("--procs", type=int, default=4)
    b.add_argument("--out", default=str(ROOT / "data" / "basics" / "audio-tone-report.json"))
    b.add_argument("--legacy", action="store_true")
    b.set_defaults(fn=cmd_basics)
    a = ap.parse_args()
    a.fn(a)


if __name__ == "__main__":
    main()
