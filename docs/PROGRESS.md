# PROGRESS — Xué Mandarin v1

Diperbarui oleh setiap sesi kerja. Format: `- [x] Task — tanggal — model — ringkasan 1 baris`.

## Status task

- [x] 1 · Kerangka proyek + deploy — 2026-11-21 — Haiku (diperiksa Opus) — Vite+React+TS, halaman "segera hadir", deploy GitHub Pages sukses
- [x] 1b · Cek otomatis di CI + favicon — 2026-11-21 — Haiku (diperiksa Opus) — job `check` (typecheck, lint, test) wajib lolos sebelum build/deploy; favicon 学 ungu
- [x] 2 · Data kata HSK 1 — 2026-11-21 — Sonnet (diperiksa Opus) — 500 kata HSK 3.0 level 1 (pinyin, nada, jenis kata, arti EN CC-CEDICT, arti ID terjemahan mesin), skrip bisa diulang, 540 tes
- [x] 3 · Unit bertema + kalimat contoh — 2026-11-21 — Sonnet (diperiksa Opus, 1 kali perbaikan) — 20 unit bertema (20–31 kata), 2.405 kalimat Tatoeba beratribusi lewat workflow `fetch-tatoeba.yml`; semua unit ≥ 11 kalimat
- [x] 3b · Versi santai + dialog — 2026-11-21 — Opus menulis, Sonnet memeriksa (diperiksa Opus, 1 kali perbaikan) — 98 ungkapan santai lolos 5 lapis cek (4–5 per unit), 20 dialog 4–6 baris hanya kata HSK 1 + ungkapan lolos; bukti di `casual-evidence.json` lewat workflow `casual-evidence.yml`
- [x] 3c · Character sheet + daftar visual — 2026-11-21 — Opus (2 subagent, diperiksa Opus) — 13 tokoh SVG (depan/samping/belakang + 4 ekspresi + lembar) dari sistem rakit `npm run build:characters`; `visuals.json` 500/500 kata (139 benda, 117 aksi, 123 komik, 48 posisi, 41 pasangan, 32 hitungan)
- [x] 2b · Ganti HSK 1 ke 300 kata silabus 2025 — 2026-11-22 — Sonnet (diperiksa Opus, 1 kali perbaikan font) — 300 kata silabus ujian 2025 (becky82/mteh CC BY-SA 4.0, cocok 1:1 dengan PDF resmi CLEC); 266 ID lama dipakai ulang, 34 kata baru (L1-0501…0534), 234 kata lama ke `data/hsk2-preview/`; 21 unit (12–17 kata); 1.579 kalimat Tatoeba; 72 ungkapan santai; `npm run check:data` baru di CI
- [x] 3d · Tulis ulang dialog jadi alami — 2026-11-22 — Opus menulis, Sonnet memeriksa (diperiksa Opus, 1 ronde tulis ulang) — 21 dialog baru (1 per unit, 10 jenis tempat, tiap dialog punya tujuan), semua lolos cek kosakata 300 kata; 7 dialog ditulis ulang setelah ronde 1, semua akhirnya bernilai ≥ 4 (`data/hsk1/dialog-review.json`); kartu dialog kini menampilkan tempat + tujuan
- [ ] 0 · Tahap 0 "Dasar sebelum HSK 1" (keputusan pemilik 2026-11-22) — menunggu task 4b selesai (keputusan suara pemilik 2026-11-23, lihat "Butuh pemilik"); semua pekerjaan ada di cabang `task-0`
- [x] 4a · Contoh suara — 2026-11-21 — Sonnet (diperiksa Opus) — 7 kandidat (P1–P4 perempuan, L1–L3 laki-laki; Kokoro v1.0/v1.1-zh, MeloTTS) × 5 kata + 2 kalimat lewat `tts-samples.yml`, mp3 seragam (−16 LUFS ±0.6), Whisper 42/49 cocok; halaman `samples.html`. **Pemilik memilih P3 (perempuan) + L3 (laki-laki) pada 2026-11-22.**
- [ ] 4b · Audio semua materi — SEDANG DIKERJAKAN (mulai 2026-11-25 09:08 UTC; ronde 3 lanjutan dengan Opus, cabang `task-4b`, kunci lama basi)
- [x] 5 · Tampilan dasar — 2026-11-21 — Sonnet (diperiksa Opus) — tema + mode gelap, menu samping (layar lebar) / menu bawah (layar sempit), hash router, teks ID/EN tanpa reload, halaman Pengaturan; axe & tanpa scroll samping di 375/1366 lolos
- [x] 5b · Font Mandarin self-host — 2026-11-21 — Haiku (diperiksa Opus) — LXGW WenKai disubset & disimpan sendiri (inti 300 huruf HSK 1 ±64 KB per ketebalan, tambahan ±246 KB dimuat hanya bila perlu); Noto Sans SC dari Google Fonts dihapus; `npm run build:font`
- [x] 6 · Layar unit + peta belajar — 2026-11-21 — Opus (diperiksa Opus, 1 kali perbaikan kecil) — peta 20 unit + bintang + tes loncat (≥ 80 %), ringkasan unit (versi santai + dialog), kenalan kata (huruf WenKai 120 px berwarna nada, animasi coretan Hanzi Writer data lokal 384 huruf, contoh kalimat Tatoeba), latihan 12 soal (4 jenis, keyboard 1–4/Enter/Spasi); suara sementara dari perangkat
- [ ] 6b · Ilustrasi + animasi semua kata (bertahap per unit) — SEDANG DIKERJAKAN tahap 3 · unit 9–12 (mulai 2026-11-25 09:10 UTC)
  - [x] 6b tahap 1 · unit 1–3 — 2026-11-22 — Opus (diperiksa Opus) — 87 adegan SVG dari sistem rakit (`data/hsk1/scenes.json` → `npm run build:scenes`, ±10 KB/adegan), 39 pose tokoh, kartu ilustrasi di layar kenalan kata: gerak napas/kedip, klik/Enter/Spasi = aksi + suara, diam saat kurangi gerak; teks balon komik HTML huruf WenKai dengan kata disorot; axe lolos terang & gelap
  - [x] 6b tahap 2 · unit 1–8 — 2026-11-23 — Opus (diperiksa Opus) — 45 adegan baru (total 120, semua kata u01–u08), ruang keluarga yang makin terisi untuk kata keluarga u08, animasi asal-usul 人 dan 家; commit `Task 6b tahap 2` masuk & deploy sukses, dicentang sesi 2026-11-25
