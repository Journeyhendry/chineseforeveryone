#!/usr/bin/env python3
"""Rekaman penutur asli (task 4b): Lingua Libre di Wikimedia Commons, hanya CC0 / CC BY / CC BY-SA.

Hanya pustaka standar + ffmpeg (jalan di GitHub Actions; sesi kerja tidak bisa membuka Commons).
Permintaan berkelompok dan berbatas waktu (DEADLINE_MIN): satu daftar judul berawalan
"LL-Q9192 (cmn)-" (500 judul per permintaan), metadata 50 judul per permintaan, lalu unduh
hanya rekaman terpilih. Selalu menulis data/hsk1/native-audio.json (boleh {}) dan
public/audio/native/status.json (alasan bila kosong). Tidak pernah menggagalkan workflow.
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
UA = "xue-mandarin-audio-fetch/2.0 (open educational project; batched Commons API reads)"
PREFIXES = ["LL-Q9192 (cmn)-"]
DEADLINE_MIN = 25
LIST_DEADLINE_MIN = 12
MAX_CANDIDATES = 6  # judul per kata yang dicek lisensinya
MAX_PER_WORD = 2
MAX_SECONDS = 4.0
ALLOWED = re.compile(r"^(CC0(?: 1\.0)?|CC BY(?: \d\.\d)?|CC BY-SA(?: \d\.\d)?)(?: [A-Za-z]+)?$", re.I)
TITLE = re.compile(r"^File:LL-Q\d+ \((?:cmn|zh|zho)\)-(.+)-([^-]+)\.(?:wav|ogg|flac|mp3|opus|webm)$", re.I)
OUT_DIR = ROOT / "public" / "audio" / "native"
DATA_FILE = ROOT / "data" / "hsk1" / "native-audio.json"


def log(*a):
    print(*a, file=sys.stderr, flush=True)


T0 = time.time()


def out_of_time(minutes: float = DEADLINE_MIN) -> bool:
    return time.time() - T0 > minutes * 60


def get(url: str, binary=False):
    for i in range(4):
        if out_of_time():
            raise RuntimeError("batas waktu")
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                data = r.read()
            return data if binary else json.loads(data)
        except Exception as e:  # noqa: BLE001
            log(f"[native] {type(e).__name__}: {e} (percobaan {i + 1})")
            wait = 2 * (i + 1)
            if getattr(e, "code", None) == 429:
                wait = max(wait, int(getattr(e, "headers", {}).get("Retry-After", 0) or 0), 15 * (i + 1))
            time.sleep(wait)
    raise RuntimeError(f"gagal mengambil {url}")


def api(**params):
    time.sleep(0.5)  # pelan-pelan: Commons membatasi laju permintaan (429)
    return get(API + "?" + urllib.parse.urlencode({**params, "format": "json", "formatversion": "2"}))


def prefix_titles(prefix: str, out: list[str]) -> None:
    """Semua judul berkas berawalan prefix (500 per permintaan), ditambahkan ke out; berhenti bila waktu habis."""
    cont = None
    while not out_of_time(LIST_DEADLINE_MIN):
        p = {"action": "query", "list": "allpages", "apnamespace": "6", "apprefix": prefix, "aplimit": "500"}
        if cont:
            p["apcontinue"] = cont
        d = api(**p)
        out += [m["title"] for m in d.get("query", {}).get("allpages", [])]
        cont = d.get("continue", {}).get("apcontinue")
        if not cont:
            return
    log("[native] waktu daftar habis; daftar belum lengkap")


def strip_html(s: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", s))).strip()


def write_result(result: dict, note: str) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    result = {k: result[k] for k in sorted(result)}
    text = json.dumps(result, ensure_ascii=False, indent=1) + "\n"
    DATA_FILE.write_text(text, encoding="utf-8")
    (OUT_DIR / "index.json").write_text(text, encoding="utf-8")
    (OUT_DIR / "status.json").write_text(json.dumps({"note": note, "words": len(result)}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    log(f"[native] {note}")


def main() -> int:
    existing = {}
    if DATA_FILE.exists():
        existing = json.loads(DATA_FILE.read_text(encoding="utf-8"))
        existing = {k: v for k, v in existing.items() if all((ROOT / "public" / "audio" / e["path"]).exists() for e in v)}
    try:
        run(existing)
    except Exception as e:  # noqa: BLE001
        import traceback

        traceback.print_exc()
        write_result(existing, f"tidak selesai: {type(e).__name__}: {e}")
    return 0


def run(existing: dict) -> None:
    words = json.loads((ROOT / "data" / "hsk1" / "words.json").read_text(encoding="utf-8"))
    form_to_ids: dict[str, list[str]] = {}
    for w in words:
        for form in {w["hanzi"], w.get("traditional") or w["hanzi"]}:
            form_to_ids.setdefault(form, []).append(w["id"])

    titles: list[str] = []
    for pre in PREFIXES:
        try:
            prefix_titles(pre, titles)
        except RuntimeError as e:
            log(f"[native] daftar {pre} terputus: {e}")
        log(f"[native] {pre}: {len(titles)} berkas terdaftar")
    if not titles:
        write_result(existing, "Commons tidak terjangkau atau daftar Lingua Libre kosong; tanpa rekaman penutur asli")
        return
    titles = sorted(set(titles))

    cands: dict[str, list[str]] = {}  # wordId -> judul
    for t in titles:
        m = TITLE.match(t)
        if not m:
            continue
        for wid in form_to_ids.get(m.group(2), []):
            cands.setdefault(wid, []).append(t)
    log(f"[native] kata dengan kandidat: {len(cands)} / {len(words)}")

    for wid in cands:  # batasi kandidat per kata
        cands[wid] = cands[wid][:MAX_CANDIDATES]

    # Metadata (lisensi, penulis, url) semua kandidat kata yang belum punya rekaman.
    need = sorted(w for w in cands if w not in existing)
    info: dict[str, dict] = {}
    all_titles = sorted({t for w in need for t in cands[w]})
    for i in range(0, len(all_titles), 50):
        if out_of_time():
            log("[native] waktu metadata habis")
            break
        d = api(action="query", prop="imageinfo", iiprop="url|extmetadata|user", titles="|".join(all_titles[i:i + 50]))
        for pg in d.get("query", {}).get("pages", []):
            ii = (pg.get("imageinfo") or [None])[0]
            if ii:
                info[pg["title"]] = ii

    result = dict(existing)
    skipped_license: dict[str, int] = {}
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    tmp = Path(tempfile.mkdtemp())
    for wid in need:
        if out_of_time():
            log("[native] waktu unduh habis; sisa kata dilewati")
            break
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
    note = f"{len(result)} kata punya rekaman ({sum(len(v) for v in result.values())} berkas); lisensi ditolak: {skipped_license}"
    write_result(result, note)


if __name__ == "__main__":
    sys.exit(main())
