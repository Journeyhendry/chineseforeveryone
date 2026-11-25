// Task 6c stage 1: one example sentence (and for some words a short dialog) per HSK 1 word.
// Pure functions (no file access): segmentation, pinyin/tone checks, validation of the per-unit drafts
// (data/hsk1/word-sentences/uNN.json), the merged file + report, the reviewer export and the review gate.
// Used by scripts/build-word-sentences.ts, scripts/check-data.ts and src/lib/word-sentences.test.ts.

import { splitSyllables, syllableTone, type Tone } from './pinyin.ts'
import { buildLexicon, type Lexicon, type UnitInput, type WordInput } from './sentences.ts'

export const MAX_HANZI = 14
export const TARGET_HANZI = 10
export const MAX_OUTSIDE = 2
export const MIN_SCORE = 4
export const IN_SCOPE_TARGET_PCT = 70
export const SOURCES = ['unit', 'tatoeba', 'buatan']
export const SCENE_FITS = ['keep', 'rebubble', 'redraw', 'new']
export const SCORE_KEYS = ['natural', 'correct', 'beginner', 'drawable'] as const

export interface Bilingual {
  id: string
  en: string
}
export interface DraftLine {
  who: string
  hanzi: string
  pinyin: string
  id: string
  en: string
}
export interface DraftSentence {
  hanzi: string
  pinyin: string
  id: string
  en: string
  source: string
  sourceId: string | number | null
  speaker: string
  matchForm: string | null
}
export interface DraftEntry {
  wordId: string
  hanzi: string
  sentence: DraftSentence
  dialog: { reason: Bilingual; lines: DraftLine[] } | null
  scene: { ref: string | null; fit: string; note: string }
}
export interface DraftFile {
  unit: string
  entries: DraftEntry[]
}

export interface WordRow extends WordInput {
  pinyin: string
  tones: Tone[]
  en: string[]
  ind: string[]
}
export interface Speaker {
  name: Bilingual
  gender: string
}

export interface ContextInput {
  words: WordRow[]
  units: UnitInput[]
  /** Extra dictionary headwords (HSK 2 preview hanzi, CC-CEDICT simplified). */
  dictionary: Iterable<string>
  speakers: Record<string, Speaker>
  sceneRefs: Iterable<string>
  tatoeba: { tatoebaId: number; cmn: string }[]
  /** Local corpus lines for the collocation evidence (Tatoeba cmn, natural dialog lines, casual items). */
  corpus: string[]
}
export interface Context {
  words: Map<string, WordRow>
  units: UnitInput[]
  lex: Lexicon
  /** HSK 1 forms used by the segmenter (see segmentForms). */
  forms: Map<string, string[]>
  known: Set<string>
  speakers: Record<string, Speaker>
  sceneRefs: Set<string>
  tatoeba: Map<number, string>
  corpus: string[]
}

export function makeContext(input: ContextInput): Context {
  const dictionary = [...input.dictionary]
  const lex = buildLexicon(input.words, input.units, dictionary)
  return {
    words: new Map(input.words.map((w) => [w.id, w])),
    units: [...input.units].sort((a, b) => a.order - b.order),
    lex,
    forms: segmentForms(lex, input.words),
    known: new Set([...dictionary, ...lex.forms.keys()]),
    speakers: input.speakers,
    sceneRefs: new Set(input.sceneRefs),
    tatoeba: new Map(input.tatoeba.map((s) => [s.tatoebaId, s.cmn])),
    corpus: input.corpus,
  }
}

// ---------------------------------------------------------------- segmentation

export interface Segment {
  text: string
  kind: 'hsk1' | 'outside'
  ids: string[]
  /** Index of the first character in the Han-only character list. */
  start: number
}
export interface Segmented {
  segments: Segment[]
  han: string[]
  hasDigits: boolean
}

const HAN_RUN = /\p{Script=Han}+/gu
const DIGITS = /[0-9０-９]/

interface Cost {
  outside: number
  tokens: number
  outsideChars: number
}
const better = (a: Cost, b: Cost) =>
  a.outside !== b.outside ? a.outside < b.outside : a.tokens !== b.tokens ? a.tokens < b.tokens : a.outsideChars < b.outsideChars

/**
 * HSK 1 forms usable as one token. A variant made only of other HSK 1 forms (有一些 = 有 + 一些) is left out,
 * so it is counted as those words.
 */
