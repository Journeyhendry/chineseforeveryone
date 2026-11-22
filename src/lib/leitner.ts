// Ulangan berjarak (kotak Leitner), target harian, dan hari berturut-turut. Fungsi murni:
// semua menerima `today` ('YYYY-MM-DD') dari luar supaya bisa dites.
import { addDays, daysBetween, isDay } from './dates.ts'
import type { Progress } from './progress.ts'

export type Box = 1 | 2 | 3 | 4 | 5
export type AnswerSource = 'practice' | 'skip' | 'review'

export interface LeitnerEntry {
  box: Box
  /** Hari jatuh tempo ulangan berikutnya. */
  due: string
  seen: number
  wrong: number
  last?: string
}

export interface TodayList {
  day: string
  /** Id kata unik yang dijawab hari ini (dari sumber mana pun). */
  words: string[]
}

export interface Streak {
  last: string
  current: number
  best: number
}

/** Jarak ulang (hari) per kotak. */
export const BOX_DAYS: Record<Box, number> = { 1: 1, 2: 2, 3: 4, 4: 8, 5: 16 }
export const BOXES: Box[] = [1, 2, 3, 4, 5]
export const MASTERED_BOX = 4
export const MAX_TRACKED_WORDS = 5000
export const MAX_TODAY_WORDS = 500
export const WORD_ID = /^[A-Za-z0-9-]{1,32}$/

export const isMastered = (e: LeitnerEntry): boolean => e.box >= MASTERED_BOX

// ---------- pemulihan data ----------

const count = (v: unknown): number =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.min(1_000_000, Math.floor(v)) : 0

/**
 * Entri rusak: kotak dibulatkan dan dijepit 1..5; angka negatif/NaN -> 0. Bila `due` tidak valid
 * tetapi `last` valid, jadwal dihitung ulang dari last + jarak kotak; bila keduanya rusak,
 * entri dibuang (fungsi murni tidak tahu hari ini).
 */
export function normalizeEntry(raw: unknown): LeitnerEntry | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  const boxNum = typeof o.box === 'number' && Number.isFinite(o.box) ? Math.round(o.box) : 1
  const box = Math.min(5, Math.max(1, boxNum)) as Box
  const last = isDay(o.last) ? o.last : undefined
  let due: string
  if (isDay(o.due)) due = o.due
  else if (last) due = addDays(last, BOX_DAYS[box])
  else return null
  const entry: LeitnerEntry = { box, due, seen: count(o.seen), wrong: count(o.wrong) }
  if (last) entry.last = last
  return entry
}

export function normalizeWords(raw: unknown): Record<string, LeitnerEntry> | undefined {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined
  const out: Record<string, LeitnerEntry> = {}
  let n = 0
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (n >= MAX_TRACKED_WORDS) break
    if (!WORD_ID.test(id)) continue
    const e = normalizeEntry(value)
    if (e) {
      out[id] = e
      n++
    }
  }
  return n > 0 ? out : undefined
}

export function normalizeToday(raw: unknown): TodayList | undefined {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined
  const o = raw as Record<string, unknown>
  if (!isDay(o.day)) return undefined
  const words: string[] = []
  if (Array.isArray(o.words)) {
    for (const id of o.words) {
      if (words.length >= MAX_TODAY_WORDS) break
      if (typeof id === 'string' && WORD_ID.test(id) && !words.includes(id)) words.push(id)
    }
  }
  return { day: o.day, words }
}

export function normalizeStreak(raw: unknown): Streak | undefined {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined
  const o = raw as Record<string, unknown>
  if (!isDay(o.last)) return undefined
  const current = Math.max(1, count(o.current))
  return { last: o.last, current, best: Math.max(current, count(o.best)) }
}

// ---------- jawaban ----------

