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
