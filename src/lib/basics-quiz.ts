// Pembuat soal latihan Tahap 0 (fungsi murni, deterministik dengan seed).
// Setiap soal: tepat 4 pilihan unik, tepat satu benar.
import type {
  AudioItem,
  BasicsData,
  BasicsPart,
  BasicStroke,
  Radical,
  SandhiExample,
  StrokeId,
} from './basics.ts'
import type { Bilingual } from './lesson-types.ts'
import { stripTones, syllableTone } from './pinyin.ts'
import { mulberry32, shuffle, toneMark } from './quiz.ts'

export const BASICS_QUIZ_LENGTH = 8

export type BKind =
  | 'listen-pinyin'
  | 'read-pinyin'
  | 'listen-tone'
  | 'read-tone'
  | 'sandhi'
  | 'stroke-name'
  | 'stroke-first'
  | 'radical-in'
  | 'radical-meaning'
  | 'listen-meaning'
  | 'hanzi-meaning'

export type BChoice =
  | { type: 'pinyin'; key: string; text: string }
  | { type: 'tone'; key: string; tone: 1 | 2 | 3 | 4; text: string }
  | { type: 'stroke'; key: string; id: StrokeId; hanzi: string; pinyin: string; meaning: Bilingual }
  | { type: 'radical'; key: string; radical: string; meaning: Bilingual }
  | { type: 'meaning'; key: string; meaning: Bilingual }

export interface BPrompt {
  hanzi?: string
  pinyin?: string
  /** Pinyin dasar per huruf (soal perubahan nada). */
  base?: string[]
  /** Coretan yang disorot: huruf + indeks coretan. */
  stroke?: { char: string; index: number }
  radical?: string
  meaning?: Bilingual
}

export interface BQuestion {
  kind: BKind
  /** Suara yang diputar (soal dengar; juga dipakai untuk "dengar lagi" setelah menjawab). */
  audio?: AudioItem
  prompt: BPrompt
  choices: BChoice[]
  answer: number
  /** Ditampilkan di umpan balik. */
  reveal: { hanzi?: string; pinyin?: string; meaning?: Bilingual }
}

export interface BasicsQuizOptions {
  seed: number
  /** Apakah item ini bisa diputar (file mp3 atau suara perangkat). Soal dengar tanpa suara diganti soal baca. */
  hasAudio: (item: AudioItem) => boolean
  count?: number
}

type Rng = () => number

const pick = <T>(items: readonly T[], n: number, rng: Rng): T[] => shuffle(items, rng).slice(0, n)

/** Gabung jawaban + pengecoh (urutan diacak, kunci unik). */
function withAnswer(answer: BChoice, others: BChoice[], rng: Rng): { choices: BChoice[]; answer: number } {
  const seen = new Set([answer.key])
  const rest: BChoice[] = []
  for (const c of others) {
    if (rest.length === 3) break
    if (seen.has(c.key)) continue
    seen.add(c.key)
    rest.push(c)
  }
  if (rest.length < 3) throw new Error(`pengecoh kurang untuk ${answer.key}`)
  const choices = shuffle([answer, ...rest], rng)
  return { choices, answer: choices.indexOf(answer) }
}

const pinyinChoice = (text: string): BChoice => ({ type: 'pinyin', key: text, text })
const meaningChoice = (meaning: Bilingual): BChoice => ({ type: 'meaning', key: meaning.en.toLowerCase(), meaning })
const strokeChoice = (s: BasicStroke): BChoice => ({ type: 'stroke', key: s.id, id: s.id, hanzi: s.hanzi, pinyin: s.pinyin, meaning: s.meaning })
const radicalChoice = (r: Radical): BChoice => ({ type: 'radical', key: r.radical, radical: r.radical, meaning: r.meaning })

/** Empat pilihan nada (urut 1-4, supaya tombol 1-4 = nada 1-4). */
export function toneChoices(syllable: string): BChoice[] {
  const base = stripTones(syllable).toLowerCase()
  return ([1, 2, 3, 4] as const).map((t) => ({ type: 'tone', key: `t${t}`, tone: t, text: toneMark(base, t) }))
}

