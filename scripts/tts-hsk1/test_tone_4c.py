"""Tes fungsi murni task 4c (segmentasi, nada yang diharapkan + sandhi, templat, pengenal, skor). Tanpa audio/model."""
from __future__ import annotations

import math
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))
import tone_analysis as ta  # noqa: E402
import tone_score as ts  # noqa: E402


# ---- nada yang diharapkan -------------------------------------------------

def test_numbered_and_erhua():
    assert ta.parse_numbered("hao3") == ("hao", 3)
    assert ta.parse_numbered("ba5") == ("ba", 0)
    assert ta.parse_numbered("nv3") == ("nv", 3)
    assert ta.expected_tones_from_numbered("mian4 tiao2 r5") == [4, 2]
    assert ta.expected_tones_from_numbered("bu2 ke4 qi5") == [2, 4, 0]


def test_third_tone_sandhi():
    assert ta.apply_third_tone_sandhi([3, 3]) == [2, 3]
    assert ta.apply_third_tone_sandhi([3, 3, 3]) == [2, 2, 3]
    assert ta.apply_third_tone_sandhi([3, 1]) == [3, 1]
    assert ta.expected_tones_from_numbered("ni3 hao3") == [2, 3]


def test_expected_from_text():
    pytest.importorskip("pypinyin")
    assert ta.expected_tones_from_text("你好") == [2, 3]
    assert ta.expected_tones_from_text("一个") == [2, 4]       # sandhi 一 dari pypinyin
    assert ta.expected_tones_from_text("不是") == [2, 4]       # sandhi 不
    assert ta.expected_tones_from_text("我有3个") is None      # angka: dilewati
    assert ta.expected_tones_from_text("这儿") == [4]          # erhua tidak dihitung
    assert ta.expected_tones_from_text("女儿") == [3, 2]


def test_syllable_count_and_next():
    assert ta.syllable_count("面条儿") == 2
    assert ta.syllable_count("女儿") == 2
    assert ta.syllable_count("儿子") == 2
    assert ta.next_tones([2, 3, 0]) == [3, 0, -1]
    assert [ta.length_class(n) for n in (1, 2, 4, 5)] == ["single", "word", "word", "sent"]


# ---- F0 -------------------------------------------------------------------

def test_hz_to_st_and_octave_repair():
    st = ta.hz_to_st([100, 200, 0, 50])
    assert st[0] == 0 and abs(st[1] - 12) < 1e-9 and math.isnan(st[2]) and abs(st[3] + 12) < 1e-9
    seq = np.array([5.0, 5.2, 5.1 + 12, 5.3, 5.4, 5.2, 5.1])
    fixed = ta.repair_octaves(seq)
    assert np.nanmax(np.abs(fixed - 5.2)) < 1.0


def test_repair_keeps_gradual_fall():
    seq = np.linspace(10, 0, 30)
    assert np.allclose(ta.repair_octaves(seq), seq)


# ---- segmentasi -----------------------------------------------------------

def synth_energy(n_syl=3, syl=25, gap=6, floor=30.0, peak=70.0):
    """Intensitas dB: n_syl 'bukit' dipisah lembah dangkal `gap` bingkai."""
    parts = []
    for _ in range(n_syl):
        parts.append(np.full(syl, peak))
        parts.append(np.full(gap, floor + 15))
    x = np.concatenate(parts[:-1])
    return x


def test_segment_finds_valleys():
    inten = synth_energy(3, 25, 6)
    voiced = inten > 50
    segs = ta.segment(inten, voiced, [1, 1, 1])
    assert len(segs) == 3 and segs[0][0] == 0 and segs[-1][1] == len(inten)
    assert all(a < b for a, b in segs)
    for (a, b), (c, d) in zip(segs, segs[1:]):
        assert b == c
    cut1 = segs[0][1]
    assert 22 <= cut1 <= 33  # di dalam lembah 25..31


def test_segment_single_and_short():
    assert ta.segment(np.ones(40) * 60, np.ones(40, bool), [1]) == [(0, 40)]
    segs = ta.segment(np.ones(7) * 60, np.ones(7, bool), [1, 1, 1])
    assert len(segs) == 3 and segs[-1][1] == 7


