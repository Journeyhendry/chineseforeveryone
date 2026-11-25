// Progres belajar di localStorage (kunci xue.progress.v1). Fungsi murni + baca/tulis aman.
//
// Kolom baru cukup ditambah di Progress dan dipulihkan per kolom di normalizeProgress; data lama
// tanpa kolom itu tetap valid. Naikkan `version` hanya bila arti kolom yang sudah ada berubah.
// Kolom task 8 (semuanya opsional): `words` (Leitner), `today` (kata dijawab hari ini), `streak`.
// Kolom task 0 (opsional): `basics` = hasil latihan Tahap 0 per bagian (bentuk sama dengan unit;
// tidak masuk Leitner kata HSK 1).
import { BASICS_PARTS, type BasicsPart } from './basics.ts'
import { normalizeStreak, normalizeToday, normalizeWords, type LeitnerEntry, type Streak, type TodayList } from './leitner.ts'
import { GAME_KINDS, type GameKind } from '../games/kinds.ts'

export type Stars = 0 | 1 | 2 | 3

export interface UnitProgress {
  /** Nilai terbaik 0..1. */
  bestScore: number
  stars: Stars
  /** Waktu pertama kali selesai (>= 1 bintang), ISO. */
  completedAt?: string
}

export interface Progress {
  version: 1
  units: Record<string, UnitProgress>
  /** Unit dengan order <= nilai ini terbuka lewat tes loncat. */
  skipUnlockedThrough?: number
  /** Jadwal ulang tiap kata (kunci = id kata). Id yang tak ada lagi di data tetap disimpan. */
  words?: Record<string, LeitnerEntry>
  today?: TodayList
  streak?: Streak
  /** Tahap 0 · Dasar: nilai terbaik per bagian. */
  basics?: Partial<Record<BasicsPart, UnitProgress>>
  /** Task 7: skor terbaik game per unit (bintang 0-3) + berapa kali dimainkan. Tidak memengaruhi bintang unit. */
  games?: Record<string, Partial<Record<GameKind, GameProgress>>>
}

export interface GameProgress {
  best: Stars
  plays: number
}

export interface UnitRef {
  id: string
  order: number
}

export const PROGRESS_KEY = 'xue.progress.v1'
export const SKIP_PASS = 0.8

export const emptyProgress = (): Progress => ({ version: 1, units: {} })

const UNIT_ID = /^[a-z0-9-]{1,32}$/

export function starsFor(score: number): Stars {
  if (score >= 0.9) return 3
  if (score >= 0.75) return 2
  if (score >= 0.6) return 1
  return 0
}

function normalizeUnit(raw: unknown): UnitProgress | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  const score = typeof o.bestScore === 'number' && Number.isFinite(o.bestScore) ? Math.min(1, Math.max(0, o.bestScore)) : 0
  // Bintang selalu dihitung ulang dari nilai, supaya tidak bisa tidak cocok.
  const out: UnitProgress = { bestScore: score, stars: starsFor(score) }
  if (typeof o.completedAt === 'string' && o.completedAt.length <= 64 && out.stars >= 1) out.completedAt = o.completedAt
  return out
}

/**
 * Pulihkan data apa pun (string JSON, objek, null) menjadi Progress yang valid, per kolom.
 * `knownUnitIds` (opsional): unit di luar daftar dibuang.
 */
export function normalizeProgress(raw: unknown, knownUnitIds?: Iterable<string>): Progress {
  let data: unknown = raw
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw)
    } catch {
      return emptyProgress()
    }
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return emptyProgress()
  const o = data as Record<string, unknown>
  const known = knownUnitIds ? new Set(knownUnitIds) : null
  const units: Record<string, UnitProgress> = {}
  if (typeof o.units === 'object' && o.units !== null && !Array.isArray(o.units)) {
    for (const [id, value] of Object.entries(o.units as Record<string, unknown>)) {
      if (!UNIT_ID.test(id) || (known && !known.has(id))) continue
      const u = normalizeUnit(value)
      if (u) units[id] = u
    }
  }
  const out: Progress = { version: 1, units }
  const skip = o.skipUnlockedThrough
  if (typeof skip === 'number' && Number.isInteger(skip) && skip >= 2 && skip <= 1000) out.skipUnlockedThrough = skip
  const words = normalizeWords(o.words)
  if (words) out.words = words
  const today = normalizeToday(o.today)
  if (today) out.today = today
  const streak = normalizeStreak(o.streak)
  if (streak) out.streak = streak
  const basics = normalizeBasics(o.basics)
  if (basics) out.basics = basics
  const games = normalizeGames(o.games, known)
  if (games) out.games = games
  return out
}

function normalizeBasics(raw: unknown): Progress['basics'] | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  const out: NonNullable<Progress['basics']> = {}
  for (const part of BASICS_PARTS) {
    const u = normalizeUnit(o[part])
    if (u) out[part] = u
  }
  return Object.keys(out).length > 0 ? out : null
}

