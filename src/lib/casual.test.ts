import { describe, expect, it } from 'vitest'
import unitsFile from '../../data/hsk1/units.json'
import words from '../../data/hsk1/words.json'
import candidatesFile from '../../data/hsk1/casual-candidates.json'
import {
  buildCasual,
  buildDialogContext,
  checkDialog,
  checkLayer2,
  checkLayer3,
  chineseSection,
  combineWiktionary,
  evaluateCandidates,
  indexCedict,
  linePinyin,
  lookupCedict,
  MAX_PER_UNIT,
  parseLabels,
  parseWikitext,
  selectPerUnit,
  TatoebaMatcher,
  validateCandidates,
  type CandidatesFile,
  type CasualCandidate,
  type CedictEntry,
  type Dialog,
  type DialogsFile,
  type RawEvidenceFile,
  type RawEvidenceItem,
  type ReviewFile,
  type Speaker,
  type WiktionaryPage,
} from './casual.ts'
import type { UnitInput, WordInput } from './sentences.ts'

// ---------- fixtures ----------
const smallWords: (WordInput & { pinyin: string })[] = [
  { id: 'W1', hanzi: '你', variants: [], traditional: '你', pinyin: 'nǐ' },
  { id: 'W2', hanzi: '好', variants: [], traditional: '好', pinyin: 'hǎo' },
  { id: 'W3', hanzi: '谢谢', variants: [], traditional: '謝謝', pinyin: 'xièxie' },
  { id: 'W4', hanzi: '再见', variants: [], traditional: '再見', pinyin: 'zàijiàn' },
  { id: 'W5', hanzi: '哥哥', variants: ['哥'], traditional: '哥哥', pinyin: 'gēge' },
  { id: 'W6', hanzi: '吃', variants: [], traditional: '吃', pinyin: 'chī' },
  { id: 'W7', hanzi: '没', variants: [], traditional: '沒', pinyin: 'méi' },
  { id: 'W8', hanzi: '事', variants: [], traditional: '事', pinyin: 'shì' },
]
const smallUnits: UnitInput[] = [
  { id: 'u1', order: 1, words: ['W1', 'W2', 'W3', 'W4', 'W7', 'W8'] },
  { id: 'u2', order: 2, words: ['W5', 'W6'] },
]
const cand = (id: string, unit: string, hanzi: string, pinyin: string, extra: Partial<CasualCandidate> = {}): CasualCandidate => ({
  id,
  unit,
  hanzi,
  variants: [],
  pinyin,
  label: 'santai',
  hsk: { hanzi: '谢谢', wordIds: ['W3'] },
  meaning: { id: 'arti', en: 'meaning' },
  situation: { id: 'situasi', en: 'situation' },
  note: 'n',
  ...extra,
})
const smallCandidates: CasualCandidate[] = [
  cand('c1', 'u1', '拜拜', 'bái bái'),
  cand('c2', 'u1', '多谢', 'duō xiè'),
  cand('c3', 'u2', '吃货', 'chī huò'),
  cand('c4', 'u1', '没事', 'méi shì'),
]

const page = (site: 'en' | 'zh', title: string, wikitext: string | null, error?: string): WiktionaryPage => {
  if (error) return { site, title, status: 'error', error }
  if (wikitext === null) return { site, title, status: 'absent' }
  const info = parseWikitext(wikitext, site)
  return { site, title, status: info.hasChinese ? 'found' : 'absent', info }
}
const noCedict = { found: false, form: null, entries: [], markers: [], regionalOnly: false, vulgar: false }
const evidence = (id: string, hanzi: string, opts: { cedict?: boolean; wiki?: WiktionaryPage[]; tatoeba?: number; regional?: boolean; vulgar?: boolean } = {}): RawEvidenceItem => ({
  id,
  hanzi,
  variants: [],
  cedict: opts.cedict
    ? { found: true, form: hanzi, entries: [{ pinyin: 'x', english: ['x'] }], markers: [], regionalOnly: opts.regional ?? false, vulgar: opts.vulgar ?? false }
    : noCedict,
  wiktionary: combineWiktionary(opts.wiki ?? []),
  tatoeba: { count: opts.tatoeba ?? 0, examples: [] },
})

