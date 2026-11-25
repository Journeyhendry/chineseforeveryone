#!/usr/bin/env python3
"""Task 4c · A. Rujukan penutur asli untuk ukuran nada/durasi/rentang (hanya lisensi bebas).

Tidak ada audio mentah yang di-commit: tiap rekaman diunduh/di-checkout sementara, diukur
(tone_analysis.analyze_file), lalu hanya ukuran + metadata yang disimpan di data/hsk1/tone-refs.json.

Subperintah (dijalankan .github/workflows/tone-refs.yml; `cmn` dan `local-native` juga bisa lokal):
  cmn          hugolpz/audio-cmn (git): 64k/syllabs (1707 suku kata, Chen Wang) dan 64k/hsk (kata, Yue Tan); CC BY-SA
  ll           Lingua Libre / Commons (kategori "LL-Q9192 (cmn)-"), banyak penutur; --shard I --shards N
  local-native rekaman public/audio/native (hasil native_audio.py) yang sudah ada di repo, tanpa unduh
  tatoeba      cek segar: kalimat cmn berlisensi bebas yang punya audio (data lama: 0); bila ada, diukur
  commonvoice  cek: apakah Common Voice zh-CN bisa diunduh tanpa akun/kunci (hampir pasti tidak)
  merge        gabung semua bagian -> data/hsk1/tone-refs.json
"""
from __future__ import annotations

import argparse
import bz2
import io
import json
import re
import shutil
import subprocess
import sys
import tempfile
import time
import traceback
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(ROOT / "scripts" / "tts"))

import tone_analysis as ta  # noqa: E402

DATA = ROOT / "data" / "hsk1"
OUT = DATA / "tone-refs.json"
AUDIO_CMN_REPO = "https://github.com/hugolpz/audio-cmn.git"
UA = ("XueMandarinToneRefs/1.0 (https://github.com/Journeyhendry/chineseforeveryone; open-source Mandarin learning "
      "site; sequential low-rate fetch for pitch measurement only) Python-urllib/%d.%d" % sys.version_info[:2])
BUDGET_MIN = float(__import__("os").environ.get("REFS_BUDGET_MIN", "75"))
T0 = time.time()


def log(*a):
    print(*a, file=sys.stderr, flush=True)


def out_of_time(minutes: float | None = None) -> bool:
    return time.time() - T0 > (minutes or BUDGET_MIN) * 60


def write_out(path, text: str) -> None:
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text, encoding="utf-8")


def ref_record(rid: str, src: str, spk: str, text: str, tones: list[int], meas: dict, extra: dict | None = None) -> dict:
    syl = []
    for s in meas["syl"]:
        syl.append({"d": s["d"], "vd": s["vd"], "r": s["r"],
                    "c": [int(round(x * 10)) for x in s["c"]] if s["c"] else None})
    rec = {"id": rid, "src": src, "spk": spk, "text": text, "tones": tones, "span": meas["span"],
           "span_st": meas["span_st"], "syl": syl}
    rec.update(extra or {})
    return rec


def read_words() -> list[dict]:
    return json.loads((DATA / "words.json").read_text(encoding="utf-8"))


def tones_for_word(word: str, hsk: dict[str, list[int]]) -> list[int] | None:
    """Nada kata: data HSK 1 bila ada (sandhi resmi), kalau tidak pypinyin; None bila bacaan ambigu."""
    if word in hsk:
        return ta.apply_third_tone_sandhi(hsk[word])
    from pypinyin import Style, pinyin

    for ph in pinyin(word, style=Style.TONE3, heteronym=True, neutral_tone_with_five=True):
        tones = {re.sub(r"[^0-5]", "", x)[-1:] for x in ph}
        if len(tones) > 1:
            return None
    return ta.expected_tones_from_text(word)


def hsk_tone_table() -> dict[str, list[int]]:
    return {w["hanzi"]: ta.expected_tones_from_numbered(w["pinyinNumbered"]) for w in read_words()}


# --------------------------------------------------------------------------
# audio-cmn
# --------------------------------------------------------------------------

