# Standar ukur suara Mandarin (rancangan Claude, 2026-11-25; DISETUJUI pemilik 2026-11-25 23:20 WIB)

Dipakai task 4c (dan task suara berikutnya). Berdasar praktik umum penelitian: penyelarasan paksa + konteks untuk nada, skor kebenaran pelafalan (GOP), pengenalan ucapan sebagai "murid", dan uji dengar manusia sebagai penentu akhir.

## Prinsip
1. Rekaman orang asli = batas atas. Suara kita dinilai relatif terhadap orang asli pada alat ukur yang SAMA.
2. Alat ukur harus lolos dulu pada orang asli (≥ 90 % bila literatur memungkinkan) sebelum dipakai menilai suara kita.
3. Angka otomatis hanya penyaring. Telinga manusia menentukan.

## Lapis 1 — otomatis
| # | Ukuran | Cara | Lolos |
|---|---|---|---|
| 1a | Terbaca (CER) | Whisper large-v3 + pengenal kedua (Whisper medium / FunASR); bandingkan huruf | ≥ angka 4b (96,3 %), tak turun |
| 1b | Nada per suku kata | Potong suku kata dengan penyelarasan paksa (MFA / wav2vec2-CTC); fitur "tri-tone" = suku kata + tetangga kiri/kanan; pengenal 4+ringan | rujukan asli ≥ 90 % (literatur: 79,5 → 92,6 % di AISHELL-3 dengan konteks+alignment); suara kita ≥ 90 % dari angka rujukan per kelas |
| 1c | Verifikasi nada (GOP-gaya) | Rasio kemungkinan "nada yang diharapkan" vs 3 nada lain, per suku kata | ≥ 90 % suku kata di atas ambang (ambang ditentukan dari rujukan asli di persentil-10) |
| 1d | Kontur | Jarak DTW kontur F0 (semiton relatif median penutur) ke templat nada | median ≤ median rujukan + 1 simpangan |
| 1e | Rentang nada | Semiton puncak−dasar per suku kata | median ≥ 85 % rujukan |
| 1f | Durasi | Per suku kata (kata tunggal, 2–4 suku, kalimat) | tak di bawah persentil-5 rujukan |
| 1g | Teknis | Volume −16 LUFS, puncak ≤ −1,5 dBTP, tanpa klik/potong | semua file |

## Lapis 2 — "murid" otomatis
Pengenal ucapan terlatih lain dan pengenal nada harus menulis ulang huruf dan nada yang benar. Ini proksi "murid paham", bukan pengganti manusia.

## Lapis 3 — manusia (penentu akhir)
- **Uji tebak nada (murid sungguhan):** 40 butir acak (10 per nada, campur suku kata tunggal & kata) + 10 rekaman asli tersembunyi sebagai jangkar. Pendengar memilih nada 1–4. Lolos: ≥ 90 % benar pada suara kita dan tidak lebih dari 5 poin di bawah jangkar asli. (Bisa memakai game "Tebak nada" yang sudah ada.)
- **Uji A/B sebelum vs sesudah** ±30 butir (acak urutan, tanpa label): pendengar memilih "mana yang lebih jelas nadanya". Lolos: sesudah dipilih ≥ 70 %. A/B dipilih karena skor mutlak (MOS) sulit dibandingkan antar-uji.
- Pendengar: minimal pemilik; lebih baik ≥ 3 orang (termasuk satu penutur asli bila ada, mis. relawan di daftar ide parkir).
- Skala naturalness 1–5 mengikuti protokol Blizzard/ITU-T P.800 hanya sebagai informasi tambahan, bukan syarat lolos.

## Pelaporan
`docs/tasks/task-4c-hasil.md`: tiap ukuran → angka rujukan asli, angka suara kita, lolos/tidak, jumlah butir. Tidak boleh ada klaim "terdengar bagus" tanpa angka dan tanpa hasil lapis 3.

## Rujukan
- Tone classification dengan konteks + alignment: https://arxiv.org/pdf/2104.05657 (79,5 → 92,6 %, AISHELL-3)
- Akurasi MFA untuk Mandarin: https://link.springer.com/10.1057/s41599-023-01931-4
- Tone error rate ASR suku kata bernada 2,8 %: https://arxiv.org/pdf/2108.01122
- Deteksi salah nada dengan GOP: https://www.springerprofessional.de/en/automatic-detection-of-tone-mispronunciation-in-mandarin/1280638
- Evaluasi TTS Mandarin (diagnostik): https://arxiv.org/pdf/2604.22225
- Kelemahan MOS/MUSHRA untuk TTS modern: https://arxiv.org/abs/2411.12719
