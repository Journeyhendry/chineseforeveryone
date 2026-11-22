// Tanggal sebagai string 'YYYY-MM-DD' menurut jam perangkat. Hitungan lewat UTC dari string,
// jadi aman dari pergantian jam musim panas.

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const MS_PER_DAY = 86_400_000

const pad = (n: number, len = 2) => String(n).padStart(len, '0')

/** Hari menurut jam perangkat (bukan UTC). */
export function localDay(date: Date): string {
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function toUtc(day: string): number {
  const m = DAY_RE.exec(day)
  if (!m) return NaN
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return t
}

/** Format YYYY-MM-DD dan tanggal itu benar-benar ada (mis. 2026-02-30 tidak valid). */
export function isDay(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const t = toUtc(value)
  if (Number.isNaN(t)) return false
  const d = new Date(t)
  return `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` === value
}

export function addDays(day: string, n: number): string {
  const d = new Date(toUtc(day) + n * MS_PER_DAY)
  return `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

/** Selisih hari b - a (positif bila b setelah a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((toUtc(b) - toUtc(a)) / MS_PER_DAY)
}

/** Tanggal untuk dibaca murid, mis. "Rabu, 3 Desember". */
export function formatDay(day: string, lang: 'id' | 'en'): string {
  return new Intl.DateTimeFormat(lang === 'id' ? 'id-ID' : 'en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(toUtc(day)))
}
