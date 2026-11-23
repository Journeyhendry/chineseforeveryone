"""Tes unit pengecek (jalan di CI sebelum build): python -m pytest scripts/tts-hsk1"""
import json
import math
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))
import check  # noqa: E402
import tone  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent.parent
C = check.Checker()


def ev(text, pinyin, *cands, hz=None):
    return C.evaluate(text, pinyin, list(cands), (lambda: hz) if hz is not None else None)


# --- normalisasi --------------------------------------------------------------
def test_t2s_and_punctuation():
    assert C.match("学习汉语", "學習漢語。") == "exact"
    assert C.match("你好吗", "你好， 吗？") == "exact"


def test_variant_char():
    assert C.match("姐姐", "姊姊") == "exact"


def test_numbers():
    assert C.match("二十一", "21") == "exact"
    assert C.match("二零一二年", "2012年") == "exact"


def test_erhua_only_marker():
    assert C.match("那儿", "那") == "erhua"
    assert C.match("一点儿", "一点") == "erhua"
    assert C.match("这儿", "这") == "erhua"
    assert C.match("儿子", "子") is None
    assert C.match("女儿", "女") is None
    assert C.match("儿子", "子儿") is None
    assert check.strip_erhua("女儿") == "女儿" and check.strip_erhua("儿子") == "儿子"


def test_homophone_toned():
    assert C.match("他", "她") == "homophone"
    assert C.match("她们", "他们") == "homophone"
    assert C.match("吃", "知") is None
    assert C.match("出租车", "出租撤") is None
    assert C.match("打电话", "戴电话") is None


# --- kalimat pembawa --------------------------------------------------------
def test_carrier_tail():
    for t, tr in [("白天", "这个词是五白天"), ("病", "这个词是得病"), ("半", "这个词是一半"), ("八", "这个词是八")]:
        cands = C.carrier_candidates(t, tr)
        assert any(C.match(t, c) for c in cands) or t == "半", (t, cands)
    assert C.carrier_candidates("白天", "这个词是五白天")[-1] == "白天"


def test_carrier_does_not_rescue_wrong_word():
    cands = C.carrier_candidates("吃", "这个词是知")
    assert not ev("吃", "chī", *cands)["ok"]
    cands = C.carrier_candidates("出租车", "这个词是出租撤")
    assert not ev("出租车", "chūzūchē", *cands)["ok"]


# --- suku kata tunggal --------------------------------------------------------
def test_sound_only_particles():
    assert ev("吧", "ba", "把")["how"] == "sound"
    assert ev("吗", "ma", "妈")["how"] == "sound"
    assert not ev("吧", "ba", "Bye")["ok"]


def test_sound_plus_tone():
    falling = [300 * 2 ** (-s / 12) for s in [0, 1, 3, 5, 7, 9, 10, 11]]
    rising = [250 * 2 ** (s / 12) for s in [0, 0.4, 0.8, 1.4, 2.2, 3.2, 4.4, 5.6]]
    assert ev("百", "bǎi", "掰", hz=rising)["ok"] is True  # T3 vs 'tidak turun': diterima kelompok T1-T3
    assert ev("爱", "ài", "矮", hz=falling)["how"] == "sound+tone"
    r = ev("爱", "ài", "矮", hz=rising)
    assert not r["ok"] and r["tone"] != 4
    assert not ev("吃", "chī", "知", hz=rising)["ok"]  # bunyi beda -> gagal


def test_exact_pinyin_wins_without_f0():
    assert ev("他", "tā", "她")["how"] == "homophone"


# --- nada ---------------------------------------------------------------------
def test_tone_rules():
    fall = [300 * 2 ** (-s / 12) for s in [0, 1, 2, 4, 6, 8, 9, 10, 11]]
    flat = [250.0] * 12
    assert tone.classify(fall) == 4
    assert tone.classify(flat) == 1
    assert tone.classify([250.0] * 3) is None
    assert tone.tone_ok(4, fall) and not tone.tone_ok(1, fall)
    assert tone.tone_ok(2, flat) and not tone.tone_ok(4, flat)


