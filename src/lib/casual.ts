// Pure helpers for task 3b (casual expressions + dialogs). No file or network access, so everything can be
// tested offline. Used by scripts/fetch-casual-evidence.ts and scripts/build-casual.ts.
//
// Layers: 1 = AI draft, 2 = external sources (cedict / wiktionary / tatoeba, >= 2 needed, plus flags),
// 3 = independent AI review, 4 = automatic dialog check, 5 = anything failing a layer is dropped.

import { buildLexicon, segment, type Lexicon, type UnitInput, type WordInput } from './sentences.ts'
import { normalizeNumbered, splitSyllables, syllableTone, toNumbered, type Tone } from './pinyin.ts'

export type CasualLabel = 'santai' | 'gaul' | 'kasar'
export const CASUAL_LABELS: CasualLabel[] = ['santai', 'gaul', 'kasar']
export const MIN_PER_UNIT = 3
export const MAX_PER_UNIT = 5
export const MIN_SOURCES = 2
export const MIN_NATURAL = 4
export const MIN_LINES = 4
export const MAX_LINES = 8
export const TATOEBA_EXAMPLES = 3

export interface Bilingual {
  id: string
  en: string
}

export interface CasualCandidate {
  id: string
  unit: string
  hanzi: string
  variants: string[]
  pinyin: string
  label: CasualLabel
  hsk: { hanzi: string; wordIds: string[] }
  meaning: Bilingual
  situation: Bilingual
  note: string
}
export interface CandidatesFile {
  version: number
  items: CasualCandidate[]
}

// ---------- Wiktionary ----------

/** Labels we care about, normalized (en and zh wiktionary spellings map to the same name). */
const LABEL_ALIASES: Record<string, string> = {
  colloquial: 'colloquial',
  informal: 'informal',
  slang: 'slang',
  'internet slang': 'Internet slang',
  neologism: 'neologism',
  vulgar: 'vulgar',
  offensive: 'offensive',
  derogatory: 'derogatory',
  'mainland china': 'Mainland China',
  mainland: 'Mainland China',
  'mainland china mandarin': 'Mainland China',
  taiwan: 'Taiwan',
  'taiwanese mandarin': 'Taiwan',
  cantonese: 'Cantonese',
  'hong kong': 'Hong Kong',
  'hong kong cantonese': 'Cantonese',
  hokkien: 'dialectal',
  dialectal: 'dialectal',
  dialect: 'dialectal',
  regional: 'dialectal',
  'northeastern mandarin': 'dialectal',
  'beijing mandarin': 'Beijing',
  beijing: 'Beijing',
  口语: 'colloquial',
  口語: 'colloquial',
  非正式: 'informal',
  俚语: 'slang',
  俚語: 'slang',
  网络用语: 'Internet slang',
  網絡用語: 'Internet slang',
  網路用語: 'Internet slang',
  粗俗: 'vulgar',
  粗口: 'vulgar',
  中国大陆: 'Mainland China',
  中國大陸: 'Mainland China',
  大陆: 'Mainland China',
  大陸: 'Mainland China',
  台湾: 'Taiwan',
  臺灣: 'Taiwan',
  台灣: 'Taiwan',
  粤语: 'Cantonese',
  粵語: 'Cantonese',
  方言: 'dialectal',
}
/** Labels that make an expression regional (only counts when no sense says Mainland China). */
export const REGIONAL_LABELS = new Set(['Taiwan', 'Cantonese', 'Hong Kong', 'dialectal'])
export const VULGAR_LABELS = new Set(['vulgar', 'offensive'])
/** Connector words inside {{lb}} that are not labels. */
const LABEL_CONNECTORS = new Set(['_', 'and', 'or', ',', ';', 'also', 'of', 'in', 'chiefly', 'especially', 'now', 'often', 'usually'])

export function normalizeLabel(raw: string): string | null {
  const key = raw.trim().toLowerCase()
  if (key === '' || LABEL_CONNECTORS.has(key)) return null
  return LABEL_ALIASES[key] ?? LABEL_ALIASES[raw.trim()] ?? key
}