/** Empat cara baca: suku kata `focus` diberi nada 1-4, suku kata lain seperti diucapkan. */
export function sandhiChoices(ex: SandhiExample): { choices: BChoice[]; answer: number } {
  const correct = ex.spoken.join(' ')
  const choices: BChoice[] = ([1, 2, 3, 4] as const).map((t) => {
    const syl = ex.spoken.map((s, i) => (i === ex.focus ? toneMark(s, t) : s)).join(' ')
    return pinyinChoice(syl)
  })
  const answer = choices.findIndex((c) => c.key === correct)
  if (answer < 0) throw new Error(`jawaban tidak ada di pilihan: ${ex.audioId}`)
  return { choices, answer }
}

// ---------- per bagian ----------

function pinyinQuiz(d: BasicsData, n: number, o: BasicsQuizOptions, rng: Rng): BQuestion[] {
  const half = Math.ceil(n / 2)
  const items = shuffle([...pick(d.pinyin.initials, half, rng), ...pick(d.pinyin.finals, n - half, rng)], rng)
  return items.map((it) => {
    const audio = o.hasAudio(it)
    const { choices, answer } = withAnswer(pinyinChoice(it.pinyin), shuffle(it.distractors, rng).map(pinyinChoice), rng)
    return {
      kind: audio ? 'listen-pinyin' : 'read-pinyin',
      audio: audio ? it : undefined,
      prompt: audio ? {} : { hanzi: it.hanzi },
      choices,
      answer,
      reveal: { hanzi: it.hanzi, pinyin: it.pinyin, meaning: it.meaning },
    }
  })
}

function toneQuiz(d: BasicsData, n: number, o: BasicsQuizOptions, rng: Rng): BQuestion[] {
  const all = d.tones.sets.flatMap((s) => s.items).filter((i) => syllableTone(i.pinyin) !== 5)
  return pick(all, n, rng).map((it) => {
    const audio = o.hasAudio(it)
    const choices = toneChoices(it.pinyin)
    return {
      kind: audio ? 'listen-tone' : 'read-tone',
      audio: audio ? it : undefined,
      prompt: audio ? { meaning: it.meaning } : { hanzi: it.hanzi, pinyin: stripTones(it.pinyin), meaning: it.meaning },
      choices,
      answer: syllableTone(it.pinyin) - 1,
      reveal: { hanzi: it.hanzi, pinyin: it.pinyin, meaning: it.meaning },
    }
  })
}

function sandhiQuiz(d: BasicsData, n: number, o: BasicsQuizOptions, rng: Rng): BQuestion[] {
  // Bergiliran dari tiap aturan supaya ketiganya muncul.
  const queues = d.sandhi.rules.map((r) => shuffle(r.examples, rng))
  const chosen: SandhiExample[] = []
  for (let round = 0; chosen.length < n && queues.some((q) => q.length > round); round++) {
    for (const q of queues) if (q[round] && chosen.length < n) chosen.push(q[round])
  }
  return shuffle(chosen, rng).map((ex) => ({
    kind: 'sandhi',
    audio: o.hasAudio(ex) ? ex : undefined,
    prompt: { hanzi: ex.hanzi, base: ex.base, meaning: ex.meaning },
    ...sandhiChoices(ex),
    reveal: { hanzi: ex.hanzi, pinyin: ex.spoken.join(' '), meaning: ex.meaning },
  }))
}

const FIRST_POOL: StrokeId[] = ['heng', 'shu', 'pie', 'na', 'dian', 'gou', 'zhe']