def test_segment_weights_neutral_short():
    inten = np.full(100, 60.0)  # tanpa lembah: pembagian ikut bobot
    segs = ta.segment(inten, np.ones(100, bool), [1.0, 0.6])
    assert (segs[0][1] - segs[0][0]) > (segs[1][1] - segs[1][0])


def test_effective_duration_removes_pause():
    inten = np.concatenate([np.full(20, 60.0), np.full(30, 10.0), np.full(20, 60.0)])
    assert abs(ta.effective_duration(inten, 0, 70, 60.0) - 0.40) < 1e-9
    short_gap = np.concatenate([np.full(20, 60.0), np.full(5, 10.0), np.full(20, 60.0)])
    assert abs(ta.effective_duration(short_gap, 0, 45, 60.0) - 0.45) < 1e-9


def make_track(st_list, step=ta.STEP):
    times = np.arange(len(st_list)) * step
    return times, np.array(st_list, dtype=float)


def test_measure_two_syllables_with_synthetic_track():
    # 2 suku kata: naik lalu turun, lembah intensitas di tengah
    st = np.concatenate([np.linspace(0, 6, 30), np.full(5, np.nan), np.linspace(8, -2, 30)])
    inten = np.concatenate([np.full(30, 70.0), np.full(5, 45.0), np.full(30, 70.0)])
    times, st = make_track(st)
    m = ta.measure(times, st, inten, [2, 4])
    assert m and len(m["syl"]) == 2
    s1, s2 = m["syl"]
    assert s1["c"][-1] > s1["c"][0] + 4 and s2["c"][-1] < s2["c"][0] - 6
    assert s1["t1"] <= s2["t0"] + 0.06
    assert 0.2 < s1["d"] < 0.4


def test_measure_unvoiced_syllable_has_none():
    st = np.concatenate([np.linspace(0, 6, 30), np.full(30, np.nan)])
    inten = np.concatenate([np.full(30, 70.0), np.full(30, 66.0)])
    times, st = make_track(st)
    m = ta.measure(times, st, inten, [2, 0])
    assert m["syl"][1]["c"] is None


# ---- templat --------------------------------------------------------------

def fake_rows():
    rows = []
    shapes = {1: np.zeros(10), 2: np.linspace(-3, 3, 10), 3: np.concatenate([np.linspace(-1, -4, 5), np.linspace(-4, 0, 5)]),
              4: np.linspace(5, -5, 10)}
    rng = np.random.default_rng(0)
    for t, sh in shapes.items():
        for i in range(60):
            c = (sh + rng.normal(0, 0.4, 10)).round(2).tolist()
            rows.append({"tone": t, "next": [1, 2, 3, 4, 0, -1][i % 6], "cls": "single" if i % 2 else "word", "spk": f"s{i % 4}",
                         "c_rel": c, "d": 0.2 + 0.1 * (i % 5) / 4, "vd": 0.18, "r": float(max(c) - min(c))})
    return rows


def test_build_templates_shapes_and_stats():
    tpl = ta.build_templates(fake_rows())
    assert set(tpl["tones"]) == {"1", "2", "3", "4"}
    assert tpl["tones"]["4"]["all"]["mean"][0] > 4 > -4 > tpl["tones"]["4"]["all"]["mean"][-1]
    assert tpl["tones"]["2"]["all"]["mean"][-1] > tpl["tones"]["2"]["all"]["mean"][0]
    assert "6" not in tpl["tones"]["1"]["next"] and "1" in tpl["tones"]["1"]["next"]
    d = tpl["stats"]["single/4"]["dur"]
    assert d["p5"] <= d["p10"] <= d["p50"] <= d["p90"]
    assert tpl["stats"]["word/3"]["range"]["p50"] > 2


def test_pct_empty():
    assert ta.pct([]) == {}


# ---- DTW + pengenal ---------------------------------------------------------

def test_dtw_zero_and_ordering():
    a = np.linspace(0, 5, 10)
    assert ta.dtw(a, a) == 0
    assert ta.dtw(np.zeros(10), np.zeros(10) + 2) == pytest.approx(2.0)
    assert ta.dtw(a, a + 2) <= 2.0
    assert ta.dtw(a, a[::-1]) > ta.dtw(a, a + 1)