/**
 * Returns the text of the Chinese language section (level-2 heading ==Chinese== on en.wiktionary,
 * ==汉语== / ==漢語== / ==中文== on zh.wiktionary) or null when the page has none.
 */
export function chineseSection(wikitext: string, lang: 'en' | 'zh'): string | null {
  const names = lang === 'en' ? ['Chinese'] : ['汉语', '漢語', '中文']
  const lines = wikitext.split('\n')
  const isLevel2 = (l: string) => /^==[^=].*[^=]==\s*$/.test(l.trim())
  const heading = (l: string) => l.trim().replace(/^==\s*/, '').replace(/\s*==$/, '')
  const start = lines.findIndex((l) => isLevel2(l) && names.includes(heading(l)))
  if (start === -1) return null
  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    if (isLevel2(lines[i])) {
      end = i
      break
    }
  }
  return lines.slice(start + 1, end).join('\n')
}

/** Labels from {{lb|zh|...}} / {{label|zh|...}} / {{lbl|zh|...}} (also lang code cmn) in one piece of text. */
export function parseLabels(text: string): string[] {
  const out: string[] = []
  for (const m of text.matchAll(/\{\{\s*(?:lb|lbl|label)\s*\|\s*(?:zh|cmn)\s*\|([^{}]*)\}\}/g)) {
    for (const part of m[1].split('|')) {
      if (part.includes('=')) continue
      const label = normalizeLabel(part)
      if (label && !out.includes(label)) out.push(label)
    }
  }
  return out
}

export interface WikitextInfo {
  hasChinese: boolean
  /** Union of all labels in the section, in order of appearance. */
  labels: string[]
  /** Labels of each definition line ("# ..."), in order. */
  senses: string[][]
  /** Target of {{zh-see|...}} (en.wiktionary soft redirect, usually to the traditional form), if any. */
  see: string | null
}

