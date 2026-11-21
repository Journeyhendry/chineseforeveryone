import { describe, expect, it } from 'vitest'
import unitsFile from '../../data/hsk1/units.json'
import words from '../../data/hsk1/words.json'
import {
  analyzeSentence,
  buildLexicon,
  buildReport,
  compareCandidates,
  segment,
  selectPerWord,
  type Candidate,
  type SentenceEntry,
  type UnitInput,
  type WordInput,
} from './sentences.ts'

// Small made-up lexicon: units are u1 (我 你 们 爱 好 朋友) and u2 (学习 汉语 说 习).
const smallWords: WordInput[] = [
  { id: 'W1', hanzi: '我', variants: [], traditional: '我' },
  { id: 'W2', hanzi: '你', variants: [], traditional: '你' },
  { id: 'W3', hanzi: '们', variants: [], traditional: '們' },
  { id: 'W4', hanzi: '爱', variants: [], traditional: '愛' },
  { id: 'W5', hanzi: '好', variants: [], traditional: '好' },
  { id: 'W6', hanzi: '朋友', variants: [], traditional: '朋友' },
  { id: 'W7', hanzi: '学习', variants: [], traditional: '學習' },
  { id: 'W8', hanzi: '汉语', variants: [], traditional: '漢語' },
  { id: 'W9', hanzi: '说', variants: [], traditional: '說' },
  { id: 'W10', hanzi: '习', variants: [], traditional: '習' },
  { id: 'W11', hanzi: '还', variants: [], traditional: '還' },
  { id: 'W12', hanzi: '还', variants: [], traditional: '還' },
  { id: 'W13', hanzi: '零', variants: ['〇'], traditional: '零' },
  { id: 'W14', hanzi: '的', variants: [], traditional: '的' },
  { id: 'W15', hanzi: '有', variants: [], traditional: '有' },
  { id: 'W16', hanzi: '个', variants: [], traditional: '個' },
]
const smallUnits: UnitInput[] = [
  { id: 'u1', order: 1, words: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W11', 'W14', 'W15', 'W16'] },
  { id: 'u2', order: 2, words: ['W7', 'W8', 'W9', 'W10', 'W12', 'W13'] },
]
const lex = buildLexicon(smallWords, smallUnits)

describe('buildLexicon', () => {
  it('collects traditional-only characters, position by position', () => {
    expect([...lex.traditionalOnly].sort()).toEqual(['們', '學', '愛', '漢', '說', '語', '習', '還', '個'].sort())
  })
  it('does not treat a traditional character that is also a simplified HSK 1 character as a marker', () => {
    const l = buildLexicon(
      [
        { id: 'A', hanzi: '后', variants: [], traditional: '後' },
        { id: 'B', hanzi: '皇后', variants: [], traditional: '皇后' },
        { id: 'C', hanzi: '干', variants: [], traditional: '乾' },
        { id: 'D', hanzi: '树干', variants: [], traditional: '樹幹' },
      ],
      [{ id: 'u', order: 1, words: ['A', 'B', 'C', 'D'] }],
    )
    expect(l.traditionalOnly.has('後')).toBe(true)
    expect(l.traditionalOnly.has('乾')).toBe(true)
    expect(l.traditionalOnly.has('后')).toBe(false)
    expect(l.traditionalOnly.has('干')).toBe(false)
  })
  it('skips words whose traditional form has another length', () => {
    const l = buildLexicon([{ id: 'A', hanzi: '们', variants: [], traditional: '們們' }], [{ id: 'u', order: 1, words: ['A'] }])
    expect(l.traditionalOnly.size).toBe(0)
  })
  it('throws when a word is in no unit', () => {
    expect(() => buildLexicon(smallWords, [{ id: 'u1', order: 1, words: ['W1'] }])).toThrow(/not in any unit/)
  })
})

describe('segment', () => {
  it('matches the longest form from the left', () => {
    expect(segment('学习汉语', lex).map((t) => t.text)).toEqual(['学习', '汉语'])
    // 学习 wins over 习 even though 习 alone is also a word.
    expect(segment('学习', lex)).toEqual([{ kind: 'word', text: '学习', ids: ['W7'] }])
  })
  it('falls back to shorter forms', () => {
    expect(segment('我们', lex).map((t) => t.text)).toEqual(['我', '们'])
    expect(segment('朋', lex)).toEqual([{ kind: 'foreign', text: '朋' }])
  })
  it('groups digits and punctuation, and uses variants', () => {
    expect(segment('我有15个〇。', lex).map((t) => t.kind)).toEqual(['word', 'word', 'digits', 'word', 'word', 'punct'])
  })
  it('makes one foreign token per consecutive run', () => {
    const tokens = segment('我猫狗你猫', lex)
    expect(tokens.filter((t) => t.kind === 'foreign').map((t) => t.text)).toEqual(['猫狗', '猫'])
  })
  it('returns all ids for a form shared by two words', () => {
    expect(segment('还', lex)).toEqual([{ kind: 'word', text: '还', ids: ['W11', 'W12'] }])
  })
})

describe('segment with a dictionary', () => {
  const dictWords: WordInput[] = [
    { id: 'D1', hanzi: '太', variants: [], traditional: '太' },
    { id: 'D2', hanzi: '水', variants: [], traditional: '水' },
    { id: 'D3', hanzi: '地', variants: [], traditional: '地' },
    { id: 'D4', hanzi: '一', variants: [], traditional: '一' },
    { id: 'D5', hanzi: '个', variants: [], traditional: '個' },
    { id: 'D6', hanzi: '人', variants: [], traditional: '人' },
    { id: 'D7', hanzi: '在', variants: [], traditional: '在' },
    { id: 'D8', hanzi: '西边', variants: [], traditional: '西邊' },
    { id: 'D9', hanzi: '下', variants: [], traditional: '下' },
    { id: 'D10', hanzi: '山', variants: [], traditional: '山' },
    { id: 'D11', hanzi: '别', variants: [], traditional: '別' },
    { id: 'D12', hanzi: '坐', variants: [], traditional: '坐' },
    { id: 'D13', hanzi: '上', variants: [], traditional: '上' },
  ]
  const dictLex = buildLexicon(dictWords, [{ id: 'u', order: 1, words: dictWords.map((w) => w.id) }], ['太阳', '水泥', '一个人', '地上', '水泥工', '大水泥'])
  const result = (text: string) => {
    const r = analyzeSentence(text, dictLex)
    return r.ok ? r.value : r.reason
  }

  it('keeps 太阳 together: outside 太阳, and 太 is not counted as a used word', () => {
    expect(result('太阳在西边下山。')).toMatchObject({ outside: '太阳', words: ['D7', 'D8', 'D9', 'D10'] })
  })
  it('keeps 水泥 together: outside 水泥, and 水 is not counted', () => {
    const v = result('别坐在水泥地上。')
    expect(v).toMatchObject({ outside: '水泥', words: ['D11', 'D12', 'D7', 'D3', 'D13'] })
  })
  it('prefers the longest dictionary word (水泥工 over 水泥)', () => {
    expect(segment('水泥工', dictLex)).toEqual([{ kind: 'foreign', text: '水泥工' }])
  })
  it('treats a dictionary word made only of HSK 1 forms as those words', () => {
    expect(segment('一个人', dictLex)).toEqual([
      { kind: 'word', text: '一', ids: ['D4'] },
      { kind: 'word', text: '个', ids: ['D5'] },
      { kind: 'word', text: '人', ids: ['D6'] },
    ])
    expect(segment('地上', dictLex).map((t) => t.text)).toEqual(['地', '上'])
  })
  it('makes an HSK 1 word inside a longer dictionary word foreign', () => {
    // 大水泥 is a dictionary word that contains 水 but is not made of HSK 1 forms only.
    expect(segment('大水泥', dictLex)).toEqual([{ kind: 'foreign', text: '大水泥' }])
    expect(result('我在大水泥山。')).toBe('foreign')
  })
  it('merges neighbouring foreign pieces into one run', () => {
    expect(segment('太阳水泥', dictLex)).toEqual([{ kind: 'foreign', text: '太阳水泥' }])
  })
})

describe('analyzeSentence', () => {
  const reason = (text: string) => {
    const r = analyzeSentence(text, lex)
    return r.ok ? 'ok' : r.reason
  }
  const value = (text: string) => {
    const r = analyzeSentence(text, lex)
    if (!r.ok) throw new Error(`rejected: ${r.reason}`)
    return r.value
  }

  it('accepts a sentence made only of known words', () => {
    expect(value('我爱你的朋友。')).toMatchObject({ outside: null, words: ['W1', 'W4', 'W2', 'W14', 'W6'] })
  })
  it('allows no foreign word, one of 1 or 2 letters, rejects 3 letters and two words', () => {
    expect(value('我爱你们朋友。').outside).toBeNull()
    expect(value('我爱猫朋友。').outside).toBe('猫')
    expect(value('我爱小猫朋友。').outside).toBe('小猫')
    expect(reason('我爱小花猫朋友。')).toBe('foreign')
    expect(reason('我猫爱你狗朋友。')).toBe('foreign')
  })
  it('rejects Latin letters (also accented and full width)', () => {
    expect(reason('我爱你的朋友 Tom。')).toBe('latin')
    expect(reason('我爱你的朋友 nǐ。')).toBe('latin')
    expect(reason('我爱你的朋友ＡＢ。')).toBe('latin')
  })
  it('rejects other characters but allows listed punctuation and Arabic digits', () => {
    expect(reason('我爱你的朋友😀')).toBe('other-char')
    expect(reason('我爱 你的朋友。')).toBe('other-char')
    expect(reason('我爱你的朋友?')).toBe('other-char')
    expect(reason('“我爱你”，朋友说：《好》！…·—（真）')).toBe('ok')
    expect(reason('我有15个朋友。')).toBe('ok')
  })
  it('rejects traditional characters', () => {
    expect(reason('我愛你的朋友。')).toBe('traditional')
    expect(reason('朋友說汉语。')).toBe('traditional')
    expect(reason('我们爱你。')).toBe('ok')
  })
  it('rejects traditional text that no HSK 1 word marks (via traditional -> simplified conversion)', () => {
    expect(reason('你好，紅衣服的朋友！')).toBe('traditional')
    expect(reason('我爱你的朋友們。')).toBe('traditional')
    expect(reason('我爱你的朋友说。')).toBe('ok')
  })
  it('enforces 4 to 20 Han characters (digits and punctuation do not count)', () => {
    expect(reason('我爱你。')).toBe('length')
    expect(reason('我爱你朋。')).toBe('ok')
    expect(reason('我爱1234你。')).toBe('length')
    expect(reason('我爱你朋友'.repeat(4))).toBe('ok')
    expect(reason(`${'我'.repeat(20)}。`)).toBe('ok')
    expect(reason(`${'我'.repeat(21)}。`)).toBe('length')
  })
  it('rejects sentences without any HSK 1 word', () => {
    expect(reason('猫狗鸟鱼。')).toBe('foreign')
    const l = buildLexicon([{ id: 'A', hanzi: '我', variants: [], traditional: '我' }], [{ id: 'u', order: 1, words: ['A'] }])
    expect(analyzeSentence('猫狗', l)).toEqual({ ok: false, reason: 'length' })
  })
  it('sets unit to the latest unit among the words', () => {
    expect(value('我爱你的朋友。').unit).toBe('u1')
    expect(value('我爱学习汉语。').unit).toBe('u2')
  })
  it('uses the earliest reading of a form shared by two words', () => {
    // 还 is in u1 (W11) and u2 (W12): the sentence is usable once the first reading is learned.
    const v = value('我还爱你的朋友。')
    expect(v.unit).toBe('u1')
    expect(v.words).toEqual(['W1', 'W11', 'W12', 'W4', 'W2', 'W14', 'W6'])
  })
  it('trims the text and reports its length in characters', () => {
    expect(value('  我爱你的朋友。 ')).toMatchObject({ cmn: '我爱你的朋友。', length: 7 })
  })
})

describe('against the real word list', () => {
  const real = buildLexicon(words as WordInput[], unitsFile.units as UnitInput[])
  it('finds the traditional markers named in the spec', () => {
    for (const ch of ['們', '愛', '說', '這']) expect(real.traditionalOnly.has(ch)).toBe(true)
  })
  it('never flags a character of a simplified HSK 1 form', () => {
    for (const w of words) for (const form of [w.hanzi, ...w.variants]) for (const ch of form) expect(real.traditionalOnly.has(ch)).toBe(false)
  })
  it('does not reject normal simplified sentences', () => {
    for (const text of ['我们是老朋友了。', '太阳在西边下山。', '他通通都吃了。', '你买了太多面包。', '请问，洗手间在里面还是后面？', '这个星期天我想干净地做饭。']) {
      expect(analyzeSentence(text, real), text).not.toEqual({ ok: false, reason: 'traditional' })
    }
  })
  it('rejects the traditional sentences from real data', () => {
    expect(analyzeSentence('你好，紅衣服的女生！', real)).toEqual({ ok: false, reason: 'traditional' })
    for (const text of ['紅', '們', '說'].map((c) => `我爱你的朋友${c}。`)) expect(analyzeSentence(text, real)).toEqual({ ok: false, reason: 'traditional' })
  })
  it('accepts an everyday sentence', () => {
    const r = analyzeSentence('我们是好朋友。', real)
    expect(r.ok && r.value.outside).toBe(null)
    expect(analyzeSentence('我們是好朋友。', real)).toEqual({ ok: false, reason: 'traditional' })
  })
})

describe('ranking and per-word limit', () => {
  const base: Candidate = { tatoebaId: 100, words: ['W1'], ok: false, licensedAudio: false, hasInd: false, outside: null, length: 8 }
  const make = (o: Partial<Candidate>): Candidate => ({ ...base, ...o })

  it('orders by OK tag, licensed audio, Indonesian, no outside word, length, id', () => {
    const order = [
      make({ tatoebaId: 9, ok: true, licensedAudio: true, hasInd: true }),
      make({ tatoebaId: 8, ok: true, licensedAudio: true }),
      make({ tatoebaId: 7, ok: true, hasInd: true }),
      make({ tatoebaId: 6, ok: true, outside: '猫' }),
      make({ tatoebaId: 5, licensedAudio: true, hasInd: true }),
      make({ tatoebaId: 4, hasInd: true }),
      make({ tatoebaId: 3 }),
      make({ tatoebaId: 2, outside: '猫', length: 5 }),
      make({ tatoebaId: 11, length: 9 }),
      make({ tatoebaId: 10, length: 9, outside: '猫' }),
    ]
    // Hand-checked expected order: ids above are listed best to worst except the last three.
    const shuffled = [order[6], order[9], order[0], order[3], order[8], order[1], order[7], order[2], order[5], order[4]]
    const sorted = [...shuffled].sort(compareCandidates).map((c) => c.tatoebaId)
    expect(sorted).toEqual([9, 8, 7, 6, 5, 4, 3, 11, 2, 10].map((id) => id))
  })
  it('prefers a shorter sentence, then the smaller id', () => {
    const sorted = [make({ tatoebaId: 3, length: 6 }), make({ tatoebaId: 2, length: 6 }), make({ tatoebaId: 1, length: 7 })].sort(compareCandidates)
    expect(sorted.map((c) => c.tatoebaId)).toEqual([2, 3, 1])
  })
  it('keeps at most `cap` best sentences per word and the union over words', () => {
    const cands = [
      make({ tatoebaId: 1, words: ['W1'], length: 10 }),
      make({ tatoebaId: 2, words: ['W1'], length: 9 }),
      make({ tatoebaId: 3, words: ['W1', 'W2'], length: 8 }),
      make({ tatoebaId: 4, words: ['W2'], length: 12 }),
      make({ tatoebaId: 5, words: ['W2'], length: 11 }),
    ]
    // W1 keeps 3 and 2, W2 keeps 3 and 5.
    expect([...selectPerWord(cands, ['W1', 'W2'], 2)].sort()).toEqual([2, 3, 5])
    expect([...selectPerWord(cands, ['W1', 'W2'], 8)].sort()).toEqual([1, 2, 3, 4, 5])
    expect(selectPerWord(cands, ['W3'], 8).size).toBe(0)
  })
  it('is deterministic whatever the input order', () => {
    const cands = Array.from({ length: 30 }, (_, i) => make({ tatoebaId: i + 1, words: ['W1', 'W2'], length: 5 + (i % 4), ok: i % 5 === 0, hasInd: i % 3 === 0 }))
    const a = [...selectPerWord(cands, ['W1', 'W2'], 5)].sort((x, y) => x - y)
    const b = [...selectPerWord([...cands].reverse(), ['W1', 'W2'], 5)].sort((x, y) => x - y)
    expect(a).toEqual(b)
    expect(a).toHaveLength(5)
  })
})

describe('buildReport', () => {
  const entry = (id: number, unit: string, w: string[]): SentenceEntry => ({
    tatoebaId: id,
    cmn: '我爱你的朋友。',
    author: 'a',
    license: 'CC BY 2.0 FR',
    ok: true,
    outside: null,
    words: w,
    unit,
    en: [{ tatoebaId: id + 1000, text: 'x', author: 'b', license: 'CC BY 2.0 FR' }],
    ind: [],
    audio: [],
  })
  it('counts sentences per unit and word, and lists the gaps', () => {
    const stats = { cmnSentences: 3, rejected: { latin: 0, 'other-char': 0, traditional: 0, length: 0, foreign: 0, 'no-words': 0 }, noAuthor: 0, noEnglish: 0, candidates: 2 }
    const report = buildReport([entry(1, 'u1', ['W1', 'W2']), entry(2, 'u2', ['W1'])], smallWords.slice(0, 3), smallUnits, stats, {
      generatedAt: '2026-01-01T00:00:00.000Z',
      perWordLimit: 8,
      fileBytes: 10,
    })
    expect(report.perUnit).toEqual({ u1: 1, u2: 1 })
    expect(report.perWord).toEqual({ W1: 2, W2: 1, W3: 0 })
    expect(report.wordsWithoutSentences).toEqual(['W3'])
    expect(report.unitsBelowFive).toEqual([
      { unit: 'u1', count: 1 },
      { unit: 'u2', count: 1 },
    ])
    expect(report.totalSentences).toBe(2)
  })
})

// Data test: runs only once the workflow has committed data/hsk1/sentences.json.
const dataFiles = import.meta.glob('../../data/hsk1/sentences.json', { eager: true, import: 'default' })
const data = Object.values(dataFiles)[0] as { version: number; sentences: SentenceEntry[] } | undefined
describe.skipIf(!data)('data/hsk1/sentences.json', () => {
  const sentences = data?.sentences ?? []
  const ids = new Set(words.map((w) => w.id))
  const unitIds = new Set(unitsFile.units.map((u) => u.id))
  it('has unique Tatoeba ids sorted ascending', () => {
    expect(new Set(sentences.map((s) => s.tatoebaId)).size).toBe(sentences.length)
    expect(sentences.map((s) => s.tatoebaId)).toEqual(sentences.map((s) => s.tatoebaId).sort((a, b) => a - b))
  })
  it('gives every entry an id, author, license, English translation with attribution and valid word ids', () => {
    for (const s of sentences) {
      expect(Number.isInteger(s.tatoebaId), `${s.tatoebaId}`).toBe(true)
      expect(s.author, `${s.tatoebaId} author`).toBeTruthy()
      expect(s.license, `${s.tatoebaId} license`).toBeTruthy()
      expect(s.en.length, `${s.tatoebaId} en`).toBeGreaterThanOrEqual(1)
      expect(s.en.length).toBeLessThanOrEqual(2)
      expect(s.ind.length).toBeLessThanOrEqual(2)
      for (const t of [...s.en, ...s.ind]) {
        expect(Number.isInteger(t.tatoebaId)).toBe(true)
        expect(t.author).toBeTruthy()
        expect(t.license).toBeTruthy()
        expect(t.text).toBeTruthy()
      }
      expect(s.words.length).toBeGreaterThanOrEqual(1)
      for (const id of s.words) expect(ids.has(id), `${s.tatoebaId}: ${id}`).toBe(true)
      expect(unitIds.has(s.unit)).toBe(true)
    }
  })
})
