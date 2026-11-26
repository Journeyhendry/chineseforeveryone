# Task 6c · Stage 2 — UI + animasi kalimat/dialog per kata

Bagian dari `docs/tasks/task-6c.md` (keputusan pemilik ada di sana). Data dari stage 1: `data/hsk1/word-sentences.json` (300 kata: `sentence`, `dialog?`, `scene.fit` = keep 34 / rebubble 106 / redraw 93 / new 67).

Model: Opus (UI + adegan), diperiksa Opus (sesi utama). Cabang `task-6c`, push WIP ≤ 45 menit.

Dikerjakan dalam dua bagian berurutan di sesi yang sama:
- **2a** — pemutar kalimat/dialog di kartu adegan + data ke layar + isi balon adegan `keep`/`rebubble` (140) diganti kalimat/dialog.
- **2b** — 93 adegan `redraw` (unit 1–16) digambar ulang sesuai `scene.note` dan kalimatnya.
Adegan `new` (unit 17–21, 67 kata) = stage 4, bukan di sini. Audio baru = stage 3 (sampai saat itu, baris tanpa file suara memakai suara perangkat seperti sekarang, lewat `src/lib/audio.ts`).

## 2a · Scope
1. **Data ke layar**: `npm run build:lessons` memasukkan per kata `sentence` (hanzi, pinyin, id, en, speaker, source, sourceId, outsideWords) dan `dialog?` (reason id/en, lines: who, hanzi, pinyin, id, en) dari `word-sentences.json` ke `public/data/hsk1/units/*.json` (tipe di `src/lib/lessons.ts`). Hanya field yang dipakai layar (tanpa `analysis`).
2. **Adegan berurutan** (`scenes.json` + `src/art/scenes/types.ts`): balon boleh punya `line` (nomor urut baris dialog, 0-based) — balon dengan `line` sama muncul bersama. Adegan untuk kata ber-dialog memakai satu balon per baris dialog (tokoh bergantian, `from` = tokoh yang bicara); adegan kalimat tunggal: satu balon berisi kalimat (`line: 0`). Ukuran balon disesuaikan panjang teks; teks tetap HTML huruf WenKai (bukan di SVG). Kata yang diajarkan disorot (`highlight`). `check:visuals` / tes adegan diperbarui: teks balon (gabungan per `line`) harus sama dengan `sentence.hanzi` atau baris `dialog` untuk adegan `keep`/`rebubble`.
3. **Pemutar di `WordScene`**: klik / Enter / Spasi pada adegan = putar urutan: baris 1 → balon 1 muncul (pop lembut) + tokoh pembicara bergerak (preset aksi yang ada atau gerak bicara kecil) + suara baris itu (P3, atau L3 untuk tokoh laki-laki: yeye, baba, gege, seller?/driver/waiter sesuai `gender` tokoh di `dialogs-natural.json` → `speakers`), tunggu suara selesai (atau waktu perkiraan bila tanpa suara), lanjut baris berikutnya. Tombol **Putar ulang** dan **Pelan** (kecepatan pelan yang sudah ada, `SLOW_RATE`). Saat diam (sebelum diputar / setelah selesai) semua balon tampil penuh. Klik saat sedang diputar = mulai ulang dari awal (tidak menumpuk suara). `prefers-reduced-motion`: tanpa animasi gerak, balon semua tampil, suara tetap diputar berurutan bila diklik. Pindah kata saat memutar → suara berhenti.
4. **Teks di bawah adegan** (kartu yang sama, bukan kartu terpisah): kalimat/dialog baris per baris — nama tokoh (ID/EN), huruf dengan kata disorot, pinyin (ikut pengaturan "tampilkan pinyin"), terjemahan bahasa aktif; untuk dialog tampilkan alasan singkat (`reason`). Baris yang sedang diputar ditandai. Kata luar HSK 1 diberi tanda kecil "di luar HSK 1". Sumber Tatoeba (bila `source: tatoeba`) ditautkan seperti contoh lama.
5. **Contoh lama**: kartu "Contoh kalimat" Tatoeba menjadi "Contoh lain", tanpa kalimat yang sama dengan kalimat utama; boleh dilipat (`<details>`) supaya halaman tidak panjang. Tidak ada info "dipelajari di Unit N".
6. Adegan `redraw` (sampai 2b) dan kata tanpa adegan (`new`): kalimat/dialog tetap tampil sebagai teks + tombol putar di kartu yang sama (tanpa gambar, atau gambar lama dengan balon lama untuk `redraw` — pilih yang tidak membingungkan: gambar lama TANPA balon lama + teks kalimat di bawah).
7. i18n ID/EN untuk semua teks baru. Tidak merusak layar lebar (task 5c) dan 375 px.

## 2b · Scope
93 adegan `redraw`: gambar ulang di `scenes.json` dengan sistem rakit (pose/benda/latar yang ada; tambah pose/benda baru bila perlu di `src/art/`) supaya gambar menunjukkan situasi kalimat/dialog (`scene.note`), balon berisi kalimat/dialog dengan `line`. `alt` id/en disesuaikan dengan gambar baru. `play` preset dipilih yang cocok. `npm run build:scenes` deterministik.

## Kriteria lolos (diperiksa sesi utama)
- `npm ci`, typecheck, lint, test, `check:data`, `check:visuals`, build lolos.
- 233 adegan u01–u16: teks balon = kalimat/dialog stage 1 (cek otomatis), tidak ada balon yang menutupi wajah tokoh, teks muat di balon (render PNG beberapa adegan per unit + screenshot browser).
- Pemutar: urutan baris benar, satu suara pada satu waktu, Putar ulang/Pelan jalan, keyboard Enter/Spasi pada adegan, reduced-motion diam & balon penuh, pindah kata menghentikan suara.
- axe 0 pelanggaran terang & gelap; tanpa scroll samping di 375 px dan 1920 px.
- Laporan: daftar adegan terlemah.