export function segmentForms(lex: Lexicon, words: { hanzi: string }[]): Map<string, string[]> {
  const canonical = new Set(words.map((w) => w.hanzi))
  const splitsAll = (c: string[]): boolean => c.length === 0 || c.some((_, k) => lex.forms.has(c.slice(0, k + 1).join('')) && splitsAll(c.slice(k + 1)))
  const isCompound = (c: string[]) => c.some((_, k) => k > 0 && lex.forms.has(c.slice(0, k).join('')) && splitsAll(c.slice(k)))
  return new Map([...lex.forms].filter(([form]) => canonical.has(form) || !isCompound([...form])))
}

/**
 * Lowest-cost segmentation of each run of Han characters over HSK 1 forms + dictionary headwords (dynamic
 * programming). Cost, compared in order: fewest outside tokens (non-HSK 1 dictionary words or unknown single
 * characters), then fewest tokens, then fewest characters in outside tokens. So any split into HSK 1 words beats a
 * dictionary compound (有时间 -> 有 时间, 和牛奶 -> 和 牛奶), while an outside compound stays whole (奶茶, not 奶 + 茶).
 * Digits and punctuation are skipped.
 */
export function segmentText(text: string, lex: Lexicon, forms: Map<string, string[]> = lex.forms): Segmented {
  const segments: Segment[] = []
  const han: string[] = []
  for (const run of text.match(HAN_RUN) ?? []) {
    const chars = [...run]
    const base = han.length
    han.push(...chars)
    const n = chars.length
    const best: { cost: Cost; len: number }[] = Array.from({ length: n + 1 }, () => ({ cost: { outside: 0, tokens: 0, outsideChars: 0 }, len: 0 }))
    for (let i = n - 1; i >= 0; i--) {
      let pick: { cost: Cost; len: number } | null = null
      for (let len = Math.min(lex.maxDictionaryLength, n - i); len >= 1; len--) {
        const piece = chars.slice(i, i + len).join('')
        const hsk1 = forms.has(piece)
        if (!hsk1 && len > 1 && !lex.dictionary.has(piece)) continue
        const rest = best[i + len].cost
        const cost = { outside: rest.outside + (hsk1 ? 0 : 1), tokens: rest.tokens + 1, outsideChars: rest.outsideChars + (hsk1 ? 0 : len) }
        if (pick === null || better(cost, pick.cost)) pick = { cost, len }
      }
      best[i] = pick!
    }
    for (let i = 0; i < n; i += best[i].len) {
      const piece = chars.slice(i, i + best[i].len).join('')
      const ids = forms.get(piece)
      segments.push({ text: piece, kind: ids ? 'hsk1' : 'outside', ids: ids ?? [], start: base + i })
    }
  }
  return { segments, han, hasDigits: DIGITS.test(text) }
}

const uniq = (xs: string[]) => [...new Set(xs)]

export const hanziCount = (text: string): number => [...text].filter((c) => /\p{Script=Han}/u.test(c) || DIGITS.test(c)).length

// ---------------------------------------------------------------- pinyin and tones

export interface Issue {
  level: 'error' | 'warning'
  message: string
}

/** Syllables of tone-marked pinyin; an erhua "r" is its own syllable (面条儿 miàntiáor -> miàn tiáo r). */
export const pinyinSyllables = (pinyin: string): string[] => splitSyllables(pinyin)

/** Expected tone per character of `form` (the word's hanzi or one of its variants); null = unknown. */
function formTones(form: string, w: WordRow): (Tone | null)[] {
  if (form === w.hanzi) return w.tones
  const h = [...w.hanzi]
  const f = [...form]
  return f.map((ch, i) => {
    if (ch === '儿' && i === f.length - 1 && !h.includes('儿')) return 5
    const at = h.indexOf(ch)
    return at >= 0 ? w.tones[at] : null
  })
}

