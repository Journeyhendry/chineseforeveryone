# Task 8 · Progres + ulangan harian + cadangan

Model: Sonnet (implementasi), sesi utama Opus memeriksa. Prasyarat: task 6 (selesai).

## Tujuan
Kata yang sudah dipelajari diulang otomatis dengan sistem kotak Leitner (5 kotak): kata yang salah muncul lagi besok, kata yang benar berulang kali makin jarang muncul. Murid memilih target harian (10/20/30 kata), melihat hari berturut-turut belajar, dan melihat ringkasan progres. Progres bisa diunduh sebagai file cadangan dan dipulihkan di browser lain.

Acuan PRD pemilik: "Ulangan harian: tiap hari muncul kata yang hampir lupa atau sering salah, dengan jadwal ulang yang makin lama makin jarang kalau jawaban benar. Target harian bisa dipilih: 10, 20, atau 30 kata." "Progres: jumlah kata yang dikuasai, unit selesai, hari berturut-turut belajar; tombol simpan cadangan (unduh file) dan pulihkan." Acceptance PRD: "Ulangan harian menampilkan kata salah lebih sering; kata yang dijawab benar berulang kali muncul makin jarang." "Progres tetap ada setelah browser ditutup dan dibuka lagi." "Cadangan progres bisa diunduh lalu dipulihkan di browser lain."
Acuan tampilan: `docs/tasks/ref/mockup-1-peta-belajar.dc.html` (chip "5 hari berturut-turut" di kepala peta, kartu "Ulangan hari ini" + tombol "Mulai ulang", kartu "Target harian" dengan progressbar). Ikuti gaya yang sudah ada (token `src/styles/theme.css`, komponen & CSS di `src/pages/learn/`), bukan hex baru.

## Catatan penting: task 2b berjalan bersamaan
Sesi lain sedang menyusun ulang data kata/unit (500 → 300 kata, unit baru). Karena itu:
- **Jangan ubah** `data/**`, `scripts/**`, `public/data/**`, `public/art/**`, `src/art/**`, `src/lib/lessons-build.ts`, workflow.
- Kode tidak boleh mengandalkan jumlah unit/kata tertentu (20, 500, dst.); semua dihitung dari `public/data/hsk1/index.json` + file unit.
- Id kata (`L1-xxxx`) bisa hilang dari HSK 1 setelah 2b. Data Leitner untuk id yang tidak ditemukan di file unit **tetap disimpan** (tidak dihapus), tetapi diabaikan di layar & hitungan.

## Scope

### A. Logika (fungsi murni di `src/lib/`, semua dites)
1. **Tanggal**: `src/lib/dates.ts` — `localDay(date: Date): string` (YYYY-MM-DD menurut jam perangkat), `addDays(day, n)`, `daysBetween(a, b)` (hitung via UTC dari string, aman dari pergantian jam musim panas). Semua logika di bawah menerima `today: string` (tidak memanggil `new Date()` sendiri) supaya bisa dites.
2. **Leitner** `src/lib/leitner.ts`:
   - Kotak 1–5, jarak ulang: kotak 1 = 1 hari, 2 = 2 hari, 3 = 4 hari, 4 = 8 hari, 5 = 16 hari. Entri kata: `{ box: 1..5, due: 'YYYY-MM-DD', seen: n, wrong: n, last?: 'YYYY-MM-DD' }`.
   - `recordAnswer(p, wordId, correct, today, source: 'practice' | 'skip' | 'review')`:
     - Kata belum tercatat: masuk dianggap kotak 1, lalu benar → kotak 2 (due = today + 2), salah → kotak 1 (due = today + 1).
     - Kata tercatat dan sudah jatuh tempo (`due <= today`) atau `source === 'review'`: benar → naik satu kotak (maks 5), due = today + jarak kotak baru; salah → kotak 1, due = today + 1.
     - Kata tercatat tetapi belum jatuh tempo dan bukan dari ulangan: salah → kotak 1, due = today + 1; benar → kotak & due tidak berubah (tidak bisa "menghafal kilat" untuk naik kotak).
     - Satu kata dijawab beberapa kali di sesi yang sama: tiap jawaban diproses berurutan dengan aturan di atas (tes harus menunjukkan jawaban benar kedua di hari yang sama tidak menaikkan kotak lagi, karena due sudah di masa depan — kecuali source review; ulangan tidak boleh memuat kata yang sama dua kali, lihat poin 4).
     - Selalu: `seen += 1`, `wrong += 1` bila salah, `last = today`.
   - `dueWords(p, today, knownIds?)`: kata dengan `due <= today`, urut: kotak terendah dulu, lalu due paling lama, lalu id (stabil). `knownIds` (opsional) menyaring id yang masih ada.
   - `isMastered(entry)` = kotak ≥ 4. `boxCounts(p, knownIds?)` → jumlah kata per kotak 1–5.
