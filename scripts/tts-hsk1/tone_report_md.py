#!/usr/bin/env python3
"""Task 4c: tulis docs/tasks/task-4c-hasil.md (tabel, bukan opini) dari tone-refs/templates/report/manifest.

  python3 scripts/tts-hsk1/tone_report_md.py [--after data/hsk1/audio-tone-report-after.json] [--before-ref origin/main]
"""
from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
DATA = ROOT / "data" / "hsk1"
OUT = ROOT / "docs" / "tasks" / "task-4c-hasil.md"
KINDS = ["word", "word-slow", "casual", "casual-slow", "dialog", "sentence"]


def load(p: Path):
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else None


def git_json(ref: str, path: str):
    r = subprocess.run(["git", "-C", str(ROOT), "show", f"{ref}:{path}"], capture_output=True, text=True)
    return json.loads(r.stdout) if r.returncode == 0 else None


def pc(x):
    return "-" if x is None else f"{100 * x:.1f}%"


def table(head, rows):
    out = ["| " + " | ".join(head) + " |", "|" + "|".join("---" for _ in head) + "|"]
    out += ["| " + " | ".join(str(c) for c in r) + " |" for r in rows]
    return "\n".join(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--after", default=str(DATA / "audio-tone-report-after.json"))
    ap.add_argument("--before-ref", default="origin/main")
    a = ap.parse_args()
    refs = load(DATA / "tone-refs.json")
    tpl = load(DATA / "tone-templates.json")
    before = load(DATA / "audio-tone-report.json")
    after = load(Path(a.after))
    log = load(DATA / "tone-fix-log.json")
    man_after = load(ROOT / "public" / "audio" / "hsk1" / "manifest.json")
    man_before = git_json(a.before_ref, "public/audio/hsk1/manifest.json") or man_after
    ev = tpl["classifier"]["eval"]
    L = ["# Task 4c · hasil ukur dan penyetelan nada", "",
         "Dibuat otomatis oleh `scripts/tts-hsk1/tone_report_md.py` dari `data/hsk1/{tone-refs,tone-templates,audio-tone-report,"
         "audio-tone-report-after,tone-fix-log}.json`. Angka dari pengukur otomatis; Claude tidak bisa mendengar, jadi ini "
         "proksi. Penentu akhir: telinga pemilik (`public/samples-tone.html`).", ""]

    L += ["## 1. Rujukan penutur asli (A)", "",
          table(["Sumber", "Rekaman terukur", "Penutur", "Lisensi"],
                [[k, refs["counts"].get(k, 0), refs["sources"][k]["speaker"], refs["sources"][k]["license"]]
                 for k in refs["sources"] if refs["counts"].get(k, 0) or k == "tatoeba"]), "",
          f"Total {len(refs['refs'])} rekaman, {len(refs['speakers'])} penutur; {tpl['nSpeakers']} penutur punya cukup suku kata bernada "
          f"(>= 25) untuk median yang andal dan dipakai di templat/pengenal.", ""]
    ck = refs.get("checks", {})
    L += ["Cek sumber lain:", ""]
    tt = ck.get("tatoeba", {})
    L.append(f"- **Tatoeba** (cek segar ekspor resmi): {json.dumps(tt, ensure_ascii=False)[:400] if tt else 'belum dijalankan'}")
    cv = ck.get("commonvoice", {})
    L.append(f"- **Common Voice zh-CN**: {cv.get('note', 'belum dicek')} Cek akses: {json.dumps(cv.get('probes', {}), ensure_ascii=False)[:300]}")
    L += ["- **Tone Perfect**: tidak dipakai (belum ada izin MSU).", ""]

    L += ["## 2. Metode (B)", "",
          "- F0: Praat (praat-parselmouth 0.4.7) dua lintasan (60-500 Hz lalu sekitar median), perbaikan lompatan oktaf, satuan semitone "
          "terhadap 100 Hz, relatif median tiap penutur.",
          "- Pemotongan suku kata: satu suku kata = bagian bersuara terbesar; beberapa suku kata = DP lembah intensitas dengan jumlah suku "
          "kata dari pinyin (tanpa Whisper; alasan dan kelemahan di docstring `tone_analysis.py`).",
          "- Nada diharapkan: data kata/ungkapan (`pinyinNumbered`, 不/一 resmi 2025), kalimat/dialog dari pypinyin; 3+3 -> 2+3; erhua 儿 tidak "
          "dihitung; nada ringan dihitung terpisah (tidak masuk akurasi 1-4).",
          "- Pengenal nada: MLP/LR pada 26 fitur kontur 10 titik (relatif median penutur) + durasi bersuara; dilatih pada rujukan; "
          "dites silang antar penutur (leave-one-speaker-out; penutur kecil digabung per lipatan).",
          "- Kelas panjang: `syl` = daftar suku kata audio-cmn (dibaca lambat; hanya untuk templat/pengenal), `single` = kata 1 suku kata, "
          "`word` = 2-4 suku kata, `sent` = >= 5 (tidak ada rujukan kalimat bebas: kalimat dibanding kelas `word`, ambang durasi x0.6).", ""]

    L += ["## 3. Pengenal nada: akurasi pada rujukan asli (batas atas)", "",
          f"Model terpilih **{ev['model']}** (LR {pc(ev['accLR'])}, MLP {pc(ev['accMLP'])}); akurasi lintas penutur **{pc(ev['acc'])}** "
          f"pada {ev['n']} suku kata.", "",
          table(["Nada", "1", "2", "3", "4"], [["akurasi", *[pc(ev['perTone'][t]) for t in '1234']]]), "",
          table(["Kelas", "n", "akurasi"], [[c, ev["perClassN"].get(c, 0), pc(ev["perClass"].get(c))] for c in ev["perClass"]]), "",
          "Matriks kekeliruan (baris = nada sebenarnya, kolom = dikenali 1-4):", "",
          table(["", "1", "2", "3", "4"], [[str(i + 1), *row] for i, row in enumerate(ev["confusion"])]), "",
          table(["Penutur", "n", "akurasi (disisihkan)"], [[s, v["n"], pc(v["acc"])] for s, v in ev["perSpeaker"].items()]), ""]

    L += ["## 4. Templat (rata-rata kontur 10 titik, semitone relatif median penutur)", "",
          table(["Nada", "n", *[f"t{i}" for i in range(1, 11)]],
                [[t, v["all"]["n"], *v["all"]["mean"]] for t, v in sorted(tpl["tones"].items())]), "",
          "Durasi dan rentang per kelas/nada (detik; semitone, p95-p5 per suku kata):", "",
          table(["kelas/nada", "n", "durasi p5", "p10", "p50", "p90", "rentang p10", "p50"],
                [[k, v["dur"]["n"], v["dur"]["p5"], v["dur"]["p10"], v["dur"]["p50"], v["dur"]["p90"],
                  v["range"].get("p10", "-"), v["range"].get("p50", "-")] for k, v in sorted(tpl["stats"].items())]), "",
          "Templat menurut nada berikutnya ada di `data/hsk1/tone-templates.json` (`tones.<n>.next`).", ""]

    def kind_rows(rep):
        return [[k, rep["summary"][k]["files"], rep["summary"][k]["syl14"], pc(rep["summary"][k]["toneAcc"]),
                 pc(rep["summary"][k]["fileAllRight"]), rep["summary"][k]["shortSyl"], rep["summary"][k]["rangeRatioMedian"],
                 rep["summary"][k]["meanS"]] for k in KINDS if k in rep["summary"]]

    head = ["jenis", "file", "suku kata 1-4", "akurasi nada", "file semua benar", "suku kata pendek", "rentang vs rujukan (median)", "skor rata-rata"]
    L += ["## 5. Audio sekarang, sebelum (C)", "", table(head, kind_rows(before)), "",
          "Bendera (jumlah file): " + "; ".join(f"{k}: {before['summary'][k]['flags']}" for k in KINDS if k in before["summary"]), ""]
    if after:
        L += ["## 6. Sesudah penyetelan (D)", "", table(head, kind_rows(after)), "",
              "Bendera (jumlah file): " + "; ".join(f"{k}: {after['summary'][k]['flags']}" for k in KINDS if k in after["summary"]), ""]
        wb, wa = man_before["whisper"]["byKind"], man_after["whisper"]["byKind"]
        L += ["### Whisper large-v3 (sebelum -> sesudah)", "",
              table(["jenis", "sebelum", "sesudah"], [[k, f"{wb[k]['passed']}/{wb[k]['total']}", f"{wa[k]['passed']}/{wa[k]['total']}"] for k in KINDS]
                    + [["semua", f"{man_before['whisper']['passed']}/{man_before['whisper']['total']}",
                        f"{man_after['whisper']['passed']}/{man_after['whisper']['total']}"]]), ""]
    if log:
        res = log["results"]
        rep = [r for r in res if r["decision"] == "ganti"]
        ctrl = [r for r in rep if not r["before"]["flags"]]
        L += [f"### Keputusan: {len(rep)} file diganti dari {len(res)} diproses ({len(ctrl)} di antaranya sampel kontrol tidak berbendera)", ""]
        reasons: dict[str, int] = {}
        for r in res:
            if r["decision"] != "ganti":
                reasons[r["decision"]] = reasons.get(r["decision"], 0) + 1
        L += [table(["alasan tidak diganti", "jumlah"], sorted(reasons.items(), key=lambda kv: -kv[1])), ""]
        w2 = [r["whisper2"] for r in rep if r.get("whisper2") and r["whisper2"].get("before") is not None and r["whisper2"].get("after") is not None]
        if w2:
            L += [f"Pengenal kedua (Whisper medium, transkripsi polos, hanya informasi) pada {len(w2)} file yang diganti: lolos sebelum "
                  f"{sum(1 for w in w2 if w['before'])} -> sesudah {sum(1 for w in w2 if w['after'])} "
                  f"(turun: {sum(1 for w in w2 if w['before'] and not w['after'])}, naik: {sum(1 for w in w2 if not w['before'] and w['after'])}).", ""]
        if rep:
            import statistics as st

            L += ["Rata-rata file yang diganti: skor "
                  f"{st.mean(r['before']['S'] for r in rep):.3f} -> {st.mean(r['after']['S'] for r in rep):.3f}, "
                  f"akurasi nada {pc(st.mean(r['before']['acc'] for r in rep))} -> {pc(st.mean(r['after']['acc'] for r in rep))}, "
                  f"rentang {st.mean(r['before']['rr'] for r in rep):.2f} -> {st.mean(r['after']['rr'] for r in rep):.2f}.", ""]
    L += ["## 7. Catatan penting", "",
          "- **Menjalankan ulang `build-audio.yml` dengan `retry_failed` atau `recheck` dapat membuat ulang file dan menimpa file yang sudah "
          "disetel**, tetapi hanya yang gagal Whisper (file yang lolos dengan hash sama tidak disentuh). Setelah itu jalankan "
          "`tone-fix.yml` lagi (file berstempel `tuning` dilewati; file baru diproses).",
          "- `manifest.version` dinaikkan tiap ada penggantian; `index.json` ikut (`v`). Catatan jujur: `src/lib/audio.ts` belum memakai `v` "
          "untuk membuat URL mp3 unik, jadi peramban memperbarui lewat validasi cache biasa (GitHub Pages: max-age 10 menit).",
          "- Pengukur nada dilatih pada rekaman penutur asli lalu dipakai untuk menilai dan menyetel suara TTS: bagian dari kenaikan skor adalah "
          "penyesuaian ke proksi yang sama. Whisper (arti benar) dan telinga pemilik adalah pemeriksa independen.", ""]
    OUT.write_text("\n".join(L) + "\n", encoding="utf-8")
    print(f"-> {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
