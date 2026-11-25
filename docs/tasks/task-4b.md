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

---

## Ronde 2 (diambil alih 2026-11-23, kunci lama basi)

Status saat diambil alih: skrip, workflow, pemutar website, tes sudah ada di cabang `task-4b`; 2.448 mp3 sudah dibuat (35 MB). **Belum lolos:**
- **Acceptance 4**: Whisper `small` hanya 1.871/2.448 (76 %) lolos; kata 202/300 (67 %), kata pelan 39/300 (13 %), ungkapan 44/72, ungkapan pelan 14/72, dialog 103/125, kalimat 1.469/1.579. Dari contoh di `audio-issues.json`, banyak gagal karena **cek-nya yang lemah**, bukan suaranya: 儿 dibuang Whisper (那儿 → 那), 他/她/它, 姐姐 → 姊姊, sisa kalimat pembawa ("这个词是") ikut terbaca (白天 → 五白天, 病 → 得病, 半 → 一半), kalimat pembawa kecepatan 1.0 ditempel ke kata pelan 0.75 (吧/八/爸爸 pelan → "明白"), suku kata tunggal jadi kata Inggris ("Bye"). Sebagian mungkin memang salah ucap (吃 → 知, 出租车 → 出租撤, 打电话 → 戴电话) — itu harus tetap terdeteksi.
- **Rekaman penutur asli**: job `native` habis waktu (60 menit) dan dibatalkan → `data/hsk1/native-audio.json` dan `public/audio/native/` belum ada.
- `scripts/tts-hsk1/__pycache__/*.pyc` ikut ter-commit (harus dihapus + `.gitignore`).

Perbaikan yang diminta (jujur — **jangan melonggarkan cek sampai semua lolos**; salah ucap sungguhan harus tetap gagal):
1. **Whisper lebih kuat**: faster-whisper `large-v3` CPU int8, `language="zh"`, beam 5, `condition_on_previous_text=False`, `initial_prompt` netral berhuruf sederhana yang tidak memuat huruf target. Patok versi; cache model HF di Actions. Manifest mencatat model yang benar.
2. **Normalisasi** (dengan tes unit Python, jalan di CI workflow sebelum build): t2s untuk teks & transkrip; tanda baca/spasi dibuang; angka Arab (sudah ada); **儿化**: lolos `erhua` bila sama setelah 儿 penanda erhua dibuang di kedua sisi (bukan 儿 di 儿子/女儿); homofon bernada (他/她/它) tetap `homophone`.
3. **Kalimat pembawa** untuk item pendek: disintesis dengan **suara dan kecepatan yang sama** dengan item; transkrip lolos bila bagian akhirnya (sepanjang target) = target, atau pinyin bernadanya = pinyin target. Juga transkripsi tanpa pembawa; lolos bila salah satu lolos. Catat cara yang lolos.
4. **Suku kata tunggal** (kata 1 huruf + versi pelan): dua bagian — (a) bunyi: salah satu bacaan transkrip (pypinyin heteronym, tanpa nada) = suku kata target tanpa nada; (b) nada: kontur F0 (praat-parselmouth atau librosa pyin, versi dipatok) diklasifikasi ke nada 1–4 dengan aturan sederhana yang tertulis di skrip + tes. Lolos bila (a) dan (b) lolos, atau transkrip cocok tepat pinyin bernada. Huruf bernada ringan (吧 吗 呢 的 了 …) hanya dicek bunyinya. Boleh meniru gagasan `scripts/tts-basics/tonecheck.py` di cabang `task-0`, tetapi **salin ke `scripts/tts-hsk1/`**, jangan sentuh file task 0.
5. **Mode cek ulang** (`recheck`, input workflow + default saat skrip pengecek berubah): file yang `hash`-nya sama tidak disintesis ulang, cukup dicek ulang; yang tetap gagal → sintesis ulang dengan variasi yang ada (maks 3 percobaan). Manifest per file: transkrip, cara lolos / alasan gagal, nada terdeteksi (bila ada). mp3 yang tidak disintesis ulang tidak boleh berubah bytenya.
6. **Rekaman penutur asli**: job terpisah dengan batas waktu wajar, permintaan API Commons berkelompok (mis. `prefix`/`list=categorymembers` sekali jalan, bukan satu permintaan per kata), tidak memblokir job audio. Hasil `native-audio.json` selalu ditulis (boleh `{}` bila sumber tidak bisa dihubungi, dengan catatan alasan). Tatoeba audio tetap tidak dipakai (lisensi kosong/NC).
7. Target tetap: **kata (300, kecepatan normal) ≥ 95 %**, **keseluruhan ≥ 90 %**; sisanya di `audio-issues.json` dengan alasan.

