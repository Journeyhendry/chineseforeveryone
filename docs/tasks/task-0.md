# Task 0 · Tahap 0 "Dasar sebelum HSK 1"

Model: Opus (implementasi), sesi utama Opus memeriksa. Prasyarat: 2b, 6 (selesai).

## Tujuan
Murid yang belum pernah belajar Mandarin bisa mulai dari nol: mengenal bunyi pinyin, 4 nada + nada ringan, perubahan nada, coretan dasar & urutannya, radikal yang sering muncul, lalu ungkapan kelas (angka 1–10, salam). Tahap 0 tampil di peta belajar **sebelum unit 1**, gaya dan komponennya sama dengan unit lain, **tidak terkunci** dan **tidak mengunci** HSK 1 (BUILD_PLAN bagian 1 + task 0 di bagian 4).

## Latar teknis (penting)
- Suara Tahap 0 memakai **P3** = Kokoro-82M v1.1-zh, `zf_001` (lihat `scripts/tts/voices.json`, revisi model yang sama). Model TTS/Whisper **tidak bisa diunduh di sesi kerja** → audio dibuat di **GitHub Actions** dan di-commit balik (pola sama dengan `tts-samples.yml` / `scripts/tts/make_samples.py`; pakai ulang fungsinya bila bisa, jangan ubah perilaku workflow 4a).
- Kerjakan di cabang **`task-0`** (dari `main` terbaru). Workflow audio jalan otomatis saat push ke cabang selain `main`, commit audio balik ke cabang itu. Sesi utama nanti menggabung ke `main` sebagai satu commit. Jangan force-push, jangan hapus riwayat, jangan tulis token/kunci.
- Pakai `gh api` (REST) untuk memantau workflow (`repos/Journeyhendry/chineseforeveryone/actions/runs?branch=task-0`, jobs, logs). `gh run` dan GraphQL tidak tersedia.
- Bahasa, token warna, komponen: ikuti yang sudah ada (`src/styles/theme.css`, `src/pages/learn/*`, `src/i18n/{id,en}.json`, `useT`). Jangan tambah hex baru di luar token kecuali warna nada yang sudah ada.

## Scope

### A. Data `data/basics/basics.json` (ditulis tangan, dicek tes)
Satu file sumber untuk semua isi Tahap 0 (teks ID + EN untuk setiap penjelasan). Setiap item yang bersuara punya `audioId` (aman untuk nama file, unik), `hanzi` (teks yang dibacakan TTS), `pinyin` (bertanda nada, target bunyi).
1. **Pinyin**: tabel bunyi awal (23: b p m f d t n l g k h j q x zh ch sh r z c s y w) dan bunyi akhir (minimal 24: a o e i u ü ai ei ui ao ou iu ie üe er an en in un ün ang eng ing ong). Tiap bunyi dibacakan dengan satu huruf contoh yang lazim dipakai guru (mis. b → 波 bō, zh → 知 zhī, a → 啊 ā); catat catatan pelafalan singkat ID/EN untuk bunyi sulit (zh/ch/sh/r, z/c/s, j/q/x, ü, e, -n/-ng).
2. **Nada**: 4 nada + nada ringan, masing-masing: nama, bentuk garis nada (untuk digambar SVG), warna nada tetap (BUILD_PLAN bagian 1), tanda nada, penjelasan singkat. Minimal 4 set suku kata 4 nada untuk latihan dengar (mis. mā má mǎ mà = 妈 麻 马 骂; bā bá bǎ bà = 八 拔 把 爸; plus 2 set lain), dan contoh nada ringan dalam kata (妈妈, 好吗 / 吗, 谢谢…).
3. **Perubahan nada**: 3+3 (你好 ní hǎo, 很好, 可以…), 不 (不是 bú shì vs 不好 bù hǎo, 不对 …), 一 (一 yī, 一天 yì tiān, 一个 yí gè, 一样…). Tiap contoh: hanzi, pinyin dasar (per huruf), pinyin yang diucapkan, penjelasan aturan. Utamakan kata dari 300 kata HSK 1.
4. **Coretan**: 8 coretan dasar (点 横 竖 撇 捺 提 折 钩): nama pinyin + arti ID/EN, contoh huruf (utamakan huruf HSK 1), dan aturan urutan coretan (minimal 7: 先横后竖 十, 先撇后捺 人/八, 从上到下, 从左到右, 从外到内, 先里头后封口 回/国, 先中间后两边 小/水) dengan huruf contoh.
5. **Radikal**: minimal 10 radikal yang sering muncul (亻 口 女 氵 木 日 扌 讠 忄/心 艹 宀 …) dengan arti ID/EN dan 2–4 huruf contoh **dari kata HSK 1** (cek otomatis), plus minimal 5 contoh "cara huruf tersusun" (mis. 好 = 女 + 子, 明 = 日 + 月, 休 = 亻 + 木, 们 = 亻 + 门 …) dengan posisi (kiri-kanan / atas-bawah / luar-dalam).
6. **Ungkapan kelas**: angka 1–10 (一 … 十) dan salam dasar (你好, 您好, 谢谢, 不客气, 对不起, 没关系, 再见, 老师好 …) — hanya kata HSK 1 (cek otomatis), arti ID/EN.

