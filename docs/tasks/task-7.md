# Task 7 · Empat game

Model: Opus (implementasi), sesi utama Opus memeriksa. Prasyarat: task 6 (selesai; juga 2b, 3d, 8, 9 selesai).

## Tujuan
Setiap unit punya **empat game** yang memakai kata (dan kalimat) unit yang sedang dibuka:
1. **Kartu bolak-balik** (huruf di depan, arti di belakang).
2. **Jodohkan dengan waktu** (huruf ↔ arti, atau suara ↔ huruf).
3. **Tebak nada** dari suara.
4. **Susun kalimat** (seret kata ke urutan benar + alternatif keyboard), memakai kalimat contoh / dialog unit.

Acuan PRD pemilik: "Penutup: satu game singkat, lalu nilai bintang dan daftar kata yang salah." "Keempat game jalan dan memakai kata dari unit yang sedang dibuka." Mockup artboard 4 = game "jodohkan dengan waktu" (gaya toy-like: kartu tebal, bayangan tebal, sudut membulat, warna merek).

## Catatan penting: sesi lain berjalan bersamaan
Task 4b (audio) dikerjakan sesi lain di cabang `task-4b` dan akan mengganti isi `src/lib/audio.ts`. Task 0 (Tahap 0, cabang `task-0`) menunggu pemilik dan nanti menambah kartu Tahap 0 di peta + rute `#/belajar/dasar`. Karena itu:
- **Jangan ubah** `data/**`, `scripts/**`, `public/**`, `src/art/**`, `src/lib/audio.ts`, `src/lib/lessons-build.ts`, `.github/**`, `CREDITS.md`.
- Suara hanya lewat API yang sudah ada (`speak`, `stopAudio`, `audioAvailable`, `waitForAudio`, hook `useAudio` di `src/pages/learn/hooks.ts`). Jangan mengandalkan suara perangkat secara khusus; bila `audioAvailable()` salah, game yang butuh suara harus tetap bisa dipakai (lihat tiap game).
- Perubahan di `router.ts`, `LearnPage.tsx`, `UnitScreen.tsx`, `ResultScreen.tsx`, `progress.ts` sekecil mungkin dan menambah, bukan menyusun ulang (supaya penggabungan dengan cabang `task-0`/`task-4b` mudah).
- Kode tidak boleh mengandalkan jumlah unit/kata tertentu (unit sekarang 12–17 kata).

## Scope

### A. Logika game (fungsi murni di `src/games/*.ts`, dites vitest)
Pakai `mulberry32` / `shuffle` dari `src/lib/quiz.ts` (seed bisa disuntik untuk tes), `meaningShort`, `toneMark`, `toneSyllables` bila cocok.
1. `flashcards.ts`: buat dek dari kata unit (urutan acak), status tiap kartu (`belum`/`tahu`/`ulang`); "Ulang lagi" hanya kartu `ulang`. Selesai bila semua `tahu`. Ringkasan: jumlah tahu/ulang.
2. `match.ts`: ronde berisi N pasangan (bawaan 6, ≤ jumlah kata), mode `hanzi-meaning` atau `audio-hanzi`. State murni: pilih kiri/kanan, cocok → pasangan hilang/terkunci, salah → hitung salah + kedua pilihan dilepas. Waktu dihitung dari mulai sampai semua cocok (fungsi menerima `now` dari luar supaya bisa dites). Skor bintang dari waktu & jumlah salah (aturan tertulis di kode + tes). Arti yang sama untuk dua kata berbeda **tidak boleh** muncul bersamaan di satu ronde (hindari pasangan ambigu); homofon/hanzi sama juga dihindari di mode suara.
3. `tone.ts`: soal dari suku kata/kata unit: dengar → pilih pola nada (1 suku kata: 4 pilihan nada 1–4; 2 suku kata: 4 pilihan pola mis. "3-3", tetapi **pakai nada tertulis di data**, dan hindari kata dengan nada ringan/perubahan nada yang membingungkan — atau tampilkan nada sebagaimana tertulis di data dan nyatakan aturannya). 8–10 soal. Opsi unik, tepat satu benar.
4. `sentence.ts`: kalimat dari `examples` kata-kata unit (Tatoeba) dan baris dialog unit (`tokens` sudah ada). Potong kalimat contoh menjadi potongan kata (tokenizer longest-match terhadap kata HSK 1 dari semua unit yang sudah dimuat / `useWordBank`, sisa huruf jadi potongan 1 huruf; tanda baca akhir tidak jadi potongan). Pilih kalimat 3–7 potongan, tanpa kata di luar HSK 1 (`outside === null`), unik. 5 soal per main. Jawaban benar = urutan asli; **juga terima urutan lain yang menghasilkan string huruf yang sama** (potongan kembar). Potongan acak tidak boleh sama dengan urutan benar. Unit dengan kalimat < 5: pakai yang ada (minimal 1), bila 0 → game ditandai tidak tersedia dengan pesan jelas.
Semua fungsi: tes unit untuk opsi unik, tepat satu benar, tidak ada state bocor antar main (buat ulang → state awal), dan perilaku dengan data kecil (mis. unit 3 kata).

