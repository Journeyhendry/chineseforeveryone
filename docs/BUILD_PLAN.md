# BUILD_PLAN — Xué Mandarin v1 (HSK 1)

Rencana induk untuk membangun website ini sampai v1 selesai. Dibaca oleh setiap sesi kerja (termasuk tugas terjadwal) sebelum mulai. Progres dicatat di `docs/PROGRESS.md`.

- Repo: https://github.com/Journeyhendry/chineseforeveryone (public)
- Website: https://journeyhendry.github.io/chineseforeveryone/ (GitHub Pages, deploy otomatis tiap push ke `main`)
- PRD lengkap (dokumen pemilik): https://claude.ai/artifact/QweyVht3stUSrZ63Y8BSuy
- Mockup (dokumen pemilik): https://claude.ai/artifact/JRv9qoiV2SjbRokAQojzLb

---

## 1. Keputusan yang sudah final (jangan diubah tanpa izin pemilik)

- **Isi v1**: **Tahap 0 · Dasar** (pinyin, nada, coretan, radikal) + **HSK 1 = 300 kata sesuai silabus ujian HSK 2025** (CLEC, Nov 2025; ujian baru 13 Des 2026) — keputusan pemilik 2026-11-22, menggantikan daftar 500 kata standar 2021. Kata di luar 300 tidak dibuang: dipindah ke `data/hsk2-preview/` untuk HSK 2 nanti. Versi laptop dulu, tata letak lentur (tidak rusak di lebar 375 px). Tanpa login; progres di localStorage + tombol cadangan/pulihkan.
- **Bahasa penjelasan**: Indonesia + Inggris, bisa diganti kapan saja.
- **Gaya**: ceria, penuh warna, "toy-like": garis tebal #231942, bayangan kartu tebal, sudut membulat. Latar #FFF7E8, ungu #6741D9, kuning #FFD43B, hijau #2F9E44, jingga #E8590C. Font: Baloo 2 (judul), Nunito (teks), Noto Sans SC sementara untuk huruf Mandarin (target akhir LXGW WenKai, self-host).
- **Warna nada tetap**: nada 1 #C92A2A, nada 2 #B45309, nada 3 #2B8A3E, nada 4 #1864AB, ringan #5C5470. Selalu disertai tanda nada (tidak bergantung warna saja).
- **Urutan unit**: berurutan; unit terkunci bisa dibuka lewat "Tes loncat" (nilai ≥ 80%). Kamus dan ulangan harian tidak dikunci.
- **Materi hanya dari sumber terbuka** (lihat CREDITS.md). AI hanya menerjemahkan arti Inggris → Indonesia (ditandai "terjemahan mesin") dan mengelompokkan kata ke unit.
- **Bahasa sehari-hari**: kotak "Versi santai" 3–5 ungkapan per unit + 1 dialog situasi per unit. Wajib lolos cek berlapis (bagian 5, task 3b).
- **Dialog harus alami** (kritik pemilik 2026-11-22: dialog lama kaku dan konteksnya aneh): percakapan sehari-hari yang mudah dimengerti di tempat nyata (rumah, sekolah, pasar, warung, toko, metro/bus, telepon, kantor). Tiap dialog punya tujuan jelas (mis. menawar harga, menanyakan jam), tiap baris menjawab baris sebelumnya, tokoh bicara seperti orang sungguhan, tidak ada kalimat yang hanya dipaksakan untuk memamerkan kosakata.
- **Ilustrasi**: semua digambar Claude sebagai SVG, gaya B "kartun hangat" (garis bersih, warna rata). Tokoh asli "Keluarga Xiǎo" + sistem rakit (tokoh, pose, benda, latar terpisah). Animasi: CSS untuk gerak sederhana, Lottie untuk gerak rumit. Tanpa video, tanpa Rive. Gerak harus halus: ancang-ancang, gerak susulan, napas kecil, easing lembut; hormati `prefers-reduced-motion`. Contoh acuan: artboard "5 · Tes ilustrasi SVG" di mockup.
- **Suara (pilihan B)**: satu suara utama perempuan untuk SEMUA kata, kalimat, game, dialog; satu suara laki-laki hanya untuk tokoh laki-laki di dialog. Keduanya dari model TTS open source (kandidat: Kokoro zf_*/zm_*, MeloTTS ZH), dipilih pemilik dari contoh: **P3 (perempuan, suara utama) + L3 (laki-laki, tokoh laki-laki di dialog)** — keputusan 2026-11-22. Tahap 0 (keputusan pemilik 2026-11-23, "metode A"): suku kata tunggal tetap suara P3, tetapi naik-turun nadanya disamakan dengan rekaman orang asli `hugolpz/audio-cmn` (CC BY-SA, hanya sebagai contoh nada); penghalusan menyusul. Kecepatan & volume seragam. Rekaman asli (Lingua Libre, Tatoeba, Tone Perfect) hanya sebagai tombol tambahan "Dengar penutur asli" / mode "Dengar berbagai suara". Semua audio dicek Whisper.
- **Hosting & data besar**: unduhan yang diblokir di sesi kerja (Tatoeba, Commons, model TTS, Whisper) dijalankan lewat GitHub Actions (`workflow_dispatch`), hasil yang sudah difilter di-commit balik ke repo.

