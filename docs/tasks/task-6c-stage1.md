# Task 6c · Stage 1 — data kalimat & dialog per kata

Bagian dari `docs/tasks/task-6c.md` (aturan pemilihan kalimat & keputusan pemilik ada di sana; dokumen ini hanya merinci format dan cek).

## Tujuan
Setiap kata HSK 1 (300) punya **satu kalimat contoh utama** yang akan digambar di adegan (stage 2). Kata yang butuh percakapan supaya paham memakai **dialog 2–4 baris**. Semua lolos cek otomatis + pemeriksa AI kedua (Sonnet, ≥ 4/5).

## File
- Draf per unit (ditulis Opus): `data/hsk1/word-sentences/u01.json` … `u21.json`
- Hasil gabungan (dibuat skrip): `data/hsk1/word-sentences.json` → `npm run build:word-sentences`
- Laporan angka: `data/hsk1/word-sentences-report.json` (dibuat skrip)
- Penilaian pemeriksa kedua: `data/hsk1/word-sentences-review.json`
- Cek: `npm run check:data` (ikut CI) + tes vitest.

## Format draf per unit
```json
{
  "unit": "u01",
  "entries": [
    {
      "wordId": "L1-0517",
      "hanzi": "你好",
      "sentence": {
        "hanzi": "你好！我是新老师。",
        "pinyin": "Nǐ hǎo! Wǒ shì xīn lǎoshī.",
        "id": "Halo! Saya guru baru.",
        "en": "Hello! I'm the new teacher.",
        "source": "unit",
        "sourceId": "n-u01:3",
        "speaker": "teacher",
        "matchForm": null
      },
      "dialog": null,
      "scene": { "ref": "L1-0517", "fit": "rebubble", "note": "Guru melambai di pintu kelas, balon berisi kalimat." }
    }
  ]
}
```
- `sentence.source`: `"unit"` (diambil/disusun dari materi yang ada: kalimat Tatoeba di `sentences.json` yang sudah dipakai, `casual.json`, `dialogs-natural.json`, atau disusun hanya dari kata HSK 1), `"tatoeba"` (kalimat Tatoeba dipakai apa adanya — wajib `sourceId` = `tatoebaId` yang ada di `sentences.json`, hanzi harus sama persis), `"buatan"` (kalimat buatan yang memakai kata di luar HSK 1).
- `sourceId`: id Tatoeba (angka) untuk `tatoeba`; untuk `unit` boleh rujukan teks seperti `"n-u01:3"` (dialog, baris ke-3), `"c-u01-01"` (casual), atau `null` bila disusun baru dari kata HSK 1.
- `speaker`: id tokoh dari `dialogs-natural.json` → `speakers` (yeye, nainai, baba, mama, gege, meimei, seller, doctor, teacher, waiter, driver, friend, classmate). Menentukan suara P3 (perempuan) / L3 (laki-laki) di stage 3.
- `matchForm`: hanya untuk kata yang di kalimat muncul terpisah/berubah (mis. 打球 → 打了一会儿球 tidak boleh; pilih kalimat yang memuat bentuk utuh). Normalnya `null` dan kalimat harus memuat `hanzi` kata persis.
- `pinyin`: tanda nada, dipisah per kata (gaya buku pelajaran), huruf besar di awal kalimat, tanda baca Latin (`, . ! ?`). Perubahan nada 一 dan 不 ditulis (yí gè, bú shì), 3+3 tidak ditulis (nǐ hǎo). Nada ringan tanpa tanda (xièxie, māma).
- `dialog` (hanya untuk kata yang butuh): `{ "reason": {"id","en"}, "lines": [{"who","hanzi","pinyin","id","en"}] }`, 2–4 baris, tokoh bergantian, **`sentence.hanzi` harus sama dengan salah satu baris** (baris yang memuat kata). Alasan contoh: partikel tanya (吗/呢/吧), sapaan & balasannya (谢谢→不客气), permintaan maaf & jawabannya, kata tanya (什么/哪儿/几), ya/tidak, tawar-menawar.
- `scene.ref`: `wordId` adegan yang sudah ada di `scenes.json` (unit 1–16) atau `null` (unit 17–21). `scene.fit`: `keep` (gambar sudah cocok dengan kalimat, balon tinggal diisi), `rebubble` (gambar cocok, isi balon diganti kalimat), `redraw` (gambar harus digambar ulang), `new` (belum ada adegan). `note`: 1 kalimat Indonesia apa yang terlihat.

## Aturan isi (ringkas dari PRD)
1. Kalimat benar, alami (orang China daratan sungguh bilang begitu), sederhana, satu situasi sehari-hari yang bisa digambar dengan tokoh Keluarga Xiǎo.
2. Panjang: target ≤ 10 huruf Mandarin (tanpa tanda baca), maksimal 14. Baris dialog sama.
3. Prioritas: kata dari unit ini + unit sebelumnya. Target ≥ 80 % kalimat per unit hanya memakai kata unit ≤ unit ini (syarat lolos keseluruhan ≥ 70 %). Kata HSK 1 dari unit sesudahnya boleh tapi dihitung "belum dipelajari". Kata di luar HSK 1 maksimal 2 per kalimat, harus kata mudah/sehari-hari (dicatat otomatis).
4. Hindari: nama orang di luar HSK 1 (pakai sebutan keluarga: 妈妈, 哥哥 …), topik uang serius (utang, judi), sakit berat, topik sensitif. Belanja harga biasa boleh.
5. Kalimat tiap kata berbeda satu sama lain di dalam unit (jangan satu kalimat untuk dua kata, kecuali benar-benar cocok — tetap tulis dua entri).
6. Terjemahan Indonesia & Inggris alami, bukan kata per kata.

## Cek otomatis (skrip + tes)
300/300 kata tepat sekali; `wordId`/unit cocok; kalimat memuat kata; jumlah suku kata pinyin = jumlah huruf (memperhitungkan 儿 akhiran r); nada kata HSK 1 di pinyin cocok dengan `words.json` (kecuali perubahan nada 一/不 dan nada ringan); kata luar HSK 1 ≤ 2 (dihitung otomatis dengan pemecah kata); `tatoeba` → id ada & teks sama; dialog 2–4 baris, tokoh valid, kalimat = salah satu baris; `scene.ref` ada di `scenes.json`; setiap entri punya penilaian pemeriksa dengan teks sama dan semua nilai ≥ 4.
Bukti tambahan untuk kalimat `buatan`: semua potongan kata ada di CC-CEDICT/daftar HSK, dan pasangan kata target + tetangganya dicari di korpus lokal (Tatoeba di repo, dialog, casual) — dilaporkan di laporan untuk pemeriksa (tidak memblokir).

## Pemeriksa kedua (Sonnet)
Tanpa melihat alasan/catatan penulis. Nilai 1–5: `natural`, `correct` (tata bahasa + pinyin + terjemahan), `beginner` (mudah untuk pemula), `drawable` (bisa digambar jelas dalam satu adegan). Satu nilai < 4 → ditulis ulang oleh penulis, lalu dinilai ulang.