- [x] 7 · Empat game — 2026-11-23 — Opus (diperiksa Opus) — kartu bolak-balik, jodohkan dengan waktu, tebak nada, susun kalimat (seret + keyboard) per unit di `#/belajar/unit/<id>/game`; tombol "satu game singkat" di layar nilai latihan; skor terbaik tersimpan (ikut cadangan); semua game selesai hanya dengan keyboard, axe lolos terang & gelap, tanpa scroll samping di 375 px; kode game dimuat hanya saat dibuka (+4 KB awal)
- [x] 8 · Progres + ulangan harian + cadangan — 2026-11-22 — Sonnet (commit `Task 8` masuk & deploy sukses, tetapi sesinya terhenti sebelum mencentang; dicek ulang sesi 3d: semua tes lolos, layar Ulang & Progres terbuka tanpa galat, tanpa scroll samping di 375 px) — Leitner 5 kotak, target harian 10/20/30, hari berturut-turut, unduh/pulihkan cadangan
- [x] 9 · Kamus + Sumber + lapor salah — 2026-11-23 — Sonnet (diperiksa Opus, 1 kali perbaikan kecil) — cari lewat huruf/pinyin (dengan/tanpa tanda nada, angka nada, ü/v)/arti ID/EN, halaman detail kata + tautan ke unit, halaman `#/sumber` dari CREDITS.md, tombol "Lapor salah" (kamus & kenalan kata) membuka GitHub Issue terisi; axe lolos terang & gelap, tanpa scroll samping di 375 px
- [ ] 10 · Pengecekan akhir + rilis v1

## Butuh pemilik

