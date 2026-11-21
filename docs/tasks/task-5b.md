# Task 5b · Font Mandarin self-host (LXGW WenKai)

Model: Haiku (diperiksa sesi utama Opus). Prasyarat: task 5 (selesai).

## Tujuan
Huruf Mandarin di website memakai font LXGW WenKai (霞鹜文楷) yang disimpan di repo sendiri (self-host), bukan Noto Sans SC dari Google Fonts. Hanya huruf yang dipakai website yang disertakan (subset), supaya file kecil.

## Sumber font
- Paket npm `lxgw-wenkai-webfont@1.7.0` (berisi font LXGW WenKai v1.250300 yang sudah dipotong-potong jadi banyak file `.woff2`, plus `OFL.txt`). Lisensi font: SIL Open Font License 1.1; paket: MIT.
- Unduhan GitHub (rilis resmi lxgw) diblokir di sesi kerja, jadi pakai paket npm ini. Ambil dengan `npm pack lxgw-wenkai-webfont@1.7.0` ke folder sementara (JANGAN commit tarball / file potongan asli, ukurannya ±30 MB). Cocokkan `integrity` dari `npm view lxgw-wenkai-webfont@1.7.0 dist.integrity` sebelum dipakai.

## Scope
1. `scripts/font/build_font.py` (Python 3, `fontTools` + `brotli`; versi dipatok di `scripts/font/requirements.txt`):
   - Kumpulkan huruf yang dibutuhkan:
     - **core**: semua huruf di `hanzi` pada `data/hsk1/words.json` + tanda baca Mandarin umum (，。？！、：；“”‘’（）《》…—·～) + angka dan huruf Latin dasar tidak perlu.
     - **extra**: semua huruf Han lain (U+3400–9FFF, U+F900–FAFF) yang muncul di `data/hsk1/*.json` dan `src/**` (i18n, komponen) tetapi tidak ada di core.
   - Dari file potongan `lxgwwenkai-regular-subset-*.woff2` dan `lxgwwenkai-bold-subset-*.woff2`, pilih hanya potongan yang memuat huruf yang dibutuhkan, gabungkan (`fontTools.merge`), lalu subset (`fontTools.subset`) ke daftar huruf core dan extra secara terpisah. Simpan sebagai woff2.
   - Output (4 file): `src/assets/fonts/lxgw-wenkai-{regular,bold}-{core,extra}.woff2`.
   - Tulis `src/assets/fonts/lxgw-wenkai-chars.json`: `{ source: "lxgw-wenkai-webfont@1.7.0", fontVersion, core: "<string huruf>", extra: "<string huruf>", missing: [...] }` (huruf yang tidak ada di font, kalau ada).
   - Hasil harus sama persis bila dijalankan ulang (tanpa tanggal/waktu di file; urutkan huruf).
   - Tambah skrip npm `"build:font": "python3 scripts/font/build_font.py"`.
2. `src/styles/fonts.css` (baru, diimpor sebelum `theme.css`): 4 `@font-face` keluarga `'LXGW WenKai'` (400 dan 700; core dan extra), `font-display: swap`, `unicode-range` sesuai isi tiap file (dibuat oleh skrip, jadi skrip juga menulis/mengisi file CSS ini), `src: url('../assets/fonts/....woff2') format('woff2')` (path relatif agar Vite memberi hash dan base path benar).
3. `src/styles/theme.css`: `--font-hanzi: 'LXGW WenKai', 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif;`.
4. `index.html`: hapus `Noto+Sans+SC` dari URL Google Fonts (Baloo 2 dan Nunito tetap). Tambah `<link rel="preload">` hanya untuk `regular-core` kalau bisa dilakukan dengan benar lewat Vite; kalau rumit, lewati (tulis alasannya di laporan).
5. Lisensi: salin `OFL.txt` dari paket ke `public/fonts/LXGW-WenKai-OFL.txt` (ikut ke `dist/`). Perbarui `CREDITS.md` bagian Font: LXGW WenKai (lxgw), OFL 1.1, lewat paket `lxgw-wenkai-webfont@1.7.0`, versi font, disubset untuk website ini (nama font tidak diubah karena OFL tanpa Reserved Font Name — cek di OFL.txt; kalau ada RFN, laporkan dan berhenti).
6. Tes `src/styles/fonts.test.ts` (vitest): setiap huruf Han di `data/hsk1/*.json` ada di `core` atau `extra` pada `lxgw-wenkai-chars.json` (kecuali yang ada di `missing`); `missing` kosong atau ≤ 5 huruf; 4 file woff2 ada dan tidak kosong; `fonts.css` merujuk ke keempat file.

## Out of scope
- Mengubah tampilan/komponen lain, warna, ukuran huruf, font Latin (Baloo 2, Nunito).
- Font untuk SVG ilustrasi/character sheet (tidak diubah).
- Workflow GitHub Actions (skrip font dijalankan lokal; hasil di-commit).

## Acceptance criteria
- `npm ci`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm test` lolos.
- `npm run build:font` dijalankan dua kali → hash keempat woff2 dan `fonts.css`/`chars.json` sama.
- Ukuran: `regular-core` dan `bold-core` masing-masing ≤ 500 KB; ukuran keempat file dicatat di laporan.
- `dist/` berisi keempat woff2 (dengan hash) dan `dist/fonts/LXGW-WenKai-OFL.txt`; CSS hasil build merujuk ke path `/chineseforeveryone/assets/...`.
- `dist/index.html` tidak lagi memuat `Noto+Sans+SC`.
- Screenshot Playwright (halaman utama dan satu teks Mandarin, mis. 学 di logo/menu) menunjukkan huruf memakai LXGW WenKai (cek `document.fonts` status `loaded` untuk 'LXGW WenKai').
- Tidak ada file potongan asli atau tarball di-commit.

## File terkait
- `scripts/font/build_font.py`, `scripts/font/requirements.txt` (baru)
- `src/assets/fonts/*` (baru), `src/styles/fonts.css` (baru), `src/styles/fonts.test.ts` (baru)
- `src/styles/theme.css`, `src/main.tsx` (impor fonts.css), `index.html`, `package.json`
- `public/fonts/LXGW-WenKai-OFL.txt` (baru), `CREDITS.md`
