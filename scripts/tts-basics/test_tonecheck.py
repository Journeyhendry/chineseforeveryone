"""Tes aturan nada (tonecheck.py) dengan sapuan sinus sintetis (numpy + parselmouth).

    python scripts/tts-basics/test_tonecheck.py      (atau: pytest scripts/tts-basics)

Kontur dibuat seperti suara perempuan (rentang ~200-320 Hz); rentang penutur dihitung dari
keempat kontur, sama seperti basics.py menghitungnya dari semua suku kata tunggal.
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import tonecheck as tc  # noqa: E402

SR = 16000
DUR = 0.4


def sweep(points: list[float], lead_silence: float = 0.1) -> np.ndarray:
    """Nada harmonis yang F0-nya mengikuti titik-titik (Hz, diinterpolasi linier dalam semiton)."""
    n = int(SR * DUR)
    t = np.linspace(0, 1, n)
    xs = np.linspace(0, 1, len(points))
    st = np.interp(t, xs, 12 * np.log2(np.array(points)))
    f = 2 ** (st / 12)
    phase = 2 * np.pi * np.cumsum(f) / SR
    y = sum(np.sin(k * phase) / k for k in (1, 2, 3))
    y *= np.hanning(n) ** 0.2 * 0.3
    pad = np.zeros(int(SR * lead_silence))
    return np.concatenate([pad, y, pad])


def f0_of(y: np.ndarray) -> np.ndarray:
    import parselmouth

    snd = parselmouth.Sound(y, sampling_frequency=SR)
    pitch = snd.to_pitch_ac(time_step=tc.STEP, pitch_floor=tc.PITCH_FLOOR, pitch_ceiling=tc.PITCH_CEIL)
    return np.asarray(pitch.selected_array["frequency"], dtype=float)


CONTOURS = {
    1: [300, 300, 298, 296],             # datar tinggi (55)
    2: [235, 232, 260, 300, 320],        # naik (35)
    3: [225, 205, 195, 200, 230],        # rendah, turun-naik (214)
    4: [320, 300, 260, 220, 195],        # turun dari tinggi (51)
}


def classify_all(contours):
    sts = {k: tc.clean_semitones(f0_of(sweep(v))) for k, v in contours.items()}
    ref = tc.speaker_ref(list(sts.values()))
    return {k: tc.classify(st, ref)[0] for k, st in sts.items()}, ref


def test_four_tones():
    got, ref = classify_all(CONTOURS)
    assert got == {1: 1, 2: 2, 3: 3, 4: 4}, (got, ref)


def test_low_falling_third_tone():
    contours = dict(CONTOURS)
    contours[3] = [215, 205, 196, 192]   # nada 3 "setengah" (21)
    got, _ = classify_all(contours)
    assert got[3] == 3, got


def test_wrong_tone_is_not_accepted():
    """Kontur turun tidak boleh dianggap nada 1, kontur datar tidak boleh dianggap nada 4."""
    got, _ = classify_all(CONTOURS)
    assert got[4] != 1 and got[1] != 4 and got[2] != 3


def test_too_short_is_unclear():
    st = tc.clean_semitones(f0_of(sweep([300, 300]))[:12])
    assert tc.classify(st, tc.DEFAULT_REF)[0] in (0, 1)
    assert tc.classify(np.array([90.0] * 3), tc.DEFAULT_REF)[0] == 0


def test_octave_jump_ignored():
    f = f0_of(sweep(CONTOURS[1]))
    voiced = np.where(f > 0)[0]
    f[voiced[len(voiced) // 2]] *= 2      # satu bingkai salah oktaf
    st = tc.clean_semitones(f)
    assert np.ptp(st) < 2.0


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn()
            print("ok", name)
