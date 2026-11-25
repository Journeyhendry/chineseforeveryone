#!/usr/bin/env python3
"""Task 4c · E. public/samples-tone.html: sebelum vs sesudah (telinga pemilik), dengan grafik kontur dan angka.

  python3 scripts/tts-hsk1/build_samples_tone.py [--before-ref origin/main]

* "Sebelum" = file di cabang acuan (git show <ref>:public/audio/hsk1/...), disalin ke public/audio/tone-samples/before/
  hanya untuk file yang berubah (maks ~30). "Sesudah" = file yang dipakai situs sekarang.
* Item tidak berubah (kontrol / tidak lolos syarat) tetap ditampilkan satu tombol + grafik: pemilik bisa menilai apakah
  suara yang tidak disentuh perlu disentuh.
* Tahap 0 (public/audio/basics): ditampilkan apa adanya.
* Halaman mandiri (CSS/SVG inline, tanpa skrip selain tombol putar), label Indonesia, istilah teknis dijelaskan.
"""
from __future__ import annotations

import argparse
import html
import json
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE))
import tone_analysis as ta  # noqa: E402
import tone_score as ts  # noqa: E402

DATA = ROOT / "data" / "hsk1"
AUDIO = ROOT / "public" / "audio"
OUT = ROOT / "public" / "samples-tone.html"
BEFORE_DIR = AUDIO / "tone-samples" / "before"
MAX_ITEMS = 30
TONE_NAME = {0: "ringan", 1: "1", 2: "2", 3: "3", 4: "4"}


def log(*a):
    print(*a, file=sys.stderr, flush=True)


def git_show(ref: str, path: str) -> bytes | None:
    r = subprocess.run(["git", "-C", str(ROOT), "show", f"{ref}:{path}"], capture_output=True)
    return r.stdout if r.returncode == 0 else None


def measure(path: Path, tones, tmp: Path):
    snd = ta.load_sound(path, tmp / "m.wav", sr=16000)
    times, st, inten = ta.track(snd)
    return ta.measure(times, st, inten, tones)


# --------------------------------------------------------------------------
# Pemilihan item
# --------------------------------------------------------------------------

def choose(manifest, items, words, casual, report):
    """~30 item: tiap nada tunggal, nada ringan, pasangan nada, 3+3, 不/一, kalimat, ungkapan, dialog."""
    rows = []
    for k, e in manifest["files"].items():
        it = items[k]
        tones = ts.item_tones(it, words, casual)
        if not tones or k not in report["files"]:
            continue
        rows.append({"key": k, "kind": e["kind"], "text": e["text"], "tones": tones, "tuned": bool(e.get("tuning")),
                     "gain": (e.get("tuning", {}).get("after", {}).get("S", 0) - e.get("tuning", {}).get("before", {}).get("S", 0))
                     if e.get("tuning") else 0.0, "entry": e, "item": it})

    def best(pred, n=1, kinds=("word",)):
        c = [r for r in rows if r["kind"] in kinds and pred(r)]
        c.sort(key=lambda r: (-r["tuned"], -r["gain"], r["key"]))
        return c[:n]

    picks, seen = [], set()

    def add(label, rs):
        for r in rs:
            if r["key"] not in seen:
                seen.add(r["key"])
                picks.append({**r, "label": label})

    for t in (1, 2, 3, 4):
        add(f"Nada {t}, satu suku kata", best(lambda r, t=t: r["tones"] == [t]))
    add("Nada ringan", best(lambda r: r["tones"] == [0] or (len(r["tones"]) == 1 and r["tones"][0] == 0)))
    for t1 in (1, 2, 3, 4):
        for t2 in (1, 2, 3, 4):
            if (t1, t2) in ((1, 1), (2, 3), (3, 1), (4, 4), (1, 4), (2, 2), (4, 2)):
                add(f"Pasangan nada {t1}+{t2}", best(lambda r, a=t1, b=t2: len(r["tones"]) == 2 and r["tones"] == [a, b]))
    add("Nada 3 + nada 3 (berubah jadi 2+3)", best(lambda r: r["tones"][:2] == [2, 3] and len(r["tones"]) == 2 and "你" in r["text"]))
    add("Ada 不", best(lambda r: "不" in r["text"] and len(r["tones"]) <= 3, kinds=("word", "casual")))
    add("Ada 一", best(lambda r: "一" in r["text"] and len(r["tones"]) <= 5, kinds=("word", "casual", "sentence")))
    add("Kalimat pendek", best(lambda r: 4 <= len(r["tones"]) <= 7, n=4, kinds=("sentence",)))
    add("Ungkapan santai", best(lambda r: len(r["tones"]) >= 2, n=2, kinds=("casual",)))
    add("Baris dialog", best(lambda r: len(r["tones"]) >= 3, n=3, kinds=("dialog",)))
    add("Versi pelan", best(lambda r: len(r["tones"]) >= 2, n=1, kinds=("word-slow",)))
    return picks[:MAX_ITEMS]


