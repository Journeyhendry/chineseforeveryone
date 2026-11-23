// Kartu bolak-balik: fungsi murni (state tidak diubah di tempat).
import { mulberry32, shuffle } from '../lib/quiz.ts'
import type { Stars } from '../lib/progress.ts'

export type CardStatus = 'belum' | 'tahu' | 'ulang'

export interface FlashState {
  /** Semua kartu (id kata) di dek. */
  ids: string[]
  status: Record<string, CardStatus>
  /** Kartu di putaran ini, urut tampil. */
  queue: string[]
  /** Posisi kartu yang sedang tampil di `queue`. */
  pos: number
  /** Putaran ke- (mulai 1). */
  round: number
  /** Kartu yang pernah ditandai "ulang" (untuk ringkasan & bintang). */
  missed: string[]
  seed: number
}

export function createDeck(ids: readonly string[], seed: number): FlashState {
  const unique = [...new Set(ids)]
  const status: Record<string, CardStatus> = {}
  for (const id of unique) status[id] = 'belum'
  return { ids: unique, status, queue: shuffle(unique, mulberry32(seed)), pos: 0, round: 1, missed: [], seed }
}

/** Kartu yang sedang tampil, atau null bila putaran habis. */
export function currentCard(s: FlashState): string | null {
  return s.pos < s.queue.length ? s.queue[s.pos] : null
}

/** Tandai kartu yang sedang tampil, lalu maju ke kartu berikutnya. */
export function markCard(s: FlashState, known: boolean): FlashState {
  const id = currentCard(s)
  if (id === null) return s
  const missed = !known && !s.missed.includes(id) ? [...s.missed, id] : s.missed
  return { ...s, status: { ...s.status, [id]: known ? 'tahu' : 'ulang' }, pos: s.pos + 1, missed }
}

export const roundOver = (s: FlashState) => s.pos >= s.queue.length
export const deckDone = (s: FlashState) => s.ids.length > 0 && s.ids.every((id) => s.status[id] === 'tahu')
export const againIds = (s: FlashState) => s.ids.filter((id) => s.status[id] === 'ulang')

/** "Ulang lagi": putaran baru berisi hanya kartu berstatus `ulang` (urutan diacak lagi). */
export function againRound(s: FlashState): FlashState {
  const ids = againIds(s)
  if (ids.length === 0) return s
  const rng = mulberry32((s.seed + s.round * 7919) >>> 0)
  return { ...s, queue: shuffle(ids, rng), pos: 0, round: s.round + 1 }
}

export interface FlashSummary {
  total: number
  /** Langsung tahu di putaran pertama. */
  firstTry: number
  /** Pernah ditandai "ulang". */
  repeated: number
  known: number
  again: number
}

export function flashSummary(s: FlashState): FlashSummary {
  const known = s.ids.filter((id) => s.status[id] === 'tahu').length
  return {
    total: s.ids.length,
    firstTry: s.ids.length - s.missed.length,
    repeated: s.missed.length,
    known,
    again: s.ids.filter((id) => s.status[id] === 'ulang').length,
  }
}

/**
 * Bintang kartu (dek selesai = minimal 1): bagian kartu yang langsung "tahu" di putaran pertama.
 * >= 80% -> 3, >= 50% -> 2, selain itu 1.
 */
export function flashStars(sum: FlashSummary): Stars {
  if (sum.total === 0) return 0
  const r = sum.firstTry / sum.total
  if (r >= 0.8) return 3
  if (r >= 0.5) return 2
  return 1
}
