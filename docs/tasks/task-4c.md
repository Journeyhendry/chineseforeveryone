# Task 4c · Perbaiki ketepatan suara (nada + panjang) — versi terbaik dari banyak rujukan

Model: Sonnet (skrip + workflow), Opus (memeriksa, menentukan ambang, penyetelan akhir). Prasyarat: 4b selesai. Cabang kerja: `task-4c`. Permintaan pemilik 2026-11-25: suara pelafalan masih kurang akurat — ada yang terlalu pendek, nadanya kurang tegas ("kurang bold"). Ambil rujukan lebih banyak, analisis, gabungkan jadi versi valid/terbaik. Pemilik: "anggap kamu murid; kalau kamu paham dengan mudah berarti bisa dipakai; tetap perlu diperiksa".

## Tujuan
Semua suara P3/L3 (kata, versi pelan, kalimat, ungkapan santai, dialog, dan nanti suku kata Tahap 0) punya nada yang jelas dan benar serta durasi yang cukup, diukur dengan angka terhadap rekaman orang asli, bukan perasaan.

## Fakta penting (jujur)
- Claude **tidak bisa mendengar** audio. "Murid" di sini = pengukur otomatis (pengenal nada dari kontur tinggi-rendah suara, Whisper, dan pengenal suara kedua) + telinga pemilik sebagai penentu akhir. Jangan klaim "terdengar bagus" tanpa angka.
- Model/data besar hanya bisa diunduh lewat **GitHub Actions** (sandbox sesi memblokir situs luar). Pola sama seperti 4b: push ke cabang `task-4c` memicu workflow, hasil di-commit balik. Pantau lewat `gh api` REST.
- Jangan ubah suara terpilih (P3 + L3) — itu keputusan final pemilik. Yang diperbaiki hanya cara membuat/menyetel/memilih hasilnya.

## Scope
### A. Kumpulkan rujukan (workflow `tone-refs.yml`)
Sumber berlisensi bebas saja, atribusi masuk CREDITS.md + `data/hsk1/tone-refs.json`:
1. `hugolpz/audio-cmn` (suku kata tunggal, CC BY-SA; sudah dipakai Tahap 0).
2. Lingua Libre / Wikimedia Commons (kata Mandarin, CC0/CC BY/CC BY-SA; banyak penutur berbeda).
3. Tatoeba (kalimat; hanya lisensi bebas CC0/BY/BY-SA).
4. Mozilla Common Voice zh-CN (CC0) bila bisa diunduh lewat workflow; kalau tidak bisa, catat dan lewati.
5. Tone Perfect hanya bila izin MSU sudah ada (belum → jangan).
Tiap rujukan: simpan metadata (penutur, jenis kelamin bila ada, lisensi, URL). File mentah jangan di-commit besar-besaran (cukup hasil ukur + daftar).

### B. Analisis (skrip `scripts/tts-hsk1/tone_analysis.py`)
- Ekstrak kontur F0 (pyin atau Parselmouth), ubah ke semiton relatif per penutur (z-score/median), potong per suku kata (selaraskan dengan pinyin lewat forced alignment sederhana atau suku kata tunggal).
- Bangun **templat tiap nada** (1,2,3,4, ringan) dan konteks (3+3 → 2+3, 不/一 berubah, nada ringan setelah tiap nada): rata-rata ± simpangan, **rentang nada (semiton)**, **durasi per suku kata** (persentil 5/10/50) untuk huruf tunggal, kata 2 huruf, dan kalimat.
- Hasil: `data/hsk1/tone-templates.json` + ringkasan terbaca manusia di `docs/tasks/task-4c-hasil.md` (tabel, bukan opini).

### C. Ukur suara sekarang (skrip yang sama atau `tone_score.py`)
Untuk **semua** file di `public/audio/hsk1/manifest.json`: durasi tiap suku kata, rentang nada, korelasi/jarak kontur (DTW) terhadap templat, hasil pengenal nada (kontur → nada 1–4; dilatih dari rujukan, dites silang antar penutur). Keluaran `data/hsk1/audio-tone-report.json` (per file: skor, bendera `terlalu_pendek`, `nada_lemah`, `nada_salah`). Ini jadi "sebelum".

### D. Perbaiki (skrip `build_audio.py` versi baru atau `rebuild_tone.py`)
Untuk tiap item yang berbendera (dan sampel acak yang tidak berbendera sebagai kontrol):
1. Buat beberapa kandidat: variasi kecepatan, bingkai teks/tanda baca, parameter prosodi/voice Kokoro yang sah, variasi urutan/pengulangan lalu dipotong.
2. Jika kontur masih jauh dari templat: koreksi kontur (resintesis WORLD/PSOLA, perluas rentang nada ke templat dengan batas aman supaya tidak seperti robot) — pengembangan umum dari "metode A" Tahap 0.
3. Durasi minimum: lebarkan/ jeda sesuai persentil rujukan (jangan potong terlalu mepet; suku kata tunggal tidak boleh lebih pendek dari persentil-5 rujukan).
4. Pilih kandidat terbaik dengan skor gabungan: kontur + durasi + Whisper lolos + volume −16 LUFS. Catat pilihan di manifest (`tuning`).
5. Tahap 0 (suku kata tunggal, task 0): terapkan jalur yang sama begitu task 0 selesai (atau gabungkan bila task 0 masih jalan, tanpa menyentuh file-nya sebelum selesai).
Ganti file hanya bila skor membaik (hash di manifest, repo tidak membengkak). Naikkan `version` manifest agar cache browser terbarui.

### E. "Murid" + telinga pemilik
- Pengenal nada otomatis harus mengenali nada yang dimaksud; Whisper (dan satu pengenal suara kedua bila bisa dipasang, mis. FunASR/Paraformer, atau Whisper medium) harus menulis ulang huruf yang benar — ini proksi "murid paham".
- Halaman `public/samples-tone.html`: **sebelum vs sesudah** ±30 item (tiap nada, pasangan nada, kalimat pendek, suku kata Tahap 0), tiap baris ada grafik kontur + tombol putar. Tulis di PROGRESS "Butuh pemilik: dengarkan samples-tone.html dan putuskan".

## Di luar scope
Ganti suara P3/L3; melatih model TTS baru; layanan berbayar/berkunci; mengubah isi kata/kalimat.

## Kriteria lolos (angka dicatat di `task-4c-hasil.md`)
- Pengenal nada: ≥ 90 % suku kata suara P3/L3 dikenali sebagai nada yang dimaksud (dan laporkan angka rujukan asli sebagai batas atas).
- Tidak ada suku kata/kata yang lebih pendek dari persentil-5 rujukan (kecuali bendera dijelaskan).
- Median rentang nada ≥ 85 % dari median rujukan, tanpa terdengar rusak (kontrol sampel acak tidak turun skornya).
- Whisper lolos tidak turun dari 96,3 % (angka 4b), volume tetap seragam (−16 LUFS, puncak ≤ −1,5 dBTP).
- Atribusi semua rujukan lengkap di CREDITS.md dan halaman Sumber; `check:data`, tes, lint, build lolos; deploy sukses.
- Pemilik mendengar `samples-tone.html` dan setuju (tercatat di PROGRESS). Sebelum itu, task ditandai "menunggu telinga pemilik", bukan selesai penuh.
