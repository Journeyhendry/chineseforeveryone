# BUILD_PLAN — Xué Mandarin v1 (HSK 1)

Rencana induk untuk membangun website ini sampai v1 selesai. Dibaca oleh setiap sesi kerja (termasuk tugas terjadwal) sebelum mulai. Progres dicatat di `docs/PROGRESS.md`.

- Repo: https://github.com/Journeyhendry/chineseforeveryone (public)
- Website: https://journeyhendry.github.io/chineseforeveryone/ (GitHub Pages, deploy otomatis tiap push ke `main`)
- PRD lengkap (dokumen pemilik): https://claude.ai/artifact/QweyVht3stUSrZ63Y8BSuy
- Mockup (dokumen pemilik): https://claude.ai/artifact/JRv9qoiV2SjbRokAQojzLb

---

## 1. Keputusan yang sudah final (jangan diubah tanpa izin pemilik)

- **Isi v1**: HSK 1 (standar HSK 3.0, sekitar 500 kata / 300 huruf). Versi laptop dulu, tata letak lentur (tidak rusak di lebar 375 px). Tanpa login; progres di localStorage + tombol cadangan/pulihkan.
- **Bahasa penjelasan**: Indonesia + Inggris, bisa diganti kapan saja.
- **Gaya**: ceria, penuh warna, "toy-like": garis tebal #231942, bayangan kartu tebal, sudut membulat. Latar #FFF7E8, ungu #6741D9, kuning #FFD43B, hijau #2F9E44, jingga #E8590C. Font: Baloo 2 (judul), Nunito (teks), Noto Sans SC sementara untuk huruf Mandarin (target akhir LXGW WenKai, self-host).
- **Warna nada tetap**: nada 1 #C92A2A, nada 2 #B45309, nada 3 #2B8A3E, nada 4 #1864AB, ringan #5C5470. Selalu disertai tanda nada (tidak bergantung warna saja).
- **Urutan unit**: berurutan; unit terkunci bisa dibuka lewat "Tes loncat" (nilai ≥ 80%). Kamus dan ulangan harian tidak dikunci.
- **Materi hanya dari sumber terbuka** (lihat CREDITS.md). AI hanya menerjemahkan arti Inggris → Indonesia (ditandai "terjemahan mesin") dan mengelompokkan kata ke unit.
- **Bahasa sehari-hari**: kotak "Versi santai" 3–5 ungkapan per unit + 1 dialog situasi per unit. Wajib lolos cek berlapis (bagian 5, task 3b).
- **Ilustrasi**: semua digambar Claude sebagai SVG, gaya B "kartun hangat" (garis bersih, warna rata). Tokoh asli "Keluarga Xiǎo" + sistem rakit (tokoh, pose, benda, latar terpisah). Animasi: CSS untuk gerak sederhana, Lottie untuk gerak rumit. Tanpa video, tanpa Rive. Gerak harus halus: ancang-ancang, gerak susulan, napas kecil, easing lembut; hormati `prefers-reduced-motion`. Contoh acuan: artboard "5 · Tes ilustrasi SVG" di mockup.
- **Suara (pilihan B)**: satu suara utama perempuan untuk SEMUA kata, kalimat, game, dialog; satu suara laki-laki hanya untuk tokoh laki-laki di dialog. Keduanya dari model TTS open source (kandidat: Kokoro zf_*/zm_*, MeloTTS ZH), dipilih pemilik dari contoh. Kecepatan & volume seragam. Rekaman asli (Lingua Libre, Tatoeba, Tone Perfect) hanya sebagai tombol tambahan "Dengar penutur asli" / mode "Dengar berbagai suara". Semua audio dicek Whisper.
- **Hosting & data besar**: unduhan yang diblokir di sesi kerja (Tatoeba, Commons, model TTS, Whisper) dijalankan lewat GitHub Actions (`workflow_dispatch`), hasil yang sudah difilter di-commit balik ke repo.

## 2. Aturan kerja setiap sesi

