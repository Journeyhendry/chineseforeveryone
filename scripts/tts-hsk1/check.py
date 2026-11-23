"""Pengecek hasil Whisper untuk audio HSK 1 (task 4b ronde 2). Murni Python (opencc + pypinyin), diuji di test_check.py.

Prinsip: pengecek tidak boleh longgar pada salah ucap sungguhan. Yang dianggap sama hanya
  exact      teks sama setelah normalisasi (t2s, tanda baca/spasi dibuang, angka Arab dibaca)
  erhua      sama setelah 儿 penanda erhua dibuang di kedua sisi (bukan 儿 di 儿子 / 女儿)
  homophone  pinyin bernada sama persis (他/她/它, 的/地 ...)
  sound+tone suku kata tunggal: bunyi (tanpa nada, semua bacaan heteronim) sama, nada dari F0 cocok
  sound      suku kata tunggal bernada ringan (吧 吗 的 了 ...): bunyi saja
"""
from __future__ import annotations

import difflib
import re
import unicodedata

CHECK_VERSION = 2  # naikkan bila aturan pengecek berubah -> semua file dicek ulang (recheck)
CARRIER = "这个词是"
CARRIER_MAX_LETTERS = 6
# Tidak memuat huruf target kata/ungkapan (diuji di test_check.py).
INITIAL_PROMPT = "简体普通朗诵录音。"

# Varian tulis yang bukan beda bunyi/kata (t2s tidak mengubahnya).
VARIANTS = str.maketrans({"姊": "姐", "妳": "你", "祢": "你", "牠": "它", "祂": "他", "啊": "啊"})

DIGITS = "零一二三四五六七八九"
TONE_MARKS = {
    "ā": ("a", 1), "á": ("a", 2), "ǎ": ("a", 3), "à": ("a", 4),
    "ē": ("e", 1), "é": ("e", 2), "ě": ("e", 3), "è": ("e", 4),
    "ī": ("i", 1), "í": ("i", 2), "ǐ": ("i", 3), "ì": ("i", 4),
    "ō": ("o", 1), "ó": ("o", 2), "ǒ": ("o", 3), "ò": ("o", 4),
    "ū": ("u", 1), "ú": ("u", 2), "ǔ": ("u", 3), "ù": ("u", 4),
    "ǖ": ("v", 1), "ǘ": ("v", 2), "ǚ": ("v", 3), "ǜ": ("v", 4),
}


def zh_cardinal(n: int) -> str:
    if n < 10:
        return DIGITS[n]
    if n < 20:
        return "十" + (DIGITS[n - 10] if n > 10 else "")
    if n < 100:
        t, o = divmod(n, 10)
        return DIGITS[t] + "十" + (DIGITS[o] if o else "")
    if n < 1000:
        h, r = divmod(n, 100)
        s = DIGITS[h] + "百"
        if r == 0:
            return s
        if r < 10:
            return s + "零" + DIGITS[r]
        return s + zh_cardinal(r) if r >= 20 else s + "一" + zh_cardinal(r)
    return "".join(DIGITS[int(c)] for c in str(n))


def number_variants(s: str) -> list[str]:
    """Angka Arab dibaca: kardinal (21 -> 二十一) dan per angka (2012 -> 二零一二)."""
    if not re.search(r"\d", s):
        return [s]
    card = re.sub(r"\d+", lambda m: zh_cardinal(int(m.group())), s)
    digit = re.sub(r"\d+", lambda m: "".join(DIGITS[int(c)] for c in m.group()), s)
    return list(dict.fromkeys([card, digit]))


def parse_pinyin(syllable: str) -> tuple[str, int]:
    """'nǚ' -> ('nv', 3); 'ba' -> ('ba', 0) (nada ringan)."""
    tone, out = 0, []
    for ch in unicodedata.normalize("NFC", syllable.lower()):
        if ch in TONE_MARKS:
            base, tone = TONE_MARKS[ch]
            out.append(base)
        else:
            out.append("v" if ch == "ü" else ch)
    return "".join(out), tone


def strip_erhua(s: str) -> str:
    """Buang 儿 penanda erhua: 儿 yang didahului huruf lain, kecuali 女儿 dan sebelum 子 (儿子)."""
    return re.sub(r"(?<=[^女])儿(?!子)", "", s)