def choose_basics(n: int = 4):
    p = AUDIO / "basics" / "manifest.json"
    if not p.exists():
        return []
    m = json.loads(p.read_text(encoding="utf-8"))
    out = []
    want = {1: None, 2: None, 3: None, 4: None}
    for k, e in sorted(m["files"].items()):
        if not k.startswith("py-") or not e.get("ok") or not e.get("pinyin"):
            continue
        t = ta.parse_marked(e["pinyin"].split()[0])[1]
        if t in want and want[t] is None:
            want[t] = (k, e, t)
    for t, v in want.items():
        if v:
            k, e, t = v
            out.append({"key": "basics-" + k, "kind": "tahap0", "text": e["hanzi"], "tones": [t], "path": f"basics/{e['path']}",
                        "label": f"Tahap 0 · nada {t} (apa adanya)", "pinyin": e["pinyin"], "tuned": False})
    return out[:n]


# --------------------------------------------------------------------------
# SVG
# --------------------------------------------------------------------------

W, H, PADL, PADR, PADT, PADB = 360, 130, 30, 8, 8, 18
YMIN, YMAX = -12.0, 12.0


def xy(t, st, tmax):
    x = PADL + (W - PADL - PADR) * (t / tmax)
    y = PADT + (H - PADT - PADB) * (1 - (st - YMIN) / (YMAX - YMIN))
    return x, y


def poly(meas, med, tmax, cls):
    """Garis kontur tiap suku kata (titik berjarak sama antara awal-akhir bersuara)."""
    lines = []
    for s in meas["syl"]:
        if not s.get("c") or "v0" not in s:
            continue
        c = np.asarray(s["c"]) - med
        ts_ = np.linspace(s["v0"], s["v0"] + s["vd"], len(c))
        pts = " ".join("%.1f,%.1f" % xy(t, float(np.clip(v, YMIN, YMAX)), tmax) for t, v in zip(ts_, c))
        lines.append((pts, s["tone"]))
    return lines


def template_lines(meas, med, tpl, tmax):
    tones = [s["tone"] for s in meas["syl"]]
    nx = ta.next_tones(tones)
    out = []
    for i, s in enumerate(meas["syl"]):
        if s["tone"] not in (1, 2, 3, 4) or not s.get("c") or "v0" not in s:
            continue
        tm = ts.get_template(tpl, s["tone"], nx[i])
        if not tm:
            continue
        ts_ = np.linspace(s["v0"], s["v0"] + s["vd"], len(tm))
        out.append(" ".join("%.1f,%.1f" % xy(t, float(np.clip(v, YMIN, YMAX)), tmax) for t, v in zip(ts_, tm)))
    return out


def chart(versions, tpl, med, tmax) -> str:
    """versions: [(label, meas, css-class)]; template digambar dari versi terakhir."""
    g = [f'<svg viewBox="0 0 {W} {H}" role="img" aria-label="Grafik tinggi nada (semitone) terhadap waktu">']
    for v in (-12, -6, 0, 6, 12):
        x0, y = xy(0, v, tmax)
        x1, _ = xy(tmax, v, tmax)
        g.append(f'<line x1="{x0:.1f}" y1="{y:.1f}" x2="{x1:.1f}" y2="{y:.1f}" class="grid{" mid" if v == 0 else ""}"/>')
        g.append(f'<text x="{PADL - 4}" y="{y + 3:.1f}" class="ax" text-anchor="end">{v:+d}</text>')
    g.append(f'<text x="{PADL}" y="{H - 3}" class="ax">0 dtk</text><text x="{W - PADR}" y="{H - 3}" class="ax" text-anchor="end">{tmax:.1f} dtk</text>')
    ref = versions[-1][1]
    for pts in template_lines(ref, med, tpl, tmax):
        g.append(f'<polyline points="{pts}" class="tpl"/>')
    for label, meas, cls in versions:
        for pts, tone in poly(meas, med, tmax, cls):
            g.append(f'<polyline points="{pts}" class="{cls}"/>')
        # batas suku kata (garis tipis) hanya untuk versi terakhir
    for s in ref["syl"]:
        x, _ = xy(s["t0"], 0, tmax)
        g.append(f'<line x1="{x:.1f}" y1="{PADT}" x2="{x:.1f}" y2="{H - PADB}" class="cut"/>')
    g.append("</svg>")
    return "".join(g)


