#!/usr/bin/env python3
"""Tes metode A (pitch.py) tanpa model: nama file audio-cmn, pemetaan kontur, dan PSOLA pada bunyi
sintetis (deretan pulsa bervokal). Kontur "asli" sintetis (naik / turun / datar / lembah) dipindah ke
bunyi "P3" sintetis yang nadanya salah; hasilnya harus diklasifikasi tonecheck.py ke nada sumber.

    python scripts/tts-basics/test_pitch.py
"""
from __future__ import annotations

import sys
import tempfile
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import pitch as pm  # noqa: E402
import tonecheck as tc  # noqa: E402


def synth_vowel(path: Path, hz_fn, dur: float = 0.5, sr: int = 24000):
    """Bunyi mirip vokal: pulsa glotal (fase dari F0 berubah) disaring 3 formant sederhana, plus sunyi."""
    import soundfile as sf

    n = int(dur * sr)
    t = np.arange(n) / sr
    f = np.array([hz_fn(x / dur) for x in t])
    phase = np.cumsum(f) / sr
    pulses = np.diff(np.floor(phase), prepend=0.0)
    y = np.zeros(n)
    for fc, bw in ((700, 110), (1200, 120), (2600, 160)):
        r = np.exp(-np.pi * bw / sr)
        th = 2 * np.pi * fc / sr
        a1, a2 = -2 * r * np.cos(th), r * r
        out = np.zeros(n)
        for i in range(n):
            out[i] = pulses[i] - a1 * (out[i - 1] if i else 0) - a2 * (out[i - 2] if i > 1 else 0)
        y += out
    y *= np.hanning(n) ** 0.3
    y = 0.3 * y / np.abs(y).max()
    sil = np.zeros(int(0.15 * sr))
    sf.write(str(path), np.concatenate([sil, y, sil]), sr)


def main() -> int:
    fails = 0

    def expect(cond, msg):
        nonlocal fails
        print(("ok   " if cond else "FAIL ") + msg)
        fails += 0 if cond else 1

    expect(pm.syllable_key("nǚ") == "nv3", "kunci nǚ -> nv3")
    expect(pm.syllable_key("jī") == "ji1" and pm.syllable_key("Mā") == "ma1", "kunci jī, Mā")
    expect(pm.syllable_key("ma") is None, "tanpa nada -> None")
    expect(pm.key_from_name("cmn-nv3.mp3") == "nv3" and pm.key_from_name("cmn-lü4.wav") == "lv4"
           and pm.key_from_name("nu:3.mp3") == "nv3" and pm.key_from_name("cmn-好.mp3") is None, "nama file")
    idx = pm.index_paths(["64k/syllabs/cmn-ma1.mp3", "96k/syllabs/cmn-ma1.mp3", "64k/hsk/cmn-ma1.mp3",
                          "README.md"])
    expect(idx == {"ma1": "96k/syllabs/cmn-ma1.mp3"}, f"pilih path terbaik {idx}")

    # rentang "P3" dan "penutur asli" berbeda (asli lebih rendah, rentang lebih lebar)
    p3_ref = (12 * np.log2(225.0), 12 * np.log2(305.0))
    nat_lo, nat_hi = 110.0, 190.0
    natives = {
        1: lambda x: nat_hi - 5 * x,
        2: lambda x: 135 + 50 * max(0.0, x - 0.25) / 0.75,
        3: lambda x: 125 - 15 * min(x, 0.6) / 0.6 + (25 * (x - 0.6) / 0.4 if x > 0.6 else 0),
        4: lambda x: nat_hi - 90 * x,
    }
    with tempfile.TemporaryDirectory() as d:
        d = Path(d)
        shapes = {}
        for tone, fn in natives.items():
            synth_vowel(d / f"nat{tone}.wav", fn)
            _, f0 = pm.f0_track(d / f"nat{tone}.wav", d / "t.wav")
            shapes[tone] = pm.contour_shape(f0)
            expect(shapes[tone] is not None and len(shapes[tone]) == pm.N_POINTS, f"kontur asli nada {tone}")
        nat_ref = pm.speaker_range(list(shapes.values()))
        # "P3" salah nada: semua dibaca turun
        synth_vowel(d / "p3.wav", lambda x: 300 - 70 * x, dur=0.42)
        for tone in range(1, 5):
            mapped = pm.map_shape(shapes[tone], nat_ref, p3_ref)
            info = pm.apply_contour(d / "p3.wav", d / f"out{tone}.wav", mapped, d / "t.wav")
            got, feats = tc.classify(tc.clean_semitones(tc.extract_f0(d / f"out{tone}.wav")), p3_ref)
            expect(got == tone, f"audio-cmn sintetis nada {tone} -> terdeteksi {got} {tc.round_features(feats)}")
            import soundfile as sf
            a, _ = sf.read(str(d / "p3.wav"))
            b, _ = sf.read(str(d / f"out{tone}.wav"))
            expect(abs(len(a) - len(b)) <= 2, f"durasi tetap ({len(a)} vs {len(b)} sampel) {info}")
            std = pm.standard_shape(tone, p3_ref)
            pm.apply_contour(d / "p3.wav", d / f"std{tone}.wav", std, d / "t.wav")
            got, _ = tc.classify(tc.clean_semitones(tc.extract_f0(d / f"std{tone}.wav")), p3_ref)
            expect(got == tone, f"kontur baku nada {tone} -> terdeteksi {got}")
    print("semua lolos" if not fails else f"{fails} gagal")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