def test_classifier_roundtrip_with_sklearn():
    pytest.importorskip("sklearn")
    import tone_templates as tt

    rows = fake_rows()
    model, ev = tt.train(rows)
    assert ev["acc"] > 0.9
    data = {1: np.zeros(10), 2: np.linspace(-3, 3, 10), 4: np.linspace(5, -5, 10)}
    for t, c in data.items():
        pred, probs = ta.clf_predict(model, ta.clf_features(c, 0.18))
        assert pred == t and abs(sum(probs) - 1) < 0.01


def test_clf_predict_linear_model():
    model = {"mean": [0.0, 0.0], "scale": [1.0, 1.0], "W": [[[1, 0, 0, 0], [0, 1, 0, 0]]], "b": [[0, 0, 0, 0]]}
    assert ta.clf_predict(model, [3.0, 0.0])[0] == 1
    assert ta.clf_predict(model, [0.0, 3.0])[0] == 2


# ---- skor -------------------------------------------------------------------

def mini_templates():
    tpl = ta.build_templates(fake_rows())
    return {"tones": tpl["tones"], "stats": tpl["stats"]}


def test_short_limit_and_sentence_factor():
    tpl = mini_templates()
    p5 = tpl["stats"]["word/3"]["dur"]["p5"]
    assert ts.short_limit(tpl, "word", 3) == p5
    assert ts.short_limit(tpl, "sent", 3) == pytest.approx(p5 * ts.SENT_SHORT_FACTOR)
    assert ts.short_limit(tpl, "word", 9) is None


def test_combined_score_monotonic():
    base = ts.combined_score(1.0, 0.9, 1.0, 1.0, 0, 3)
    assert base > ts.combined_score(0.5, 0.9, 1.0, 1.0, 0, 3)     # nada salah
    assert base > ts.combined_score(1.0, 0.5, 1.0, 1.0, 0, 3)     # keyakinan rendah
    assert base > ts.combined_score(1.0, 0.9, 0.5, 1.0, 0, 3)     # rentang sempit
    assert base > ts.combined_score(1.0, 0.9, 1.0, 1.0, 1, 3)     # ada suku kata pendek
    assert base > ts.combined_score(1.0, 0.9, 1.0, 5.0, 0, 3)     # kontur jauh
    assert ts.combined_score(1.0, 1.0, 2.0, 0.0, 0, 3) == pytest.approx(ts.combined_score(1.0, 1.0, 1.0, 0.0, 0, 3))
    assert 0 <= ts.combined_score(0, 0, 0, 99, 3, 3) <= 1


def test_file_summary_flags():
    good = [{"exp": 4, "pred": 4, "p": 0.9, "dist": 1.0, "rr": 1.0, "short": False, "d": 0.3, "r": 8}]
    assert ts.file_summary(good)["flags"] == []
    wrong = [{**good[0], "pred": 1}]
    assert "nada_salah" in ts.file_summary(wrong)["flags"]
    weak = [{**good[0], "p": 0.4}]
    assert ts.file_summary(weak)["flags"] == ["nada_lemah"]
    narrow = [{**good[0], "rr": 0.5}]
    assert ts.file_summary(narrow)["flags"] == ["nada_lemah"]
    short = [{**good[0], "short": True}]
    assert ts.file_summary(short)["flags"] == ["terlalu_pendek"]
    long_ok = [dict(good[0]) for _ in range(8)]
    long_ok[0]["pred"] = 2
    assert ts.file_summary(long_ok)["flags"] == []  # 1/8 salah < 25 %


def test_better_requires_gain_without_regressions():
    b = {"S": 0.70, "acc": 1.0, "short": 1}
    assert ts.better({"S": 0.75, "acc": 1.0, "short": 0}, b)
    assert not ts.better({"S": 0.71, "acc": 1.0, "short": 0}, b)       # naik terlalu kecil
    assert not ts.better({"S": 0.80, "acc": 0.5, "short": 0}, b)       # ketepatan turun
    assert not ts.better({"S": 0.80, "acc": 1.0, "short": 2}, b)       # pendek bertambah


