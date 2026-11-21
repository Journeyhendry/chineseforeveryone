import { describe, expect, it } from 'vitest'
import words from '../../data/hsk1/words.json'

describe('data/hsk1/words.json', () => {
  it('has 500 entries', () => expect(words).toHaveLength(500))
  it('has unique ids', () => expect(new Set(words.map((w) => w.id)).size).toBe(words.length))
  it('has ids sorted', () => expect(words.map((w) => w.id)).toEqual(words.map((w) => w.id).sort()))
  it.each(words.map((w) => [w.id, w] as const))('%s is complete', (_id, w) => {
    expect(w.hanzi).toBeTruthy()
    expect(w.pinyin).toBeTruthy()
    expect(w.pinyinNumbered).toBeTruthy()
    expect(w.en.length).toBeGreaterThanOrEqual(1)
    expect(w.ind.length).toBeGreaterThanOrEqual(1)
    expect(w.idMachine).toBe(true)
    expect(w.hsk).toBe(1)
    expect(w.tones).toHaveLength(w.syllables.length)
    expect(w.pinyinNumbered.split(' ')).toHaveLength(w.syllables.length)
    for (const t of w.tones) expect([1, 2, 3, 4, 5]).toContain(t)
    expect([...w.hanzi]).toHaveLength(w.syllables.length)
  })
})