/** Compares one syllable tone. 一/不 may change tone (yí/yì, bú, bu); neutral vs full tone is only a warning. */
export function compareTone(ch: string, expected: Tone | null, actual: Tone, nextBase: Tone | undefined): Issue | null {
  if (ch === '一' || ch === '不') {
    const allowed: Tone[] = ch === '一' ? [1, 2, 4] : [2, 4, 5]
    if (!allowed.includes(actual)) return { level: 'error', message: `${ch} cannot have tone ${actual}` }
    if (actual === 1 || actual === 5) return null
    const want: Tone = nextBase === undefined ? (ch === '一' ? 1 : 4) : nextBase === 4 ? 2 : 4
    return actual === want ? null : { level: 'warning', message: `${ch} tone ${actual} but the next syllable (tone ${nextBase ?? '-'}) needs tone ${want}` }
  }
  if (expected === null || expected === actual) return null
  if (expected === 5 || actual === 5) return { level: 'warning', message: `${ch} tone ${actual}, words.json has ${expected} (neutral vs full tone)` }
  const hint = expected === 3 && actual === 2 ? ' (3rd-tone sandhi is not written)' : ''
  return { level: 'error', message: `${ch} tone ${actual}, words.json has ${expected}${hint}` }
}

/** Syllable count and tone check of one sentence / dialog line against its segmentation. */
export function checkPinyin(pinyin: string, seg: Segmented, words: Map<string, WordRow>): Issue[] {
  if (seg.hasDigits) return [{ level: 'warning', message: 'contains Latin digits: write the number in hanzi (pinyin not checked)' }]
  const issues: Issue[] = []
  const first = pinyin.match(/\p{L}/u)?.[0]
  if (first && first !== first.toUpperCase()) issues.push({ level: 'warning', message: 'pinyin should start with a capital letter' })
  const syl = pinyinSyllables(pinyin)
  if (syl.length !== seg.han.length) {
    issues.push({ level: 'error', message: `pinyin has ${syl.length} syllables (${syl.join(' ')}) but hanzi has ${seg.han.length}` })
    return issues
  }
  syl.forEach((s, i) => {
    if (s.toLowerCase() === 'r' && seg.han[i] !== '儿') issues.push({ level: 'error', message: `erhua "r" lines up with ${seg.han[i]}, not 儿` })
  })
  const actual = syl.map(syllableTone)
  const base: Tone[] = [...actual]
  for (const s of seg.segments) {
    const w = s.kind === 'hsk1' ? words.get(s.ids[0]) : undefined
    if (!w) continue
    formTones(s.text, w).forEach((t, k) => {
      if (t !== null) base[s.start + k] = t
    })
  }
  for (const s of seg.segments) {
    if (s.kind !== 'hsk1') continue
    let best: Issue[] | null = null
    for (const id of s.ids) {
      const w = words.get(id)
      if (!w) continue
      const exp = formTones(s.text, w)
      const found = [...s.text].flatMap((ch, k) => {
        const i = s.start + k
        const issue = compareTone(ch, exp[k], actual[i], base[i + 1])
        return issue ? [{ level: issue.level, message: `${s.text} (${syl.slice(s.start, s.start + exp.length).join(' ')}): ${issue.message}` }] : []
      })
      const rank = (xs: Issue[]) => xs.filter((x) => x.level === 'error').length * 100 + xs.length
      if (best === null || rank(found) < rank(best)) best = found
    }
    issues.push(...(best ?? []))
  }
  return issues
}

// ---------------------------------------------------------------- analysis

export interface TextAnalysis {
  segments: string[]
  hanziCount: number
  laterUnitWords: string[]
  inScope: boolean
}
export interface Evidence {
  allInDictionary: boolean
  missing: string[]
  collocationHits: number
}

function analyze(text: string, unitOrder: number, ctx: Context) {
  const seg = segmentText(text, ctx.lex, ctx.forms)
  const outsideWords = uniq(seg.segments.filter((s) => s.kind === 'outside').map((s) => s.text))
  const laterUnitWords = uniq(
    seg.segments.filter((s) => s.kind === 'hsk1' && Math.min(...s.ids.map((id) => ctx.lex.wordUnit.get(id)?.order ?? 0)) > unitOrder).map((s) => s.text),
  )
  const analysis: TextAnalysis = {
    segments: seg.segments.map((s) => s.text),
    hanziCount: hanziCount(text),
    laterUnitWords,
    inScope: laterUnitWords.length === 0 && outsideWords.length === 0,
  }
  return { seg, outsideWords, analysis }
}

