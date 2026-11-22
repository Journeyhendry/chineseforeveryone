# Task 6b · Ilustrasi + animasi semua kata — tahap 1 (unit 1–3)

Model: Opus (implementasi), sesi utama Opus memeriksa. Prasyarat: task 3c, 6 (selesai).
Task 6b dikerjakan bertahap. **Tahap 1 (dokumen ini): sistem rakit adegan + ilustrasi & animasi untuk 87 kata unit 1–3** (u01 Salam 31 kata, u02 Angka 27, u03 Ini/itu & bertanya 29). Tahap berikutnya (unit 4–20, "rumah yang terisi" di unit Keluarga, animasi asal-usul huruf bergambar 家 人 口 山) memakai sistem yang sama dan ditulis di dokumen terpisah.

## Tujuan
Di layar kenalan kata (`#/belajar/unit/<id>/kata/<n>`) setiap kata unit 1–3 punya ilustrasi SVG gaya B "kartun hangat" yang dirakit dari tokoh Keluarga Xiǎo + benda + latar. Gambar bergerak kecil terus-menerus (napas, kedip), dan saat diklik tokoh "beraksi" sesuai kata sambil suara kata diputar. Gerak halus (ancang-ancang, gerak susulan, easing lembut) dan mati bila "kurangi gerak" aktif.

Acuan (wajib dibaca):
- PRD pemilik bagian "Ilustrasi & animasi" (ringkasan di bawah) dan BUILD_PLAN bagian 1 (gaya, CSS untuk gerak sederhana, Lottie hanya untuk gerak rumit — **tahap 1 cukup CSS, jangan tambah Lottie**).
- `docs/tasks/ref/mama-wave.svg`, `mama-eat.svg`, `house-jia.svg` (contoh adegan yang sudah disetujui pemilik), `public/art/characters/*/sheet.svg`, `lineup.svg`.
- Sistem tokoh `src/art/characters/` + `scripts/build-characters.ts` (task 3c), rencana per kata `data/hsk1/visuals.json` (type, scene, characters, props).
- Layar kata `src/pages/learn/WordScreen.tsx`, suara `src/lib/audio.ts` (lewat `useAudio` di `hooks.ts`).

Ringkasan PRD per jenis visual:
- `object` benda & orang → gambar + gerak kecil berulang (kedip, goyang).
- `action` kata kerja → tokoh melakukan aksi.
- `pair` sifat → dua gambar berlawanan berdampingan (mis. 对/错, 多/少).
- `count` angka & waktu → benda yang dihitung (jumlah benda = angka), muncul satu per satu saat diklik.
- `position` tempat & arah → benda/tokoh bergerak ke posisinya (这里/那里: dekat/jauh dari penunjuk).
- `comic` kata tugas, kata tanya, salam → adegan komik mini 1–2 panel, kata itu disorot di balon bicara.
Latar budaya China daratan sehari-hari bila relevan (rumah, kompleks, jalan, kelas, warung). Tanpa merek, tanpa tokoh terkenal, tanpa teks tertulis di gambar (kecuali angka).

## Scope

### A. Penyesuaian tokoh (kecil)
1. Kakak (`gege`) dijadikan mahasiswa muda (selaras dialog "teman kuliah"): tinggi ±97–100 % dewasa, `label` aria diganti (bukan "teenage"), tetap hoodie jingga + rambut jabrik. Cukup ubah spesifikasi di `src/art/characters/specs.ts`, lalu `npm run build:characters`.
2. Alis gelap yang tertutup poni gelap (Guru, Teman sekelas) dibuat terbaca (mis. alis sedikit di bawah poni atau garis tepi poni dinaikkan) — tanpa mengubah tokoh lain.
3. **Pose**: perluas sistem rakit dengan pose lengan/badan yang dibutuhkan adegan (mis. `wave`, `point`, `bow`, `handsTogether` (salam/terima kasih), `shrug`, `thinking`, `holdObject`, `thumbsUp`, `armsCross` (X/salah), `count` (isyarat jari), `beckon`, `sit`). Pose = data (sudut sendi bahu/siku per lengan, sedikit miring badan/kepala), bukan SVG gambar tangan baru per tokoh. Semua tokoh bisa memakai semua pose. Tes: setiap tokoh × setiap pose dirender tanpa error, lengan tetap menempel di bahu.
   File `public/art/characters/**` boleh berubah karena A1–A2; manifest tetap kompatibel.

