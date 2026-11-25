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
"""
from __future__ import annotations

import argparse
import json
import sys
import tempfile
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE))
import tone_analysis as ta  # noqa: E402

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


def score_syllables(meas: dict, med: float, tpl: dict, voice_gain: float = 0.0) -> list[dict]:
    """Per suku kata: nada diharapkan, nada dikenali, peluang, jarak DTW ke templat, rasio rentang, durasi, pendek?"""
    model = tpl["classifier"]["model"]
    tones = [s["tone"] for s in meas["syl"]]
    nx = ta.next_tones(tones)
    cls = ta.length_class(len(tones))
    out = []
    for i, s in enumerate(meas["syl"]):
        t = s["tone"]
        rec = {"exp": t, "d": s["d"], "r": s["r"], "pred": None, "p": None, "dist": None, "rr": None, "short": False}
        lim = short_limit(tpl, cls, t if t else 0)
        if lim is not None and s["d"] < lim:
            rec["short"] = True
        if s["c"] is not None and t in (1, 2, 3, 4):
            c_rel = np.asarray(s["c"]) - med
            pred, probs = ta.clf_predict(model, ta.clf_features(c_rel, s["vd"]))
            rec["pred"], rec["p"] = pred, probs[t - 1]
            tm = get_template(tpl, t, nx[i])
            if tm:
                rec["dist"] = round(ta.dtw(c_rel, tm), 2)
            st = get_stat(tpl, cls, t)
            if st and st["range"].get("p50"):
                rec["rr"] = round(s["r"] / st["range"]["p50"], 2)
        elif t in (1, 2, 3, 4):
            rec["pred"], rec["p"] = 0, 0.0  # tak ada bagian bersuara: dianggap salah
        out.append(rec)
    return out


def file_summary(syl: list[dict]) -> dict:
    tone_syl = [s for s in syl if s["exp"] in (1, 2, 3, 4)]
    n = len(tone_syl)
    wrong = sum(1 for s in tone_syl if s["pred"] != s["exp"])
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

def measure_item(args):
    key, path, tones = args
    try:
        import tempfile as tf

        with tf.TemporaryDirectory() as d:
            m = ta.analyze_file(Path(path), tones, Path(d) / "x.wav")
    except Exception as e:  # noqa: BLE001
        return key, None, f"{type(e).__name__}: {e}"
    return key, m, None


def measure_all(only: set[str] | None, cache: Path | None, procs: int):
    manifest = json.loads((AUDIO / "manifest.json").read_text(encoding="utf-8"))
    items = {i["key"]: i for i in json.loads((DATA / "audio-items.json").read_text(encoding="utf-8"))["items"]}
    words, casual = load_lookup()
    cached = json.loads(cache.read_text(encoding="utf-8")) if cache and cache.exists() else {}
    jobs, skipped = [], {}
    for key, e in manifest["files"].items():
        if only and e["kind"] not in only:
            continue
        sig = f"{e['hash']}|{e.get('tuning', {}).get('method', '')}|{e.get('tuning', {}).get('sha', '')}"
        if key in cached and cached[key].get("sig") == sig:
            continue
        tones = item_tones(items[key], words, casual)
        if not tones:
            skipped[key] = "tanpa nada (angka/non-Han)"
            continue
        jobs.append((key, str(AUDIO / e["path"]), tones))
    log(f"[score] {len(jobs)} file diukur ({len(cached)} dari cache, {len(skipped)} dilewati)")
    from multiprocessing import Pool

    with Pool(procs) as p:
        for n, (key, m, err) in enumerate(p.imap_unordered(measure_item, jobs, chunksize=8), 1):
            e = manifest["files"][key]
            sig = f"{e['hash']}|{e.get('tuning', {}).get('method', '')}|{e.get('tuning', {}).get('sha', '')}"
            cached[key] = {"sig": sig, "m": m, "err": err}
            if n % 200 == 0:
                log(f"[score] {n}/{len(jobs)}")
                if cache:
                    cache.write_text(json.dumps(cached, separators=(",", ":")), encoding="utf-8")
    if cache:
        cache.write_text(json.dumps(cached, separators=(",", ":")), encoding="utf-8")
    return manifest, items, cached, skipped


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
    per_file = {}
    for k, m in meas.items():
        e = manifest["files"][k]
        syl = score_syllables(m, med[e["voice"]], tpl)
        per_file[k] = {"syl": syl, **file_summary(syl)}
    failed = {k: v["err"] for k, v in cached.items() if v.get("err")}
    unmeasured = [k for k in manifest["files"] if k not in meas]
    report = {"version": 1, "manifestVersion": manifest["version"], "voiceMedianSt": med, "templatesRefs": tpl["refsUsed"],
              "thresholds": {"conf": FLAG_CONF, "range": FLAG_RANGE, "sentShortFactor": SENT_SHORT_FACTOR},
              "summary": summarize(per_file, manifest), "unmeasured": sorted(unmeasured),
              "files": {k: {"S": v["S"], "acc": v["acc"], "conf": v["conf"], "rr": v["rr"], "dist": v["dist"], "short": v["short"],
                            "flags": v["flags"],
                            "syl": [[s["exp"], s["pred"], s["d"], s["r"]] for s in v["syl"]]} for k, v in sorted(per_file.items())}}
    Path(a.out).write_text(json.dumps(report, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    log(json.dumps(report["summary"], ensure_ascii=False, indent=1))
    log(f"[score] {len(per_file)} file; tidak terukur {len(unmeasured)}; galat {len(failed)}")


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("score")
    s.add_argument("--cache", default=None)
    s.add_argument("--only", nargs="*")
    s.add_argument("--procs", type=int, default=4)
    s.add_argument("--out", default=str(DATA / "audio-tone-report.json"))
    s.set_defaults(fn=cmd_score)
    a = ap.parse_args()
    a.fn(a)


if __name__ == "__main__":
    main()
