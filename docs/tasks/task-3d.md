# Task 3d · Tulis ulang dialog jadi alami

Model: Opus menulis dialog + kode kecil; Sonnet memeriksa (independen, tidak melihat alasan penulis); sesi utama Opus merencanakan & memeriksa. Prasyarat: 2b (selesai).

## Tujuan
Kritik pemilik 2026-11-22: dialog lama kaku dan konteksnya aneh. Setiap unit HSK 1 (21 unit di `data/hsk1/units.json`) mendapat **1 dialog baru** yang terasa seperti percakapan sehari-hari sungguhan di tempat nyata, dengan tujuan jelas, mudah dipahami pemula. Saat ini hanya 1 dari 21 unit yang punya dialog (d-u18 di u19); 19 dialog lama ada di `data/hsk1/dialogs-retired.json` (boleh dipakai sebagai bahan, tidak wajib).

Aturan bagian 1 BUILD_PLAN ("Dialog harus alami"): tempat nyata (rumah, sekolah, pasar, warung makan, toko, metro/bus, telepon, kantor, …); tiap dialog punya tujuan jelas (mis. menawar harga, menanyakan jam); tiap baris menjawab baris sebelumnya; tokoh bicara seperti orang sungguhan; tidak ada kalimat yang hanya dipaksakan untuk memamerkan kosakata.

## Scope

### A. Data dialog baru — `data/hsk1/dialogs-natural.json` (sumber yang ditulis tangan oleh penulis)
- Format: `{ version: 1, speakers: <sama persis dengan speakers di dialogs.json sekarang>, dialogs: [...] }`.
- Tiap dialog:
  - `id`: `n-u01` … `n-u21` (satu per unit; `unit` = id unit itu).
  - `title` {id, en} — judul situasi singkat (mis. "Menanyakan harga di pasar").
  - `place` {id, en} + `placeKind` salah satu: `home | school | market | eatery | shop | transport | phone | office | street | clinic | park`.
  - `goal` {id, en} — tujuan percakapan dalam satu kalimat (mis. "Nenek ingin tahu harga apel dan meminta lebih murah").
  - `situation` {id, en} — 1–2 kalimat konteks untuk pemula (siapa, di mana, kenapa).
  - `lines`: 4–8 baris, tiap baris `{ speaker, gender, cmn, en, id }`. `speaker` hanya dari 13 tokoh yang ada (yeye, nainai, baba, mama, gege, meimei, seller, doctor, teacher, waiter, driver, friend, classmate) — jangan tambah tokoh (tidak punya gambar). `gender` harus sama dengan tokoh. Gege = mahasiswa muda; meimei = anak SD; classmate = teman kuliah gege.
- Variasi tempat: minimal 7 `placeKind` berbeda di seluruh 21 dialog; tidak ada satu `placeKind` dipakai > 5 kali; minimal 1 dialog `phone`, 1 `transport`, 1 `market` atau `shop`, 1 `eatery`, 1 `school`.
- Kosakata (cek otomatis yang sudah ada, `checkDialog` di `src/lib/casual.ts`): hanya kata HSK 1 (300) + ungkapan santai yang **lolos** dan berasal dari unit yang sama atau sebelumnya. Kata HSK 1 dari unit **sesudah** unit dialog boleh, maksimal 3 per dialog (dicatat `laterUnitWords`); sebisa mungkin pakai kata unit itu sendiri. Tidak ada nama orang/merek; angka ditulis dengan huruf Mandarin (一, 两, 十 …) kecuali jam/tanggal memang lazim angka — ikuti apa yang lolos cek. Tanda baca Mandarin full-width.
- Terjemahan `en`/`id` alami (bukan kata per kata), ditandai `machine: true` oleh build seperti sekarang.
- Ketentuan isi: 1 tujuan per dialog, alur sebab-akibat jelas, penutup yang wajar (terima kasih / sampai jumpa / keputusan). Hindari: pertanyaan yang jawabannya sudah jelas bagi kedua tokoh ("Ini apa?" "Ini buku." antar keluarga di rumah tanpa alasan), daftar kosakata dalam satu kalimat, tokoh yang memperkenalkan diri kepada keluarganya sendiri.

