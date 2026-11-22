# Task 4b · Audio semua materi HSK 1

Model: Sonnet (implementasi), sesi utama Opus memeriksa. Prasyarat: 3b, 2b, 3d, 4a (selesai; pemilik memilih **P3** + **L3** pada 2026-11-22).

## Tujuan
Semua kata, kalimat contoh, ungkapan santai, dan baris dialog HSK 1 punya file suara yang seragam: suara utama **P3** (Kokoro-82M v1.1-zh `zf_001`) untuk semuanya, **L3** (Kokoro-82M v1.1-zh `zm_010`) hanya untuk baris dialog tokoh laki-laki (`gender: "male"`). Website memutar file itu, bukan suara perangkat lagi (suara perangkat tetap jadi cadangan bila file tidak ada). Rekaman penutur asli berlisensi bebas tampil sebagai tombol tambahan "Dengar penutur asli".

## Latar teknis (penting)
- Model TTS/Whisper **tidak bisa diunduh di sesi kerja** → audio dibuat di **GitHub Actions** dan di-commit balik (pola `tts-samples.yml` + `scripts/tts/make_samples.py`; pakai ulang fungsinya — impor atau salin bersih — tetapi **jangan ubah perilaku** `tts-samples.yml`, `make_samples.py`, atau `public/audio/samples/**`).
- Kerjakan di cabang **`task-4b`** (dari `main` terbaru). Workflow jalan otomatis saat push ke cabang selain `main`, commit audio balik ke cabang itu. Sesi utama nanti menggabung ke `main` sebagai satu commit. Jangan force-push, jangan hapus riwayat, jangan tulis token/kunci.
- Pantau workflow dengan `gh api` (REST): `repos/Journeyhendry/chineseforeveryone/actions/runs?branch=task-4b`, `.../runs/{id}/jobs`, `.../jobs/{id}/logs`. `gh run` dan GraphQL **tidak tersedia**.
- **Jangan ubah apa pun di `scripts/tts/`**: setiap push yang menyentuh `scripts/tts/**` memicu `tts-samples.yml` dan membuat ulang contoh suara. Semua skrip baru masuk `scripts/tts-hsk1/` (requirements sendiri: salin versi dari `scripts/tts/requirements.txt` + `pypinyin` dipatok); impor dari `scripts/tts/make_samples.py` boleh (baca saja).
- **Sesi lain sedang mengerjakan task 0** (cabang `task-0`, file `data/basics/**`, `scripts/tts-basics/**`, `basics-audio.yml`, layar Tahap 0). Jangan sentuh file itu. Task 0 boleh menambah pemutar file di `src/lib/audio.ts`; jaga perubahanmu di `audio.ts` tetap rapi dan API lamanya (`audioAvailable`, `speak`, `stopAudio`, `onAudioChange`, `waitForAudio`, `SLOW_RATE`, `AUDIO_SOURCE`) tetap ada supaya penggabungan mudah.

## Scope

### A. Daftar teks (`scripts/tts-hsk1/hsk1_items.py` atau `.ts`, hasil di `data/hsk1/audio-items.json`)
Dibuat ulang otomatis dari data, deterministik (urutan stabil, tanpa waktu):
- `word` — 300 kata `data/hsk1/words.json` (teks = `hanzi`), plus versi **pelan** (`word-slow`, speed 0.75) untuk tiap kata.
- `sentence` — semua kalimat `data/hsk1/sentences.json` (teks = `cmn`, id = `tatoebaId`).
- `casual` — 72 ungkapan `data/hsk1/casual.json` (teks = `hanzi`) + versi pelan.
- `dialog` — tiap baris `data/hsk1/dialogs.json` (id = `<dialogId>-<nomor baris>`, suara P3 atau L3 menurut `gender`).
- Tiap item: `{ key, kind, text, voice: "P3"|"L3", speed, pinyin?, sourceId }`, dengan `key` aman untuk nama file. `hash` = sha1(teks + suara + speed + versi pengaturan) untuk **lewati item yang tidak berubah** (jangan buat ulang file yang sama → repo tidak membengkak).

