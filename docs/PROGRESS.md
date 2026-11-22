# PROGRESS — Xué Mandarin v1

Diperbarui oleh setiap sesi kerja. Format: `- [x] Task — tanggal — model — ringkasan 1 baris`.

## Status task

- [x] 1 · Kerangka proyek + deploy — 2026-11-21 — Haiku (diperiksa Opus) — Vite+React+TS, halaman "segera hadir", deploy GitHub Pages sukses
- [x] 1b · Cek otomatis di CI + favicon — 2026-11-21 — Haiku (diperiksa Opus) — job `check` (typecheck, lint, test) wajib lolos sebelum build/deploy; favicon 学 ungu
- [x] 2 · Data kata HSK 1 — 2026-11-21 — Sonnet (diperiksa Opus) — 500 kata HSK 3.0 level 1 (pinyin, nada, jenis kata, arti EN CC-CEDICT, arti ID terjemahan mesin), skrip bisa diulang, 540 tes
- [x] 3 · Unit bertema + kalimat contoh — 2026-11-21 — Sonnet (diperiksa Opus, 1 kali perbaikan) — 20 unit bertema (20–31 kata), 2.405 kalimat Tatoeba beratribusi lewat workflow `fetch-tatoeba.yml`; semua unit ≥ 11 kalimat
- [x] 3b · Versi santai + dialog — 2026-11-21 — Opus menulis, Sonnet memeriksa (diperiksa Opus, 1 kali perbaikan) — 98 ungkapan santai lolos 5 lapis cek (4–5 per unit), 20 dialog 4–6 baris hanya kata HSK 1 + ungkapan lolos; bukti di `casual-evidence.json` lewat workflow `casual-evidence.yml`
- [x] 3c · Character sheet + daftar visual — 2026-11-21 — Opus (2 subagent, diperiksa Opus) — 13 tokoh SVG (depan/samping/belakang + 4 ekspresi + lembar) dari sistem rakit `npm run build:characters`; `visuals.json` 500/500 kata (139 benda, 117 aksi, 123 komik, 48 posisi, 41 pasangan, 32 hitungan)
- [x] 4a · Contoh suara — 2026-11-21 — Sonnet (diperiksa Opus) — 7 kandidat (P1–P4 perempuan, L1–L3 laki-laki; Kokoro v1.0/v1.1-zh, MeloTTS) × 5 kata + 2 kalimat lewat `tts-samples.yml`, mp3 seragam (−16 LUFS ±0.6), Whisper 42/49 cocok; halaman `samples.html`. **Pemilik memilih P3 (perempuan) + L3 (laki-laki) pada 2026-11-22.**
- [ ] 4b · Audio semua materi
- [x] 5 · Tampilan dasar — 2026-11-21 — Sonnet (diperiksa Opus) — tema + mode gelap, menu samping (layar lebar) / menu bawah (layar sempit), hash router, teks ID/EN tanpa reload, halaman Pengaturan; axe & tanpa scroll samping di 375/1366 lolos
- [x] 5b · Font Mandarin self-host — 2026-11-21 — Haiku (diperiksa Opus) — LXGW WenKai disubset & disimpan sendiri (inti 300 huruf HSK 1 ±64 KB per ketebalan, tambahan ±246 KB dimuat hanya bila perlu); Noto Sans SC dari Google Fonts dihapus; `npm run build:font`
- [x] 6 · Layar unit + peta belajar — 2026-11-21 — Opus (diperiksa Opus, 1 kali perbaikan kecil) — peta 20 unit + bintang + tes loncat (≥ 80 %), ringkasan unit (versi santai + dialog), kenalan kata (huruf WenKai 120 px berwarna nada, animasi coretan Hanzi Writer data lokal 384 huruf, contoh kalimat Tatoeba), latihan 12 soal (4 jenis, keyboard 1–4/Enter/Spasi); suara sementara dari perangkat
- [ ] 6b · Ilustrasi + animasi semua kata — SEDANG DIKERJAKAN (mulai 2026-11-21 23:45 UTC, tahap 1: unit 1–3)
- [ ] 7 · Empat game — SEDANG DIKERJAKAN (mulai 2026-11-21 23:59 UTC)
- [ ] 8 · Progres + ulangan harian + cadangan
- [ ] 9 · Kamus + Sumber + lapor salah
- [ ] 10 · Pengecekan akhir + rilis v1

## Butuh pemilik