// ---------- wiktionary ----------
const EN_PAGE = `==Chinese==
===Etymology===
From English.
===Pronunciation===
{{zh-pron|m=bái bái}}
===Interjection===
{{head|zh|interjection}}
# {{lb|zh|colloquial|Mainland China}} [[bye-bye]]
#: {{zh-x|拜拜！|Bye!}}
# {{label|zh|Internet slang|_|of|online}} [[goodbye]]

==Japanese==
# {{lb|ja|vulgar}} something
`
const ZH_PAGE = `==汉语==
===词源===
===感叹词===
# {{lb|zh|口語}} 再見
==日语==
# {{lb|ja|粗俗}} x
`

describe('wiktionary parsing', () => {
  it('finds the Chinese section on en and zh wiktionary, stopping at the next language', () => {
    expect(chineseSection(EN_PAGE, 'en')).toContain('bye-bye')
    expect(chineseSection(EN_PAGE, 'en')).not.toContain('Japanese')
    expect(chineseSection(ZH_PAGE, 'zh')).toContain('再見')
    expect(chineseSection(ZH_PAGE, 'zh')).not.toContain('粗俗')
    expect(chineseSection('==Japanese==\n# x', 'en')).toBeNull()
    expect(chineseSection('==Chinese==\nx', 'zh')).toBeNull()
  })
  it('does not take a level-3 heading as a language section', () => {
    expect(chineseSection('==English==\n===Chinese===\n# x', 'en')).toBeNull()
  })
  it('parses lb / label templates for zh only, skipping connectors and named args', () => {
    expect(parseLabels('# {{lb|zh|colloquial|Mainland China}} x {{label|zh|Internet slang|_|of|online|sort=x}}')).toEqual([
      'colloquial',
      'Mainland China',
      'Internet slang',
      'online',
    ])
    expect(parseLabels('# {{lb|ja|vulgar}} {{lb|en|slang}}')).toEqual([])
    expect(parseLabels('# {{lb|cmn|Taiwanese Mandarin}}')).toEqual(['Taiwan'])
  })
  it('maps zh.wiktionary labels to the same names', () => {
    expect(parseLabels('{{lb|zh|口语}} {{lb|zh|臺灣}} {{lb|zh|粵語}} {{lb|zh|粗俗}} {{lb|zh|中国大陆}} {{lb|zh|网络用语}}')).toEqual([
      'colloquial',
      'Taiwan',
      'Cantonese',
      'vulgar',
      'Mainland China',
      'Internet slang',
    ])
  })
  it('collects labels per sense and the zh-see target', () => {
    const info = parseWikitext(EN_PAGE, 'en')
    expect(info.hasChinese).toBe(true)
    expect(info.senses).toEqual([['colloquial', 'Mainland China'], ['Internet slang', 'online']])
    expect(info.labels).not.toContain('vulgar')
    expect(parseWikitext('==Chinese==\n{{zh-see|謝謝}}', 'en')).toEqual({ hasChinese: true, labels: [], senses: [], see: '謝謝' })
    expect(parseWikitext(ZH_PAGE, 'zh').labels).toEqual(['colloquial'])
  })
  it('combines pages: found wins, otherwise error beats absent', () => {
    expect(combineWiktionary([page('en', 'x', null), page('zh', 'x', ZH_PAGE)]).status).toBe('found')
    expect(combineWiktionary([page('en', 'x', null), page('zh', 'x', null)]).status).toBe('absent')
    expect(combineWiktionary([page('en', 'x', null, 'timeout'), page('zh', 'x', null)]).status).toBe('error')
    expect(combineWiktionary([page('en', 'x', '==Japanese==\n# y')]).status).toBe('absent')
  })
})

// ---------- tatoeba ----------
describe('TatoebaMatcher', () => {
  it('counts sentences containing the hanzi or a variant and keeps the 3 smallest ids', () => {
    const m = new TatoebaMatcher([
      { key: 'a', forms: ['哥们儿', '哥们'] },
      { key: 'b', forms: ['拜拜'] },
    ])
    m.add(9, '我哥们儿来了。')
    m.add(3, '他是我哥们。')
    m.add(7, '哥们，走吧！')
    m.add(1, '哥们儿好！')
    m.add(5, '你好。')
    expect(m.get('a')).toEqual({
      count: 4,
      examples: [
        { id: 1, text: '哥们儿好！' },
        { id: 3, text: '他是我哥们。' },
        { id: 7, text: '哥们，走吧！' },
      ],
    })
    expect(m.get('b')).toEqual({ count: 0, examples: [] })
    expect(m.get('missing')).toEqual({ count: 0, examples: [] })
  })
  it('counts a sentence once even if several forms match', () => {
    const m = new TatoebaMatcher([{ key: 'a', forms: ['哥们儿', '哥们'] }])
    m.add(1, '哥们儿')
    expect(m.get('a').count).toBe(1)
  })
})

