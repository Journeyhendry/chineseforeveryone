# Credits dan Lisensi Sumber

Kode proyek ini berlisensi MIT (lihat [LICENSE](LICENSE)). Data pembelajaran dan aset lain mengikuti lisensi masing-masing sumbernya, seperti tercantum di bawah. Daftar ini akan diperbarui ketika data dan aset ditambahkan.

## Data kosakata dan tata bahasa

- **Daftar kata HSK 1 (silabus ujian HSK 2025, 300 kata)**: [github.com/becky82/mteh](https://github.com/becky82/mteh), berkas `sources/HSK3.1/HSK3.1_words_level1.txt`, dipatok pada commit `6be297fc92f85590a4fc001f8f734ed5624497fc`. Lisensi: CC BY-SA 4.0, (c) 2025 Rebecca J. Stones. Salinan asli: `data/raw/hsk31_words_level1.txt`. Dicocokkan dengan PDF resmi silabus di repo yang sama (`新版HSK考试大纲（词汇、汉字、语法）.pdf` dan versi 1219) dan paket npm `@leonsilicon/hsk3.1`; hasilnya cocok tanpa beda yang tidak terjelaskan (lihat `data/hsk1/SOURCES.json`). Kelas kata dan tabel pinyin dari PDF disimpan di `data/raw/hsk31_syllabus_level1.tsv`.
- **Daftar kata HSK 3.0 (2021)**: [github.com/ivankra/hsk30](https://github.com/ivankra/hsk30), dipatok pada commit `4ff9e3915ce87baaecd7ebe263085573a4ea3192`. Kini hanya dipakai untuk pratinjau HSK 2 (`data/hsk2-preview/`) dan sebagai asal id kata lama. Lisensi repo tersebut: kode MIT; data diturunkan dari daftar resmi HSK 3.0. Salinan asli: `data/raw/hsk30.csv`.
- **Daftar tata bahasa HSK**: [github.com/krmanik/HSK-3.0](https://github.com/krmanik/HSK-3.0). Lisensi akan diperiksa sebelum digunakan.

## Kamus

- **CC-CEDICT**: [cc-cedict.org](https://cc-cedict.org). Berlisensi CC BY-SA 4.0 (wajib mencantumkan sumber dan berbagi dengan lisensi yang sama). Dipakai lewat paket npm [`cedict-json`](https://github.com/matt-tingen/cedict-json) versi 1.3.20251213 untuk arti Inggris di `data/hsk1/words.json`.
- **Arti Indonesia**: terjemahan mesin (dibuat oleh AI dari arti Inggris dan konteks HSK 1), ditandai `idMachine: true` di data dan "terjemahan mesin" di tampilan. Sumber: `data/hsk1/translations-id.json`.

## Kalimat contoh dan audio

- **Tatoeba**: [tatoeba.org](https://tatoeba.org). Kalimat contoh (Mandarin, Inggris, Indonesia) berlisensi CC BY 2.0 FR; sebagian berlisensi CC0 (ditandai di data). Nama penulis dan id Tatoeba tiap kalimat dan terjemahan disimpan di `data/hsk1/sentences.json`. Lisensi dan nama perekam audio disimpan per rekaman (tiap perekam bisa memakai lisensi berbeda, sebagian CC BY-NC); file audio Tatoeba **tidak dipakai**: di data sekarang hanya ada rekaman berlisensi kosong (58) dan CC BY-NC 4.0 (28), keduanya bukan lisensi bebas. Kalimat diambil otomatis dari ekspor resmi Tatoeba oleh `.github/workflows/fetch-tatoeba.yml`; tanggal unduhan tercatat di `data/hsk1/sentences-report.json` (berubah tiap unduhan).

## Contoh suara dan audio TTS

- **Kokoro-82M** (hexgrad; model `hexgrad/Kokoro-82M` v1.0 dan `hexgrad/Kokoro-82M-v1.1-zh`): lisensi Apache-2.0. Kandidat suara Mandarin `zf_*` / `zm_*` untuk audio website.
- **MeloTTS** (MyShell.ai; model `myshell-ai/MeloTTS-Chinese`): lisensi MIT. Hanya dipakai bila berhasil dipasang di runner; kalau tidak, diganti suara Kokoro lain.
- **faster-whisper / OpenAI Whisper** (MIT): hanya untuk mengecek apakah audio terdengar sama dengan teksnya; hasilnya tidak ditampilkan sebagai materi belajar.
- Contoh suara (`public/audio/samples/`, halaman `samples.html`) dibuat otomatis oleh `.github/workflows/tts-samples.yml` memakai `scripts/tts/make_samples.py`; versi paket dipatok di `scripts/tts/requirements.txt`.

## Audio materi HSK 1 (task 4b)

- **Suara utama**: Kokoro-82M v1.1-zh (hexgrad, Apache-2.0), revisi model dipatok di `scripts/tts/voices.json`. Suara **P3** (`zf_001`, perempuan) untuk semua kata, kalimat, ungkapan, dan baris dialog; suara **L3** (`zm_010`, laki-laki) hanya untuk baris dialog tokoh laki-laki. Bukan rekaman manusia: dibuat otomatis oleh `.github/workflows/build-audio.yml` (`scripts/tts-hsk1/`) ke `public/audio/hsk1/`; manifest dan hasil cek ada di `public/audio/hsk1/manifest.json` dan `data/hsk1/audio-issues.json`.
- **faster-whisper / Whisper** (MIT) dan **pypinyin** (MIT): hanya untuk mengecek hasil suara, tidak ikut ke website.
- **Rekaman penutur asli**: Lingua Libre di Wikimedia Commons, hanya berlisensi CC0, CC BY, atau CC BY-SA. Penulis, lisensi, dan tautan halaman file tiap rekaman ada di `data/hsk1/native-audio.json` dan tampil di bawah tombol "Dengar penutur asli" (diambil otomatis oleh `scripts/tts-hsk1/native_audio.py`; file diubah ke mp3 mono 64 kbps dan disamakan kenyaringannya).
- **Tatoeba audio** tidak dipakai (lisensi rekaman kosong atau CC BY-NC, bukan lisensi bebas). Tone Perfect tidak dipakai.

## Versi santai dan dialog

- **Ungkapan santai dan dialog** (`data/hsk1/casual.json`, `data/hsk1/dialogs.json`) ditulis oleh AI, lalu dicek berlapis: (1) draf AI; (2) tiap ungkapan harus ada di minimal 2 sumber luar di bawah; (3) dinilai oleh pemeriksa AI kedua yang tidak melihat alasan penulis; (4) dialog dicek otomatis hanya memakai kata HSK 1 dan ungkapan yang lolos; (5) yang gagal satu lapis dibuang. Arti, situasi, dan terjemahan dialog adalah terjemahan mesin (ditandai `machine: true`). Bukti tiap ungkapan tercatat di `data/hsk1/casual-evidence.json`.
- Sumber yang hanya dipakai untuk **mengecek** (isinya tidak disalin ke website):
  - **Wiktionary** ([en.wiktionary.org](https://en.wiktionary.org), [zh.wiktionary.org](https://zh.wiktionary.org)), berlisensi CC BY-SA 4.0: apakah ada entri bahasa Mandarin dan labelnya (colloquial, slang, Taiwan, dll.).
  - **Tatoeba** ([tatoeba.org](https://tatoeba.org)), CC BY 2.0 FR: jumlah kalimat Mandarin yang memakai ungkapan itu (dengan id kalimat contoh).
  - **CC-CEDICT** ([cc-cedict.org](https://cc-cedict.org)), CC BY-SA 4.0, lewat paket `cedict-json`: apakah ada entri kamus dan tanda colloquial/dialek/Taiwan.
- Bukti diambil otomatis oleh `.github/workflows/casual-evidence.yml`; tanggal pengambilan tercatat di `data/hsk1/casual-evidence-raw.json`.

## Animasi goresan karakter

- **Hanzi Writer** ([hanziwriter.org](https://hanziwriter.org), [github.com/chanind/hanzi-writer](https://github.com/chanind/hanzi-writer)), paket npm `hanzi-writer@3.7.3`, oleh David Chanin: berlisensi MIT. Dipakai untuk animasi urutan coretan di layar kenalan kata.
- **Data coretan** dari paket npm [`hanzi-writer-data@2.0.1`](https://github.com/chanind/hanzi-writer-data), diturunkan dari proyek [Make Me a Hanzi](https://github.com/skishore/makemeahanzi) yang memakai font Arphic PL KaitiM GB dan Arphic PL UKai. Berlisensi **Arphic Public License** (teks lengkap: `public/hanzi/ARPHICPL.TXT`; hak cipta © 1999 Arphic Technology Co., Ltd.). Hanya huruf yang muncul di kata HSK 1 dan ungkapan santai yang disalin ke `public/hanzi/` oleh `scripts/build-strokes.ts` (`npm run build:strokes`); isi file tidak diubah. Data dimuat dari website ini sendiri, tidak dari CDN.

## Font

- **Baloo 2**, **Nunito**: berlisensi SIL Open Font License (dimuat dari Google Fonts).
- **LXGW WenKai** (霞鹜文楷), font Mandarin untuk huruf besar: berlisensi SIL Open Font License 1.1 (teks lisensi: `public/fonts/LXGW-WenKai-OFL.txt`). Hak cipta: LXGW dan The Klee Project Authors (tercantum di tabel nama font). Versi font 1.250, diambil dari paket npm [`lxgw-wenkai-webfont@1.7.0`](https://github.com/chawyehsu/lxgw-wenkai-webfont) (paket berlisensi MIT). Font disubset untuk website ini oleh `scripts/font/build_font.py` (hanya huruf yang dipakai di data HSK 1 dan kode); nama font tidak diubah karena font ini tidak memiliki Reserved Font Name. Daftar huruf tercatat di `src/assets/fonts/lxgw-wenkai-chars.json`.

## Ilustrasi

- Ilustrasi dibuat sebagai SVG khusus untuk proyek ini.
- **Tokoh "Keluarga Xiǎo" dan tokoh pendukung** (`public/art/characters/`): digambar oleh Claude (AI) sebagai karya asli untuk proyek ini, dirakit oleh `scripts/build-characters.ts` dari bagian-bagian di `src/art/characters/`. Lisensinya sama dengan repo ini (MIT); tidak meniru tokoh atau karakter terkenal mana pun.
- **Ilustrasi adegan kata** (`public/art/scenes/`): digambar oleh Claude (AI) sebagai karya asli untuk proyek ini, dirakit oleh `scripts/build-scenes.ts` dari `data/hsk1/scenes.json` dengan tokoh, benda, dan latar di `src/art/`. Lisensinya sama dengan repo ini (MIT); tanpa merek dan tanpa tokoh terkenal.
