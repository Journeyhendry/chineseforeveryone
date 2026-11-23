// Tebak nada: dengar kata / suku kata -> pilih pola nada. Fungsi murni, deterministik dengan seed.
//
// Aturan nada: selalu nada TERTULIS di data. Supaya yang didengar = yang tertulis, kata berikut tidak
// dipakai utuh: ada nada ringan (5), lebih dari 2 suku kata, mengandung 不 atau 一 (nadanya berubah),
// atau pola 3-3 (nada 3 pertama diucapkan nada 2). Bila kata yang lolos kurang, soal ditambah dari
// suku kata tunggal (satu huruf) kata unit, dengan aturan yang sama.
import { syllableTone } from '../lib/pinyin.ts'
import { mulberry32, shuffle, type QuizWord } from '../lib/quiz.ts'

export type PlainTone = 1 | 2 | 3 | 4
export type TonePattern = PlainTone[]

export const TONE_QUESTIONS = 10
export const TONE_MIN = 8

export interface ToneQuestion {
  /** Kata asal di unit. */
  wordId: string
  /** Yang diputar & ditampilkan (kata utuh atau satu huruf dari kata). */
  hanzi: string
  /** Suku kata bertanda nada (sesuai data). */
  syllables: string[]
  /** true = satu huruf dari kata yang lebih panjang. */
  part: boolean
  choices: TonePattern[]
  answer: number
}

const SANDHI_CHARS = /[不一]/
const patternKey = (p: readonly number[]) => p.join('-')

function plainTones(syllables: readonly string[]): PlainTone[] | null {
  const tones = syllables.map((s) => syllableTone(s))
  return tones.every((t): t is PlainTone => t >= 1 && t <= 4) ? tones : null
}

/** Kata utuh yang boleh ditanyakan (lihat aturan di atas). */
export function toneEligible(w: Pick<QuizWord, 'hanzi' | 'syllables'>): boolean {
  if (w.syllables.length < 1 || w.syllables.length > 2) return false
  if ([...w.hanzi].length !== w.syllables.length) return false
  if (SANDHI_CHARS.test(w.hanzi)) return false
  const t = plainTones(w.syllables)
  if (!t) return false
  return !(t.length === 2 && t[0] === 3 && t[1] === 3)
}

interface Item {
  wordId: string
  hanzi: string
  syllables: string[]
  part: boolean
}

/** Bahan soal: kata utuh dulu, lalu suku kata tunggal (huruf yang bukan kata 1 huruf di unit). */
export function toneItems(words: readonly QuizWord[]): { whole: Item[]; parts: Item[] } {
  const whole = words.filter(toneEligible).map((w) => ({ wordId: w.id, hanzi: w.hanzi, syllables: [...w.syllables], part: false }))
  const singles = new Set(words.filter((w) => [...w.hanzi].length === 1).map((w) => w.hanzi))
  const seen = new Set<string>()
  const parts: Item[] = []
  for (const w of words) {
    const chars = [...w.hanzi]
    if (chars.length < 2 || chars.length !== w.syllables.length) continue
    chars.forEach((ch, i) => {
      if (singles.has(ch) || seen.has(ch) || SANDHI_CHARS.test(ch)) return
      const t = syllableTone(w.syllables[i])
      if (t < 1 || t > 4) return
      seen.add(ch)
      parts.push({ wordId: w.id, hanzi: ch, syllables: [w.syllables[i]], part: true })
    })
  }
  return { whole, parts }
}

const ALL_PAIRS: TonePattern[] = []
for (const a of [1, 2, 3, 4] as const) for (const b of [1, 2, 3, 4] as const) if (!(a === 3 && b === 3)) ALL_PAIRS.push([a, b])

function choicesFor(answer: TonePattern, rng: () => number): { choices: TonePattern[]; answer: number } {
  if (answer.length === 1) {
    // Satu suku kata: nada 1-4 berurutan (tombol 1-4 = nada 1-4), seperti latihan.
    return { choices: [[1], [2], [3], [4]], answer: answer[0] - 1 }
  }
  const key = patternKey(answer)
  // Pengecoh: utamakan pola yang beda satu suku kata (lebih mirip), lalu sisanya.
  const others = shuffle(
    ALL_PAIRS.filter((p) => patternKey(p) !== key),
    rng,
  ).sort((x, y) => diff(x, answer) - diff(y, answer))
  const picked = [answer, ...others.slice(0, 3)]
  const choices = shuffle(picked, rng)
  return { choices, answer: choices.findIndex((p) => patternKey(p) === key) }
}

const diff = (a: TonePattern, b: TonePattern) => a.reduce((n, t, i) => n + (t === b[i] ? 0 : 1), 0)

export function buildToneGame(words: readonly QuizWord[], opts: { seed: number; count?: number }): ToneQuestion[] {
  const rng = mulberry32(opts.seed)
  const count = Math.max(1, opts.count ?? TONE_QUESTIONS)
  const { whole, parts } = toneItems(words)
  const pool = shuffle(whole, rng).slice(0, count)
  if (pool.length < count) pool.push(...shuffle(parts, rng).slice(0, count - pool.length))
  return shuffle(pool, rng).map((it) => {
    const tones = plainTones(it.syllables)!
    const { choices, answer } = choicesFor(tones, rng)
    return { wordId: it.wordId, hanzi: it.hanzi, syllables: it.syllables, part: it.part, choices, answer }
  })
}
