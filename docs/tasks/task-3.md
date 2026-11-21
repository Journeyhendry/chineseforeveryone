# Task 3 · Unit bertema + kalimat contoh

Model: Sonnet (diperiksa sesi utama Opus). Prasyarat: task 2 (selesai).

## Tujuan
500 kata HSK 1 dibagi ke unit bertema berurutan dari yang paling dasar, dan tiap kata/unit punya kalimat contoh asli dari Tatoeba (dengan terjemahan Inggris/Indonesia dan atribusi lengkap).

## Bagian A · Unit (`data/hsk1/units.json`)
- 15–20 unit bertema (mis. Salam & sopan santun, Angka, Diri & orang, Keluarga, Makanan & minuman, Waktu & tanggal, Tempat & arah, Sekolah, Pekerjaan, Belanja & uang, Transportasi, Rumah, Kegiatan sehari-hari, Sifat & perasaan, Tubuh & kesehatan, Cuaca, Kata tugas/tata bahasa dasar …). Kata tugas yang sangat dasar (是, 的, 不, 吗, 我, 你 …) masuk unit paling awal tempat ia pertama kali dibutuhkan, bukan semuanya ditumpuk di akhir.
- Tiap unit 20–35 kata; tiap kata (`id` dari `words.json`) tepat di satu unit; total 500.
- Bentuk:
  ```
  { "version": 1, "units": [
    { "id": "u01", "order": 1, "slug": "salam", "title": { "id": "Salam", "en": "Greetings" },
      "description": { "id": "...", "en": "..." }, "words": ["L1-0xxx", ...] } ] }
  ```
  Urutan `words` dalam unit = urutan belajar (dasar dulu).
- Dibuat oleh model (kamu), lalu diperiksa skrip validasi (poin C).

## Bagian B · Kalimat Tatoeba
Sesi kerja tidak bisa mengakses tatoeba.org, jadi pengunduhan berjalan di GitHub Actions.

1. `scripts/filter-sentences.ts` (tsx, `npm run build:sentences -- --in <folder>`): membaca file ekspor Tatoeba yang sudah diekstrak di folder input dan `data/hsk1/words.json` + `units.json`, menulis:
   - `data/hsk1/sentences.json`
   - `data/hsk1/sentences-report.json` (jumlah kalimat per unit dan per kata, unit yang < 5 kalimat, kata tanpa kalimat, statistik filter).
   Fungsi inti (segmentasi, filter, peringkat) ada di `src/lib/sentences.ts` agar bisa dites tanpa jaringan.