### B. Audio P3 (workflow)
- `scripts/tts/basics.py` (atau perluasan bersih dari `make_samples.py`): ambil semua item bersuara dari `data/basics/basics.json`, sintesis dengan P3 (speed 1.0), format sama dengan contoh suara (mp3 mono 64 kbps, sample rate seragam, loudnorm −16 LUFS, pangkas sunyi + jeda ±0.15 dtk).
- **Cek otomatis**: Whisper (`faster-whisper` small, zh, CPU int8) + opencc t2s. Untuk kata/kalimat multi-huruf: transkrip (tanpa tanda baca) = hanzi. Untuk **suku kata tunggal**: cocokkan **pinyin bernada** transkrip (`pypinyin`, dipatok versinya) dengan `pinyin` target (huruf lain yang bunyinya sama dianggap lolos). Gagal → buat ulang dengan variasi (mis. speed 0.9, tambah "。", ulang huruf dalam bingkai pendek lalu potong — pilih yang masuk akal dan catat), maksimal 3 percobaan. Tetap gagal → file terbaik tetap disimpan tetapi ditandai, dan dicatat di `data/basics/audio-issues.json`.
- Keluaran: `public/audio/basics/<audioId>.mp3` + `public/audio/basics/manifest.json` (`{version, generatedAt, voice:{code:'P3', model, modelRevision, voiceId}, whisper:{model, passed, total}, files:{<audioId>:{path, durationSec, transcript, ok, attempts}}}`).
- Workflow `.github/workflows/basics-audio.yml`: `workflow_dispatch` + `push` ke cabang selain `main` bila `data/basics/**`, `scripts/tts/**` (file basics), atau workflow itu berubah. `permissions: contents: write`, `concurrency`, `timeout-minutes ≤ 60`, cache pip + Hugging Face, commit balik hanya `public/audio/basics/**` + `data/basics/audio-issues.json` dengan pesan `Data: basics audio (P3)` (`git pull --rebase` lalu push). Versi paket dipatok.
- Item tanpa file audio (atau sebelum workflow selesai) → UI memakai suara perangkat lewat `src/lib/audio.ts` (sudah ada) sebagai cadangan, dengan catatan kecil seperti di unit.