### B. Tampilan (`src/pages/learn/games/**` atau `src/games/*.tsx`, CSS sendiri)
- **Rute**: `#/belajar/unit/<id>/game` (pilih game) dan `#/belajar/unit/<id>/game/<jenis>` dengan `<jenis>` = `kartu`, `jodohkan`, `nada`, `susun`. Perluas `LearnRoute`, `parseLearnRoute`, `learnHref` + tes router. Rute unit terkunci → perilaku sama seperti latihan unit terkunci (lihat yang ada).
- **Ringkasan unit** (`UnitScreen`): bagian "Game" dengan 4 kartu game (ikon/ilustrasi SVG sederhana atau emoji-bebas: pakai SVG kecil buatan sendiri, bukan gambar luar), tiap kartu menuju gamenya.
- **Layar nilai latihan** (`ResultScreen`, di tempat komentar "Task 7"): tombol "Main satu game singkat" yang membuka **satu** game (bergiliran/acak deterministik per unit, mis. jodohkan atau kartu) — sesuai PRD "Penutup: satu game singkat".
- Tiap game: judul, petunjuk 1 kalimat, tombol keluar ke unit, layar selesai (skor/bintang, "Main lagi", "Game lain", "Kembali ke unit"). "Main lagi" = state baru penuh (tidak ada sisa pilihan, timer, fokus, suara).
- **Kartu bolak-balik**: klik/Enter/Spasi membalik (animasi balik 3D lembut; `prefers-reduced-motion` → ganti fade/instan), belakang: pinyin berwarna nada (+ tanda nada), arti bahasa aktif, tombol dengar. Tombol "Sudah tahu" / "Ulang lagi" (keyboard: ← / → atau 1 / 2, tertulis di layar).
- **Jodohkan dengan waktu**: dua kolom kartu (kiri hanzi atau tombol suara, kanan arti atau hanzi), timer tampil (mm:ss, `aria-live` sopan hanya untuk hasil, bukan tiap detik), pilih kiri lalu kanan (atau sebaliknya) dengan mouse atau Tab + Enter/Spasi; benar → efek kecil + terkunci; salah → goyang kecil (reduced-motion: tanpa goyang, hanya warna + ikon). Pilihan mode (huruf↔arti / suara↔huruf) sebelum mulai; mode suara dinonaktifkan dengan keterangan bila `audioAvailable()` salah.
- **Tebak nada**: tombol dengar besar (otomatis putar saat soal muncul bila suara ada), 4 pilihan berupa garis nada SVG berwarna nada **plus** tanda nada/angka (tidak bergantung warna saja), keyboard 1–4 / Enter / Spasi seperti latihan. Setelah jawab: tampilkan hanzi + pinyin + benar/salah, tombol lanjut. Bila `audioAvailable()` salah: tampilkan huruf + pinyin tanpa tanda nada dan beri keterangan "suara tidak tersedia" (game tetap bisa dimainkan).
- **Susun kalimat**: arti kalimat (bahasa aktif; bila tidak ada terjemahan Indonesia pakai Inggris, ditandai) + tombol dengar; potongan kata sebagai tombol di "bank"; klik/Enter memindah potongan ke baris jawaban, klik potongan di jawaban mengembalikannya; **seret** (Pointer Events, jalan dengan mouse dan sentuh) untuk memindah/menyusun ulang; Backspace = ambil kembali potongan terakhir; tombol "Cek". Setelah cek: benar/salah, tampilkan kalimat benar + pinyin, atribusi Tatoeba kecil (penulis + lisensi + id, seperti di kenalan kata) bila kalimat dari Tatoeba.
- Semua teks dari `src/i18n/id.json` + `en.json` (ganti bahasa tanpa reload). Token warna/font yang ada saja (tidak ada hex baru kecuali warna nada yang sudah ada). Fokus keyboard terlihat; tidak ada scroll ke samping di 375 px; target klik ≥ 44 px.
- Muat malas: komponen game di-`lazy()` supaya bundel awal tidak membengkak (kenaikan JS awal ≤ 10 KB gzip).