# --- konfigurasi --------------------------------------------------------------
def test_initial_prompt_has_no_target_letters():
    items = json.loads((ROOT / "data" / "hsk1" / "audio-items.json").read_text(encoding="utf-8"))["items"]
    letters = set("".join(i["text"] for i in items if i["kind"] in ("word", "word-slow", "casual", "casual-slow")))
    assert not [c for c in check.INITIAL_PROMPT if c in letters]


def test_parse_pinyin():
    assert check.parse_pinyin("nǚ") == ("nv", 3)
    assert check.parse_pinyin("ba") == ("ba", 0)


# --- ronde 3 --------------------------------------------------------------------
def test_single_homophone_must_match_item_pinyin():
    assert not ev("只", "zhī", "指")["ok"]  # bacaan bawaan 只 = zhǐ, tetapi item = zhī
    assert ev("只", "zhī", "知")["how"] == "homophone"
    assert ev("他", "tā", "她")["how"] == "homophone"
    assert not C.still_passes("只", "zhī", {"ok": True, "check": "homophone", "transcript": "指"})
    assert C.still_passes("他", "tā", {"ok": True, "check": "homophone", "transcript": "她。"})
    assert C.still_passes("白天", "báitiān", {"ok": True, "check": "exact", "transcript": "白天"})
    assert not C.still_passes("白天", "báitiān", {"ok": False, "check": "beda", "transcript": "百天"})


RISE = [250 * 2 ** (s / 12) for s in [0, 0.4, 0.8, 1.4, 2.2, 3.2, 4.4, 5.6]]
FALL = [300 * 2 ** (-s / 12) for s in [0, 1, 2, 4, 6, 8, 9, 10, 11]]


def x3(text, pinyin, tr, hz=None):
    return C.evaluate_x3(text, pinyin, tr, (lambda: hz) if hz is not None else None)


def test_x3_accepts_only_repeated_target():
    assert x3("他", "tā", "他，他，他。")["ok"]
    assert x3("他", "tā", "她她")["how"] == "homophone"
    assert x3("爸爸", "bàba", "爸爸 爸爸 爸爸")["ok"]
    assert x3("那儿", "nàr", "那那那")["how"] == "erhua"
    assert x3("二", "èr", "二二二")["ok"]
    assert not x3("他", "tā", "太阳")["ok"]
    assert not x3("他", "tā", "他太阳")["ok"]
    assert not x3("他", "tā", "他")["ok"]  # tidak diulang = bukan bukti x3
    assert not x3("吃", "chī", "知知知")["ok"]
    assert not x3("早上", "zǎoshang", "走上走上走上")["ok"]
    assert not x3("出租车", "chūzūchē", "出租撤出租撤出租撤")["ok"]
    assert not x3("只", "zhī", "指指指")["ok"]
    assert not x3("爸爸", "bàba", "Baba Baba Baba")["ok"]


def test_x3_single_syllable_sound_needs_tone():
    r = x3("水", "shuǐ", "睡睡睡", hz=FALL)
    assert not r["ok"] and r.get("sound") is True
    assert x3("水", "shuǐ", "睡睡睡", hz=RISE)["how"] == "sound+tone"
    assert not x3("水", "shuǐ", "睡退睡", hz=RISE)["ok"]


# --- ronde 3: meluruskan nada -----------------------------------------------------
def test_speaker_ref_min_span():
    lo, hi = tone.speaker_ref([[250.0 + i * 0.1 for i in range(40)]])
    assert 12 * math.log2(hi / lo) == pytest.approx(tone.MIN_SPAN_ST)
    lo, hi = tone.speaker_ref([[150.0] * 10 + [400.0] * 10 + [250.0] * 10])
    assert lo == pytest.approx(150.0) and hi == pytest.approx(400.0)