3. **Target harian & hari berturut-turut** (di `src/lib/leitner.ts` atau `src/lib/daily.ts`):
   - Kolom `today: { day: 'YYYY-MM-DD', words: string[] }` — id kata unik yang dijawab hari ini (dari sumber mana pun). Hari berganti → daftar dikosongkan. Batasi panjang (mis. 500) agar data tidak membengkak. `todayCount(p, today)`.
   - Kolom `streak: { last: 'YYYY-MM-DD', current: n, best: n }`. Hari aktif = menjawab ≥ 1 soal. Jawaban pertama hari ini: bila `last` = kemarin → current + 1; bila `last` = hari ini → tetap; selain itu → current = 1. `best = max(best, current)`. `currentStreak(p, today)` mengembalikan 0 bila `last` lebih tua dari kemarin (jangan ubah data saat membaca). Jam perangkat mundur (today < last) → tidak error, tidak menaikkan streak.
   - Target harian (10/20/30, bawaan 20) disimpan di **Settings** (`dailyGoal`, `normalizeSettings` diperluas, data lama tanpa kolom ini tetap valid, tes settings diperbarui).
   - Satu fungsi gabungan `recordAnswers(p, answers: {wordId, correct}[], today, source)` dipakai semua layar (latihan unit, tes loncat, ulangan) supaya Leitner, daftar hari ini, dan streak selalu konsisten.
4. **Soal ulangan** di `src/lib/quiz.ts`: `buildReviewQuiz(asked: QuizWord[], pool: QuizWord[][], opts)` — tepat satu soal per kata yang diulang (tidak ada kata dua kali), urutan sesuai input (kata paling perlu diulang dulu), jenis soal bergiliran seperti latihan (audio→huruf hanya bila suara ada), pengecoh dari unit kata itu (`pool` = kata per unit), aturan pilihan sama seperti `buildQuiz` (4 pilihan, unik, jawaban benar tepat satu). Refactor seperlunya tanpa mengubah perilaku `buildUnitQuiz`/`buildSkipQuiz` (tes lama tetap lolos).
5. **Progres** `src/lib/progress.ts`: tambah kolom opsional `words: Record<wordId, LeitnerEntry>`, `today`, `streak` ke `Progress` (tetap `version: 1`, kunci `xue.progress.v1`). `normalizeProgress` memulihkan tiap kolom baru per entri: id kata harus cocok pola aman (mis. `/^[A-Za-z0-9-]{1,32}$/`), kotak dibulatkan & dijepit 1–5, tanggal harus format YYYY-MM-DD yang valid (entri dengan due rusak → due = hari ini tidak bisa diketahui fungsi murni, jadi buang entri itu atau pakai `last`; pilih satu dan dites), angka negatif/NaN → 0, jumlah entri dibatasi (mis. 5000). Data lama (hanya `units`) tetap valid dan tidak berubah artinya.
6. **Cadangan** `src/lib/backup.ts`:
   - `makeBackup(progress, settings, now)` → objek `{ app: 'xue-mandarin', kind: 'backup', version: 1, exportedAt: ISO, progress, settings }`; `backupFileName(now)` → `xue-mandarin-cadangan-YYYY-MM-DD.json`.
   - `parseBackup(text: string): { ok: true, progress, settings, summary } | { ok: false, error: 'too-big' | 'not-json' | 'not-backup' | 'newer-version' }` — tolak > 2 MB, bukan JSON, tanda `app`/`kind` salah, `version` lebih baru dari yang dikenal. Isi dipulihkan lewat `normalizeProgress` dan `normalizeSettings` (kolom rusak tidak membatalkan seluruh file). `summary`: unit selesai, kata tercatat, kata dikuasai, streak terbaik, tanggal ekspor.
   - Pemulihan **mengganti** progres & pengaturan (bukan menggabung), hanya setelah murid menekan konfirmasi.