- ~~**Task 0 (Tahap 0) — suara P3 salah nada di suku kata tunggal**~~ **Diputuskan pemilik 2026-11-23: metode A.** Untuk suku kata tunggal di Tahap 0: P3 tetap membaca suku katanya, lalu tinggi-rendah nadanya disamakan dengan rekaman orang asli dari `hugolpz/audio-cmn` (1.707 suku kata, CC BY-SA, penutur Chen Wang — wajib dicantumkan di CREDITS.md; file mentah diunduh lewat GitHub Actions). Rekaman asli hanya dipakai sebagai contoh nada, tidak diputar di website. Hasil tetap dicek Whisper + cek nada. Kalau hasilnya terdengar kasar/seperti mesin, itu dibereskan nanti di ronde penghalusan (pemilik: "nanti baru dihaluskan"), bukan dengan ganti suara. Pengganti rencana "pilihan 2 + cadangan 3" sebelumnya. Task 0 diambil setelah 4b selesai (pakai juga perbaikan 4b). Catatan lama:
  (2026-11-23) Layar, latihan, dan tes Tahap 0 sudah jadi di cabang `task-0`, tetapi hanya 133 dari 162 suara (82 %) lolos cek; targetnya 90 %. Sudah dua ronde Opus, jadi sesuai aturan dihentikan. Yang gagal kebanyakan memang salah ucap P3 (mis. 鸡 jī terdengar seperti "jì", 五 wǔ seperti "wù"): mesin suara ini sering membaca satu suku kata dengan nada turun. Pilihan:
  1. Terima 82 % sekarang: Tahap 0 langsung tayang, 29 suara yang gagal memakai suara bawaan perangkat.
  2. Tunggu hasil task 4b ronde 3 (sedang dicoba: nada suku kata tunggal dibetulkan otomatis, suaranya tetap P3). Kalau berhasil, cara yang sama dipakai untuk Tahap 0.
  3. Pakai suara lain khusus suku kata tunggal (mengubah keputusan suara di bagian 1).

- ~~Keputusan jumlah kata HSK 1~~ **Diputuskan 2026-11-22: ganti ke 300 kata silabus 2025 (task 2b).**

## Catatan & temuan

- 2026-11-23 (task 7): Tebak nada memakai nada tertulis di kamus; kata bernada ringan, 3+3, 不 dan 一 tidak dipakai (ditulis di layar). Tanpa suara di perangkat, tebak nada tetap jalan (huruf + pinyin tanpa tanda nada). Susun kalimat hanya memakai kalimat yang terpecah penuh jadi kata HSK 1 (24–45 kalimat per unit). "Main lagi" di game jodohkan kembali ke pilihan mode. Setelah task 4b masuk, game otomatis memakai file suara lewat `audio.ts`.

