# Task 2b · Ganti HSK 1 ke 300 kata silabus 2025

Model: Sonnet (implementasi), sesi utama Opus memeriksa. Prasyarat: task 2, 3 (selesai).
Keputusan pemilik 2026-11-22 (BUILD_PLAN bagian 1): isi HSK 1 = **300 kata silabus ujian HSK 2025** (CLEC, Nov 2025), menggantikan 500 kata daftar 2021. Kata lama yang tidak masuk dipindah ke `data/hsk2-preview/`, tidak dibuang.

## Sumber (sudah dicek sesi utama)
- Utama: **becky82/mteh**, folder `sources/HSK3.1/` — `HSK3.1_words_level1.txt` (tepat 300 baris, tanpa duplikat), plus PDF resmi `新版HSK考试大纲（词汇、汉字、语法）.pdf` dan `新版HSK考试大纲1219.pdf` di folder yang sama. Lisensi repo: **CC BY-SA 4.0** © 2025 Rebecca J. Stones (bagian "License" di README). Commit HEAD saat dicek: `6be297fc92f85590a4fc001f8f734ed5624497fc`. Ambil lewat `https://raw.githubusercontent.com/becky82/mteh/<commit>/sources/HSK3.1/HSK3.1_words_level1.txt` (API GitHub untuk repo lain diblokir di sesi; raw dan `git clone --sparse` jalan). Simpan salinan asli di `data/raw/hsk31_words_level1.txt`.
- Pembanding (wajib, minimal 1): cocokkan 300 kata dengan sumber lain yang memberi nomor 1–300, mis. teks PDF resmi di atas (`pdftotext`, cari bagian 一级 词汇), atau paket npm `@leonsilicon/hsk3.1` (turunan mteh — bukan sumber independen, hanya sanity check). Tulis hasil cocok/beda di `SOURCES.json`. Kalau ada beda yang tidak bisa dijelaskan: berhenti dan laporkan (jangan tebak).
- Kata dengan bagian opsional: `没（有）`, `有（一）点儿` → satu entri, `hanzi` = bentuk pendek atau yang umum (jelaskan pilihan), bentuk lain di `variants`.

Hasil perbandingan awal (sesi utama): 263 dari 300 sudah ada di `words.json` lama; 37 belum ada, di antaranya pasangan erhua/varian kata lama (`没事` ↔ `没事儿`, `一下` ↔ `一下儿`; periksa juga pasangan lain), dan kata baru seperti 边 你好 超市 出租车 饺子 猫 狗 苹果 椅子 便宜 漂亮 它 它们 可以 怎么样 这个 那个 哪个 问题 雪 千 只 做饭 女士 卖 玩 喂 些 件 店 分钟 公司 大家 不要. Untuk pasangan varian: kalau kata lama hanya beda erhua/varian, **pakai ulang ID lama** dan sesuaikan `hanzi` ke bentuk silabus 2025 (bentuk lama ke `variants`).

## Tujuan
Website menampilkan tepat 300 kata HSK 1 (silabus 2025) dalam unit bertema, semua data dan tampilan konsisten, tidak ada referensi rusak.

## Scope
1. **Daftar kata**: perluas `scripts/build-words.ts` (atau skrip baru yang dipanggil dari sana) supaya membaca daftar 2025 dan menghasilkan `data/hsk1/words.json` = 300 entri dengan skema sama (`id, hanzi, variants, traditional, pinyin, pinyinNumbered, syllables, tones, pos, en, ind, idMachine, hsk, chars`).
   - **ID stabil**: kata yang sudah ada memakai ID lama (`L1-xxxx`) agar adegan, visual, progres tetap tersambung. Kata baru mendapat ID baru lanjutan (`L1-0501` dst., urut sesuai daftar sumber). Urutan `words.json` = urutan daftar sumber 2025.
   - Kata baru: pinyin/nada/arti EN dari CC-CEDICT dengan aturan yang sama; POS dari sumber bila ada (`drkameleon/complete-hsk-vocabulary` MIT boleh dipakai untuk POS); terjemahan Indonesia ditulis model (kamu) ke `data/hsk1/translations-id.json`, `machine: true`. Periksa pinyin kata baru secara manual (mis. 一下 yíxià, 便宜 piányi, 漂亮 piàoliang, 怎么样 zěnmeyàng, 喂 wèi/wéi telepon).
   - Skrip bisa dijalankan ulang dengan hasil sama (deterministik).