7. Tes (vitest, di samping modulnya): dates (pergantian bulan/tahun, tahun kabisat), Leitner (semua cabang di poin 2, contoh jadwal: benar terus dari kotak 1 → jatuh tempo +2, +4, +8, +16, +16; salah di kotak 4 → kembali kotak 1 besok), dueWords (urutan, saring knownIds), streak (kemarin, hari ini, bolong 2 hari, jam mundur, best), todayCount (ganti hari), buildReviewQuiz (satu soal per kata, pilihan unik & valid, deterministik), normalizeProgress (kolom baru rusak/campur, data lama), backup (bolak-balik make → JSON.stringify → parse sama, semua jenis error, file sebagian rusak tetap dipulihkan per kolom, kolom tak dikenal diabaikan).

### B. Penyambungan ke layar yang ada
1. `QuizRunner`: tambah informasi jawaban per soal (mis. `answers: {wordId, correct}[]` di `QuizResult`), tanpa mengubah tampilan/perilaku yang ada.
2. Latihan unit (`PracticeScreen`) dan tes loncat (`SkipScreen`): saat layar nilai muncul, panggil `recordAnswers` dengan source `practice`/`skip` dalam **satu** `updateProgress` bersama `recordUnitResult`/`recordSkipResult` (sekali per sesi; tidak dobel saat re-render / StrictMode).
3. Sumber data kata untuk ulangan & progres: muat `index.json` lalu file unit yang diperlukan lewat `loadUnit` yang sudah ada (boleh muat semua unit di index; ukurannya kecil). Buat satu hook/fungsi bersama (mis. `useAllUnits()` di `src/pages/learn/hooks.ts` atau modul baru) dengan status memuat/gagal + coba lagi.

### C. Layar baru (semua teks dari i18n `id.json`/`en.json`, kunci sama di kedua file; kunci "segera hadir" yang tak terpakai dihapus)
1. `#/ulang` — **Ulangan harian** (ganti isi `ReviewPage`):
   - Kartu "Ulangan hari ini": jumlah kata jatuh tempo, tombol "Mulai ulang" (sesi = maks `dailyGoal` kata jatuh tempo, urut `dueWords`). Kartu "Target harian": progressbar ber-ARIA (`aria-valuenow` = kata hari ini, max = target; lewat target tetap aman), teks "x dari y kata", pilihan target 10/20/30 (radio, tersimpan di Settings).
   - Belum ada kata tercatat → pesan ramah + tautan ke Belajar. Ada kata tetapi tidak ada yang jatuh tempo → "Semua beres untuk hari ini" + kapan ulangan berikutnya (tanggal due terdekat, format sesuai bahasa).
   - Sesi memakai `QuizRunner` (keyboard 1–4/Enter/Spasi sama seperti latihan). Layar hasil: skor x/n, daftar kata naik kotak & kata kembali ke kotak 1 (hanzi, pinyin, arti), streak, progres target, tombol "Ulang lagi" (bila masih ada yang jatuh tempo) dan "Kembali". Data disimpan sekali saat layar hasil muncul.
   - Rute tetap `#/ulang` (sesi boleh pakai sub-rute `#/ulang/sesi` bila perlu; router + tes diperbarui). Tidak terkunci.