### B. Pembuatan audio (`scripts/tts-hsk1/build_audio.py`) + workflow `.github/workflows/build-audio.yml`
- Format sama dengan contoh suara: mp3 mono **64 kbps**, sample rate sama untuk semua, `loudnorm` −16 LUFS (puncak ≤ −1.5 dBTP), sunyi awal/akhir dipangkas lalu jeda ±0.15 dtk. Revisi model & versi paket dipatok (sama dengan `scripts/tts/requirements.txt` / `voices.json`).
- **Cek Whisper** (`faster-whisper` small, zh, CPU int8, opencc t2s), tanda baca & spasi dibuang:
  - multi-huruf: transkrip = teks (boleh beda hanya karena huruf yang bunyinya sama persis menurut `pypinyin` bernada — catat sebagai `homophone`);
  - satu huruf: cocokkan pinyin bernada transkrip (`pypinyin`, versi dipatok) dengan pinyin kata.
  - Gagal → buat ulang dengan variasi (mis. speed 0.9, tambah "。", bingkai pendek lalu dipotong — pilih yang masuk akal, catat), maks 3 percobaan. Tetap gagal → file terbaik tetap disimpan, ditandai `ok:false`, dan dicatat di `data/hsk1/audio-issues.json` (key, teks, transkrip, percobaan).
- Keluaran `public/audio/hsk1/<kind>/<key>.mp3` + `public/audio/hsk1/manifest.json`: `{ version, voices:{P3:{model, modelRevision, voiceId}, L3:{…}}, whisper:{model, passed, total, byKind:{…}}, files:{ <key>: { path, kind, text, voice, speed, durationSec, transcript, ok, attempts, hash } } }`. Tanpa `generatedAt` yang berubah tiap jalan bila tidak ada file yang berubah.
- Workflow: `workflow_dispatch` + `push` ke cabang selain `main` bila `scripts/tts-hsk1/build_audio.py`, `scripts/tts-hsk1/hsk1_items.*`, `data/hsk1/{words,sentences,casual,dialogs}.json`, atau workflow itu berubah. `permissions: contents: write`, `concurrency`, cache pip + Hugging Face. Total kira-kira 2.300 file: kalau satu job terlalu lama, bagi jadi beberapa job (matrix shard) lalu satu job penggabung; `timeout-minutes` tiap job ≤ 120. Commit balik hanya `public/audio/hsk1/**`, `public/audio/native/**`, `data/hsk1/audio-issues.json`, `data/hsk1/native-audio.json` dengan pesan `Data: HSK 1 audio (P3/L3)` (`git pull --rebase` lalu push).

### C. Rekaman penutur asli (di workflow yang sama atau workflow terpisah `native-audio.yml`)
- **Lingua Libre / Wikimedia Commons** untuk kata: cari file pelafalan Mandarin (mis. kategori `Lingua Libre pronunciation-cmn`, nama `LL-Q9192 (cmn)-<user>-<kata>.wav`) lewat API Commons; ambil hanya lisensi CC0 / CC BY / CC BY-SA, simpan penulis, lisensi, URL halaman file. Ubah ke mp3 64 kbps + loudnorm. Maks 1–2 rekaman per kata.
- **Tatoeba** untuk kalimat: hanya rekaman yang di `sentences.json` berlisensi bebas (CC0 / CC BY / CC BY-SA). Catatan: data sekarang hanya punya lisensi kosong (58) dan CC BY-NC 4.0 (28) → **keduanya tidak dipakai**; catat jumlahnya. Jangan unduh rekaman berlisensi kosong/NC.
- Tone Perfect **tidak** dipakai (belum ada izin).
- Keluaran `public/audio/native/...mp3` + `data/hsk1/native-audio.json` (`{ <wordId|tatoebaId>: [{ path, author, license, sourceUrl }] }`). Tidak ada rekaman sama sekali untuk suatu kata = wajar, tombolnya tidak tampil.

### D. Website
- `src/lib/audio.ts`: putar file mp3 lewat `HTMLAudioElement`; peta teks → file dimuat **malas** (fetch `audio/hsk1/manifest.json` atau indeks ringkas turunan saat suara pertama diminta, bukan di bundel awal). `speak(text, opts)` tetap jalan untuk semua pemanggil lama; tambah opsi untuk dialog (mis. `{ key }` atau `{ voice: 'male' }`) dan untuk versi pelan (pakai file `-slow` bila ada, kalau tidak `playbackRate` dengan `preservesPitch`). Kecepatan pengaturan (`voiceSpeed` 0.75/1) tetap dihormati. Hanya satu suara berbunyi pada satu waktu. Teks tanpa file → suara perangkat (perilaku lama) dan catatan "suara sementara dari perangkat" hanya tampil saat itu terjadi. `AUDIO_SOURCE` menjadi `'files'` bila manifest ada.
- Tombol suara untuk baris dialog memakai suara yang benar (L3 untuk tokoh laki-laki).
- Tombol kecil **"Dengar penutur asli" / "Hear a native speaker"** di kenalan kata (dan kalimat contoh bila ada rekaman), dengan nama penulis + lisensi kecil (atau tooltip/teks di bawahnya). Teks dari `src/i18n/{id,en}.json`.
- Layar latihan "dengar → huruf" memakai file juga; bila tidak ada file dan tidak ada suara perangkat, perilaku lama (soal diganti) tetap.
- Tidak menambah warna hex baru di luar token.