// ---------- cedict ----------
const cedictEntries: CedictEntry[] = [
  { traditional: '拜拜', simplified: '拜拜', pinyin: 'bai2 bai2', english: ['(loanword) bye-bye; also pr. [bai1 bai1] etc', '(coll.) to part ways'] },
  { traditional: '咩', simplified: '咩', pinyin: 'mie1', english: ['(Cantonese) what?'] },
  { traditional: '機車', simplified: '机车', pinyin: 'ji1 che1', english: ['locomotive', '(Tw) annoying'] },
  { traditional: '某', simplified: '某', pinyin: 'mou3', english: ['(vulgar) something'] },
  { traditional: '牛', simplified: '牛', pinyin: 'Niu2', english: ['surname Niu'] },
  { traditional: '琢磨', simplified: '琢磨', pinyin: 'zuo2 mo5', english: ['to ponder; Taiwan pr. [zhuo2 mo2]'] },
  { traditional: '哥們', simplified: '哥们', pinyin: 'ge1 men5', english: ['dude (colloquial)'] },
]
const cedict = indexCedict(cedictEntries)

describe('CC-CEDICT lookup', () => {
  it('finds the simplified headword and reports markers', () => {
    const r = lookupCedict(cedict, ['拜拜'])
    expect(r.found).toBe(true)
    expect(r.form).toBe('拜拜')
    expect(r.markers).toEqual(['colloquial'])
    expect(r.regionalOnly).toBe(false)
  })
  it('falls back to a variant', () => {
    expect(lookupCedict(cedict, ['哥们儿', '哥们']).form).toBe('哥们')
  })
  it('flags regional-only entries, but not when another sense is unmarked', () => {
    expect(lookupCedict(cedict, ['咩']).regionalOnly).toBe(true)
    expect(lookupCedict(cedict, ['机车']).regionalOnly).toBe(false)
    expect(lookupCedict(cedict, ['机车']).markers).toEqual(['Taiwan'])
  })
  it('ignores "Taiwan pr." pronunciation notes and surname-only entries', () => {
    expect(lookupCedict(cedict, ['琢磨']).markers).toEqual([])
    expect(lookupCedict(cedict, ['牛']).found).toBe(false)
  })
  it('flags vulgar senses and reports missing entries', () => {
    expect(lookupCedict(cedict, ['某']).vulgar).toBe(true)
    expect(lookupCedict(cedict, ['谢啦'])).toEqual(noCedict)
  })
})