2. `#/progres` — **Progres** (ganti isi `ProgressPage`):
   - Angka ringkas: unit selesai x/N, kata dikuasai (kotak ≥ 4) x/total kata HSK 1, kata sedang dipelajari (tercatat, kotak 1–3), hari berturut-turut (sekarang + terbaik), kata hari ini x/target.
   - Sebaran 5 kotak Leitner: 5 batang sederhana (HTML/CSS, tanpa pustaka grafik) dengan angka tertulis dan keterangan singkat arti kotak (mis. "Kotak 1 · diulang besok", "Kotak 5 · tiap 16 hari"); terbaca pembaca layar (tabel atau daftar, bukan hanya gambar).
   - **Cadangan**: penjelasan singkat bahwa progres hanya tersimpan di browser ini. Tombol "Simpan cadangan" (unduh file JSON lewat Blob + `<a download>`, revoke URL). "Pulihkan dari file": `<input type="file" accept="application/json,.json">` dengan label jelas → tampilkan ringkasan isi file + peringatan "progres sekarang akan diganti" + tombol "Ganti dengan cadangan ini" dan "Batal". Sukses/gagal diumumkan lewat `role="status"`/`role="alert"`, pesan i18n per jenis error. Setelah pulih, semua layar (peta, progres, pengaturan, bahasa) ikut berubah tanpa reload (perbarui store progres di `hooks.ts` dan settings lewat provider yang ada).
3. **Peta belajar** (`MapScreen`): chip hari berturut-turut di kepala (ikon api `aria-hidden`, teks "n hari berturut-turut"; 0 → "Mulai hari ini" atau sejenisnya), dan kartu kecil "Ulangan hari ini" (jumlah jatuh tempo + tautan ke `#/ulang`) — hanya tampil bila ada kata tercatat. Jangan ubah isi kartu unit (task 2b menyentuh data unit).
4. Gaya: CSS per layar memakai token tema; mode gelap terbaca; tidak ada scroll horizontal di 375 px; tombol ≥ 44 px; animasi kecil mati saat `prefers-reduced-motion`.

## Out of scope
- Data kata/unit, skrip build, ilustrasi, audio final, game (task 7), kamus (task 9), Tahap 0.
- Sinkron antar perangkat / login (v2). Tombol "hapus semua progres".
- Mengubah keputusan BUILD_PLAN bagian 1.

## Acceptance criteria (dicek sesi utama)
1. `npm ci`, `npm run typecheck`, `npm run lint` (tanpa error baru), `npm run build`, `npm test` lolos; `git status` hanya berisi file dalam scope.
2. Tes unit mencakup semua poin A.7; jadwal Leitner benar terus 1→5 dan salah → kotak 1 terbukti di tes.
3. Build produksi (`vite preview`, base `/chineseforeveryone/`), dengan jam browser dipalsukan (Playwright `clock`): selesaikan latihan unit 1 → `#/ulang` hari itu: belum ada yang jatuh tempo (kata salah jatuh tempo besok); majukan jam 1 hari → kata yang salah muncul di ulangan, jumlah sesi ≤ target; jawab benar → kata naik kotak, tidak muncul lagi besok. Streak naik 1 → 2 di hari kedua; bolong 2 hari → kembali 1.
4. Target 10/20/30 bisa dipilih, tersimpan setelah reload, sesi ulangan dibatasi sesuai target.
5. `#/progres`: angka unit selesai, kata dikuasai, sebaran kotak, streak cocok dengan isi localStorage. Unduh cadangan → hapus localStorage → pulihkan dari file → progres & pengaturan kembali sama persis (bandingkan JSON). File rusak / bukan cadangan → pesan gagal, progres tidak berubah.
6. Semua bisa dipakai dengan keyboard saja (termasuk pilih file & konfirmasi). Ganti ke EN: tidak ada teks Indonesia tersisa di layar baru (nama file cadangan boleh tetap).
7. axe tanpa pelanggaran di `#/ulang` (awal, sesi, hasil), `#/progres`, peta — terang & gelap. Tidak ada scroll horizontal di 375 px. Tidak ada error konsol.
8. Data lama (progres task 6 tanpa kolom baru) tetap terbaca: bintang & unit terbuka tidak berubah.

## File terkait
- Baru: `src/lib/{dates,leitner,backup}.ts` (+ opsional `daily.ts`) + tes, CSS/komponen layar ulang & progres (mis. `src/pages/review/*`, `src/pages/progress/*`).
- Diubah: `src/lib/{progress,quiz,settings,router}.ts` (+ tes), `src/pages/{ReviewPage,ProgressPage,SettingsPage}.tsx`, `src/pages/learn/{QuizRunner,PracticeScreen,SkipScreen,MapScreen,hooks}.tsx/ts`, CSS peta bila perlu, `src/i18n/{id,en}.json`.