# --------------------------------------------------------------------------
# HTML
# --------------------------------------------------------------------------

CSS = """
:root{--bg:#FFF7E8;--ink:#231942;--purple:#6741D9;--yellow:#FFD43B;--green:#2F9E44;--orange:#E8590C;--muted:#5C5470;--card:#fff;
--t1:#C92A2A;--t2:#B45309;--t3:#2B8A3E;--t4:#1864AB;--t5:#5C5470}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:"Nunito",system-ui,sans-serif;font-size:17px;line-height:1.5;overflow-wrap:anywhere}
.wrap{max-width:1100px;margin:0 auto;padding:24px 16px 64px}
h1,h2{font-family:"Baloo 2","Nunito",sans-serif;line-height:1.15;margin:0}h1{font-size:clamp(2rem,6vw,3rem);font-weight:800}h2{font-size:1.5rem;font-weight:800;margin:36px 0 8px}
.hanzi{font-family:"Noto Sans SC",sans-serif;font-weight:700}.en{color:var(--muted);font-size:.88rem}
.howto{background:var(--yellow);border:3px solid var(--ink);border-radius:20px;box-shadow:6px 6px 0 var(--ink);padding:16px 20px;margin-top:20px}.howto p{margin:0 0 6px}
.card{background:var(--card);border:3px solid var(--ink);border-radius:20px;box-shadow:6px 6px 0 var(--ink);padding:16px;margin-top:22px}
.row{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.6fr);gap:16px;align-items:start}@media(max-width:760px){.row{grid-template-columns:1fr}}
.title{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:baseline}.title .hanzi{font-size:1.8rem}.tag{font-size:.82rem;font-weight:800;border:2px solid var(--ink);border-radius:999px;padding:0 10px;background:var(--bg)}
.tag.ubah{background:var(--yellow)}
.btns{display:flex;flex-wrap:wrap;gap:10px;margin:10px 0}
button{font:inherit;color:var(--ink);cursor:pointer;background:var(--bg);border:3px solid var(--ink);border-radius:14px;padding:6px 14px;font-weight:800;box-shadow:3px 3px 0 var(--ink);min-height:44px}
button.after{background:var(--purple);color:#fff}button:focus-visible{outline:3px solid var(--orange);outline-offset:2px}
table{border-collapse:collapse;width:100%;min-width:520px;font-size:.88rem}th,td{border:2px solid var(--ink);padding:3px 8px;text-align:left}th{background:var(--bg)}
td.num{font-variant-numeric:tabular-nums}.good{color:var(--green);font-weight:800}.bad{color:var(--t1);font-weight:800}
svg{width:100%;height:auto;background:#fff;border:2px solid var(--ink);border-radius:12px}svg .grid{stroke:#d9d4e3;stroke-width:1}svg .mid{stroke:#9a93a8}
svg .ax{font-size:9px;fill:var(--muted)}svg .cut{stroke:#d9d4e3;stroke-dasharray:2 3;stroke-width:1}
svg polyline{fill:none;stroke-linejoin:round;stroke-linecap:round}svg .before{stroke:var(--orange);stroke-width:2.5}svg .afterl{stroke:var(--purple);stroke-width:3}svg .tpl{stroke:var(--green);stroke-width:2;stroke-dasharray:5 4}
.legend{font-size:.85rem;display:flex;flex-wrap:wrap;gap:4px 16px;margin-top:6px;flex-direction:column}.legend i{display:inline-block;width:22px;height:0;border-top:3px solid;vertical-align:middle;margin-right:4px}
"""


def tones_str(syl):
    return " ".join(str(s["exp"]) for s in syl)