class Checker:
    def __init__(self):
        from opencc import OpenCC
        from pypinyin import Style, pinyin

        self.t2s = OpenCC("t2s")
        self._pinyin = pinyin
        self._style = Style

    # --- normalisasi -------------------------------------------------------
    def norm(self, text: str) -> str:
        text = unicodedata.normalize("NFKC", text)
        text = "".join(ch for ch in text if unicodedata.category(ch)[0] not in "PZSC")
        return self.t2s.convert(text).translate(VARIANTS)

    def forms(self, text: str) -> list[str]:
        return [self.norm(v).replace("两", "二") for v in number_variants(text)]

    def py(self, s: str) -> list[str]:
        return [unicodedata.normalize("NFC", x[0]).lower() for x in self._pinyin(s, style=self._style.TONE, errors=lambda c: [c])]

    def sounds(self, ch: str) -> set[str]:
        """Semua bacaan tanpa nada suatu huruf (heteronim)."""
        out = set()
        for rs in self._pinyin(ch, style=self._style.NORMAL, heteronym=True, errors=lambda c: [c]):
            out.update(r.replace("ü", "v") for r in rs)
        return out

    # --- pencocokan teks ---------------------------------------------------
    def match(self, text: str, heard: str) -> str | None:
        """'exact' | 'erhua' | 'homophone' | None."""
        a_vars, b_vars = self.forms(text), self.forms(heard)
        if any(a == b for a in a_vars for b in b_vars):
            return "exact"
        if any(a and strip_erhua(a) == strip_erhua(b) for a in a_vars for b in b_vars):
            return "erhua"
        if any(b and self.py(a) == self.py(b) for a in a_vars for b in b_vars):
            return "homophone"
        if any(b and self.py(strip_erhua(a)) == self.py(strip_erhua(b)) for a in a_vars for b in b_vars):
            return "erhua"
        return None

    def similarity(self, text: str, heard: str) -> float:
        return max(difflib.SequenceMatcher(None, a, b).ratio() for a in self.forms(text) for b in self.forms(heard))

    def sound_match(self, pinyin: str, heard: str) -> bool:
        """Suku kata tunggal: satu huruf terdengar yang salah satu bacaannya = bunyi target (tanpa nada)."""
        base, _ = parse_pinyin(pinyin.split()[0])
        h = strip_erhua(self.norm(heard))
        return len(h) == 1 and base in self.sounds(h)

    # --- kalimat pembawa ---------------------------------------------------
    def carrier_candidates(self, text: str, transcript: str) -> list[str]:
        """Kandidat 'yang terdengar' dari transkrip [pembawa + item]: sisa setelah pembawa, dan ekor sepanjang target."""
        t = self.norm(transcript)
        pre = self.norm(CARRIER)
        out = []
        if t.startswith(pre) or (len(t) >= len(pre) and self.py(t[: len(pre)]) == self.py(pre)):
            out.append(t[len(pre):])
        lens = {len(a) for a in self.forms(text)} | {len(strip_erhua(a)) for a in self.forms(text)}
        for n in sorted(lens):
            if 0 < n <= len(t):
                out.append(t[-n:])
        return list(dict.fromkeys(out))

    def is_short(self, text: str) -> bool:
        return len(self.norm(text)) <= CARRIER_MAX_LETTERS

    def expected_tone(self, pinyin: str | None) -> int | None:
        if not pinyin or len(pinyin.split()) != 1:
            return None
        return parse_pinyin(pinyin)[1]

    def evaluate(self, text: str, pinyin: str | None, candidates: list[str], hz_fn=None) -> dict:
        """candidates: hal-hal yang mungkin terdengar (transkrip polos, atau sisa/ekor setelah pembawa).
        hz_fn: fungsi tanpa argumen -> kontur F0 klip (dipanggil hanya bila perlu).
        Hasil: {ok, how, heard, sim, tone?}."""
        best_sim, best = -1.0, ""
        for c in candidates:
            if not c.strip():
                continue
            how = self.match(text, c)
            if how:
                return {"ok": True, "how": how, "heard": c, "sim": 1.0}
            sim = self.similarity(text, c)
            if sim > best_sim:
                best_sim, best = sim, c
        want = self.expected_tone(pinyin)
        if want is not None and len(self.norm(text)) == 1:
            for c in candidates:
                if c.strip() and self.sound_match(pinyin, c):
                    if want == 0:
                        return {"ok": True, "how": "sound", "heard": c, "sim": 0.8}
                    from tone import classify, tone_ok

                    hz = hz_fn() if hz_fn else []
                    got = classify(hz)
                    if tone_ok(want, hz):
                        return {"ok": True, "how": "sound+tone", "heard": c, "sim": 0.9, "tone": got}
                    return {"ok": False, "how": f"nada {got} bukan {want}", "heard": c, "sim": 0.7, "tone": got}
        return {"ok": False, "how": "beda", "heard": best, "sim": best_sim}
