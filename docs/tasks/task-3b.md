# Task 3b · Versi santai + dialog

Model: Opus (penulis draf + kode), Sonnet (pemeriksa kedua, independen), sesi utama Opus memeriksa. Prasyarat: task 3 (selesai).

## Tujuan
Tiap unit (20 unit di `data/hsk1/units.json`) punya kotak "Versi santai" berisi 3–5 ungkapan sehari-hari yang benar-benar dipakai di China daratan (berdampingan dengan versi HSK-nya) dan satu dialog situasi 4–8 baris. Semua ungkapan wajib lolos cek berlapis; yang gagal satu lapis dibuang. Dialog hanya memakai kata HSK 1 + ungkapan yang lolos.

## Kenapa ada workflow
Sesi kerja hanya bisa mengakses GitHub (Wiktionary dan Tatoeba diblokir). Bukti dari sumber luar dikumpulkan oleh GitHub Actions, hasilnya di-commit balik. CC-CEDICT tersedia lokal lewat paket `cedict-json`.

## Alur (5 lapis cek)
1. **Draf AI** (Opus): `data/hsk1/casual-candidates.json` — 6–8 kandidat per unit (cadangan karena sebagian akan gugur) + `data/hsk1/dialogs-draft.json` — 1 dialog per unit.
2. **Bukti sumber luar** (otomatis, workflow `casual-evidence.yml`) → `data/hsk1/casual-evidence-raw.json`. Sumber dihitung terpisah:
   - `cedict`: ada entri CC-CEDICT dengan hanzi sederhana persis sama (catat arti + apakah bertanda colloquial/coll./slang/Internet slang/dialect/Taiwan).
   - `wiktionary`: halaman en.wiktionary punya bagian `==Chinese==` untuk judul persis itu (lewat API `action=parse&prop=wikitext`, User-Agent menyebut repo). Catat label dari `{{lb|zh|...}}` / `{{label|zh|...}}` (colloquial, informal, slang, Internet slang, vulgar, Mainland China, Taiwan, Cantonese, dialectal, …). Kalau halaman tidak ada/tidak ada bagian Chinese, coba zh.wiktionary (bagian `==汉语==`); dua-duanya tetap dihitung sebagai satu sumber "wiktionary".
   - `tatoeba`: jumlah kalimat cmn di ekspor Tatoeba (`cmn_sentences.tsv` atau `cmn_sentences_detailed.tsv`) yang mengandung teks ungkapan persis (atau salah satu `variants`), maksimal 3 contoh id + teks. Sumber dihitung bila ≥ 1 kalimat.
   - (Opsional, boleh dilewati bila tidak ada sumber yang bisa diunduh bebas) `subtlex`: frekuensi di daftar SUBTLEX-CH.
   - Lolos lapis 2 bila ≥ 2 sumber berbeda. Gagal juga bila sumber mana pun menandai ungkapan **hanya** Taiwan/Kanton/dialek tanpa tanda Mainland, atau label vulgar padahal label kita bukan `kasar` (dicatat sebagai `flags`, aturannya di skrip build).
   - Fungsi pengecekan (parser wikitext label, pencocokan Tatoeba, lookup CEDICT) di `src/lib/casual.ts` agar bisa dites tanpa jaringan.
3. **Pemeriksa AI kedua** (Sonnet, subagent terpisah, hanya melihat hanzi, pinyin, label, versi HSK, situasi — tidak melihat alasan/catatan penulis): `data/hsk1/casual-review.json`, tiap kandidat `{ verdict: "pass"|"fail", natural: 1–5, labelOk: bool, comment }`. Lolos bila `pass`, `natural ≥ 4`, `labelOk`.
4. **Cek otomatis dialog**: tiap baris dialog disegmentasi (pakai `segment`/`buildLexicon` dari `src/lib/sentences.ts`, ditambah ungkapan yang lolos sebagai kata) — semua token harus kata HSK 1, ungkapan lolos, tanda baca, atau angka. Ungkapan di dialog unit N hanya dari unit ≤ N. Kata HSK 1 dari unit setelah N boleh, tapi dihitung di laporan (target ≤ 2 per dialog).
5. **Gagal satu lapis → buang**: ungkapan gagal tidak masuk `casual.json`. Dialog yang memakai ungkapan gagal ditulis ulang oleh penulis lalu dicek lagi.

## Bentuk data
`casual-candidates.json`:
```
{ "version": 1, "items": [
  { "id": "c-u01-01", "unit": "u01", "hanzi": "谢啦", "variants": [], "pinyin": "xiè la",
    "label": "santai" | "gaul" | "kasar",
    "hsk": { "hanzi": "谢谢", "wordIds": ["L1-...."] },
    "meaning": { "id": "...", "en": "..." },
    "situation": { "id": "...", "en": "..." },
    "note": "alasan penulis (TIDAK dikirim ke pemeriksa)" } ] }
```
`dialogs-draft.json` / `dialogs.json`:
```
{ "version": 1,
  "speakers": { "mama": { "name": { "id": "Ibu", "en": "Mom" }, "gender": "female" }, ... },
  "dialogs": [ { "id": "d-u01", "unit": "u01",
    "title": { "id": "...", "en": "..." }, "situation": { "id": "...", "en": "..." },
    "lines": [ { "speaker": "mama", "gender": "female", "cmn": "...",
                 "en": "...", "id": "..." } ] } ] }
```
Tokoh: Keluarga Xiǎo — `yeye` (Kakek, m), `nainai` (Nenek, f), `baba` (Ayah, m), `mama` (Ibu, f), `gege` (Kakak laki-laki, m), `meimei` (Adik perempuan, f) + pendukung `seller` (penjual), `doctor` (dokter), `teacher` (guru), boleh tambah `friend`/`waiter` dsb. Gender wajib untuk pemilihan suara. Teks Mandarin tidak memakai nama diri di luar HSK 1 (pakai sapaan keluarga seperti 爸爸/妈妈 bila ada di HSK 1).
Situasi dialog sebisa mungkin hidup di China sekarang (pasar, metro, bayar scan QR, pesan makanan, bubble tea) — situasi dijelaskan di `situation`, baris dialog tetap hanya kata HSK 1 + ungkapan lolos.

