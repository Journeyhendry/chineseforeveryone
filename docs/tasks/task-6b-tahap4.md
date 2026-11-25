# Task 6b · tahap 4 — Ilustrasi + animasi unit 13–16

Model: Opus (implementasi), sesi utama Opus memeriksa. Prasyarat: 6b tahap 1–3 (selesai, 177 adegan u01–u12).
Sistem rakit, aturan SVG, animasi, komponen `WordScene` sudah ada — baca `docs/tasks/task-6b.md` (aturan & acceptance tahap 1), `docs/tasks/task-6b-tahap2.md` dan `docs/tasks/task-6b-tahap3.md` (tambahan: preset `origin` dan `clock`, latar `living`, hewan, jam, kalender, kardus, rumah, dll.). Tahap 4 **memakai sistem yang sama**, tidak membuat sistem baru. Pakai ulang benda yang sudah ada (jam, tempat tidur, meja, wajan, mangkuk, kukusan, sepeda, rumah, sekolah, dll.).

## Tujuan
Melengkapi **semua kata unit u13–u16** (56 adegan baru → total 233):
- u13 Tempat di kota & transportasi (13): 店 商店 书店 超市 饭店 电影院 公司 车 出租车 火车 飞机 坐 开车
- u14 Kegiatan sehari-hari (16): 起床 穿 衣服 早饭 午饭 晚饭 做饭 睡 睡觉 做 找 开 了 正在 再 还 (一下 sudah ada — jangan diubah)
- u15 Suka, mau & bisa (12): 喜欢 爱 高兴 想 要 不要 会 能 可以 觉得 知道 认识
- u16 Sekolah (15): 学校 学生 老师 学 学习 上学 课 上课 下课 小学 小学生 中学 中学生 大学 大学生

Rencana adegan per kata ada di `data/hsk1/visuals.json` (`type`, `scene`); boleh disederhanakan supaya terbaca di kotak kecil — alt mengikuti gambar sebenarnya, dan teks `scene` kata itu diselaraskan dengan alt.

Khusus:
- **Tempat (u13)**: bangunan/toko dibedakan lewat isi/benda, bukan tulisan (tanpa papan nama berhuruf, tanpa merek): 店 (kios buah), 商店 (rak makanan ringan + kasir), 书店 (rak buku), 超市 (troli + lorong rak), 饭店 (meja bundar + pelayan), 电影院 (layar + kursi gelap), 公司 (gedung kantor). Kendaraan: 车 (beberapa kendaraan), 出租车 (taksi dengan lampu atap, tanpa huruf), 火车 (kereta cepat), 飞机.
- **Umur tokoh**: Kakak (`gege`) sekarang **mahasiswa**. Jangan pakai Kakak untuk 中学/中学生; pakai tokoh `classmate` atau tokoh lain yang cocok umur sekolah menengah. 小学/小学生 = Adik. 大学/大学生 = Kakak / teman kuliah.
- **Pasangan & kata tugas**: 上课/下课 dibedakan jelas (masuk & duduk vs keluar berhamburan); 睡 vs 睡觉 tidak identik; 早饭/午饭/晚饭 dibedakan lewat isi + jam/matahari/bulan (pakai jam & `day-dial` yang ada); 了 (sebelum → sesudah, 2 panel), 正在 (sedang berlangsung), 再 (minta lagi), 还 (masih … walau sudah malam); 高兴 = pasangan (senang vs sedih); 要/不要 jelas beda; 会 vs 能 tidak tertukar (会 = keterampilan yang dipelajari, 能 = mampu/kuat). Kata modal/perasaan boleh memakai balon (teks HTML seperti biasa) supaya makna jelas.
- 爱 dan 喜欢 jangan identik (爱 = pelukan keluarga, 喜欢 = suka benda).

Dibolehkan menambah ke pustaka: benda (`props.ts`), latar (`backgrounds.ts`, pakai ulang bila cocok), pose baru (sebagai data), preset aksi baru (CSS di `scene.css`). Tokoh pendukung baru hanya bila perlu, lewat sistem tokoh yang sama.

## Out of scope
- Unit 17–21 (tahap berikutnya). Lottie. Thumbnail di tempat lain. Audio (task 4b, cabang `task-4b`, `src/lib/audio.ts`).
- Mengubah `words.json`, `units.json`, kalimat, dialog, casual, BUILD_PLAN bagian 1, adegan u01–u12 yang sudah ada (kecuali perbaikan bug, dicatat).
- Game, Tahap 0 (cabang `task-0`).

## Acceptance criteria
1. `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run check:data`, `npm run check:visuals` lolos; `npm run build:characters`, `npm run build:scenes`, `npm run build:lessons` dijalankan ulang → `git status` bersih.
2. Setiap kata u01–u16 punya tepat satu adegan (tes diperluas); total adegan HSK 1 = 233. Adegan u01–u12 tidak berubah byte (kecuali perbaikan bug yang dicatat).
3. Render PNG (`rsvg-convert`, ±480 px dan ±320 px) ke-56 adegan baru: gaya konsisten, tokoh tidak terpotong/lepas, lengan menempel, makna terbaca di ±320 px, tidak ada teks tertulis selain angka, umur tokoh sesuai. ≤ 4 "kurang jelas tapi tidak salah" boleh dicatat; tidak boleh salah makna atau rusak.
4. Build produksi (`vite preview`): kata u13–u16 menampilkan ilustrasi bergerak halus; klik/Enter/Spasi → aksi; tidak ada error konsol (selain Google Fonts yang diblokir sandbox); tidak ada scroll ke samping di 375 px; axe tanpa pelanggaran di layar kata (terang & gelap); reduced-motion = tanpa animasi.
5. Tiap SVG ≤ 40 KB; bundel JS utama tidak bertambah > 5 KB gzip.

## File
- Diubah/baru: `data/hsk1/scenes.json`, `data/hsk1/visuals.json` (hanya teks `scene` kata u13–u16), `src/art/scenes/**`, `src/art/characters/**` (hanya bila perlu pose/tokoh), `public/art/scenes/**`, `public/art/characters/**` (hanya bila tokoh berubah), `src/pages/learn/scene.css`, `src/pages/learn/WordScene.tsx` (hanya bila perlu), tes terkait, `public/data/hsk1/units/**` (hasil `build:lessons` bila berubah), `docs/tasks/task-6b-tahap4.md` (catatan temuan).
