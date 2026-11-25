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

Ronde 3: jalan ronde 2 menemukan 3.861 berkas "LL-Q9192 (cmn)-" dan kandidat untuk 190 kata, tetapi
SEMUA unduhan dari upload.wikimedia.org ditolak "HTTP 429 Too many requests" (batas laju Wikimedia
untuk klien otomatis), jadi hasilnya 0. Jalan berikutnya (jeda 3 dtk, Retry-After) tetap 429 sejak
unduhan pertama: penyebab paling mungkin User-Agent tanpa kontak (kebijakan User-Agent / bot Wikimedia
mewajibkan nama alat + URL/email kontak; klien tanpa itu dibatasi keras di upload.wikimedia.org).

Ronde 3b (perbaikan): User-Agent sesuai kebijakan (nama/versi + URL repo sebagai kontak + pustaka),
`maxlag` di API, unduhan berurutan dengan jeda DOWNLOAD_GAP, patuhi Retry-After, mundur eksponensial
per berkas, berhenti hanya setelah MAX_RATE_LIMITED_FILES berkas berturut-turut ditolak. Berkas yang
sudah ada dipertahankan dan dilewati (bisa dilanjutkan), hasil ditulis bertahap. Lintasan 1: satu
rekaman per kata; lintasan 2 (bila waktu cukup): rekaman kedua dari penutur lain (maks MAX_PER_WORD).
Lisensi disimpan dalam bentuk inti ("CC BY-SA 4.0"), cocok dengan NATIVE_LICENSES di website.
"""
from __future__ import annotations

import html
import json
import re
import shutil
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
REPO_URL = "https://github.com/Journeyhendry/chineseforeveryone"
UA = (f"XueMandarinNativeAudio/3.0 ({REPO_URL}; open-source Mandarin learning site; "
      f"sequential low-rate fetch) Python-urllib/{sys.version_info.major}.{sys.version_info.minor}")
PREFIXES = ["LL-Q9192 (cmn)-"]
DEADLINE_MIN = 40
LIST_DEADLINE_MIN = 10
MAX_CANDIDATES = 6  # judul per kata yang dicek lisensinya
MAX_PER_WORD = 2  # spec: 1-2 (lintasan 2 hanya bila waktu cukup)
DOWNLOAD_GAP = 1.5  # detik antar unduhan berkas (berurutan, satu per satu)
API_GAP = 1.0  # detik antar permintaan API
FILE_TRIES = 5  # percobaan per berkas (mundur eksponensial)
BACKOFF_BASE = 15  # detik; 15, 30, 60, 120 ...
MAX_WAIT = 300  # batas satu kali tunggu (Retry-After dibatasi ke sini)
MAX_RATE_LIMITED_FILES = 3  # berkas berturut-turut yang tetap 429 setelah semua percobaan -> berhenti
MAX_SECONDS = 4.0
ALLOWED = re.compile(r"^(CC0(?: 1\.0)?|CC BY(?: \d\.\d)?|CC BY-SA(?: \d\.\d)?)(?: [A-Za-z]+)?$", re.I)
TITLE = re.compile(r"^File:LL-Q\d+ \((?:cmn|zh|zho)\)-(.+)-([^-]+)\.(?:wav|ogg|flac|mp3|opus|webm)$", re.I)
OUT_DIR = ROOT / "public" / "audio" / "native"
DATA_FILE = ROOT / "data" / "hsk1" / "native-audio.json"


def log(*a):
    print(*a, file=sys.stderr, flush=True)


T0 = time.time()
STATE = {"rateLimitedFiles": 0, "stopped": "", "downloads": 0, "http429": 0, "last429": ""}


class RateLimited(RuntimeError):
    pass


def out_of_time(minutes: float = DEADLINE_MIN) -> bool:
    return time.time() - T0 > minutes * 60


def retry_after(e) -> int:
    try:
        return int(getattr(e, "headers", {}).get("Retry-After", 0) or 0)
    except (ValueError, AttributeError):
        return 0


def get(url: str, binary=False, tries: int = FILE_TRIES):
    """Satu permintaan dengan mundur eksponensial; 429/503 -> patuhi Retry-After. Habis percobaan
    karena 429 -> RateLimited; kesalahan lain -> RuntimeError."""
    rate_limited = False
    for i in range(tries):
        if out_of_time():
            raise RuntimeError("batas waktu")
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Encoding": "identity"})
            with urllib.request.urlopen(req, timeout=60) as r:
                data = r.read()
            return data if binary else json.loads(data)
        except Exception as e:  # noqa: BLE001
            code = getattr(e, "code", None)
            log(f"[native] {type(e).__name__}: {str(e)[:160]} (percobaan {i + 1}/{tries})")
            if code == 404:
                raise RuntimeError(f"404 {url}") from e
            wait = BACKOFF_BASE * (2 ** i)
            if code in (429, 503):
                rate_limited = code == 429
                if rate_limited:
                    STATE["http429"] += 1
                    h = getattr(e, "headers", None)
                    STATE["last429"] = (f"{urllib.parse.urlparse(url).netloc}: Retry-After={retry_after(e)}"
                                        f" server={h.get('server', '') if h else ''} x-cache={h.get('x-cache', '') if h else ''}")
                wait = max(wait, retry_after(e))
            else:
                rate_limited = False
            if i + 1 < tries:
                time.sleep(min(wait, MAX_WAIT))
    if rate_limited:
        raise RateLimited(f"HTTP 429 dari {urllib.parse.urlparse(url).netloc} setelah {tries} percobaan")
    raise RuntimeError(f"gagal mengambil {url}")


def api(**params):
    url = API + "?" + urllib.parse.urlencode({**params, "format": "json", "formatversion": "2", "maxlag": "5"})
    for i in range(5):
        time.sleep(API_GAP)
        d = get(url)
        if d.get("error", {}).get("code") != "maxlag":
            return d
        log(f"[native] maxlag, tunggu ({i + 1})")
        time.sleep(5 * (i + 1))
    raise RuntimeError("API Commons terus maxlag")


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


def download_url(ii: dict) -> str:
    """Turunan mp3 (kecil) bila ada, kalau tidak berkas asli."""
    for d in ii.get("derivatives") or []:
        if "mpeg" in d.get("type", "") or d.get("transcodekey", "") == "mp3":
            return d["src"]
    return ii["url"]


def strip_html(s: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", s))).strip()


def write_result(result: dict, note: str, extra: dict | None = None) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    result = {k: result[k] for k in sorted(result)}
    text = json.dumps(result, ensure_ascii=False, indent=1) + "\n"
    DATA_FILE.write_text(text, encoding="utf-8")
    (OUT_DIR / "index.json").write_text(text, encoding="utf-8")
    status = {"note": note, "words": len(result), "files": sum(len(v) for v in result.values())}
    status.update(extra or {})
    (OUT_DIR / "status.json").write_text(json.dumps(status, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    log(f"[native] {note}")


def load_existing() -> dict:
    """Entri lama yang berkasnya masih ada (dilewati, tidak diunduh ulang)."""
    if not DATA_FILE.exists():
        return {}
    try:
        old = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    except ValueError:
        return {}
    out = {}
    for k, v in old.items():
        keep = [e for e in v if (ROOT / "public" / "audio" / e["path"]).exists()]
        if keep:
            out[k] = keep
    return out


def main() -> int:
    existing = load_existing()
    try:
        run(existing)
    except Exception as e:  # noqa: BLE001
        import traceback

        traceback.print_exc()
        write_result(existing, f"tidak selesai: {type(e).__name__}: {e}", {"http429": STATE["http429"], "last429": STATE["last429"]})
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
        write_result(existing, "Commons tidak terjangkau atau daftar Lingua Libre kosong; tanpa rekaman penutur asli",
                     {"http429": STATE["http429"], "last429": STATE["last429"]})
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

    # Metadata (lisensi, penulis, url) kandidat kata yang belum penuh.
    need = sorted(w for w in cands if len(existing.get(w, [])) < MAX_PER_WORD)
    info: dict[str, dict] = {}
    all_titles = sorted({t for w in need for t in cands[w]})
    for i in range(0, len(all_titles), 50):
        if out_of_time():
            log("[native] waktu metadata habis")
            break
        d = api(action="query", prop="videoinfo", viprop="url|extmetadata|user|derivatives",
                titles="|".join(all_titles[i:i + 50]))
        for pg in d.get("query", {}).get("pages", []):
            ii = (pg.get("videoinfo") or pg.get("imageinfo") or [None])[0]
            if ii:
                info[pg["title"]] = ii

    skipped_license: dict[str, int] = {}
    picks: dict[str, list[tuple]] = {}
    for wid in need:
        seen = set()
        for t in cands[wid]:
            ii = info.get(t)
            if not ii:
                continue
            meta = ii.get("extmetadata", {})
            raw_lic = strip_html(meta.get("LicenseShortName", {}).get("value", ""))
            m = ALLOWED.match(raw_lic)
            if not m:
                skipped_license[raw_lic or "(kosong)"] = skipped_license.get(raw_lic or "(kosong)", 0) + 1
                continue
            lic = m.group(1).upper()
            speaker = TITLE.match(t).group(1)
            if speaker in seen:
                continue
            seen.add(speaker)
            author = strip_html(meta.get("Artist", {}).get("value", "")) or ii.get("user") or speaker
            picks.setdefault(wid, []).append((t, ii, lic, author))
    log(f"[native] kata dengan kandidat berlisensi bebas: {len(picks)}; lisensi ditolak: {skipped_license}")

    result = {k: list(v) for k, v in existing.items()}
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    tmp = Path(tempfile.mkdtemp())
    stopped = ""
    # Lintasan 1: satu rekaman per kata dulu; lintasan 2: rekaman kedua (penutur lain).
    for slot in range(MAX_PER_WORD):
        for wid in sorted(picks):
            if stopped:
                break
            if out_of_time():
                stopped = "waktu unduh habis; sisa kata dilanjutkan di jalan berikutnya"
                break
            have = result.get(wid, [])
            if len(have) > slot:
                continue  # sudah ada (dari jalan sebelumnya / lintasan sebelumnya)
            used = {e["sourceUrl"] for e in have}
            for t, ii, lic, author in picks[wid]:
                if ii["descriptionurl"] in used:
                    continue
                n = len(have) + 1
                dst = OUT_DIR / f"{wid}-{n}.mp3"
                try:
                    src = tmp / "src.bin"
                    time.sleep(DOWNLOAD_GAP)
                    src.write_bytes(get(download_url(ii), binary=True))
                    STATE["downloads"] += 1
                    STATE["rateLimitedFiles"] = 0
                    ms.normalize(src, dst, tmp)
                    dur = ms.duration(dst)
                except RateLimited as e:
                    STATE["rateLimitedFiles"] += 1
                    log(f"[native] {wid}: {e}")
                    if STATE["rateLimitedFiles"] >= MAX_RATE_LIMITED_FILES:
                        stopped = (f"unduhan dihentikan: {MAX_RATE_LIMITED_FILES} berkas berturut-turut tetap HTTP 429 "
                                   f"(batas laju Wikimedia) meski jeda, Retry-After dan mundur eksponensial")
                    break
                except Exception as e:  # noqa: BLE001
                    dst.unlink(missing_ok=True)
                    log(f"[native] {wid} {t}: gagal diproses ({type(e).__name__}: {str(e)[:200]})")
                    continue
                if dur > MAX_SECONDS:
                    dst.unlink(missing_ok=True)
                    log(f"[native] {wid} {t}: terlalu panjang ({dur}s)")
                    continue
                result[wid] = have + [{"path": f"native/{wid}-{n}.mp3", "author": author, "license": lic,
                                       "sourceUrl": ii["descriptionurl"]}]
                log(f"[native] {wid} <- {t} ({lic}, {author}, {dur}s)")
                write_result(result, f"sementara: {len(result)} kata")  # simpan bertahap
                break
        if stopped:
            break
    shutil.rmtree(tmp, ignore_errors=True)

    # berkas yatim (tidak tercatat) dibersihkan; berkas tercatat tidak disentuh
    keep = {ROOT / "public" / "audio" / e["path"] for v in result.values() for e in v}
    for p in OUT_DIR.glob("*.mp3"):
        if p not in keep:
            p.unlink()
    note = (f"{len(result)} kata punya rekaman ({sum(len(v) for v in result.values())} berkas) dari {len(cands)} kata "
            f"berkandidat ({len(picks)} berlisensi bebas); unduhan jalan ini: {STATE['downloads']}; "
            f"lisensi ditolak: {skipped_license}" + (f"; {stopped}" if stopped else ""))
    write_result(result, note, {"candidates": len(cands), "freeLicensed": len(picks), "downloadsThisRun": STATE["downloads"],
                                "http429": STATE["http429"], "last429": STATE["last429"], "userAgent": UA,
                                "licensesRejected": skipped_license})


if __name__ == "__main__":
    sys.exit(main())
