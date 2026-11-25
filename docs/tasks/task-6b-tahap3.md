# Task 6b · tahap 3 — Ilustrasi + animasi unit 9–12

Model: Opus (implementasi), sesi utama Opus memeriksa. Prasyarat: 6b tahap 1 dan 2 (selesai, 120 adegan u01–u08).
Sistem rakit, aturan SVG, animasi, komponen `WordScene` sudah ada — baca `docs/tasks/task-6b.md` (aturan & acceptance tahap 1) dan `docs/tasks/task-6b-tahap2.md` (tambahan tahap 2: preset `origin`, latar `living`, hewan, kartu huruf). Tahap 3 **memakai sistem yang sama**, tidak membuat sistem baru.

## Tujuan
Melengkapi **semua kata unit u09–u12** (57 adegan baru → total 177):
- u09 Makanan & minuman (17): 吃 喝 饭 米饭 菜 水 茶 牛奶 杯子 水果 苹果 鸡蛋 面包 包子 饺子 面条儿 好吃
- u10 Hari, tanggal & tahun (14): 天 今天 明天 昨天 星期 星期天 星期日 日 月 年 今年 明年 去年 白天
- u11 Jam & waktu (14): 现在 点 分 分钟 小时 时间 时候 早上 上午 中午 下午 晚上 早 晚
- u12 Arah, pergi & datang (12): 上 下 前 后 里 外 外边 边 来 去 回 到

Rencana adegan per kata ada di `data/hsk1/visuals.json` (`type`, `scene`); boleh disederhanakan supaya terbaca di kotak kecil — alt mengikuti gambar sebenarnya, dan teks `scene` kata itu diselaraskan dengan alt.

Khusus:
- **Huruf bergambar 日 dan 月** (u10): animasi asal-usul dengan preset `origin` yang sudah ada (seperti 人/家): 日 = matahari bulat dengan titik di tengah → kotak 日; 月 = bulan sabit → 月. Coretan huruf sebagai path dari `hanzi-writer-data` (salin ke `src/art/scenes/glyphs.ts`), bukan `<text>`. Reduced-motion → gambar asal dan huruf berdampingan.
- **Waktu & jam (u11)**: jam analog harus menunjukkan jam yang benar dan terbaca (jarum pendek/panjang jelas beda; angka jam boleh sebagai `<text>` angka). 点 = jam tepat (mis. 7:00), 分/分钟 = jarum menit bergerak (angka menit boleh), 小时 = satu putaran jarum panjang. 早上/上午/中午/下午/晚上 terbaca sebagai urutan waktu (posisi matahari/bulan + jam), dan 早/晚 sebagai pasangan (datang awal vs terlambat).
- **Kalender (u10)**: kalender tanpa tulisan huruf (angka boleh). 今天/明天/昨天 dibedakan jelas (kotak hari ini disorot + panah maju/mundur); 星期 = 7 kotak; 星期天/星期日 boleh mirip tetapi tidak identik byte. 今年/明年/去年 dibedakan (panah maju/mundur, angka tahun boleh mis. 2026/2027/2025).
- **Posisi (u12)**: pasangan 上/下, 前/后, 里/外 memakai komposisi sejajar supaya bedanya jelas (benda sama, posisi beda) + panah kuning penanda yang sudah ada. 来/去/回/到 = gerak (`move-to`) dengan arah terbaca.
- **Makanan (u09)**: masakan rumahan China daratan (mangkuk, sumpit, kukusan bambu); tanpa merek/logo. 好吃 = pasangan (enak vs tidak), boleh 2 panel.

Dibolehkan menambah ke pustaka: benda (`props.ts`: makanan, peralatan makan, jam, kalender, matahari/bulan, kardus, koper, dll.), latar (`backgrounds.ts`, pakai ulang yang ada bila cocok: `kitchen`, `restaurant`, `sky`, `night`, `street`, `classroom`, `park`, `airport`), pose baru (sebagai data), preset aksi baru (CSS di `scene.css`). Tokoh pendukung baru hanya bila perlu, lewat sistem tokoh yang sama.

