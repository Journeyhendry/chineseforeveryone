import { describe, expect, it } from 'vitest'
import { syllableTone } from '../lib/pinyin'
import { buildToneGame, toneEligible, toneItems, TONE_MIN, TONE_QUESTIONS } from './tone'
import { UNITS } from './testdata'

describe('tebak nada', () => {
  it('semua unit: 8-10 soal, opsi unik, tepat satu benar = nada tertulis di data', () => {
    for (const unit of UNITS) {
      const ids = new Set(unit.words.map((w) => w.id))
      for (let seed = 1; seed <= 20; seed++) {
        const qs = buildToneGame(unit.words, { seed })
        expect(qs.length).toBeGreaterThanOrEqual(TONE_MIN)
        expect(qs.length).toBeLessThanOrEqual(TONE_QUESTIONS)
        expect(new Set(qs.map((q) => q.hanzi)).size).toBe(qs.length)
        for (const q of qs) {
          expect(ids.has(q.wordId)).toBe(true)
          const word = unit.words.find((w) => w.id === q.wordId)!
          expect(word.hanzi.includes(q.hanzi)).toBe(true)
          expect(q.choices).toHaveLength(4)
          const keys = q.choices.map((c) => c.join('-'))
          expect(new Set(keys).size).toBe(4)
          const right = q.syllables.map((s) => syllableTone(s)).join('-')
          expect(keys.filter((k) => k === right)).toHaveLength(1)
          expect(keys[q.answer]).toBe(right)
          expect(q.choices.every((c) => c.length === q.syllables.length)).toBe(true)
          expect(/[不一]/.test(q.hanzi)).toBe(false)
          expect(right.includes('5')).toBe(false)
          expect(right).not.toBe('3-3')
        }
      }
    }
  })

  it('aturan kata utuh', () => {
    expect(toneEligible({ hanzi: '你好', syllables: ['nǐ', 'hǎo'] })).toBe(false)
    expect(toneEligible({ hanzi: '谢谢', syllables: ['xiè', 'xie'] })).toBe(false)
    expect(toneEligible({ hanzi: '不是', syllables: ['bù', 'shì'] })).toBe(false)
    expect(toneEligible({ hanzi: '老师', syllables: ['lǎo', 'shī'] })).toBe(true)
    expect(toneEligible({ hanzi: '好', syllables: ['hǎo'] })).toBe(true)
    expect(toneEligible({ hanzi: '对不起', syllables: ['duì', 'bu', 'qǐ'] })).toBe(false)
  })

  it('1 suku kata: pilihan nada 1-4 berurutan', () => {
    const w = { id: 'a', hanzi: '好', pinyin: 'hǎo', syllables: ['hǎo'], en: ['good'], ind: ['baik'] }
    const [q] = buildToneGame([w], { seed: 1 })
    expect(q.choices).toEqual([[1], [2], [3], [4]])
    expect(q.answer).toBe(2)
  })

  it('data kecil (3 kata) -> soal sebanyak bahan, minimal 1', () => {
    const words = [
      { id: 'a', hanzi: '你好', pinyin: 'nǐhǎo', syllables: ['nǐ', 'hǎo'], en: ['hi'], ind: ['hai'] },
      { id: 'b', hanzi: '老师', pinyin: 'lǎoshī', syllables: ['lǎo', 'shī'], en: ['teacher'], ind: ['guru'] },
      { id: 'c', hanzi: '谢谢', pinyin: 'xièxie', syllables: ['xiè', 'xie'], en: ['thanks'], ind: ['terima kasih'] },
    ]
    const { whole, parts } = toneItems(words)
    expect(whole.map((x) => x.hanzi)).toEqual(['老师'])
    expect(parts.map((x) => x.hanzi).sort()).toEqual(['你', '好', '师', '老', '谢'].sort())
    const qs = buildToneGame(words, { seed: 3 })
    expect(qs).toHaveLength(6)
    expect(qs.filter((q) => !q.part)).toHaveLength(1)
  })

  it('seed sama -> hasil sama; buat ulang tidak membawa state', () => {
    expect(buildToneGame(UNITS[0].words, { seed: 9 })).toEqual(buildToneGame(UNITS[0].words, { seed: 9 }))
  })
})
