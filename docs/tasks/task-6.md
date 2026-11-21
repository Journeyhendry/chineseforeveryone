# Task 6 · Layar unit + peta belajar

Model: Opus (implementasi), sesi utama Opus memeriksa. Prasyarat: task 2, 3, 5 (selesai). Audio boleh placeholder sampai task 4b.

## Tujuan
Murid bisa membuka peta belajar, masuk ke unit yang terbuka, berkenalan dengan tiap kata (huruf besar, pinyin berwarna nada, arti ID/EN, suara normal/pelan, animasi urutan coretan, contoh kalimat, versi santai), mengerjakan latihan (pilihan ganda + tebak nada) hanya dengan mouse atau keyboard, mendapat nilai bintang 0–3, lalu unit berikutnya terbuka. Unit terkunci bisa dibuka lewat "Tes loncat" (≥ 80 %).

Acuan tampilan (salinan mockup pemilik, hanya untuk dibaca):
- `docs/tasks/ref/mockup-1-peta-belajar.dc.html` — peta belajar (artboard 1)
- `docs/tasks/ref/mockup-2-kenalan-kata.dc.html` — layar kenalan kata (artboard 2)
- `docs/tasks/ref/mockup-3-soal.dc.html` — layar soal tebak nada (artboard 3)
Ikuti susunan & gaya (garis 3px `--ink`, bayangan kartu tebal, sudut 14–28px, tombol ≥ 44px) memakai token di `src/styles/theme.css`, bukan hex baru. Teks contoh di mockup (mis. "Contoh mockup", 老妈) TIDAK disalin; isi berasal dari data.

## Scope

### A. Data pelajaran (skrip, bisa diulang)
1. `scripts/build-lessons.ts` (`npm run build:lessons`, jalan dengan `tsx`) membaca `data/hsk1/{words,units,sentences,casual,dialogs}.json` dan menulis:
   - `public/data/hsk1/index.json`: daftar unit `{id, order, slug, title{id,en}, description{id,en}, wordCount}` (kecil, dimuat di peta).
   - `public/data/hsk1/units/<unitId>.json`: semua yang dibutuhkan satu unit — kata unit (field yang dipakai UI saja: id, hanzi, pinyin, syllables, tones, pos, en, ind, idMachine, chars), maksimal 3 kalimat contoh per kata (dipilih deterministik dari `sentences.json`; simpan tatoebaId, cmn, en/ind teks pertama + penulis + lisensi, `outside`), ungkapan santai unit (dari `casual.json`), dialog unit (dari `dialogs.json`, beserta nama tokoh yang dipakai). (Tes loncat cukup memuat file unit-unit sebelumnya; tidak perlu file terpisah.)
   - Output JSON stabil (urutan kunci & isi sama setiap dijalankan, `formatJson` gaya repo). Data besar (`sentences.json` 855 KB) **tidak boleh** ikut ke bundle JavaScript; UI memuat file unit lewat `fetch` (memakai `import.meta.env.BASE_URL`).
2. Animasi coretan: tambah dependency `hanzi-writer` (MIT) dan devDependency `hanzi-writer-data` (versi dipatok). Skrip yang sama (atau `scripts/build-strokes.ts`, `npm run build:strokes`) menyalin data coretan **hanya** untuk huruf yang muncul di kata HSK 1 dan ungkapan santai ke `public/hanzi/<huruf>.json` (nama file = huruf, di-encode aman untuk URL bila perlu), plus salin teks izin Arphic ke `public/hanzi/ARPHICPL.TXT`. Hanzi Writer dipakai dengan `charDataLoader` yang memuat file lokal itu (tidak ada request ke CDN). Huruf yang tidak ada datanya dicatat di output skrip dan ditangani UI dengan rapi (tampilkan huruf diam + pesan i18n).
3. Tambah atribusi Hanzi Writer + data Arphic (dan izinnya) ke `CREDITS.md`.