Output akhir (dibuat `npm run build:casual`, deterministik, dari draf + bukti + review):
- `data/hsk1/casual.json`: hanya ungkapan lolos, 3–5 per unit (bila lolos > 5, ambil 5 pertama sesuai urutan draf), field seperti kandidat tanpa `note`, plus `pinyinNumbered`, `tones[]`, dan `evidence: ["cedict","tatoeba",...]`.
- `data/hsk1/casual-evidence.json`: SEMUA kandidat dengan hasil tiap lapis (`sources` beserta detail, `flags`, `review`, `passed`, `failedAt`).
- `data/hsk1/dialogs.json`: dialog yang lolos lapis 4, tiap baris ditambah `pinyin` (dari words.json + pinyin ungkapan, per token) dan `tokens` (`{ text, wordId? , casualId? }`), `machine: true` untuk terjemahan.
- `data/hsk1/casual-report.json`: jumlah kandidat/lolos per unit, gagal per lapis, unit dengan < 3 ungkapan, dialog gagal + alasannya, kata unit-berikutnya per dialog.
- Terjemahan en/id dialog dan arti ungkapan ditulis AI → ditandai `machine: true`.

## Workflow `.github/workflows/casual-evidence.yml`
- Pemicu: `workflow_dispatch` dan `push` (cabang mana pun) bila berubah `data/hsk1/casual-candidates.json`, `scripts/fetch-casual-evidence.ts`, `src/lib/casual.ts`, atau file workflow ini.
- `permissions: contents: write`, `concurrency: casual-evidence`.
- Langkah: checkout, Node 22 + `npm ci`, unduh `per_language/cmn/cmn_sentences.tsv.bz2` dari https://downloads.tatoeba.org/exports/ ke `$RUNNER_TEMP`, ekstrak, jalankan `npm run fetch:casual-evidence -- --tatoeba <file>` (Wiktionary diambil di skrip, jeda ≥ 200 ms antar permintaan, retry 3×, gagal jaringan dicatat `error` bukan dianggap "tidak ada"), commit `data/hsk1/casual-evidence-raw.json` sebagai `github-actions[bot]` pesan `Data: update casual evidence`, `git pull --rebase` lalu push ke cabang yang memicu (`github.ref_name`).
- Tidak mengubah `deploy.yml` maupun `fetch-tatoeba.yml`.

## Tes
- `src/lib/casual.test.ts` (fixture buatan): parser label wikitext (en + zh), deteksi bagian Chinese, pencocokan Tatoeba (+variants), lookup CEDICT, aturan lolos lapis 2 (≥2 sumber, flag Taiwan-only/vulgar), aturan lapis 3, cek dialog (token asing ditolak, ungkapan unit lebih akhir ditolak, ungkapan gagal ditolak), pemilihan 3–5 per unit, hasil deterministik.
- Tes data (dilewati bila file belum ada): `casual.json` tiap unit 3–5 ungkapan, semua punya ≥ 2 `evidence` dan review lolos di `casual-evidence.json`; `dialogs.json` 1 dialog per unit, 4–8 baris, tiap baris punya `speaker` yang ada di `speakers` dan `gender`; menjalankan ulang build menghasilkan file yang sama persis dengan yang di-commit.

## Out of scope
- Tampilan (task 6), audio (task 4), mengubah `words.json`/`units.json`/`sentences.json`.

## Acceptance criteria
- `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` lolos.
- Workflow `casual-evidence.yml` sukses di Actions dan meng-commit bukti.
- Tiap unit punya 3–5 ungkapan berlabel di `casual.json` dan 1 dialog 4–8 baris di `dialogs.json`; kekurangan (bila ada) tercatat di laporan dan PROGRESS.md.
- Tiap ungkapan di `casual.json`: ≥ 2 sumber luar + review Sonnet lolos (tercatat di `casual-evidence.json`). Tidak ada ungkapan gagal di output.
- Dialog hanya kata HSK 1 + ungkapan lolos (dibuktikan cek otomatis).
- Pemeriksa sesi utama: cek acak kewajaran ungkapan & dialog, label santai/gaul/kasar masuk akal, tidak ada konten kasar berlebihan untuk pemula.
- `CREDITS.md` menyebut Wiktionary (CC BY-SA, hanya untuk cek), Tatoeba (cek), CC-CEDICT; dialog & ungkapan ditulis AI dan dicek berlapis.

## File terkait
- `data/hsk1/casual-candidates.json`, `dialogs-draft.json`, `casual-evidence-raw.json`, `casual-review.json`, `casual.json`, `casual-evidence.json`, `dialogs.json`, `casual-report.json`
- `src/lib/casual.ts`, `src/lib/casual.test.ts`, `scripts/fetch-casual-evidence.ts`, `scripts/build-casual.ts`
- `.github/workflows/casual-evidence.yml`, `package.json` (skrip `fetch:casual-evidence`, `build:casual`), `CREDITS.md`

## Cara kerja cabang
Draf + workflow dikerjakan di cabang `task-3b` (workflow push-trigger jalan di cabang itu dan meng-commit bukti ke cabang itu). Setelah semua lolos, sesi utama menggabung ke `main` sebagai satu commit `Task 3b: Versi santai + dialog`.
