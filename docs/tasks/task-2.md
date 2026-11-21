# Task 2 · Data kata HSK 1

Model: Sonnet (diperiksa sesi utama Opus). Prasyarat: task 1 (selesai).

## Tujuan
Satu file data `data/hsk1/words.json` berisi semua kata HSK 3.0 level 1 (daftar 2021, 500 kata, sesuai keputusan bagian 1) lengkap dengan huruf, pinyin, nada, jenis kata, arti Inggris (CC-CEDICT) dan arti Indonesia (terjemahan mesin, ditandai). Dibuat oleh skrip yang bisa dijalankan ulang dengan hasil sama persis.

## Sumber (sudah dicek bisa diakses dari sesi kerja)
- Daftar HSK: `https://raw.githubusercontent.com/ivankra/hsk30/4ff9e3915ce87baaecd7ebe263085573a4ea3192/hsk30.csv` (commit dipatok). Kolom: `ID,Simplified,Traditional,Pinyin,POS,Level,WebNo,WebPinyin,OCR,Variants,CEDICT`. Level 1 = 500 baris (`Level` = `1`). Simpan salinan asli utuh di `data/raw/hsk30.csv`.
- CC-CEDICT: paket npm `cedict-json@1.3.20251213` (devDependency, versi dipatok persis). Isi `cedict.json`: array `{traditional, simplified, pinyin: "ai4 hao4", english: string[]}`. Lisensi CC BY-SA 4.0.

## Scope
1. `src/lib/pinyin.ts` (dipakai juga nanti oleh aplikasi, mis. pencarian kamus):
   - `splitSyllables(toneMarked: string): string[]` — pecah pinyin bertanda nada (mis. `àihào` → `ài`,`hào`; `xī'ān`; `nǚ'ér`; `péngyou`; huruf `er` akhiran `r` seperti `yìdiǎnr`).
   - `syllableTone(s): 1|2|3|4|5` (5 = nada ringan/tanpa tanda) dan `toNumbered(s)` (`ài` → `ai4`, `lǜ` → `lv4`/`lü4` — pilih satu, dokumentasikan; `ma` → `ma5`).
   - `stripTones(s)` (tanpa tanda nada, untuk pencarian).
   - Bila hasil pemecahan tidak cocok jumlah suku kata dengan jumlah huruf Han, gunakan kolom `CEDICT` di CSV (mis. `爱好[ai4 hao4]`) sebagai acuan; catat kasus yang tetap tidak cocok.
2. `src/lib/pinyin.test.ts` — tes unit (vitest) minimal 15 kasus termasuk: nada 1–4, nada ringan, ü/lǚ/nǚ, apostrof, `r` akhiran, huruf kapital, spasi, kata 3+ suku kata.
3. `scripts/build-words.ts` (jalan dengan `tsx`, `npm run build:words`):
   - Default pakai `data/raw/hsk30.csv` yang sudah ada; flag `--fetch` mengunduh ulang dari URL commit di atas.
   - Parsing CSV yang benar (field berkutip dengan koma/kutip ganda di kolom `Variants`).
   - Ambil hanya Level 1. Untuk istilah bervarian (`爸爸|爸`, `有（一）点儿`, dll.) pakai kolom `Variants` / varian pertama sebagai `hanzi` utama, simpan semua bentuk lain di `variants[]` (boleh kosong).
   - `en[]`: dari CC-CEDICT, cocokkan `simplified` + pinyin angka (abaikan huruf besar/kecil, `u:`=`ü`, nada 5). Kalau tidak ada yang cocok pinyinnya, pakai entri dengan `simplified` sama. Buang arti `CL:...`, `variant of ...`, `old variant ...`, `surname ...` (kecuali itu satu-satunya arti). Maksimal 6 arti, urutan sesuai CEDICT. Kata tanpa arti CEDICT → isi dari `data/hsk1/en-overrides.json` (dibuat manual, ditandai sumbernya) dan catat.
   - `ind[]` + `idMachine: true`: dari `data/hsk1/translations-id.json` (lihat poin 4). Skrip gagal (exit ≠ 0) kalau ada kata tanpa terjemahan.
   - Tulis `data/hsk1/words.json` (array urut menurut `id`, JSON 2 spasi, diakhiri newline) dan `data/hsk1/SOURCES.json` (URL, commit, versi cedict-json, lisensi, jumlah kata, ringkasan kasus khusus). **Jangan** menulis waktu/tanggal yang berubah tiap dijalankan.