### B. Sistem adegan (sumber tunggal, deterministik)
1. `data/hsk1/scenes.json` = deskripsi rakitan per kata (sumber kebenaran, ditulis tangan/oleh subagent, diformat stabil):
   `{ version: 1, scenes: [ { wordId, hanzi, unitId, type, background, panels: [ { characters: [ { id, pose, expression, view, x, scale?, flip? , anim? } ], props: [ { id, x, y, scale?, anim? , count? } ], bubbles?: [ { from: <charIndex>, x, y, w, h, highlight: true|false } ] } ], alt: { id, en }, play: <preset aksi> } ] }`
   (Bentuk boleh disesuaikan, asal: tiap kata u01–u03 tepat satu adegan, urut sesuai urutan kata di `units.json`, alt dua bahasa, dan semua id tokoh/pose/benda/latar/animasi dikenal oleh pustaka.) Isi adegan mengikuti `visuals.json` (boleh menyederhanakan supaya terbaca di kotak kecil; bila berbeda jauh, alt mengikuti gambar yang sebenarnya, dan `scene` di `visuals.json` kata u01–u03 boleh diselaraskan).
2. Pustaka di `src/art/scenes/` (TypeScript murni, tanpa DOM): `props.ts` (benda: digambar dengan gaya sama — garis #231942, warna rata), `backgrounds.ts` (latar sederhana yang tidak ramai: rumah/ruang tamu, kompleks/taman, jalan, kelas, warung/toko, polos berwarna), `bubble.ts` (balon bicara/pikir), `compose.ts` (merakit tokoh berpose + benda + latar + panel komik ke satu SVG).
3. `scripts/build-scenes.ts` (`npm run build:scenes`, tsx): membaca `scenes.json`, menulis `public/art/scenes/<wordId>.svg` + `public/art/scenes/index.json` (`{ wordId: { file, alt, bubbles (posisi dalam % untuk ditimpa teks HTML), play } }` atau setara). Jalan ulang → byte-identik.
4. Aturan SVG adegan: satu viewBox tetap untuk semua adegan (mis. `0 0 480 360`, rasio 4:3), `xmlns`, `role="img"`, tanpa `<script>`, `<foreignObject>`, `<image>`, href luar, gradien/filter tidak perlu; `<style>` di dalam SVG tidak dipakai (animasi lewat CSS aplikasi). `<text>` hanya untuk angka (0–9) bila perlu; kata Mandarin di balon **tidak** digambar di SVG — ditimpa sebagai teks HTML (font WenKai, `--font-hanzi`) di atas balon memakai posisi dari index, dengan kata yang sedang dipelajari disorot (latar kuning/tebal). Grup diberi class untuk animasi (`char`, `arm-left`, `arm-right`, `head`, `eyes`, `prop`, `count-item`, `panel-2`, …). Ukuran tiap file ≤ 40 KB (target rata-rata ≤ 20 KB).
5. Garis luar #231942 tebal 4 (detail 3–3.5), round join/cap; tokoh sama persis dengan character sheet (memakai fungsi render tokoh yang sama, bukan salinan).

### C. Animasi (CSS) + tampilan
1. Komponen `src/pages/learn/WordScene.tsx` (+ `scene.css`): memuat SVG adegan kata lewat `fetch` (base URL), menyisipkannya ke DOM (file milik repo sendiri; tetap tolak isi yang bukan `<svg` dan hapus atribut `on*`/`<script>` bila ada), menimpa teks balon, dan menyediakan tombol (seluruh gambar, `aria-label` = alt + "klik untuk melihat & mendengar" dari i18n). File adegan hanya dimuat untuk kata yang sedang tampil (tidak ada di bundle JS).
2. Gerak diam (idle): napas kecil badan, kedip mata acak-teratur (delay berbeda tiap tokoh), goyang benda kecil. Halus dan pelan (≥ 3 detik per siklus), tidak mengganggu membaca.
3. Klik/Enter/Spasi pada gambar → kelas `is-playing` ±1,5–3 detik: preset aksi per adegan (`wave`, `bow`, `nod`, `shake-head`, `point`, `count-up` (benda muncul satu per satu sesuai angka), `move-to` (benda/tokoh bergerak ke posisi), `pop-bubble` (balon muncul lalu kata disorot), `swap-pair` (dua sisi berlawanan bergantian disorot), `jump`, …). Prinsip: ancang-ancang kecil sebelum gerak utama, gerak susulan (rambut/kuncir/lengan), easing `cubic-bezier` lembut, tidak ada lompatan tiba-tiba. Bersamaan, suara kata diputar lewat `useAudio().play(word.hanzi)` bila tersedia (kalau tidak tersedia, animasi tetap jalan). Klik saat masih bermain → mulai ulang dengan rapi (tidak menumpuk).
4. `prefers-reduced-motion: reduce` → tidak ada animasi idle maupun aksi; gambar diam pada pose "puncak" yang paling menjelaskan kata (mis. semua benda hitungan sudah tampil, kata di balon sudah disorot); klik tetap memutar suara.
5. Penempatan di `WordScreen`: kartu ilustrasi di panel info atau di atas panel coretan (ikuti gaya kartu yang ada: garis 3px `--ink`, bayangan tebal, sudut membulat); di 375 px tidak ada scroll horizontal dan gambar tetap terbaca (lebar penuh kartu). Kata tanpa adegan (unit 4–20 untuk sementara) → kartu tidak tampil sama sekali (tanpa pesan error, tanpa ruang kosong). Gagal memuat → kartu disembunyikan diam-diam.
6. Mode gelap: latar kartu ilustrasi tetap terang (gambar didesain di atas latar terang) atau latar adegan menutup penuh; garis tidak hilang.
7. Semua teks baru dari `src/i18n/id.json` + `en.json` (kunci sama). Alt mengikuti bahasa aktif.

### D. Tes (vitest)
- scenes.json: tiap kata u01–u03 tepat satu adegan, `hanzi` cocok dengan `words.json`, id tokoh/pose/ekspresi/benda/latar/preset dikenal, koordinat dalam viewBox, alt id+en tidak kosong, `count` cocok dengan angka kata untuk 一…十/两/零 (零 = 0 benda atau piring kosong).
- build-scenes: hasil = file di repo (bangun di memori, bandingkan); index lengkap.
- SVG: XML valid, viewBox sama, tidak ada elemen/atribut terlarang, `<text>` hanya angka, warna garis hanya #231942 (kecuali isian), ukuran ≤ 40 KB.
- Pose: setiap tokoh × setiap pose dirender tanpa error.
- WordScene sanitasi (fungsi murni): `<script>`/`on*` dibuang, bukan-SVG ditolak.
- Tes yang sudah ada tetap lolos (characters test diperbarui sesuai A).

## Out of scope
- Unit 4–20, "rumah yang terisi", animasi asal-usul huruf bergambar, Lottie (tahap berikutnya).
- Thumbnail ilustrasi di ringkasan unit/kamus/game. Audio final (4b). Mengubah `words.json`, `units.json`, kalimat, dialog, casual, keputusan BUILD_PLAN bagian 1.

## Acceptance criteria (dicek sesi utama)
1. `npm ci`, `npm run typecheck`, `npm run lint` (tanpa error baru), `npm run build`, `npm test` lolos; `npm run build:characters`, `npm run build:scenes`, `npm run build:lessons` dijalankan ulang → `git status` bersih.
2. Render PNG (`rsvg-convert`) ke-87 adegan + lembar tokoh: gaya konsisten dengan acuan mockup & character sheet, tokoh tidak terpotong/lepas, lengan menempel, adegan terbaca jelas maknanya di ukuran kecil (±320 px), jumlah benda pada kata hitungan benar, tidak ada teks tertulis selain angka. Pemeriksa menilai semua 87; ≤ 5 adegan "kurang jelas tapi tidak salah" boleh dicatat sebagai temuan, tidak boleh ada yang salah makna atau rusak.
3. Di build produksi (`vite preview`, base `/chineseforeveryone/`): kata unit 1–3 menampilkan ilustrasi bergerak halus; klik / Enter / Spasi pada gambar → aksi + suara (atau aksi saja bila suara tidak ada); klik berulang tidak menumpuk; tidak ada error konsol; tidak ada request ke luar domain kecuali Google Fonts yang sudah ada; kata unit 4 tidak menampilkan kartu kosong.
4. Teks di balon komik tampil dengan font WenKai dan kata yang dipelajari disorot.
5. `prefers-reduced-motion: reduce` → tidak ada animasi (CSS `animation`/`transition` nol pada elemen adegan), gambar diam menjelaskan kata.
6. axe tanpa pelanggaran di layar kata (terang & gelap), gambar punya alt sesuai bahasa; tidak ada scroll horizontal di 375 px; ukuran file adegan sesuai aturan; bundle JS utama tidak membengkak > 15 KB gzip karena task ini.

## File terkait
- Baru: `data/hsk1/scenes.json`, `src/art/scenes/*.ts` (+ tes), `scripts/build-scenes.ts`, `public/art/scenes/*.svg`, `public/art/scenes/index.json`, `src/pages/learn/WordScene.tsx`, `src/pages/learn/scene.css`, fungsi sanitasi di `src/lib/` (+ tes).
- Diubah: `src/art/characters/*` (pose, Kakak, alis), `public/art/characters/**`, `src/art/characters.test.ts`, `src/pages/learn/WordScreen.tsx`, `src/i18n/{id,en}.json`, `package.json` (skrip `build:scenes`), `data/hsk1/visuals.json` (hanya teks `scene` kata u01–u03 bila perlu diselaraskan), `CREDITS.md` (ilustrasi adegan dibuat Claude).