1. Baca file ini dan `docs/PROGRESS.md`. Ambil **task pertama yang belum selesai dan semua prasyaratnya sudah selesai**. Kerjakan **satu task per sesi** (boleh dua kalau task kecil bertanda Haiku).
2. Sebelum mulai, `git pull` di `main`. Jangan ubah keputusan di bagian 1.
3. Tulis PRD kecil task itu ke `docs/tasks/task-XX.md` (tujuan, scope, out-of-scope, acceptance criteria, file terkait) berdasarkan bagian 4.
4. **Delegasikan implementasi ke subagent** dengan model sesuai bagian 3. Sesi utama tidak menulis kode fitur sendiri; sesi utama merencanakan dan memeriksa.
5. **Periksa hasil** terhadap acceptance criteria: jalankan sendiri `npm ci`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm test` (kalau ada), dan cek lain yang disebut di task. Gambar SVG dicek dengan render ke PNG (`rsvg-convert`) lalu dilihat.
6. Kalau gagal: kirim ulang ke subagent dengan temuan. Gagal kedua → naik satu tingkat model. Opus gagal 2 kali → **berhenti**, catat di PROGRESS.md bagian "Butuh pemilik", kirim notifikasi.
7. Kalau lolos: satu commit per task (pesan `Task XX: <judul>` + baris atribusi sesi), push ke `main`, tunggu deploy GitHub Actions sukses (`gh run list`), centang di PROGRESS.md (tanggal + ringkasan 1 baris + model yang dipakai), commit & push PROGRESS.md.
8. Kirim notifikasi singkat ke pemilik: task apa, lolos/tidak, temuan penting, task berikutnya.
9. **Berhenti dan minta pemilik** untuk: membuat akun/kunci/password, mengubah pengaturan repo/akun, memilih suara (task 4a), dan keputusan yang mengubah bagian 1. Tulis permintaannya di PROGRESS.md "Butuh pemilik"; lanjutkan task lain yang tidak terhalang.
10. Jangan pernah menulis kunci, token, atau password ke repo. Jangan menghapus riwayat git. Jangan force-push.

## 3. Pembagian model

| Peran / task | Model |
|---|---|
| Sesi utama: perencana, penulis PRD task, pemeriksa | Opus |
| 1b, 5b, isian i18n, README/CREDITS, perbaikan lint kecil, update PROGRESS | Haiku |
| 2, 3, 4, 5, 8, 9 | Sonnet |
| 3b (penulis), 3c, 6, 6b, 7, 10 | Opus |
| 3b (pemeriksa kedua, independen) | Sonnet |

Naik tingkat kalau gagal: Haiku → Sonnet → Opus → berhenti.

## 4. Daftar task (urutan dan prasyarat)

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

### 4 · Audio (Sonnet) — butuh: 3b
- **4a (berhenti untuk pemilik)**: workflow `tts-samples.yml` membuat contoh 5 kata + 2 kalimat dari 3–4 kandidat suara perempuan dan 2–3 laki-laki (Kokoro zf_*/zm_*, MeloTTS ZH). Simpan di `public/audio/samples/`, buat halaman sederhana `samples.html` untuk didengar, lalu tulis di PROGRESS "Butuh pemilik: pilih suara". Lanjut task lain sampai pemilik memilih.
- **4b**: workflow `build-audio.yml`: buat mp3 (mono, 64 kbps, volume dinormalisasi) untuk semua kata, kalimat, ungkapan santai, dialog dengan suara terpilih; cek tiap file dengan Whisper (transkrip harus sama dengan hanzi); yang gagal dibuat ulang dengan variasi pengaturan, gagal lagi → daftar di `data/hsk1/audio-issues.json`. Unduh juga rekaman asli tambahan (Lingua Libre/Commons CC BY-SA, Tatoeba berlisensi bebas) untuk tombol "Dengar penutur asli". Tone Perfect hanya dipakai kalau izin dari MSU sudah ada.
- Acceptance: setiap kata/kalimat/dialog punya audio suara utama; tingkat lolos Whisper dicatat; atribusi rekaman asli lengkap di CREDITS.md.

### 5 · Tampilan dasar (Sonnet) — butuh: 1
Tema (token warna/font di CSS variables), menu samping (Belajar, Ulang, Kamus, Progres) yang pindah ke bawah di layar sempit, router (hash router agar aman di GitHub Pages), i18n ID/EN (`src/i18n/id.json`, `en.json`, ganti tanpa reload), halaman pengaturan (bahasa, tampilkan pinyin, kecepatan suara, efek suara), mode gelap. Ikuti mockup artboard 1. Acceptance: semua teks dari file i18n; navigasi keyboard; kontras WCAG AA; tidak ada horizontal scroll di 375 px.

### 5b · Font Mandarin self-host (Haiku) — butuh: 5
Self-host LXGW WenKai (subset untuk huruf HSK 1 + tanda baca) menggantikan Noto Sans SC untuk huruf besar; sertakan izin OFL.

### 6 · Layar unit + peta belajar (Opus) — butuh: 2, 3, 5 (audio boleh placeholder sampai 4b)
Peta belajar (mockup artboard 1), layar kenalan kata (artboard 2: huruf besar, pinyin berwarna nada, arti, tombol suara normal/pelan, animasi coretan Hanzi Writer dengan data lokal, contoh kalimat, kotak versi santai), latihan (pilihan ganda huruf↔arti, suara→huruf, tebak nada — artboard 3), nilai bintang 0–3, unit terkunci + tes loncat. Acceptance sesuai PRD bagian "Belajar & game".

### 6b · Ilustrasi + animasi semua kata (Opus) — butuh: 3c, 6
Dikerjakan bertahap per unit (unit 1–3 dulu, lalu sisanya; satu sesi bisa mengerjakan beberapa unit). Sistem rakit di `public/art/` + `data/hsk1/scenes.json`. Klik kata → animasi + suara. Unit Keluarga: "rumah yang terisi". Huruf bergambar (家, 人, 口, 山 …): animasi asal-usul. Acceptance sesuai PRD bagian "Ilustrasi & animasi".

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