### E. Tes (vitest) + cek data
- `audio-items.json` cocok dengan data (setiap kata/kalimat/ungkapan/baris dialog ada tepat satu item utama; baris laki-laki → L3, lainnya P3); key unik & aman.
- Bila `manifest.json` ada: setiap item punya file di disk > 1 KB **atau** tercatat di `audio-issues.json`; `hash` cocok dengan item sekarang (audio tidak basi).
- `native-audio.json`: tiap entri punya penulis, lisensi dari daftar yang diizinkan, sourceUrl, file ada.
- `audio.ts`: peta teks → file, pilihan suara dialog, cadangan ke suara perangkat (mock `Audio` / `speechSynthesis`).
- Tambahkan cek basi ke `npm run check:data` bila cocok (data berubah tanpa audio dibuat ulang → gagal dengan pesan jelas).

### F. CREDITS.md
Bagian audio: Kokoro-82M v1.1-zh (Apache-2.0, hexgrad) untuk P3/L3; faster-whisper/Whisper (MIT) + pypinyin (MIT) hanya untuk cek; rekaman Lingua Libre/Commons per penulis + lisensi (boleh merujuk ke `native-audio.json` + halaman Sumber nanti); catat Tatoeba audio tidak dipakai karena lisensinya tidak bebas.

## Out of scope
- Audio Tahap 0 (task 0), contoh suara 4a, Tone Perfect.
- Mengubah teks data HSK 1 (kata, kalimat, dialog, ungkapan), pinyin dialog (`yī gè`), adegan, tokoh.
- Mengubah BUILD_PLAN bagian 1. Halaman Sumber/kamus (task 9). Game (task 7).

## Acceptance criteria
1. `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run check:data` lolos.
2. Workflow sukses di cabang `task-4b` dan commit audio balik. Menjalankan ulang tanpa perubahan data **tidak** membuat commit baru (atau hanya tanpa file mp3 berubah).
3. Setiap kata (300 + pelan), kalimat, ungkapan (+ pelan), dan baris dialog punya mp3 suara yang benar; semua mono 64 kbps, sample rate sama (ffprobe); kenyaringan rata (selisih LUFS antar file sampel acak ≥ 50 file ≤ 2 dB); durasi wajar (kata 0.3–3 dtk; kalimat ≤ 12 dtk).
4. Tingkat lolos Whisper tercatat per jenis di manifest; **≥ 95 % kata** dan **≥ 90 % keseluruhan** lolos; sisanya di `audio-issues.json`.
5. Playwright (1366 & 375, terang & gelap): di kenalan kata, tombol suara memutar file `audio/hsk1/...mp3` (cek permintaan jaringan), tidak ada error konsol, catatan "suara perangkat" tidak tampil untuk kata yang punya file, tanpa scroll ke samping; tombol dialog memutar file L3 untuk baris laki-laki; tombol "Dengar penutur asli" tampil hanya bila ada rekaman. axe tanpa pelanggaran serius.
6. Ukuran: total `public/audio/hsk1/` + `public/audio/native/` dicatat (perkiraan ≤ 60 MB); muatan awal halaman tidak bertambah lebih dari 10 KB (manifest dimuat malas).
7. Atribusi rekaman asli lengkap. Tidak ada token/kunci di repo. Tidak ada file di luar daftar "File" yang berubah.

## File
- Baru: `scripts/tts-hsk1/hsk1_items.*`, `scripts/tts-hsk1/build_audio.py`, (opsional) `scripts/tts-hsk1/native_audio.py`, `scripts/tts-hsk1/requirements.txt`, `.github/workflows/build-audio.yml` (+ opsional `native-audio.yml`), `data/hsk1/audio-items.json`, `data/hsk1/audio-issues.json`, `data/hsk1/native-audio.json`, `public/audio/hsk1/**`, `public/audio/native/**`, tes di `src/lib/*.test.ts`.
- Diubah: `src/lib/audio.ts`, `src/pages/learn/hooks.ts`, `src/pages/learn/parts.tsx` (+ layar kenalan kata/dialog yang memakai tombol suara), `src/i18n/{id,en}.json`, `scripts/check-data.ts`, `package.json` (skrip), `CREDITS.md`, `docs/tasks/task-4b.md` (catatan temuan saja).
