# Task 5 · Tampilan dasar

Model: Sonnet (implementasi), sesi utama Opus memeriksa. Prasyarat: task 1 (selesai).

## Tujuan
Website punya "rumah" yang siap diisi: tema warna/font sesuai BUILD_PLAN bagian 1, menu samping (Belajar, Ulang, Kamus, Progres) yang pindah ke bawah di layar sempit, perpindahan halaman yang aman di GitHub Pages, teks dua bahasa (ID/EN) yang bisa diganti tanpa memuat ulang, halaman Pengaturan, dan mode gelap. Halaman isi masih kosong ("segera hadir"); task 6, 8, 9 akan mengisinya.

Acuan tampilan: `docs/tasks/ref/mockup-1-peta-belajar.dc.html` (artboard 1 mockup pemilik; salinan untuk dibaca, bukan untuk di-build). Ambil gaya menu samping, logo 学, tombol bahasa ID/EN, kartu (garis 3px #231942, bayangan `0 4–6px 0 #231942`, sudut 14–28px), ukuran sentuh ≥ 44px. Peta unit di tengah BUKAN bagian task ini (task 6).

## Scope
1. **Tema** `src/styles/theme.css` (diimpor dari `src/main.tsx`, menggantikan isi lama `src/index.css` yang tidak terpakai):
   - CSS variables untuk warna (latar #FFF7E8, permukaan/kartu, teks #231942, teks lembut, ungu #6741D9, kuning #FFD43B, hijau #2F9E44, jingga #E8590C, garis, bayangan), 5 warna nada tetap (`--tone-1` #C92A2A, `--tone-2` #B45309, `--tone-3` #2B8A3E, `--tone-4` #1864AB, `--tone-5` #5C5470), font (`--font-display` Baloo 2, `--font-body` Nunito, `--font-hanzi` Noto Sans SC), radius, jarak.
   - Mode gelap: blok `[data-theme="dark"]` yang mengganti token latar/permukaan/teks/garis. Warna nada **tidak berubah** (keputusan final); karena itu ada token `--tone-surface` yang tetap terang di mode gelap, dan teks berwarna nada hanya boleh diletakkan di atas `--tone-surface`.
   - Atribut `data-theme` di `<html>` diatur dari pengaturan: `system` (ikut `prefers-color-scheme`, berubah langsung saat sistem berubah), `light`, `dark`. Hindari kedipan tema: skrip kecil inline di `index.html` membaca pengaturan dari localStorage sebelum React jalan (dibungkus try/catch).
   - `prefers-reduced-motion`: matikan transisi/animasi.
2. **Kerangka layar** `src/components/AppShell.tsx` (+ CSS):
   - Lebar ≥ 768px: menu samping kiri (logo 学 + "Xué Mandarin", 4 menu utama dengan ikon garis SVG inline `aria-hidden`, lalu di bawah: tombol bahasa ID/EN dan tautan Pengaturan).
   - Lebar < 768px: menu jadi bar bawah tetap (Belajar, Ulang, Kamus, Progres, Pengaturan; ikon + label pendek), isi halaman diberi ruang bawah supaya tidak tertutup; tombol bahasa pindah ke halaman Pengaturan / header kecil.
   - `<nav aria-label=…>`, menu aktif pakai `aria-current="page"`, tautan "Lewati ke isi" (skip link) sebagai elemen pertama yang bisa di-Tab, `<main id="isi" tabindex="-1">` dan fokus dipindah ke `<main>` (atau judul halaman) saat pindah halaman, `document.title` ikut halaman.
   - Gaya fokus terlihat jelas (`:focus-visible`, garis 3px kontras).
3. **Router hash** `src/lib/router.ts` (tanpa pustaka baru): rute `#/belajar` (bawaan; `#/` dan kosong diarahkan ke sini), `#/ulang`, `#/kamus`, `#/progres`, `#/pengaturan`; rute tak dikenal → halaman "Tidak ditemukan" dengan tautan kembali. Fungsi murni `parseHash(hash) → { name, params }` (siap untuk rute bertingkat nanti, mis. `#/belajar/unit/3`) + hook `useRoute()` yang mendengar `hashchange`.
4. **i18n** `src/i18n/id.json`, `src/i18n/en.json` (kunci sama persis), `src/i18n/index.tsx`: provider + hook `useT()` → `t(key, vars?)` dengan isian `{name}`. Bahasa bawaan `id`. Ganti bahasa langsung tanpa reload, `<html lang>` ikut (`id`/`en`). Kunci hilang → tampilkan kunci + `console.warn` di mode dev. **Semua teks yang terlihat** (menu, judul, label, aria-label, title halaman, pesan "segera hadir", 404) berasal dari file i18n; yang boleh tetap literal hanya "Xué Mandarin" dan huruf 学.
5. **Pengaturan** `src/lib/settings.ts` + halaman `src/pages/SettingsPage.tsx`:
   - Bentuk: `{ version: 1, lang: 'id'|'en', showPinyin: boolean, voiceSpeed: 0.75|1, soundEffects: boolean, theme: 'system'|'light'|'dark' }`, bawaan `{lang:'id', showPinyin:true, voiceSpeed:1, soundEffects:true, theme:'system'}`.
   - Disimpan di localStorage kunci `xue.settings.v1`; baca/tulis dibungkus try/catch; data rusak/tidak lengkap/nilai tak dikenal → dipulihkan ke bawaan per kolom (fungsi murni `normalizeSettings(raw)`); website tetap jalan kalau localStorage tidak ada.
   - Halaman Pengaturan: kontrol yang benar secara HTML (`<fieldset>/<legend>` + radio untuk bahasa, kecepatan suara "Normal / Pelan", tema "Ikut perangkat / Terang / Gelap"; checkbox/switch ber-label untuk pinyin dan efek suara). Perubahan langsung berlaku dan tersimpan.
6. **Halaman isi sementara** `src/pages/` : Belajar, Ulang, Kamus, Progres — judul + kartu "segera hadir" bergaya tema. Halaman Belajar juga menampilkan contoh kecil "warna nada" (mā má mǎ mà ma, masing-masing warna nadanya, di atas `--tone-surface`) supaya token nada terlihat dan bisa dicek di mode gelap.
7. **Tes** (vitest, file `*.test.ts` di samping modulnya):
   - i18n: `id.json` dan `en.json` punya himpunan kunci yang sama, tidak ada nilai kosong, isian `{var}` sama di kedua bahasa.
   - router: `parseHash` untuk kosong, `#/`, tiap rute, rute tak dikenal, garis miring berlebih, parameter.
   - settings: `normalizeSettings` untuk null, JSON rusak, kolom kurang, nilai salah tipe, nilai benar.
   - kontras: tes membaca `src/styles/theme.css`, mengambil nilai hex token untuk tema terang dan gelap, dan memeriksa rasio kontras WCAG ≥ 4.5 untuk pasangan teks/latar yang dipakai (teks di latar, teks di permukaan, teks lembut di latar & permukaan, teks putih di tombol ungu/hijau/jingga, tiap warna nada di `--tone-surface`), dan ≥ 3 untuk garis fokus terhadap latar. Daftar pasangan ditulis di tes.
8. Tidak ada pustaka baru selain (opsional) devDependency kecil untuk tes. Tidak ada request jaringan baru selain Google Fonts yang sudah ada.

## Out of scope
- Peta unit, layar kata, game, Leitner, kamus, audio (task 6–9). Font LXGW WenKai (task 5b).
- Mengubah data di `data/`, workflow, `public/samples.html`, gambar tokoh.

## Acceptance criteria
- `npm ci`, `npm run typecheck`, `npm run lint` (tanpa error baru), `npm run build`, `npm test` lolos.
- Semua teks yang terlihat berasal dari i18n (dicek: ganti ke EN → tidak ada teks Indonesia tersisa di menu/halaman, kecuali nama "Xué Mandarin").
- Ganti bahasa & tema langsung berlaku tanpa reload dan tetap setelah reload.
- Navigasi keyboard: Tab mencapai skip link, semua menu, tombol bahasa, semua kontrol Pengaturan; fokus terlihat; Enter/Space bekerja.
- Kontras WCAG AA (tes kontras lolos; cek axe tanpa pelanggaran `color-contrast` di terang & gelap).
- Tidak ada scroll horizontal di lebar 375px (`document.documentElement.scrollWidth <= 375`) di semua halaman; menu bawah tampil di 375px, menu samping di 1366px.
- Hash router bekerja di build produksi dengan `base: '/chineseforeveryone/'` (reload di `#/kamus` tetap membuka Kamus). `samples.html` tetap ada di `dist/`.

## File terkait
- Baru: `src/styles/theme.css`, `src/components/AppShell.tsx` (+ css), `src/components/icons.tsx`, `src/lib/router.ts`, `src/lib/settings.ts`, `src/i18n/{index.tsx,id.json,en.json}`, `src/pages/*.tsx`, tes terkait.
- Diubah: `src/App.tsx`, `src/main.tsx`, `index.html`, `src/index.css` (dihapus atau dikosongkan).
