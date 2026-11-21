# PROGRESS — Xué Mandarin v1

Diperbarui oleh setiap sesi kerja. Format: `- [x] Task — tanggal — model — ringkasan 1 baris`.

## Status task

- [x] 1 · Kerangka proyek + deploy — 2026-11-21 — Haiku (diperiksa Opus) — Vite+React+TS, halaman "segera hadir", deploy GitHub Pages sukses
- [x] 1b · Cek otomatis di CI + favicon — 2026-11-21 — Haiku (diperiksa Opus) — job `check` (typecheck, lint, test) wajib lolos sebelum build/deploy; favicon 学 ungu
- [x] 2 · Data kata HSK 1 — 2026-11-21 — Sonnet (diperiksa Opus) — 500 kata HSK 3.0 level 1 (pinyin, nada, jenis kata, arti EN CC-CEDICT, arti ID terjemahan mesin), skrip bisa diulang, 540 tes
- [x] 3 · Unit bertema + kalimat contoh — 2026-11-21 — Sonnet (diperiksa Opus, 1 kali perbaikan) — 20 unit bertema (20–31 kata), 2.405 kalimat Tatoeba beratribusi lewat workflow `fetch-tatoeba.yml`; semua unit ≥ 11 kalimat
- [x] 3b · Versi santai + dialog — 2026-11-21 — Opus menulis, Sonnet memeriksa (diperiksa Opus, 1 kali perbaikan) — 98 ungkapan santai lolos 5 lapis cek (4–5 per unit), 20 dialog 4–6 baris hanya kata HSK 1 + ungkapan lolos; bukti di `casual-evidence.json` lewat workflow `casual-evidence.yml`
- [ ] 3c · Character sheet + daftar visual
- [ ] 4a · Contoh suara (butuh pilihan pemilik)
- [ ] 4b · Audio semua materi
- [ ] 5 · Tampilan dasar
- [ ] 5b · Font Mandarin self-host
- [ ] 6 · Layar unit + peta belajar
- [ ] 6b · Ilustrasi + animasi semua kata
- [ ] 7 · Empat game
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