### C. Progres (kecil, opsional tapi rapi)
- Simpan skor terbaik per unit per game (mis. `games?: { [unitId]: { [jenis]: { best: number; plays: number } } }`) di `xue.progress.v1`, dinormalisasi di `normalizeProgress` (data lama tetap valid, nilai rusak dibuang) dan ikut cadangan/pulihkan (tes). Tampilkan "terbaik" kecil di kartu game. Game **tidak** mengubah bintang unit dan **tidak** mengubah kotak Leitner.

## Out of scope
- Audio baru, perubahan `audio.ts`, rekaman penutur asli (task 4b). Tahap 0 (task 0).
- Mengubah data kata/kalimat/dialog/unit, ilustrasi/adegan.
- Game di ulangan harian, papan skor online, suara efek baru berupa file (efek boleh dari Web Audio sederhana bila pengaturan "efek suara" menyala, atau tidak sama sekali).
- Mengubah BUILD_PLAN bagian 1.

## Acceptance criteria
1. `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run check:data` lolos.
2. Tes unit untuk keempat logika game (opsi unik, tepat satu benar, susun kalimat menerima urutan setara, ronde jodohkan tanpa arti kembar, state baru saat main lagi, data kecil) + router + progres `games` (normalisasi & cadangan).
3. Playwright (1366 dan 375, terang & gelap) pada minimal unit 1 dan satu unit lain: `#/belajar/unit/<id>/game` menampilkan 4 game; **tiap game bisa diselesaikan hanya dengan keyboard** sampai layar selesai; game jodohkan & kartu juga dengan mouse; susun kalimat bisa dengan seret mouse; "Main lagi" 3× berturut-turut tanpa error/sisa state; tidak ada error konsol; tidak ada scroll ke samping; tombol game di layar nilai latihan membuka satu game; ganti ID↔EN mengganti teks game.
4. axe (aturan WCAG A/AA) tanpa pelanggaran serius/kritis di layar pilih game dan keempat game (terang & gelap).
5. `prefers-reduced-motion: reduce` → tanpa animasi balik/goyang (dicek Playwright `reducedMotion`).
6. Kata yang muncul di game = kata unit yang dibuka (tes atau cek Playwright); susun kalimat hanya memakai kalimat unit itu.
7. Tidak ada file di luar daftar "File" yang berubah. Tidak ada token/kunci.

## File
- Baru: `src/games/flashcards.ts`, `match.ts`, `tone.ts`, `sentence.ts` (+ `*.test.ts`), komponen + CSS game (`src/pages/learn/games/**` atau `src/games/*.tsx`), ikon SVG kecil (inline di komponen).
- Diubah: `src/lib/router.ts` (+ tes), `src/pages/LearnPage.tsx`, `src/pages/learn/UnitScreen.tsx`, `src/pages/learn/ResultScreen.tsx` (+ pemanggilnya `PracticeScreen.tsx` bila perlu), `src/lib/progress.ts` + `src/lib/backup.ts` (+ tes) untuk `games`, `src/i18n/{id,en}.json`, `docs/tasks/task-7.md` (catatan temuan saja).

## Catatan implementasi (2026-11-23)

**Yang dibuat**
- Logika murni + tes: `src/games/kinds.ts` (nama game = segmen rute), `flashcards.ts`, `match.ts`, `tone.ts`, `sentence.ts` (+ `*.test.ts`; data tes dibaca dari `public/data/hsk1/units/*.json` lewat `testdata.ts`).
- Tampilan di `src/pages/learn/games/` (dimuat malas lewat `React.lazy` dari `LearnPage`): `GamesRoute.tsx` (pilih game, menjalankan game, layar selesai), satu file per game, `GameCards.tsx` (4 kartu game, juga dipakai di ringkasan unit), `games.css`, `game-cards.css`.
- Rute `#/belajar/unit/<id>/game` dan `.../game/<kartu|jodohkan|nada|susun>`; unit terkunci tetap menampilkan layar "terkunci" yang sama.
- Progres: kolom `games: { [unitId]: { [jenis]: { best, plays } } }` di `xue.progress.v1`, dinormalisasi per entri (nilai rusak dibuang) dan ikut cadangan/pulihkan. Game tidak mengubah bintang unit dan tidak mengubah kotak Leitner.

