# Task 3c · Character sheet + daftar visual per kata

Model: Opus (dua subagent paralel: A = tokoh SVG, B = daftar visual), sesi utama Opus memeriksa. Prasyarat: task 2 (selesai).

## Tujuan
1. Semua tokoh "Keluarga Xiǎo" + tokoh pendukung tersedia sebagai SVG gaya B "kartun hangat" yang konsisten, dirakit dari bagian-bagian (sistem rakit), siap dipakai ulang di ilustrasi kata (task 6b).
2. Setiap kata HSK 1 (500 kata di `data/hsk1/words.json`) punya rencana visual: jenis visual + deskripsi adegan singkat.

## Acuan gaya (wajib diikuti)
- `docs/tasks/ref/mama-wave.svg` = tokoh Ibu dari mockup (acuan proporsi, warna, garis). `mama-eat.svg`, `house-jia.svg` = contoh adegan.
- Garis luar #231942, tebal 4 (detail kecil 3–3.5), `stroke-linejoin/linecap: round`, warna rata (tanpa gradien, tanpa filter, tanpa teks). Kulit #F6D3B3 (leher #EDBE98), pipi #F28B82 opacity .55, mata elips #231942 + titik putih.
- Proporsi Ibu: viewBox 0 0 300 470, kepala besar (lebar ±108), badan ±100, kaki sampai y≈432, bayangan lantai elips di y≈446. Dewasa lain setinggi Ibu (Ayah sedikit lebih tinggi/lebar), Kakek/Nenek sedikit lebih pendek, Kakak (remaja) ±90 %, Adik (anak) ±75 % dengan kepala relatif lebih besar. Semua tokoh memakai viewBox yang sama 0 0 300 470 dengan kaki di garis lantai yang sama, supaya bisa ditaruh berdampingan.
- Tiap tokoh punya ciri yang mudah dibedakan (siluet rambut, warna baju, aksesori): mis. Kakek kacamata + rambut putih, Nenek sanggul abu-abu + kardigan, Ayah kemeja, Ibu sesuai acuan (baju merah #D9534F + celemek), Kakak hoodie, Adik kuncir dua, penjual celemek/topi, dokter jas putih + stetoskop, guru kacamata + buku. Tidak meniru tokoh/karakter terkenal mana pun.

## Scope
### A. Tokoh (subagent A)
Tokoh (id sama dengan `speakers` di `data/hsk1/dialogs.json`): `yeye` Kakek, `nainai` Nenek, `baba` Ayah, `mama` Ibu, `gege` Kakak laki-laki, `meimei` Adik perempuan, `seller` Penjual, `doctor` Dokter, `teacher` Guru, `waiter` Pelayan, `driver` Sopir, `friend` Teman, `classmate` Teman sekelas (13 tokoh, semua id yang dipakai `dialogs.json`; gender ikut `speakers` di sana). Tokoh pendukung boleh berbagi bagian tubuh dengan tokoh keluarga tetapi harus beda wajah/rambut/baju.

- Sumber tunggal: `scripts/build-characters.ts` (jalan dengan `npm run build:characters`, tsx) + definisi bagian di `src/art/characters/` (TypeScript murni, tanpa DOM): bagian bersama (kepala, mata, alis, mulut per ekspresi, tangan, sepatu, bayangan) + spesifikasi per tokoh (warna, rambut, baju, aksesori, skala). Skrip menulis file SVG deterministik (jalan ulang → hasil byte-identik).
- Output di `public/art/characters/`:
  - `<id>/front.svg`, `<id>/side.svg` (menghadap kanan), `<id>/back.svg`
  - `<id>/expr-happy.svg`, `expr-sad.svg`, `expr-surprised.svg`, `expr-angry.svg` (tampak depan, hanya wajah/alis/mulut berubah)
  - `<id>/sheet.svg`: lembar karakter (7 gambar di atas berjajar, tanpa teks; nama tokoh ada di manifest)
  - `lineup.svg`: semua tokoh tampak depan berdampingan di satu garis lantai (cek proporsi)
  - `manifest.json`: `{ version: 1, viewBox: "0 0 300 470", views: [...], expressions: [...], characters: [{ id, name: {id, en}, gender, role: "family"|"support", files: {front, side, back, expressions: {happy,...}, sheet} }] }`
- Tiap SVG: `xmlns`, `viewBox`, `role="img"` + `aria-label` (bahasa Inggris singkat), grup bernama dengan `id`/`class` per bagian (`head`, `body`, `arm-left`, `arm-right`, `legs`, `eyes`, `mouth`, …) agar bisa dianimasikan nanti. Tanpa `<style>`, `<script>`, `<text>`, gambar luar, atau `foreignObject`. Ukuran per file ≤ 20 KB (kecuali `lineup.svg`, lembar cek ≤ 64 KB, tidak dipakai di aplikasi).
- `mama/front.svg` harus mirip acuan (boleh dirapikan; pose tangan turun/netral, bukan melambai).
- Tes `src/art/characters.test.ts`: semua tokoh × semua view/ekspresi ada; SVG valid XML; viewBox sama; tidak ada elemen terlarang; warna garis hanya #231942; skrip deterministik (bangun ulang ke folder sementara = file di repo).
- `CREDITS.md`: catat bahwa ilustrasi tokoh dibuat Claude (asli, lisensi sama dengan repo).

### B. Daftar visual (subagent B)
- `data/hsk1/visuals.json`: `{ version: 1, items: [ { wordId, hanzi, type, scene: { id, en }, characters: [...], props: [...], pairWordId? } ] }`, satu entri per kata, urut sesuai `words.json`.
  - `type`: `object` (benda/tempat/orang yang bisa digambar), `action` (kata kerja: tokoh melakukan sesuatu), `pair` (sifat yang digambar berdampingan dengan lawannya; isi `pairWordId` bila lawannya kata HSK 1), `count` (angka/takaran/penggolong: digambar sebagai sejumlah benda), `position` (arah/letak: benda relatif terhadap patokan), `comic` (kata tugas, kata tanya, partikel, salam: adegan komik 1–2 panel dengan balon kosong/ikon).
  - `scene.id`/`scene.en`: 1–2 kalimat adegan konkret yang bisa digambar (siapa, sedang apa, benda apa), memakai tokoh dari daftar di atas bila ada orang. Berlatar kehidupan China daratan sekarang bila relevan. Tanpa teks tertulis di gambar (kecuali angka), tanpa merek, tanpa tokoh terkenal.
  - `characters`: id tokoh yang muncul (boleh kosong); `props`: daftar benda (slug Inggris, huruf kecil, `-`), dipakai ulang antar kata bila sama (mis. `bowl`, `table`).
- Skrip validasi `scripts/check-visuals.ts` (`npm run check:visuals`) dan tes `src/lib/visuals.test.ts`: tiap kata tepat satu entri, `hanzi` cocok, `type` valid, `scene` id+en tidak kosong, `characters` hanya id yang dikenal (daftar tokoh di atas), `pairWordId` (bila ada) menunjuk kata yang ada dan bukan dirinya sendiri; ringkasan jumlah per type dicetak.

## Out of scope
- Ilustrasi per kata, animasi, `scenes.json` (task 6b). Komponen React / tampilan (task 5/6). Lottie.
- Mengubah `words.json`, `units.json`, dialog, atau keputusan BUILD_PLAN bagian 1.

## Acceptance criteria
1. `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` lolos; `npm run build:characters` dua kali → `git status` bersih.
2. Render PNG (`rsvg-convert`) semua `sheet.svg` dan `lineup.svg`: tokoh konsisten (proporsi, warna, tebal garis), ciri tiap tokoh jelas, tampak samping/belakang masuk akal, 4 ekspresi terbaca jelas berbeda; tidak ada bagian lepas/terpotong.
3. `mama/front.svg` jelas tokoh yang sama dengan acuan mockup.
4. `visuals.json` mencakup 500/500 kata, lolos `npm run check:visuals`; sampel acak 30 entri dinilai masuk akal oleh pemeriksa.
5. Tidak ada file di luar daftar "File" yang berubah (kecuali `package.json` skrip baru dan `CREDITS.md`).

## File
- Baru: `scripts/build-characters.ts`, `src/art/characters/*.ts`, `src/art/characters.test.ts`, `public/art/characters/**`, `data/hsk1/visuals.json`, `scripts/check-visuals.ts`, `src/lib/visuals.ts` (opsional, fungsi validasi), `src/lib/visuals.test.ts`, `docs/tasks/ref/*.svg` (acuan).
- Diubah: `package.json` (skrip `build:characters`, `check:visuals`), `CREDITS.md`.
