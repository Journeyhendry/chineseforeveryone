// Progres belajar di localStorage (kunci xue.progress.v1). Fungsi murni + baca/tulis aman.
//
// Bentuk ini sengaja terbuka untuk task 8 (Leitner, ulangan harian, cadangan): kolom baru
// (mis. `words: { [wordId]: { box, due } }`, `streak`) cukup ditambah di Progress dan dipulihkan
// per kolom di normalizeProgress; data lama tanpa kolom itu tetap valid. Naikkan `version` hanya
// bila arti kolom yang sudah ada berubah.

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
  return out
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
