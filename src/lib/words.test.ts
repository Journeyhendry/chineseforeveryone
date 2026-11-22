import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import words from '../../data/hsk1/words.json'
import sources from '../../data/hsk1/SOURCES.json'

describe('data/hsk1/words.json', () => {
  it('has 300 entries (HSK syllabus 2025)', () => expect(words).toHaveLength(300))
  it('has unique ids', () => expect(new Set(words.map((w) => w.id)).size).toBe(words.length))
  it('matches the 2025 source list one to one, in list order', () => {
    const list = readFileSync(new URL('../../data/raw/hsk31_words_level1.txt', import.meta.url), 'utf8').split(/\s+/).filter(Boolean)
    expect(list).toHaveLength(300)
    list.forEach((entry, i) => {
      // optional parts: 没（有） -> 没有 / 没, 有（一）点儿 -> 有点儿 / 有一点儿; 没事 and 一下 list the erhua form as a variant
      const forms = new Set([entry, entry.replace(/[（）]/g, ''), entry.replace(/（[^）]*）/g, '')])
      const w = words[i]
      expect([w.hanzi, ...w.variants].some((f) => forms.has(f)), `${i + 1}: ${entry} vs ${w.hanzi}`).toBe(true)
    })
  })
  it('keeps ids of 2021 words and numbers new words L1-0501 onward in list order', () => {
    const fresh = words.filter((w) => w.id >= 'L1-0501').map((w) => w.id)
    expect(fresh).toEqual(Array.from({ length: fresh.length }, (_, i) => `L1-${String(501 + i).padStart(4, '0')}`))
    expect(sources.ids.newIds).toEqual(fresh)
    expect(sources.wordCount).toBe(300)
    expect(sources.ids.reused + fresh.length).toBe(300)
  })
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