### C. Tampilan
- Peta belajar (`MapScreen`): kartu/bagian **"Tahap 0 · Dasar"** di atas unit 1, menunjukkan 6 bagian + tanda selesai; unit 1 tetap terbuka walau Tahap 0 belum selesai. Rute hash: `#/belajar/dasar` (ringkasan 6 bagian) dan `#/belajar/dasar/<bagian>` (`pinyin`, `nada`, `perubahan-nada`, `coretan`, `radikal`, `ungkapan`); perluas `parseLearnRoute` + tes router.
- Tiap bagian: penjelasan singkat → materi interaktif → **latihan** (5–10 soal, pilihan ganda 4 opsi memakai komponen/gaya latihan yang ada; keyboard 1–4 / Enter / Spasi) → hasil (bintang memakai aturan yang sama dengan unit) → tombol lanjut ke bagian berikutnya.
  1. Pinyin: dua tabel tombol (bunyi awal / bunyi akhir), klik/Enter = dengar; latihan "dengar → pilih pinyin" dengan pengecoh mirip (zh/z, q/ch, ü/u, -n/-ng).
  2. Nada: kartu 4 nada + ringan dengan garis nada SVG berwarna (selalu dengan tanda nada, bukan warna saja), tombol dengar tiap set; latihan "dengar → tebak nada".
  3. Perubahan nada: kartu contoh yang menampilkan pinyin dasar → pinyin diucapkan (perubahan disorot), tombol dengar; latihan "pilih cara baca yang benar".
  4. Coretan: 8 coretan dengan animasi Hanzi Writer (data lokal `public/hanzi/`, komponen `StrokePanel` yang ada bila cocok), aturan urutan dengan huruf contoh beranimasi; latihan tanpa wajib menggambar (mis. "coretan mana yang ditulis dulu?", "nama coretan ini?") supaya bisa dengan keyboard; menggambar dengan mouse boleh sebagai tambahan.
  5. Radikal: kartu radikal + huruf contoh (klik huruf contoh → artinya + dengar), contoh susunan huruf (gambar kotak kiri-kanan/atas-bawah); latihan "radikal apa di huruf ini?" / "arti radikal".
  6. Ungkapan kelas: angka 1–10 + salam (huruf, pinyin berwarna nada, arti, dengar); latihan "dengar → pilih arti" dan "huruf → arti".
- Progres Tahap 0 disimpan di `xue.progress.v1` sebagai kolom opsional baru (mis. `basics: { <bagian>: { stars, best } }`), dipulihkan di `normalizeProgress` dan ikut cadangan/pulihkan; data lama tetap valid (tes). Tahap 0 **tidak** dimasukkan ke Leitner kata HSK 1.
- Semua teks dari `src/i18n/id.json` + `en.json` (atau teks ID/EN di `basics.json`), ganti bahasa tanpa reload. Pinyin selalu dengan tanda nada; warna nada hanya pelengkap.
- Huruf baru (radikal, huruf contoh coretan/nada) harus tampil dengan font WenKai: perbarui input `scripts/font/build_font.py` / `build:strokes` agar memuat huruf Tahap 0, lalu jalankan `npm run build:font` dan `npm run build:strokes` (data coretan radikal yang tidak ada di `hanzi-writer-data` → tampil huruf diam, dicatat).
- Hormati `prefers-reduced-motion`; fokus keyboard terlihat; tidak ada scroll ke samping di 375 px.

### D. Tes (vitest)
- `basics.json`: struktur valid, `audioId` unik & aman, setiap `pinyin` bertanda nada sah (pakai `src/lib/pinyin.ts`), pinyin huruf contoh cocok dengan salah satu bacaan CC-CEDICT (`cedict-json`) untuk huruf itu, huruf contoh radikal benar-benar mengandung radikal itu (minimal: huruf ada di kata HSK 1 dan tercantum manual), ungkapan kelas hanya memakai kata/huruf HSK 1, semua teks ID & EN terisi.
- Bila `public/audio/basics/manifest.json` ada: setiap item bersuara punya file atau tercatat di `audio-issues.json`; file ada dan > 1 KB.
- Latihan: pembuat soal Tahap 0 (fungsi murni) menghasilkan 4 pilihan unik dengan tepat satu jawaban benar; router `dasar`; progres `basics` dinormalisasi & ikut cadangan.