## Ronde 3 (2026-11-23, Opus — naik tingkat setelah 2 ronde Sonnet)

Status saat diambil alih (setelah `main` digabung, termasuk task 9):
- Keseluruhan **2.266/2.448 (92,6 %)** — sudah lolos target 90 %.
- **Kata (300, normal) 259/300 (86,3 %)** — target ≥ 95 % (≥ 285) **belum lolos**. Kata pelan 246/300, ungkapan 57/72, ungkapan pelan 50/72, dialog 114/125, kalimat 1.540/1.579.
- `npm test` gagal 2: (a) target Whisper di atas; (b) `src/styles/fonts.test.ts` — transkrip Whisper di `data/hsk1/audio-issues.json` (mis. 导演, 录音) dianggap huruf yang tampil di website.
- Rekaman penutur asli: job jalan, tetapi hasilnya **0 kata** (`public/audio/native/status.json`). Hampir pasti cara pencariannya yang salah (Lingua Libre punya banyak rekaman `LL-Q9192 (cmn)-…`), bukan memang tidak ada.

Pola kegagalan 41 kata (lihat manifest): (1) **halusinasi Whisper pada klip sangat pendek** (他 → 太阳, 二 → 录音, 要 → 以后, 到 → 导演, 那儿 → "No.") — cek-nya yang lemah; (2) **nada suku kata tunggal salah dari P3** (水 → 睡, 想 → 像, 小 → 笑, 新 → 信, 口 → 扣, 爱 nada 3) — suaranya yang salah, sama dengan temuan task 0 (P3 sering membaca suku kata tunggal dengan nada turun); (3) sebagian kata 2 huruf mungkin salah ucap sungguhan (早上 → 走上, 晚饭 → 吻饭, 起床 → 气床, 时间 → 实践, 星期 → 兴趣, 下雨 → 笑语).

Perbaikan yang diminta (tetap jujur: salah ucap sungguhan harus tetap gagal; jangan melonggarkan aturan cocok):
1. **Tes font**: file data yang tidak tampil di website (`audio-issues.json`, dan file audio/cek lain sejenis) dikeluarkan dari pemindaian di `fonts.test.ts` (daftar pengecualian eksplisit + komentar alasan). Jangan menambah huruf transkrip ke font.
2. **Cek klip pendek lebih tahan halusinasi**: tambah cara cek "x3" — klip yang sama diulang 3 kali dengan jeda ±0,4 dtk (dan/atau diberi sunyi di depan-belakang) lalu ditranskripsi; lolos hanya bila transkrip = target diulang (multi-huruf: hanzi sama/homofon/erhua seperti aturan yang ada; suku kata tunggal: pinyin bernada tepat, atau bunyi + nada F0 lolos). Boleh meniru gagasan cek x3 di cabang `task-0` (`scripts/tts-basics/basics.py`), **salin**, jangan sentuh file task 0. Catat `via: "x3"` di manifest; naikkan versi cek.
3. **Betulkan nada suku kata tunggal** (suara tetap P3, hanya nadanya diluruskan): untuk item 1 suku kata yang **bunyinya lolos tetapi nadanya salah**, ganti kontur nada dengan kontur baku nada target (PSOLA lewat `parselmouth` Manipulation, versi dipatok) di rentang suara P3 sendiri (median & rentang F0 dari file P3 yang lolos); durasi tidak berubah, perpindahan halus. Lalu cek ulang penuh (Whisper + F0). Hasilnya ditandai `pitchFixed: true` di manifest, dicatat di `audio-issues.json`/catatan bila tetap gagal. Bila cara ini membuat suara terdengar rusak (cek: Whisper tetap mengenali bunyinya, tidak ada klik/derau — periksa spektrogram beberapa contoh), jangan dipakai. Berlaku juga untuk versi pelan.
4. **Kata multi-huruf yang salah ucap**: cek dulu keluaran G2P (misaki) untuk kata yang gagal; bila G2P salah, beri masukan fonem/bopomofo yang benar langsung ke Kokoro (daftar koreksi tertulis, dengan tes). Bila G2P benar, coba variasi sintesis (speed 0.9, tanda baca, bingkai lalu dipotong). Tetap gagal → biarkan gagal dan tercatat.
5. **Rekaman penutur asli**: cari tahu kenapa 0 (cek nama kategori/pola nama file Lingua Libre untuk Mandarin, mis. `Category:Lingua Libre pronunciation-cmn` dan `LL-Q9192 (cmn)-<user>-<kata>.wav`, juga log job), perbaiki, ambil hanya CC0 / CC BY / CC BY-SA dengan penulis + URL. Kalau sumber memang tidak bisa dihubungi dari Actions, catat alasan jelas di `status.json`.
6. Hanya item yang gagal yang diproses ulang; mp3 yang sudah lolos tidak boleh berubah bytenya.
7. Target tetap: kata normal ≥ 95 %, keseluruhan ≥ 90 %. Semua acceptance 1–7 di atas tetap berlaku.

