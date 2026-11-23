#!/usr/bin/env python3
"""Audio Tahap 0 (task 0) dengan suara P3. Dijalankan oleh .github/workflows/basics-audio.yml.

    python scripts/tts-basics/basics.py [--out public/audio/basics] [--force] [--recheck]

- Item bersuara = setiap objek di data/basics/basics.json yang punya `audioId` (+ `hanzi`, `pinyin`).
- Suara: P3 dari scripts/tts/voices.json (Kokoro-82M v1.1-zh, zf_001, revisi yang dipatok), speed 1.0.
- Format sama dengan contoh suara (fungsi `normalize` dari scripts/tts/make_samples.py dipakai ulang):
  mp3 mono 64 kbps 24 kHz, pangkas sunyi, -16 LUFS, jeda 0,15 dtk.
- Cek (ronde 2, CHECK_VERSION 4): faster-whisper large-v3 (CPU int8, language="zh", beam 5,
  condition_on_previous_text=False, initial_prompt netral berhuruf sederhana yang tidak memuat huruf
  target -- lihat PROMPTS) + opencc t2s.
  * Kata/kalimat (>= 2 huruf): transkrip tanpa tanda baca = hanzi (angka Arab dibaca sebagai hanzi).
    Nada ringan di dalam kata tidak dicek F0.
  * Suku kata tunggal, dua bagian terpisah:
    (a) bunyi: transkrip 1-3 huruf, semuanya Han, dan minimal satu huruf punya bacaan (pypinyin
        heteronym, tanpa nada) = suku kata target tanpa nada (huruf lain yang bunyinya sama lolos).
        Bila tidak cocok, file yang SAMA diulang 3x lalu ditranskrip (<= 8 huruf; minimal 2 huruf
        dan minimal separuhnya berbunyi target).
    (b) nada: kontur F0 (praat-parselmouth) diklasifikasi ke nada 1-4 dengan aturan di
        tonecheck.py (dinormalkan ke rentang penutur = persentil 5-95 F0 semua suku kata tunggal).
    Lolos bila (a) dan (b) lolos, ATAU transkrip cocok persis dengan pinyin bernada: 1-3 huruf yang
    semuanya punya bacaan bernada = `pinyin` target (mis. 酒酒 untuk jiǔ), atau versi x3 (file yang
    sama diulang 3x; dicoba bila belum lolos) 2-8 huruf yang semuanya begitu.
  * Kata: transkrip berhuruf Latin (mis. "Baba") lolos bila hurufnya = pinyin tanpa nada.
  CHECK_VERSION 4 = versi 3 + dua tambahan di atas (lebih longgar hanya di situ), jadi file yang lolos di
  versi 3 tidak dicek ulang; yang gagal setelah 3 percobaan hanya dicek ulang (tanpa sintesis).
  Manifest per file: transkrip, hasil bunyi, nada target/terdeteksi (+ fitur F0), alasan gagal.
- Gagal -> buat ulang dengan variasi (maksimal MAX_ATTEMPTS = 6 percobaan; 4-6 ditambah di ronde 2):
    1. teks apa adanya, speed 1.0
    2. suku kata tunggal: "X，X，X。" lalu potong suku kata tengah di titik energi terendah
       (nada sitasi lebih jelas); kata: teks + "。", speed 0.9
    3. teks + "。", speed 0.85
    4. bingkai "X，X。" -> ujaran pertama (dipotong di jeda koma, fade 10/30 ms), speed 1.0
    5. bingkai "X，X，X。" -> ujaran pertama, speed 0.9
    6. suku kata tunggal: bingkai "X，X。" -> ujaran pertama, speed 0.85;
       kata: teks + "？" (bila berakhir 吗) atau "！", speed 0.9
    Alasan 4-6: G2P misaki benar (鸡 -> "ㄐㄧ1"), tetapi P3 sering membaca suku kata di AKHIR ujaran
    dengan nada turun; di awal ujaran (diikuti koma) nadanya lebih utuh.
    File yang sudah lolos tidak disentuh; item gagal dengan percobaan < 6 dilanjutkan (--recheck).
  Tetap gagal -> file terbaik disimpan (ok: false) dan dicatat di data/basics/audio-issues.json.
- Item yang hanzi/pinyin-nya tidak berubah, filenya ada dan sudah dicek dengan CHECK_VERSION ini
  tidak disentuh (kecuali --force), supaya push berikutnya tidak mengubah mp3 yang sudah ada.
- Item gagal yang hanzi + pinyin-nya sama dengan item lain yang lolos memakai salinan file itu
  (dicek lagi; bukan percobaan sintesis baru).
- --recheck: file yang teksnya tidak berubah tetapi dicek dengan versi cek lama TIDAK disintesis
  ulang, hanya dicek ulang. Yang tetap gagal dihitung sebagai percobaan 1 lalu disintesis ulang
  dengan variasi 2 dan 3 (maksimal 3 percobaan). Tanpa --recheck file seperti itu dibuat ulang.
- Batas waktu (--budget-min): item yang belum sempat dibuat ditandai `pending` di manifest
  (`complete: false`); workflow lalu menjalankan dirinya lagi untuk melanjutkan.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import subprocess
import sys
import time
import traceback
import unicodedata
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(ROOT / "scripts" / "tts"))

import make_samples as ms  # noqa: E402  (fungsi format & normalisasi task 4a)
import tonecheck as tc  # noqa: E402

DATA = ROOT / "data" / "basics" / "basics.json"
ISSUES = ROOT / "data" / "basics" / "audio-issues.json"
VOICE_CODE = "P3"
SCRIPT_VERSION = 4
MAX_ATTEMPTS = 6
CHECK_VERSION = 4
# Versi cek lama yang aturannya himpunan bagian dari versi ini: file yang lolos di sana pasti lolos di
# sini (tidak dicek ulang); yang gagal setelah 3 percobaan hanya dicek ulang, tidak disintesis lagi.
COMPATIBLE_CHECKS = {3}
WHISPER_MODEL = "large-v3"
# initial_prompt netral (huruf sederhana); dipilih yang pertama tanpa huruf target.
PROMPTS = ["普通话录音。", "汉语录音。"]
HAN = re.compile(r"[\u3400-\u9fff]")
DIGITS = {"0": "零", "1": "一", "2": "二", "3": "三", "4": "四", "5": "五", "6": "六", "7": "七", "8": "八", "9": "九"}

log = ms.log


def audio_items(node, out=None):
    """Semua objek ber-audioId, urut kemunculan."""
    if out is None:
        out = []
    if isinstance(node, dict):
        if "audioId" in node:
            out.append({"audioId": node["audioId"], "hanzi": node["hanzi"], "pinyin": node["pinyin"]})
        for v in node.values():
            audio_items(v, out)
    elif isinstance(node, list):
        for v in node:
            audio_items(v, out)
    return out


# --------------------------------------------------------------------------
# Sintesis
# --------------------------------------------------------------------------

class Kokoro:
    def __init__(self, voice: dict):
        import torch
        from huggingface_hub import hf_hub_download
        from kokoro import KModel, KPipeline

        log(f"[kokoro] torch {torch.__version__}")
        repo, sha = voice["repoId"], voice["modelRevision"]
        ms.hf_snapshot_info(repo, sha)
        cfg = hf_hub_download(repo, "config.json", revision=sha)
        ckpt = hf_hub_download(repo, "kokoro-v1_1-zh.pth", revision=sha)
        model = KModel(repo_id=repo, config=cfg, model=ckpt).eval()
        self.pipe = KPipeline(lang_code="z", repo_id=repo, model=model)
        self.pack = hf_hub_download(repo, f"voices/{voice['voiceId']}.pt", revision=sha)

    def synth(self, text: str, speed: float, wav: Path):
        import numpy as np

        chunks = []
        for res in self.pipe(text, voice=self.pack, speed=speed, split_pattern=None):
            if res.audio is not None:
                chunks.append(res.audio.numpy())
        if not chunks:
            raise RuntimeError(f"tidak ada audio untuk {text!r}")
        ms.write_wav(wav, np.concatenate(chunks), ms.SAMPLE_RATE)


def voiced_segments(wav: Path) -> list[tuple[float, float]]:
    """Bagian bersuara (detik) menurut silencedetect."""
    p = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(wav), "-af", "silencedetect=noise=-38dB:d=0.07",
                        "-f", "null", "-"], capture_output=True, text=True, check=True)
    total = float(ms.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0",
                          str(wav)]).stdout.strip())
    starts = [float(x) for x in re.findall(r"silence_start: (-?[\d.]+)", p.stderr)]
    ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", p.stderr)]
    silences = list(zip(starts, ends + [total] * (len(starts) - len(ends))))
    segs, cur = [], 0.0
    for s, e in silences:
        if s - cur > 0.05:
            segs.append((cur, s))
        cur = e
    if total - cur > 0.05:
        segs.append((cur, total))
    return segs


def cut(src: Path, dst: Path, start: float, end: float):
    a, b = max(0.0, start - 0.03), end + 0.05
    ms.run(["ffmpeg", "-y", "-v", "error", "-i", str(src), "-af", f"atrim={a:.3f}:{b:.3f},asetpts=PTS-STARTPTS",
            str(dst)])


def middle_by_valleys(src: Path, dst: Path):
    """Potong suku kata tengah dari rekaman "X，X，X。": cari 2 titik energi terendah (jendela 10 ms)
    di sekitar 1/3 dan 2/3 bagian bersuara."""
    import numpy as np
    import soundfile as sf

    x, sr = sf.read(str(src), dtype="float32")
    if x.ndim > 1:
        x = x.mean(axis=1)
    hop = sr // 100
    rms = np.array([np.sqrt(np.mean(x[i:i + hop] ** 2) + 1e-12) for i in range(0, len(x) - hop, hop)])
    voiced = np.where(rms > rms.max() * 0.05)[0]
    if len(voiced) < 30:
        raise RuntimeError("bingkai terlalu pendek")
    a, b = voiced[0], voiced[-1]
    span = b - a
    def valley(lo, hi):
        lo, hi = a + int(span * lo), a + int(span * hi)
        return lo + int(np.argmin(rms[lo:hi]))
    v1, v2 = valley(0.2, 0.47), valley(0.53, 0.8)
    if v2 - v1 < 15:
        raise RuntimeError("bingkai: suku kata tengah terlalu pendek")
    sf.write(str(dst), x[v1 * hop:v2 * hop], sr)


def make_raw(tts: Kokoro, item: dict, attempt: int, wav: Path) -> str:
    """Buat wav mentah untuk percobaan ke-n; kembalikan keterangan variasi."""
    h = item["hanzi"]
    single = len(HAN.findall(h)) == 1
    if attempt == 1:
        tts.synth(h, 1.0, wav)
        return "plain, speed 1.0"
    if attempt == 2 and single:
        frame = wav.with_suffix(".frame.wav")
        tts.synth(f"{h}，{h}，{h}。", 1.0, frame)
        middle_by_valleys(frame, wav)
        return "frame X，X，X。 -> middle syllable"
    if attempt == 2:
        tts.synth(h + "。", 0.9, wav)
        return "text + 。, speed 0.9"
    if attempt == 3:
        tts.synth(h + "。", 0.85, wav)
        return "text + 。, speed 0.85"
    # Ronde 2, percobaan 4-6 (hanya untuk item yang masih gagal): bingkai pembawa lalu potong.
    # G2P misaki sudah benar (mis. 鸡 -> "ㄐㄧ1"); yang salah adalah realisasi nada model untuk suku kata
    # di akhir ujaran (nada 1 sering turun). Maka target diletakkan di AWAL ujaran, diikuti jeda koma.
    frame = wav.with_suffix(".frame.wav")
    if attempt == 4:
        tts.synth(f"{h}，{h}。", 1.0, frame)
        first_segment(frame, wav)
        return "frame X，X。 -> first, speed 1.0"
    if attempt == 5:
        tts.synth(f"{h}，{h}，{h}。", 0.9, frame)
        first_segment(frame, wav)
        return "frame X，X，X。 -> first, speed 0.9"
    if single:
        tts.synth(f"{h}，{h}。", 0.85, frame)
        first_segment(frame, wav)
        return "frame X，X。 -> first, speed 0.85"
    end = "？" if h.endswith("吗") else "！"
    tts.synth(h + end, 0.9, wav)
    return f"text + {end}, speed 0.9"


def first_segment(src: Path, dst: Path):
    """Ambil ujaran pertama dari bingkai "X，X。": bagian bersuara pertama menurut silencedetect (jeda koma);
    bila tidak ada jeda, potong di energi terendah antara 30-70 % bagian bersuara. Fade 10/30 ms."""
    import numpy as np
    import soundfile as sf

    segs = voiced_segments(src)
    x, sr = sf.read(str(src), dtype="float32")
    if x.ndim > 1:
        x = x.mean(axis=1)
    if len(segs) >= 2:
        a, b = max(0.0, segs[0][0] - 0.03), min(segs[0][1] + 0.05, (segs[0][1] + segs[1][0]) / 2)
        y = x[int(a * sr):int(b * sr)]
    else:
        hop = sr // 100
        rms = np.array([np.sqrt(np.mean(x[i:i + hop] ** 2) + 1e-12) for i in range(0, len(x) - hop, hop)])
        voiced = np.where(rms > rms.max() * 0.05)[0]
        if len(voiced) < 20:
            raise RuntimeError("bingkai terlalu pendek")
        lo, hi = voiced[0], voiced[-1]
        v = lo + int((hi - lo) * 0.3) + int(np.argmin(rms[lo + int((hi - lo) * 0.3):lo + int((hi - lo) * 0.7)]))
        y = x[:v * hop]
    n_in, n_out = int(0.01 * sr), int(0.03 * sr)
    if len(y) < sr * 0.12:
        raise RuntimeError("potongan terlalu pendek")
    y = y.copy()
    y[:n_in] *= np.linspace(0, 1, n_in)
    y[-n_out:] *= np.linspace(1, 0, n_out)
    sf.write(str(dst), y, sr)


# --------------------------------------------------------------------------
# Cek
# --------------------------------------------------------------------------

TONE_MARKS = {"\u0304": 1, "\u0301": 2, "\u030c": 3, "\u0300": 4}


def target_tone(py: str) -> int:
    for c in unicodedata.normalize("NFD", py):
        if c in TONE_MARKS:
            return TONE_MARKS[c]
    return 5


def toneless(py: str) -> str:
    """'nǚ' -> 'nü', 'Mā' -> 'ma' (tanda nada dibuang, titik dua ü tetap)."""
    d = "".join(c for c in unicodedata.normalize("NFD", py.lower()) if c not in TONE_MARKS)
    return unicodedata.normalize("NFC", d)


def prompt_for(hanzi: str) -> str:
    return next(p for p in PROMPTS if not set(p) & set(hanzi))


class Checker:
    def __init__(self):
        import os

        from faster_whisper import WhisperModel
        from opencc import OpenCC
        from pypinyin import Style, pinyin

        self.model = WhisperModel(WHISPER_MODEL, device="cpu", compute_type="int8",
                                  cpu_threads=os.cpu_count() or 4)
        self.t2s = OpenCC("t2s")
        self.readings = lambda ch: set(pinyin(ch, style=Style.TONE, heteronym=True)[0])
        self.sounds = lambda ch: {toneless(r) for r in self.readings(ch)}
        self.ref = tc.DEFAULT_REF

    def set_speaker_ref(self, mp3s: list[Path]):
        contours = []
        for p in mp3s:
            try:
                contours.append(tc.clean_semitones(tc.extract_f0(p)))
            except Exception as e:  # noqa: BLE001
                log(f"[f0] {p.name}: {e}")
        self.ref = tc.speaker_ref(contours)
        lo, hi = self.ref
        log(f"[f0] rentang penutur dari {len(contours)} file: {2 ** (lo / 12):.0f}-{2 ** (hi / 12):.0f} Hz "
            f"({hi - lo:.1f} semiton)")

    def norm(self, text: str) -> str:
        text = unicodedata.normalize("NFKC", text)
        text = text.replace("10", "十")
        text = "".join(DIGITS.get(c, c) for c in text)
        text = "".join(c for c in text if unicodedata.category(c)[0] not in "PZSC")
        return self.t2s.convert(text)

    def transcribe(self, path: Path, hanzi: str, max_tokens: int) -> str:
        # max_new_tokens: klip sangat pendek kadang memancing halusinasi panjang; dipotong supaya cepat
        # (transkrip panjang tetap gagal).
        segs, _ = self.model.transcribe(str(path), language="zh", beam_size=5, vad_filter=False,
                                        condition_on_previous_text=False, initial_prompt=prompt_for(hanzi),
                                        without_timestamps=True, max_new_tokens=max_tokens)
        return "".join(s.text for s in segs).strip()

    def sound_hits(self, got: str, target: str) -> int:
        syl = toneless(target)
        return sum(1 for c in got if HAN.match(c) and syl in self.sounds(c))

    def sound_ok(self, got: str, target: str) -> bool:
        """Bagian (a), transkrip langsung: 1-3 huruf, semuanya Han, minimal satu berbunyi = target."""
        return 1 <= len(got) <= 3 and all(HAN.match(c) for c in got) and self.sound_hits(got, target) >= 1

    def sound_ok_x3(self, got: str, target: str) -> bool:
        """Bagian (a), file diulang 3x: maksimal 8 huruf, >= 2 dan >= separuhnya berbunyi = target."""
        hits = self.sound_hits(got, target)
        return 2 <= len(got) <= 8 and hits >= 2 and 2 * hits >= len(got)

    def exact_ok(self, got: str, target: str, lo: int = 1, hi: int = 3) -> bool:
        """Transkrip = pinyin bernada persis: lo..hi huruf Han, SEMUANYA punya bacaan bernada = target
        (Whisper kadang menulis suku kata yang sama dua kali, mis. 酒酒 untuk jiǔ)."""
        t = unicodedata.normalize("NFC", target.lower())
        return lo <= len(got) <= hi and all(HAN.match(c) and t in self.readings(c) for c in got)

    def check(self, mp3: Path, item: dict, tmp: Path) -> dict:
        """Hasil cek satu file mp3: ok, transcript, check, sound, toneTarget, toneDetected, f0, reason."""
        h, py = item["hanzi"], item["pinyin"]
        transcript = self.transcribe(mp3, h, 2 * len(h) + 8)
        got = self.norm(transcript)
        if len(HAN.findall(h)) != 1:
            ok = got == self.norm(h)
            how = "text"
            # Whisper kadang menulis kata dalam huruf Latin ("Baba"): lolos bila hurufnya = pinyin tanpa nada.
            if not ok and got.isascii() and got.isalpha():
                ok = got.lower() == re.sub(r"[^a-zü]", "", toneless(py))
                how = "text(latin)"
            return {"ok": ok, "transcript": transcript, "check": how if ok else "none", "sound": None,
                    "toneTarget": None,
                    "toneDetected": None, "f0": None,
                    "reason": None if ok else f"transkrip '{got}' != '{self.norm(h)}'"}
        notes = [transcript]
        exact = self.exact_ok(got, py)
        sound = exact or self.sound_ok(got, py)
        how = "exact" if exact else "sound+f0"
        want = target_tone(py)
        try:
            detected, feats = tc.classify(tc.clean_semitones(tc.extract_f0(mp3)), self.ref)
        except Exception as e:  # noqa: BLE001
            log(f"[f0] {mp3}: {e}")
            detected, feats = 0, None
        tone_ok = want == 5 or detected == want
        if not exact and not (sound and tone_ok):
            rep = tmp / "repeat.wav"
            ms.run(["ffmpeg", "-y", "-v", "error", "-i", str(mp3), "-filter_complex",
                    "[0:a]apad=pad_dur=0.6,asplit=3[a][b][c];[a][b][c]concat=n=3:v=0:a=1", str(rep)])
            t2 = self.transcribe(rep, h, 24)
            notes.append(f"x3: {t2}")
            g2 = self.norm(t2)
            if self.exact_ok(g2, py, 2, 8):
                exact, sound, how = True, True, "exact(x3)"
            elif not sound and self.sound_ok_x3(g2, py):
                sound, how = True, "sound(x3)+f0"
        ok = exact or (sound and tone_ok)
        reasons = []
        if not ok:
            if not sound:
                reasons.append(f"bunyi: transkrip tidak berbunyi '{toneless(py)}'")
            if not tone_ok:
                reasons.append(f"nada: F0 terdeteksi {'tidak jelas' if detected == 0 else f'nada {detected}'}"
                               f", target nada {want}")
        return {"ok": ok, "transcript": " | ".join(notes), "check": how if ok else "none", "sound": bool(sound),
                "toneTarget": want, "toneDetected": detected, "f0": tc.round_features(feats),
                "reason": "; ".join(reasons) or None}


def score(res: dict) -> int:
    if res["ok"]:
        return 10
    s = 0
    if res["sound"]:
        s += 2
    if res["toneTarget"] is not None and res["toneDetected"] == res["toneTarget"]:
        s += 1
    return s


# --------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(ROOT / "public" / "audio" / "basics"))
    ap.add_argument("--work", default=str(ROOT / ".basics-work"))
    ap.add_argument("--force", action="store_true", help="buat ulang semua file")
    ap.add_argument("--recheck", action="store_true",
                    help="file yang teksnya tidak berubah hanya dicek ulang (sintesis ulang hanya bila gagal)")
    ap.add_argument("--budget-min", type=float, default=38.0)
    ap.add_argument("--shard", type=int, default=0, help="kerjakan item ke-i dengan i %% shards == shard")
    ap.add_argument("--shards", type=int, default=1)
    ap.add_argument("--part-dir", help="(dengan --shards > 1) tulis mp3 + part-<shard>.json ke sini")
    ap.add_argument("--merge", help="gabungkan hasil shard (folder berisi part-*.json + mp3) lalu tulis manifest")
    args = ap.parse_args()
    out, work = Path(args.out), Path(args.work)
    out.mkdir(parents=True, exist_ok=True)
    work.mkdir(parents=True, exist_ok=True)

    items = audio_items(json.loads(DATA.read_text(encoding="utf-8")))
    ids = [i["audioId"] for i in items]
    if len(set(ids)) != len(ids):
        sys.exit("audioId ganda di basics.json")
    voice = next(v for v in json.loads((ROOT / "scripts" / "tts" / "voices.json").read_text())["voices"]
                 if v["code"] == VOICE_CODE)

    manifest_path = out / "manifest.json"
    old = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else None
    old_files = (old or {}).get("files", {})

    def same_text(it):
        f = old_files.get(it["audioId"])
        return (f is not None and f.get("hanzi") == it["hanzi"] and f.get("pinyin") == it["pinyin"]
                and (out / f["path"]).exists())

    def mode(it):
        if args.force or not same_text(it):
            return "synth"
        f = old_files[it["audioId"]]
        cv = f.get("checkVersion")
        if cv == CHECK_VERSION and not f.get("ok") and f.get("attempts", 0) < MAX_ATTEMPTS and args.recheck:
            return "extend"
        if cv == CHECK_VERSION or (cv in COMPATIBLE_CHECKS and f.get("ok")):
            return "keep"
        if cv in COMPATIBLE_CHECKS and f.get("attempts", 0) >= 3 and args.recheck:
            return "checkonly"
        return "recheck" if args.recheck else "synth"

    if args.merge:
        return finalize(args, items, voice, old, merge_parts(Path(args.merge), out, items, old_files))
    mine = {it["audioId"] for k, it in enumerate(items) if k % args.shards == args.shard}
    modes = {it["audioId"]: (mode(it) if it["audioId"] in mine else "other") for it in items}
    # Item gagal yang teksnya (hanzi + pinyin) sama dengan item lain yang sudah lolos: file yang lolos
    # itu disalin lalu dicek lagi (tidak dihitung sebagai percobaan sintesis baru).
    twins: dict[str, str] = {}
    for it in items:
        aid = it["audioId"]
        if modes[aid] not in ("keep", "checkonly", "extend") or old_files[aid].get("ok"):
            continue
        for other in items:
            o = old_files.get(other["audioId"])
            if (other["audioId"] != aid and o and o.get("ok")
                    and (o.get("checkVersion") == CHECK_VERSION or o.get("checkVersion") in COMPATIBLE_CHECKS)
                    and same_text(other) and other["hanzi"] == it["hanzi"] and other["pinyin"] == it["pinyin"]):
                twins[aid] = other["audioId"]
                modes[aid] = "twin"
                break
    n_keep = sum(m == "keep" for m in modes.values())
    if twins:
        log(f"[basics] salin file lolos dari item kembar: {twins}")
    n_re = sum(m in ("recheck", "checkonly", "twin", "extend") for m in modes.values())
    n_mine = len(mine)
    log(f"[basics] shard {args.shard}/{args.shards}: {n_mine} item: {n_keep} tetap, {n_re} dicek ulang, "
        f"{n_mine - n_keep - n_re} dibuat")
    work_needed = n_keep < n_mine
    checker = Checker() if work_needed else None
    tts_box: list[Kokoro] = []

    def tts() -> Kokoro:
        if not tts_box:
            tts_box.append(Kokoro(voice))
        return tts_box[0]

    if checker:
        singles = [out / old_files[it["audioId"]]["path"] for it in items
                   if len(HAN.findall(it["hanzi"])) == 1 and same_text(it)]
        checker.set_speaker_ref(singles)

    def entry(res: dict, mp3_rel: str, attempts: int, variant: str, it: dict) -> dict:
        return {
            "path": mp3_rel, "durationSec": ms.duration(out / mp3_rel), "transcript": res["transcript"],
            "ok": bool(res["ok"]), "attempts": attempts, "check": res["check"], "variant": variant,
            "hanzi": it["hanzi"], "pinyin": it["pinyin"], "checkVersion": CHECK_VERSION,
            "sound": res["sound"], "toneTarget": res["toneTarget"], "toneDetected": res["toneDetected"],
            "f0": res["f0"], "reason": res["reason"],
        }

    def log_res(aid, it, label, res):
        log(f"[basics] {aid} {it['hanzi']} {it['pinyin']} {label}: {'OK' if res['ok'] else 'BEDA'} "
            f"'{res['transcript']}' [{res['check']}] bunyi={res['sound']} nada={res['toneDetected']}"
            f"/{res['toneTarget']} f0={res['f0']} {res['reason'] or ''}")

    files: dict[str, dict] = {}
    pending: list[str] = []
    t0 = time.monotonic()
    for it in items:
        aid = it["audioId"]
        m = modes[aid]
        if m == "other":
            continue
        if m == "keep":
            files[aid] = {**old_files[aid], "checkVersion": CHECK_VERSION}
            continue
        if time.monotonic() - t0 > args.budget_min * 60:
            pending.append(aid)
            if aid in old_files and (out / old_files[aid]["path"]).exists():
                files[aid] = old_files[aid]
            continue
        started = time.monotonic()
        tmp = work / aid
        if m == "twin":
            tmp.mkdir(parents=True, exist_ok=True)
            src = twins[aid]
            cur = tmp / "twin.mp3"
            cur.write_bytes((out / old_files[src]["path"]).read_bytes())
            res = checker.check(cur, it, tmp)
            log_res(aid, it, f"salinan {src}", res)
            if res["ok"]:
                rel = f"{aid}.mp3"
                (out / rel).write_bytes(cur.read_bytes())
                files[aid] = entry(res, rel, old_files[aid]["attempts"], f"copy of {src}", it)
                continue
            m = "extend" if old_files[aid].get("attempts", 0) < MAX_ATTEMPTS else "checkonly"
        if m == "checkonly":
            tmp.mkdir(parents=True, exist_ok=True)
            f = old_files[aid]
            cur = tmp / "existing.mp3"
            cur.write_bytes((out / f["path"]).read_bytes())
            res = checker.check(cur, it, tmp)
            log_res(aid, it, "cek ulang (tanpa sintesis)", res)
            files[aid] = entry(res, f["path"], f["attempts"], f.get("variant", ""), it)
            continue
        tmp.mkdir(parents=True, exist_ok=True)
        best = None
        attempts = 0
        variants = list(range(1, MAX_ATTEMPTS + 1))
        if m == "extend":
            f = old_files[aid]
            cur = tmp / "existing.mp3"
            cur.write_bytes((out / f["path"]).read_bytes())
            attempts = f["attempts"]
            best = {"score": score(f), "mp3": cur, "res": f, "variant": f.get("variant", "")}
            variants = list(range(attempts + 1, MAX_ATTEMPTS + 1))
            log(f"[basics] {aid}: lanjut percobaan {variants}")
        if m == "recheck":
            f = old_files[aid]
            cur = tmp / "existing.mp3"
            cur.write_bytes((out / f["path"]).read_bytes())
            try:
                res = checker.check(cur, it, tmp)
            except Exception as e:  # noqa: BLE001
                traceback.print_exc()
                log(f"[basics] {aid} cek ulang gagal: {type(e).__name__}: {e}")
                res = None
            if res is not None:
                log_res(aid, it, "cek ulang", res)
                attempts = 1
                best = {"score": score(res), "mp3": cur, "res": res, "variant": f.get("variant", "plain, speed 1.0")}
                # File lama = percobaan 1; sisa variasi yang belum dipakai (maksimal 3 percobaan).
                v = best["variant"]
                used = 2 if ("frame" in v or v.endswith("0.9")) else 3 if v.endswith("0.85") else 1
                variants = [v for v in range(1, MAX_ATTEMPTS + 1) if v != used][:MAX_ATTEMPTS - 1]
        if best is None or not best["res"]["ok"]:
            for attempt in variants:
                attempts += 1
                raw, mp3 = tmp / f"raw{attempt}.wav", tmp / f"try{attempt}.mp3"
                try:
                    variant = make_raw(tts(), it, attempt, raw)
                    ms.normalize(raw, mp3, tmp)
                    res = checker.check(mp3, it, tmp)
                except Exception as e:  # noqa: BLE001
                    traceback.print_exc()
                    log(f"[basics] {aid} variasi {attempt} gagal: {type(e).__name__}: {e}")
                    continue
                log_res(aid, it, f"#{attempts} ({variant})", res)
                s = score(res)
                if best is None or s > best["score"]:
                    best = {"score": s, "mp3": mp3, "res": res, "variant": variant}
                if res["ok"]:
                    break
        if best is None:
            log(f"[basics] {aid}: semua percobaan gagal, tidak ada file")
            continue
        log(f"[basics] {aid}: {time.monotonic() - started:.1f}s")
        rel = f"{aid}.mp3"
        if best["mp3"] != out / rel:
            data = best["mp3"].read_bytes()
            if not (out / rel).exists() or (out / rel).read_bytes() != data:
                (out / rel).write_bytes(data)
        files[aid] = entry(best["res"], rel, attempts, best["variant"], it)

    ref = checker.ref if checker else None
    if args.shards > 1:
        part = Path(args.part_dir)
        part.mkdir(parents=True, exist_ok=True)
        for f in files.values():
            (part / f["path"]).write_bytes((out / f["path"]).read_bytes())
        (part / f"part-{args.shard}.json").write_text(json.dumps(
            {"shard": args.shard, "files": files, "pending": pending, "ref": ref}, ensure_ascii=False),
            encoding="utf-8")
        log(f"[basics] shard {args.shard}: {sum(f['ok'] for f in files.values())}/{len(files)} lolos, "
            f"{len(pending)} tertunda")
        return
    finalize(args, items, voice, old, (files, pending, ref))


def merge_parts(part_dir: Path, out: Path, items: list[dict], old_files: dict):
    """Gabungkan part-*.json dari semua shard; mp3 shard disalin ke folder keluaran."""
    files: dict[str, dict] = {}
    pending: list[str] = []
    ref = None
    parts = sorted(part_dir.glob("part-*.json"))
    for p in parts:
        doc = json.loads(p.read_text(encoding="utf-8"))
        for aid, f in doc["files"].items():
            src = part_dir / f["path"]
            if src.exists() and (not (out / f["path"]).exists() or (out / f["path"]).read_bytes() != src.read_bytes()):
                (out / f["path"]).write_bytes(src.read_bytes())
            files[aid] = f
        pending += doc["pending"]
        ref = ref or doc.get("ref")
    log(f"[basics] gabung {len(parts)} shard: {len(files)} file, {len(pending)} tertunda")
    for it in items:  # item tanpa hasil shard (mis. shard gagal) -> tetap file lama, dicoba lagi nanti
        aid = it["audioId"]
        if aid not in files and aid not in pending:
            pending.append(aid)
            if aid in old_files and (out / old_files[aid]["path"]).exists():
                files[aid] = old_files[aid]
    order = [it["audioId"] for it in items]
    files = {aid: files[aid] for aid in order if aid in files}
    pending = [aid for aid in order if aid in pending]
    return files, pending, (tuple(ref) if ref else None)


def finalize(args, items, voice, old, result):
    files, pending, ref = result
    out = Path(args.out)
    manifest_path = out / "manifest.json"
    keep = {f["path"] for f in files.values()} | {"manifest.json"}
    for p in out.iterdir():
        if p.name not in keep:
            p.unlink()

    passed = sum(1 for f in files.values() if f["ok"])
    now = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    unchanged = (old is not None and old.get("files") == files and old.get("scriptVersion") == SCRIPT_VERSION
                 and old.get("pending", []) == pending)
    lo, hi = ref or tuple((old or {}).get("toneCheck", {}).get("refSemitones", tc.DEFAULT_REF))
    manifest = {
        "version": 1,
        "scriptVersion": SCRIPT_VERSION,
        "checkVersion": CHECK_VERSION,
        "generatedAt": old["generatedAt"] if unchanged else now,
        "voice": {"code": VOICE_CODE, "model": voice["model"], "repoId": voice["repoId"],
                  "modelRevision": voice["modelRevision"], "voiceId": voice["voiceId"], "speed": 1.0,
                  "license": voice["license"]},
        "format": {"codec": "mp3", "channels": 1, "bitrate": ms.BITRATE, "sampleRate": ms.SAMPLE_RATE,
                   "loudnessLUFS": ms.LUFS},
        "whisper": {"model": f"faster-whisper {WHISPER_MODEL}", "passed": passed, "total": len(items)},
        "toneCheck": {"method": "praat-parselmouth F0, aturan di scripts/tts-basics/tonecheck.py",
                      "refSemitones": [round(lo, 2), round(hi, 2)],
                      "refHz": [round(2 ** (lo / 12)), round(2 ** (hi / 12))]},
        "complete": not pending,
        "pending": pending,
        "files": files,
    }
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    by_id = {i["audioId"]: i for i in items}
    issues = [{"audioId": aid, "hanzi": by_id[aid]["hanzi"], "pinyin": by_id[aid]["pinyin"],
               "transcript": f["transcript"], "sound": f.get("sound"), "toneTarget": f.get("toneTarget"),
               "toneDetected": f.get("toneDetected"), "reason": f.get("reason"), "attempts": f["attempts"],
               "file": f["path"]}
              for aid, f in files.items() if not f["ok"] and aid not in pending]
    issues += [{"audioId": i["audioId"], "hanzi": i["hanzi"], "pinyin": i["pinyin"], "transcript": None,
                "sound": None, "toneTarget": None, "toneDetected": None, "reason": "tidak ada file (sintesis gagal)",
                "attempts": 3, "file": None}
               for i in items if i["audioId"] not in files and i["audioId"] not in pending]
    issues_doc = {
        "version": 1,
        "note": ("Dibuat oleh scripts/tts-basics/basics.py. File tetap dipakai situs (suara terbaik dari 3 "
                 "percobaan), tetapi belum lolos cek otomatis (Whisper + nada F0); alasan per item."),
        "whisper": manifest["whisper"],
        "pending": pending,
        "items": issues,
    }
    ISSUES.write_text(json.dumps(issues_doc, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    log(f"[basics] selesai: lolos {passed}/{len(items)}; {len(issues)} tercatat di audio-issues.json; "
        f"{len(pending)} belum dibuat (batas waktu)")
    gh_out = __import__("os").environ.get("GITHUB_OUTPUT")
    if gh_out:
        with open(gh_out, "a", encoding="utf-8") as fh:
            fh.write(f"complete={'true' if not pending else 'false'}\n")


if __name__ == "__main__":
    sys.exit(main())