/** Dictionary coverage and how often target + neighbour occurs in the local corpus (kalimat buatan only). */
export function collectEvidence(seg: Segmented, target: string, ctx: Context): Evidence {
  const missing = uniq(seg.segments.filter((s) => !ctx.known.has(s.text)).map((s) => s.text))
  const at = seg.han.join('').indexOf(target)
  const pairs: string[] = []
  if (at >= 0) {
    const end = at + [...target].length
    const prev = seg.segments.find((s) => s.start + [...s.text].length === at)
    const next = seg.segments.find((s) => s.start === end)
    if (prev) pairs.push(prev.text + target)
    if (next) pairs.push(target + next.text)
  }
  const collocationHits = pairs.length === 0 ? 0 : ctx.corpus.filter((line) => pairs.some((p) => line.includes(p))).length
  return { allInDictionary: missing.length === 0, missing, collocationHits }
}

// ---------------------------------------------------------------- build + validation

export interface Problem {
  level: 'error' | 'warning'
  unit: string
  wordId: string
  message: string
}
export type BuiltLine = DraftLine & { outsideWords: string[]; analysis: TextAnalysis }
export interface BuiltEntry {
  unit: string
  wordId: string
  hanzi: string
  sentence: DraftSentence & { outsideWords: string[] }
  dialog: { reason: Bilingual; lines: BuiltLine[] } | null
  scene: DraftEntry['scene']
  analysis: TextAnalysis & { evidence?: Evidence }
}
export interface WordSentencesFile {
  version: 1
  entries: BuiltEntry[]
}

const isStr = (x: unknown): x is string => typeof x === 'string'
const filled = (x: unknown): boolean => isStr(x) && x.trim() !== ''
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)

/** Structural problems that make an entry unusable (it is then left out of the merged file). */
function shapeErrors(e: unknown): string[] {
  if (!isObj(e)) return ['entry is not an object']
  const out: string[] = []
  if (!isStr(e.wordId)) out.push('wordId missing')
  if (!isStr(e.hanzi)) out.push('hanzi missing')
  const s = e.sentence
  if (!isObj(s)) out.push('sentence missing')
  else for (const k of ['hanzi', 'pinyin', 'id', 'en', 'source', 'speaker']) if (!isStr(s[k])) out.push(`sentence.${k} must be a string`)
  if (e.dialog !== null && e.dialog !== undefined) {
    const d = e.dialog
    if (!isObj(d) || !isObj(d.reason) || !Array.isArray(d.lines)) out.push('dialog needs reason and lines')
    else
      d.lines.forEach((l, n) => {
        if (!isObj(l) || !['who', 'hanzi', 'pinyin', 'id', 'en'].every((k) => isStr(l[k]))) out.push(`dialog line ${n + 1} needs who, hanzi, pinyin, id, en`)
      })
  }
  if (!isObj(e.scene)) out.push('scene missing')
  return out
}

function textProblems(where: string, text: string, pinyin: string, outsideWords: string[], seg: Segmented, ctx: Context): Issue[] {
  const out: Issue[] = []
  const n = hanziCount(text)
  if (n > MAX_HANZI) out.push({ level: 'error', message: `${where}: ${n} hanzi (max ${MAX_HANZI})` })
  else if (n > TARGET_HANZI) out.push({ level: 'warning', message: `${where}: ${n} hanzi (target ≤ ${TARGET_HANZI})` })
  if (outsideWords.length > MAX_OUTSIDE) out.push({ level: 'error', message: `${where}: ${outsideWords.length} outside words (${outsideWords.join(' ')}), max ${MAX_OUTSIDE}` })
  for (const i of checkPinyin(pinyin, seg, ctx.words)) out.push({ level: i.level, message: `${where} pinyin: ${i.message}` })
  return out
}

export interface BuildResult {
  file: WordSentencesFile
  problems: Problem[]
  /** Units that have a draft file. */
  present: string[]
}