- 2026-11-21: Repo dijadikan public; GitHub Pages source = GitHub Actions.
- 2026-11-21 (task 2): 11 arti Inggris diperbaiki manual (`data/hsk1/en-overrides.json`), 16 kata memakai arti CEDICT dengan nada ringan berbeda; detail di `data/hsk1/SOURCES.json`. Sekitar 100 kata gabungan tidak punya jenis kata di sumber (`pos: []`).
- 2026-11-21 (task 3): 27 kata belum punya kalimat contoh Tatoeba yang lolos filter: 包子 本子 不客气 打球 东边 好玩儿 后边 教学楼 里边 没事儿 面条儿 女生 前边 请假 请进 日期 上车 书包 听写 外边 网友 小学 一块儿 一下儿 右边 中间 中学生. Bisa diisi nanti (mis. kalimat dialog task 3b). Kalimat dengan terjemahan Indonesia masih sedikit; kebanyakan hanya Inggris.
- 2026-11-21 (task 3b): 142 kandidat → 111 lolos (21 gugur karena < 2 sumber luar, mis. bentuk X死了/X啦/太棒了 tidak ada di kamus; 10 gugur di pemeriksa kedua, mis. 多谢 老铁 打的 回见 走人). 干嘛 gugur karena Wiktionary menandai satu artinya kasar. Unit 3 dan 17 hanya 4 ungkapan (masih dalam batas 3–5). Kalau `casual-candidates.json` diubah, workflow bukti jalan lagi; setelah itu jalankan `npm run build:casual` dan review ulang kandidat baru, supaya tes "hasil = build ulang" tetap lolos.
- 2026-11-21 (task 3c): Kakak digambar remaja (±90 % tinggi dewasa), padahal di dialog temannya "teman kuliah"; beberapa adegan visual menaruh Kakak di sekolah menengah. Perlu diselaraskan saat task 6b (cukup ubah umur di satu tempat). Alis gelap kurang terlihat di depan poni gelap (Guru, Teman kuliah) pada beberapa ekspresi. Pose tangan baru netral saja; pose lain dibuat di task 6b.
- 2026-11-21 (task 4a): `你好` dan `喝水` bukan entri tersendiri di `words.json` (dipecah 你+好, 喝+水); contoh tetap memakai keduanya. MeloTTS butuh versi pustaka lama, jadi dijalankan di lingkungan Python terpisah dalam workflow; unduhan BERT tambahannya belum dipatok versinya. Workflow hanya jalan otomatis di cabang selain `main` (atau dijalankan manual).
- 2026-11-21 (task 5): Warna nada 3 (#2B8A3E) hanya mencapai kontras 4,39:1 di atas putih (batas AA teks biasa 4,5), jadi nada 3 sebaiknya dipakai untuk huruf besar/tebal saja (batas 3:1). Teks putih di atas hijau #2F9E44 dan jingga #E8590C tidak cukup kontras, jadi tombol berteks putih memakai versi lebih gelap (#25803A, #C2410C); warna merek aslinya tetap dipakai untuk hiasan. Di layar sempit tombol bahasa ID/EN hanya ada di halaman Pengaturan.
- 2026-11-21 (task 5b): Tanda kutip ‘ ’ tidak ada di font WenKai (memakai font cadangan). File tambahan (extra, 970 huruf) ikut memuat huruf dari file bukti mentah (mis. `casual-evidence-raw.json`) yang tidak tampil di website; bisa dipersempit nanti bila perlu. Preload memakai versi tebal-biasa (400) padahal logo memakai 700; tidak merusak, bisa disesuaikan saat task 6.
- 2026-11-21 (task 6): Suara di layar belajar SEMENTARA memakai suara bawaan browser/perangkat (ditandai di layar); bila perangkat tidak punya suara Mandarin, tombol suara mati dengan keterangan dan soal "dengar → huruf" diganti. Task 4b cukup mengganti `src/lib/audio.ts`. Progres disimpan di `xue.progress.v1` (siap diperluas task 8). Bintang: ≥ 90 % = 3, ≥ 75 % = 2, ≥ 60 % = 1 (unit selesai bila ≥ 1 bintang). Data per unit di `public/data/hsk1/units/` dibuat ulang dengan `npm run build:lessons` setiap data di `data/hsk1/` berubah. Tempat "satu game singkat" di layar nilai menunggu task 7.
- 2026-11-22 (task 6b tahap 1): Kakak kini mahasiswa muda (±98 % tinggi dewasa); alis Guru & Teman sekelas kini terlihat. Adegan disimpan per id kata (`L1-xxxx`), jadi saat task 2b memindah kata ke `hsk2-preview`, adegannya tinggal ikut dipindah referensinya. Adegan terlemah: 他们/她们 (tokoh kecil), 们 (perlu membandingkan 2 panel), 叫 (balon "哥哥！" tidak memuat 叫, jadi tidak ada sorotan), 我/名字 (tangan menunjuk diri terbaca seperti tangan di dada), 次 (tali lompat kurang pas). Beberapa balon memakai huruf di luar HSK 1 (钱 茶 动 用). Angka 6–10 tidak memakai isyarat jari China (hanya benda + angka). Edit adegan langsung di `scenes.json`, lalu `npm run build:scenes`.
- 2026-11-22 (task 2b): Hanya 1 dialog lama (d-u18, kini di unit 19) lolos cek kosakata 300 kata; 19 lainnya disimpan di `data/hsk1/dialogs-retired.json` untuk task 3d — sampai 3d selesai, 20 dari 21 unit belum punya dialog. Unit u02, u03, u04 belum punya ungkapan santai (50 dari 142 draf dikeluarkan karena padanannya di luar 300 kata); penempatan unit ada di `casual-remap.json` (draf `casual-candidates.json` sengaja tidak diubah supaya workflow bukti tidak jalan). u03 (Angka 0–10) hanya 3 kalimat contoh. Pinyin mengikuti tabel resmi 2025 (mis. 不客气 búkèqi, 一下 yíxià, 一些 yìxiē). 34 terjemahan Indonesia kata baru = terjemahan mesin. Adegan 6b tahap 1: 75 tetap di HSK 1, 12 ikut kata yang pindah ke `hsk2-preview` (SVG tidak dihapus) — tahap 6b berikutnya mengikuti unit baru. Workflow `fetch-tatoeba.yml` sekarang juga membangun ulang `build:lessons` dan subset font (kalimat baru bisa membawa huruf baru); commit dari bot tidak memicu deploy, jadi perubahan baru tampil di website setelah push berikutnya. Sesi task 7 dan 8 (berjalan bersamaan) perlu menyesuaikan diri dengan unit baru saat rebase.
- 2026-11-22 (task 3d): Dialog lama (termasuk d-u18) tidak tampil lagi; semua ada di `dialogs-retired.json` sebagai arsip. Sumber dialog baru: `data/hsk1/dialogs-natural.json` → `npm run build:casual` → `dialogs.json` (+ `build:lessons`). Setiap perubahan teks Mandarin dialog harus dinilai ulang dan dicatat di `dialog-review.json` (ada tes yang mencocokkan teksnya). Batasan 300 kata membuat beberapa ungkapan paling alami tidak bisa dipakai (mis. 看不清, 试试, 头疼), jadi u17/u18/u21 memakai jalan lain (nilai 4). Pinyin dialog memakai nada dasar (一个 tertulis yī gè, bukan yí gè) — bawaan pemecah kata lama; bisa dibenahi saat task 0/4b. Di layar sempit, pinyin di atas huruf kadang berdempetan (tampilan ruby lama, bukan baru). Font tambahan dibangun ulang (+5 huruf dari laporan penilaian). Kunci "SEDANG DIKERJAKAN" task 7 dihapus karena basi (sesinya terhenti 2026-11-22 ±01:00 UTC tanpa hasil).
- 2026-11-23 (task 9): Pinyin di kartu kamus dibuat 19 px tebal karena warna nada 3 tidak cukup kontras untuk teks kecil. Isi halaman Sumber hanya berbahasa Indonesia (dalam mode EN ada catatannya). Kamus memuat semua file unit (±750 KB sebelum dikompres) saat pertama dibuka; bisa diganti indeks kecil khusus kamus nanti bila terasa lambat. Melapor salah butuh akun GitHub.

### Contoh 3 dialog baru (untuk dilihat pemilik)

**Unit 9 · Memesan di warung mi** (Warung mi)
- Pelayan: 您好，吃什么？ — Halo, mau makan apa?
- Ibu: 有包子吗？ — Ada bakpao?
- Pelayan: 包子没有了。有饺子和面条儿。 — Bakpaonya habis. Ada pangsit dan mi.
- Ibu: 那……饺子吧。 — Kalau begitu... pangsit saja.
- Pelayan: 好的。喝什么？ — Baik. Minumnya apa?
- Ibu: 不喝了，谢谢。 — Tidak usah, terima kasih.

**Unit 11 · Janjian lewat telepon** (Telepon)
- Teman kuliah: 喂，明天上午有时间吗？ — Halo, besok pagi ada waktu?
- Kakak: 上午没有。下午呢？ — Pagi tidak bisa. Kalau siang?
- Teman kuliah: 下午也好。几点？ — Siang juga boleh. Jam berapa?
- Kakak: 两点半，在书店，怎么样？ — Setengah tiga, di toko buku. Bagaimana?
- Teman kuliah: 好，两点半。不见不散！ — Oke, setengah tiga. Aku tunggu di sana, ya!
- Kakak: 不见不散！ — Aku pasti datang!

**Unit 13 · Macet di taksi** (Di dalam taksi)
- Sopir: 去哪儿？ — Ke mana?
- Ibu: 师傅，去电影院。 — Pak, ke bioskop.
- Sopir: 好。……前头堵车了。电影院在那儿。 — Baik. ... Di depan macet. Bioskopnya di sana itu.
- Ibu: 那我在这儿下车吧。多少钱？ — Kalau begitu saya turun di sini saja. Berapa?
- Sopir: 十八块。 — Delapan belas yuan.
- Ibu: 好。谢谢师傅！ — Oke. Terima kasih, Pak!
- Sopir: 慢走！ — Hati-hati!