### B. Logika (fungsi murni di `src/lib/`, semua dites)
1. `src/lib/progress.ts`: penyimpanan progres di localStorage kunci `xue.progress.v1`, bentuk `{ version: 1, units: { [unitId]: { bestScore: 0..1, stars: 0..3, completedAt?: string } }, skipUnlockedThrough?: number /* order unit */ }`. `normalizeProgress(raw)` memulihkan data rusak per kolom (seperti `normalizeSettings`); baca/tulis dibungkus try/catch; website tetap jalan tanpa localStorage. Bentuk ini harus mudah diperluas task 8 (Leitner) — beri komentar singkat.
2. Aturan buka unit (fungsi murni): unit order 1 selalu terbuka; unit N terbuka jika unit N−1 selesai (stars ≥ 1) atau `skipUnlockedThrough ≥ N`. `isUnitUnlocked`, `unitStatus → 'locked'|'open'|'done'`.
3. Bintang: `starsFor(score)`: ≥ 0.9 → 3, ≥ 0.75 → 2, ≥ 0.6 → 1, selain itu 0 (unit dianggap selesai bila ≥ 1 bintang). Simpan nilai terbaik saja (nilai lebih rendah tidak menurunkan bintang).
4. Tes loncat ke unit N (N ≥ 2): 15 soal dari kata semua unit sebelum N (1..N−1), campuran jenis soal. Nilai ≥ 0.8 → `skipUnlockedThrough = max(lama, N)`; < 0.8 → tidak mengubah apa pun. Unit yang dilewati tidak diberi bintang.
5. `src/lib/quiz.ts`: pembuat soal deterministik (RNG ber-seed, mis. mulberry32) untuk latihan unit (12 soal per sesi, setiap jenis muncul, kata dipilih merata dari unit):
   - `hanzi→meaning`, `meaning→hanzi`, `audio→hanzi` (hanya bila suara tersedia; kalau tidak, diganti `hanzi→meaning`), `tone` (pilih satu suku kata bernada 1–4 dari kata; 4 pilihan = suku kata itu dengan nada 1–4, bertanda nada; nada ringan tidak ditanyakan).
   - Tepat 4 pilihan (kecuali unit terlalu kecil, minimal 3), tidak ada pilihan kembar (hanzi sama atau arti yang ditampilkan sama), jawaban benar selalu ada, posisi jawaban teracak.
   - Pengecoh dari unit yang sama, utamakan panjang huruf yang mirip.
   - Fungsi bantu `toneMark(syllableNumbered|base, tone)` untuk menaruh tanda nada pada vokal yang benar (aturan a/e/o, iu/ui, ü). Tes untuk kasus nǚ, lüè, guǐ, liú, er.
6. `src/lib/tones.ts`: pemetaan huruf → nada untuk pewarnaan: bila jumlah huruf = jumlah suku kata, huruf ke-i memakai nada suku kata ke-i; huruf terakhir 儿 dengan suku kata ber-r (erhua) memakai nada suku kata sebelumnya; selain itu tidak diwarnai (warna teks biasa). Dites dengan 妈妈, 一块儿, 好玩儿, 一下儿.
7. `src/lib/audio.ts` (placeholder sampai 4b): `speak(text, {rate})` memakai suara bawaan browser (`speechSynthesis`, `lang: 'zh-CN'`, pilih suara zh-CN bila ada) bila tersedia; `audioAvailable()` mengembalikan false bila tidak ada `speechSynthesis` atau tidak ada suara zh. Kecepatan "Dengar" = `settings.voiceSpeed`, "Pelan" = 0.6. Rancang sebagai satu titik ganti, supaya task 4b cukup menukar isinya dengan file mp3 (`public/audio/...`). Di UI tampilkan catatan kecil i18n "Suara sementara dari perangkat" (bukan suara final). Bila suara tidak tersedia: tombol suara dinonaktifkan dengan keterangan, bukan error.

