# Task 4a · Contoh suara untuk dipilih pemilik

Model: Sonnet (implementasi), sesi utama Opus memeriksa. Prasyarat: task 3b (selesai).

## Tujuan
Pemilik bisa membuka satu halaman di website, mendengar beberapa kandidat suara TTS open source membaca kata dan kalimat HSK 1 yang sama, lalu memilih 1 suara utama perempuan + 1 suara laki-laki (keputusan BUILD_PLAN bagian 1 "Suara (pilihan B)"). Task 4b nanti memakai pilihan itu untuk semua audio.

## Latar teknis (penting)
- Model TTS dan Whisper **tidak bisa diunduh di sesi kerja** (huggingface.co diblokir). Semua pembuatan audio jalan di **GitHub Actions**, hasilnya di-commit balik (BUILD_PLAN bagian 1 "Hosting & data besar").
- Implementasi dikerjakan di cabang `task-4a` (bukan `main`). Workflow jalan otomatis saat push ke cabang selain `main`, sehingga bisa dicoba berulang tanpa mengotori `main`. Setelah lolos, sesi utama menggabung cabang ke `main` sebagai satu commit.
- Jangan force-push, jangan hapus riwayat, jangan menulis token/kunci ke repo.

## Scope
1. **Teks contoh** `scripts/tts/samples.json` (ditulis tangan, dicek tes):
   - 5 kata dari `data/hsk1/words.json` (pakai `wordId` + `hanzi`): `你好` (nada 3+3, perubahan nada), `谢谢` (nada 4 + ringan), `妈妈` (nada 1 + ringan), `学校` (nada 2+4), `喝水` (nada 1+3).
   - 2 kalimat: 1 kalimat Tatoeba dari `data/hsk1/sentences.json` (pendek, 6–12 huruf, simpan id Tatoeba + penulis) dan 1 baris dialog dari `data/hsk1/dialogs.json` (simpan id dialog + nomor baris), keduanya hanya huruf Mandarin + tanda baca.
   - Tiap item: `{ id, kind: "word"|"sentence", hanzi, pinyin, source }`.
2. **Kandidat suara** (didefinisikan di satu tempat, mis. `scripts/tts/voices.json`; tiap suara punya kode pendek untuk pemilik: `P1…P4` perempuan, `L1…L3` laki-laki):
   - Perempuan (4): Kokoro-82M v1.0 `zf_xiaoxiao`, `zf_xiaoyi`; Kokoro-82M-v1.1-zh 1 suara perempuan (pilih dari daftar file `voices/` repo `hexgrad/Kokoro-82M-v1.1-zh`); MeloTTS `ZH`.
   - Laki-laki (3): Kokoro v1.0 `zm_yunxi`, `zm_yunjian`; Kokoro v1.1-zh 1 suara laki-laki.
   - Kalau MeloTTS gagal dipasang di runner, workflow tetap sukses: suara itu ditandai `skipped` + alasan di manifest, dan diganti satu suara perempuan Kokoro lain (mis. `zf_xiaobei`) supaya tetap ada ≥ 3 kandidat perempuan.
   - Versi paket & model dipatok (pip `==`, revisi/commit Hugging Face bila bisa) di `scripts/tts/requirements.txt` / skrip.
3. **Skrip** `scripts/tts/make_samples.py` (Python 3.11/3.12): baca `samples.json` + `voices.json`, buat audio tiap suara × item, lalu:
   - Format seragam: mp3 mono, 64 kbps, 24 kHz atau 44.1 kHz (sama untuk semua), volume dinormalisasi (ffmpeg `loudnorm` ke −16 LUFS, puncak ≤ −1.5 dBTP), sunyi di awal/akhir dipangkas lalu diberi jeda ±0.15 dtk. Kecepatan bawaan model (speed 1.0) untuk semua.
   - Cek Whisper (`faster-whisper`, model `small`, bahasa `zh`, CPU int8): transkrip dinormalisasi (buang tanda baca/spasi, tradisional→sederhana dengan `opencc`) dibandingkan dengan hanzi. Catat `transcript` dan `whisperOk` per file. Gagal Whisper **tidak** menggagalkan workflow (ini informasi untuk pemilik).
   - Tulis `public/audio/samples/<voiceCode>/<itemId>.mp3` dan `public/audio/samples/manifest.json`: `{ version: 1, generatedAt, items: [...], voices: [{ code, gender, engine, model, modelRevision, voiceId, license, status: "ok"|"skipped", reason? , files: { <itemId>: { path, durationSec, transcript, whisperOk } } }], whisper: { model, passed, total } }`. Path relatif terhadap `public/audio/samples/`.