// ---------- layer 2 / layer 3 ----------
describe('layer 2 rule', () => {
  it('needs at least two distinct sources', () => {
    expect(checkLayer2(evidence('c1', '拜拜', { cedict: true, tatoeba: 3 }), 'santai')).toMatchObject({ passed: true, sources: ['cedict', 'tatoeba'] })
    expect(checkLayer2(evidence('c1', '拜拜', { wiki: [page('en', '拜拜', EN_PAGE)], tatoeba: 1 }), 'santai').passed).toBe(true)
    expect(checkLayer2(evidence('c1', '拜拜', { cedict: true }), 'santai')).toMatchObject({ passed: false, sources: ['cedict'] })
    expect(checkLayer2(undefined, 'santai')).toMatchObject({ passed: false, reasons: ['no evidence fetched'] })
  })
  it('records a network error and does not count it as a source', () => {
    const r = checkLayer2(evidence('c1', '拜拜', { cedict: true, wiki: [page('en', '拜拜', null, 'HTTP 503')] }), 'santai')
    expect(r.passed).toBe(false)
    expect(r.errors).toEqual(['wiktionary'])
    expect(r.reasons.some((x) => x.includes('network error'))).toBe(true)
  })
  it('fails Taiwan-only wiktionary entries even with enough sources', () => {
    const tw = page('en', 'x', '==Chinese==\n# {{lb|zh|Taiwan}} x\n# {{lb|zh|Taiwan|slang}} y')
    const r = checkLayer2(evidence('c1', 'x', { cedict: true, wiki: [tw], tatoeba: 2 }), 'santai')
    expect(r.passed).toBe(false)
    expect(r.flags).toEqual([{ flag: 'regional-only', source: 'wiktionary' }])
  })
  it('accepts a regional label when a sense is also Mainland or unmarked', () => {
    const both = page('en', 'x', '==Chinese==\n# {{lb|zh|Taiwan}} x\n# {{lb|zh|Mainland China}} y')
    expect(checkLayer2(evidence('c1', 'x', { wiki: [both], tatoeba: 2 }), 'santai').passed).toBe(true)
    const mixed = page('en', 'x', '==Chinese==\n# {{lb|zh|Cantonese}} x\n# plain sense')
    expect(checkLayer2(evidence('c1', 'x', { wiki: [mixed], tatoeba: 2 }), 'santai').passed).toBe(true)
  })
  it('fails a CEDICT regional-only entry unless wiktionary says Mainland China', () => {
    expect(checkLayer2(evidence('c1', 'x', { cedict: true, regional: true, tatoeba: 2 }), 'santai').flags).toEqual([{ flag: 'regional-only', source: 'cedict' }])
    const ml = page('en', 'x', '==Chinese==\n# {{lb|zh|Mainland China|colloquial}} x')
    expect(checkLayer2(evidence('c1', 'x', { cedict: true, regional: true, wiki: [ml] }), 'santai').passed).toBe(true)
  })
  it('fails vulgar labels unless our label is kasar', () => {
    const vulgar = page('en', 'x', '==Chinese==\n# {{lb|zh|vulgar}} x')
    expect(checkLayer2(evidence('c1', 'x', { wiki: [vulgar], tatoeba: 2 }), 'gaul').flags).toEqual([{ flag: 'vulgar', source: 'wiktionary' }])
    expect(checkLayer2(evidence('c1', 'x', { cedict: true, vulgar: true, tatoeba: 2 }), 'santai').passed).toBe(false)
    expect(checkLayer2(evidence('c1', 'x', { wiki: [vulgar], tatoeba: 2 }), 'kasar').passed).toBe(true)
  })
})

describe('layer 3 rule', () => {
  const review = { id: 'c1', verdict: 'pass' as const, natural: 4, labelOk: true, comment: '' }
  it('passes only with verdict pass, natural >= 4 and labelOk', () => {
    expect(checkLayer3(review).passed).toBe(true)
    expect(checkLayer3({ ...review, natural: 3 }).passed).toBe(false)
    expect(checkLayer3({ ...review, verdict: 'fail' }).passed).toBe(false)
    expect(checkLayer3({ ...review, labelOk: false }).passed).toBe(false)
    expect(checkLayer3(undefined)).toEqual({ passed: false, reasons: ['no review'] })
  })
})

// ---------- candidates ----------
const fullEvidence = (items: CasualCandidate[]): RawEvidenceFile => ({
  version: 1,
  fetchedAt: '2026-01-01',
  tatoebaFile: 'cmn_sentences.tsv',
  items: items.map((c) => evidence(c.id, c.hanzi, { cedict: true, tatoeba: 1 })),
})
const allPass = (items: CasualCandidate[]): ReviewFile => ({
  version: 1,
  reviews: items.map((c) => ({ id: c.id, verdict: 'pass', natural: 5, labelOk: true, comment: '' })),
})