function strokeQuiz(d: BasicsData, n: number, _o: BasicsQuizOptions, rng: Rng): BQuestion[] {
  const byId = new Map(d.strokes.basic.map((s) => [s.id, s]))
  const nFirst = Math.floor(n * 0.4)
  const names: BQuestion[] = pick(d.strokes.basic, n - nFirst, rng).map((s) => ({
    kind: 'stroke-name',
    prompt: { stroke: { char: s.example.char, index: s.example.stroke } },
    ...withAnswer(strokeChoice(s), shuffle(d.strokes.basic, rng).map(strokeChoice), rng),
    reveal: { hanzi: s.hanzi, pinyin: s.pinyin, meaning: s.meaning },
  }))
  const examples = d.strokes.rules.flatMap((r) => r.examples.map((e) => ({ ...e, rule: r })))
  const firsts: BQuestion[] = pick(examples, nFirst, rng).map((e) => {
    const s = byId.get(e.first)!
    const pool = FIRST_POOL.filter((id) => id !== e.first && !(e.avoid ?? []).includes(id)).map((id) => strokeChoice(byId.get(id)!))
    return {
      kind: 'stroke-first',
      prompt: { hanzi: e.char },
      ...withAnswer(strokeChoice(s), shuffle(pool, rng), rng),
      reveal: { hanzi: e.rule.hanzi, pinyin: e.rule.pinyin, meaning: e.rule.text },
    }
  })
  return shuffle([...names, ...firsts], rng)
}

function radicalQuiz(d: BasicsData, n: number, o: BasicsQuizOptions, rng: Rng): BQuestion[] {
  const nMeaning = Math.floor(n * 0.4)
  const examples = d.radicals.items.flatMap((r) => r.examples.map((e) => ({ ...e, radical: r })))
  const ins: BQuestion[] = pick(examples, n - nMeaning, rng).map((e) => {
    const exclude = new Set([e.radical.radical, ...(e.also ?? [])])
    const pool = shuffle(d.radicals.items.filter((r) => !exclude.has(r.radical)), rng).map(radicalChoice)
    return {
      kind: 'radical-in',
      audio: o.hasAudio(e) ? e : undefined,
      prompt: { hanzi: e.hanzi, meaning: e.meaning },
      ...withAnswer(radicalChoice(e.radical), pool, rng),
      reveal: { hanzi: e.hanzi, pinyin: e.pinyin, meaning: e.meaning },
    }
  })
  const means: BQuestion[] = pick(d.radicals.items, nMeaning, rng).map((r) => ({
    kind: 'radical-meaning',
    prompt: { radical: r.radical },
    ...withAnswer(
      meaningChoice(r.meaning),
      shuffle(d.radicals.items.filter((x) => x !== r), rng).map((x) => meaningChoice(x.meaning)),
      rng,
    ),
    reveal: { hanzi: r.radical, pinyin: r.pinyin, meaning: r.meaning },
  }))
  return shuffle([...ins, ...means], rng)
}

function phraseQuiz(d: BasicsData, n: number, o: BasicsQuizOptions, rng: Rng): BQuestion[] {
  const groups = [d.phrases.numbers, d.phrases.greetings] as const
  const half = Math.ceil(n / 2)
  const items = shuffle(
    [...pick(groups[0], n - half, rng).map((it) => ({ it, group: groups[0] as readonly (typeof it)[] })), ...pick(groups[1], half, rng).map((it) => ({ it, group: groups[1] as readonly (typeof it)[] }))],
    rng,
  )
  return items.map(({ it, group }, i) => {
    const listen = i % 2 === 0 && o.hasAudio(it)
    return {
      kind: listen ? 'listen-meaning' : 'hanzi-meaning',
      audio: o.hasAudio(it) ? it : undefined,
      prompt: listen ? {} : { hanzi: it.hanzi, pinyin: it.pinyin },
      ...withAnswer(
        meaningChoice(it.meaning),
        shuffle(group.filter((x) => x !== it), rng).map((x) => meaningChoice(x.meaning)),
        rng,
      ),
      reveal: { hanzi: it.hanzi, pinyin: it.pinyin, meaning: it.meaning },
    }
  })
}

const BUILDERS: Record<BasicsPart, (d: BasicsData, n: number, o: BasicsQuizOptions, rng: Rng) => BQuestion[]> = {
  pinyin: pinyinQuiz,
  nada: toneQuiz,
  'perubahan-nada': sandhiQuiz,
  coretan: strokeQuiz,
  radikal: radicalQuiz,
  ungkapan: phraseQuiz,
}

export function buildBasicsQuiz(part: BasicsPart, data: BasicsData, opts: BasicsQuizOptions): BQuestion[] {
  const rng = mulberry32(opts.seed)
  return BUILDERS[part](data, opts.count ?? BASICS_QUIZ_LENGTH, opts, rng)
}
