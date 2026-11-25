#!/usr/bin/env python3
"""Daftar teks audio HSK 1 (task 4b) -> data/hsk1/audio-items.json.

Deterministik: urutan stabil, tanpa waktu. Jalankan:
  python3 scripts/tts-hsk1/hsk1_items.py           # tulis file
  python3 scripts/tts-hsk1/hsk1_items.py --check   # gagal bila file tidak sesuai data
"""
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
DATA = ROOT / "data" / "hsk1"
OUT = DATA / "audio-items.json"

# Naikkan bila cara membuat/mengolah audio berubah (semua hash ikut berubah).
SETTINGS_VERSION = 1
SLOW_SPEED = 0.75
KINDS = ["word", "word-slow", "sentence", "casual", "casual-slow", "dialog"]


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def voice_table():
    out = {}
    for v in load(ROOT / "scripts" / "tts" / "voices.json")["voices"]:
        if v["code"] in ("P3", "L3"):
            out[v["code"]] = v
    return out


def item_hash(text: str, voice: str, speed: float, revision: str) -> str:
    raw = f"{text}\n{voice}\n{speed}\n{SETTINGS_VERSION}\n{revision}"
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:16]


def build_items() -> list[dict]:
    voices = voice_table()
    rev = {c: f"{v['repoId']}@{v['modelRevision']}:{v['voiceId']}" for c, v in voices.items()}
    words = load(DATA / "words.json")
    sentences = load(DATA / "sentences.json")["sentences"]
    casual = load(DATA / "casual.json")["items"]
    dialogs = load(DATA / "dialogs.json")["dialogs"]

    items: list[dict] = []

    def add(kind, source_id, text, voice, speed, pinyin=None):
        it = {"key": f"{kind}-{source_id}", "kind": kind, "text": text, "voice": voice, "speed": speed}
        if pinyin:
            it["pinyin"] = pinyin
        it["sourceId"] = str(source_id)
        it["hash"] = item_hash(text, voice, speed, rev[voice])
        items.append(it)

    for w in words:
        add("word", w["id"], w["hanzi"], "P3", 1.0, w["pinyin"])
    for w in words:
        add("word-slow", w["id"], w["hanzi"], "P3", SLOW_SPEED, w["pinyin"])
    for s in sentences:
        add("sentence", s["tatoebaId"], s["cmn"], "P3", 1.0)
    for c in casual:
        add("casual", c["id"], c["hanzi"], "P3", 1.0, c["pinyin"])
    for c in casual:
        add("casual-slow", c["id"], c["hanzi"], "P3", SLOW_SPEED, c["pinyin"])
    for d in dialogs:
        for n, line in enumerate(d["lines"], 1):
            add("dialog", f"{d['id']}-{n:02d}", line["cmn"], "L3" if line["gender"] == "male" else "P3", 1.0, line.get("pinyin"))
    return items


def render() -> str:
    doc = {"version": 1, "settingsVersion": SETTINGS_VERSION, "slowSpeed": SLOW_SPEED, "items": build_items()}
    return json.dumps(doc, ensure_ascii=False, indent=1) + "\n"


def main() -> int:
    text = render()
    if "--check" in sys.argv:
        if not OUT.exists() or OUT.read_text(encoding="utf-8") != text:
            print("data/hsk1/audio-items.json tidak sesuai data. Jalankan: python3 scripts/tts-hsk1/hsk1_items.py", file=sys.stderr)
            return 1
        print("audio-items.json OK")
        return 0
    OUT.write_text(text, encoding="utf-8")
    print(f"{len(json.loads(text)['items'])} item -> {OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
