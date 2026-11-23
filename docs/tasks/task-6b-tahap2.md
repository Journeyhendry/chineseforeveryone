# Task 6b · tahap 2 — Ilustrasi + animasi unit 1–8 (lengkap)

Model: Opus (implementasi), sesi utama Opus memeriksa. Prasyarat: 6b tahap 1 (selesai), 2b (unit baru, selesai).
Sistem rakit, aturan SVG, animasi, komponen `WordScene` sudah ada dari tahap 1 — baca `docs/tasks/task-6b.md` (aturan & acceptance tahap 1 tetap berlaku). Tahap 2 **memakai sistem yang sama**, tidak membuat sistem baru.

## Tujuan
Setelah 2b menyusun ulang unit, 75 kata punya adegan. Tahap 2 melengkapi **semua kata unit u01–u08** (45 adegan baru), termasuk:
- u01 你好; u02 它 它们; u04 这个 那个; u05 哪个 怎么样 问 问题; u06 千 有点儿 些 有的 有些;
- u07 (14 kata, Orang di sekitar): 人 朋友 同学 大家 先生 女士 男 女 孩子 小朋友 男朋友 女朋友 都 和;
- u08 (17 kata, Keluarga, rumah & hewan): 家 家人 爸爸 妈妈 哥哥 姐姐 弟弟 妹妹 儿子 女儿 住 房间 桌子 椅子 狗 猫 只.
Rencana adegan per kata ada di `data/hsk1/visuals.json` (`type`, `scene`); boleh disederhanakan supaya terbaca di kotak kecil — alt mengikuti gambar sebenarnya, dan teks `scene` kata itu boleh diselaraskan.

Khusus (PRD pemilik):
- **Unit Keluarga "rumah yang terisi"**: adegan kata anggota keluarga u08 (爸爸 妈妈 哥哥 姐姐 弟弟 妹妹 儿子 女儿 家人) memakai **latar rumah yang sama** (ruang keluarga Keluarga Xiǎo) sehingga terasa rumah itu makin terisi; 家 / 家人 = rumah penuh semua anggota. Untuk 姐姐/弟弟 (tidak ada tokohnya di keluarga inti): pakai cara yang terbaca jelas (mis. bingkai foto lama di dinding, atau tokoh pendukung yang sudah ada dengan relasi jelas) — utamakan makna benar.
- **Huruf bergambar 人 dan 家**: saat diklik, animasi asal-usul singkat (CSS): 人 = siluet orang berjalan dilihat dari samping → berubah jadi bentuk huruf 人 (garis tebal, bukan `<text>`: gambar dua coretan sebagai path); 家 = atap 宀 di atas babi (豕) → rumah. Reduced-motion → gambar diam yang menampilkan keduanya berdampingan (gambar ↔ huruf). Coretan huruf digambar sebagai path (boleh diambil dari data `hanzi-writer-data` yang sudah ada di repo, salin path-nya ke prop).
- 男/女, 男朋友/女朋友: jangan pakai ikon toilet bertulisan; tanpa teks tertulis (hanya angka boleh). 男朋友/女朋友 boleh satu adegan pasangan muda dengan sorotan tokoh yang berbeda.
- Kata hitung/jumlah: 千 (mis. 10 papan × 100 titik tidak perlu literal — boleh "angka 1000" sebagai `<text>` angka + tumpukan), 些/有些/有的 (sebagian vs semua, terbaca), 只 = 3 hewan kecil + angka 3.

Dibolehkan menambah ke pustaka: benda (`props.ts`), latar (`backgrounds.ts`, mis. ruang keluarga, kamar, kelas yang sudah ada dipakai ulang), pose baru (sebagai data), tokoh pendukung baru **hanya bila perlu** (lewat sistem tokoh yang sama, sertakan di character sheet build), preset aksi baru (CSS di `scene.css`). Hewan (kucing, anjing, burung) dibuat sebagai prop/tokoh sederhana gaya sama.

## Out of scope
- Unit 9–21 (tahap berikutnya). Lottie. Thumbnail di tempat lain. Audio (task 4b), `src/lib/audio.ts`.
- Mengubah `words.json`, `units.json`, kalimat, dialog, casual, BUILD_PLAN bagian 1, adegan yang sudah ada (kecuali perbaikan bug yang ditemukan, dicatat).
- File game (`src/games/**`, `src/pages/learn/games/**`), Tahap 0 (cabang `task-0`), cabang `task-4b`.

## Acceptance criteria
1. `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run check:data`, `npm run check:visuals` (bila ada) lolos; `npm run build:characters`, `npm run build:scenes`, `npm run build:lessons` dijalankan ulang → `git status` bersih.
2. Setiap kata u01–u08 punya tepat satu adegan (tes); total adegan HSK 1 = 75 + 45 = 120.
3. Render PNG (`rsvg-convert`, ±480 px dan ±320 px) ke-45 adegan baru: gaya konsisten dengan adegan tahap 1 dan character sheet, tokoh tidak terpotong/lepas, lengan menempel, makna terbaca di ±320 px, jumlah benda benar, tidak ada teks tertulis selain angka. Pemeriksa menilai semua 45; ≤ 3 "kurang jelas tapi tidak salah" boleh dicatat; tidak boleh salah makna atau rusak.
4. "Rumah yang terisi" terlihat: anggota keluarga u08 di latar ruang keluarga yang sama. Animasi asal-usul 人 dan 家 jalan saat klik/Enter/Spasi, diam saat reduced-motion.
5. Build produksi (`vite preview`): kata u04–u08 menampilkan ilustrasi bergerak halus; klik/Enter/Spasi → aksi; tidak ada error konsol; tidak ada scroll ke samping di 375 px; axe tanpa pelanggaran di layar kata (terang & gelap); reduced-motion = tanpa animasi.
6. Tiap SVG ≤ 40 KB; bundel JS utama tidak bertambah > 5 KB gzip.

