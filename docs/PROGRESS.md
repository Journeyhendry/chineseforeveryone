# PROGRESS — Xué Mandarin v1

Diperbarui oleh setiap sesi kerja. Format: `- [x] Task — tanggal — model — ringkasan 1 baris`.

## Status task

- [x] 1 · Kerangka proyek + deploy — 2026-11-21 — Haiku (diperiksa Opus) — Vite+React+TS, halaman "segera hadir", deploy GitHub Pages sukses
- [x] 1b · Cek otomatis di CI + favicon — 2026-11-21 — Haiku (diperiksa Opus) — job `check` (typecheck, lint, test) wajib lolos sebelum build/deploy; favicon 学 ungu
- [x] 2 · Data kata HSK 1 — 2026-11-21 — Sonnet (diperiksa Opus) — 500 kata HSK 3.0 level 1 (pinyin, nada, jenis kata, arti EN CC-CEDICT, arti ID terjemahan mesin), skrip bisa diulang, 540 tes
- [ ] 3 · Unit bertema + kalimat contoh
- [ ] 3b · Versi santai + dialog
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