/** `drafts`: unit id -> parsed draft JSON, or a string with the parse error; units without a key have no draft yet. */
export function buildWordSentences(drafts: Record<string, unknown>, ctx: Context): BuildResult {
  const problems: Problem[] = []
  const entries: BuiltEntry[] = []
  const present: string[] = []
  const seenWord = new Map<string, string>()
  const add = (level: Problem['level'], unit: string, wordId: string, message: string) => problems.push({ level, unit, wordId, message })

  for (const u of ctx.units) {
    if (!(u.id in drafts)) {
      add('error', u.id, '', 'draft file missing')
      continue
    }
    present.push(u.id)
    const draft = drafts[u.id]
    if (isStr(draft)) {
      add('error', u.id, '', `draft is not valid JSON: ${draft}`)
      continue
    }
    if (!isObj(draft) || !Array.isArray(draft.entries)) {
      add('error', u.id, '', 'draft needs { unit, entries: [] }')
      continue
    }
    if (draft.unit !== u.id) add('error', u.id, '', `draft unit is ${String(draft.unit)}, file is ${u.id}`)
    const seenText = new Map<string, string>()
    for (const raw of draft.entries as unknown[]) {
      const shape = shapeErrors(raw)
      const wordIdRaw = isObj(raw) && isStr(raw.wordId) ? raw.wordId : ''
      if (shape.length > 0) {
        for (const m of shape) add('error', u.id, wordIdRaw, m)
        continue
      }
      const e = raw as DraftEntry
      const P = (level: Problem['level'], message: string) => add(level, u.id, e.wordId, message)
      const w = ctx.words.get(e.wordId)
      if (!w) P('error', 'unknown wordId')
      else {
        if (!u.words.includes(e.wordId)) P('error', `word belongs to ${ctx.lex.wordUnit.get(e.wordId)?.unit}, not ${u.id}`)
        if (e.hanzi !== w.hanzi) P('error', `hanzi ${e.hanzi} but words.json has ${w.hanzi}`)
      }
      if (seenWord.has(e.wordId)) P('error', `word already has an entry in ${seenWord.get(e.wordId)}`)
      else seenWord.set(e.wordId, u.id)

      const s = e.sentence
      const target = s.matchForm ?? w?.hanzi ?? e.hanzi
      if (!s.hanzi.includes(target)) P('error', `sentence does not contain ${target}`)
      if (!filled(s.id) || !filled(s.en)) P('error', 'sentence needs id and en translations')
      if (!(s.speaker in ctx.speakers)) P('error', `unknown speaker ${s.speaker}`)
      if (!SOURCES.includes(s.source)) P('error', `source ${s.source} must be one of ${SOURCES.join('/')}`)
      if (s.source === 'tatoeba') {
        const cmn = typeof s.sourceId === 'number' ? ctx.tatoeba.get(s.sourceId) : undefined
        if (cmn === undefined) P('error', `tatoeba sourceId ${String(s.sourceId)} is not in sentences.json`)
        else if (cmn !== s.hanzi) P('error', `tatoeba ${s.sourceId} text is ${cmn}`)
      }
      if (seenText.has(s.hanzi)) P('warning', `same sentence as ${seenText.get(s.hanzi)}`)
      else seenText.set(s.hanzi, e.wordId)

      const main = analyze(s.hanzi, u.order, ctx)
      for (const i of textProblems('sentence', s.hanzi, s.pinyin, main.outsideWords, main.seg, ctx)) P(i.level, i.message)
      if (s.source === 'buatan' && main.outsideWords.length === 0) P('warning', 'source buatan but no outside word: use source unit')

      let dialog: BuiltEntry['dialog'] = null
      if (e.dialog) {
        const d = e.dialog
        if (d.lines.length < 2 || d.lines.length > 4) P('error', `dialog has ${d.lines.length} lines (2–4)`)
        if (!filled(d.reason.id) || !filled(d.reason.en)) P('error', 'dialog reason needs id and en')
        const hit = d.lines.find((l) => l.hanzi === s.hanzi)
        if (!hit) P('error', 'sentence hanzi is not one of the dialog lines')
        else if (hit.who !== s.speaker) P('warning', `sentence speaker ${s.speaker} but the line is said by ${hit.who}`)
        const lines = d.lines.map((l, n) => {
          const where = `dialog line ${n + 1}`
          if (!(l.who in ctx.speakers)) P('error', `${where}: unknown speaker ${l.who}`)
          if (n > 0 && d.lines[n - 1].who === l.who) P('error', `${where}: same speaker as the line before`)
          if (!filled(l.id) || !filled(l.en)) P('error', `${where}: needs id and en translations`)
          const a = analyze(l.hanzi, u.order, ctx)
          for (const i of textProblems(where, l.hanzi, l.pinyin, a.outsideWords, a.seg, ctx)) P(i.level, i.message)
          return { ...l, outsideWords: a.outsideWords, analysis: a.analysis }
        })
        dialog = { ...d, lines }
      }

      const sc = e.scene
      if (sc.ref !== null && !ctx.sceneRefs.has(sc.ref)) P('error', `scene.ref ${sc.ref} is not in scenes.json`)
      if (!SCENE_FITS.includes(sc.fit)) P('error', `scene.fit ${sc.fit} must be one of ${SCENE_FITS.join('/')}`)
      if ((sc.fit === 'new') !== (sc.ref === null)) P('error', 'scene.fit "new" exactly when scene.ref is null')
      if (!filled(sc.note)) P('warning', 'scene.note is empty')

      const analysis: BuiltEntry['analysis'] = { ...main.analysis }
      if (s.source === 'buatan') analysis.evidence = collectEvidence(main.seg, target, ctx)
      entries.push({ unit: u.id, ...e, sentence: { ...s, outsideWords: main.outsideWords }, dialog, analysis })
    }
    for (const id of u.words) if (!seenWord.has(id)) add('error', u.id, id, `word ${ctx.words.get(id)?.hanzi ?? ''} has no entry`)
  }
  return { file: { version: 1, entries }, problems, present }
}