/** Perbarui satu entri; tidak menyentuh daftar hari ini atau streak (lihat recordAnswers). */
export function recordAnswer(p: Progress, wordId: string, correct: boolean, today: string, source: AnswerSource): Progress {
  const old = p.words?.[wordId]
  let box: Box
  let due: string
  if (!old) {
    box = correct ? 2 : 1
    due = addDays(today, BOX_DAYS[box])
  } else if (old.due <= today || source === 'review') {
    box = correct ? (Math.min(5, old.box + 1) as Box) : 1
    due = addDays(today, BOX_DAYS[box])
  } else if (!correct) {
    box = 1
    due = addDays(today, BOX_DAYS[1])
  } else {
    // Belum jatuh tempo dan bukan ulangan: tidak bisa menghafal kilat untuk naik kotak.
    box = old.box
    due = old.due
  }
  const entry: LeitnerEntry = { box, due, seen: (old?.seen ?? 0) + 1, wrong: (old?.wrong ?? 0) + (correct ? 0 : 1), last: today }
  return { ...p, words: { ...p.words, [wordId]: entry } }
}

/** Hari aktif pertama: kemarin -> +1, hari ini -> tetap, selain itu -> 1. Jam mundur tidak menaikkan. */
export function bumpStreak(s: Streak | undefined, today: string): Streak {
  if (!s) return { last: today, current: 1, best: 1 }
  const gap = daysBetween(s.last, today)
  if (gap < 0) return s
  if (gap === 0) return s
  const current = gap === 1 ? s.current + 1 : 1
  return { last: today, current, best: Math.max(s.best, current) }
}

/** Streak untuk ditampilkan: 0 bila hari aktif terakhir lebih tua dari kemarin. Tidak mengubah data. */
export function currentStreak(p: Progress, today: string): number {
  const s = p.streak
  if (!s) return 0
  return daysBetween(s.last, today) <= 1 ? s.current : 0
}

export function todayCount(p: Progress, today: string): number {
  return p.today?.day === today ? p.today.words.length : 0
}

export interface Answer {
  wordId: string
  correct: boolean
}

/**
 * Satu pintu untuk semua layar (latihan, tes loncat, ulangan): Leitner, daftar kata hari ini,
 * dan streak selalu berubah bersama. Tanpa jawaban -> tidak ada yang berubah.
 */
export function recordAnswers(p: Progress, answers: readonly Answer[], today: string, source: AnswerSource): Progress {
  if (answers.length === 0) return p
  let next = p
  for (const a of answers) next = recordAnswer(next, a.wordId, a.correct, today, source)
  const words = next.today?.day === today ? [...next.today.words] : []
  for (const a of answers) {
    if (words.length >= MAX_TODAY_WORDS) break
    if (!words.includes(a.wordId)) words.push(a.wordId)
  }
  return { ...next, today: { day: today, words }, streak: bumpStreak(next.streak, today) }
}

// ---------- pertanyaan tentang kumpulan kata ----------

const inKnown = (id: string, known?: ReadonlySet<string>) => !known || known.has(id)

/** Kata jatuh tempo: kotak terendah dulu, lalu jatuh tempo paling lama, lalu id. */
export function dueWords(p: Progress, today: string, knownIds?: ReadonlySet<string>): string[] {
  return Object.entries(p.words ?? {})
    .filter(([id, e]) => e.due <= today && inKnown(id, knownIds))
    .sort(([ia, a], [ib, b]) => a.box - b.box || (a.due < b.due ? -1 : a.due > b.due ? 1 : 0) || (ia < ib ? -1 : ia > ib ? 1 : 0))
    .map(([id]) => id)
}

/** Jumlah kata per kotak, indeks 0 = kotak 1. */
export function boxCounts(p: Progress, knownIds?: ReadonlySet<string>): [number, number, number, number, number] {
  const out: [number, number, number, number, number] = [0, 0, 0, 0, 0]
  for (const [id, e] of Object.entries(p.words ?? {})) if (inKnown(id, knownIds)) out[e.box - 1]++
  return out
}

/** Tanggal jatuh tempo terdekat di antara kata yang dikenal (undefined bila belum ada kata). */
export function nextDueDay(p: Progress, knownIds?: ReadonlySet<string>): string | undefined {
  let min: string | undefined
  for (const [id, e] of Object.entries(p.words ?? {})) {
    if (inKnown(id, knownIds) && (min === undefined || e.due < min)) min = e.due
  }
  return min
}

export function trackedCount(p: Progress, knownIds?: ReadonlySet<string>): number {
  return Object.keys(p.words ?? {}).filter((id) => inKnown(id, knownIds)).length
}
