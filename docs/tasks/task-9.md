# Task 9 · Kamus + halaman Sumber + lapor salah

Model: Sonnet (implementasi), sesi utama Opus memeriksa. Prasyarat: task 2, 5 (selesai; data sudah 300 kata dari task 2b).

## Tujuan
Murid bisa mencari kata HSK 1 lewat huruf, pinyin (dengan/tanpa tanda nada, juga angka nada), atau arti Indonesia/Inggris, lalu membuka halaman detail kata. Ada halaman **Sumber** yang menampilkan isi `CREDITS.md`. Di detail kata kamus dan layar kenalan kata ada tombol **Lapor salah** yang membuka GitHub Issue baru yang sudah terisi.

Acuan PRD pemilik: "Kamus: cari lewat huruf, pinyin (dengan atau tanpa tanda nada), atau arti Indonesia/Inggris. Tidak dikunci." "Halaman Sumber berisi semua atribusi." "Tombol lapor salah membuka GitHub Issue yang terisi otomatis."

## Catatan penting: sesi lain berjalan bersamaan
Task 0 (Tahap 0) dan 4b (audio) sedang dikerjakan sesi lain. Karena itu:
- **Jangan ubah** `data/**`, `scripts/**`, `public/data/**`, `public/art/**`, `public/audio/**`, `src/art/**`, `src/lib/lessons-build.ts`, `src/lib/audio.ts`, workflow `.github/**`, `CREDITS.md`.
- Data kamus diambil dari file unit yang sudah ada lewat `useWordBank()` di `src/pages/learn/hooks.ts` (sudah memuat semua unit dari `index.json`). Jangan membuat file data baru.
- Perubahan di `src/pages/learn/WordScreen.tsx` sekecil mungkin (hanya menambah tombol lapor salah).
- Kode tidak boleh mengandalkan jumlah unit/kata tertentu.

## Scope

### A. Logika (fungsi murni, dites dengan vitest)
1. `src/lib/dictionary.ts`:
   - `normalizePinyin(s)`: huruf kecil, buang tanda nada (ā á ǎ à → a, termasuk ü bertanda → ü), `v`/`u:` → `ü`, buang spasi, apostrof, tanda hubung, dan angka nada. Juga varian `toneKey(s)`: pinyin → bentuk ber-angka per suku kata tanpa spasi (mis. `nǐhǎo` → `ni3hao3`, `ni3 hao3` → `ni3hao3`, nada ringan = 5 atau tanpa angka — pilih satu dan dites) supaya pencarian `ni3` hanya cocok nada 3. Pakai `src/lib/pinyin.ts`/`tones.ts` yang sudah ada bila cocok.
   - `buildDictionaryIndex(words: DictWord[])` → indeks siap cari (sekali dibuat, di-memo di komponen). `DictWord` minimal: `id, hanzi, pinyin, syllables, tones, en[], ind[], unitId, unitOrder, indexInUnit (mulai 1)`.
   - `searchDictionary(index, query, lang, limit?)` → daftar hasil berurutan, tiap hasil membawa `matchedBy: 'hanzi' | 'pinyin' | 'meaning'`:
     - Query kosong/spasi → `[]`.
     - Mengandung huruf Han → cocokkan hanzi (sama persis > awalan > mengandung; juga kata yang memuat salah satu huruf di query bila tidak ada yang cocok penuh — opsional, sebutkan pilihanmu).
     - Huruf Latin → cocokkan pinyin dan arti. Pinyin: query bertanda nada (`nǐ`) atau beranga (`ni3`) harus cocok nadanya; query tanpa nada (`ni`, `nihao`, `ni hao`) cocok semua nada. Arti: kata utuh atau awalan kata dalam arti ID **dan** EN (keduanya dicari; urutkan arti bahasa aktif lebih dulu bila skornya sama), tidak peka huruf besar/kecil dan tanda baca, abaikan isi kurung "(salam)" boleh tetap dicari.
     - Urutan skor: cocok persis > awalan > mengandung; seri → urutan unit lalu urutan kata dalam unit (stabil, deterministik).
     - Satu kata muncul paling banyak sekali.
     - `limit` bawaan 50.
   - `issueUrl({ word?, context, pageUrl, lang })` → URL `https://github.com/Journeyhendry/chineseforeveryone/issues/new?title=...&body=...` (pakai `URLSearchParams`). Judul mis. `Lapor salah: 你好 (nǐhǎo)`; isi: kata (hanzi, pinyin, arti ID & EN, id kata, unit), konteks (mis. "Kamus" / "Kenalan kata"), alamat halaman, bahasa tampilan, dan bagian kosong "Apa yang salah?" / "What is wrong?" untuk diisi pelapor. Tanpa label (pelapor umum tidak bisa memasang label). Panjang URL dibatasi (mis. < 6000 karakter; potong bagian arti bila perlu). Tidak memuat data pribadi/progres.
