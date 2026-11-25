# Task 6c · Animasi per kalimat + dialog per kata (hybrid) — pengganti 6b tahap 4 dst.

Model: Opus (menulis kalimat/dialog, adegan, UI, memeriksa), Sonnet (pemeriksa kalimat, cek data). Cabang: `task-6c`. **Mulai paling ccepat Kamis 2026-11-26 01:00 WIB** (permintaan pemilik 2026-11-25 23:27). Pengganti 6b tahap 4 dst. (6b dihentikan). Prasyarat: 6b tahap 1–3 (unit 1–12, di main) dan cabang `task-6b-4` (unit 13–16).

## Tujuan
Tiap kata HSK 1 punya animasi yang menggambarkan **satu kalimat contoh** (balon bicara berisi kalimat, kata yang dipelajari disorot). Kata yang butuh percakapan agar paham (partikel 吗/呢/吧, sapaan, tawar-menawar, dll.) memakai **dialog** (2–4 baris, tokoh bergantian, dengan suara P3/L3). Materi saling terkait: utamakan kata HSK 1 yang sudah ada; boleh kata dari luar bila contoh dari materi tidak ada atau tidak sederhana/sehari-hari. Tahap 0 memakai cara yang sama.

## Keputusan pemilik (final)
- Default 1 kalimat per kata; dialog hanya untuk kata yang butuh agar mudah paham.
- Pendekatan HYBRID: prioritas kata yang sudah ada di materi (unit ini + sebelumnya); kata luar boleh (agar belajar lebih banyak kalimat sehari-hari).
- Sumber kalimat boleh: Tatoeba (sebagai referensi/dipakai), kalimat buatan, kalimat dari kata yang sudah ada.
- DIBATALKAN: info "dipelajari di Unit N" saat kata disentuh. Cukup sorot kata baru.
- Dialog tidak di luar kata; dialog panjang per unit tetap ada sebagai "cerita unit".

## Aturan pemilihan kalimat (urut prioritas)
1. Kalimat dari kata unit ini + unit sebelumnya (dari `sentences.json`/`casual.json`/`dialogs-natural.json` bila sederhana dan sehari-hari; bila tidak ada, susun baru dari kata-kata itu).
2. Kalimat Tatoeba sederhana (rujukan atau dipakai langsung; atribusi di CREDITS).
3. Kalimat buatan dengan kata luar HSK 1 bila 1–2 tidak sederhana/sehari-hari. Kata luar dicatat (`outsideWords`), jumlahnya dibatasi (maks 2 per kalimat) dan tidak boleh kata yang sulit.
Syarat tiap kalimat: benar, alami, sederhana (kira-kira ≤ 10 huruf, satu situasi sehari-hari), cocok digambar, dan memuat kata yang diajarkan. Pemeriksaan berlapis seperti 3b/3d: dua sumber luar (kamus/Tatoeba paralel) untuk kalimat buatan, pemeriksa AI kedua menilai ≥ 4/5 (alami + benar + cocok untuk pemula), gagal satu → dibuang/ditulis ulang. Kalimat tentang uang, kesehatan serius, atau topik sensitif dihindari.

## Scope
### Stage 0 — dasar (sebelum yang lain)
Periksa cabang `task-6b-4` (56 adegan u13–u16): cek kejelasan gambar, kontras, tampilan 375 px, `check:visuals`; perbaiki; gabung ke main (jadi dasar yang dipakai ulang).
### Stage 1 — data
`data/hsk1/word-sentences.json`: per kata `{ wordId, sentence:{hanzi,pinyin,id,en,source:"unit"|"tatoeba"|"buatan", sourceId?, outsideWords:[]}, dialog?:{ speakers, lines:[{who,hanzi,pinyin,id,en}], reason }, sceneRef }`. Daftar kata yang butuh dialog + alasan (misal partikel, sapaan, tawar-menawar). Hasil pemeriksaan di `word-sentences-review.json`. Mulai dari unit 1–12 (adegan sudah ada), lalu 13–21.
### Stage 2 — UI + animasi
- Ubah `WordScene` agar memutar urutan: tokoh bicara bergantian → balon muncul satu per satu, kata yang diajarkan disorot warna, suara P3/L3 per baris, tombol putar ulang/pelan; hormati `prefers-reduced-motion` (tampil diam, balon penuh).
- Adegan: pakai ulang sistem rakit (`scenes.json`, `build:scenes`); ubah isi balon jadi kalimat; adegan yang tidak cocok digambar ulang. Dialog ditampilkan di kartu kata (bukan terpisah).
- Hapus/kurangi daftar contoh Tatoeba yang menggandakan; contoh lain tetap boleh sebagai "contoh lain". Tidak ada info "dipelajari di Unit N".
- Tidak merusak layar lebar (task 5c) maupun 375 px.
### Stage 3 — audio
Kalimat/dialog baru ditambahkan ke daftar audio (workflow `build-audio.yml`), P3/L3, dicek Whisper dan standar `docs/STANDAR-UKUR-SUARA.md` (task 4c). Boleh menunggu 4c bila pipeline suara sedang diubah; jangan membuat dua pipeline.
### Stage 4 — unit 17–21
Adegan baru untuk kata unit 17–21 langsung dengan konsep baru (tidak menggambar versi lama).
### Stage 5 — Tahap 0
Animasi/kalimat/dialog sejenis untuk ungkapan kelas, salam dasar, angka 1–10, dan contoh kata radikal; tahap pinyin dan nada tetap memakai peraga yang ada.

## Di luar scope
Pelajaran kecil + ujian acak + kelulusan (ide parkir terpisah); HSK 2+; login; mengubah suara terpilih; video.

## Kriteria lolos
- 300/300 kata punya kalimat contoh digambarkan; dialog hanya untuk kata yang ada di daftar "butuh dialog" (dengan alasan).
- Semua kalimat/dialog lolos pemeriksaan berlapis (skor ≥ 4); kata luar tercatat dan ≤ 2 per kalimat.
- ≥ 70 % kalimat memakai kata dari unit ini + sebelumnya (angka dilaporkan).
- Animasi: bergerak lancar, `prefers-reduced-motion` dihormati, keyboard (Spasi/Enter) bisa, axe lolos terang & gelap, tanpa scroll samping di 375 px dan 1920 px.
- Audio ada untuk semua kalimat/dialog baru dan lolos pemeriksaan suara.
- Atribusi lengkap (Tatoeba, dll.) di CREDITS.md + halaman Sumber; tes, lint, `check:data`, `check:visuals`, build, deploy lolos.
- Dikerjakan bertahap per stage (push ke `task-6c` tiap ≤ 45 menit); tiap stage dicentang di PROGRESS dengan ringkasan dan daftar adegan terlemah.