### C. Layar (React, semua teks dari i18n `id.json`/`en.json`, kunci sama)
Rute (di `src/lib/router.ts`, `parseHash` tetap fungsi murni; tambah tes):
- `#/belajar` — **peta belajar**: 20 kartu unit berurutan (nomor, judul & deskripsi sesuai bahasa, jumlah kata, bintang 0–3 sebagai ikon + teks yang bisa dibaca pembaca layar, status). Unit terkunci: ikon gembok, tidak bisa dimasuki, ada tombol "Tes loncat". Unit berikut yang disarankan disorot. Ringkasan kecil di atas: unit selesai x/20.
- `#/belajar/unit/<id>` — **ringkasan unit**: judul, deskripsi, tombol "Mulai kenalan kata" dan "Latihan", daftar kata (kartu kecil: hanzi + pinyin; klik → kenalan kata itu), kotak **Versi santai** (semua ungkapan unit: hanzi, pinyin berwarna nada, label santai/gaul/kasar, padanan versi HSK, arti, situasi, lencana "dicek AI + sumber"), dan **dialog** unit (judul, situasi, baris per tokoh dengan nama tokoh, hanzi, pinyin per token bila "tampilkan pinyin" aktif, terjemahan sesuai bahasa, tombol dengar per baris). Teks terjemahan mesin diberi tanda "terjemahan mesin".
- `#/belajar/unit/<id>/kata/<n>` — **kenalan kata** (artboard 2): bar atas (tombol keluar ke ringkasan unit, "Kata n dari m", progressbar ber-aria). Panel coretan: kotak 米字格, Hanzi Writer menggambar huruf (kalau kata > 1 huruf, ada pilihan huruf), jumlah coretan, tombol Putar dan Ulangi. Panel info: huruf besar ≥ 96px memakai `--font-hanzi` (LXGW WenKai) berwarna nada (di atas `--tone-surface`), pinyin bertanda nada berwarna nada (disembunyikan bila `showPinyin` mati), label nada ("nada 1 ¯" dst. dari i18n), arti di bahasa aktif (arti ID diberi tanda "terjemahan mesin" bila `idMachine`) + arti bahasa lain lebih kecil, tombol "Dengar" dan "Pelan" di dekat huruf. Kartu contoh kalimat (maks. 3, hanzi + terjemahan sesuai bahasa, fallback EN bila ID tidak ada dengan tanda bahasa, atribusi "Tatoeba #id · penulis · lisensi" ber-tautan ke tatoeba.org) atau pesan "belum ada contoh". Kotak versi santai bila ada ungkapan yang `hsk.wordIds` memuat kata ini. Tombol Sebelumnya/Lanjut; di kata terakhir "Lanjut" menuju latihan.
- `#/belajar/unit/<id>/latihan` — **latihan** (artboard 3): 12 soal, bar kemajuan, jenis soal sebagai lencana, pilihan sebagai tombol besar bernomor 1–4 (`role="radiogroup"`/`radio` atau tombol biasa dengan `aria-pressed`, pilih satu yang benar secara ARIA), cap "对!" saat benar (animasi kecil; mati bila `prefers-reduced-motion`). Saat salah: tidak menghukum — tunjukkan jawaban benar, putar suaranya (bila ada), lalu "Lanjut". Umpan balik di `role="status"`. Akhir: **layar nilai** — bintang (animasi letup kecil, mati saat gerak dikurangi), skor x/12, daftar kata yang salah (hanzi, pinyin, arti), tombol "Ulangi latihan", "Kembali ke peta", dan "Unit berikutnya" bila sudah terbuka. Progres disimpan saat layar nilai muncul.
- `#/belajar/loncat/<id>` — **tes loncat**: penjelasan singkat (harus ≥ 80 %), 15 soal memakai komponen soal yang sama, hasil: lolos → unit sampai <id> terbuka (tautan ke unit), tidak lolos → pesan ramah, tidak ada yang berubah.
- Unit terkunci yang dibuka lewat alamat langsung → layar "Unit ini masih terkunci" dengan tombol Tes loncat dan Kembali ke peta. Id unit tak dikenal → halaman Tidak ditemukan.
- Keyboard di layar soal: tombol 1–4 memilih jawaban, Enter = lanjut (setelah menjawab), Spasi = putar suara (jangan bentrok dengan Spasi pada tombol yang sedang fokus; abaikan saat fokus di input). Di kenalan kata: Spasi = dengar, Enter / panah kanan = lanjut, panah kiri = sebelumnya. Petunjuk tombol ditampilkan (i18n). Listener dibersihkan saat layar ditutup.
- Fokus pindah ke judul layar saat soal/kata berganti; `document.title` ikut layar.
- Status memuat & gagal memuat file unit (pesan i18n + tombol coba lagi).
- Gaya: CSS per komponen (mis. `src/pages/learn/*.css`), memakai token tema; mode gelap tetap terbaca (teks berwarna nada hanya di atas `--tone-surface`); tidak ada scroll horizontal di 375px (huruf besar mengecil dengan `clamp`, tetap ≥ 96px di lebar ≥ 768px).
- Hapus kartu "segera hadir" dan contoh warna nada sementara dari halaman Belajar (kunci i18n yang tidak terpakai dihapus dari kedua file).

