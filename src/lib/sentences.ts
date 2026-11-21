// Pure helpers for the Tatoeba sentence filter (no file or network access, so they can be tested offline):
// segmentation with longest match, the accept/reject rules, the ranking and the report.
// Used by scripts/filter-sentences.ts.

export interface WordInput {
  id: string
  hanzi: string
  variants: string[]
  traditional: string
}
export interface UnitInput {
  id: string
  order: number
  words: string[]
}

/** Punctuation allowed in a sentence besides Han characters and Arabic digits. */
export const ALLOWED_PUNCT = '。，！？、：；“”‘’《》…·—（）'
export const MIN_HAN = 4
export const MAX_HAN = 20
export const MAX_FOREIGN_LENGTH = 2
export const MAX_TRANSLATIONS = 2
export const DEFAULT_PER_WORD = 8
export const MAX_FILE_BYTES = 3 * 1024 * 1024

const HAN = /^\p{Script=Han}$/u
const DIGIT = /^[0-9]$/
const LATIN = /[A-Za-zÀ-ɏＡ-Ｚａ-ｚ]/u

export interface Lexicon {
  /** Written form (hanzi or variant) -> ids of the words that use it (more than one for 还, 地, 干). */
  forms: Map<string, string[]>
  maxFormLength: number
  /** Characters that only occur as the traditional form of an HSK 1 word (們 愛 說 這 ...). */
  traditionalOnly: Set<string>
  wordUnit: Map<string, { unit: string; order: number }>
}

export function buildLexicon(words: WordInput[], units: UnitInput[]): Lexicon {
  const forms = new Map<string, string[]>()
  const simplifiedChars = new Set<string>()
  const traditionalOnly = new Set<string>()
  let maxFormLength = 1
  for (const w of words) {
    for (const form of [w.hanzi, ...w.variants]) {
      const ids = forms.get(form)
      if (!ids) forms.set(form, [w.id])
      else if (!ids.includes(w.id)) ids.push(w.id)
      maxFormLength = Math.max(maxFormLength, [...form].length)
      for (const ch of form) simplifiedChars.add(ch)
    }
  }
  for (const w of words) {
    const simp = [...w.hanzi]
    const trad = [...w.traditional]
    if (simp.length !== trad.length) continue
    simp.forEach((ch, i) => {
      if (trad[i] !== ch) traditionalOnly.add(trad[i])
    })
  }
  // A character that is also a plain simplified character of another word is not a reliable marker.
  for (const ch of simplifiedChars) traditionalOnly.delete(ch)

  const wordUnit = new Map<string, { unit: string; order: number }>()
  for (const u of units) for (const id of u.words) wordUnit.set(id, { unit: u.id, order: u.order })
  for (const w of words) if (!wordUnit.has(w.id)) throw new Error(`word ${w.id} is not in any unit`)
  return { forms, maxFormLength, traditionalOnly, wordUnit }
}

export type Token =
  | { kind: 'word'; text: string; ids: string[] }
  | { kind: 'digits' | 'punct' | 'foreign'; text: string }

/** Left-to-right longest match against all HSK 1 forms; unmatched characters form one "foreign" token per run. */
export function segment(text: string, lex: Lexicon): Token[] {
  const chars = [...text]
  const tokens: Token[] = []
  let i = 0
  while (i < chars.length) {
    const ch = chars[i]
    if (DIGIT.test(ch)) {
      let j = i
      while (j < chars.length && DIGIT.test(chars[j])) j++
      tokens.push({ kind: 'digits', text: chars.slice(i, j).join('') })
      i = j
      continue
    }
    if (ALLOWED_PUNCT.includes(ch)) {
      tokens.push({ kind: 'punct', text: ch })
      i++
      continue
    }
    let matched = false
    for (let len = Math.min(lex.maxFormLength, chars.length - i); len >= 1; len--) {
      const candidate = chars.slice(i, i + len).join('')
      const ids = lex.forms.get(candidate)
      if (ids) {
        tokens.push({ kind: 'word', text: candidate, ids })
        i += len
        matched = true
        break
      }
    }
    if (matched) continue
    const last = tokens[tokens.length - 1]
    if (last?.kind === 'foreign') last.text += ch
    else tokens.push({ kind: 'foreign', text: ch })
    i++
  }
  return tokens
}

export type RejectReason = 'latin' | 'other-char' | 'traditional' | 'length' | 'foreign' | 'no-words'
export const REJECT_REASONS: RejectReason[] = ['latin', 'other-char', 'traditional', 'length', 'foreign', 'no-words']

export interface Analysis {
  cmn: string
  words: string[]
  unit: string
  outside: string | null
  /** Number of code points, used as the "shorter is better" tie-breaker. */
  length: number
}
export type AnalyzeResult = { ok: true; value: Analysis } | { ok: false; reason: RejectReason }