def git(*args, cwd=None, check=True):
    return subprocess.run(["git", "-c", "core.quotepath=off", *args], cwd=cwd, check=check, capture_output=True, text=True)


def cmd_cmn(args):
    cache = Path(args.cache)
    if not (cache / ".git").exists():
        cache.parent.mkdir(parents=True, exist_ok=True)
        git("clone", "--quiet", "--depth", "1", "--filter=blob:none", "--no-checkout", AUDIO_CMN_REPO, str(cache))
    commit = git("rev-parse", "HEAD", cwd=cache).stdout.strip()
    names = subprocess.run(["git", "-C", str(cache), "ls-tree", "-r", "-z", "--name-only", "HEAD"], check=True,
                           capture_output=True).stdout.decode("utf-8").split("\0")
    hsk = hsk_tone_table()
    items = []  # (path, id, src, spk, text, tones)
    for p in names:
        if p.startswith("64k/syllabs/cmn-") and p.endswith(".mp3"):
            key = p[len("64k/syllabs/cmn-"):-4]
            if re.fullmatch(r"[a-z]+[1-4]", key):
                items.append((p, f"cmn-syl:{key}", "audio-cmn-syl", "chen-wang", key, [int(key[-1])]))
        elif p.startswith("64k/hsk/cmn-") and p.endswith(".mp3"):
            w = p[len("64k/hsk/cmn-"):-4]
            if not (1 <= len(w) <= 4 and ta.hanzi_only(w) == w):
                continue
            tones = tones_for_word(w, hsk)
            if args.dev_subset and w not in hsk:
                continue
            if tones and len(tones) == ta.syllable_count(w):
                items.append((p, f"cmn-hsk:{w}", "audio-cmn-hsk", "yue-tan", w, tones))
    log(f"[cmn] commit {commit[:12]}: {len(items)} rekaman terpilih")
    tmp = Path(tempfile.mkdtemp())
    refs, bad = [], 0
    for i in range(0, len(items), 200):
        batch = items[i:i + 200]
        git("checkout", "HEAD", "--", *[b[0] for b in batch], cwd=cache)
        for p, rid, src, spk, text, tones in batch:
            try:
                m = ta.analyze_file(cache / p, tones, tmp / "x.wav")
            except Exception as e:  # noqa: BLE001
                log(f"[cmn] {p}: {type(e).__name__}: {e}")
                m = None
            if m is None:
                bad += 1
                continue
            refs.append(ref_record(rid, src, spk, text, tones, m, {"p": p}))
            (cache / p).unlink(missing_ok=True)
        log(f"[cmn] {len(refs)}/{len(items)} diukur (gagal {bad})")
        if out_of_time():
            log("[cmn] waktu habis; sisa dilewati")
            break
    part = {"part": "cmn", "audioCmnCommit": commit, "refs": refs,
            "skipped": {"unmeasurable": bad}}
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out).write_text(json.dumps(part, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    log(f"[cmn] {len(refs)} rujukan -> {args.out}")


# --------------------------------------------------------------------------
# Rekaman asli yang sudah ada di repo (Lingua Libre, native_audio.py)
# --------------------------------------------------------------------------

def cmd_local_native(args):
    native = json.loads((DATA / "native-audio.json").read_text(encoding="utf-8"))
    words = {w["id"]: w for w in read_words()}
    tmp = Path(tempfile.mkdtemp())
    refs = []
    for wid, entries in native.items():
        w = words.get(wid)
        if not w:
            continue
        tones = ta.expected_tones_from_numbered(w["pinyinNumbered"])
        for e in entries:
            m = re.search(r"Speaker: (.+?) Recorder", e["author"] + " ")
            spk = "ll:" + (m.group(1) if m else e["author"]).strip().lower().replace(" ", "-")
            try:
                meas = ta.analyze_file(ROOT / "public" / "audio" / e["path"], tones, tmp / "x.wav")
            except Exception as ex:  # noqa: BLE001
                log(f"[local] {e['path']}: {ex}")
                continue
            if meas:
                refs.append(ref_record(f"ll:{e['path']}", "lingualibre", spk, w["hanzi"], tones, meas,
                                       {"lic": e["license"], "url": e["sourceUrl"], "au": e["author"]}))
    write_out(args.out, json.dumps({"part": "local-native", "refs": refs}, ensure_ascii=False, separators=(",", ":")))
    log(f"[local] {len(refs)} rujukan -> {args.out}")


# --------------------------------------------------------------------------
# Lingua Libre / Commons (hanya CC0 / CC BY / CC BY-SA)
# --------------------------------------------------------------------------

def cmd_ll(args):
    import native_audio as na  # rutin Commons yang sama (User-Agent, laju, mundur eksponensial)

    na.UA = UA
    na.T0 = time.time()
    na.DEADLINE_MIN = BUDGET_MIN + 5  # batas waktu get() di native_audio (bawaan 40 menit)
    hsk = hsk_tone_table()
    titles: list[str] = []
    na.prefix_titles(na.PREFIXES[0], titles)
    titles = sorted(set(titles))
    log(f"[ll] {len(titles)} judul terdaftar")
    cands = []
    for t in titles:
        m = na.TITLE.match(t)
        if not m:
            continue
        word = m.group(2)
        if not (1 <= len(word) <= 6 and ta.hanzi_only(word) == word):
            continue
        cands.append((t, m.group(1), word))
    # kata HSK 1 dulu, lalu yang lain; bagi ke shard berselang-seling
    cands.sort(key=lambda c: (c[2] not in hsk, c[2], c[0]))
    mine = cands[args.shard::args.shards]
    log(f"[ll] shard {args.shard}/{args.shards}: {len(mine)} kandidat dari {len(cands)}")
    tmp = Path(tempfile.mkdtemp())
    refs, skipped_lic, fails = [], {}, 0
    for i in range(0, len(mine), 50):
        if out_of_time():
            log("[ll] waktu habis")
            break
        chunk = mine[i:i + 50]
        try:
            d = na.api(action="query", prop="videoinfo", viprop="url|extmetadata|user|derivatives",
                       titles="|".join(c[0] for c in chunk))
        except Exception as e:  # noqa: BLE001
            log(f"[ll] metadata gagal: {e}")
            continue
        info = {}
        for pg in d.get("query", {}).get("pages", []):
            ii = (pg.get("videoinfo") or pg.get("imageinfo") or [None])[0]
            if ii:
                info[pg["title"]] = ii
        for t, speaker, word in chunk:
            if out_of_time():
                break
            ii = info.get(t)
            if not ii:
                continue
            meta = ii.get("extmetadata", {})
            raw_lic = na.strip_html(meta.get("LicenseShortName", {}).get("value", ""))
            mm = na.ALLOWED.match(raw_lic)
            if not mm:
                skipped_lic[raw_lic or "(kosong)"] = skipped_lic.get(raw_lic or "(kosong)", 0) + 1
                continue
            tones = tones_for_word(word, hsk)
            if not tones or len(tones) != ta.syllable_count(word):
                continue
            try:
                time.sleep(na.DOWNLOAD_GAP)
                src = tmp / "src.bin"
                src.write_bytes(na.get(na.download_url(ii), binary=True))
                meas = ta.analyze_file(src, tones, tmp / "x.wav")
            except na.RateLimited as e:
                log(f"[ll] {e}")
                fails += 1
                if fails >= 5:
                    log("[ll] berhenti: 429 berulang")
                    i = len(mine)
                    break
                continue
            except Exception as e:  # noqa: BLE001
                log(f"[ll] {t}: {type(e).__name__}: {str(e)[:120]}")
                continue
            fails = 0
            if meas is None:
                continue
            author = na.strip_html(meta.get("Artist", {}).get("value", "")) or ii.get("user") or speaker
            refs.append(ref_record(f"ll:{t}", "lingualibre", "ll:" + speaker.lower().replace(" ", "-"), word, tones, meas,
                                   {"lic": mm.group(1).upper(), "url": ii["descriptionurl"], "au": author[:80]}))
        log(f"[ll] {len(refs)} rujukan sejauh ini; lisensi ditolak {skipped_lic}")
        Path(args.out).parent.mkdir(parents=True, exist_ok=True)
        Path(args.out).write_text(json.dumps({"part": f"ll-{args.shard}", "refs": refs, "skipped": {"license": skipped_lic}},
                                             ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        if i >= len(mine):
            break
    shutil.rmtree(tmp, ignore_errors=True)
    log(f"[ll] selesai: {len(refs)} rujukan")


# --------------------------------------------------------------------------
# Tatoeba (cek segar) dan Common Voice (cek akses)
# --------------------------------------------------------------------------

FREE = re.compile(r"^(CC0|CC BY(?!-N)|CC BY-SA)", re.I)


def fetch(url: str, binary=True, timeout=120):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        data = r.read()
    return data if binary else data.decode("utf-8", "replace")


def cmd_tatoeba(args):
    report: dict = {"part": "tatoeba", "refs": [], "check": {}}
    try:
        cmn = bz2.decompress(fetch("https://downloads.tatoeba.org/exports/per_language/cmn/cmn_sentences.tsv.bz2")).decode("utf-8")
        ids = {line.split("\t")[0]: line.split("\t")[2] for line in cmn.splitlines() if line.count("\t") >= 2}
        # sentences_with_audio.tar.bz2 berisi satu berkas tsv di dalam tar
        import tarfile

        raw = fetch("https://downloads.tatoeba.org/exports/sentences_with_audio.tar.bz2")
        tf = tarfile.open(fileobj=io.BytesIO(raw), mode="r:bz2")
        member = next(m for m in tf.getmembers() if m.isfile())
        text = tf.extractfile(member).read().decode("utf-8")
        total, lic = 0, {}
        usable = []
        for line in text.splitlines():
            c = line.split("\t")
            if len(c) < 4 or c[0] not in ids:
                continue
            total += 1
            key = c[3] or "(kosong)"
            lic[key] = lic.get(key, 0) + 1
            if c[3] and FREE.match(c[3]):
                usable.append((c[0], c[1], c[2], c[3]))
        report["check"] = {"cmnSentencesWithAudio": total, "licenses": lic, "usable": len(usable)}
        log(f"[tatoeba] cmn beraudio {total}; lisensi {lic}; berlisensi bebas {len(usable)}")
        tmp = Path(tempfile.mkdtemp())
        for sid, aid, user, lc in usable[:300]:
            if out_of_time(60):
                break
            tones = ta.expected_tones_from_text(ids[sid])
            if not tones:
                continue
            try:
                time.sleep(1.0)
                f = tmp / "a.mp3"
                f.write_bytes(fetch(f"https://tatoeba.org/audio/download/{aid}"))
                m = ta.analyze_file(f, tones, tmp / "x.wav")
            except Exception as e:  # noqa: BLE001
                log(f"[tatoeba] {aid}: {e}")
                continue
            if m:
                report["refs"].append(ref_record(f"tatoeba:{aid}", "tatoeba", "tt:" + (user or "?").lower(), ids[sid], tones, m,
                                                 {"lic": lc, "url": f"https://tatoeba.org/en/sentences/show/{sid}", "au": user}))
    except Exception as e:  # noqa: BLE001
        traceback.print_exc()
        report["check"]["error"] = f"{type(e).__name__}: {str(e)[:200]}"
    write_out(args.out, json.dumps(report, ensure_ascii=False, separators=(",", ":")))


def cmd_commonvoice(args):
    probes = {}
    for name, url in {"commonvoice.mozilla.org": "https://commonvoice.mozilla.org/en/datasets",
                      "datacollective.mozillafoundation.org": "https://datacollective.mozillafoundation.org/",
                      "huggingface.co/mozilla-foundation/common_voice_17_0": "https://huggingface.co/datasets/mozilla-foundation/common_voice_17_0/resolve/main/README.md"}.items():
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=30) as r:
                probes[name] = f"HTTP {r.status}"
        except Exception as e:  # noqa: BLE001
            probes[name] = f"{type(e).__name__}: {str(e)[:100]}"
    note = ("Common Voice zh-CN tidak diunduh: unduhan resmi (Mozilla Data Collective) memerlukan akun + persetujuan syarat, "
            "dan salinan Hugging Face bersifat gated (login). Membuat akun adalah urusan pemilik; dilewati.")
    write_out(args.out, json.dumps({"part": "commonvoice", "refs": [], "check": {"probes": probes, "note": note}},
                                   ensure_ascii=False, separators=(",", ":")))
    log(f"[cv] {probes}")


# --------------------------------------------------------------------------
# merge
# --------------------------------------------------------------------------

SOURCES = {
    "audio-cmn-syl": {"name": "hugolpz/audio-cmn, syllabs v.2", "speaker": "Chen Wang", "license": "CC BY-SA",
                      "url": "https://github.com/hugolpz/audio-cmn", "use": "pengukuran saja (tidak diputar, tidak di-commit)"},
    "audio-cmn-hsk": {"name": "hugolpz/audio-cmn, hsk (SWAC cmn-caen-tan)", "speaker": "Yue Tan", "license": "CC BY-SA",
                      "url": "https://github.com/hugolpz/audio-cmn", "use": "pengukuran saja (tidak diputar, tidak di-commit)"},
    "lingualibre": {"name": "Lingua Libre (Wikimedia Commons)", "speaker": "banyak penutur (lihat per rekaman)",
                    "license": "CC0 / CC BY / CC BY-SA (per rekaman)", "url": "https://commons.wikimedia.org/wiki/Category:Lingua_Libre_pronunciation-cmn",
                    "use": "pengukuran saja"},
    "tatoeba": {"name": "Tatoeba", "speaker": "per rekaman", "license": "hanya CC0/CC BY/CC BY-SA", "url": "https://tatoeba.org",
                "use": "pengukuran saja"},
}


def cmd_merge(args):
    refs, checks, parts = [], {}, []
    for p in args.inputs:
        d = json.loads(Path(p).read_text(encoding="utf-8"))
        parts.append(d.get("part", p))
        refs += d.get("refs", [])
        if d.get("check"):
            checks[d["part"]] = d["check"]
        if d.get("audioCmnCommit"):
            checks["audioCmnCommit"] = d["audioCmnCommit"]
    seen, uniq = set(), []
    for r in refs:
        if r["id"] not in seen:
            seen.add(r["id"])
            uniq.append(r)
    refs = sorted(uniq, key=lambda r: r["id"])
    spk: dict[str, dict] = {}
    for r in refs:
        s = spk.setdefault(r["spk"], {"src": r["src"], "n": 0})
        s["n"] += 1
        if r.get("au"):
            s["name"] = r["au"]
    by_src: dict[str, int] = {}
    for r in refs:
        by_src[r["src"]] = by_src.get(r["src"], 0) + 1
    doc = {"version": 1, "npts": ta.NPTS, "unit": "c = kontur semitone x10 terhadap 100 Hz; d/vd detik; r semitone",
           "sources": SOURCES, "counts": by_src, "checks": checks, "speakers": dict(sorted(spk.items())), "refs": refs}
    OUT.write_text(json.dumps(doc, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    log(f"[merge] {len(refs)} rujukan, {len(spk)} penutur, {by_src}; {OUT.stat().st_size / 1e6:.2f} MB")


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    for name, fn in (("cmn", cmd_cmn), ("ll", cmd_ll), ("local-native", cmd_local_native), ("tatoeba", cmd_tatoeba),
                     ("commonvoice", cmd_commonvoice)):
        s = sub.add_parser(name)
        s.add_argument("--out", required=True)
        s.add_argument("--cache", default=str(Path.home() / ".cache" / "audio-cmn-4c"))
        s.add_argument("--dev-subset", action="store_true", help="cmn: hanya kata HSK 1 + semua suku kata (uji lokal cepat)")
        s.add_argument("--shard", type=int, default=0)
        s.add_argument("--shards", type=int, default=1)
        s.set_defaults(fn=fn)
    m = sub.add_parser("merge")
    m.add_argument("--inputs", nargs="+", required=True)
    m.set_defaults(fn=cmd_merge)
    args = ap.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