**Aturan bintang** (game selesai = minimal 1 bintang, kecuali tebak nada & susun kalimat yang memakai aturan latihan)
- Kartu bolak-balik: bagian kartu yang langsung "Sudah tahu" di putaran pertama. ≥ 80% → 3, ≥ 50% → 2, selain itu 1.
- Jodohkan (p = jumlah pasangan, bawaan 6): salah ≤ 1 dan waktu ≤ 6 detik × p → 3; salah ≤ 3 dan ≤ 12 detik × p → 2; selain itu 1. Waktu mulai dihitung sejak kartu pertama dipilih.
- Tebak nada & susun kalimat: sama dengan latihan (benar ≥ 90% → 3, ≥ 75% → 2, ≥ 60% → 1, di bawahnya 0). Susun kalimat: satu kali cek per kalimat.
- Aturan bintang ditulis kecil di layar selesai.

**Tebak nada**: nada selalu nada tertulis di data. Kata utuh yang tidak dipakai: ada nada ringan, lebih dari 2 suku kata, mengandung 不 atau 一, atau pola 3-3 (karena diucapkan berubah). Kalau kata yang lolos kurang dari 10, soal ditambah dari satu huruf kata unit (mis. 谢 dari 谢谢), diberi keterangan "satu huruf dari …". Sekarang unit 2 dapat 8 soal, unit lain 10 soal. Pilihan: 1 suku kata = nada 1–4 berurutan (tombol 1–4 = nada 1–4); 2 suku kata = 4 pola acak, pengecoh diutamakan yang beda satu suku kata. Pilihan memakai garis nada berwarna + tanda nada + angka (tidak bergantung warna).

**Susun kalimat (pemotong kata)**: longest-match terhadap semua 300 kata HSK 1 (`useWordBank`). Tanda baca akhir dibuang; tanda baca di tengah (mis. "，") ikut potongan sebelumnya. Kalimat Tatoeba hanya dipakai bila `outside === null`, punya terjemahan, terpotong habis menjadi kata HSK 1 (tidak ada sisa huruf lepas, jadi angka seperti "12" dan nama tidak masuk) dan 3–7 potongan. Baris dialog unit memakai `tokens` yang sudah ada. Jawaban benar = string huruf sama dengan kalimat asli (urutan potongan kembar mana pun diterima). Tiap unit sekarang punya 24–45 kalimat; 5 soal per main. Bila arti di bahasa aktif tidak ada, dipakai bahasa lain dengan label "terjemahan Inggris"/"Indonesian translation".

**Game di layar nilai latihan**: tombol "Main satu game singkat: <nama game>". Bergiliran per unit: unit bernomor ganjil → Jodohkan, genap → Kartu bolak-balik (`closingGame` di `src/games/kinds.ts`).

**Suara**: hanya lewat `useAudio`/`stopAudio`. Tanpa suara Mandarin: mode suara di jodohkan nonaktif dengan keterangan; tebak nada menampilkan huruf + pinyin tanpa tanda nada dan keterangan; tombol dengar nonaktif. Suara dihentikan saat game selesai, "Main lagi", atau keluar.

**Ukuran**: JS awal 107,89 → 111,86 KB gzip (+3,97 KB, kebanyakan teks i18n); CSS awal +0,23 KB gzip. Kode game sendiri di potongan terpisah (±9,7 KB JS + 2,1 KB CSS gzip) yang baru dimuat saat game dibuka.

**Batasan yang diketahui**
- "Main lagi" di jodohkan kembali ke pilihan mode (lalu tekan "Mulai"); mode tidak diingat.
- Susun kalimat: urutan ulang dengan keyboard dilakukan dengan mengembalikan potongan lalu menaruhnya lagi (tidak ada pindah kiri/kanan dengan tombol panah). Seret bekerja dengan mouse dan sentuh (Pointer Events); saat menyentuh potongan, halaman tidak bisa digulir dari potongan itu.
- Pemotong longest-match kadang memotong berbeda dari penutur asli (mis. kata gabungan yang juga kata HSK 1). Jawaban tetap dinilai dari string huruf, jadi tidak membuat jawaban benar dianggap salah.
- Suara perangkat (sementara sampai task 4b) belum ada di Chromium uji; jalur "suara tersedia" diuji dengan suara tiruan di Playwright.
