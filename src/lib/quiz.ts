// Pembuat soal latihan (fungsi murni, deterministik dengan seed).
import { stripTones, syllableTone, type Tone } from './pinyin.ts'
import type { Lang } from './settings.ts'

export type QuestionKind = 'hanzi-meaning' | 'meaning-hanzi' | 'audio-hanzi' | 'tone'
export const QUESTION_KINDS: QuestionKind[] = ['hanzi-meaning', 'meaning-hanzi', 'audio-hanzi', 'tone']

export const UNIT_QUIZ_LENGTH = 12
export const SKIP_QUIZ_LENGTH = 15

export interface QuizWord {
  id: string
  hanzi: string
  pinyin: string
  syllables: string[]
  en: string[]
  ind: string[]
}

export type Choice =
  | { type: 'word'; wordId: string }
  | { type: 'tone'; tone: 1 | 2 | 3 | 4; text: string }

export interface Question {
  kind: QuestionKind
  wordId: string
  /** Soal nada: indeks suku kata yang ditanyakan. */
  syllable?: number
  choices: Choice[]
  /** Indeks pilihan yang benar. */
  answer: number
}

export interface QuizOptions {
  seed: number
  /** Suara tersedia? Bila tidak, soal audio->hanzi diganti hanzi->arti. */
  audio: boolean
  count?: number
}

// ---------- RNG ----------

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

// ---------- pinyin ----------

const MARKS: Record<1 | 2 | 3 | 4, string> = { 1: '\u0304', 2: '\u0301', 3: '\u030c', 4: '\u0300' }

/**
 * Taruh tanda nada pada vokal yang benar. Masukan: suku kata bernomor ("nv3", "lve4") atau dasar
 * ("nü", "gui"); angka di akhir diabaikan, `tone` yang dipakai. Aturan: a atau e bila ada; "ou" -> o;
 * selain itu vokal terakhir (iu -> u, ui -> i). Nada 5 = tanpa tanda.
 */
export function toneMark(syllable: string, tone: Tone): string {
  let s = stripTones(syllable.normalize('NFC').toLowerCase()).replace(/[1-5]$/, '')
  s = s.replace(/u:/g, 'ü').replace(/v/g, 'ü')
  if (tone === 5) return s
  let idx = s.indexOf('a')
  if (idx < 0) idx = s.indexOf('e')
  if (idx < 0 && s.includes('ou')) idx = s.indexOf('o')
  if (idx < 0) {
    for (let i = s.length - 1; i >= 0; i--) {
      if ('iouü'.includes(s[i])) {
        idx = i
        break
      }
    }
  }
  if (idx < 0) return s
  return (s.slice(0, idx + 1) + MARKS[tone] + s.slice(idx + 1)).normalize('NFC')
}

/** Indeks suku kata bernada 1-4 (nada ringan & erhua tidak ditanyakan). */
export function toneSyllables(word: Pick<QuizWord, 'syllables'>): number[] {
  const out: number[] = []
  word.syllables.forEach((s, i) => {
    if (syllableTone(s) !== 5) out.push(i)
  })
  return out
}

// ---------- arti ----------

