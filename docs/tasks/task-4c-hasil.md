# Task 4c · hasil ukur dan penyetelan nada

Dibuat otomatis oleh `scripts/tts-hsk1/tone_report_md.py` dari `data/hsk1/{tone-refs,tone-templates,audio-tone-report,audio-tone-report-after,tone-fix-log}.json`. Angka dari pengukur otomatis; Claude tidak bisa mendengar, jadi ini proksi. Penentu akhir: telinga pemilik (`public/samples-tone.html`).

## 1. Rujukan penutur asli (A)

| Sumber | Rekaman terukur | Penutur | Lisensi |
|---|---|---|---|
| audio-cmn-syl | 1660 | Chen Wang | CC BY-SA |
| audio-cmn-hsk | 6151 | Yue Tan | CC BY-SA |
| lingualibre | 2759 | banyak penutur (lihat per rekaman) | CC0 / CC BY / CC BY-SA (per rekaman) |
| tatoeba | 0 | per rekaman | hanya CC0/CC BY/CC BY-SA |

Total 10570 rekaman, 19 penutur; 9 penutur punya cukup suku kata bernada (>= 25) untuk median yang andal dan dipakai di templat/pengenal.

Cek sumber lain:

- **Tatoeba** (cek segar ekspor resmi): {"cmnSentencesWithAudio": 5825, "licenses": {"(kosong)": 5741, "CC BY-NC 4.0": 84}, "usable": 0}
- **Common Voice zh-CN**: Common Voice zh-CN tidak diunduh: unduhan resmi (Mozilla Data Collective) memerlukan akun + persetujuan syarat, dan salinan Hugging Face bersifat gated (login). Membuat akun adalah urusan pemilik; dilewati. Cek akses: {"commonvoice.mozilla.org": "HTTP 200", "datacollective.mozillafoundation.org": "HTTP 200", "huggingface.co/mozilla-foundation/common_voice_17_0": "HTTP 200"}
- **Tone Perfect**: tidak dipakai (belum ada izin MSU).

## 2. Metode (B)

- F0: Praat (praat-parselmouth 0.4.7) dua lintasan (60-500 Hz lalu sekitar median), perbaikan lompatan oktaf, satuan semitone terhadap 100 Hz, relatif median tiap penutur.
- Pemotongan suku kata: satu suku kata = bagian bersuara terbesar; beberapa suku kata = DP lembah intensitas dengan jumlah suku kata dari pinyin (tanpa Whisper; alasan dan kelemahan di docstring `tone_analysis.py`).
- Nada diharapkan: data kata/ungkapan (`pinyinNumbered`, 不/一 resmi 2025), kalimat/dialog dari pypinyin; 3+3 -> 2+3; erhua 儿 tidak dihitung; nada ringan dihitung terpisah (tidak masuk akurasi 1-4).
- Pengenal nada: MLP/LR pada 26 fitur kontur 10 titik (relatif median penutur) + durasi bersuara; dilatih pada rujukan; dites silang antar penutur (leave-one-speaker-out; penutur kecil digabung per lipatan).
- Kelas panjang: `syl` = daftar suku kata audio-cmn (dibaca lambat; hanya untuk templat/pengenal), `single` = kata 1 suku kata, `word` = 2-4 suku kata, `sent` = >= 5 (tidak ada rujukan kalimat bebas: kalimat dibanding kelas `word`, ambang durasi x0.6).

## 3. Pengenal nada: akurasi pada rujukan asli (batas atas)

Model terpilih **mlp** (LR 82.6%, MLP 85.5%); akurasi lintas penutur **85.5%** pada 17516 suku kata.

| Nada | 1 | 2 | 3 | 4 |
|---|---|---|---|---|
| akurasi | 93.0% | 87.5% | 70.5% | 86.6% |

| Kelas | n | akurasi |
|---|---|---|
| syl | 1660 | 95.2% |
| single | 1678 | 93.2% |
| word | 14105 | 83.5% |
| sent | 73 | 68.5% |

Matriks kekeliruan (baris = nada sebenarnya, kolom = dikenali 1-4):

|  | 1 | 2 | 3 | 4 |
|---|---|---|---|---|
| 1 | 3608 | 82 | 73 | 117 |
| 2 | 134 | 3680 | 279 | 115 |
| 3 | 88 | 455 | 2082 | 329 |
| 4 | 101 | 130 | 636 | 5607 |

| Penutur | n | akurasi (disisihkan) |
|---|---|---|
| yue-tan | 11393 | 87.0% |
| chen-wang | 1660 | 95.2% |
| ll:fake-estate | 1511 | 79.7% |
| ll:canonni | 1125 | 68.7% |
| ll:luilui6666 | 836 | 84.6% |
| ll:jouketou | 646 | 83.4% |

## 4. Templat (rata-rata kontur 10 titik, semitone relatif median penutur)