### D. Tes (vitest, di samping modulnya)
- progress: normalize (null, JSON rusak, kolom salah tipe, unit tak dikenal diabaikan/aman), aturan buka unit, bintang, nilai terbaik tidak turun, tes loncat < 0.8 tidak mengubah, ≥ 0.8 membuka sampai N.
- quiz: deterministik dengan seed sama; tiap soal punya jawaban benar tepat satu; pilihan unik; 12 soal untuk tiap dari 20 unit tanpa error; tes loncat 15 soal hanya dari unit sebelumnya; soal nada hanya suku kata nada 1–4; `toneMark` kasus di atas.
- tones: kasus di atas.
- router: rute baru (unit, kata, latihan, loncat, garis miring berlebih).
- build-lessons: hasil skrip sama dengan file yang di-commit (jalankan fungsi build di memori, bandingkan dengan isi `public/data/hsk1/`); setiap kata HSK 1 ada di tepat satu file unit; setiap huruf dari kata HSK 1 punya file `public/hanzi/<huruf>.json` (atau tercatat sebagai pengecualian yang disebut dalam tes).
- i18n: tes kunci yang sudah ada tetap lolos.

## Out of scope
- Game (task 7) — layar nilai cukup menyediakan tempat/rencana untuk "satu game singkat" nanti; tidak perlu dibuat.
- Leitner, ulangan harian, cadangan (task 8); kamus, halaman Sumber, tombol lapor salah (task 9); ilustrasi/animasi kata (task 6b); file audio final (task 4b).
- Mengubah `data/hsk1/*` (sumber), workflow, `public/samples.html`, gambar tokoh, keputusan BUILD_PLAN bagian 1.

## Acceptance criteria (dicek sesi utama)
1. `npm ci`, `npm run typecheck`, `npm run lint` (tanpa error baru), `npm run build`, `npm test` lolos; `npm run build:lessons` (dan `build:strokes` bila terpisah) dijalankan ulang → `git status` bersih.
2. Di build produksi (`vite preview`, base `/chineseforeveryone/`): dari peta, unit 1 bisa diselesaikan sampai layar bintang tanpa error konsol, hanya dengan keyboard (Tab/Enter/1–4/Spasi); setelah ≥ 1 bintang, unit 2 terbuka; reload → bintang & status tetap.
3. Unit 3 terkunci tidak bisa dibuka lewat alamat langsung. Tes loncat ke unit 3 dengan nilai < 80 % tidak membuka apa pun; ≥ 80 % membuka unit 2 dan 3.
4. Layar kenalan kata: huruf ≥ 96px font WenKai di 1366px, warna nada + tanda nada, pinyin bisa disembunyikan lewat Pengaturan, animasi coretan Hanzi Writer berjalan dengan data lokal (tidak ada request jaringan ke luar domain kecuali Google Fonts yang sudah ada), jumlah coretan tampil, contoh kalimat beratribusi, versi santai tampil di kata yang punya ungkapan.
5. Saat salah: jawaban benar ditunjukkan, latihan tetap lanjut. Daftar kata salah tampil di layar nilai.
6. Ganti ke EN: tidak ada teks Indonesia tersisa di layar-layar baru (kecuali nama "Xué Mandarin", hanzi/pinyin, nama tokoh dari data sesuai bahasa).
7. `prefers-reduced-motion: reduce` → tidak ada animasi CSS; Hanzi Writer tidak berjalan otomatis (huruf tampil diam; animasi hanya bila tombol ditekan, atau diganti tampilan langkah diam).
8. axe tanpa pelanggaran (minimal `color-contrast`, `button-name`, `aria-*`) di peta, ringkasan unit, kenalan kata, latihan, layar nilai — terang & gelap. Tidak ada scroll horizontal di 375px di semua layar baru. Bundle JS utama tidak memuat `sentences.json` (ukuran JS gzip wajar, < 150 KB di luar hanzi-writer).

## File terkait
- Baru: `scripts/build-lessons.ts` (+ opsional `scripts/build-strokes.ts`), `public/data/hsk1/index.json`, `public/data/hsk1/units/*.json`, `public/hanzi/*.json`, `public/hanzi/ARPHICPL.TXT`, `src/lib/{progress,quiz,tones,audio,lessons}.ts` + tes, `src/pages/learn/*` (peta, ringkasan unit, kenalan kata, latihan, nilai, tes loncat, komponen soal, panel coretan).
- Diubah: `package.json` (+lock), `src/lib/router.ts` (+tes), `src/pages/LearnPage.tsx`, `src/components/AppShell.tsx` (judul halaman per layar bila perlu), `src/i18n/{id,en}.json`, `CREDITS.md`.