## Out of scope
- Unit 13–21 (tahap berikutnya). Lottie. Thumbnail di tempat lain. Audio (task 4b, cabang `task-4b`, `src/lib/audio.ts`).
- Mengubah `words.json`, `units.json`, kalimat, dialog, casual, BUILD_PLAN bagian 1, adegan u01–u08 yang sudah ada (kecuali perbaikan bug, dicatat).
- Game (`src/games/**`, `src/pages/learn/games/**`), Tahap 0 (cabang `task-0`).

## Acceptance criteria
1. `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run check:data`, `npm run check:visuals` lolos; `npm run build:characters`, `npm run build:scenes`, `npm run build:lessons` dijalankan ulang → `git status` bersih.
2. Setiap kata u01–u12 punya tepat satu adegan (tes diperluas); total adegan HSK 1 = 177. Adegan u01–u08 tidak berubah byte (kecuali perbaikan bug yang dicatat).
3. Render PNG (`rsvg-convert`, ±480 px dan ±320 px) ke-57 adegan baru: gaya konsisten dengan adegan sebelumnya, tokoh tidak terpotong/lepas, lengan menempel, makna terbaca di ±320 px, jumlah benda/jam/angka benar, tidak ada teks tertulis selain angka. ≤ 4 "kurang jelas tapi tidak salah" boleh dicatat; tidak boleh salah makna atau rusak.
4. Animasi asal-usul 日 dan 月 jalan saat klik/Enter/Spasi, diam saat reduced-motion.
5. Build produksi (`vite preview`): kata u09–u12 menampilkan ilustrasi bergerak halus; klik/Enter/Spasi → aksi; tidak ada error konsol (selain Google Fonts yang diblokir sandbox); tidak ada scroll ke samping di 375 px; axe tanpa pelanggaran baru di layar kata (terang & gelap); reduced-motion = tanpa animasi.
6. Tiap SVG ≤ 40 KB; bundel JS utama tidak bertambah > 5 KB gzip.

## File
- Diubah/baru: `data/hsk1/scenes.json`, `data/hsk1/visuals.json` (hanya teks `scene` kata u09–u12), `src/art/scenes/**`, `src/art/characters/**` (hanya bila perlu pose/tokoh), `public/art/scenes/**`, `public/art/characters/**` (hanya bila tokoh berubah), `src/pages/learn/scene.css`, `src/pages/learn/WordScene.tsx` (hanya bila perlu), tes terkait, `public/data/hsk1/units/**` (hasil `build:lessons` bila berubah), `docs/tasks/task-6b-tahap3.md` (catatan temuan).

## Catatan implementasi (2026-11-25)

**Hasil:** 57 adegan baru untuk u09–u12, jadi setiap kata u01–u12 punya tepat satu adegan (total adegan HSK 1 = 177). Adegan u01–u08 tidak berubah sama sekali (byte sama). Tes baru di `src/art/scenes.test.ts` memeriksa: jumlah adegan, animasi asal-usul 日/月, jam menunjukkan waktu yang benar (termasuk sudut jarum), kalender hari/tahun dibedakan, pasangan posisi memakai benda yang sama, dan 来/去/回/到 benar-benar bergerak. Bundel JS utama praktis tidak bertambah (+0,01 KB gzip). SVG terbesar yang baru jauh di bawah 40 KB.

**Ditambah ke pustaka (tanpa sistem baru):**
- Benda makanan & dapur (`props.ts`): mangkuk mi kuah, sumpit mengangkat mi, penanak nasi, piring sayur hijau, botol air, kotak susu bertotol sapi (tanpa tulisan), gelas bergagang berbintang, apel tergigit, wajan, telur goreng, roti tawar + selembar roti, kukusan bambu berisi bakpao, penggiling adonan, daun teh, cangkir teh kecil, teko tanah liat, pare, kotak bekal.
- Benda waktu: jam analog (angka 12/3/6/9, jarum pendek gelap dan jarum panjang merah; bisa jadi jam weker; bagian kuning untuk "5/10 menit"; panah melingkar untuk "satu jam"), jendela langit kecil yang menunjukkan posisi matahari/bulan menurut jam, tiga lembar kalender harian (hari ini kuning, besok/kemarin hijau), kotak hari seminggu, pita seminggu dengan hari Minggu menyala, kalender tahunan (angka tahun + 12 kotak bulan), bulan sabit, gambar kuno matahari bertitik dan bulan sabit bergaris, pohon empat musim, busur jalur matahari, layang-layang, jam pasir, panah melengkung.
- Benda arah & tempat: tiang halte bus (gambar bus, tanpa tulisan), kardus (dinding belakang + depan, supaya kucing bisa "di dalam"), rumah dengan jendela tembus (Nenek terlihat dari dalam), gedung sekolah dengan bendera, panah putar balik (U), bangku taman.
- Coretan 日 dan 月 disalin dari `hanzi-writer-data` ke `glyphs.ts` (path, bukan `<text>`).
- Preset aksi baru `clock` (CSS di `scene.css`): saat diklik jarum menit berputar melewati menit kuning (分 5 menit, 分钟 10 menit) atau satu putaran penuh sementara jarum jam maju satu angka (小时). Saat diam / "kurangi gerak", jam menunjukkan waktu akhir. `WordScene.tsx` hanya menambah durasi preset ini. Tidak ada pose atau tokoh baru, jadi `public/art/characters/**` tidak berubah.