| Nada | n | t1 | t2 | t3 | t4 | t5 | t6 | t7 | t8 | t9 | t10 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 3880 | 3.72 | 3.63 | 3.56 | 3.52 | 3.53 | 3.57 | 3.59 | 3.54 | 3.43 | 3.31 |
| 2 | 4208 | -1.26 | -2.27 | -2.68 | -2.66 | -2.29 | -1.55 | -0.41 | 0.88 | 1.85 | 2.09 |
| 3 | 2954 | -0.91 | -2.09 | -2.95 | -3.59 | -4.03 | -4.17 | -4.1 | -3.7 | -3.04 | -2.58 |
| 4 | 6474 | 3.92 | 3.76 | 3.15 | 2.0 | 0.48 | -0.91 | -1.86 | -2.36 | -2.63 | -2.64 |

Durasi dan rentang per kelas/nada (detik; semitone, p95-p5 per suku kata):

| kelas/nada | n | durasi p5 | p10 | p50 | p90 | rentang p10 | p50 |
|---|---|---|---|---|---|---|---|
| single/1 | 429 | 0.34 | 0.36 | 0.45 | 0.622 | 0.56 | 1.02 |
| single/2 | 334 | 0.42 | 0.443 | 0.52 | 0.647 | 5.24 | 6.805 |
| single/3 | 334 | 0.37 | 0.42 | 0.6 | 0.72 | 4.228 | 5.9 |
| single/4 | 581 | 0.29 | 0.31 | 0.4 | 0.51 | 6.68 | 9.59 |
| syl/1 | 415 | 0.27 | 0.3 | 0.42 | 0.526 | 0.514 | 1.16 |
| syl/2 | 415 | 0.28 | 0.31 | 0.43 | 0.56 | 5.734 | 7.76 |
| syl/3 | 415 | 0.48 | 0.52 | 0.68 | 0.84 | 4.83 | 6.04 |
| syl/4 | 415 | 0.247 | 0.27 | 0.37 | 0.48 | 5.744 | 7.39 |
| word/0 | 261 | 0.14 | 0.16 | 0.22 | 0.3 | 1.064 | 2.765 |
| word/1 | 3041 | 0.24 | 0.28 | 0.36 | 0.44 | 0.52 | 1.05 |
| word/2 | 3468 | 0.24 | 0.26 | 0.38 | 0.48 | 2.385 | 5.57 |
| word/3 | 2275 | 0.22 | 0.26 | 0.38 | 0.49 | 2.08 | 4.48 |
| word/4 | 5505 | 0.22 | 0.24 | 0.34 | 0.42 | 4.14 | 7.99 |

Templat menurut nada berikutnya ada di `data/hsk1/tone-templates.json` (`tones.<n>.next`).

## 5. Audio sekarang, sebelum (C)

| jenis | file | suku kata 1-4 | akurasi nada | file semua benar | suku kata pendek | rentang vs rujukan (median) | skor rata-rata |
|---|---|---|---|---|---|---|---|
| word | 300 | 422 | 59.2% | 48.0% | 109 | 0.755 | 0.6357 |
| word-slow | 300 | 422 | 42.2% | 32.3% | 27 | 0.75 | 0.5644 |
| casual | 72 | 136 | 50.0% | 29.2% | 45 | 0.77 | 0.5859 |
| casual-slow | 72 | 136 | 43.4% | 18.1% | 10 | 0.86 | 0.5544 |
| dialog | 125 | 698 | 53.0% | 10.4% | 59 | 0.82 | 0.6267 |
| sentence | 1555 | 8492 | 57.6% | 8.0% | 593 | 0.74 | 0.6441 |

Bendera (jumlah file): word: {'terlalu_pendek': 100, 'nada_salah': 156, 'nada_lemah': 74}; word-slow: {'terlalu_pendek': 27, 'nada_salah': 203, 'nada_lemah': 51}; casual: {'terlalu_pendek': 35, 'nada_salah': 51, 'nada_lemah': 15}; casual-slow: {'terlalu_pendek': 10, 'nada_salah': 59, 'nada_lemah': 6}; dialog: {'terlalu_pendek': 46, 'nada_salah': 97, 'nada_lemah': 11}; sentence: {'terlalu_pendek': 453, 'nada_salah': 1226, 'nada_lemah': 174}

## 7. Catatan penting

- **Menjalankan ulang `build-audio.yml` dengan `retry_failed` atau `recheck` dapat membuat ulang file dan menimpa file yang sudah disetel**, tetapi hanya yang gagal Whisper (file yang lolos dengan hash sama tidak disentuh). Setelah itu jalankan `tone-fix.yml` lagi (file berstempel `tuning` dilewati; file baru diproses).
- `manifest.version` dinaikkan tiap ada penggantian; `index.json` ikut (`v`). Catatan jujur: `src/lib/audio.ts` belum memakai `v` untuk membuat URL mp3 unik, jadi peramban memperbarui lewat validasi cache biasa (GitHub Pages: max-age 10 menit).
- Pengukur nada dilatih pada rekaman penutur asli lalu dipakai untuk menilai dan menyetel suara TTS: bagian dari kenaikan skor adalah penyesuaian ke proksi yang sama. Whisper (arti benar) dan telinga pemilik adalah pemeriksa independen.