describe('evaluateCandidates / selectPerUnit', () => {
  it('fails layer 2 without evidence and layer 3 without review', () => {
    expect(evaluateCandidates(smallCandidates, null, null).map((r) => r.failedAt)).toEqual([2, 2, 2, 2])
    expect(evaluateCandidates(smallCandidates, fullEvidence(smallCandidates), null).map((r) => r.failedAt)).toEqual([3, 3, 3, 3])
    expect(evaluateCandidates(smallCandidates, fullEvidence(smallCandidates), allPass(smallCandidates)).every((r) => r.passed)).toBe(true)
  })
  it('ignores evidence fetched for an older hanzi', () => {
    const ev = fullEvidence(smallCandidates)
    ev.items[0] = { ...ev.items[0], hanzi: '白白' }
    expect(evaluateCandidates(smallCandidates, ev, allPass(smallCandidates))[0].failedAt).toBe(2)
  })
  it('keeps passed candidates in draft order, at most 5 per unit', () => {
    const many = Array.from({ length: 7 }, (_, i) => cand(`m${i}`, 'u1', `拜${'拜'.repeat(i + 1)}`, 'bái '.repeat(i + 2).trim()))
    const results = evaluateCandidates(many, fullEvidence(many), allPass(many))
    results[1].passed = false
    const sel = selectPerUnit(results, ['u1', 'u2'])
    expect(sel.get('u1')!.map((c) => c.id)).toEqual(['m0', 'm2', 'm3', 'm4', 'm5'])
    expect(sel.get('u1')!.length).toBe(MAX_PER_UNIT)
    expect(sel.get('u2')).toEqual([])
  })
  it('validates hand-written candidates', () => {
    expect(validateCandidates(smallCandidates, smallWords, smallUnits)).toEqual([])
    const bad = [
      cand('x1', 'u9', '谢谢', 'xiè xie'),
      cand('x2', 'u1', '谢啦', 'xiè', { hsk: { hanzi: '?', wordIds: ['W99'] } }),
    ]
    const errors = validateCandidates(bad, smallWords, smallUnits)
    expect(errors).toContain('x1: unknown unit u9')
    expect(errors).toContain('x1: 谢谢 is already an HSK 1 word')
    expect(errors).toContain('x2: pinyin syllables do not match hanzi length')
    expect(errors).toContain('x2: unknown word id W99')
  })
})

// ---------- dialogs ----------
const speakers: Record<string, Speaker> = {
  mama: { name: { id: 'Ibu', en: 'Mom' }, gender: 'female' },
  gege: { name: { id: 'Kakak', en: 'Brother' }, gender: 'male' },
}
const line = (speaker: string, cmn: string, gender: 'female' | 'male' = speakers[speaker]?.gender ?? 'female') => ({ speaker, gender, cmn, en: 'en', id: 'id' })
const dialog = (unit: string, lines: string[]): Dialog => ({
  id: `d-${unit}`,
  unit,
  title: { id: 't', en: 't' },
  situation: { id: 's', en: 's' },
  lines: lines.map((cmn, i) => line(i % 2 ? 'gege' : 'mama', cmn)),
})

describe('checkDialog', () => {
  const ctx = buildDialogContext(smallWords, smallUnits, smallCandidates, ['c1', 'c2', 'c3'])
  it('accepts HSK words, passed casual expressions, punctuation and digits', () => {
    const r = checkDialog(dialog('u1', ['你好！', '多谢！', '再见！', '拜拜，123！']), speakers, ctx)
    expect(r.passed).toBe(true)
    expect(r.casualUsed).toEqual(['c2', 'c1'])
    expect(r.lines[3].tokens).toEqual([
      { text: '拜拜', pinyin: 'bái bái', casualId: 'c1' },
      { text: '，' },
      { text: '123' },
      { text: '！' },
    ])
    expect(r.lines[3].pinyin).toBe('bái bái， 123！')
  })
  it('rejects text outside HSK 1', () => {
    const r = checkDialog(dialog('u1', ['你好！', '谢啦！', '再见！', '拜拜！']), speakers, ctx)
    expect(r.passed).toBe(false)
    expect(r.reasons).toEqual(['line 2: not HSK 1 "谢啦"'])
  })
  it('rejects a failed casual expression even when it is made of HSK words', () => {
    const r = checkDialog(dialog('u1', ['你好！', '没事！', '再见！', '拜拜！']), speakers, ctx)
    expect(r.reasons).toEqual(['line 2: casual "没事" (c4) did not pass'])
  })
  it('rejects casual expressions from a later unit but only counts later HSK words', () => {
    const r = checkDialog(dialog('u1', ['你好！', '吃货！', '哥，吃！', '拜拜！']), speakers, ctx)
    expect(r.reasons).toEqual(['line 2: casual "吃货" (c3) is from later unit u2'])
    expect(r.laterUnitWords).toEqual(['W5', 'W6'])
    expect(r.lines[2].tokens[0]).toEqual({ text: '哥', pinyin: 'gē', wordId: 'W5' })
  })
  it('checks line count, speakers and gender', () => {
    expect(checkDialog(dialog('u1', ['你好！', '你好！', '你好！']), speakers, ctx).reasons).toEqual(['3 lines (need 4-8)'])
    const d = dialog('u1', ['你好！', '你好！', '你好！', '你好！'])
    d.lines[0] = line('nobody', '你好！')
    d.lines[1] = line('gege', '你好！', 'female')
    expect(checkDialog(d, speakers, ctx).reasons).toEqual(['line 1: unknown speaker nobody', 'line 2: gender female does not match speaker gege'])
  })
  it('joins token pinyin with spaces and keeps punctuation attached', () => {
    expect(linePinyin([{ text: '你', pinyin: 'nǐ' }, { text: '好', pinyin: 'hǎo' }, { text: '！' }, { text: '谢谢', pinyin: 'xièxie' }])).toBe('nǐ hǎo！ xièxie')
  })
})