4. **Workflow** `.github/workflows/tts-samples.yml`:
   - Pemicu: `workflow_dispatch` + `push` ke cabang selain `main` (`branches-ignore: [main]`) bila file di `scripts/tts/**` atau workflow itu sendiri berubah.
   - `permissions: contents: write`, `concurrency` per cabang, `timeout-minutes` ≤ 60, cache pip + cache model Hugging Face (`actions/cache`).
   - Pasang ffmpeg + espeak-ng bila perlu, Python, paket dari `requirements.txt`; jalankan skrip; commit balik hanya `public/audio/samples/**` dengan pesan `Data: TTS voice samples` ke cabang yang sama (pola sama dengan `casual-evidence.yml`: `git pull --rebase` lalu push).
5. **Halaman dengar** `public/samples.html` (tampil di `https://journeyhendry.github.io/chineseforeveryone/samples.html`):
   - Satu file HTML statis berdiri sendiri (CSS + JS inline, tanpa library luar, font boleh dari Google Fonts: Baloo 2, Nunito, Noto Sans SC), membaca `audio/samples/manifest.json` dengan `fetch` relatif.
   - Gaya sesuai BUILD_PLAN bagian 1 (latar #FFF7E8, garis #231942, kartu bersudut membulat dengan bayangan tebal, ungu/kuning/hijau/jingga). Pinyin diwarnai warna nada + tanda nada.
   - Isi berbahasa Indonesia (singkat, awam), dengan baris Inggris kecil: penjelasan cara memilih ("Dengarkan, lalu balas dengan kode suara, mis. P2 + L1"), dua bagian (Suara perempuan / Suara laki-laki), tiap suara satu kartu: kode besar, nama mesin + lisensi kecil, tombol putar untuk tiap item (hanzi + pinyin), tombol "Putar semua" berurutan, tanda kecil hasil cek Whisper (✓ cocok / ⚠ beda + transkrip). Suara `skipped` ditampilkan abu-abu dengan alasannya.
   - Bisa dipakai dengan keyboard (tombol `<button>`, fokus terlihat), hanya satu audio berbunyi pada satu waktu, tidak ada scroll ke samping di lebar 375 px, ada pesan ramah bila manifest belum ada.
6. **Tes** `src/lib/tts-samples.test.ts` (vitest): `samples.json` cocok dengan data (wordId ↔ hanzi di `words.json`, id kalimat/dialog ada dan hanzi sama); `voices.json` punya ≥ 3 perempuan + ≥ 2 laki-laki dengan kode unik; bila `manifest.json` ada: setiap suara `ok` punya file untuk setiap item dan file mp3-nya ada di disk dan > 1 KB.
7. **CREDITS.md**: bagian audio — Kokoro-82M (Apache-2.0, hexgrad), MeloTTS (MIT, MyShell.ai) bila dipakai, faster-whisper/Whisper (MIT) hanya untuk cek; catat bahwa contoh suara dibuat otomatis oleh `tts-samples.yml`.

## Out of scope
- Audio untuk semua materi (4b), rekaman penutur asli, Tone Perfect.
- Komponen React / tombol suara di aplikasi (task 6). Mengubah `index.html`, `src/` selain file tes, atau data di `data/hsk1/`.
- Memilih suara (itu keputusan pemilik). Mengubah BUILD_PLAN bagian 1.

## Acceptance criteria
1. `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` lolos; `dist/samples.html` dan `dist/audio/samples/manifest.json` ada.
2. Workflow `tts-samples.yml` sukses di cabang `task-4a` dan commit audio balik; YAML valid.
3. Manifest: ≥ 3 suara perempuan + ≥ 2 laki-laki berstatus `ok`, masing-masing 7 file; semua mp3 mono, 64 kbps, sample rate sama (cek `ffprobe`); kenyaringan rata (selisih LUFS antar file ≤ 2 dB, cek `ffmpeg -af ebur128`); durasi wajar (kata 0.4–3 dtk, kalimat ≤ 8 dtk).
4. Hasil Whisper tercatat untuk semua file; tingkat lolos per suara tampil di halaman.
5. `samples.html` dirender (Playwright, lebar 1366 dan 375): tidak ada error konsol, tanpa scroll ke samping, semua tombol ada, teks Indonesia jelas.
6. Total ukuran `public/audio/samples/` ≤ 3 MB. Tidak ada token/kunci di repo.
7. Tidak ada file di luar daftar "File" yang berubah.

## File
- Baru: `scripts/tts/samples.json`, `scripts/tts/voices.json`, `scripts/tts/make_samples.py`, `scripts/tts/requirements.txt`, `.github/workflows/tts-samples.yml`, `public/samples.html`, `public/audio/samples/**` (dibuat workflow), `src/lib/tts-samples.test.ts`.
- Diubah: `CREDITS.md`, `docs/tasks/task-4a.md` (file ini, hanya bila ada catatan temuan).