2. **HSK 2 preview**: kata lama yang tidak masuk → `data/hsk2-preview/words.json` (skema sama, ID lama tetap, `hsk` diisi 2, tambahkan `"previewFrom": "hsk1-2021"`). Juga pindahkan entri `visuals.json` dan `scenes.json` milik kata itu ke `data/hsk2-preview/visuals.json` / `scenes.json` (file SVG di `public/art/scenes/` tidak dihapus). Tulis `data/hsk2-preview/README.md` singkat + daftar kata yang dipindah (hanzi, pinyin, ID).
3. **Unit**: susun ulang `data/hsk1/units.json` — unit bertema, **12–20 kata per unit**, tiap kata tepat di satu unit, urutan dari paling dasar (salam, angka, ini/itu & bertanya dulu). Pertahankan id unit `u01…` berurutan dan bentuk skema yang sama (title/description ID+EN). Jumlah unit menyesuaikan (sekitar 16–22).
4. **Kalimat contoh** (`data/hsk1/sentences.json`): data mentah Tatoeba tidak ada di sesi ini (hanya di workflow `fetch-tatoeba.yml`). Lakukan:
   - di sesi: sesuaikan `filter-sentences.ts` agar memakai 300 kata baru, lalu buat `sentences.json` sementara dengan menyaring kalimat yang sudah ada (kalimat yang memakai kata di luar 300 + aturan "maks 1 kata di luar HSK 1" tetap berlaku; field `words` diperbarui). Tambah opsi skrip untuk menyaring ulang dari `sentences.json` lama bila perlu.
   - workflow `fetch-tatoeba.yml` otomatis jalan saat `data/hsk1/units.json` berubah di `main` dan meng-commit hasil lengkap. Pastikan jalur ini tetap bekerja dengan data baru (path, skema), dan bahwa hasil workflow tidak merusak tes (mis. tes yang membandingkan dengan build ulang).