**Penyimpangan dari rencana di visuals.json (disengaja, supaya terbaca di kotak kecil):**
- 水 dituang Kakak (bukan Adik): tangan anak terlalu rendah untuk menuang ke gelas di meja. 牛奶 tetap Nenek. Aliran air tidak digambar; botol/kotak susu miring masuk ke mulut gelas.
- 茶 ditambah Kakek mengangkat cangkir; 鸡蛋 = Ibu mengangkat telur + telur goreng di wajan (tanpa keranjang telur); 饺子 = jiaozi di piring + penggiling adonan; 面条儿 = Kakek mengangkat mi dari mangkuk (tidak terlalu tinggi).
- 好吃: dua panel, jiaozi "好吃！" vs pare pahit "不好吃…".
- 天 = tiga matahari di busur (terbit, siang, terbenam) + balon "一天" (bulan dan tempat tidur dihilangkan). 今天/明天/昨天 = tiga lembar kalender 24-25-26 yang sama, hari ini kuning, panah biru maju/mundur. 今年/明年/去年 = tiga kalender tahunan 2025-2026-2027 yang sama (tanpa tokoh, tanpa foto). 星期 = 7 kotak (5 tas sekolah + 2 bola) + angka 7. 星期天 di rumah (Ayah di sofa), 星期日 piknik keluarga di taman (4 orang, bukan 6).
- 年 = empat pohon musim dengan panah kecil di antaranya + balon "一年" (bukan panah melingkar).
- u11: tiap kata punya balon dengan kata itu (mis. "现在八点。", "三点五分", "十分钟", "一个小时", "没有时间了！", "你什么时候回来？"). 时候 diganti jadi Ibu bertanya kapan Kakak pulang (bukan lampu penyeberangan). 早上/上午/中午/下午/晚上 memakai tata letak yang sama: jendela langit kiri atas + jam kanan atas (6:00, 10:00, 12:00, 3:00, 8:00). 早 dan 晚 sama-sama di depan sekolah dengan jam di atas gedung (7:00 vs 8:20).
- u12: 上/下 = kucing di atas / di bawah meja yang sama (bukan kardus untuk 上); 前/后 = antrean halte yang sama, panah di atas Ayah / Adik; 里/外 = kardus yang sama, kucing di dalam / di luar. 边 = balon "这边！". 去 = "我去学校。", 回 = "回家！" dengan panah U, 到 = "奶奶到了！".
- Daftar `characters`/`props` di visuals.json untuk kata-kata ini tidak diubah (hanya teks `scene`, sesuai aturan), jadi untuk beberapa kata daftar itu tidak sama persis dengan gambar.

**Adegan paling lemah (kurang jelas tapi tidak salah):** 喝 (sedotan bubble tea kecil, gelas menutup dagu), 面条儿 (mi tidak terangkat tinggi), 中午 (pada pukul 12:00 kedua jarum bertumpuk; terbantu jendela langit + balon), 鸡蛋 (telur di tangan Ibu hanya oval putih).

**Temuan di luar task:** tidak ada yang baru. Cek di browser (`vite preview`, axe, 375 px) belum dijalankan di sesi ini — mohon diperiksa sesi utama.