def test_get_template_falls_back_to_all():
    tpl = mini_templates()
    assert ts.get_template(tpl, 4, 1) is not None
    assert ts.get_template(tpl, 4, 99) == tpl["tones"]["4"]["all"]["mean"]
    assert ts.get_template(tpl, 7, 1) is None


# ---- rebuild_tone (fungsi murni) ----------------------------------------------

def test_rebuild_target_track_moves_toward_template_and_caps():
    pytest.importorskip("parselmouth", reason="rebuild_tone mengimpor tone_score saja; Praat tidak diperlukan")
    import rebuild_tone as rb

    tpl = mini_templates()
    n = 40
    times = np.arange(n) * ta.STEP
    st = np.full(n, 10.0)                       # T4 datar di +10 (salah)
    syl = [{"tone": 4, "c": [10.0] * 10, "t0": 0.0, "t1": n * ta.STEP, "d": 0.4}]
    new = rb.target_track(st, times, syl, tpl, 10.0, 1.0, "level", "word")
    assert new[0] > new[-1] + 4                  # kini turun
    assert np.max(np.abs(new - st)) <= rb.SHIFT_CAP + 1e-9
    half = rb.target_track(st, times, syl, tpl, 10.0, 0.5, "level", "word")
    assert abs(half[0] - st[0]) <= abs(new[0] - st[0]) + 1e-9
    unchanged = rb.target_track(st, times, [{**syl[0], "tone": 0}], tpl, 10.0, 1.0, "level", "word")
    assert np.allclose(unchanged, st)


def test_rebuild_stretch_factors():
    import rebuild_tone as rb

    tpl = mini_templates()
    p10 = tpl["stats"]["word/3"]["dur"]["p10"]
    syl = [{"tone": 3, "d": p10 / 2}, {"tone": 3, "d": p10 * 2}, {"tone": 3, "d": p10 * 0.9}]
    f = rb.stretch_factors(syl, tpl, "word")
    assert f[0] == rb.STRETCH_MAX and f[1] == 1.0 and 1.0 < f[2] < 1.5


def test_rebuild_pick_prefers_smallest_strength_within_tie():
    import rebuild_tone as rb

    before = {"S": 0.5, "acc": 0.5, "short": 1}
    c = [(0.5, "a", {"S": 0.80, "acc": 1.0, "short": 0}), (0.75, "b", {"S": 0.805, "acc": 1.0, "short": 0}),
         (1.0, "c", {"S": 0.85, "acc": 1.0, "short": 0})]
    assert rb.pick(before, c)[0] == 1.0                      # selisih > TIE -> yang terbaik
    c[2] = (1.0, "c", {"S": 0.81, "acc": 1.0, "short": 0})
    assert rb.pick(before, c)[0] == 0.5                      # dalam TIE -> kekuatan terkecil
    assert rb.pick(before, [(1.0, "x", {"S": 0.51, "acc": 1.0, "short": 0})]) is None


def test_rebuild_make_plan_priorities_and_skip_tuned():
    import rebuild_tone as rb

    manifest = {"files": {k: {"kind": kind} for k, kind in
                          {"a": "word", "b": "dialog", "c": "word", "d": "sentence", "e": "word", "f": "word-slow"}.items()}}
    manifest["files"]["e"]["tuning"] = {"method": "x"}
    report = {"files": {"a": {"S": 0.5, "flags": ["nada_salah"]}, "b": {"S": 0.1, "flags": ["nada_salah"]},
                        "c": {"S": 0.9, "flags": []}, "d": {"S": 0.2, "flags": ["nada_salah"]},
                        "e": {"S": 0.3, "flags": ["nada_salah"]}, "f": {"S": 0.4, "flags": ["terlalu_pendek"]}}}
    plan = rb.make_plan(report, manifest, sentences=0, control=5)
    assert plan[:3] == ["a", "f", "b"] and "e" not in plan and "d" not in plan and plan[-1] == "c"
    assert "d" in rb.make_plan(report, manifest, sentences=1, control=0)
