# Task 6c · Stage 4 — adegan baru unit 17–21 (konsep kalimat/dialog)

Bagian dari `docs/tasks/task-6c.md` (keputusan pemilik ada di sana). Model: Opus (adegan), diperiksa Opus (sesi utama). Cabang `task-6c`, push WIP ≤ 45 menit.

Stage 3 (audio kalimat/dialog baru) menunggu task 4c selesai mengubah jalur suara (PRD 6c: "boleh menunggu 4c; jangan membuat dua pipeline"), jadi stage 4 dikerjakan lebih dulu. Stage 4 tidak menyentuh audio.

## Tujuan
67 kata unit 17–21 (u17 Bahasa & indera 16, u18 Pekerjaan & kesehatan 13, u19 Belanja & uang 12, u20 Hiburan & teknologi 13, u21 Sifat & cuaca 13) mendapat adegan SVG baru yang langsung menggambarkan kalimat/dialog stage 1 (`data/hsk1/word-sentences.json`, `scene.fit = "new"`, arahan di `scene.note`). Tidak menggambar versi konsep lama.

## Scope
1. 67 entri baru di `data/hsk1/scenes.json` (sistem rakit: tokoh, pose, benda, latar di `src/art/`), satu per kata u17–u21, `unitId` benar, `wordId` sesuai.
2. Balon berisi kalimat utama (`line: 0`) atau, untuk 6 kata ber-dialog, satu balon per baris dialog (`line` 0,1,…; `from` = tokoh yang bicara). Kata yang diajarkan disorot (`highlight`). Teks balon = `sentence.hanzi` / baris `dialog` persis (cek otomatis yang sudah ada untuk 233 adegan diperluas ke 300).
3. Gambar menunjukkan situasi kalimat (`scene.note`): pembicara terlihat dan ekor balon ke pembicara; balon tidak menutupi wajah; benda penting cukup besar untuk dikenali di 375 px.
4. Benda/latar/pose baru boleh ditambah di `src/art/` (mis. layar TV/komputer/ponsel, uang kertas/koin, rumah sakit, salju/hujan, termometer, mikrofon, papan nama toko). Tetap gaya B "kartun hangat", garis #231942, warna rata, tanpa teks di dalam SVG selain huruf kapur/papan yang sudah ada polanya.
5. `alt` id/en per adegan sesuai gambar + kalimat. `play` preset yang cocok.
6. `visuals.json` / `word-sentences.json` (`scene.ref`) disesuaikan bila cek data membutuhkannya. `npm run build:scenes` dan `build:lessons` deterministik; data di `public/` diperbarui.
7. Setelah stage 4: layar kenalan kata semua 300 kata menampilkan adegan berbalon kalimat (tidak ada lagi kata tanpa gambar di HSK 1).

## Di luar scope
Audio baru (stage 3); Tahap 0 (stage 5); mengubah kalimat/dialog stage 1 (kecuali kesalahan nyata — catat); mengubah adegan u01–u16; ide parkir.

## Kriteria lolos (diperiksa sesi utama)
- `npm ci`, typecheck, lint, test, `check:data`, `check:visuals`, build lolos.
- 300/300 kata HSK 1 punya adegan; teks balon = kalimat/dialog stage 1 (cek otomatis).
- Render PNG semua 67 adegan dilihat: pembicara tergambar, ekor balon benar, balon tidak menutupi wajah, teks muat, makna kalimat terbaca dari gambar.
- Pemutar stage 2 bekerja untuk adegan baru (urutan baris dialog benar).
- axe 0 pelanggaran terang & gelap; tanpa scroll samping di 375 px dan 1920 px pada layar kenalan kata unit 17–21.
- Laporan: daftar adegan terlemah.