function normalizeGames(raw: unknown, known: Set<string> | null): Progress['games'] | undefined {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined
  const out: NonNullable<Progress['games']> = {}
  for (const [unitId, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!UNIT_ID.test(unitId) || (known && !known.has(unitId))) continue
    if (typeof value !== 'object' || value === null || Array.isArray(value)) continue
    const unit: Partial<Record<GameKind, GameProgress>> = {}
    for (const kind of GAME_KINDS) {
      const g = (value as Record<string, unknown>)[kind]
      if (typeof g !== 'object' || g === null || Array.isArray(g)) continue
      const { best, plays } = g as Record<string, unknown>
      if (typeof best !== 'number' || !Number.isInteger(best) || best < 0 || best > 3) continue
      if (typeof plays !== 'number' || !Number.isInteger(plays) || plays < 1 || plays > 1_000_000) continue
      unit[kind] = { best: best as Stars, plays }
    }
    if (Object.keys(unit).length) out[unitId] = unit
  }
  return Object.keys(out).length ? out : undefined
}

/** Simpan hasil satu game: bintang terbaik + jumlah main. Bintang unit & jadwal ulang tidak berubah. */
export function recordGameResult(p: Progress, unitId: string, kind: GameKind, stars: number): Progress {
  const s = Math.min(3, Math.max(0, Math.round(Number.isFinite(stars) ? stars : 0))) as Stars
  const unit = p.games?.[unitId] ?? {}
  const old = unit[kind]
  const next: GameProgress = { best: old ? (Math.max(old.best, s) as Stars) : s, plays: (old?.plays ?? 0) + 1 }
  return { ...p, games: { ...p.games, [unitId]: { ...unit, [kind]: next } } }
}

// ---------- aturan buka unit ----------

export function isUnitDone(p: Progress, unitId: string): boolean {
  return (p.units[unitId]?.stars ?? 0) >= 1
}

/** Unit order 1 selalu terbuka; unit N terbuka bila unit N-1 selesai atau skipUnlockedThrough >= N. */
export function isUnitUnlocked(unit: UnitRef, units: UnitRef[], p: Progress): boolean {
  if (unit.order <= 1) return true
  if ((p.skipUnlockedThrough ?? 0) >= unit.order) return true
  const prev = units.find((u) => u.order === unit.order - 1)
  return prev ? isUnitDone(p, prev.id) : false
}

export type UnitStatus = 'locked' | 'open' | 'done'

export function unitStatus(unit: UnitRef, units: UnitRef[], p: Progress): UnitStatus {
  if (isUnitDone(p, unit.id)) return 'done'
  return isUnitUnlocked(unit, units, p) ? 'open' : 'locked'
}

/**
 * Unit yang disarankan: unit terbuka pertama yang belum selesai, mulai dari unit hasil tes loncat
 * (lolos tes loncat ke unit 3 -> unit 3 disarankan, bukan unit 1).
 */
export function suggestedUnit<T extends UnitRef>(units: T[], p: Progress): T | undefined {
  const open = [...units].sort((a, b) => a.order - b.order).filter((u) => unitStatus(u, units, p) === 'open')
  const from = p.skipUnlockedThrough ?? 0
  return open.find((u) => u.order >= from) ?? open[0]
}

export const doneCount = (units: UnitRef[], p: Progress) => units.filter((u) => isUnitDone(p, u.id)).length

// ---------- hasil latihan & tes loncat ----------

/** Simpan hasil latihan; hanya nilai terbaik yang disimpan. */
export function recordUnitResult(p: Progress, unitId: string, score: number, now: Date): Progress {
  const s = Math.min(1, Math.max(0, Number.isFinite(score) ? score : 0))
  const old = p.units[unitId]
  if (old && old.bestScore >= s) return p
  const stars = starsFor(s)
  const next: UnitProgress = { bestScore: s, stars }
  const completedAt = old?.completedAt ?? (stars >= 1 ? now.toISOString() : undefined)
  if (completedAt) next.completedAt = completedAt
  return { ...p, units: { ...p.units, [unitId]: next } }
}

/** Tes loncat ke unit order N: >= 0.8 membuka sampai N; di bawahnya tidak mengubah apa pun. */
export function recordSkipResult(p: Progress, targetOrder: number, score: number): Progress {
  if (!(score >= SKIP_PASS) || targetOrder < 2) return p
  if ((p.skipUnlockedThrough ?? 0) >= targetOrder) return p
  return { ...p, skipUnlockedThrough: targetOrder }
}

// ---------- Tahap 0 ----------

export const isBasicsDone = (p: Progress, part: BasicsPart) => (p.basics?.[part]?.stars ?? 0) >= 1
export const basicsDoneCount = (p: Progress) => BASICS_PARTS.filter((part) => isBasicsDone(p, part)).length

/** Simpan hasil latihan Tahap 0; hanya nilai terbaik yang disimpan. Tidak mengubah unit/Leitner. */
export function recordBasicsResult(p: Progress, part: BasicsPart, score: number, now: Date): Progress {
  const s = Math.min(1, Math.max(0, Number.isFinite(score) ? score : 0))
  const old = p.basics?.[part]
  if (old && old.bestScore >= s) return p
  const stars = starsFor(s)
  const next: UnitProgress = { bestScore: s, stars }
  const completedAt = old?.completedAt ?? (stars >= 1 ? now.toISOString() : undefined)
  if (completedAt) next.completedAt = completedAt
  return { ...p, basics: { ...p.basics, [part]: next } }
}

// ---------- penyimpanan ----------

export function loadProgress(): Progress {
  try {
    return normalizeProgress(window.localStorage.getItem(PROGRESS_KEY))
  } catch {
    return emptyProgress()
  }
}

export function saveProgress(p: Progress): void {
  try {
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(p))
  } catch {
    /* localStorage tidak tersedia: progres hanya berlaku di sesi ini */
  }
}