export function parseWikitext(wikitext: string, lang: 'en' | 'zh'): WikitextInfo {
  const section = chineseSection(wikitext, lang)
  if (section === null) return { hasChinese: false, labels: [], senses: [], see: null }
  const senses: string[][] = []
  for (const line of section.split('\n')) {
    if (/^#(?![:*])/.test(line)) senses.push(parseLabels(line))
  }
  const see = /\{\{\s*zh-see\s*\|\s*([^|}]+)/.exec(section)?.[1].trim() ?? null
  return { hasChinese: true, labels: parseLabels(section), senses, see }
}

// ---------- Tatoeba ----------

export interface TatoebaHit {
  id: number
  text: string
}
export interface TatoebaMatch {
  count: number
  examples: TatoebaHit[]
}

/** Incremental matcher: feed every cmn sentence once, get per-candidate counts + the first examples (smallest ids). */
export class TatoebaMatcher {
  private forms: { key: string; forms: string[] }[]
  private result = new Map<string, TatoebaMatch>()
  constructor(items: { key: string; forms: string[] }[]) {
    this.forms = items.map((i) => ({ key: i.key, forms: [...new Set(i.forms.filter((f) => f !== ''))] }))
    for (const i of this.forms) this.result.set(i.key, { count: 0, examples: [] })
  }
  add(id: number, text: string): void {
    for (const item of this.forms) {
      if (!item.forms.some((f) => text.includes(f))) continue
      const r = this.result.get(item.key)!
      r.count++
      r.examples.push({ id, text })
      r.examples.sort((a, b) => a.id - b.id)
      if (r.examples.length > TATOEBA_EXAMPLES) r.examples.length = TATOEBA_EXAMPLES
    }
  }
  get(key: string): TatoebaMatch {
    const r = this.result.get(key) ?? { count: 0, examples: [] }
    return { count: r.count, examples: r.examples.map((e) => ({ ...e })) }
  }
}

// ---------- CC-CEDICT ----------

export interface CedictEntry {
  traditional: string
  simplified: string
  pinyin: string
  english: string[]
}
export interface CedictSense {
  pinyin: string
  english: string[]
}
export interface CedictResult {
  found: boolean
  form: string | null
  entries: CedictSense[]
  /** colloquial / slang / Internet slang / dialectal / Taiwan / Cantonese / vulgar markers found in the senses. */
  markers: string[]
  /** True when every sense is marked Taiwan / Cantonese / dialect (so it is not plain Mainland usage). */
  regionalOnly: boolean
  vulgar: boolean
}

const CEDICT_MARKERS: [RegExp, string][] = [
  [/\((?:coll\.|colloquial)\)/i, 'colloquial'],
  [/\(Internet slang\)/i, 'Internet slang'],
  [/\(slang\)/i, 'slang'],
  [/\(neologism\b/i, 'neologism'],
  [/\(vulgar\)/i, 'vulgar'],
  [/\(Tw\)|\bin Taiwan\b|\(Taiwan\)/, 'Taiwan'],
  [/\(Cantonese\)|\bCantonese equivalent\b|\bloanword from Cantonese\b/, 'Cantonese'],
  [/\(dialect\)|\bdialectal\b/i, 'dialectal'],
]
const CEDICT_REGIONAL = new Set(['Taiwan', 'Cantonese', 'dialectal'])

/** Markers of one sense. "Taiwan pr." is only a pronunciation note and is ignored. */
export function cedictSenseMarkers(sense: string): string[] {
  const text = sense.replace(/Taiwan pr\.\s*\[[^\]]*\]/g, '')
  return CEDICT_MARKERS.filter(([re]) => re.test(text)).map(([, name]) => name)
}

export type CedictIndex = Map<string, CedictEntry[]>
export function indexCedict(entries: Iterable<CedictEntry>): CedictIndex {
  const index: CedictIndex = new Map()
  for (const e of entries) {
    const list = index.get(e.simplified)
    if (list) list.push(e)
    else index.set(e.simplified, [e])
  }
  return index
}

/** Looks up the hanzi first, then each variant; entries whose meaning is only a surname are skipped. */
export function lookupCedict(index: CedictIndex, forms: string[]): CedictResult {
  for (const form of forms) {
    const entries = (index.get(form) ?? []).filter((e) => !e.english.every((s) => /^surname /i.test(s)))
    if (entries.length === 0) continue
    const markers: string[] = []
    let allRegional = true
    for (const e of entries) {
      for (const s of e.english) {
        const m = cedictSenseMarkers(s)
        for (const x of m) if (!markers.includes(x)) markers.push(x)
        if (!m.some((x) => CEDICT_REGIONAL.has(x))) allRegional = false
      }
    }
    return {
      found: true,
      form,
      entries: entries.map((e) => ({ pinyin: e.pinyin, english: [...e.english] })),
      markers,
      regionalOnly: allRegional,
      vulgar: markers.includes('vulgar'),
    }
  }
  return { found: false, form: null, entries: [], markers: [], regionalOnly: false, vulgar: false }
}

// ---------- evidence (layer 2) ----------

export type FetchStatus = 'found' | 'absent' | 'error'
export interface WiktionaryPage {
  site: 'en' | 'zh'
  title: string
  status: FetchStatus
  info?: WikitextInfo
  error?: string
}
export interface WiktionaryEvidence {
  /** found = some page had a Chinese section; absent = all pages answered without one; error = network failure and nothing found. */
  status: FetchStatus
  pages: WiktionaryPage[]
  labels: string[]
  senses: string[][]
}
export interface RawEvidenceItem {
  id: string
  hanzi: string
  variants: string[]
  cedict: CedictResult
  wiktionary: WiktionaryEvidence
  tatoeba: TatoebaMatch
}
export interface RawEvidenceFile {
  version: number
  fetchedAt: string
  tatoebaFile: string
  items: RawEvidenceItem[]
}

/** Combines the fetched pages (en first, zh fallback, plus a followed zh-see page) into one wiktionary source. */
export function combineWiktionary(pages: WiktionaryPage[]): WiktionaryEvidence {
  const found = pages.filter((p) => p.status === 'found' && p.info?.hasChinese)
  const labels: string[] = []
  const senses: string[][] = []
  for (const p of found) {
    for (const l of p.info!.labels) if (!labels.includes(l)) labels.push(l)
    senses.push(...p.info!.senses.map((s) => [...s]))
  }
  const status: FetchStatus = found.length > 0 ? 'found' : pages.some((p) => p.status === 'error') ? 'error' : 'absent'
  return { status, pages, labels, senses }
}

export type Flag = 'regional-only' | 'vulgar'
export type SourceName = 'cedict' | 'wiktionary' | 'tatoeba'
export const SOURCE_NAMES: SourceName[] = ['cedict', 'wiktionary', 'tatoeba']

export interface Layer2Result {
  passed: boolean
  sources: SourceName[]
  flags: { flag: Flag; source: SourceName }[]
  errors: SourceName[]
  reasons: string[]
}

/** Every sense marked regional and none marked Mainland China. */
export function wiktionaryRegionalOnly(w: WiktionaryEvidence): boolean {
  if (w.labels.includes('Mainland China')) return false
  if (w.senses.length === 0) return w.labels.length > 0 && w.labels.every((l) => REGIONAL_LABELS.has(l))
  return w.senses.every((s) => s.some((l) => REGIONAL_LABELS.has(l)))
}

/**
 * Layer 2: needs at least two distinct sources, and no source may say the expression is only
 * Taiwan / Cantonese / dialect (without a Mainland label), or vulgar while our label is not "kasar".
 * A missing evidence entry fails.
 */
export function checkLayer2(ev: RawEvidenceItem | undefined, label: CasualLabel): Layer2Result {
  if (!ev) return { passed: false, sources: [], flags: [], errors: [], reasons: ['no evidence fetched'] }
  const sources: SourceName[] = []
  const errors: SourceName[] = []
  const flags: Layer2Result['flags'] = []
  if (ev.cedict.found) sources.push('cedict')
  if (ev.wiktionary.status === 'found') sources.push('wiktionary')
  else if (ev.wiktionary.status === 'error') errors.push('wiktionary')
  if (ev.tatoeba.count >= 1) sources.push('tatoeba')

  const mainland = ev.wiktionary.labels.includes('Mainland China')
  if (ev.cedict.found && ev.cedict.regionalOnly && !mainland) flags.push({ flag: 'regional-only', source: 'cedict' })
  if (ev.wiktionary.status === 'found' && wiktionaryRegionalOnly(ev.wiktionary)) flags.push({ flag: 'regional-only', source: 'wiktionary' })
  if (label !== 'kasar') {
    if (ev.cedict.vulgar) flags.push({ flag: 'vulgar', source: 'cedict' })
    if (ev.wiktionary.labels.some((l) => VULGAR_LABELS.has(l))) flags.push({ flag: 'vulgar', source: 'wiktionary' })
  }

  const reasons: string[] = []
  if (sources.length < MIN_SOURCES) reasons.push(`only ${sources.length} source(s): ${sources.join(', ') || 'none'}`)
  for (const f of flags) reasons.push(`flag ${f.flag} (${f.source})`)
  if (errors.length > 0 && sources.length < MIN_SOURCES) reasons.push(`network error: ${errors.join(', ')}`)
  return { passed: reasons.length === 0, sources, flags, errors, reasons }
}

// ---------- review (layer 3) ----------

export interface Review {
  id: string
  verdict: 'pass' | 'fail'
  natural: number
  labelOk: boolean
  comment: string
}
export interface ReviewFile {
  version: number
  reviews: Review[]
}
export interface Layer3Result {
  passed: boolean
  reasons: string[]
}

export function checkLayer3(review: Review | undefined): Layer3Result {
  if (!review) return { passed: false, reasons: ['no review'] }
  const reasons: string[] = []
  if (review.verdict !== 'pass') reasons.push(`verdict ${review.verdict}`)
  if (!(review.natural >= MIN_NATURAL)) reasons.push(`natural ${review.natural} < ${MIN_NATURAL}`)
  if (review.labelOk !== true) reasons.push('label not ok')
  return { passed: reasons.length === 0, reasons }
}

// ---------- candidates ----------

export interface CandidateResult {
  candidate: CasualCandidate
  layer2: Layer2Result
  layer3: Layer3Result
  passed: boolean
  failedAt: 2 | 3 | null
}

export function evaluateCandidates(
  candidates: CasualCandidate[],
  evidence: RawEvidenceFile | null,
  reviews: ReviewFile | null,
): CandidateResult[] {
  const evById = new Map((evidence?.items ?? []).map((e) => [e.id, e]))
  const reviewById = new Map((reviews?.reviews ?? []).map((r) => [r.id, r]))
  return candidates.map((c) => {
    let ev = evById.get(c.id)
    // Evidence fetched for an older text of the candidate does not count.
    if (ev && (ev.hanzi !== c.hanzi || JSON.stringify(ev.variants) !== JSON.stringify(c.variants))) ev = undefined
    const layer2 = checkLayer2(ev, c.label)
    const layer3 = checkLayer3(reviewById.get(c.id))
    const failedAt = !layer2.passed ? 2 : !layer3.passed ? 3 : null
    return { candidate: c, layer2, layer3, passed: failedAt === null, failedAt }
  })
}

/** Passed candidates per unit, in draft order, at most MAX_PER_UNIT. */
export function selectPerUnit(results: CandidateResult[], unitIds: string[]): Map<string, CasualCandidate[]> {
  const out = new Map<string, CasualCandidate[]>(unitIds.map((u) => [u, []]))
  for (const r of results) {
    if (!r.passed) continue
    const list = out.get(r.candidate.unit)
    if (list && list.length < MAX_PER_UNIT) list.push(r.candidate)
  }
  return out
}

/** Errors in hand-written candidates (wrong unit, unknown word id, bad pinyin...). Empty when fine. */
export function validateCandidates(candidates: CasualCandidate[], words: WordInput[], units: UnitInput[]): string[] {
  const errors: string[] = []
  const wordIds = new Set(words.map((w) => w.id))
  const forms = new Set(words.flatMap((w) => [w.hanzi, ...w.variants]))
  const unitIds = new Set(units.map((u) => u.id))
  const seen = new Set<string>()
  const seenHanzi = new Set<string>()
  for (const c of candidates) {
    const where = c.id
    if (seen.has(c.id)) errors.push(`${where}: duplicate id`)
    seen.add(c.id)
    if (seenHanzi.has(c.hanzi)) errors.push(`${where}: duplicate hanzi ${c.hanzi}`)
    seenHanzi.add(c.hanzi)
    if (!unitIds.has(c.unit)) errors.push(`${where}: unknown unit ${c.unit}`)
    if (!CASUAL_LABELS.includes(c.label)) errors.push(`${where}: bad label ${c.label}`)
    if (!/^\p{Script=Han}+$/u.test(c.hanzi)) errors.push(`${where}: hanzi must be Han characters only`)
    if (forms.has(c.hanzi)) errors.push(`${where}: ${c.hanzi} is already an HSK 1 word`)
    for (const v of c.variants) if (!/^\p{Script=Han}+$/u.test(v)) errors.push(`${where}: bad variant ${v}`)
    if (splitSyllables(c.pinyin).length !== [...c.hanzi].length) errors.push(`${where}: pinyin syllables do not match hanzi length`)
    if (c.hsk.wordIds.length === 0) errors.push(`${where}: no hsk.wordIds`)
    for (const id of c.hsk.wordIds) if (!wordIds.has(id)) errors.push(`${where}: unknown word id ${id}`)
    for (const k of ['id', 'en'] as const) {
      if (!c.meaning?.[k]) errors.push(`${where}: meaning.${k} missing`)
      if (!c.situation?.[k]) errors.push(`${where}: situation.${k} missing`)
    }
  }
  return errors
}

export function pinyinInfo(toneMarked: string): { pinyinNumbered: string; tones: Tone[] } {
  const syl = splitSyllables(toneMarked)
  return { pinyinNumbered: normalizeNumbered(syl.map(toNumbered).join(' ')), tones: syl.map(syllableTone) }
}

// ---------- dialogs (layer 4) ----------

export interface Speaker {
  name: Bilingual
  gender: 'female' | 'male'
}
export interface DialogLine {
  speaker: string
  gender: 'female' | 'male'
  cmn: string
  en: string
  id: string
}
export interface Dialog {
  id: string
  unit: string
  title: Bilingual
  situation: Bilingual
  lines: DialogLine[]
}
export interface DialogsFile {
  version: number
  speakers: Record<string, Speaker>
  dialogs: Dialog[]
}

export interface LineToken {
  text: string
  pinyin?: string
  wordId?: string
  casualId?: string
}
export interface DialogCheck {
  dialog: Dialog
  passed: boolean
  reasons: string[]
  /** HSK 1 word ids from units after the dialog's unit (allowed, target <= 2). */
  laterUnitWords: string[]
  /** Candidate ids used in the dialog. */
  casualUsed: string[]
  lines: { tokens: LineToken[]; pinyin: string }[]
}

export interface DialogContext {
  lex: Lexicon
  words: Map<string, WordInput & { pinyin?: string }>
  unitOrder: Map<string, number>
  candidates: Map<string, CasualCandidate>
  passed: Set<string>
}

/**
 * Lexicon of HSK 1 words plus ALL candidates, so a failed candidate is recognised and rejected instead of being
 * silently split into HSK words. Candidate ids are added to their unit's word list. No CC-CEDICT dictionary here:
 * with greedy matching it only causes false rejections (在前 would swallow the start of 前头).
 */
export function buildDialogContext(
  words: (WordInput & { pinyin?: string })[],
  units: UnitInput[],
  candidates: CasualCandidate[],
  passed: Iterable<string>,
): DialogContext {
  const extra: WordInput[] = candidates.map((c) => ({ id: c.id, hanzi: c.hanzi, variants: c.variants, traditional: c.hanzi }))
  const unitsWithCasual = units.map((u) => ({ ...u, words: [...u.words, ...candidates.filter((c) => c.unit === u.id).map((c) => c.id)] }))
  const lex = buildLexicon([...words, ...extra], unitsWithCasual)
  return {
    lex,
    words: new Map(words.map((w) => [w.id, w])),
    unitOrder: new Map(units.map((u) => [u.id, u.order])),
    candidates: new Map(candidates.map((c) => [c.id, c])),
    passed: new Set(passed),
  }
}

/**
 * Pinyin of a written form of a word. For a variant (哥 of 哥哥, 哥们 of 哥们儿, 有一些 of 有些) each character takes
 * the syllable it has in the main form, or the pinyin of the one-character HSK 1 word; undefined if neither exists.
 */
export function formPinyin(form: string, hanzi: string, pinyin: string, ctx: DialogContext, joiner: string): string | undefined {
  if (form === hanzi) return pinyin
  const chars = [...hanzi]
  const syllables = splitSyllables(pinyin)
  if (syllables.length !== chars.length) return undefined
  const out: string[] = []
  for (const ch of form) {
    const i = chars.indexOf(ch)
    if (i !== -1) {
      out.push(syllables[i])
      continue
    }
    const single = (ctx.lex.forms.get(ch) ?? []).map((id) => ctx.words.get(id)).find((w) => w?.pinyin && w.hanzi === ch)
    if (!single?.pinyin) return undefined
    out.push(single.pinyin)
  }
  return out.join(joiner)
}

/** For a form shared by several HSK words (还, 地, 干) the reading from the earliest unit is used. */
function pickWord(ids: string[], ctx: DialogContext): string {
  return [...ids].sort((a, b) => (ctx.lex.wordUnit.get(a)!.order - ctx.lex.wordUnit.get(b)!.order) || (a < b ? -1 : 1))[0]
}

export function checkDialog(dialog: Dialog, speakers: Record<string, Speaker>, ctx: DialogContext): DialogCheck {
  const reasons: string[] = []
  const laterUnitWords: string[] = []
  const casualUsed: string[] = []
  const order = ctx.unitOrder.get(dialog.unit)
  if (order === undefined) reasons.push(`unknown unit ${dialog.unit}`)
  if (dialog.lines.length < MIN_LINES || dialog.lines.length > MAX_LINES) reasons.push(`${dialog.lines.length} lines (need ${MIN_LINES}-${MAX_LINES})`)
  const lines = dialog.lines.map((line, n) => {
    const at = `line ${n + 1}`
    const sp = speakers[line.speaker]
    if (!sp) reasons.push(`${at}: unknown speaker ${line.speaker}`)
    else if (sp.gender !== line.gender) reasons.push(`${at}: gender ${line.gender} does not match speaker ${line.speaker}`)
    if (!line.en || !line.id) reasons.push(`${at}: missing translation`)
    const tokens: LineToken[] = []
    for (const t of segment(line.cmn.trim(), ctx.lex)) {
      if (t.kind === 'foreign') {
        reasons.push(`${at}: not HSK 1 "${t.text}"`)
        tokens.push({ text: t.text })
        continue
      }
      if (t.kind !== 'word') {
        tokens.push({ text: t.text })
        continue
      }
      const casualId = t.ids.find((id) => ctx.candidates.has(id))
      if (casualId) {
        const c = ctx.candidates.get(casualId)!
        if (!ctx.passed.has(casualId)) reasons.push(`${at}: casual "${t.text}" (${casualId}) did not pass`)
        else if (order !== undefined && ctx.unitOrder.get(c.unit)! > order) reasons.push(`${at}: casual "${t.text}" (${casualId}) is from later unit ${c.unit}`)
        if (!casualUsed.includes(casualId)) casualUsed.push(casualId)
        const py = formPinyin(t.text, c.hanzi, c.pinyin, ctx, ' ')
        tokens.push({ text: t.text, ...(py ? { pinyin: py } : {}), casualId })
        continue
      }
      const wordId = pickWord(t.ids, ctx)
      const w = ctx.words.get(wordId)
      const unit = ctx.lex.wordUnit.get(wordId)!
      if (order !== undefined && unit.order > order && !laterUnitWords.includes(wordId)) laterUnitWords.push(wordId)
      const py = w?.pinyin ? formPinyin(t.text, w.hanzi, w.pinyin, ctx, '') : undefined
      tokens.push({ text: t.text, ...(py ? { pinyin: py } : {}), wordId })
    }
    return { tokens, pinyin: linePinyin(tokens) }
  })
  return { dialog, passed: reasons.length === 0, reasons, laterUnitWords, casualUsed, lines }
}

/** Token pinyin joined by spaces; punctuation sticks to the previous syllable, digits stay as digits. */
export function linePinyin(tokens: LineToken[]): string {
  let out = ''
  for (const t of tokens) {
    const piece = t.pinyin ?? t.text
    if (t.pinyin === undefined && !/^[0-9]+$/.test(t.text)) out += piece
    else out += (out === '' || /[\s“‘（《]$/.test(out) ? '' : ' ') + piece
  }
  return out.trim()
}

// ---------- outputs ----------

export interface CasualBuildInput {
  words: (WordInput & { pinyin?: string })[]
  units: UnitInput[]
  candidates: CandidatesFile
  dialogs: DialogsFile | null
  evidence: RawEvidenceFile | null
  reviews: ReviewFile | null
}

export interface CasualBuildOutput {
  'casual.json': string
  'casual-evidence.json': string
  'dialogs.json': string
  'casual-report.json': string
}

/** Stable JSON: two-space indent, trailing newline (keys keep the insertion order used below). */
export const formatJson = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`

export function buildCasual(input: CasualBuildInput): CasualBuildOutput {
  const errors = validateCandidates(input.candidates.items, input.words, input.units)
  if (errors.length > 0) throw new Error(`invalid casual-candidates.json:\n${errors.join('\n')}`)
  const unitIds = input.units.map((u) => u.id)
  const results = evaluateCandidates(input.candidates.items, input.evidence, input.reviews)
  const selected = selectPerUnit(results, unitIds)

  const casualItems = unitIds.flatMap((u) =>
    selected.get(u)!.map((c) => {
      const r = results.find((x) => x.candidate.id === c.id)!
      return {
        id: c.id,
        unit: c.unit,
        hanzi: c.hanzi,
        variants: c.variants,
        pinyin: c.pinyin,
        ...pinyinInfo(c.pinyin),
        label: c.label,
        hsk: c.hsk,
        meaning: c.meaning,
        situation: c.situation,
        evidence: r.layer2.sources,
        machine: true,
      }
    }),
  )

  const evById = new Map((input.evidence?.items ?? []).map((e) => [e.id, e]))
  const reviewById = new Map((input.reviews?.reviews ?? []).map((r) => [r.id, r]))
  const evidenceItems = results.map((r) => {
    const ev = evById.get(r.candidate.id)
    const rv = reviewById.get(r.candidate.id)
    return {
      id: r.candidate.id,
      unit: r.candidate.unit,
      hanzi: r.candidate.hanzi,
      label: r.candidate.label,
      sources: {
        cedict: ev ? ev.cedict : null,
        wiktionary: ev ? { status: ev.wiktionary.status, labels: ev.wiktionary.labels, senses: ev.wiktionary.senses, pages: ev.wiktionary.pages.map((p) => ({ site: p.site, title: p.title, status: p.status, ...(p.error ? { error: p.error } : {}) })) } : null,
        tatoeba: ev ? ev.tatoeba : null,
      },
      counted: r.layer2.sources,
      flags: r.layer2.flags,
      review: rv ? { verdict: rv.verdict, natural: rv.natural, labelOk: rv.labelOk, comment: rv.comment } : null,
      passed: r.passed,
      failedAt: r.failedAt,
      reasons: [...r.layer2.reasons, ...r.layer3.reasons],
    }
  })

  const passedIds = results.filter((r) => r.passed).map((r) => r.candidate.id)
  const dialogsIn = input.dialogs ?? { version: 1, speakers: {}, dialogs: [] }
  const ctx = buildDialogContext(input.words, input.units, input.candidates.items, passedIds)
  const checks = dialogsIn.dialogs.map((d) => checkDialog(d, dialogsIn.speakers, ctx))
  const dialogsOut = {
    version: 1,
    speakers: dialogsIn.speakers,
    dialogs: checks
      .filter((c) => c.passed)
      .map((c) => ({
        id: c.dialog.id,
        unit: c.dialog.unit,
        title: c.dialog.title,
        situation: c.dialog.situation,
        machine: true,
        lines: c.dialog.lines.map((l, i) => ({
          speaker: l.speaker,
          gender: l.gender,
          cmn: l.cmn,
          pinyin: c.lines[i].pinyin,
          tokens: c.lines[i].tokens,
          en: l.en,
          id: l.id,
          machine: true,
        })),
      })),
  }

  const perUnit = Object.fromEntries(
    unitIds.map((u) => {
      const inUnit = results.filter((r) => r.candidate.unit === u)
      return [u, { candidates: inUnit.length, passed: inUnit.filter((r) => r.passed).length, selected: selected.get(u)!.length }]
    }),
  )
  const report = {
    evidenceFetchedAt: input.evidence?.fetchedAt ?? null,
    reviewPresent: input.reviews !== null,
    totals: {
      candidates: results.length,
      passed: passedIds.length,
      selected: casualItems.length,
      failedLayer2: results.filter((r) => r.failedAt === 2).length,
      failedLayer3: results.filter((r) => r.failedAt === 3).length,
      dialogs: checks.length,
      dialogsPassed: checks.filter((c) => c.passed).length,
    },
    perUnit,
    unitsBelowThree: unitIds.filter((u) => selected.get(u)!.length < MIN_PER_UNIT).map((u) => ({ unit: u, count: selected.get(u)!.length })),
    unitsWithoutDialog: unitIds.filter((u) => !checks.some((c) => c.passed && c.dialog.unit === u)),
    failedDialogs: checks.filter((c) => !c.passed).map((c) => ({ id: c.dialog.id, unit: c.dialog.unit, reasons: c.reasons })),
    dialogs: checks.map((c) => ({ id: c.dialog.id, passed: c.passed, casualUsed: c.casualUsed, laterUnitWords: c.laterUnitWords })),
  }

  return {
    'casual.json': formatJson({ version: 1, items: casualItems }),
    'casual-evidence.json': formatJson({ version: 1, evidenceFetchedAt: input.evidence?.fetchedAt ?? null, items: evidenceItems }),
    'dialogs.json': formatJson(dialogsOut),
    'casual-report.json': formatJson(report),
  }
}
