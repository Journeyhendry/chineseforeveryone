#!/usr/bin/env python3
"""Task 4c · D. Perbaiki nada/durasi file P3/L3 yang berbendera; ganti hanya bila skor membaik dan Whisper tetap lolos.

Suara tidak diganti (P3 zf_001 / L3 zm_010). Hanya file yang SUDAH ada diolah ulang dengan Praat Manipulation (PSOLA):
  nada   : kontur F0 tiap suku kata digeser ke templat penutur asli (tone-templates.json) sebesar `strength`
           (0..1), lalu rentang nada dilebarkan <= WIDEN_MAX; mode "level" (kata, 1-4 suku kata: tinggi templat
           relatif median suara) atau "shape" (kalimat: hanya bentuk, tinggi tetap di tinggi lokal);
  durasi : suku kata yang lebih pendek dari target (p10 rujukan; 1.0 x p5 untuk kalimat) dipanjangkan lewat DurationTier,
           maksimum STRETCH_MAX x.
Kandidat: strength 0.5 / 0.75 / 1.0; dipilih yang SKOR-nya (tone_score.combined_score) tertinggi, tetapi kekuatan terkecil
yang skornya >= terbaik - TIE. Hasil dienkode ulang (loudnorm -16 LUFS, mono 64 kbps, 24 kHz) lalu DIUKUR ULANG dari mp3.

  rebuild_tone.py plan [--sentences N] [--control N]        cetak daftar shard (JSON, untuk matrix)
  rebuild_tone.py shard --shard I --shards N --work DIR     buat + ukur + cek Whisper; tulis DIR/out
  rebuild_tone.py merge --inputs DIR...                     pasang pemenang di public/audio/hsk1, perbarui manifest
  rebuild_tone.py local --keys K...                         uji lokal tanpa Whisper (tulis ke --work, tidak mengubah repo)

PERHATIAN: menjalankan ulang build-audio.yml dengan retry_failed/recheck dapat membuat ulang file dan menimpa hasil
penyetelan ini (hash item tidak berubah, jadi file yang LOLOS tidak disentuh; hanya yang gagal Whisper bisa diganti).
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import shutil
import sys
import time
import traceback
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(ROOT / "scripts" / "tts"))

import tone_analysis as ta  # noqa: E402
import tone_score as ts  # noqa: E402

DATA = ROOT / "data" / "hsk1"
AUDIO = ROOT / "public" / "audio" / "hsk1"
STRENGTHS = (0.5, 0.75, 1.0)
TIE = 0.01
WIDEN_MAX = 1.5          # rentang nada paling besar 1.5x (batas aman, tidak seperti robot)
SHIFT_CAP = 7.0          # geseran F0 per bingkai paling besar (semitone)
STRETCH_MAX = 1.5        # pemanjangan suku kata paling besar
SENT_SHORT_TARGET = 1.0  # kalimat: target = p5 kelas "word" x SENT_SHORT_FACTOR x ini (sama dengan batas bendera)
MIN_GAIN = 0.02
SENT_MIN_GAIN = 0.10  # kalimat: hanya diganti bila skor naik jelas (>= 0.10); tanpa telinga, metode ini belum terbukti aman di kalimat
SAMPLE_RATE = 24000
PRIORITY = {"word": 0, "word-slow": 1, "casual": 2, "casual-slow": 3, "dialog": 4, "sentence": 5}


def log(*a):
    print(*a, file=sys.stderr, flush=True)


def load_json(p: Path):
    return json.loads(p.read_text(encoding="utf-8"))


# --------------------------------------------------------------------------
# Kontur target dan faktor durasi (murni)
# --------------------------------------------------------------------------

def target_track(st, times, syl, tpl, med, strength, mode, cls="word"):
    """Jalur F0 baru (semitone absolut) untuk bingkai bersuara tiap suku kata bernada 1-4. Bingkai lain tetap."""
    new = np.array(st, dtype=float)
    tones = [s["tone"] for s in syl]
    nx = ta.next_tones(tones)
    for i, s in enumerate(syl):
        t = s["tone"]
        if t not in (1, 2, 3, 4) or s["c"] is None:
            continue
        tm = ts.get_template(tpl, t, nx[i])
        if not tm:
            continue
        idx = np.where((times >= s["t0"] - 1e-9) & (times < s["t1"] - 1e-9) & ~np.isnan(st))[0]
        if len(idx) < ta.MIN_VOICED_FRAMES:
            continue
        v0, v1 = times[idx[0]], times[idx[-1]]
        u = (times[idx] - v0) / max(v1 - v0, 1e-6)
        cur = st[idx]
        tm = np.asarray(tm, dtype=float)
        shape = np.interp(u, np.linspace(0, 1, len(tm)), tm)
        if mode == "level":
            tgt = shape + med
        else:  # shape: bentuk templat di tinggi lokal
            tgt = shape - shape.mean() + cur.mean()
        out = cur + strength * (tgt - cur)
        m = out.mean()
        # pelebaran rentang ke median rentang rujukan (kelas+nada); sudah >= 95 % -> tidak diperlebar
        stat = ts.get_stat(tpl, cls, t)
        tpl_rng = float(stat["range"]["p50"]) if stat and stat["range"].get("p50") else float(tm.max() - tm.min())
        got = float(out.max() - out.min())
        if got > 1e-6 and got < 0.95 * tpl_rng:
            g = min(WIDEN_MAX, 1 + strength * (tpl_rng / got - 1))
            out = m + g * (out - m)
        out = cur + np.clip(out - cur, -SHIFT_CAP, SHIFT_CAP)
        new[idx] = out
    return new


def stretch_factors(syl, tpl, cls):
    """Faktor pemanjangan per suku kata (1.0 = tetap): target = p10 rujukan (p5 x faktor untuk kalimat)."""
    out = []
    for s in syl:
        t = s["tone"]
        st = ts.get_stat(tpl, cls, t)
        f = 1.0
        if st and "p10" in st["dur"] and s["d"] > 0:
            tgt = st["dur"]["p10"] if cls != "sent" else st["dur"]["p5"] * ts.SENT_SHORT_FACTOR * SENT_SHORT_TARGET
            if s["d"] < tgt:
                f = min(STRETCH_MAX, tgt / s["d"])
        out.append(round(f, 3))
    return out


def smooth(x: np.ndarray, k: int = 2) -> np.ndarray:
    pad = np.pad(x, k, mode="edge")
    return np.convolve(pad, np.ones(2 * k + 1) / (2 * k + 1), mode="valid")


# --------------------------------------------------------------------------
# Praat
# --------------------------------------------------------------------------

def resynth(src_wav: Path, dst_wav: Path, times, new_st, orig_st, syl, factors, med_hz: float):
    import parselmouth
    from parselmouth.praat import call

    snd = parselmouth.Sound(str(src_wav))
    floor, ceil = max(50.0, med_hz * 0.6), min(700.0, med_hz * 1.9)
    manip = call(snd, "To Manipulation", 0.01, floor, ceil)
    tier = call(manip, "Extract pitch tier")
    call(tier, "Remove points between", snd.xmin, snd.xmax)
    # kontur yang diubah dihaluskan 5 bingkai di bingkai bersuara; bingkai tak berubah tidak disentuh
    idx = np.where(~np.isnan(new_st))[0]
    vals = new_st[idx].copy()
    sm = smooth(vals, 1)
    changed = np.abs(new_st[idx] - orig_st[idx]) > 1e-9
    for j, i in enumerate(idx):
        v = sm[j] if changed[max(0, j - 1): j + 2].any() else vals[j]
        call(tier, "Add point", float(times[i]), float(100.0 * 2 ** (v / 12)))
    call([tier, manip], "Replace pitch tier")
    if any(f > 1.0 + 1e-6 for f in factors):
        dtier = call(manip, "Extract duration tier")
        call(dtier, "Remove points between", snd.xmin, snd.xmax)
        F = np.ones(len(times))
        for s, f in zip(syl, factors):
            F[(times >= s["t0"] - 1e-9) & (times < s["t1"] - 1e-9)] = f
        F = smooth(F, 2)
        for t, f in zip(times, F):
            call(dtier, "Add point", float(t), float(f))
        call([dtier, manip], "Replace duration tier")
    out = call(manip, "Get resynthesis (overlap-add)")
    out.save(str(dst_wav), "WAV")


# --------------------------------------------------------------------------
# Satu file
# --------------------------------------------------------------------------

class Env:
    def __init__(self, work: Path):
        self.tpl = load_json(DATA / "tone-templates.json")
        self.report = load_json(DATA / "audio-tone-report.json")
        self.manifest = load_json(AUDIO / "manifest.json")
        self.items = {i["key"]: i for i in load_json(DATA / "audio-items.json")["items"]}
        self.words, self.casual = ts.load_lookup()
        self.med = self.report["voiceMedianSt"]
        self.work = work
        work.mkdir(parents=True, exist_ok=True)


def score_wav(env: Env, wav: Path, tones, voice: str):
    snd = ta.load_sound(wav, env.work / "m.wav", sr=16000)
    times, st, inten = ta.track(snd)
    meas = ta.measure(times, st, inten, tones)
    if meas is None:
        return None
    syl = ts.score_syllables(meas, env.med[voice], env.tpl)
    return {**ts.file_summary(syl), "syl": syl}


def candidates(env: Env, key: str, strengths=STRENGTHS):
    """Hasil: (before, [(strength, wav, summary)]) -- before = ukuran file asli dengan kode yang sama."""
    it, e = env.items[key], env.manifest["files"][key]
    tones = ts.item_tones(it, env.words, env.casual)
    src = AUDIO / e["path"]
    voice = e["voice"]
    w = env.work / "src24.wav"
    snd24 = ta.load_sound(src, w, sr=24000)
    times, st, inten = ta.track(snd24)
    meas = ta.measure(times, st, inten, tones)
    if meas is None:
        raise RuntimeError("tidak terukur")
    med = env.med[voice]
    before_syl = ts.score_syllables(meas, med, env.tpl)
    before = {**ts.file_summary(before_syl), "syl": before_syl}
    cls = ta.length_class(len(tones))
    mode = "shape" if cls == "sent" else "level"
    factors = stretch_factors(meas["syl"], env.tpl, cls)
    med_hz = 100 * 2 ** (med / 12)
    out = []
    for s in strengths:
        new_st = target_track(st, times, meas["syl"], env.tpl, med, s, mode, cls)
        dst = env.work / f"cand-{s}.wav"
        resynth(w, dst, times, new_st, st, meas["syl"], factors, med_hz)
        sm = score_wav(env, dst, tones, voice)
        if sm:
            out.append((s, dst, sm))
    return before, out, {"mode": mode, "stretch": max(factors) if factors else 1.0}


def pick(before: dict, cands: list, min_gain: float = MIN_GAIN):
    """Kandidat terbaik: skor tertinggi, lalu kekuatan terkecil dengan skor >= terbaik - TIE; harus lolos ts.better."""
    ranked = ranked_candidates(before, cands, min_gain)
    return ranked[0] if ranked else None


def ranked_candidates(before: dict, cands: list, min_gain: float = MIN_GAIN) -> list:
    """Semua kandidat yang lolos ts.better, urutan percobaan: pilihan utama (lihat pick), lalu sisanya skor menurun."""
    ok = [c for c in cands if ts.better(c[2], before, min_gain)]
    if not ok:
        return []
    top = max(c[2]["S"] for c in ok)
    first = min((c for c in ok if c[2]["S"] >= top - TIE), key=lambda c: c[0])
    return [first] + sorted((c for c in ok if c is not first), key=lambda c: -c[2]["S"])


def encode(wav: Path, dst: Path, tmp: Path):
    import make_samples as ms

    ms.normalize(wav, dst, tmp)
    return ms.duration(dst)


# --------------------------------------------------------------------------
# plan
# --------------------------------------------------------------------------

def make_plan(report: dict, manifest: dict, sentences: int, control: int, limit: int | None = None) -> list[str]:
    files = report["files"]
    flagged = [k for k, v in files.items() if v["flags"] and not manifest["files"][k].get("tuning")]

    def rank(k):
        return (PRIORITY.get(manifest["files"][k]["kind"], 9), files[k]["S"], k)

    chosen = sorted((k for k in flagged if manifest["files"][k]["kind"] != "sentence"), key=rank)
    sent = sorted((k for k in flagged if manifest["files"][k]["kind"] == "sentence"), key=rank)[:sentences]
    ctrl_pool = [k for k in files if not files[k]["flags"] and manifest["files"][k]["kind"] != "sentence"
                 and not manifest["files"][k].get("tuning")]
    ctrl = sorted(ctrl_pool, key=lambda k: hashlib.sha1(k.encode()).hexdigest())[:control]
    plan = chosen + sent + ctrl
    limit = int(os.environ.get("FIX_LIMIT", "0")) if limit is None else limit
    if limit:  # uji asap: campuran tiap jenis (berselang-seling), bukan hanya kata
        step = max(1, len(plan) // limit)
        plan = plan[::step][:limit]
    return plan


def cmd_plan(a):
    report, manifest = load_json(DATA / "audio-tone-report.json"), load_json(AUDIO / "manifest.json")
    plan = make_plan(report, manifest, a.sentences, a.control)
    per = a.per_shard
    n = min(a.max_shards, max(1, math.ceil(len(plan) / per))) if plan else 0
    log(f"[plan] {len(plan)} file ({n} shard)")
    print(json.dumps({"count": len(plan), "shards": list(range(n)), "total": n}))


# --------------------------------------------------------------------------
# shard (dengan Whisper)
# --------------------------------------------------------------------------

def process(env: Env, key: str, out_dir: Path, ctx=None) -> dict:
    """Satu file: kandidat -> (urut) encode -> ukur ulang -> Whisper; kandidat pertama yang lolos semuanya dipakai."""
    before, cands, info = candidates(env, key)
    it, e = env.items[key], env.manifest["files"][key]
    gain = SENT_MIN_GAIN if it["kind"] == "sentence" else MIN_GAIN
    ranked = ranked_candidates(before, cands, gain)
    res = {"key": key, "before": {k: before[k] for k in ("S", "acc", "conf", "rr", "dist", "short", "flags")},
           "candidates": {str(c[0]): {k: c[2][k] for k in ("S", "acc", "conf", "rr", "short")} for c in cands}, **info}
    if not ranked:
        res["decision"] = "tetap (tidak ada kandidat yang lebih baik)"
        return res
    tones = ts.item_tones(it, env.words, env.casual)
    notes = []
    for s, wav, _ in ranked[:3]:
        mp3 = out_dir / (key + ".mp3")
        mp3.parent.mkdir(parents=True, exist_ok=True)
        dur = encode(wav, mp3, env.work)
        snd = ta.load_sound(mp3, env.work / "m.wav", sr=16000)
        times, st, inten = ta.track(snd)
        meas = ta.measure(times, st, inten, tones)
        if not meas:
            mp3.unlink(missing_ok=True)
            notes.append(f"{s}: mp3 tidak terukur")
            continue
        after = ts.file_summary(ts.score_syllables(meas, env.med[e["voice"]], env.tpl))
        if not ts.better(after, before, gain):
            mp3.unlink(missing_ok=True)
            notes.append(f"{s}: setelah enkode skor tidak lebih baik")
            continue
        res["strength"], res["durationSec"] = s, dur
        res["after"] = {k: after[k] for k in ("S", "acc", "conf", "rr", "dist", "short", "flags")}
        if ctx is not None:
            import build_audio as ba

            cand = ba.evaluate(ctx, it, mp3, it["speed"])
            res["whisper"] = {"ok": cand["ok"], "transcript": cand["transcript"], "check": cand["check"], "via": cand["via"]}
            if not cand["ok"]:
                mp3.unlink(missing_ok=True)
                notes.append(f"{s}: Whisper tidak lolos ('{cand['transcript']}')")
                res.pop("whisper")
                continue
            res["durationSec"] = cand["dur"]
        res["decision"] = "ganti"
        if notes:
            res["triedBefore"] = notes
        return res
    res.pop("after", None)
    res.pop("strength", None)
    res["decision"] = "tetap (" + "; ".join(notes) + ")"
    return res


def cmd_shard(a):
    env = Env(Path(a.work) / "tmp")
    plan = make_plan(env.report, env.manifest, a.sentences, a.control)[a.shard::a.shards]
    out = Path(a.work) / "out"
    shutil.rmtree(out, ignore_errors=True)
    (out / "mp3").mkdir(parents=True)
    log(f"[shard {a.shard}/{a.shards}] {len(plan)} file")
    ctx = None
    if not a.no_whisper:
        import build_audio as ba

        ctx = ba.Ctx(Path(a.work))
    results, t0 = [], time.time()
    budget = float(os.environ.get("SHARD_BUDGET_MIN", "100")) * 60
    for n, key in enumerate(plan, 1):
        if time.time() - t0 > budget:
            log(f"[shard] batas waktu; sisa {len(plan) - n + 1} file")
            break
        try:
            r = process(env, key, out / "mp3", ctx)
        except Exception as e:  # noqa: BLE001
            traceback.print_exc()
            r = {"key": key, "decision": f"tetap (galat: {type(e).__name__}: {str(e)[:120]})"}
        results.append(r)
        b, af = r.get("before", {}), r.get("after", {})
        log(f"  {n}/{len(plan)} {key}: {r['decision']} S {b.get('S')} -> {af.get('S')} acc {b.get('acc')} -> {af.get('acc')}"
            f" short {b.get('short')} -> {af.get('short')}")
        (out / "results.json").write_text(json.dumps(results, ensure_ascii=False, indent=1), encoding="utf-8")
    meta = {"whisperRevision": getattr(ctx, "whisper_rev", None)} if ctx else {}
    (out / "meta.json").write_text(json.dumps(meta), encoding="utf-8")


# --------------------------------------------------------------------------
# merge
# --------------------------------------------------------------------------

def cmd_merge(a):
    import hsk1_items  # noqa: E402
    import make_samples as ms

    manifest = load_json(AUDIO / "manifest.json")
    files = manifest["files"]
    replaced, kept, ctrl_note = 0, 0, {}
    log_rows = []
    for d in a.inputs:
        d = Path(d)
        rp = d / "results.json"
        if not rp.exists():
            continue
        for r in load_json(rp):
            k = r["key"]
            if r["decision"] != "ganti" or k not in files:
                kept += 1
                log_rows.append(r)
                continue
            mp3 = d / "mp3" / (k + ".mp3")
            if not mp3.exists():
                continue
            e = files[k]
            dst = AUDIO / e["path"]
            before_size = dst.stat().st_size
            shutil.copy(mp3, dst)
            e["durationSec"] = r.get("durationSec", ms.duration(dst))
            w = r.get("whisper")
            if w:
                e["transcript"], e["ok"], e["check"], e["via"] = w["transcript"], w["ok"], w["check"], w["via"]
                e.pop("carrierTranscript", None)
                e.pop("x3Transcript", None)
            e["tuning"] = {"method": "psola-tone-4c", "strength": r["strength"], "mode": r["mode"], "stretch": r["stretch"],
                           "before": r["before"], "after": r["after"], "sha": hashlib.sha1(dst.read_bytes()).hexdigest()[:10],
                           "bytesBefore": before_size}
            replaced += 1
            log_rows.append(r)
    wh = manifest["whisper"]
    by_kind = {}
    for e in files.values():
        b = by_kind.setdefault(e["kind"], {"passed": 0, "total": 0})
        b["total"] += 1
        b["passed"] += 1 if e["ok"] else 0
    wh["byKind"] = {k: by_kind[k] for k in hsk1_items.KINDS}
    wh["passed"] = sum(b["passed"] for b in by_kind.values())
    wh["total"] = sum(b["total"] for b in by_kind.values())
    wh["wordsPassed"], wh["wordsTotal"] = by_kind["word"]["passed"], by_kind["word"]["total"]
    manifest["version"] = manifest["version"] + 1 if replaced else manifest["version"]
    manifest["tuning"] = {"task": "4c", "replaced": sum(1 for e in files.values() if e.get("tuning")),
                          "note": "file ber-`tuning` disetel nadanya (PSOLA) oleh tone-fix.yml; build-audio.yml dengan "
                                  "retry_failed/recheck dapat menimpa hanya file yang gagal Whisper."}
    (AUDIO / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    idx_p = AUDIO / "index.json"
    idx = load_json(idx_p)
    idx["v"] = manifest["version"]
    idx_p.write_text(json.dumps(idx, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    (DATA / "tone-fix-log.json").write_text(json.dumps(
        {"version": 1, "replaced": sum(1 for e in files.values() if e.get("tuning")),
         "results": [{k: v for k, v in r.items() if k in ("key", "decision", "strength", "mode", "stretch", "before", "after", "whisper", "candidates")}
                     for r in log_rows]}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    log(f"[merge] diganti {replaced}, tetap {kept}; manifest versi {manifest['version']}; Whisper {wh['passed']}/{wh['total']}")


def cmd_local(a):
    env = Env(Path(a.work))
    for key in a.keys:
        r = process(env, key, Path(a.work) / "out", None)
        log(json.dumps({k: v for k, v in r.items() if k != "candidates"}, ensure_ascii=False))
        log("   kandidat:", json.dumps(r.get("candidates", {})))


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    for name, fn in (("plan", cmd_plan), ("shard", cmd_shard), ("merge", cmd_merge), ("local", cmd_local)):
        s = sub.add_parser(name)
        s.add_argument("--sentences", type=int, default=int(os.environ.get("FIX_SENTENCES", "0")))
        s.add_argument("--control", type=int, default=int(os.environ.get("FIX_CONTROL", "80")))
        s.add_argument("--per-shard", type=int, default=40)
        s.add_argument("--max-shards", type=int, default=12)
        s.add_argument("--shard", type=int, default=0)
        s.add_argument("--shards", type=int, default=1)
        s.add_argument("--work", default="/tmp/tone-fix")
        s.add_argument("--no-whisper", action="store_true")
        s.add_argument("--inputs", nargs="*", default=[])
        s.add_argument("--keys", nargs="*", default=[])
        s.set_defaults(fn=fn)
    a = ap.parse_args()
    a.fn(a)


if __name__ == "__main__":
    main()