## Out of scope
- Audio kata/kalimat/dialog HSK 1 (task 4b), rekaman penutur asli, Tone Perfect.
- Mengubah data kata/unit HSK 1, dialog, adegan, karakter. Mengubah BUILD_PLAN bagian 1.
- Pemeriksa nada berbasis analisis nada (pitch) — cukup Whisper + pypinyin.
- Memperbaiki pinyin dialog (yī gè) — boleh dicatat saja.

## Acceptance criteria
1. `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run check:data` lolos.
2. Workflow `basics-audio.yml` sukses di cabang `task-0` dan commit audio balik; semua mp3 mono 64 kbps, sample rate sama (ffprobe), kenyaringan rata (selisih ≤ 2 dB); tingkat lolos cek otomatis tercatat di manifest; ≥ 90 % item lolos, sisanya tercatat di `audio-issues.json`.
3. Playwright (lebar 1366 dan 375, terang & gelap): `#/belajar` menampilkan Tahap 0 di atas unit 1 dan unit 1 tetap bisa dibuka; keenam halaman `#/belajar/dasar/<bagian>` terbuka tanpa error konsol, tanpa scroll ke samping; tiap latihan bisa diselesaikan **hanya dengan keyboard** sampai layar hasil; setelah selesai, tanda selesai muncul di peta dan bertahan setelah reload; ganti ID↔EN mengganti teks.
4. axe (aturan WCAG A/AA) tanpa pelanggaran serius di halaman Tahap 0 (terang & gelap).
5. Total `public/audio/basics/` ≤ 3 MB. Tidak ada token/kunci di repo.
6. CREDITS.md menyebut audio Tahap 0 (Kokoro-82M v1.1-zh, Apache-2.0; Whisper/faster-whisper & pypinyin hanya untuk cek).

## File
- Baru: `data/basics/basics.json`, `data/basics/audio-issues.json` (dibuat workflow), `scripts/tts/basics.py` (+ requirements bila perlu), `.github/workflows/basics-audio.yml`, `public/audio/basics/**` (dibuat workflow), `src/lib/basics*.ts` (+ tes), `src/pages/learn/basics/**` (layar + CSS).
- Diubah: `src/lib/router.ts`, `src/lib/progress.ts`, `src/lib/backup.ts` (bila perlu), `src/pages/LearnPage.tsx`, `src/pages/learn/MapScreen.tsx` (+ CSS), `src/lib/audio.ts` (hanya tambah pemutar file, perilaku kata tetap), `src/i18n/{id,en}.json`, input font/coretan + hasil `build:font`/`build:strokes`, `CREDITS.md`, `docs/tasks/task-0.md` (catatan temuan saja).

## Ronde 2 (sesi 2026-11-23) — sisa pekerjaan

Status saat diambil alih: data, layar, tes, workflow sudah ada di cabang `task-0`; semua cek npm lolos setelah digabung dengan `main`. **Yang belum lolos: acceptance 2** — cek audio hanya 105/162 (65 %) lolos, target ≥ 90 %. Hampir semua yang gagal adalah suku kata tunggal; transkrip Whisper `small` sering berupa kata Inggris ("much", "Bye") atau huruf traditional, jadi cek-nya sendiri yang lemah, belum tentu suaranya salah.