2. `src/lib/credits.ts`: pengurai Markdown **sangat kecil** untuk `CREDITS.md` (diimpor lewat `import creditsMd from '../../CREDITS.md?raw'`): judul `#`/`##`/`###`, paragraf, daftar `-`/`*` (satu tingkat; baris lanjutan), **tebal**, `kode`, dan tautan `[teks](url)`. Hasil berupa struktur data (bukan HTML string). Tautan hanya diizinkan bila `http:`/`https:`/`mailto:` atau relatif ke file repo (ubah menjadi `https://github.com/Journeyhendry/chineseforeveryone/blob/main/<path>`); selain itu ditampilkan sebagai teks biasa. Teks lain yang tak dikenal tampil apa adanya sebagai teks.
3. Tes: normalizePinyin/toneKey (nada 1–4, ringan, ü/v/u:, spasi, apostrof), pencarian (contoh nyata: `你` → 你 duluan; `ni` → 你 ada; `nǐ`/`ni3` → 你 ada, 呢 (ne)/泥 tidak; `nihao`/`ni hao`/`ni3hao3` → 你好 ada; `teacher` → 老师; `guru` → 老师; `HALO` → 你好; query kosong; urutan stabil; tidak ada duplikat), issueUrl (domain & path benar, judul berisi hanzi, body berisi id kata, URL ter-encode, batas panjang), credits (judul, daftar, tebal, kode, tautan aman vs `javascript:` jadi teks, tautan relatif jadi GitHub). Tes pencarian boleh memakai data sintetis kecil **dan** satu tes yang memuat semua `public/data/hsk1/units/*.json` lewat `fs` untuk memastikan setiap kata HSK 1 bisa ditemukan lewat hanzi-nya sendiri dan lewat pinyin tanpa nadanya.

### B. Rute
- `#/kamus` — pencarian; query disimpan di `#/kamus?q=...` (pakai `history.replaceState`/`location.replace` saat mengetik agar tombol Kembali tidak penuh riwayat; tekan Enter boleh tidak melakukan apa-apa selain fokus hasil). Membuka `#/kamus?q=ni` langsung menampilkan hasil.
- `#/kamus/<wordId>` — detail kata (`wordId` pola `L1-xxxx`; id tak dikenal → pesan "kata tidak ditemukan" + tautan kembali ke kamus).
- `#/sumber` — halaman Sumber (rute baru di `ROUTES`; bukan item menu utama). Tautan ke Sumber dari halaman Pengaturan dan dari kaki halaman Kamus.
- Perbarui `src/lib/router.ts` (+ tes): `parseDictionaryRoute(segments)` dan `dictionaryHref(...)`, rute `sumber`, `TITLE_KEYS` di `AppShell`.

### C. Layar (semua teks dari `src/i18n/id.json` & `en.json`, kunci sama di kedua file; kunci "segera hadir" kamus yang tidak terpakai dihapus)
1. **Kamus** (`src/pages/dictionary/*`, `DictionaryPage.tsx` jadi pembungkus):
   - Kotak cari `<input type="search">` berlabel jelas, placeholder contoh (`你 · ni3 · nihao · halo · teacher`), fokus otomatis saat halaman dibuka. Petunjuk singkat cara mencari.
   - Hasil: daftar (`<ul>`) kartu tautan ke detail; tiap kartu: hanzi (font WenKai, berwarna nada per suku kata seperti layar kenalan kata — pakai komponen/fungsi yang sudah ada di `src/pages/learn/parts.tsx`/`tones.ts`), pinyin bertanda nada, arti bahasa aktif (arti bahasa lain kecil), nama unit. Jumlah hasil diumumkan lewat `aria-live="polite"` ("12 kata ditemukan"). Tidak ada hasil → pesan ramah + saran (coba tanpa tanda nada, coba arti dalam bahasa lain).
   - Query kosong → tampilkan semua kata dikelompokkan per unit (judul unit + daftar kata ringkas) supaya kamus bisa dijelajah.
   - Memuat → status memuat; gagal → pesan + tombol coba lagi (pola `useResource`).