// ---------- build ----------
describe('buildCasual', () => {
  const candidates: CandidatesFile = { version: 1, items: smallCandidates }
  const dialogs: DialogsFile = { version: 1, speakers, dialogs: [dialog('u1', ['你好！', '多谢！', '再见！', '拜拜！']), dialog('u2', ['你好！', '没事！', '再见！', '拜拜！'])] }
  const ev = fullEvidence(smallCandidates)
  const reviews = allPass(smallCandidates)
  reviews.reviews[3] = { ...reviews.reviews[3], natural: 2 }
  const input = { words: smallWords, units: smallUnits, candidates, dialogs, evidence: ev, reviews }

  it('writes only passed expressions and dialogs, and reports the rest', () => {
    const out = buildCasual(input)
    const casual = JSON.parse(out['casual.json'])
    expect(casual.items.map((i: { id: string }) => i.id)).toEqual(['c1', 'c2', 'c3'])
    expect(casual.items[0]).toMatchObject({ pinyinNumbered: 'bai2 bai2', tones: [2, 2], evidence: ['cedict', 'tatoeba'], machine: true })
    expect(casual.items[0].note).toBeUndefined()
    const evid = JSON.parse(out['casual-evidence.json'])
    expect(evid.items.map((i: { failedAt: number | null }) => i.failedAt)).toEqual([null, null, null, 3])
    const dl = JSON.parse(out['dialogs.json'])
    expect(dl.dialogs.map((d: { id: string }) => d.id)).toEqual(['d-u1'])
    expect(dl.dialogs[0].lines[0]).toMatchObject({ pinyin: 'nǐ hǎo！', machine: true })
    const report = JSON.parse(out['casual-report.json'])
    expect(report.failedDialogs).toEqual([{ id: 'd-u2', unit: 'u2', reasons: ['line 2: casual "没事" (c4) did not pass'] }])
    expect(report.unitsBelowThree).toEqual([
      { unit: 'u1', count: 2 },
      { unit: 'u2', count: 1 },
    ])
  })
  it('does not crash when evidence, review and dialogs are missing', () => {
    const out = buildCasual({ ...input, evidence: null, reviews: null, dialogs: null })
    expect(JSON.parse(out['casual.json']).items).toEqual([])
    expect(JSON.parse(out['dialogs.json']).dialogs).toEqual([])
  })
  it('is deterministic', () => {
    expect(buildCasual(input)).toEqual(buildCasual(structuredClone(input)))
  })
  it('throws on invalid candidates', () => {
    expect(() => buildCasual({ ...input, candidates: { version: 1, items: [cand('x', 'u1', '你', 'nǐ')] } })).toThrow(/already an HSK 1 word/)
  })
})

// ---------- data ----------
const allWords = words as (WordInput & { pinyin: string })[]
const allUnits = unitsFile.units as UnitInput[]

describe('data/hsk1/casual-candidates.json', () => {
  const items = (candidatesFile as CandidatesFile).items
  // 6-8 per unit in the first draft; replacement candidates may be appended later for units that ran short.
  it('is valid and has at least 6 candidates per unit', () => {
    expect(validateCandidates(items, allWords, allUnits)).toEqual([])
    for (const u of allUnits) expect(items.filter((c) => c.unit === u.id).length, u.id).toBeGreaterThanOrEqual(6)
  })
})