/** Rapikan arti CC-CEDICT: "您[nin2]" -> "您", "你|您" -> "你". */
export function cleanEn(text: string): string {
  return text
    .replace(/\|[^\s[\],;()]+/g, '')
    .replace(/\[[A-Za-z0-9: ]+\]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/** Arti singkat untuk pilihan jawaban / soal. */
export function meaningShort(word: Pick<QuizWord, 'en' | 'ind'>, lang: Lang): string {
  if (lang === 'id') return word.ind.slice(0, 2).join(', ')
  return cleanEn(word.en[0] ?? '').split(/;\s*/).slice(0, 2).join('; ')
}

const norm = (s: string) => s.trim().toLowerCase()
const soundKey = (w: QuizWord) => norm(w.pinyin).replace(/[\s'-]/g, '')

// ---------- pembuat soal ----------

function wordQuestion(kind: QuestionKind, answer: QuizWord, group: QuizWord[], rng: () => number): Question {
  const picked: QuizWord[] = [answer]
  const clash = (w: QuizWord) =>
    picked.some(
      (p) =>
        p.hanzi === w.hanzi ||
        norm(meaningShort(p, 'id')) === norm(meaningShort(w, 'id')) ||
        norm(meaningShort(p, 'en')) === norm(meaningShort(w, 'en')),
    ) ||
    (kind === 'audio-hanzi' && soundKey(w) === soundKey(answer))
  const len = [...answer.hanzi].length
  const candidates = shuffle(
    group.filter((w) => w.id !== answer.id),
    rng,
  ).sort((a, b) => Math.abs([...a.hanzi].length - len) - Math.abs([...b.hanzi].length - len))
  for (const w of candidates) {
    if (picked.length === 4) break
    if (!clash(w)) picked.push(w)
  }
  const choices = shuffle(picked, rng)
  return {
    kind,
    wordId: answer.id,
    choices: choices.map((w) => ({ type: 'word', wordId: w.id })),
    answer: choices.indexOf(answer),
  }
}

function toneQuestion(word: QuizWord, rng: () => number): Question {
  const eligible = toneSyllables(word)
  const syllable = eligible[Math.floor(rng() * eligible.length)]
  const tone = syllableTone(word.syllables[syllable]) as 1 | 2 | 3 | 4
  const tones = [1, 2, 3, 4] as const
  // Pilihan nada tetap berurutan 1-4 supaya tombol 1-4 = nada 1-4.
  return {
    kind: 'tone',
    wordId: word.id,
    syllable,
    choices: tones.map((t) => ({ type: 'tone', tone: t, text: toneMark(word.syllables[syllable], t) })),
    answer: tone - 1,
  }
}

/**
 * Soal dari beberapa kelompok kata (latihan unit = 1 kelompok; tes loncat = satu kelompok per unit).
 * Kata dipilih bergiliran dari tiap kelompok; pengecoh dari kelompok yang sama dengan jawabannya.
 */
export function buildQuiz(groups: QuizWord[][], count: number, opts: QuizOptions): Question[] {
  const rng = mulberry32(opts.seed)
  const queues = shuffle(
    groups.filter((g) => g.length > 0).map((g) => shuffle(g, rng)),
    rng,
  )
  const groupOf = new Map<string, QuizWord[]>()
  groups.forEach((g) => g.forEach((w) => groupOf.set(w.id, g)))
  const total = queues.reduce((n, q) => n + q.length, 0)
  const selected: QuizWord[] = []
  for (let round = 0; selected.length < Math.min(count, total); round++) {
    for (const q of queues) {
      if (round < q.length && selected.length < count) selected.push(q[round])
    }
  }
  if (selected.length === 0) return []

  const base: QuestionKind[] = opts.audio
    ? ['hanzi-meaning', 'meaning-hanzi', 'audio-hanzi', 'tone']
    : ['hanzi-meaning', 'meaning-hanzi', 'hanzi-meaning', 'tone']
  const kinds = shuffle(
    selected.map((_, i) => base[i % base.length]),
    rng,
  )
  // Soal nada dulu, supaya kata yang punya nada 1-4 dipakai untuk soal nada.
  const assigned: (QuizWord | undefined)[] = new Array(kinds.length)
  const free = [...selected]
  kinds.forEach((k, i) => {
    if (k !== 'tone') return
    const j = free.findIndex((w) => toneSyllables(w).length > 0)
    if (j < 0) kinds[i] = 'hanzi-meaning'
    else assigned[i] = free.splice(j, 1)[0]
  })
  kinds.forEach((_, i) => {
    if (!assigned[i]) assigned[i] = free.shift()
  })
  return kinds.map((k, i) => {
    const w = assigned[i]!
    return k === 'tone' ? toneQuestion(w, rng) : wordQuestion(k, w, groupOf.get(w.id)!, rng)
  })
}

export const buildUnitQuiz = (words: QuizWord[], opts: QuizOptions) =>
  buildQuiz([words], opts.count ?? UNIT_QUIZ_LENGTH, opts)

/** Tes loncat: kelompok = kata tiap unit sebelum unit tujuan. */
export const buildSkipQuiz = (groups: QuizWord[][], opts: QuizOptions) =>
  buildQuiz(groups, opts.count ?? SKIP_QUIZ_LENGTH, opts)

/**
 * Soal ulangan: tepat satu soal per kata (kata kembar di `asked` dibuang), urutan sama dengan
 * `asked` (kata paling perlu diulang dulu). `pool` = kata per unit; pengecoh dari unit kata itu.
 * Jenis soal bergiliran seperti latihan; soal nada hanya untuk kata yang punya nada 1-4.
 */
export function buildReviewQuiz(asked: QuizWord[], pool: QuizWord[][], opts: QuizOptions): Question[] {
  const rng = mulberry32(opts.seed)
  const seen = new Set<string>()
  const words = asked.filter((w) => !seen.has(w.id) && seen.add(w.id))
  if (words.length === 0) return []
  const groupOf = new Map<string, QuizWord[]>()
  pool.forEach((g) => g.forEach((w) => groupOf.set(w.id, g)))
  const base: QuestionKind[] = opts.audio
    ? ['hanzi-meaning', 'meaning-hanzi', 'audio-hanzi', 'tone']
    : ['hanzi-meaning', 'meaning-hanzi', 'hanzi-meaning', 'tone']
  const kinds = shuffle(
    words.map((_, i) => base[i % base.length]),
    rng,
  )
  return words.map((w, i) => {
    const k = kinds[i] === 'tone' && toneSyllables(w).length === 0 ? 'hanzi-meaning' : kinds[i]
    return k === 'tone' ? toneQuestion(w, rng) : wordQuestion(k, w, groupOf.get(w.id) ?? [w], rng)
  })
}

export function isCorrect(q: Question, choiceIndex: number): boolean {
  return choiceIndex === q.answer
}