## File
- Diubah/baru: `data/hsk1/scenes.json`, `data/hsk1/visuals.json` (hanya teks `scene` bila diselaraskan), `src/art/scenes/**`, `src/art/characters/**` (hanya bila perlu pose/tokoh), `public/art/scenes/**`, `public/art/characters/**` (hanya bila tokoh berubah), `src/pages/learn/scene.css`, `src/pages/learn/WordScene.tsx` (hanya bila perlu untuk animasi asal-usul), tes terkait, `docs/tasks/task-6b-tahap2.md` (catatan temuan).

## Catatan implementasi (2026-11-23)

**Hasil:** 45 adegan baru, jadi setiap kata unit u01–u08 punya tepat satu adegan (total adegan HSK 1 = 120). Dicek dengan tes baru di `src/art/scenes.test.ts`.

**Ditambah ke pustaka (tanpa sistem baru):**
- Benda (`props.ts`): kucing (duduk / tidur melingkar), anjing (berdiri / berlari, ekor bergoyang), burung, dahan, babi, sepeda, setandan pisang (sebagian kuning, sebagian hijau), tas tangan, piala, sisir, tempat tidur, meja belajar, buku (terbuka / tertutup), koran (garis abu-abu, tanpa tulisan), nampan, gelas susu, foto lama (kakak-adik perempuan / kakak-adik laki-laki), bingkai foto, gedung apartemen malam dengan satu jendela keluarga yang menyala, panah penanda (kuning, menunjuk ke bawah), tanda laki-laki ♂ / perempuan ♀ (digambar, bukan teks), lampu berdiri, tanaman, kartu, lencana angka lebar (untuk 1000), papan 100 titik yang ringan, orang berjalan (siluet samping), atap 宀, dan kartu huruf 人 / 家.
- Coretan huruf 人 dan 家 disalin dari `hanzi-writer-data` (lisensi Arphic, sudah tercatat di CREDITS.md) ke `src/art/scenes/glyphs.ts`, digambar sebagai path (bukan `<text>`).
- Latar baru `living` = ruang keluarga Keluarga Xiǎo (jendela, lukisan pemandangan, hiasan simpul merah, karpet). Semua adegan kata keluarga u08 (家 家人 爸爸 妈妈 哥哥 姐姐 弟弟 妹妹 儿子 女儿) memakai latar ini + sofa biru di tempat yang sama. Ruangan makin terisi: 爸爸 (2 orang) → 妈妈 (3) → 哥哥 (4) → … → 女儿 dan 家人 (6). 猫 juga di ruangan ini.
- Preset aksi baru `origin` (CSS di `scene.css`) + peran benda `morph-from`, `morph-to`, `drop`; ekor hewan bergoyang pelan. `WordScene.tsx` hanya menambah durasi preset `origin`.
- 人: siluet orang berjalan (kaki = V terbalik) → panah → kartu huruf 人. Saat diklik, siluet bergeser ke kartu dan menghilang, lalu dua coretan 人 muncul satu per satu. 家: atap jatuh ke atas babi, gambar itu bergeser ke kartu, lalu 10 coretan 家 muncul berurutan; di bawahnya seluruh keluarga di ruang keluarga. Mode "kurangi gerak": gambar diam memperlihatkan gambar asal dan huruf berdampingan.
- Teks `scene` di `visuals.json` untuk ke-45 kata disamakan dengan alt adegan (gambar sebenarnya).

**Penyimpangan dari rencana di visuals.json (disengaja, supaya terbaca di kotak kecil):**
- Kata kerabat memakai balon kata (mis. Adik memanggil "爸爸！", "这是我姐姐。") + panah kuning di atas tokoh yang dimaksud.
- 姐姐 / 弟弟: foto lama di dinding (dua anak perempuan / dua anak laki-laki, yang dimaksud ditandai panah) ditunjuk Ibu / Ayah, karena tokoh itu tidak ada di keluarga inti.
- 男 / 女: keluarga berdiri dua-dua, tanda ♂ di atas Ayah+Kakak atau ♀ di atas Ibu+Adik (tanpa ikon toilet). 男朋友 / 女朋友: pasangan muda (teman kuliah + Teman) dengan hati kecil dan balon "他是我男朋友。" / "她是我女朋友。".
- 朋友: Ibu dan temannya minum bubble tea (bukan Adik, karena tokoh Teman sudah dewasa). 椅子: Kakek memegang koran dan menunjuk kursi kosong (pose duduk di kursi tampak seperti berdiri di atas kursi). 和: susu, bukan susu kedelai. 千: 10 papan × 100 titik + angka 1000. 你好: hanya Ibu yang punya balon (dua balon dengan teks sama membuat pemeriksa aksesibilitas (axe) mengeluh nama tombol tidak cocok).

**Adegan paling lemah (kurang jelas tapi tidak salah):** 有些 (pisang kuning/hijau, maknanya bergantung pada alt), 问 vs 问题 (komposisi mirip; 问 = balon tanda tanya ke guru, 问题 = "我有问题！" + tanda tanya besar), 大家 (keluarga duduk di belakang meja tampak kecil), 女儿 (sisir di rambut Adik kecil).

**Temuan di luar task:** axe (aturan `label-content-name-mismatch`) menandai tombol bahasa "ID"/"EN" di header pada lebar 1366 — sudah ada sebelumnya, file header di luar izin task ini. Error konsol satu-satunya di lingkungan uji adalah Google Fonts yang diblokir jaringan sandbox.