Perbaikan yang diminta (tetap jujur — jangan melonggarkan cek sampai semua lolos):
1. Whisper lebih kuat: faster-whisper `large-v3` (atau `large-v3-turbo`) CPU int8, `language="zh"` dipaksa, `initial_prompt` netral berhuruf sederhana yang **tidak** memuat huruf target, `condition_on_previous_text=False`, beam 5.
2. Suku kata tunggal dinilai dua bagian terpisah: (a) **bunyi** — salah satu bacaan transkrip (pypinyin heteronym, tanpa nada) = suku kata target tanpa nada; (b) **nada** — kontur F0 (praat-parselmouth atau librosa pyin, versi dipatok) diklasifikasi ke nada 1–4 dengan aturan sederhana yang tercatat di skrip (datar-tinggi / naik / rendah-turun-naik atau rendah / turun). Lolos bila (a) dan (b) lolos, atau bila transkrip cocok tepat dengan pinyin bernada. Kata ≥ 2 huruf tetap: transkrip = hanzi. Nada ringan dalam kata tidak dicek F0.
3. Manifest mencatat per file: transkrip, hasil bunyi, nada terdeteksi, alasan gagal. Ringkasan `whisper.passed/total` tetap.
4. File yang suaranya tidak berubah tidak perlu disintesis ulang; cukup dicek ulang (opsi `--recheck`). Yang tetap gagal → sintesis ulang dengan variasi yang ada.
5. Tetap: ≥ 90 % lolos; sisanya di `audio-issues.json` dengan alasan. Total ≤ 3 MB.

### Hasil ronde 2 (2026-11-23)
- Cek baru (CHECK_VERSION 4, `scripts/tts-basics/basics.py` + `tonecheck.py`): faster-whisper large-v3 (int8, zh, beam 5, prompt netral tanpa huruf target) + bunyi pypinyin + nada F0 (parselmouth, aturan tercatat di `tonecheck.py`, dites dengan sapuan sinus). Workflow dibagi ke 6 runner (large-v3 di CPU ~8 dtk/transkripsi), `--recheck` bawaan.
- Hasil: **125/162 (77 %)** — pinyin 34/51, nada 14/21, perubahan nada 17/17, radikal 42/53, ungkapan 18/20. **Target 90 % belum tercapai.**
- Sisa kegagalan sebagian besar memang suara P3 yang salah, bukan cek: Whisper dan F0 sepakat (mis. 鸡 jī → "记" + kontur turun, 诗 shī → "是/影视" + turun, 五 wǔ → "呜" + turun, 家 jiā → "叫/交", 椅 yǐ → "夜", 唱 chàng → "让/正"). Nada 1 suku kata tunggal paling sering dibaca P3 sebagai nada turun. Rincian per item di `data/basics/audio-issues.json`.
- Mengganti huruf contoh dengan huruf lain berpinyin sama tidak membantu (P3 menyintesis dari pinyin → suara sama); sudah dicoba lalu dikembalikan.
- Whisper int8 di CPU tidak sepenuhnya deterministik antar jenis runner (file yang sama 吃: sekali "吃", sekali "诗") — item di batas bisa berubah status.
- Pilihan berikutnya (butuh keputusan): suara lain untuk suku kata tunggal (mis. rekaman/TTS lain), variasi sintesis baru, atau menerima 77 % dengan cadangan suara perangkat untuk item yang gagal.

## Ronde 3 (2026-11-25, Opus) — metode A (keputusan pemilik 2026-11-23)

Status saat diambil alih: layar, latihan, tes, workflow sudah ada di cabang `task-0`; audio 125–133/162 lolos (77–82 %), target ≥ 90 %. Task 4b sudah selesai dan masuk `main` (pemutar file `src/lib/audio.ts`, rekaman penutur asli, pelurus nada PSOLA di `scripts/tts-hsk1/`).

