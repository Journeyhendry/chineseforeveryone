# Task 1b · Cek otomatis di CI + favicon

Model: Haiku (diperiksa sesi utama Opus). Prasyarat: task 1 (selesai).

## Tujuan
Setiap push ke `main` harus lolos cek kode dulu sebelum website dibangun dan dipasang. Website punya ikon tab (favicon) sendiri.

## Scope
1. `.github/workflows/deploy.yml`: tambah job `check` (ubuntu-latest, Node 22, cache npm) dengan langkah: checkout, `npm ci`, `npm run typecheck`, `npm run lint`, lalu `npm test --if-present`.
   - Job `build` diberi `needs: check`. Job `deploy` tetap `needs: build`.
   - Jangan ubah pemicu, permissions, atau concurrency yang ada.
2. `public/favicon.svg`: kotak ungu #6741D9 sudut membulat, garis tepi tebal #231942, huruf 学 putih (#FFFFFF) di tengah. viewBox `0 0 64 64`. Huruf ditulis sebagai `<text>` dengan font-family `'Noto Sans SC','PingFang SC','Microsoft YaHei',sans-serif`, font-weight 700.
3. `index.html`: tambah `<link rel="icon" type="image/svg+xml" href="/favicon.svg" />` di `<head>` (Vite menyesuaikan path dengan `base` saat build).

## Out of scope
- Menambah tes, mengubah kode aplikasi, mengubah dependensi, workflow lain.

## Acceptance criteria
- YAML valid (bisa di-parse), job `check` ada dan `build` bergantung padanya.
- `npm ci && npm run typecheck && npm run lint && npm run build` lolos secara lokal.
- `dist/favicon.svg` ada setelah build, dan `dist/index.html` merujuk ke favicon dengan path base yang benar (`/chineseforeveryone/favicon.svg`).
- Favicon dirender ke PNG (`rsvg-convert`) terlihat jelas: kotak ungu membulat, garis gelap, huruf 学 putih di tengah.
- Workflow GitHub Actions sukses setelah push (check → build → deploy).

## File terkait
- `.github/workflows/deploy.yml`
- `public/favicon.svg` (baru)
- `index.html`