5. **Versi santai** (`casual.json`, `casual-candidates.json`, `casual-review.json`, `casual-evidence.json`): pindahkan ungkapan ke unit baru yang temanya cocok (3–5 per unit kalau tersedia; kurang boleh, catat). Ungkapan yang "padanan HSK"-nya tidak lagi ada di 300 kata: tetap boleh kalau padanan masih wajar, kalau tidak dikeluarkan dari unit (catat). Jangan menulis ungkapan baru (itu perlu cek berlapis) — kecuali hanya memindah. Pastikan `npm run build:casual` dan tesnya tetap konsisten; **jangan** mengubah `casual-evidence.json` tanpa workflow bukti.
6. **Dialog** (`dialogs.json`): dialog akan ditulis ulang total di task 3d. Di task ini cukup: pasangkan dialog lama ke unit baru kalau tema cocok **dan** lolos cek kosakata 300 kata + ungkapan lolos; dialog yang tidak lolos dikeluarkan dari `dialogs.json` (simpan di `data/hsk1/dialogs-retired.json` sebagai bahan 3d). Unit tanpa dialog harus tampil rapi (tanpa kotak kosong/error). Cek otomatis kosakata dialog memakai 300 kata.
7. **Visual & adegan**: `visuals.json` = 300 entri (urutan words.json); kata baru diberi entri visual (jenis + deskripsi adegan singkat, aturan sama dengan task 3c). `scenes.json`: hanya kata HSK 1 yang punya adegan; kata yang berpindah unit tetap memakai adegannya. Kata tanpa adegan tetap tampil normal seperti sekarang. `npm run check:visuals`, `build:scenes` lolos.
8. **Turunan**: jalankan ulang `build:lessons`, `build:strokes` (huruf baru seperti 狗 猫 饺 椅 苹 宜 漂 亮 …), dan subset font `build:font` bila bisa dijalankan di sesi (kalau tidak bisa karena unduhan, pastikan huruf baru tetap tampil lewat file font tambahan dan catat).
9. **Tampilan & teks**: ganti semua sebutan "500" (i18n, halaman, README, CREDITS, tes) ke 300 / silabus 2025. CREDITS.md: tambah becky82/mteh (CC BY-SA 4.0, commit) dan tandai daftar 2021 hanya dipakai untuk HSK 2 preview. `data/hsk1/SOURCES.json` diperbarui (sumber, commit, lisensi, hasil pembanding, `wordCount: 300`, daftar ID baru, daftar ID dipindah).
10. **Progres tersimpan**: progres lama di localStorage (`xue.progress.v1`) tidak boleh bikin error kalau berisi unit/kata yang sudah tidak ada (abaikan dengan aman). Tambah tes.
11. **Cek tautan data**: skrip `npm run check:data` (+ tes) yang memastikan setiap ID kata/unit yang dirujuk di `units.json`, `sentences.json`, `casual.json`, `dialogs.json`, `visuals.json`, `scenes.json`, dan `public/data/hsk1/**` ada di `words.json`, dan tiap kata tepat di 1 unit. Tambahkan ke job `check` di CI kalau ringan.

## Out of scope
- Menulis dialog baru (task 3d), ungkapan santai baru, ilustrasi/adegan baru (6b), audio (4b), Tahap 0.
- Mengubah keputusan bagian 1 BUILD_PLAN, warna, gaya.
- Folder `src/games/` dan file milik task 7 (sedang dikerjakan sesi lain) — jangan disentuh kecuali perlu untuk build lolos; laporkan kalau perlu.

## Acceptance criteria
1. `data/hsk1/words.json` tepat 300 entri, cocok 1:1 dengan daftar sumber 2025 (dengan aturan varian/opsional di atas); tiap entri punya hanzi, pinyin, nada, ≥ 1 arti EN dan ID.
2. Tiap kata tepat di 1 unit; tiap unit 12–20 kata.
3. `data/hsk2-preview/words.json` berisi semua kata lama yang tidak masuk (jumlah lama 500 − kata yang dipakai ulang), daftar tercatat.
4. `npm ci`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm test`, `npm run check:data`, `npm run check:visuals` lolos; skrip build data deterministik (jalankan dua kali → tanpa diff).
5. Tidak ada teks "500" yang tersisa terkait jumlah kata HSK 1.
6. Situs (preview build) membuka peta belajar, unit pertama, satu kata baru (mis. 你好 atau 猫), unit tanpa dialog — tanpa error di console; tidak ada scroll samping di 375 px.
7. SOURCES.json + CREDITS.md mencatat sumber, versi, izin, dan hasil pembanding.

## File terkait
`scripts/build-words.ts`, `scripts/filter-sentences.ts`, `scripts/build-casual.ts`, `scripts/build-lessons.ts`, `scripts/build-scenes.ts`, `scripts/build-strokes.ts`, `scripts/check-visuals.ts`, `data/hsk1/*`, `data/hsk2-preview/*` (baru), `data/raw/`, `src/lib/*.test.ts`, `src/lib/progress.ts`, `src/pages/learn/UnitScreen.tsx`, `DialogCard.tsx`, `src/i18n/*.json`, `public/data/hsk1/**`, `public/hanzi/`, `CREDITS.md`, `README.md`, `.github/workflows/deploy.yml`, `.github/workflows/fetch-tatoeba.yml`.