@pytest.mark.parametrize("t", [1, 2, 3, 4])
def test_target_contour_passes_tone_check(t):
    ref = (205.0, 325.0)  # rentang P3 terukur (file lolos) di ronde 3
    hz = [h for _, h in tone.target_contour(t, ref, n=30)]
    assert tone.tone_ok(t, hz)
    assert all(ref[0] * 0.85 <= h <= ref[1] * 1.01 for h in hz)
    if t != 4:
        assert not tone.tone_ok(4, hz)


def test_target_contour_shapes():
    ref = (205.0, 325.0)
    c = {t: [h for _, h in tone.target_contour(t, ref, n=21)] for t in (1, 2, 3, 4)}
    assert max(c[1]) / min(c[1]) < 1.03  # datar
    assert c[2][-1] > c[2][0] * 1.15  # naik
    assert min(c[3][5:16]) < min(c[3][0], c[3][-1])  # turun lalu naik
    assert c[4][0] > c[4][-1] * 1.3  # turun


# --- ronde 3: variasi + koreksi G2P ---------------------------------------------------
def _ba():
    import build_audio

    return build_audio


def test_r3_variants_by_length():
    ba = _ba()
    assert ba.r3_variants({"text": "水"})[0] == "bingkai-awal"
    assert "seru" in ba.r3_variants({"text": "早上"})
    assert ba.r3_variants({"text": "我们明天下午去商店买东西。"}) == ["kecepatan-0.95", "kecepatan-1.05"]


def test_fix_phonemes_replaces_only_target():
    ba = _ba()
    table = {"哪些": "ㄋㄟ3ㄒㄝ1", "哪些，哪些。": "ㄋㄟ3ㄒㄝ1, ㄋㄟ3ㄒㄝ1."}
    g2p = lambda t: (table[t], None)  # noqa: E731
    assert ba.fix_phonemes(g2p, "哪些，哪些。", "哪些", "ㄋㄚ3ㄒㄝ1") == "ㄋㄚ3ㄒㄝ1, ㄋㄚ3ㄒㄝ1."
    with pytest.raises(RuntimeError):
        ba.fix_phonemes(lambda t: ("ㄋㄟ3" if t == "哪" else "ㄋㄚ4", None), "那", "哪", "ㄋㄚ3")


def test_g2p_fix_matches_data_pinyin():
    """Tiap koreksi G2P sesuai pinyin kata di data (nada per suku kata)."""
    ba = _ba()
    words = {w["hanzi"]: w["pinyin"] for w in json.loads((ROOT / "data" / "hsk1" / "words.json").read_text(encoding="utf-8"))}
    for w, ps in ba.G2P_FIX.items():
        tones = [int(d) for d in ps if d.isdigit()]
        want = [check.parse_pinyin(s)[1] or 5 for s in C.py(w)]
        assert len(tones) == len(w), w
        py = words[w]
        assert py, w
        # nada dari pinyin data (suku kata per huruf)
        syl = [check.parse_pinyin(x)[1] or 5 for x in _split_pinyin(py, len(w))]
        assert tones == syl, (w, ps, py, want)


def _split_pinyin(py: str, n: int) -> list[str]:
    """Pecah pinyin kata HSK 1 (tanpa spasi) menjadi n suku kata (cukup untuk kata pendek di G2P_FIX)."""
    import re

    parts = re.findall(r"[^aeiouüāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]*[aeiouüāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]+(?:ng|n(?![aeiouüāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ])|r)?", py)
    assert len(parts) == n, (py, parts)
    return parts


def test_g2p_fix_still_needed():
    """Koreksi hanya untuk kata yang G2P misaki-nya memang berbeda (dilewati bila misaki tidak terpasang)."""
    zh = pytest.importorskip("misaki.zh")
    g = zh.ZHG2P(version="1.1")
    for w, ps in _ba().G2P_FIX.items():
        assert g(w)[0] != ps, w