export function analyzeSentence(raw: string, lex: Lexicon): AnalyzeResult {
  const text = raw.trim()
  const chars = [...text]
  if (LATIN.test(text)) return { ok: false, reason: 'latin' }
  let han = 0
  for (const ch of chars) {
    if (HAN.test(ch)) han++
    else if (!DIGIT.test(ch) && !ALLOWED_PUNCT.includes(ch)) return { ok: false, reason: 'other-char' }
  }
  if (chars.some((ch) => lex.traditionalOnly.has(ch))) return { ok: false, reason: 'traditional' }
  if (han < MIN_HAN || han > MAX_HAN) return { ok: false, reason: 'length' }

  const tokens = segment(text, lex)
  const foreign = tokens.filter((t) => t.kind === 'foreign')
  if (foreign.length > 1 || (foreign[0] && [...foreign[0].text].length > MAX_FOREIGN_LENGTH)) return { ok: false, reason: 'foreign' }

  const words: string[] = []
  let unit: { unit: string; order: number } | null = null
  for (const t of tokens) {
    if (t.kind !== 'word') continue
    for (const id of t.ids) if (!words.includes(id)) words.push(id)
    // A form shared by two words (还, 地, 干) counts as learned once its earliest reading is.
    const earliest = t.ids.map((id) => lex.wordUnit.get(id)!).reduce((a, b) => (a.order <= b.order ? a : b))
    if (!unit || earliest.order > unit.order) unit = earliest
  }
  if (!unit) return { ok: false, reason: 'no-words' }
  return { ok: true, value: { cmn: text, words, unit: unit.unit, outside: foreign[0]?.text ?? null, length: chars.length } }
}

// ---------- ranking ----------

export interface Candidate {
  tatoebaId: number
  words: string[]
  ok: boolean
  licensedAudio: boolean
  hasInd: boolean
  outside: string | null
  length: number
}

/** Better candidates sort first: OK tag, licensed audio, Indonesian translation, no outside word, shorter, smaller id. */
export function compareCandidates(a: Candidate, b: Candidate): number {
  return (
    Number(b.ok) - Number(a.ok) ||
    Number(b.licensedAudio) - Number(a.licensedAudio) ||
    Number(b.hasInd) - Number(a.hasInd) ||
    Number(a.outside !== null) - Number(b.outside !== null) ||
    a.length - b.length ||
    a.tatoebaId - b.tatoebaId
  )
}

/** Ids of the sentences kept when every word keeps at most `cap` of its best candidates. */
export function selectPerWord(candidates: Candidate[], wordIds: string[], cap: number): Set<number> {
  const byWord = new Map<string, Candidate[]>(wordIds.map((id) => [id, []]))
  for (const c of candidates) for (const id of c.words) byWord.get(id)?.push(c)
  const chosen = new Set<number>()
  for (const list of byWord.values()) {
    list.sort(compareCandidates)
    for (const c of list.slice(0, cap)) chosen.add(c.tatoebaId)
  }
  return chosen
}

// ---------- output ----------

export interface Attribution {
  tatoebaId: number
  text: string
  author: string
  license: string
}
export interface AudioRef {
  audioId: number
  author: string
  license: string
  attributionUrl: string
}
export interface SentenceEntry {
  tatoebaId: number
  cmn: string
  author: string
  license: string
  ok: boolean
  outside: string | null
  words: string[]
  unit: string
  en: Attribution[]
  ind: Attribution[]
  audio: AudioRef[]
}

/** One entry per line keeps diffs readable and the file small. */
export function formatSentences(entries: SentenceEntry[], perWord: number): string {
  const lines = entries.map((e) => `    ${JSON.stringify(e)}`)
  return `{\n  "version": 1,\n  "perWordLimit": ${perWord},\n  "sentences": [\n${lines.join(',\n')}\n  ]\n}\n`
}

export interface FilterStats {
  cmnSentences: number
  rejected: Record<RejectReason, number>
  noAuthor: number
  noEnglish: number
  candidates: number
}

export interface Report {
  generatedAt: string
  perWordLimit: number
  fileBytes: number
  totalSentences: number
  stats: FilterStats
  perUnit: Record<string, number>
  unitsBelowFive: { unit: string; count: number }[]
  perWord: Record<string, number>
  wordsWithoutSentences: string[]
}

export function buildReport(
  entries: SentenceEntry[],
  words: WordInput[],
  units: UnitInput[],
  stats: FilterStats,
  info: { generatedAt: string; perWordLimit: number; fileBytes: number },
): Report {
  const perUnit: Record<string, number> = Object.fromEntries(units.map((u) => [u.id, 0]))
  const perWord: Record<string, number> = Object.fromEntries(words.map((w) => [w.id, 0]))
  for (const e of entries) {
    perUnit[e.unit] = (perUnit[e.unit] ?? 0) + 1
    for (const id of e.words) if (id in perWord) perWord[id]++
  }
  return {
    ...info,
    totalSentences: entries.length,
    stats,
    perUnit,
    unitsBelowFive: Object.entries(perUnit)
      .filter(([, count]) => count < 5)
      .map(([unit, count]) => ({ unit, count })),
    perWord,
    wordsWithoutSentences: Object.entries(perWord)
      .filter(([, count]) => count === 0)
      .map(([id]) => id),
  }
}