2. **Detail kata**: hanzi besar berwarna nada + tanda nada, pinyin, jenis kata (bila ada), arti ID (tanda "terjemahan mesin" bila `idMachine`) dan EN, tombol dengar (pakai `useAudio`/`speak` yang sudah ada; bila suara tidak tersedia, tombol nonaktif dengan keterangan, sama seperti layar kenalan kata), hingga 3 contoh kalimat dengan atribusi Tatoeba (pakai komponen yang sudah ada bila ada), tautan "Pelajari di unit X" ke `#/belajar/unit/<id>/kata/<n>` (kamus tidak dikunci; bila unit masih terkunci, tautan tetap ada — layar unit sendiri yang menangani kunci), tombol **Lapor salah**, tautan kembali ke hasil pencarian (mempertahankan `q`).
3. **Lapor salah** (komponen `ReportButton` dipakai ulang): tautan `<a target="_blank" rel="noopener noreferrer">` ke `issueUrl(...)` dengan teks "Lapor salah" + keterangan tersembunyi untuk pembaca layar "(membuka GitHub di tab baru)" dan catatan kecil bahwa perlu akun GitHub. Pasang di detail kamus dan di `WordScreen` (kenalan kata, konteks "Kenalan kata · Unit N").
4. **Sumber** (`src/pages/SourcesPage.tsx` atau `src/pages/sources/*`): paragraf pengantar dari i18n (ID/EN), lalu isi CREDITS.md dirender dari struktur `credits.ts` (React element, **tanpa** `dangerouslySetInnerHTML`). Dalam mode EN, tampilkan catatan i18n bahwa daftar sumber ditulis dalam bahasa Indonesia. Tautan luar membuka tab baru dengan `rel="noopener noreferrer"`. Tautan ke repo GitHub dan ke halaman laporan masalah.
5. Gaya: CSS per layar memakai token tema (`src/styles/theme.css`), bukan hex baru; mode gelap terbaca; tidak ada scroll horizontal di 375 px (perhatikan URL panjang di Sumber → `overflow-wrap: anywhere`); tombol/tautan kartu ≥ 44 px tinggi; semua bisa dengan keyboard; fokus terlihat.

## Out of scope
- Mengubah data/skrip/workflow/CREDITS.md, audio final (task 4b), Tahap 0, game.
- Kata `hsk2-preview`, pencarian kalimat contoh, riwayat pencarian, pencarian suara/tulisan tangan.
- Mengubah keputusan BUILD_PLAN bagian 1.

## Acceptance criteria (dicek sesi utama)
1. `npm ci`, `npm run typecheck`, `npm run lint` (tanpa error baru), `npm run build`, `npm test`, `npm run check:data` lolos; `git status` hanya berisi file dalam scope.
2. Tes unit mencakup semua poin A.3, termasuk tes semua kata HSK 1 dapat ditemukan.
3. Build produksi (`vite preview`, base `/chineseforeveryone/`), dicek dengan Playwright: `你`, `ni`, `nǐ`, `ni3`, `nihao`, `ni hao`, `halo`, `teacher`, `guru` memberi hasil yang benar di urutan atas; `ni3` tidak memuat kata ber-`ne`/nada lain di atas; `zzzz` → pesan tidak ada hasil; membuka `#/kamus?q=xie` langsung berisi hasil; klik hasil → detail → "Pelajari di unit" membuka layar kenalan kata yang benar (hanzi sama); kembali → query tetap.
4. Tombol Lapor salah (kamus & kenalan kata) membuka URL `github.com/Journeyhendry/chineseforeveryone/issues/new` dengan judul berisi hanzi kata dan body berisi id kata.
5. `#/sumber` menampilkan semua judul bagian CREDITS.md dan tautan yang bisa diklik; tidak ada `javascript:` atau HTML mentah.
6. Semua bisa dipakai dengan keyboard saja. Ganti ke EN: tidak ada teks Indonesia di layar baru (kecuali isi CREDITS.md dan arti ID kecil).
7. axe tanpa pelanggaran di `#/kamus` (kosong, berhasil, tidak ada hasil), detail kata, `#/sumber` — terang & gelap. Tidak ada scroll horizontal di 375 px. Tidak ada error konsol.

## File terkait
- Baru: `src/lib/dictionary.ts`, `src/lib/credits.ts` (+ tes), `src/pages/dictionary/*` (komponen + CSS), `src/pages/SourcesPage.tsx` (atau `src/pages/sources/*`), `src/components/ReportButton.tsx` (atau di `src/pages/dictionary/`).
- Diubah: `src/lib/router.ts` (+ tes), `src/components/AppShell.tsx`, `src/pages/DictionaryPage.tsx`, `src/pages/SettingsPage.tsx` (tautan Sumber), `src/pages/learn/WordScreen.tsx` (tombol lapor), `src/i18n/{id,en}.json`, `src/vite-env.d.ts` bila perlu untuk `?raw`.