2. File ekspor yang dipakai (https://downloads.tatoeba.org/exports/): 
   - `per_language/cmn/cmn_sentences_detailed.tsv.bz2` (id, lang, text, username, date_added, date_modified)
   - `per_language/eng/eng_sentences_detailed.tsv.bz2`, `per_language/ind/ind_sentences_detailed.tsv.bz2`
   - `per_language/cmn/cmn-eng_links.tsv.bz2`, `per_language/cmn/cmn-ind_links.tsv.bz2` (sentence_id, translation_id)
   - `tags.tar.bz2` (tags.csv: sentence_id, tag_name) → tag `OK`
   - `sentences_with_audio.tar.bz2` (sentence_id, audio_id, username, license, attribution_url)
   - `sentences_CC0.tar.bz2` (id kalimat berlisensi CC0); kalimat lain = CC BY 2.0 FR.
   Nama/kolom file bisa berbeda: skrip harus mencetak baris pertama tiap file dan gagal dengan pesan jelas bila kolom tidak sesuai. Saring baris sebelum memuat semuanya ke memori bila file besar (stream baris per baris).
3. Aturan filter:
   - Hanya kalimat cmn yang punya ≥ 1 terjemahan Inggris (langsung ter-link).
   - Teks hanya huruf Han sederhana + tanda baca umum (。，！？、：；“”‘’《》…·—） + angka Arab; tolak yang berisi huruf Latin atau huruf tradisional (cek: tidak ada karakter yang berubah lewat tabel tradisional→sederhana sederhana dari kolom `traditional` di words.json bukan cukup — gunakan cara sederhana: tolak kalimat yang berisi karakter yang ada di `Traditional` HSK 1 tapi berbeda dari `Simplified`-nya, misal 們 愛 說 這).
   - Segmentasi: pencocokan terpanjang (maksimum dari kiri) memakai `hanzi` + `variants` semua kata HSK 1, ditambah bentuk umum yang turunan langsung: angka Arab, tanda baca. Karakter yang tidak cocok dikelompokkan menjadi satu "kata asing" per deretan berurutan.
   - Boleh maksimal 1 kata asing, panjangnya ≤ 2 huruf; kalimat seperti itu ditandai `outside: "<teks kata asing>"`, selain itu `outside: null`.
   - Panjang 4–20 huruf Han.
4. Peringkat & batas (agar file tetap kecil): untuk tiap kata, urutkan kandidat menurut (ada tag OK, ada audio berlisensi, ada terjemahan Indonesia, `outside` null, lebih pendek, id lebih kecil) dan simpan maksimal 8 kalimat per kata; `sentences.json` = gabungan unik, diurutkan menurut id Tatoeba. Hasil harus deterministik.
5. Bentuk entri `sentences.json`:
   ```
   { "tatoebaId": 123, "cmn": "我爱你。", "author": "username", "license": "CC BY 2.0 FR",
     "ok": true, "outside": null, "words": ["L1-0001", ...], "unit": "u03",
     "en": [{ "tatoebaId": 1, "text": "I love you.", "author": "x", "license": "CC BY 2.0 FR" }],
     "ind": [ ... sama ... ],
     "audio": [{ "audioId": 9, "author": "x", "license": "CC BY-NC 4.0", "attributionUrl": "..." }] }
   ```
   `unit` = unit paling akhir (urutan tertinggi) dari kata-kata di kalimat (kalimat baru boleh dipakai setelah semua katanya dipelajari). `en`/`ind` maksimal 2 terjemahan. `audio` hanya catatan atribusi (file audio tidak diunduh di task ini); simpan apa adanya kolom lisensinya, termasuk yang kosong.
   File besar tambahan (`data/hsk1/sentences.json`) di atas 3 MB → turunkan batas per kata ke 6 lalu 5.
6. `.github/workflows/fetch-tatoeba.yml`:
   - Pemicu: `workflow_dispatch` dan `push` ke `main` hanya bila berubah `.github/workflows/fetch-tatoeba.yml`, `scripts/filter-sentences.ts`, `src/lib/sentences.ts`, atau `data/hsk1/units.json`.
   - `permissions: contents: write`. `concurrency` group `fetch-tatoeba`.
   - Langkah: checkout, Node 22 + `npm ci`, unduh file di atas dengan `curl -fL --retry 3` ke folder sementara (bukan di repo), ekstrak (bunzip2 / tar), jalankan `npm run build:sentences -- --in <folder>`, lalu bila `data/hsk1/sentences*.json` berubah: commit sebagai `github-actions[bot]` dengan pesan `Data: update Tatoeba sentences` dan `git pull --rebase` lalu push ke `main`. Jangan commit file mentah Tatoeba.
   - Workflow `deploy.yml` tidak diubah.
7. `CREDITS.md`: bagian Tatoeba diperjelas — kalimat CC BY 2.0 FR (sebagian CC0), nama penulis tiap kalimat disimpan di data, lisensi audio per perekam; tanggal unduhan dicatat di `data/hsk1/sentences-report.json` (boleh berubah tiap unduh).

## Bagian C · Tes & validasi
- `src/lib/units.test.ts`: 15–20 unit, tiap unit 20–35 kata, semua 500 kata tepat sekali, tidak ada id asing, `order` 1..N berurutan, judul ID/EN tidak kosong.
- `src/lib/sentences.test.ts`: dengan data contoh kecil buatan (fixture di tes, bukan unduhan): segmentasi terpanjang, kata asing (0/1/2), tolak huruf Latin/tradisional, batas panjang, penentuan `unit`, peringkat & batas per kata, hasil deterministik.
- Bila `data/hsk1/sentences.json` sudah ada: tes data memeriksa tiap entri punya `tatoebaId`, `author`, `license`, ≥ 1 `en` beratribusi, `words` hanya id yang valid. Bila belum ada, tes data dilewati (bukan gagal).

## Out of scope
- Mengunduh file audio, tampilan/aplikasi, ungkapan santai & dialog (3b), pinyin per kalimat.
- Mengubah `deploy.yml` atau `words.json`.

## Acceptance criteria
- `units.json` lolos `units.test.ts`; pembagian tema masuk akal saat diperiksa (cek acak tiap unit).
- `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` lolos.
- Workflow `fetch-tatoeba.yml` sukses di GitHub Actions dan meng-commit `sentences.json` + `sentences-report.json`.
- Tiap unit punya ≥ 5 kalimat contoh, atau kekurangannya tercatat di `sentences-report.json` dan PROGRESS.md.
- Tiap kalimat dan terjemahan punya id Tatoeba, penulis, lisensi.

## File terkait
- `data/hsk1/units.json`, `data/hsk1/sentences.json`, `data/hsk1/sentences-report.json`
- `scripts/filter-sentences.ts`, `src/lib/sentences.ts`, `src/lib/units.test.ts`, `src/lib/sentences.test.ts`
- `.github/workflows/fetch-tatoeba.yml`, `package.json`, `CREDITS.md`
