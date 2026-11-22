#!/usr/bin/env python3
"""Rekaman penutur asli (task 4b): Lingua Libre di Wikimedia Commons, hanya CC0 / CC BY / CC BY-SA.

Hanya pustaka standar + ffmpeg (jalan di GitHub Actions; sesi kerja tidak bisa membuka Commons).
Hasil: public/audio/native/<wordId>-<n>.mp3, data/hsk1/native-audio.json dan salinannya
public/audio/native/index.json (dibaca website). Maks 2 rekaman per kata; entri lama dipertahankan.
Tatoeba tidak dipakai (lisensi audio di sentences.json: kosong/CC BY-NC).
"""
from __future__ import annotations

import html
import json
import re
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.parse
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(ROOT / "scripts" / "tts"))
import make_samples as ms  # noqa: E402

API = "https://commons.wikimedia.org/w/api.php"
UA = "xue-mandarin-audio-fetch/1.0 (open educational project)"
CATEGORIES = ["Lingua Libre pronunciation-cmn", "Lingua Libre pronunciation-zh", "Lingua Libre pronunciation-zho"]
MAX_PER_WORD = 2
MAX_SECONDS = 4.0
ALLOWED = re.compile(r"^(CC0(?: 1\.0)?|CC BY(?: \d\.\d)?|CC BY-SA(?: \d\.\d)?)(?: [A-Za-z]+)?$", re.I)
TITLE = re.compile(r"^File:LL-Q\d+ \((?:cmn|zh|zho)\)-(.+)-([^-]+)\.(?:wav|ogg|flac|mp3|opus|webm)$", re.I)
OUT_DIR = ROOT / "public" / "audio" / "native"
DATA_FILE = ROOT / "data" / "hsk1" / "native-audio.json"


def log(*a):
    print(*a, file=sys.stderr, flush=True)


def get(url: str, binary=False):
    for i in range(5):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                data = r.read()
            return data if binary else json.loads(data)
        except Exception as e:  # noqa: BLE001
            log(f"[native] {type(e).__name__}: {e} (percobaan {i + 1})")
            time.sleep(2 * (i + 1))
    raise RuntimeError(f"gagal mengambil {url}")


def api(**params):
    return get(API + "?" + urllib.parse.urlencode({**params, "format": "json", "formatversion": "2"}))


def category_titles(cat: str) -> list[str]:
    titles, cont = [], None
    while True:
        p = {"action": "query", "list": "categorymembers", "cmtitle": f"Category:{cat}", "cmnamespace": "6", "cmlimit": "500"}
        if cont:
            p["cmcontinue"] = cont
        d = api(**p)
        titles += [m["title"] for m in d.get("query", {}).get("categorymembers", [])]
        cont = d.get("continue", {}).get("cmcontinue")
        if not cont:
            return titles


def strip_html(s: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", s))).strip()


def main() -> int:
    words = json.loads((ROOT / "data" / "hsk1" / "words.json").read_text(encoding="utf-8"))
    form_to_ids: dict[str, list[str]] = {}
    for w in words:
        for form in {w["hanzi"], w.get("traditional") or w["hanzi"]}:
            form_to_ids.setdefault(form, []).append(w["id"])

    titles: list[str] = []
    for cat in CATEGORIES:
        t = category_titles(cat)
        log(f"[native] Category:{cat}: {len(t)} berkas")
        titles += t
    if not titles:
        log("[native] kategori Lingua Libre kosong / tidak terbaca")
        return 1
    titles = sorted(set(titles))

    cands: dict[str, list[str]] = {}  # wordId -> judul
    for t in titles:
        m = TITLE.match(t)
        if not m:
            continue
        for wid in form_to_ids.get(m.group(2), []):
            cands.setdefault(wid, []).append(t)
    log(f"[native] kata dengan kandidat: {len(cands)} / {len(words)}")

    existing = json.loads(DATA_FILE.read_text(encoding="utf-8")) if DATA_FILE.exists() else {}
    existing = {k: v for k, v in existing.items() if all((ROOT / "public" / "audio" / e["path"]).exists() for e in v)}

    # Metadata (lisensi, penulis, url) semua kandidat kata yang belum punya rekaman.
    need = sorted(w for w in cands if w not in existing)
    info: dict[str, dict] = {}
    all_titles = sorted({t for w in need for t in cands[w]})
    for i in range(0, len(all_titles), 40):
        d = api(action="query", prop="imageinfo", iiprop="url|extmetadata|user", titles="|".join(all_titles[i:i + 40]))
        for pg in d.get("query", {}).get("pages", []):
            ii = (pg.get("imageinfo") or [None])[0]
            if ii:
                info[pg["title"]] = ii

    result = dict(existing)
    skipped_license: dict[str, int] = {}
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    tmp = Path(tempfile.mkdtemp())
    for wid in need:
        picks = []
        seen = set()
        for t in cands[wid]:
            ii = info.get(t)
            if not ii:
                continue
            meta = ii.get("extmetadata", {})
            lic = strip_html(meta.get("LicenseShortName", {}).get("value", ""))
            if not ALLOWED.match(lic):
                skipped_license[lic or "(kosong)"] = skipped_license.get(lic or "(kosong)", 0) + 1
                continue
            speaker = TITLE.match(t).group(1)
            if speaker in seen:
                continue
            seen.add(speaker)
            author = strip_html(meta.get("Artist", {}).get("value", "")) or ii.get("user") or speaker
            picks.append((t, ii, lic, author))
        entries = []
        for t, ii, lic, author in picks:
            if len(entries) >= MAX_PER_WORD:
                break
            n = len(entries) + 1
            try:
                src = tmp / "src.bin"
                src.write_bytes(get(ii["url"], binary=True))
                dst = OUT_DIR / f"{wid}-{n}.mp3"
                ms.normalize(src, dst, tmp)
                dur = ms.duration(dst)
            except Exception as e:  # noqa: BLE001
                log(f"[native] {wid} {t}: gagal diproses ({type(e).__name__}: {e})")
                continue
            if dur > MAX_SECONDS:
                dst.unlink(missing_ok=True)
                log(f"[native] {wid} {t}: terlalu panjang ({dur}s)")
                continue
            entries.append({"path": f"native/{wid}-{n}.mp3", "author": author, "license": lic, "sourceUrl": ii["descriptionurl"]})
            log(f"[native] {wid} <- {t} ({lic}, {author}, {dur}s)")
        if entries:
            result[wid] = entries
    shutil.rmtree(tmp, ignore_errors=True)

    # file basi (kata yang entrinya hilang) dibersihkan
    keep = {ROOT / "public" / "audio" / e["path"] for v in result.values() for e in v}
    for p in OUT_DIR.glob("*.mp3"):
        if p not in keep:
            p.unlink()
    result = {k: result[k] for k in sorted(result)}
    text = json.dumps(result, ensure_ascii=False, indent=1) + "\n"
    DATA_FILE.write_text(text, encoding="utf-8")
    (OUT_DIR / "index.json").write_text(text, encoding="utf-8")
    log(f"[native] kata dengan rekaman: {len(result)}; berkas: {sum(len(v) for v in result.values())}; lisensi ditolak: {skipped_license}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