## 2. Aturan kerja setiap sesi

1. Baca file ini dan `docs/PROGRESS.md`. Ambil **task pertama yang belum selesai dan semua prasyaratnya sudah selesai**. Kerjakan **satu task per sesi** (boleh dua kalau task kecil bertanda Haiku).
2. Sebelum mulai, `git pull` di `main`. Jangan ubah keputusan di bagian 1.
   Supaya dua sesi tidak mengerjakan task yang sama: lewati task yang di PROGRESS.md bertanda `SEDANG DIKERJAKAN` dengan waktu mulai kurang dari 3 jam lalu. Sebelum mulai, tulis `SEDANG DIKERJAKAN (mulai <waktu UTC>)` di baris task itu, commit, dan push; hapus tanda itu saat selesai atau berhenti.
3. Tulis PRD kecil task itu ke `docs/tasks/task-XX.md` (tujuan, scope, out-of-scope, acceptance criteria, file terkait) berdasarkan bagian 4.
4. **Delegasikan implementasi ke subagent** dengan model sesuai bagian 3. Sesi utama tidak menulis kode fitur sendiri; sesi utama merencanakan dan memeriksa.
5. **Periksa hasil** terhadap acceptance criteria: jalankan sendiri `npm ci`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm test` (kalau ada), dan cek lain yang disebut di task. Gambar SVG dicek dengan render ke PNG (`rsvg-convert`) lalu dilihat.
6. Kalau gagal: kirim ulang ke subagent dengan temuan. Gagal kedua → naik satu tingkat model. Opus gagal 2 kali → **berhenti**, catat di PROGRESS.md bagian "Butuh pemilik", kirim notifikasi.
7. Kalau lolos: satu commit per task (pesan `Task XX: <judul>` + baris atribusi sesi), push ke `main`, tunggu deploy GitHub Actions sukses (`gh run list`), centang di PROGRESS.md (tanggal + ringkasan 1 baris + model yang dipakai), commit & push PROGRESS.md.
8. Kirim notifikasi singkat ke pemilik: task apa, lolos/tidak, temuan penting, task berikutnya.
9. **Berhenti dan minta pemilik** untuk: membuat akun/kunci/password, mengubah pengaturan repo/akun, memilih suara (task 4a), dan keputusan yang mengubah bagian 1. Tulis permintaannya di PROGRESS.md "Butuh pemilik"; lanjutkan task lain yang tidak terhalang.
10. Jangan pernah menulis kunci, token, atau password ke repo. Jangan menghapus riwayat git. Jangan force-push.

11. Ide pemilik ada di `docs/IDEAS.md`. Hanya kerjakan ide yang sudah punya task di bagian 4; jangan kerjakan "Ide parkir".

## 3. Pembagian model

| Peran / task | Model |
|---|---|
| Sesi utama: perencana, penulis PRD task, pemeriksa | Opus |
| 1b, 5b, isian i18n, README/CREDITS, perbaikan lint kecil, update PROGRESS | Haiku |
| 2, 3, 4, 5, 8, 9 | Sonnet |
| 3b (penulis), 3c, 6, 6b, 7, 10, 4c (periksa & setel) | Opus |
| 3b (pemeriksa kedua, independen) | Sonnet |

Naik tingkat kalau gagal: Haiku → Sonnet → Opus → berhenti.

## 4. Daftar task (urutan dan prasyarat)

**PRIORITAS (keputusan pemilik 2026-11-22, mengalahkan urutan di bawah):** ambil task yang tersedia (prasyarat selesai, tidak terkunci) dengan urutan:
**2b → 3d → 0 → 4b → 8 → 9 → 7 → ~~6b (tahap berikutnya)~~ → 10.**
**DIJEDA PEMILIK 2026-11-25: 6b tahap 4 dst. tidak boleh diambil** (adegan akan diganti per kalimat/dialog, lihat IDEAS.md). Task 10 (rilis v1.0.0) juga TIDAK diambil sampai pemilik memutuskan ide baru; sesi cukup melapor.
Tujuannya: website sudah bisa dipakai belajar Tahap 0 + HSK 1 (300 kata) lengkap dengan suara secepatnya; ilustrasi unit 4 dst. menyusul. Sesi yang sedang mengerjakan 6b tahap 1 (unit 1–3) boleh menyelesaikannya, tetapi tahap 6b berikutnya hanya diambil kalau tidak ada task lain di daftar prioritas yang tersedia.

### 1 · Kerangka proyek + deploy — SELESAI

### 1b · Cek otomatis di CI (Haiku) — butuh: 1
Tambah job `check` di `.github/workflows/deploy.yml` (npm ci, typecheck, lint, test bila ada) yang harus lolos sebelum build/deploy. Tambah favicon SVG sederhana (huruf 学 di kotak ungu membulat). Acceptance: YAML valid; workflow sukses setelah push; favicon tampil di `dist/`.

### 2 · Data kata HSK 1 (Sonnet) — butuh: 1
- `scripts/build-words.ts` (jalan dengan `tsx`): ambil daftar HSK 3.0 level 1 dari `ivankra/hsk30` (raw GitHub, simpan salinan asli di `data/raw/`), gabung arti Inggris dari CC-CEDICT (paket npm `cedict-json` atau unduhan via Actions), pinyin bertanda nada + angka nada per suku kata, jenis kata (POS).
- Terjemahan Indonesia: dibuat oleh model, disimpan di `data/hsk1/translations-id.json`, tiap entri `machine: true`.
- Output `data/hsk1/words.json`: `{id, hanzi, pinyin, pinyinNumbered, tones[], pos, en[], id[], idMachine, hsk:1, chars[]}`.
- Catat versi/commit sumber di `data/hsk1/SOURCES.json`. Cek apakah daftar HSK 3.0 versi 2026 berbeda; tulis temuannya.
- Acceptance: jumlah kata sama dengan daftar sumber level 1; tiap kata punya hanzi, pinyin, ≥1 arti EN dan ID; skrip bisa dijalankan ulang dengan hasil sama; tes unit untuk parser pinyin/nada.

### 3 · Unit bertema + kalimat contoh (Sonnet) — butuh: 2
- `data/hsk1/units.json`: 15–20 unit bertema (Salam, Angka, Keluarga, Makanan, Waktu, Belanja, …), tiap unit 20–35 kata, tiap kata tepat di satu unit, urutan dari yang paling dasar.
- Workflow `fetch-tatoeba.yml` (workflow_dispatch): unduh kalimat cmn + terjemahan eng/ind + daftar tag OK + daftar audio berlisensi; filter kalimat yang hanya memakai kata HSK 1 (boleh maksimal 1 kata di luar HSK 1, ditandai); commit `data/hsk1/sentences.json` (dengan id Tatoeba, penulis, lisensi).
- Acceptance: semua kata terbagi ke unit; tiap unit punya ≥ 5 kalimat contoh atau tercatat kekurangannya; atribusi Tatoeba lengkap.

### 3b · Versi santai + dialog (Opus menulis, Sonnet memeriksa) — butuh: 3
- Per unit: 3–5 ungkapan santai (label santai/gaul/kasar, versi HSK padanannya, situasi pakai) + 1 dialog 4–8 baris dengan tokoh Keluarga Xiǎo/tokoh pendukung (tiap baris diberi `speaker` dan `gender` untuk pemilihan suara).
- Cek berlapis wajib: (1) draf AI; (2) tiap ungkapan ada di ≥ 2 sumber luar (Wiktionary bertanda 口语/colloquial, CC-CEDICT, Tatoeba, daftar frekuensi subtitle seperti SUBTLEX-CH — hanya untuk cek); (3) pemeriksa AI kedua (Sonnet, tanpa melihat alasan penulis) menilai kewajaran di China daratan; (4) cek otomatis dialog hanya memakai kata HSK 1 + ungkapan lolos; (5) gagal satu lapis → buang.
- Output `data/hsk1/casual.json`, `data/hsk1/dialogs.json`, dan `data/hsk1/casual-evidence.json` (bukti tiap ungkapan).
- Acceptance sesuai PRD bagian "Bahasa sehari-hari".

### 3c · Character sheet + daftar visual per kata (Opus) — butuh: 2
- Character sheet SVG semua tokoh: Kakek, Nenek, Ayah, Ibu (acuan: Ibu di mockup), Kakak laki-laki, Adik perempuan, + pendukung (penjual, dokter, guru). Depan, samping, belakang, 4 ekspresi. Simpan di `public/art/characters/`.
- `data/hsk1/visuals.json`: untuk tiap kata pilih jenis visual: `object` | `action` | `pair` (sifat berlawanan) | `count` | `position` | `comic` (kata tugas), plus deskripsi adegan singkat.
- Acceptance: render PNG semua tokoh terlihat konsisten (proporsi, warna, garis); setiap kata punya entri visual.

### 2b · Ganti HSK 1 ke 300 kata silabus 2025 (Sonnet, diperiksa Opus) — butuh: 2, 3
- Cari daftar 300 kata HSK 1 silabus ujian 2025 dari sumber terbuka (mis. `drkameleon/complete-hsk-vocabulary` MIT — cek apakah sudah memuat silabus 2025; cocokkan dengan minimal 1 sumber lain yang menyebut nomor 1–300). Catat sumber, versi, dan izin di `SOURCES.json` dan CREDITS.md. Kalau tidak ada sumber terbuka yang meyakinkan: berhenti, tulis di "Butuh pemilik".
- `data/hsk1/words.json` = 300 kata itu (kata baru yang belum ada di data lama dilengkapi pinyin/arti/terjemahan dengan skrip yang sama). Kata lama yang tidak masuk → `data/hsk2-preview/words.json` (jangan dihapus; ilustrasi & audio yang sudah ada ikut dipindah referensinya).
- Susun ulang `units.json` (unit bertema, 12–20 kata per unit, jumlah unit menyesuaikan), perbarui kalimat contoh, versi santai, `visuals.json`, `scenes.json`, dan semua tampilan yang menyebut "500".
- Acceptance: tepat 300 kata HSK 1; tiap kata tepat di 1 unit; tidak ada referensi rusak (build, tes, dan cek tautan data lolos); daftar kata yang dipindah ke `hsk2-preview` tercatat.

### 3d · Tulis ulang dialog jadi alami (Opus menulis, Sonnet memeriksa) — butuh: 2b
- Tulis ulang semua dialog mengikuti aturan "Dialog harus alami" di bagian 1. Variasikan tempat: rumah, sekolah, pasar, warung makan, toko, transportasi, telepon. Tiap dialog: judul situasi (ID/EN), tempat, tujuan percakapan, 4–8 baris, `speaker` + `gender` tiap baris.
- Pemeriksa kedua (Sonnet, tanpa melihat alasan penulis) memberi nilai 1–5 untuk: kewajaran ("orang China sungguhan bilang begini?"), kejelasan konteks untuk pemula, alur (tiap baris menjawab sebelumnya). Dialog dengan nilai < 4 di salah satu poin → tulis ulang.
- Tetap wajib: hanya kata HSK 1 (300) + ungkapan santai yang lolos cek; cek otomatis kosakata.
- Acceptance: semua dialog lolos nilai ≥ 4; laporan penilaian di `data/hsk1/dialog-review.json`; contoh 3 dialog tercantum di PROGRESS untuk dilihat pemilik.

### 0 · Tahap 0 "Dasar sebelum HSK 1" (Opus) — butuh: 2b, 6, 4b
- Satu tahap sebelum unit 1 (tidak terkunci; HSK 1 tetap terbuka walau Tahap 0 belum selesai), gaya dan komponen sama dengan unit lain:
  1. Pinyin: tabel bunyi awal (b p m f …) & bunyi akhir (a o e ai …), klik untuk dengar.
  2. 4 nada + nada ringan: penjelasan visual (garis nada berwarna) + latihan dengar & tebak.
  3. Perubahan nada: 3+3 (你好 → ní hǎo), 不 (bù → bú), 一 (yī/yí/yì).
  4. 8 coretan dasar + aturan urutan coretan, dengan animasi Hanzi Writer.
  5. Radikal yang sering muncul (亻 口 女 氵 木 日 …) + cara huruf tersusun.
  6. Ungkapan kelas: angka 1–10, salam dasar.
- Audio pakai suara P3. Suku kata tunggal: nada P3 disamakan dengan rekaman asli `hugolpz/audio-cmn` (metode A, keputusan pemilik 2026-11-23), lalu dicek Whisper/pengecek nada; atribusi audio-cmn di CREDITS.md. Penghalusan suara menyusul di ronde berikutnya.
- Acceptance: semua bagian bisa diselesaikan dengan mouse & keyboard, ada latihan di tiap bagian, teks ID/EN lengkap, tidak ada horizontal scroll di 375 px.

### 4 · Audio (Sonnet) — butuh: 3b, 2b, 3d (audio dibuat untuk daftar 300 kata & dialog baru)
- **4a (berhenti untuk pemilik)**: workflow `tts-samples.yml` membuat contoh 5 kata + 2 kalimat dari 3–4 kandidat suara perempuan dan 2–3 laki-laki (Kokoro zf_*/zm_*, MeloTTS ZH). Simpan di `public/audio/samples/`, buat halaman sederhana `samples.html` untuk didengar, lalu tulis di PROGRESS "Butuh pemilik: pilih suara". Lanjut task lain sampai pemilik memilih.
- **4b**: workflow `build-audio.yml`: buat mp3 (mono, 64 kbps, volume dinormalisasi) untuk semua kata, kalimat, ungkapan santai, dialog dengan suara terpilih; cek tiap file dengan Whisper (transkrip harus sama dengan hanzi); yang gagal dibuat ulang dengan variasi pengaturan, gagal lagi → daftar di `data/hsk1/audio-issues.json`. Unduh juga rekaman asli tambahan (Lingua Libre/Commons CC BY-SA, Tatoeba berlisensi bebas) untuk tombol "Dengar penutur asli". Tone Perfect hanya dipakai kalau izin dari MSU sudah ada.
- Acceptance: setiap kata/kalimat/dialog punya audio suara utama; tingkat lolos Whisper dicatat; atribusi rekaman asli lengkap di CREDITS.md.

### 4c · Perbaiki ketepatan suara (Sonnet skrip, Opus memeriksa) — butuh: 4b
- PRD lengkap: `docs/tasks/task-4c.md`. Ukur nada & durasi suara P3/L3 terhadap rekaman asli dari banyak sumber, perbaiki yang pendek/lemah, pilih versi terbaik per item, halaman sebelum-sesudah untuk telinga pemilik. Suara P3/L3 tidak diganti.

### 5 · Tampilan dasar (Sonnet) — butuh: 1
Tema (token warna/font di CSS variables), menu samping (Belajar, Ulang, Kamus, Progres) yang pindah ke bawah di layar sempit, router (hash router agar aman di GitHub Pages), i18n ID/EN (`src/i18n/id.json`, `en.json`, ganti tanpa reload), halaman pengaturan (bahasa, tampilkan pinyin, kecepatan suara, efek suara), mode gelap. Ikuti mockup artboard 1. Acceptance: semua teks dari file i18n; navigasi keyboard; kontras WCAG AA; tidak ada horizontal scroll di 375 px.

### 5b · Font Mandarin self-host (Haiku) — butuh: 5
Self-host LXGW WenKai (subset untuk huruf HSK 1 + tanda baca) menggantikan Noto Sans SC untuk huruf besar; sertakan izin OFL.

### 5c · Tata letak layar lebar (laptop/PC) — butuh: 5
Di 1366, 1920 dan 2560 px: menu samping penuh tinggi (sticky, 100vh) saat di-scroll; isi halaman memakai lebar fluid (maks-lebar ±1600 px) tanpa ruang kosong besar di kanan; kartu sejajar (kartu gambar kenalan kata sama lebar dengan kartu lain); soal pilihan nada 4 sebaris di layar lebar, 2x2 di sempit; grid daftar kata auto-fill. Hanya CSS/tata letak (`AppShell.css`, `src/pages/learn/*.css`). Tanpa scroll samping di 375 px, mode gelap rapi, axe lolos. Screenshot di 1100/1366/1920/2560 px diperiksa sendiri.

### 6 · Layar unit + peta belajar (Opus) — butuh: 2, 3, 5 (audio boleh placeholder sampai 4b)
Peta belajar (mockup artboard 1), layar kenalan kata (artboard 2: huruf besar, pinyin berwarna nada, arti, tombol suara normal/pelan, animasi coretan Hanzi Writer dengan data lokal, contoh kalimat, kotak versi santai), latihan (pilihan ganda huruf↔arti, suara→huruf, tebak nada — artboard 3), nilai bintang 0–3, unit terkunci + tes loncat. Acceptance sesuai PRD bagian "Belajar & game".

### 6b · Ilustrasi + animasi semua kata (Opus) — butuh: 3c, 6
Dikerjakan bertahap per unit (unit 1–3 dulu, lalu sisanya; satu sesi bisa mengerjakan beberapa unit). Sistem rakit di `public/art/` + `data/hsk1/scenes.json`. Klik kata → animasi + suara. Unit Keluarga: "rumah yang terisi". Huruf bergambar (家, 人, 口, 山 …): animasi asal-usul. Acceptance sesuai PRD bagian "Ilustrasi & animasi".

### 6c · Animasi per kalimat + dialog per kata, hybrid (Opus, pemeriksa Sonnet) — butuh: 6b tahap 1–3, 4b (4c untuk suara)
- Pengganti 6b tahap 4 dst. PRD lengkap: `docs/tasks/task-6c.md`. **Mulai paling cepat 2026-11-26 01:00 WIB.**

### 7 · Empat game (Opus) — butuh: 6
Kartu bolak-balik, jodohkan dengan waktu (artboard 4), tebak nada, susun kalimat (seret + alternatif keyboard). Memakai kata unit yang sedang dibuka. Acceptance: semua jalan dengan mouse dan keyboard; tidak ada bug state saat diulang.

### 8 · Progres + ulangan harian + cadangan (Sonnet) — butuh: 6
Sistem Leitner 5 kotak, target harian 10/20/30, hari berturut-turut, unduh/pulihkan cadangan (JSON). Tes unit wajib untuk logika Leitner dan pemulihan cadangan.

### 9 · Kamus + halaman Sumber + lapor salah (Sonnet) — butuh: 2, 5
Cari lewat huruf/pinyin (dengan/tanpa tanda nada)/arti ID/EN; halaman Sumber dari CREDITS; tombol lapor salah membuka GitHub Issue baru yang terisi otomatis (judul + kata + konteks).

### 10 · Pengecekan akhir + rilis v1 (Opus) — butuh: semua
Jalankan seluruh acceptance criteria PRD, cek ukuran & kecepatan (halaman pertama < 3 detik di 4G), aksesibilitas, tampilan 1366×768, 1920×1080, 375 px. Tulis `docs/RELEASE-v1.md` berisi hasil cek. Tandai tag `v1.0.0`.

## 5. Yang hanya bisa dilakukan pemilik

- Memilih suara utama & suara laki-laki (task 4a).
- (Opsional) Meminta izin data Tone Perfect di https://tone.lib.msu.edu/cite.
- Menyalakan "Automatically approve" di tugas terjadwal agar sesi tidak berhenti menunggu persetujuan.
- Keputusan apa pun yang mengubah bagian 1.