- **Keputusan jumlah kata HSK 1 (tidak mendesak)**: menurut beberapa sekolah Mandarin, silabus HSK 3.0 versi final (terbit Nov 2025, ujian baru mulai 13 Des 2026) memangkas HSK 1 dari 500 kata menjadi 300 kata. Sekarang website tetap memakai 500 kata (sesuai keputusan awal). Pilihan: tetap 500, atau ganti ke daftar 300 kata (perlu daftar resmi). Pekerjaan lanjut tetap jalan dengan 500 kata sampai pemilik memutuskan.

## Catatan & temuan

- 2026-11-21: Repo dijadikan public; GitHub Pages source = GitHub Actions.
- 2026-11-21 (task 2): 11 arti Inggris diperbaiki manual (`data/hsk1/en-overrides.json`), 16 kata memakai arti CEDICT dengan nada ringan berbeda; detail di `data/hsk1/SOURCES.json`. Sekitar 100 kata gabungan tidak punya jenis kata di sumber (`pos: []`).
- 2026-11-21 (task 3): 27 kata belum punya kalimat contoh Tatoeba yang lolos filter: 包子 本子 不客气 打球 东边 好玩儿 后边 教学楼 里边 没事儿 面条儿 女生 前边 请假 请进 日期 上车 书包 听写 外边 网友 小学 一块儿 一下儿 右边 中间 中学生. Bisa diisi nanti (mis. kalimat dialog task 3b). Kalimat dengan terjemahan Indonesia masih sedikit; kebanyakan hanya Inggris.
- 2026-11-21 (task 3b): 142 kandidat → 111 lolos (21 gugur karena < 2 sumber luar, mis. bentuk X死了/X啦/太棒了 tidak ada di kamus; 10 gugur di pemeriksa kedua, mis. 多谢 老铁 打的 回见 走人). 干嘛 gugur karena Wiktionary menandai satu artinya kasar. Unit 3 dan 17 hanya 4 ungkapan (masih dalam batas 3–5). Kalau `casual-candidates.json` diubah, workflow bukti jalan lagi; setelah itu jalankan `npm run build:casual` dan review ulang kandidat baru, supaya tes "hasil = build ulang" tetap lolos.
- 2026-11-21 (task 3c): Kakak digambar remaja (±90 % tinggi dewasa), padahal di dialog temannya "teman kuliah"; beberapa adegan visual menaruh Kakak di sekolah menengah. Perlu diselaraskan saat task 6b (cukup ubah umur di satu tempat). Alis gelap kurang terlihat di depan poni gelap (Guru, Teman kuliah) pada beberapa ekspresi. Pose tangan baru netral saja; pose lain dibuat di task 6b.
- 2026-11-21 (task 4a): `你好` dan `喝水` bukan entri tersendiri di `words.json` (dipecah 你+好, 喝+水); contoh tetap memakai keduanya. MeloTTS butuh versi pustaka lama, jadi dijalankan di lingkungan Python terpisah dalam workflow; unduhan BERT tambahannya belum dipatok versinya. Workflow hanya jalan otomatis di cabang selain `main` (atau dijalankan manual).
- 2026-11-21 (task 5): Warna nada 3 (#2B8A3E) hanya mencapai kontras 4,39:1 di atas putih (batas AA teks biasa 4,5), jadi nada 3 sebaiknya dipakai untuk huruf besar/tebal saja (batas 3:1). Teks putih di atas hijau #2F9E44 dan jingga #E8590C tidak cukup kontras, jadi tombol berteks putih memakai versi lebih gelap (#25803A, #C2410C); warna merek aslinya tetap dipakai untuk hiasan. Di layar sempit tombol bahasa ID/EN hanya ada di halaman Pengaturan.
- 2026-11-21 (task 5b): Tanda kutip ‘ ’ tidak ada di font WenKai (memakai font cadangan). File tambahan (extra, 970 huruf) ikut memuat huruf dari file bukti mentah (mis. `casual-evidence-raw.json`) yang tidak tampil di website; bisa dipersempit nanti bila perlu. Preload memakai versi tebal-biasa (400) padahal logo memakai 700; tidak merusak, bisa disesuaikan saat task 6.
- 2026-11-21 (task 6): Suara di layar belajar SEMENTARA memakai suara bawaan browser/perangkat (ditandai di layar); bila perangkat tidak punya suara Mandarin, tombol suara mati dengan keterangan dan soal "dengar → huruf" diganti. Task 4b cukup mengganti `src/lib/audio.ts`. Progres disimpan di `xue.progress.v1` (siap diperluas task 8). Bintang: ≥ 90 % = 3, ≥ 75 % = 2, ≥ 60 % = 1 (unit selesai bila ≥ 1 bintang). Data per unit di `public/data/hsk1/units/` dibuat ulang dengan `npm run build:lessons` setiap data di `data/hsk1/` berubah. Tempat "satu game singkat" di layar nilai menunggu task 7.
