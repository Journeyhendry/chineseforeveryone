// Jodohkan dengan waktu: pembuat ronde + state murni. Waktu (`now`, ms) selalu dari luar.
import { meaningShort, mulberry32, shuffle, type QuizWord } from '../lib/quiz.ts'
import type { Stars } from '../lib/progress.ts'

export type MatchMode = 'hanzi-meaning' | 'audio-hanzi'
export const MATCH_PAIRS = 6

export interface MatchRound {
  mode: MatchMode
  /** Id kata di ronde ini. */
  ids: string[]
  /** Urutan kartu kolom kiri (hanzi / suara) dan kanan (arti / hanzi). */
  left: string[]
  right: string[]
}

const norm = (s: string) => s.trim().toLowerCase()
/** Bunyi (pinyin bertanda nada, tanpa spasi/tanda hubung). */
const soundKey = (w: QuizWord) => norm(w.pinyin).replace(/[\s'-]/g, '')

/**
 * Kunci yang tidak boleh kembar dalam satu ronde: hanzi selalu; arti singkat ID dan EN (mode arti,
 * supaya tidak ada pasangan ambigu walau bahasa diganti di tengah); bunyi (mode suara: homofon).
 */
function keys(w: QuizWord, mode: MatchMode): string[] {
  const k = [`h:${w.hanzi}`]
  if (mode === 'hanzi-meaning') k.push(`id:${norm(meaningShort(w, 'id'))}`, `en:${norm(meaningShort(w, 'en'))}`)
  else k.push(`s:${soundKey(w)}`)
  return k
}

export function buildMatchRound(words: readonly QuizWord[], opts: { mode: MatchMode; seed: number; size?: number }): MatchRound {
  const rng = mulberry32(opts.seed)
  const size = Math.max(1, opts.size ?? MATCH_PAIRS)
  const used = new Set<string>()
  const ids: string[] = []
  for (const w of shuffle(words, rng)) {
    if (ids.length >= size) break
    const k = keys(w, opts.mode)
    if (k.some((x) => used.has(x)) || ids.includes(w.id)) continue
    k.forEach((x) => used.add(x))
    ids.push(w.id)
  }
  return { mode: opts.mode, ids, left: shuffle(ids, rng), right: shuffle(ids, rng) }
}

export type Side = 'left' | 'right'

export interface MatchState {
  round: MatchRound
  selLeft: string | null
  selRight: string | null
  matched: string[]
  mistakes: number
  /** Jumlah percobaan salah sejauh ini (berganti tiap salah, untuk memicu efek goyang). */
  wrongSeq: number
  lastWrong: { left: string; right: string } | null
  startedAt: number | null
  finishedAt: number | null
}

export function startMatch(round: MatchRound): MatchState {
  return { round, selLeft: null, selRight: null, matched: [], mistakes: 0, wrongSeq: 0, lastWrong: null, startedAt: null, finishedAt: null }
}

export const matchDone = (s: MatchState) => s.round.ids.length > 0 && s.matched.length === s.round.ids.length

/** Pilih kartu di satu kolom. Klik kartu yang sama lagi = batal pilih. Waktu mulai di pilihan pertama. */
export function selectCard(s: MatchState, side: Side, id: string, now: number): MatchState {
  if (s.finishedAt !== null || !s.round.ids.includes(id) || s.matched.includes(id)) return s
  const startedAt = s.startedAt ?? now
  const cur = side === 'left' ? s.selLeft : s.selRight
  const next: MatchState = { ...s, startedAt, lastWrong: null, [side === 'left' ? 'selLeft' : 'selRight']: cur === id ? null : id }
  if (next.selLeft === null || next.selRight === null) return next
  if (next.selLeft === next.selRight) {
    const matched = [...s.matched, id]
    const done = matched.length === s.round.ids.length
    return { ...next, matched, selLeft: null, selRight: null, finishedAt: done ? now : null }
  }
  return {
    ...next,
    mistakes: s.mistakes + 1,
    wrongSeq: s.wrongSeq + 1,
    lastWrong: { left: next.selLeft, right: next.selRight },
    selLeft: null,
    selRight: null,
  }
}

/** Waktu berjalan (ms). Belum mulai = 0; selesai = tetap. */
export function elapsed(s: MatchState, now: number): number {
  if (s.startedAt === null) return 0
  return Math.max(0, (s.finishedAt ?? now) - s.startedAt)
}

export function formatTime(ms: number): string {
  const total = Math.floor(Math.max(0, ms) / 1000)
  const m = Math.floor(total / 60)
  const sec = total % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

/**
 * Bintang jodohkan (selesai = minimal 1), dengan p = jumlah pasangan:
 * - 3 bintang: salah <= 1 dan waktu <= 6 detik x p
 * - 2 bintang: salah <= 3 dan waktu <= 12 detik x p
 * - selain itu 1 bintang.
 */
export function matchStars(ms: number, mistakes: number, pairs: number): Stars {
  if (pairs <= 0) return 0
  const sec = ms / 1000
  if (mistakes <= 1 && sec <= 6 * pairs) return 3
  if (mistakes <= 3 && sec <= 12 * pairs) return 2
  return 1
}