### B. Build: `dialogs.json` dibuat dari `dialogs-natural.json`
- **Jangan ubah** `src/lib/casual.ts`, `data/hsk1/casual-candidates.json`, `scripts/fetch-casual-evidence.ts`, `.github/workflows/casual-evidence.yml` (mengubahnya memicu workflow bukti di GitHub). Kode baru di modul baru (mis. `src/lib/dialogs-natural.ts`) yang memakai `buildDialogContext`/`checkDialog` dari `casual.ts`.
- `npm run build:casual` (atau skrip baru `npm run build:dialogs` yang dijalankan sesudahnya — pilih satu, dokumentasikan di kepala skrip) menulis `data/hsk1/dialogs.json` dari dialog baru yang lolos cek, dengan kolom `place`, `placeKind`, `goal` ikut tersimpan. Dialog yang gagal cek tidak masuk dan build mencetak alasannya (acceptance: 0 yang gagal).
- Dialog lama: d-u18 dan semua draf lama **tidak** tampil lagi di website (diganti dialog baru). `dialogs-draft.json` dan `dialogs-retired.json` boleh tetap sebagai arsip; tes yang ada (`casual.test.ts`, `casual-remap.test.ts`, `tts-samples.test.ts`) diperbarui seperlunya agar tetap menguji hal yang benar (mis. "hasil build = file yang di-commit").
- `casual-report.json`: angka dialog/`unitsWithoutDialog` mencerminkan dialog baru (0 unit tanpa dialog), atau ada laporan dialog terpisah — pilih yang paling sederhana, tetap deterministik.
- `npm run build:lessons` diperbarui sehingga `public/data/hsk1/units/*.json` memuat `place`, `placeKind`, `goal`; jalankan ulang. Subset font (`npm run build:font`) dijalankan ulang bila dialog membawa huruf baru (tes font harus lolos).
- `npm run check:data` tetap lolos (ditambah: setiap unit punya tepat 1 dialog).

### C. Tampilan
- `DialogCard` menampilkan tempat (ikon kecil `aria-hidden` per `placeKind`, boleh emoji atau SVG sederhana) + teks tempat, dan "Tujuan: …" di bawah judul. Teks label dari i18n (`id.json`/`en.json`, kunci sama). Gaya pakai token tema; mode gelap terbaca; tidak ada scroll horizontal di 375 px.

### D. Pemeriksa kedua + laporan — `data/hsk1/dialog-review.json`
- Diisi oleh pemeriksa Sonnet independen (sesi utama yang menjalankannya). Format:
  `{ version: 1, reviewer: "claude-sonnet (independen)", criteria: {...}, rounds: [{ round: n, reviews: [{ id, cmn: [<teks cmn tiap baris>], scores: { natural, clarity, flow }, comment, suggestion? }] }], final: { <id>: { round, scores } } }`.
  - `natural` = "orang China daratan sungguhan bilang begini?", `clarity` = konteks jelas untuk pemula, `flow` = tiap baris menjawab baris sebelumnya. Nilai 1–5.
- Dialog dengan nilai < 4 di salah satu kriteria → ditulis ulang penulis (penulis hanya melihat nilai + komentar pemeriksa), lalu dinilai ulang di ronde berikutnya.
- Tes otomatis: setiap dialog di `dialogs.json` punya entri `final` dengan ketiga nilai ≥ 4, dan `cmn` di ronde final sama persis dengan baris dialog sekarang (dialog yang diubah setelah dinilai → tes gagal).

## Out of scope
Audio (task 4b), ilustrasi adegan dialog, mengubah ungkapan santai atau daftar kata/unit, tokoh baru, mengubah keputusan bagian 1.

## Acceptance criteria
1. 21 dialog, tepat 1 per unit, semua lolos cek kosakata otomatis (0 gagal), 4–8 baris, `speaker` + `gender` benar tiap baris, `title`/`place`/`placeKind`/`goal`/`situation` ID+EN lengkap.
2. Variasi tempat sesuai bagian A.
3. `dialog-review.json`: semua dialog final ≥ 4 di ketiga kriteria; tes pencocokan teks lolos.
4. `npm ci`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm test`, `npm run check:data`, `npm run check:visuals` lolos; `npm run build:casual` (+ `build:dialogs` bila ada) + `build:lessons` dijalankan ulang tidak mengubah file apa pun (deterministik).
5. Layar ringkasan unit menampilkan dialog baru dengan tempat & tujuan, ID/EN, terang/gelap, 375 px tanpa scroll samping; axe tanpa pelanggaran serius.
6. 3 contoh dialog dicantumkan di PROGRESS.md untuk pemilik.

## File terkait
`data/hsk1/dialogs-natural.json` (baru), `data/hsk1/dialog-review.json` (baru), `data/hsk1/dialogs.json`, `data/hsk1/casual-report.json`, `scripts/build-casual.ts` / `scripts/build-dialogs.ts`, `src/lib/dialogs-natural.ts` (baru) + tes, `src/lib/casual-remap.ts`, `src/lib/lessons-build.ts`, `src/lib/lessons.ts`, `scripts/check-data.ts`, `src/lib/data-links.ts`, `src/pages/learn/DialogCard.tsx` + CSS, `src/i18n/{id,en}.json`, `public/data/hsk1/**`, `public/fonts/**` (bila subset berubah).
