#!/usr/bin/env python3
"""Task 4c ronde 2 · penyelarasan paksa (forced alignment) untuk batas suku kata.

Menggantikan pemotongan "lembah intensitas" (tone_analysis.segment) bila model tersedia. Dipakai SAMA oleh
tone_refs.py (rujukan asli) dan tone_score.py (audio P3/L3 dan Tahap 0), supaya kedua sisi diukur dengan jalur yang sama.

Model: torchaudio MMS_FA (wav2vec2 CTC multibahasa, MMS, lisensi CC BY-NC 4.0 untuk bobot model; dipakai hanya untuk
mengukur, hasil yang disimpan hanya angka). Transkrip = huruf pinyin tanpa nada (a-z), satu token per huruf; huruf
tiap suku kata dikelompokkan lagi menjadi suku kata. Erhua: huruf "r" ditempel ke suku kata sebelumnya.

Alur:
  letters_from_numbered / letters_from_text   daftar huruf per suku kata (murni, dites)
  Aligner.align(wave16k, letters)             -> [(t_awal_token_pertama, t_akhir_token_terakhir)] per suku kata
  bounds_from_spans(spans, inten, span)       -> [(t0, t1)] batas suku kata: titik potong = intensitas terendah di antara
                                                 token terakhir suku kata i dan token pertama suku kata i+1 (murni, dites)
Bila model tidak ada / penyelarasan gagal / jumlah suku kata tidak cocok, pemanggil memakai pemotongan DP (catatan 'al': 0).
"""
from __future__ import annotations

import os
import re

import numpy as np

import tone_analysis as ta

FRAME = 0.02  # detik per bingkai emisi MMS_FA (320 sampel pada 16 kHz)
ALIGN_ENV = "TONE_ALIGN"  # =1 mengaktifkan penyelarasan di analyze_file bila torch ada


# --------------------------------------------------------------------------
# Huruf per suku kata (murni)
# --------------------------------------------------------------------------

def _clean_letters(s: str) -> str:
    s = s.lower().replace("ü", "u").replace("v", "u").replace(":", "")
    return re.sub(r"[^a-z]", "", s)


def letters_from_numbered(numbered: str) -> list[str]:
    """'mian4 tiao2 r5' -> ['mian', 'tiaor']; 'nv3' -> ['nu']. Erhua 'r' ditempel ke suku kata sebelumnya."""
    out: list[str] = []
    for tok in numbered.split():
        base = re.sub(r"[0-5]$", "", tok.lower())
        if base == "r" and out:
            out[-1] += "r"
        elif base:
            out.append(_clean_letters(base))
    return out


def letters_from_text(text: str) -> list[str] | None:
    """Huruf pinyin tanpa nada dari pypinyin per huruf Han; erhua (儿 sebagai penanda) -> 'r' pada suku kata sebelumnya.
    None bila tak ada huruf Han."""
    from pypinyin import Style, lazy_pinyin

    t = ta.hanzi_only(text)
    if not t:
        return None
    py = lazy_pinyin(t, style=Style.NORMAL)
    out: list[str] = []
    for i, p in enumerate(py):
        if ta.is_erhua(t, i) and out:
            out[-1] += "r"
        else:
            out.append(_clean_letters(p))
    return out


# --------------------------------------------------------------------------
# Token -> suku kata -> batas (murni)
# --------------------------------------------------------------------------

def group_spans(token_spans: list[tuple[float, float]], letters: list[str]) -> list[tuple[float, float]] | None:
    """token_spans: (awal, akhir) detik per huruf (urutan transkrip). Hasil: (awal token pertama, akhir token terakhir)
    per suku kata. None bila jumlah token tidak cocok dengan jumlah huruf."""
    if len(token_spans) != sum(len(x) for x in letters):
        return None
    out, k = [], 0
    for lt in letters:
        seg = token_spans[k:k + len(lt)]
        k += len(lt)
        out.append((float(seg[0][0]), float(seg[-1][1])))
    return out