Yang diminta:
1. **Gabung `main` terbaru** ke `task-0` (merge biasa). Selesaikan bentrok dengan menjaga perilaku 4b di `src/lib/audio.ts` (pemutar file HSK 1, `speak` + opsi `key`/suara, penutur asli) dan menambahkan pemutar file Tahap 0 dengan rapi. Semua tes `main` tetap lolos.
2. **Metode A — suku kata tunggal**: suara tetap **P3** yang membaca suku katanya; lalu kontur nada (F0) P3 diganti dengan kontur nada rekaman orang asli `hugolpz/audio-cmn` (penutur Chen Wang, CC BY-SA) untuk suku kata bernada yang sama — bentuk konturnya dipetakan ke rentang suara P3 sendiri (median & rentang F0 P3), dirapatkan ke durasi P3 (durasi P3 tidak berubah), perpindahan halus, lewat PSOLA `parselmouth` (versi dipatok). Rekaman audio-cmn **hanya contoh nada, tidak diputar di website, tidak di-commit sebagai audio situs** (boleh simpan kontur F0 hasil ekstraksi kecil sebagai data turunan bila perlu, dengan atribusi). File mentah diunduh di GitHub Actions (cache), bukan di sesi kerja. Boleh memakai/meniru kode pelurus nada 4b (`scripts/tts-hsk1/tone.py`, `build_audio.py`) — salin ke `scripts/tts-basics/`, jangan ubah `scripts/tts-hsk1/` atau `build-audio.yml`.
   - Berlaku untuk semua item 1 suku kata Tahap 0 (pinyin, nada, contoh radikal/coretan yang bersuara 1 huruf). Item multi-huruf tetap sintesis biasa (boleh diluruskan juga bila 1 suku kata gagal, opsional).
   - Suku kata yang tidak ada di audio-cmn → pakai kontur baku nada target (cara 4b), dicatat.
   - Hasil dicek ulang penuh: Whisper large-v3 + bunyi pypinyin + nada F0 (aturan cek yang ada, **jangan dilonggarkan**). Manifest per file: `pitchSource: "audio-cmn" | "standard" | null`.
   - Cek telinga sederhana: tidak ada klik/derau (lihat spektrogram beberapa contoh, simpan 3–4 PNG di scratchpad untuk pemeriksa). Bila terdengar kasar seperti mesin itu diterima (penghalusan ronde berikut, keputusan pemilik), tetapi bunyi harus tetap dikenali Whisper.
3. **CREDITS.md**: tambah `hugolpz/audio-cmn` (Chen Wang, CC BY-SA, hanya sebagai contoh nada untuk menyetel nada suara Tahap 0; tidak diputar).
4. Target: **≥ 90 % dari 162 item lolos**; sisanya di `data/basics/audio-issues.json` dengan alasan; item gagal tidak diputar (cadangan suara perangkat, perilaku yang ada). Total `public/audio/basics/` ≤ 3 MB.
5. Semua acceptance 1–6 di atas tetap berlaku.

### Hasil ronde 3 (2026-11-25, diperiksa Opus)
- Audio: **154/162 (95 %) lolos** cek Whisper large-v3 + bunyi + nada F0 (aturan cek tidak dilonggarkan). Metode A dipakai untuk 21 suku kata tunggal (19 kontur audio-cmn, 2 kontur baku). 8 item gagal tercatat di `data/basics/audio-issues.json` (mis. 五 wǔ di bunyi i→w, 夫 fū, 爱 ài, 椅 yǐ, 妈妈, 鸡 jī, 谁 shéi) dan tidak diputar (cadangan suara perangkat).
- Semua mp3 mono 64 kbps 24 kHz, kenyaringan −16,0…−16,2 LUFS, total 1,4 MB.
- Playwright (1366/375, terang/gelap): Tahap 0 di atas unit 1, unit 1 terbuka, 6 bagian tanpa error konsol & tanpa scroll samping, axe tanpa pelanggaran, keenam latihan selesai hanya dengan keyboard, tanda selesai 6/6 bertahan setelah reload, ID↔EN berganti.
- Perbaikan saat pemeriksaan: nama bagian di kartu Tahap 0 di peta terpotong di tengah kata → grid kartu dilebarkan (`map-card.css`).
- Belum: penghalusan suara (ikut task 4c); Tahap 0 nanti ikut cara animasi baru (IDEAS.md, bukan sekarang).
