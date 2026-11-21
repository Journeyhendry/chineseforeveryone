import { describe, expect, it } from 'vitest'
import unitsFile from '../../data/hsk1/units.json'
import words from '../../data/hsk1/words.json'

const { version, units } = unitsFile

describe('data/hsk1/units.json', () => {
  it('has version 1', () => expect(version).toBe(1))
  it('has 15 to 20 units', () => {
    expect(units.length).toBeGreaterThanOrEqual(15)
    expect(units.length).toBeLessThanOrEqual(20)
  })
  it('numbers units 1..N in order with matching ids', () => {
    units.forEach((u, i) => {
      expect(u.order).toBe(i + 1)
      expect(u.id).toBe(`u${String(i + 1).padStart(2, '0')}`)
    })
  })
  it('has unique slugs', () => expect(new Set(units.map((u) => u.slug)).size).toBe(units.length))
  it.each(units.map((u) => [u.id, u] as const))('%s has titles, descriptions and 20-35 words', (_id, u) => {
    expect(u.slug).toMatch(/^[a-z0-9-]+$/)
    for (const text of [u.title.id, u.title.en, u.description.id, u.description.en]) expect(text.trim()).not.toBe('')
    expect(u.words.length).toBeGreaterThanOrEqual(20)
    expect(u.words.length).toBeLessThanOrEqual(35)
  })
  it('lists only known word ids', () => {
    const known = new Set(words.map((w) => w.id))
    for (const u of units) for (const id of u.words) expect(known.has(id), `${u.id}: unknown ${id}`).toBe(true)
  })
  it('places every word exactly once (500 in total)', () => {
    const all = units.flatMap((u) => u.words)
    expect(all).toHaveLength(500)
    expect(new Set(all).size).toBe(500)
    expect(new Set(all)).toEqual(new Set(words.map((w) => w.id)))
  })
})