const optional = import.meta.glob('../../data/hsk1/{dialogs-draft,casual-evidence-raw,casual-review}.json', { eager: true, import: 'default' })
const committed = import.meta.glob('../../data/hsk1/{casual,casual-evidence,dialogs,casual-report}.json', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>
const get = <T,>(name: string): T | null => (optional[`../../data/hsk1/${name}`] as T | undefined) ?? null
const raw = (name: string): string | undefined => committed[`../../data/hsk1/${name}`]
const haveOutputs = ['casual.json', 'casual-evidence.json', 'dialogs.json', 'casual-report.json'].every((n) => raw(n) !== undefined)

describe.skipIf(!haveOutputs)('data/hsk1 casual outputs', () => {
  const casual = haveOutputs ? JSON.parse(raw('casual.json')!) : { items: [] }
  const evid = haveOutputs ? JSON.parse(raw('casual-evidence.json')!) : { items: [] }
  const dialogs = haveOutputs ? JSON.parse(raw('dialogs.json')!) : { speakers: {}, dialogs: [] }
  const report = haveOutputs ? JSON.parse(raw('casual-report.json')!) : {}

  it('equals a fresh build (run npm run build:casual)', () => {
    const fresh = buildCasual({
      words: allWords,
      units: allUnits,
      candidates: candidatesFile as CandidatesFile,
      dialogs: get<DialogsFile>('dialogs-draft.json'),
      evidence: get<RawEvidenceFile>('casual-evidence-raw.json'),
      reviews: get<ReviewFile>('casual-review.json'),
    })
    for (const [name, text] of Object.entries(fresh)) expect(raw(name), name).toBe(text)
  })
  it('has at most 5 expressions per unit; units with fewer than 3 are reported', () => {
    const below = new Set((report.unitsBelowThree as { unit: string }[]).map((u) => u.unit))
    for (const u of allUnits) {
      const n = casual.items.filter((i: { unit: string }) => i.unit === u.id).length
      expect(n, u.id).toBeLessThanOrEqual(5)
      if (n < 3) expect(below.has(u.id), u.id).toBe(true)
    }
  })
  it('only contains expressions with >= 2 sources and a passing review', () => {
    const byId = new Map(evid.items.map((e: { id: string }) => [e.id, e]))
    for (const i of casual.items as { id: string; evidence: string[] }[]) {
      expect(i.evidence.length, i.id).toBeGreaterThanOrEqual(2)
      const e = byId.get(i.id) as { passed: boolean; review: { verdict: string; natural: number; labelOk: boolean } | null }
      expect(e.passed, i.id).toBe(true)
      expect(e.review && checkLayer3({ id: i.id, comment: '', ...e.review } as never).passed, i.id).toBe(true)
    }
  })
  it('has at most one dialog per unit with 4-8 lines and known speakers; missing units are reported', () => {
    const missing = new Set(report.unitsWithoutDialog as string[])
    for (const u of allUnits) {
      const ds = dialogs.dialogs.filter((d: { unit: string }) => d.unit === u.id)
      expect(ds.length, u.id).toBeLessThanOrEqual(1)
      if (ds.length === 0) expect(missing.has(u.id), u.id).toBe(true)
    }
    for (const d of dialogs.dialogs as { id: string; lines: { speaker: string; gender: string }[] }[]) {
      expect(d.lines.length, d.id).toBeGreaterThanOrEqual(4)
      expect(d.lines.length, d.id).toBeLessThanOrEqual(8)
      for (const l of d.lines) {
        expect(dialogs.speakers[l.speaker], `${d.id} ${l.speaker}`).toBeDefined()
        expect(l.gender).toBe(dialogs.speakers[l.speaker].gender)
      }
    }
  })
})

describe.skipIf(!get('dialogs-draft.json'))('data/hsk1/dialogs-draft.json', () => {
  it('passes the dialog check when every candidate is treated as passed (only HSK 1 + candidate text)', () => {
    const draft = get<DialogsFile>('dialogs-draft.json')!
    const items = (candidatesFile as CandidatesFile).items
    const ctx = buildDialogContext(allWords, allUnits, items, items.map((c) => c.id))
    expect(draft.dialogs.map((d) => d.unit)).toEqual(allUnits.map((u) => u.id))
    for (const d of draft.dialogs) expect(checkDialog(d, draft.speakers, ctx).reasons, d.id).toEqual([])
  })
})