// ---------------------------------------------------------------- report

const pct = (n: number, d: number) => (d === 0 ? 0 : Math.round((n / d) * 1000) / 10)

export function buildReport(r: BuildResult, ctx: Context) {
  const { entries } = r.file
  const texts = entries.flatMap((e) => [
    { unit: e.unit, wordId: e.wordId, where: 'sentence', hanzi: e.sentence.hanzi, hanziCount: e.analysis.hanziCount },
    ...(e.dialog?.lines ?? []).map((l, n) => ({ unit: e.unit, wordId: e.wordId, where: `dialog line ${n + 1}`, hanzi: l.hanzi, hanziCount: l.analysis.hanziCount })),
  ])
  const outside = new Map<string, number>()
  for (const e of entries) for (const w of uniq([e.sentence.outsideWords, ...(e.dialog?.lines ?? []).map((l) => l.outsideWords)].flat())) outside.set(w, (outside.get(w) ?? 0) + 1)
  const buatan = entries.filter((e) => e.analysis.evidence)
  const inScope = entries.filter((e) => e.analysis.inScope).length
  const errors = r.problems.filter((p) => p.level === 'error').length
  return {
    version: 1,
    totals: {
      units: ctx.units.length,
      draftsPresent: r.present.length,
      draftsMissing: ctx.units.map((u) => u.id).filter((id) => !r.present.includes(id)),
      words: ctx.words.size,
      entries: entries.length,
      dialogs: entries.filter((e) => e.dialog).length,
      inScope,
      inScopePct: pct(inScope, entries.length),
      inScopeTargetPct: IN_SCOPE_TARGET_PCT,
      errors,
      warnings: r.problems.length - errors,
    },
    perUnit: ctx.units.map((u) => {
      const es = entries.filter((e) => e.unit === u.id)
      const n = es.filter((e) => e.analysis.inScope).length
      return {
        unit: u.id,
        draft: r.present.includes(u.id),
        words: u.words.length,
        entries: es.length,
        inScope: n,
        inScopePct: pct(n, es.length),
        dialogs: es.filter((e) => e.dialog).length,
        buatan: es.filter((e) => e.sentence.source === 'buatan').length,
      }
    }),
    sources: Object.fromEntries(SOURCES.map((s) => [s, entries.filter((e) => e.sentence.source === s).length])),
    dialogs: { count: entries.filter((e) => e.dialog).length, words: entries.filter((e) => e.dialog).map((e) => e.hanzi) },
    outsideWords: [...outside].map(([word, count]) => ({ word, count })).sort((a, b) => b.count - a.count || (a.word < b.word ? -1 : a.word > b.word ? 1 : 0)),
    over10: texts.filter((t) => t.hanziCount > TARGET_HANZI && t.hanziCount <= MAX_HANZI),
    over14: texts.filter((t) => t.hanziCount > MAX_HANZI),
    buatan: {
      count: buatan.length,
      allInDictionary: buatan.filter((e) => e.analysis.evidence?.allInDictionary).length,
      withCollocation: buatan.filter((e) => (e.analysis.evidence?.collocationHits ?? 0) > 0).length,
      entries: buatan.map((e) => ({ unit: e.unit, wordId: e.wordId, hanzi: e.hanzi, sentence: e.sentence.hanzi, outsideWords: e.sentence.outsideWords, ...e.analysis.evidence })),
    },
    problems: r.problems,
  }
}

