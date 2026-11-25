import { describe, expect, it } from 'vitest'
import {
  buildLexicon,
  buildSentenceGame,
  collectSentences,
  isSentenceCorrect,
  MAX_PIECES,
  MIN_PIECES,
  piecesFromTokens,
  placePiece,
  removeLast,
  removePiece,
  scramble,
  stripEnd,
  tokenize,
  type GameSentence,
} from './sentence'
import { mulberry32 } from '../lib/quiz'
import { ALL_WORDS, UNITS } from './testdata'

const lex = buildLexicon(ALL_WORDS)
const joinIdx = (s: GameSentence, order: number[]) => order.map((i) => s.pieces[i].text).join('')

describe('pemotong kalimat', () => {
  it('longest match, tanda baca akhir dibuang, tengah ikut potongan sebelumnya', () => {
    const l = buildLexicon([
      { hanzi: '你', pinyin: 'nǐ' },
      { hanzi: '你好', pinyin: 'nǐhǎo' },
      { hanzi: '好', pinyin: 'hǎo' },
      { hanzi: '吗', pinyin: 'ma' },
    ])
    expect(tokenize('你好吗？', l)).toEqual({ pieces: [{ text: '你好', pinyin: 'nǐhǎo' }, { text: '吗', pinyin: 'ma' }], unknown: 0 })
    expect(tokenize('你好，你好！', l).pieces.map((p) => p.text)).toEqual(['你好，', '你好'])
    expect(tokenize('猫你', l)).toEqual({ pieces: [{ text: '猫', pinyin: null }, { text: '你', pinyin: 'nǐ' }], unknown: 1 })
    expect(stripEnd(' 好。！ ')).toBe('好')
  })

  it('token dialog', () => {
    expect(
      piecesFromTokens([{ text: '再见', pinyin: 'zàijiàn' }, { text: '！' }, { text: '明天', pinyin: 'míngtiān' }, { text: '见', pinyin: 'jiàn' }, { text: '！' }]).map((p) => p.text),
    ).toEqual(['再见！', '明天', '见'])
  })
})

describe('kalimat unit', () => {
  it('tiap unit: >= 5 kalimat, 3-7 potongan, unik, hanya kalimat unit itu', () => {
    for (const unit of UNITS) {
      const list = collectSentences(unit, lex)
      expect(list.length).toBeGreaterThanOrEqual(5)
      expect(new Set(list.map((s) => s.text)).size).toBe(list.length)
      const own = new Set([...unit.words.flatMap((w) => w.examples.map((e) => `t:${e.tatoebaId}`)), ...(unit.dialog?.lines.map((_, i) => `d:${unit.dialog!.id}:${i}`) ?? [])])
      for (const s of list) {
        expect(own.has(s.key)).toBe(true)
        expect(s.pieces.length).toBeGreaterThanOrEqual(MIN_PIECES)
        expect(s.pieces.length).toBeLessThanOrEqual(MAX_PIECES)
        expect(s.pieces.map((p) => p.text).join('')).toBe(s.text)
        expect(s.pieces.every((p) => p.pinyin)).toBe(true)
        expect(s.tr.id || s.tr.en).toBeTruthy()
        if (s.tatoeba) {
          const ex = unit.words.flatMap((w) => w.examples).find((e) => e.tatoebaId === s.tatoeba!.tatoebaId)!
          expect(ex.outside).toBeNull()
        }
      }
    }
  })

  it('5 soal per main, acakan tidak pernah sama dengan jawaban', () => {
    for (const unit of UNITS) {
      const list = collectSentences(unit, lex)
      for (let seed = 1; seed <= 10; seed++) {
        const qs = buildSentenceGame(list, { seed })
        expect(qs).toHaveLength(5)
        expect(new Set(qs.map((q) => q.sentence.key)).size).toBe(5)
        for (const q of qs) {
          expect([...q.bank].sort((a, b) => a - b)).toEqual(q.sentence.pieces.map((_, i) => i))
          expect(joinIdx(q.sentence, q.bank)).not.toBe(q.sentence.text)
          expect(isSentenceCorrect(q.sentence, q.bank)).toBe(false)
          expect(isSentenceCorrect(q.sentence, q.sentence.pieces.map((_, i) => i))).toBe(true)
        }
      }
    }
  })

  it('kalimat < 5 -> pakai yang ada; 0 -> kosong', () => {
    const list = collectSentences(UNITS[0], lex).slice(0, 2)
    expect(buildSentenceGame(list, { seed: 1 })).toHaveLength(2)
    expect(buildSentenceGame([], { seed: 1 })).toEqual([])
    expect(collectSentences({ words: [], dialog: null }, lex)).toEqual([])
  })
})

describe('cek jawaban', () => {
  const twin: GameSentence = {
    key: 't:1',
    text: '好好好学',
    cmn: '好好好学。',
    pieces: [
      { text: '好', pinyin: 'hǎo' },
      { text: '好', pinyin: 'hǎo' },
      { text: '好', pinyin: 'hǎo' },
      { text: '学', pinyin: 'xué' },
    ],
    tr: { id: null, en: 'x' },
    machine: false,
    tatoeba: null,
  }

  it('urutan setara (potongan kembar) diterima', () => {
    expect(isSentenceCorrect(twin, [0, 1, 2, 3])).toBe(true)
    expect(isSentenceCorrect(twin, [2, 0, 1, 3])).toBe(true)
    expect(isSentenceCorrect(twin, [3, 0, 1, 2])).toBe(false)
    expect(isSentenceCorrect(twin, [0, 1, 2])).toBe(false)
    expect(isSentenceCorrect(twin, [0, 0, 1, 3])).toBe(false)
  })

  it('acakan dengan potongan kembar tetap berbeda string', () => {
    for (let seed = 1; seed < 50; seed++) expect(joinIdx(twin, scramble(twin.pieces, mulberry32(seed)))).not.toBe(twin.text)
  })

  it('baris jawaban: taruh, pindah, ambil kembali', () => {
    let a = placePiece([], 2)
    a = placePiece(a, 0)
    a = placePiece(a, 1, 0)
    expect(a).toEqual([1, 2, 0])
    expect(placePiece(a, 0, 0)).toEqual([0, 1, 2])
    expect(placePiece(a, 3, 99)).toEqual([1, 2, 0, 3])
    expect(removePiece(a, 2)).toEqual([1, 0])
    expect(removeLast(a)).toEqual([1, 2])
    expect(removeLast([])).toEqual([])
  })
})
