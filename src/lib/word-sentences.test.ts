import { describe, expect, it } from 'vitest'
import type { Tone } from './pinyin.ts'
import {
  buildOutputs,
  buildWordSentences,
  checkPinyin,
  compareTone,
  exportReview,
  makeContext,
  pinyinSyllables,
  reviewGate,
  reviewText,
  segmentText,
  type DraftEntry,
  type ReviewFile,
  type WordRow,
} from './word-sentences.ts'

const w = (id: string, hanzi: string, pinyin: string, tones: Tone[], variants: string[] = []): WordRow => ({
  id,
  hanzi,
  variants,
  traditional: hanzi,
  pinyin,
  tones,
  en: [`en ${hanzi}`],
  ind: [`id ${hanzi}`],
})
const words = [
  w('W1', '你好', 'nǐ hǎo', [3, 3]),
  w('W2', '我', 'wǒ', [3]),
  w('W3', '是', 'shì', [4]),
  w('W4', '老师', 'lǎoshī', [3, 1]),
  w('W5', '一', 'yī', [1]),
  w('W6', '个', 'gè', [4]),
  w('W7', '不', 'bù', [4]),
  w('W8', '吃', 'chī', [1]),
  w('W9', '面条儿', 'miàntiáor', [4, 2, 5]),
  w('W10', '谢谢', 'xièxie', [4, 5]),
  w('W11', '你', 'nǐ', [3]),
  w('W12', '好', 'hǎo', [3]),
  w('W13', '人', 'rén', [2]),
  w('W14', '玩', 'wán', [2], ['玩儿']),
  w('W15', '去', 'qù', [4]),
  w('W16', '要', 'yào', [4]),
  ...['有', '时间', '男', '同学', '和', '牛奶', '一些', '分钟', '新', '手机', '茶', '车', '十'].map((h, k) => w(`S${k}`, h, 'x', [...h].map(() => 1 as Tone))),
  w('S20', '有些', 'yǒuxiē', [3, 1], ['有一些']),
]
const units = [
  { id: 'u01', order: 1, words: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W10', 'W11', 'W12', 'W13', 'W16'] },
  { id: 'u02', order: 2, words: ['W8', 'W9', 'W14', 'W15', ...Array.from({ length: 13 }, (_, k) => `S${k}`), 'S20'] },
]
const ctx = makeContext({
  words,
  units,
  dictionary: ['太阳', '一个', '一个人', '面条', '苹果', '新', '很', '有时', '男同', '和牛', '十分', '新手', '奶茶', '骑车'],
  speakers: { mama: { name: { id: 'Ibu', en: 'Mom' }, gender: 'female' }, baba: { name: { id: 'Ayah', en: 'Dad' }, gender: 'male' } },
  sceneRefs: ['W1'],
  tatoeba: [{ tatoebaId: 42, cmn: '我是老师。' }],
  corpus: ['我吃苹果。', '你吃苹果吗？', '老师好！'],
})
const seg = (text: string) => segmentText(text, ctx.lex, ctx.forms)

describe('segmentText', () => {
  it('splits dictionary words made of HSK 1 words and keeps outside words separate', () => {
    expect(seg('一个人吃苹果太阳！').segments.map((s) => [s.text, s.kind])).toEqual([
      ['一', 'hsk1'],
      ['个', 'hsk1'],
      ['人', 'hsk1'],
      ['吃', 'hsk1'],
      ['苹果', 'outside'],
      ['太阳', 'outside'],
    ])
  })
  it('prefers a split into HSK 1 words over a dictionary compound', () => {
    const texts = (t: string) => seg(t).segments.map((x) => x.text)
    expect(texts('有时间')).toEqual(['有', '时间'])
    expect(texts('男同学')).toEqual(['男', '同学'])
    expect(texts('和牛奶')).toEqual(['和', '牛奶'])
    expect(texts('有一些')).toEqual(['有', '一些'])
    expect(texts('十分钟')).toEqual(['十', '分钟'])
    expect(texts('新手机')).toEqual(['新', '手机'])
    expect(seg('有一些').segments.every((x) => x.kind === 'hsk1')).toBe(true)
  })
  it('keeps an outside compound whole instead of splitting off an HSK 1 character', () => {
    expect(seg('喝奶茶骑车').segments.map((x) => [x.text, x.kind])).toEqual([
      ['喝', 'outside'],
      ['奶茶', 'outside'],
      ['骑车', 'outside'],
    ])
  })
  it('ignores punctuation and digits, keeps Han positions', () => {
    const s = seg('你好，老师3！')
    expect(s.han.join('')).toBe('你好老师')
    expect(s.segments.map((x) => x.start)).toEqual([0, 2])
    expect(s.hasDigits).toBe(true)
  })
  it('matches variants (玩儿) and unknown single characters', () => {
    expect(seg('去玩儿猫').segments.map((s) => [s.text, s.kind])).toEqual([
      ['去', 'hsk1'],
      ['玩儿', 'hsk1'],
      ['猫', 'outside'],
    ])
  })
})

describe('pinyin syllables', () => {
  it('counts erhua r as the syllable of 儿', () => {
    expect(pinyinSyllables('Wǒ chī miàntiáor.')).toEqual(['Wǒ', 'chī', 'miàn', 'tiáo', 'r'])
    expect(checkPinyin('Wǒ chī miàntiáor.', seg('我吃面条儿。'), ctx.words)).toEqual([])
  })
  it('reports a wrong syllable count', () => {
    expect(checkPinyin('Wǒ chī miàntiáo.', seg('我吃面条儿。'), ctx.words)[0]).toMatchObject({ level: 'error' })
  })
  it('rejects r that does not line up with 儿', () => {
    expect(checkPinyin('Wǒr chī.', seg('我是吃。'), ctx.words).some((i) => i.message.includes('erhua'))).toBe(true)
  })
  it('warns on lower-case start and skips sentences with digits', () => {
    expect(checkPinyin('wǒ shì lǎoshī.', seg('我是老师。'), ctx.words)).toEqual([{ level: 'warning', message: 'pinyin should start with a capital letter' }])
    expect(checkPinyin('Sān gè.', seg('3个。'), ctx.words)[0].level).toBe('warning')
  })
})

describe('tone check', () => {
  it('accepts written 一/不 sandhi and unwritten 3rd-tone sandhi', () => {
    expect(checkPinyin('Wǒ shì yí gè lǎoshī.', seg('我是一个老师。'), ctx.words)).toEqual([])
    expect(checkPinyin('Wǒ bú qù.', seg('我不去。'), ctx.words)).toEqual([])
    expect(checkPinyin('Nǐ hǎo!', seg('你好！'), ctx.words)).toEqual([])
    expect(checkPinyin('Bù chī.', seg('不吃。'), ctx.words)).toEqual([])
  })
  it('errors on written 3rd-tone sandhi and wrong tones', () => {
    const issues = checkPinyin('Ní hǎo!', seg('你好！'), ctx.words)
    expect(issues).toHaveLength(1)
    expect(issues[0].level).toBe('error')
    expect(issues[0].message).toContain('3rd-tone sandhi')
    expect(checkPinyin('Wǒ shí lǎoshī.', seg('我是老师。'), ctx.words)[0].level).toBe('error')
  })
  it('only warns for neutral vs full tone and for 一/不 sandhi against the next tone', () => {
    expect(checkPinyin('Xièxiè!', seg('谢谢！'), ctx.words).map((i) => i.level)).toEqual(['warning'])
    expect(checkPinyin('Wǒ bù qù.', seg('我不去。'), ctx.words).map((i) => i.level)).toEqual(['warning'])
    expect(checkPinyin('Yì gè rén.', seg('一个人。'), ctx.words).map((i) => i.level)).toEqual(['warning'])
  })
  it('compareTone rules', () => {
    expect(compareTone('一', 1, 2, 4)).toBeNull()
    expect(compareTone('一', 1, 4, 1)).toBeNull()
    expect(compareTone('一', 1, 3, 1)?.level).toBe('error')
    expect(compareTone('不', 4, 5, 3)).toBeNull()
    expect(compareTone('不', 4, 2, 3)?.level).toBe('warning')
    expect(compareTone('好', 3, 5, undefined)?.level).toBe('warning')
    expect(compareTone('好', 3, 4, undefined)?.level).toBe('error')
  })
})

const entry = (over: Partial<DraftEntry> & { wordId: string; hanzi: string }): DraftEntry => ({
  sentence: { hanzi: '我是老师。', pinyin: 'Wǒ shì lǎoshī.', id: 'Saya guru.', en: "I'm a teacher.", source: 'unit', sourceId: null, speaker: 'mama', matchForm: null },
  dialog: null,
  scene: { ref: null, fit: 'new', note: 'Ibu di kelas.' },
  ...over,
})
const u01 = {
  unit: 'u01',
  entries: [
    entry({ wordId: 'W4', hanzi: '老师', sentence: { hanzi: '我是老师。', pinyin: 'Wǒ shì lǎoshī.', id: 'Saya guru.', en: "I'm a teacher.", source: 'tatoeba', sourceId: 42, speaker: 'mama', matchForm: null } }),
    entry({
      wordId: 'W10',
      hanzi: '谢谢',
      sentence: { hanzi: '谢谢！', pinyin: 'Xièxie!', id: 'Terima kasih!', en: 'Thanks!', source: 'unit', sourceId: null, speaker: 'baba', matchForm: null },
      dialog: {
        reason: { id: 'Ucapan terima kasih dan balasannya.', en: 'Thanks and the reply.' },
        lines: [
          { who: 'mama', hanzi: '你吃苹果。', pinyin: 'Nǐ chī píngguǒ.', id: 'Makan apel.', en: 'Have an apple.' },
          { who: 'baba', hanzi: '谢谢！', pinyin: 'Xièxie!', id: 'Terima kasih!', en: 'Thanks!' },
        ],
      },
      scene: { ref: 'W1', fit: 'rebubble', note: 'Ibu memberi apel.' },
    }),
    entry({ wordId: 'W2', hanzi: '我', sentence: { hanzi: '我吃苹果。', pinyin: 'Wǒ chī píngguǒ.', id: 'Saya makan apel.', en: 'I eat an apple.', source: 'buatan', sourceId: null, speaker: 'baba', matchForm: null } }),
  ],
}

describe('buildWordSentences', () => {
  it('builds analysis, evidence and finds no error in a valid draft', () => {
    const r = buildWordSentences({ u01 }, ctx)
    const errors = r.problems.filter((p) => p.level === 'error' && p.wordId !== '' && !p.message.includes('has no entry'))
    expect(errors).toEqual([])
    expect(r.problems).toContainEqual({ level: 'error', unit: 'u02', wordId: '', message: 'draft file missing' })
    const me = r.file.entries.find((e) => e.wordId === 'W2')!
    expect(me.sentence.outsideWords).toEqual(['苹果'])
    expect(me.analysis).toMatchObject({ segments: ['我', '吃', '苹果'], hanziCount: 4, laterUnitWords: ['吃'], inScope: false })
    expect(me.analysis.evidence).toEqual({ allInDictionary: true, missing: [], collocationHits: 1 })
    expect(r.file.entries[0].analysis.inScope).toBe(true)
    expect(r.file.entries[1].dialog!.lines[0].outsideWords).toEqual(['苹果'])
  })
  it('reports the rule violations', () => {
    const bad = {
      unit: 'u01',
      entries: [
        entry({ wordId: 'W8', hanzi: '吃' }),
        entry({ wordId: 'W3', hanzi: '是', sentence: { hanzi: '我是老师。', pinyin: 'Wǒ shì lǎoshī.', id: '', en: 'x', source: 'tatoeba', sourceId: 7, speaker: 'cat', matchForm: null } }),
        entry({ wordId: 'W3', hanzi: '是', scene: { ref: 'W9', fit: 'new', note: '' } }),
        entry({
          wordId: 'W1',
          hanzi: '你好',
          sentence: { hanzi: '你好！', pinyin: 'Nǐ hǎo!', id: 'Halo', en: 'Hi', source: 'buatan', sourceId: null, speaker: 'mama', matchForm: null },
          dialog: { reason: { id: '', en: '' }, lines: [{ who: 'mama', hanzi: '你好！', pinyin: 'Nǐ hǎo!', id: 'Halo', en: 'Hi' }] },
        }),
        entry({ wordId: 'W5', hanzi: '一', sentence: { hanzi: '我吃苹果太阳新很好人人人人人人', pinyin: 'x', id: 'a', en: 'b', source: 'unit', sourceId: null, speaker: 'mama', matchForm: null } }),
      ],
    }
    const messages = buildWordSentences({ u01: bad, u02: '{ broken' }, ctx).problems.map((p) => `${p.level} ${p.wordId} ${p.message}`)
    const has = (s: string) => expect(messages.some((m) => m.includes(s)), s).toBe(true)
    has('error W8 word belongs to u02')
    has('error W8 sentence does not contain 吃')
    has('error W3 sentence needs id and en')
    has('error W3 unknown speaker cat')
    has('error W3 tatoeba sourceId 7')
    has('error W3 word already has an entry')
    has('warning W3 same sentence as')
    has('error W3 scene.ref W9')
    has('error W3 scene.fit "new" exactly when')
    has('warning W1 source buatan but no outside word')
    has('error W1 dialog has 1 lines')
    has('error W1 dialog reason needs id and en')
    has('error W5 sentence: 15 hanzi')
    has('error W5 sentence: 3 outside words')
    has('error W5 sentence pinyin: pinyin has 1 syllables')
    has('error  draft is not valid JSON')
    has('error W12 word 好 has no entry')
  })
  it('is deterministic', () => {
    expect(buildOutputs({ u01 }, ctx)).toEqual(buildOutputs({ u01 }, ctx))
  })
})

describe('exportReview and reviewGate', () => {
  const { file } = buildWordSentences({ u01 }, ctx)
  it('exports without the writer reasoning', () => {
    const out = JSON.stringify(exportReview(file, ctx))
    for (const hidden of ['reason', 'source', 'scene', 'note', 'Ucapan']) expect(out).not.toContain(hidden)
    const thanks = exportReview(file, ctx).entries[1]
    expect(thanks.text).toBe('你吃苹果。\n谢谢！')
    expect(thanks.dialog![0].who).toEqual({ name: { id: 'Ibu', en: 'Mom' }, gender: 'female' })
    expect(thanks.word).toEqual({ hanzi: '谢谢', pinyin: 'xièxie', meanings: { id: ['id 谢谢'], en: ['en 谢谢'] } })
  })
  const good: ReviewFile = {
    version: 1,
    reviewer: 'test',
    entries: file.entries.map((e) => ({ wordId: e.wordId, text: reviewText(e), scores: { natural: 5, correct: 4, beginner: 4, drawable: 5 }, translationOk: true, pinyinOk: true, comment: '' })),
  }
  it('passes a complete review', () => {
    expect(reviewGate(file.entries, good)).toEqual([])
  })
  it('fails on missing file, missing entry, changed text, low score and not-ok flags', () => {
    expect(reviewGate(file.entries, null)).toHaveLength(1)
    const [a, b, c] = good.entries
    const errors = reviewGate(file.entries, {
      ...good,
      entries: [{ ...a, text: 'old' }, { ...b, scores: { ...b.scores, drawable: 3 }, pinyinOk: false }, { ...c, translationOk: false }, { ...c, wordId: 'W99' }],
    })
    expect(errors).toEqual([
      'review: W99 has no entry in word-sentences.json',
      'review: W4 was reviewed for another text (re-review needed)',
      'review: W10 scores below 4: drawable=3',
      'review: W10 pinyin not ok',
      'review: W2 translation not ok',
    ])
    expect(reviewGate(file.entries, { ...good, entries: [a] })).toContain('review: W10 not reviewed')
  })
})