4. `data/hsk1/translations-id.json`: dibuat oleh model (kamu) sekali, dari arti Inggris + konteks HSK 1. Bentuk: `{ "L1-0001": { "ind": ["cinta", "suka"], "machine": true }, ... }` untuk semua 500 kata. Bahasa Indonesia baku sehari-hari, singkat (1–4 arti), sesuai makna dasar di HSK 1, untuk kata tugas/partikel beri penjelasan singkat dalam kurung (mis. `了` → `["(penanda kejadian selesai/perubahan)"]`). Jangan ditimpa oleh skrip.
5. Bentuk tiap entri `words.json`:
   ```
   { "id": "L1-0001", "hanzi": "爱", "variants": [], "traditional": "愛",
     "pinyin": "ài", "pinyinNumbered": "ai4", "syllables": ["ài"], "tones": [4],
     "pos": ["V"], "en": ["to love", ...], "ind": ["cinta", ...], "idMachine": true,
     "hsk": 1, "chars": ["爱"] }
   ```
   Catatan: arti Indonesia memakai nama `ind` (kode bahasa ISO) karena `id` sudah dipakai untuk kode kata. `pinyinNumbered` dipisah spasi per suku kata. `chars` = huruf Han unik dalam `hanzi`, urutan muncul.
6. `src/lib/words.test.ts`: tes data — 500 entri, `id` unik, tiap entri punya `hanzi`, `pinyin`, `en.length ≥ 1`, `ind.length ≥ 1`, `idMachine === true`, `tones.length === syllables.length`, semua nada 1–5.
7. `package.json`: tambah devDependency `vitest`, `tsx`, `cedict-json@1.3.20251213` (versi persis); script `"test": "vitest run"`, `"build:words": "tsx scripts/build-words.ts"`. `tsconfig.node.json`: tambahkan `scripts` ke `include` supaya ikut typecheck. Lint (`oxlint`) harus bersih.
8. `CREDITS.md`: perbarui bagian HSK (commit ivankra/hsk30, lisensi repo) dan CC-CEDICT (CC BY-SA 4.0, lewat paket `cedict-json`, versi), serta catatan "arti Indonesia = terjemahan mesin".
9. `data/hsk1/SOURCES.json` juga memuat `notes` tentang daftar HSK 3.0 2025/2026 (lihat bawah).

## Temuan HSK 2026 (untuk dicatat di SOURCES.json, bukan diubah)
Silabus HSK 3.0 versi final (CLEC, terbit Nov 2025, ujian baru mulai 13 Des 2026) menurut sumber sekunder (studycli.org, thatsmandarin.com, hsklord.com) memangkas HSK 1 menjadi **300 kata** (dari 500 di daftar 2021). Daftar resmi lengkap belum diperoleh di sesi ini. Keputusan bagian 1 tetap 500 kata; perubahan ke 300 butuh keputusan pemilik.

## Out of scope
- Unit, kalimat contoh, audio, tampilan. Mengubah kode aplikasi di `src/` selain `src/lib/`.
- Mengimpor `words.json` ke aplikasi.

## Acceptance criteria
- `words.json` berisi tepat 500 kata (= jumlah baris Level 1 sumber), `id` unik.
- Tiap kata punya `hanzi`, `pinyin`, `pinyinNumbered`, `tones`, ≥ 1 arti `en` dan ≥ 1 arti `ind`, `idMachine: true`.
- Menjalankan `npm run build:words` dua kali → `git diff` kosong (hasil sama).
- `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` lolos.
- Tes unit parser pinyin/nada ada dan lolos.
- Pemeriksa mengecek acak ≥ 30 kata (pinyin, nada, arti EN/ID masuk akal).
- Workflow deploy GitHub Actions sukses setelah push.

## File terkait
- `scripts/build-words.ts`, `src/lib/pinyin.ts`, `src/lib/pinyin.test.ts`, `src/lib/words.test.ts`
- `data/raw/hsk30.csv`, `data/hsk1/words.json`, `data/hsk1/translations-id.json`, `data/hsk1/en-overrides.json` (bila perlu), `data/hsk1/SOURCES.json`
- `package.json`, `package-lock.json`, `tsconfig.node.json`, `CREDITS.md`