## Ronde 3 — hasil (2026-11-25)

- `main` terbaru sudah digabung ke `task-4b` (gabung biasa, tanpa menulis ulang riwayat).
- **Cek suara (Whisper large-v3, cek versi 5)**: kata 288/300 (96 %, target 95 % lolos), keseluruhan 2.357/2.448 (96,3 %, target 90 % lolos). Kata pelan 275/300, kalimat 1.552/1.579, ungkapan 65/72, ungkapan pelan 60/72, dialog 117/125. 6 suku kata tunggal nadanya diluruskan. Sisa 91 tercatat di `audio-issues.json`.
- **Rekaman penutur asli: 190 kata, 280 rekaman** (100 kata 1 rekaman, 90 kata 2 rekaman; CC BY-SA 4.0: 202, CC0: 78; 0 ditolak lisensinya). Penyebab 0 sebelumnya: Wikimedia menolak (HTTP 429) program yang tidak menyebut "identitas + alamat kontak". Sekarang program memperkenalkan diri dengan alamat repo, mengunduh satu per satu dengan jeda, menunggu bila diminta, dan melanjutkan dari yang sudah ada. Jalan ini: 0 penolakan. 110 kata memang tidak punya rekaman di Lingua Libre → tombolnya tidak tampil.
- Rekaman penutur asli sekarang punya workflow sendiri (`native-audio.yml`), jadi tidak memicu atau menahan pembuatan suara utama; mp3 suara utama tidak berubah. Jalan ulang tanpa rekaman baru tidak membuat commit.
- Pemeriksaan: `npm ci`, typecheck, lint, test (1.246 tes), build, check:data lolos. Semua 2.448 + 280 mp3 mono 64 kbps 24 kHz. Kenyaringan 60 file acak: −16,2 s/d −16,0 LUFS (selisih 0,2 dB). Durasi: kata 0,58–1,63 dtk, kata pelan 0,67–1,68, kalimat 1,13–4,85, dialog 0,70–3,67. Ukuran audio 30,3 MB + 2,7 MB. Muatan awal halaman naik 1,7 KB (gzip) dibanding `main`.
- Playwright (1366 & 375 px, terang & gelap): tombol suara kata memutar `audio/hsk1/word/...mp3`, tanpa catatan "suara perangkat", tanpa scroll ke samping, tanpa error konsol (selain Google Fonts yang diblokir jaringan sesi kerja); baris laki-laki di dialog memutar file L3; tombol "Dengar penutur asli" hanya tampil untuk kata yang punya rekaman; axe tanpa pelanggaran serius/kritis.
- Tes font: `native-audio.json` dikecualikan (huruf Han hanya di nama perekam yang tampil dengan font teks biasa, dan di tautan sumber).
- Temuan kecil (belum diubah, supaya suara utama tidak dibuat ulang): kata 哪些 (normal + pelan) selalu masuk daftar "cek ulang" karena tanda koreksi bacaan tidak tersimpan di manifest; bila workflow suara utama jalan lagi, file 哪些 bisa dibuat ulang.
