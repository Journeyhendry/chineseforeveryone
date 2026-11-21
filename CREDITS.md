# Credits dan Lisensi Sumber

Kode proyek ini berlisensi MIT (lihat [LICENSE](LICENSE)). Data pembelajaran dan aset lain mengikuti lisensi masing-masing sumbernya, seperti tercantum di bawah. Daftar ini akan diperbarui ketika data dan aset ditambahkan.

## Data kosakata dan tata bahasa

- **Daftar kata HSK 3.0** (daftar 2021, level 1 = 500 kata): [github.com/ivankra/hsk30](https://github.com/ivankra/hsk30), dipatok pada commit `4ff9e3915ce87baaecd7ebe263085573a4ea3192`. Lisensi repo tersebut: kode MIT; data diturunkan dari daftar resmi HSK 3.0. Salinan asli: `data/raw/hsk30.csv`.
- **Daftar tata bahasa HSK**: [github.com/krmanik/HSK-3.0](https://github.com/krmanik/HSK-3.0). Lisensi akan diperiksa sebelum digunakan.

## Kamus

- **CC-CEDICT**: [cc-cedict.org](https://cc-cedict.org). Berlisensi CC BY-SA 4.0 (wajib mencantumkan sumber dan berbagi dengan lisensi yang sama). Dipakai lewat paket npm [`cedict-json`](https://github.com/matt-tingen/cedict-json) versi 1.3.20251213 untuk arti Inggris di `data/hsk1/words.json`.
- **Arti Indonesia**: terjemahan mesin (dibuat oleh AI dari arti Inggris dan konteks HSK 1), ditandai `idMachine: true` di data dan "terjemahan mesin" di tampilan. Sumber: `data/hsk1/translations-id.json`.

## Kalimat contoh dan audio

- **Tatoeba**: [tatoeba.org](https://tatoeba.org). Kalimat contoh (Mandarin, Inggris, Indonesia) berlisensi CC BY 2.0 FR; sebagian berlisensi CC0 (ditandai di data). Nama penulis dan id Tatoeba tiap kalimat dan terjemahan disimpan di `data/hsk1/sentences.json`. Lisensi dan nama perekam audio disimpan per rekaman (tiap perekam bisa memakai lisensi berbeda, sebagian CC BY-NC); file audio belum dipakai. Kalimat diambil otomatis dari ekspor resmi Tatoeba oleh `.github/workflows/fetch-tatoeba.yml`; tanggal unduhan tercatat di `data/hsk1/sentences-report.json` (berubah tiap unduhan).

## Contoh suara dan audio TTS

- **Kokoro-82M** (hexgrad; model `hexgrad/Kokoro-82M` v1.0 dan `hexgrad/Kokoro-82M-v1.1-zh`): lisensi Apache-2.0. Kandidat suara Mandarin `zf_*` / `zm_*` untuk audio website.
- **MeloTTS** (MyShell.ai; model `myshell-ai/MeloTTS-Chinese`): lisensi MIT. Hanya dipakai bila berhasil dipasang di runner; kalau tidak, diganti suara Kokoro lain.
- **faster-whisper / OpenAI Whisper** (MIT): hanya untuk mengecek apakah audio terdengar sama dengan teksnya; hasilnya tidak ditampilkan sebagai materi belajar.
- Contoh suara (`public/audio/samples/`, halaman `samples.html`) dibuat otomatis oleh `.github/workflows/tts-samples.yml` memakai `scripts/tts/make_samples.py`; versi paket dipatok di `scripts/tts/requirements.txt`.

## Versi santai dan dialog

- **Ungkapan santai dan dialog** (`data/hsk1/casual.json`, `data/hsk1/dialogs.json`) ditulis oleh AI, lalu dicek berlapis: (1) draf AI; (2) tiap ungkapan harus ada di minimal 2 sumber luar di bawah; (3) dinilai oleh pemeriksa AI kedua yang tidak melihat alasan penulis; (4) dialog dicek otomatis hanya memakai kata HSK 1 dan ungkapan yang lolos; (5) yang gagal satu lapis dibuang. Arti, situasi, dan terjemahan dialog adalah terjemahan mesin (ditandai `machine: true`). Bukti tiap ungkapan tercatat di `data/hsk1/casual-evidence.json`.
- Sumber yang hanya dipakai untuk **mengecek** (isinya tidak disalin ke website):
  - **Wiktionary** ([en.wiktionary.org](https://en.wiktionary.org), [zh.wiktionary.org](https://zh.wiktionary.org)), berlisensi CC BY-SA 4.0: apakah ada entri bahasa Mandarin dan labelnya (colloquial, slang, Taiwan, dll.).
  - **Tatoeba** ([tatoeba.org](https://tatoeba.org)), CC BY 2.0 FR: jumlah kalimat Mandarin yang memakai ungkapan itu (dengan id kalimat contoh).
  - **CC-CEDICT** ([cc-cedict.org](https://cc-cedict.org)), CC BY-SA 4.0, lewat paket `cedict-json`: apakah ada entri kamus dan tanda colloquial/dialek/Taiwan.
- Bukti diambil otomatis oleh `.github/workflows/casual-evidence.yml`; tanggal pengambilan tercatat di `data/hsk1/casual-evidence-raw.json`.

## Animasi goresan karakter

- **Hanzi Writer**: [hanziwriter.org](https://hanziwriter.org). Kode bersifat MIT; data goresan berlisensi Arphic Public License.

## Font

- **Baloo 2**, **Nunito**: berlisensi SIL Open Font License (dimuat dari Google Fonts).
- **LXGW WenKai** (霞鹜文楷), font Mandarin untuk huruf besar: berlisensi SIL Open Font License 1.1 (teks lisensi: `public/fonts/LXGW-WenKai-OFL.txt`). Hak cipta: LXGW dan The Klee Project Authors (tercantum di tabel nama font). Versi font 1.250, diambil dari paket npm [`lxgw-wenkai-webfont@1.7.0`](https://github.com/chawyehsu/lxgw-wenkai-webfont) (paket berlisensi MIT). Font disubset untuk website ini oleh `scripts/font/build_font.py` (hanya huruf yang dipakai di data HSK 1 dan kode); nama font tidak diubah karena font ini tidak memiliki Reserved Font Name. Daftar huruf tercatat di `src/assets/fonts/lxgw-wenkai-chars.json`.

## Ilustrasi

- Ilustrasi dibuat sebagai SVG khusus untuk proyek ini.
- **Tokoh "Keluarga Xiǎo" dan tokoh pendukung** (`public/art/characters/`): digambar oleh Claude (AI) sebagai karya asli untuk proyek ini, dirakit oleh `scripts/build-characters.ts` dari bagian-bagian di `src/art/characters/`. Lisensinya sama dengan repo ini (MIT); tidak meniru tokoh atau karakter terkenal mana pun.