export const formatJson = (x: unknown): string => `${JSON.stringify(x, null, 2)}\n`

/** Both generated files as text, so a rebuild can be compared byte for byte. */
export function buildOutputs(drafts: Record<string, unknown>, ctx: Context) {
  const result = buildWordSentences(drafts, ctx)
  return { result, json: formatJson(result.file), report: formatJson(buildReport(result, ctx)) }
}

// ---------------------------------------------------------------- reviewer export + review gate

/** What the reviewer scores: the sentence, or all dialog lines joined with a newline. */
export const reviewText = (e: Pick<BuiltEntry, 'sentence' | 'dialog'>): string => (e.dialog ? e.dialog.lines.map((l) => l.hanzi).join('\n') : e.sentence.hanzi)

/** Reviewer input without the writer's reasoning (no dialog reason, scene note, source or sourceId). */
export function exportReview(file: WordSentencesFile, ctx: Context) {
  return {
    version: 1,
    entries: file.entries.map((e) => {
      const w = ctx.words.get(e.wordId)
      return {
        wordId: e.wordId,
        text: reviewText(e),
        word: { hanzi: e.hanzi, pinyin: w?.pinyin ?? '', meanings: { id: w?.ind ?? [], en: w?.en ?? [] } },
        sentence: { hanzi: e.sentence.hanzi, pinyin: e.sentence.pinyin, id: e.sentence.id, en: e.sentence.en },
        dialog: e.dialog
          ? e.dialog.lines.map((l) => ({ who: { name: ctx.speakers[l.who]?.name ?? { id: l.who, en: l.who }, gender: ctx.speakers[l.who]?.gender ?? '' }, hanzi: l.hanzi, pinyin: l.pinyin, id: l.id, en: l.en }))
          : null,
        outsideWords: uniq([e.sentence.outsideWords, ...(e.dialog?.lines ?? []).map((l) => l.outsideWords)].flat()),
        evidence: e.analysis.evidence ?? null,
      }
    }),
  }
}

export interface ReviewEntry {
  wordId: string
  text: string
  scores: Record<(typeof SCORE_KEYS)[number], number>
  translationOk: boolean
  pinyinOk: boolean
  comment: string
}
export interface ReviewFile {
  version: 1
  reviewer: string
  entries: ReviewEntry[]
}

/** Every entry needs a review of the identical text with all scores ≥ 4 and translation/pinyin ok. */
export function reviewGate(entries: Pick<BuiltEntry, 'wordId' | 'sentence' | 'dialog'>[], review: ReviewFile | null): string[] {
  if (!review) return ['word-sentences-review.json is missing']
  const errors: string[] = []
  const byWord = new Map<string, ReviewEntry>()
  for (const r of review.entries) {
    if (byWord.has(r.wordId)) errors.push(`review: two reviews for ${r.wordId}`)
    byWord.set(r.wordId, r)
  }
  const ids = new Set(entries.map((e) => e.wordId))
  for (const id of byWord.keys()) if (!ids.has(id)) errors.push(`review: ${id} has no entry in word-sentences.json`)
  for (const e of entries) {
    const r = byWord.get(e.wordId)
    if (!r) {
      errors.push(`review: ${e.wordId} not reviewed`)
      continue
    }
    if (r.text !== reviewText(e)) {
      errors.push(`review: ${e.wordId} was reviewed for another text (re-review needed)`)
      continue
    }
    const low = SCORE_KEYS.filter((k) => !(typeof r.scores?.[k] === 'number' && r.scores[k] >= MIN_SCORE))
    if (low.length > 0) errors.push(`review: ${e.wordId} scores below ${MIN_SCORE}: ${low.map((k) => `${k}=${r.scores?.[k]}`).join(', ')}`)
    if (r.translationOk !== true) errors.push(`review: ${e.wordId} translation not ok`)
    if (r.pinyinOk !== true) errors.push(`review: ${e.wordId} pinyin not ok`)
  }
  return errors
}