def verdict_cell(syl):
    parts = []
    for s in syl:
        if s["exp"] not in (1, 2, 3, 4):
            continue
        ok = s["pred"] == s["exp"]
        parts.append(f'<span class="{"good" if ok else "bad"}">{s["exp"]}→{s["pred"] or "?"}</span>')
    return " ".join(parts) or "-"


def stats_table(rows) -> str:
    h = ("<table><tr><th></th><th>Nada dimaksud → dikenali pengukur</th><th>Rentang nada (rasio vs penutur asli)</th>"
         "<th>Durasi tiap suku kata (dtk)</th><th>Skor</th></tr>")
    for label, sm in rows:
        syl = sm["syl"]
        h += (f'<tr><td>{label}</td><td>{verdict_cell(syl)}</td><td class="num">{sm["rr"]:.2f}</td>'
              f'<td class="num">{" · ".join(f"{s["d"]:.2f}" + ("!" if s["short"] else "") for s in syl)}</td>'
              f'<td class="num">{sm["S"]:.2f}</td></tr>')
    return h + "</table>"


def card(r, idx, before_rel, after_rel, sm_b, sm_a, mb, ma, tpl, med) -> str:
    text = html.escape(r["text"])
    tmax = max(m["span"] + max(s["t0"] for s in m["syl"][:1]) + 0.1 for m in (mb, ma) if m) if (mb or ma) else 1.0
    tmax = max(tmax, max((m["syl"][-1]["t1"] for m in (mb, ma) if m), default=1.0)) + 0.05
    vers = []
    if mb:
        vers.append(("Sebelum", mb, "before"))
    vers.append(("Sesudah", ma, "afterl"))
    btns = ""
    if before_rel:
        btns += f'<button data-src="{before_rel}" aria-label="Putar versi sebelum">▶ Sebelum</button>'
    btns += f'<button class="after" data-src="{after_rel}" aria-label="Putar versi sesudah">▶ {"Sesudah" if before_rel else "Suara sekarang"}</button>'
    tag = '<span class="tag ubah">diubah</span>' if before_rel else '<span class="tag">tidak diubah</span>'
    pin = html.escape(r.get("pinyin", "") or "")
    rows = []
    if sm_b:
        rows.append(("Sebelum", sm_b))
    rows.append(("Sesudah" if sm_b else "Sekarang", sm_a))
    legend = ('<div class="legend">' + ('<span><i style="border-color:var(--orange)"></i>sebelum</span>' if mb else "")
              + '<span><i style="border-color:var(--purple)"></i>%s</span>' % ("sesudah" if mb else "suara sekarang")
              + '<span><i style="border-top-style:dashed;border-color:var(--green)"></i>rata-rata penutur asli</span></div>')
    return (f'<section class="card" id="i{idx}"><div class="title"><span class="hanzi">{text}</span><span>{pin}</span>'
            f'<span class="en">{html.escape(r["label"])} · nada: {" ".join(TONE_NAME[t] for t in r["tones"])}</span>{tag}</div>'
            f'<div class="row"><div><div class="btns">{btns}</div>{legend}</div><div>{chart(vers, tpl, med, tmax)}</div></div>'
            f'<div style="overflow-x:auto;margin-top:10px">{stats_table(rows)}</div></section>')