def bounds_from_spans(spans: list[tuple[float, float]], times: np.ndarray, inten: np.ndarray,
                      span: tuple[float, float]) -> list[tuple[float, float]] | None:
    """Batas suku kata (t0, t1) menutup `span` (rentang ujaran). Titik potong antara suku kata i dan i+1 = bingkai berintensitas
    terendah (intensitas dihaluskan 3 bingkai) di antara akhir token terakhir i dan awal token pertama i+1 (dibulatkan keluar
    1 bingkai bila celah kosong). None bila urutan tak monoton."""
    n = len(spans)
    if n == 0:
        return None
    s0, s1 = span
    sm = np.convolve(inten, np.ones(3) / 3, mode="same")
    cuts = []
    for i in range(n - 1):
        lo, hi = spans[i][1], spans[i + 1][0]
        if hi < lo:  # token bertumpuk: tengah
            lo = hi = (lo + hi) / 2
        a = int(round(lo / ta.STEP))
        b = max(a + 1, int(round(hi / ta.STEP)) + 1)
        a, b = max(0, min(a, len(sm) - 1)), max(1, min(b, len(sm)))
        k = a + int(np.argmin(sm[a:b])) if b > a else a
        cuts.append(float(times[min(k, len(times) - 1)]))
    edges = [s0, *cuts, s1]
    if any(b <= a for a, b in zip(edges, edges[1:])):
        return None
    return list(zip(edges[:-1], edges[1:]))


# --------------------------------------------------------------------------
# Model (torchaudio MMS_FA), dimuat malas
# --------------------------------------------------------------------------

class Aligner:
    def __init__(self):
        import torch
        import torchaudio

        self.torch, self.torchaudio = torch, torchaudio
        bundle = torchaudio.pipelines.MMS_FA
        self.sr = bundle.sample_rate
        self.model = bundle.get_model(with_star=False).eval()
        self.dict = bundle.get_dict(star=None)
        torch.set_num_threads(int(os.environ.get("TONE_ALIGN_THREADS", "4")))

    def align(self, wave: np.ndarray, letters: list[str]) -> list[tuple[float, float]] | None:
        """wave: float32 mono 16 kHz. Hasil per suku kata (awal, akhir) detik; None bila gagal."""
        torch = self.torch
        chars = "".join(letters)
        if not chars or any(c not in self.dict for c in chars):
            return None
        wav = torch.from_numpy(np.asarray(wave, dtype=np.float32))[None]
        with torch.inference_mode():
            emission, _ = self.model(wav)
        if emission.shape[1] < len(chars) * 1:
            return None
        targets = torch.tensor([[self.dict[c] for c in chars]], dtype=torch.int32)
        try:
            ali, scores = self.torchaudio.functional.forced_align(emission, targets, blank=0)
        except Exception:  # noqa: BLE001
            return None
        spans = self.torchaudio.functional.merge_tokens(ali[0], scores[0].exp())
        toks = [(sp.start * FRAME, sp.end * FRAME) for sp in spans]
        return group_spans(toks, letters)


_ALIGNER = None
_ALIGNER_FAILED = False


def get_aligner() -> Aligner | None:
    """Aligner tunggal per proses; None bila dimatikan (TONE_ALIGN != 1) atau torch/model tak tersedia."""
    global _ALIGNER, _ALIGNER_FAILED
    if os.environ.get(ALIGN_ENV, "0") != "1" or _ALIGNER_FAILED:
        return None
    if _ALIGNER is None:
        try:
            _ALIGNER = Aligner()
        except Exception as e:  # noqa: BLE001
            import sys

            print(f"[align] model tak bisa dimuat, pakai pemotongan DP: {type(e).__name__}: {e}", file=sys.stderr, flush=True)
            _ALIGNER_FAILED = True
            return None
    return _ALIGNER