def build(args):
    tpl = json.loads((DATA / "tone-templates.json").read_text(encoding="utf-8"))
    report = json.loads((DATA / "audio-tone-report.json").read_text(encoding="utf-8"))
    manifest = json.loads((AUDIO / "hsk1" / "manifest.json").read_text(encoding="utf-8"))
    items = {i["key"]: i for i in json.loads((DATA / "audio-items.json").read_text(encoding="utf-8"))["items"]}
    words, casual = ts.load_lookup()
    med = report["voiceMedianSt"]
    picks = choose(manifest, items, words, casual, report)
    basics = choose_basics()
    BEFORE_DIR.mkdir(parents=True, exist_ok=True)
    for old in BEFORE_DIR.glob("*.mp3"):
        old.unlink()
    cards, tmp = [], Path(tempfile.mkdtemp())
    n = 0
    for r in picks:
        e = r["entry"]
        after = AUDIO / "hsk1" / e["path"]
        before_rel = None
        mb = sm_b = None
        voice = e["voice"]
        if r["tuned"]:
            data = git_show(args.before_ref, f"public/audio/hsk1/{e['path']}")
            if data:
                bp = BEFORE_DIR / (r["key"] + ".mp3")
                bp.write_bytes(data)
                before_rel = f"audio/tone-samples/before/{r['key']}.mp3"
                mb = measure(bp, r["tones"], tmp)
                if mb:
                    sm_b = {**ts.file_summary(ts.score_syllables(mb, med[voice], tpl))}
                    sm_b["syl"] = ts.score_syllables(mb, med[voice], tpl)
        ma = measure(after, r["tones"], tmp)
        if not ma:
            continue
        syl_a = ts.score_syllables(ma, med[voice], tpl)
        sm_a = {**ts.file_summary(syl_a), "syl": syl_a}
        n += 1
        r["pinyin"] = (r["item"].get("pinyin") or "")
        cards.append(card(r, n, before_rel, f"audio/hsk1/{e['path']}", sm_b, sm_a, mb, ma, tpl, med[voice]))
    for r in basics:
        ap = AUDIO / r["path"]
        if not ap.exists():
            continue
        ma = measure(ap, r["tones"], tmp)
        if not ma:
            continue
        syl_a = ts.score_syllables(ma, med["P3"], tpl)
        sm_a = {**ts.file_summary(syl_a), "syl": syl_a}
        n += 1
        cards.append(card(r, n, None, f"audio/{r['path']}", None, sm_a, None, ma, tpl, med["P3"]))
    changed = sum(1 for c in cards if "diubah</span>" in c and "tidak diubah" not in c)
    doc = f"""<!doctype html>
<html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sebelum dan sesudah · Xué Mandarin</title><meta name="robots" content="noindex"><link rel="icon" href="favicon.svg" type="image/svg+xml">
<link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;800&family=Nunito:wght@400;700;800&family=Noto+Sans+SC:wght@400;700&display=swap" rel="stylesheet">
<style>{CSS}</style></head><body><div class="wrap">
<h1>Sebelum dan sesudah: nada suara</h1>
<div class="howto"><p><strong>Tolong dengarkan</strong> tombol "Sebelum" lalu "Sesudah" tiap baris, dan putuskan: apakah nadanya lebih jelas dan tidak terdengar rusak/seperti robot?
Suara tetap P3 (perempuan) dan L3 (laki-laki); yang disetel hanya tinggi-rendah nada dan panjang suku kata.</p>
<p class="en">Please listen to "Sebelum" (before) then "Sesudah" (after) in each row and decide whether the tones are clearer and still natural. The voices are unchanged (P3, L3); only pitch contour and syllable length were adjusted.</p>
<p>Cara membaca grafik: garis naik-turun = tinggi-rendah suara (semitone, 0 = tinggi suara biasa penutur itu). Garis hijau putus-putus = rata-rata rekaman penutur asli untuk nada yang sama.
Angka "dikenali" = hasil pengukur otomatis (bukan telinga manusia). Tanda "!" = suku kata lebih pendek dari 95% rekaman penutur asli.</p>
<p class="en">{n} items; {changed} changed, the rest are left untouched (shown so you can judge those too). Claude cannot hear audio: these numbers are a proxy, your ears decide.</p></div>
{''.join(cards)}
<p class="en" style="margin-top:32px">Rujukan penutur asli: hugolpz/audio-cmn (CC BY-SA), Lingua Libre / Wikimedia Commons (CC0 / CC BY / CC BY-SA). Lihat Sumber.</p>
</div>
<script>
(function(){{var cur=null,curBtn=null;document.addEventListener('click',function(ev){{var b=ev.target.closest('button[data-src]');if(!b)return;
if(cur){{cur.pause();cur=null;}}var a=new Audio(b.getAttribute('data-src'));cur=a;a.play().catch(function(){{}});}});}})();
</script></body></html>
"""
    OUT.write_text(doc, encoding="utf-8")
    sz = sum(p.stat().st_size for p in BEFORE_DIR.glob("*.mp3"))
    log(f"[samples] {n} item ({changed} diubah) -> {OUT.relative_to(ROOT)}; sebelum: {len(list(BEFORE_DIR.glob('*.mp3')))} file, {sz / 1e3:.0f} KB")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--before-ref", default="origin/main")
    build(ap.parse_args())


if __name__ == "__main__":
    main()
