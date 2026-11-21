import { describe, expect, it } from 'vitest'
import visualsFile from '../../data/hsk1/visuals.json'
import dialogs from '../../data/hsk1/dialogs.json'
import words from '../../data/hsk1/words.json'
import { CHARACTER_IDS, countByType, validateVisuals, type VisualItem, type VisualsFile } from './visuals.ts'

const file = visualsFile as VisualsFile
const wordRefs = words.map((w) => ({ id: w.id, hanzi: w.hanzi }))

const item = (over: Partial<VisualItem> = {}): VisualItem => ({
  wordId: 'A',
  hanzi: '大',
  type: 'object',
  scene: { id: 'Adegan.', en: 'Scene.' },
  characters: [],
  props: [],
  ...over,
})
const mini = [
  { id: 'A', hanzi: '大' },
  { id: 'B', hanzi: '小' },
]
const check = (items: VisualItem[]) => validateVisuals({ version: 1, items }, mini)

describe('validateVisuals', () => {
  it('accepts a valid file', () => {
    expect(check([item({ type: 'pair', pairWordId: 'B' }), item({ wordId: 'B', hanzi: '小', type: 'pair', pairWordId: 'A' })])).toEqual([])
  })
  it('reports a missing word', () => expect(check([item()])).toContain('missing entry for B 小'))
  it('reports a duplicate word', () => {
    expect(check([item(), item(), item({ wordId: 'B', hanzi: '小' })])).toContain('2 entries for A 大')
  })
  it('reports unknown word ids and hanzi mismatches', () => {
    const errs = check([item({ hanzi: '小' }), item({ wordId: 'B', hanzi: '小' }), item({ wordId: 'Z' })])
    expect(errs.some((e) => e.includes('does not match'))).toBe(true)
    expect(errs.some((e) => e.includes('unknown wordId'))).toBe(true)
  })
  it('reports an invalid type', () => {
    const errs = check([item({ type: 'picture' as VisualItem['type'] }), item({ wordId: 'B', hanzi: '小' })])
    expect(errs.some((e) => e.includes('invalid type'))).toBe(true)
  })
  it('reports empty scenes', () => {
    const errs = check([item({ scene: { id: ' ', en: '' } }), item({ wordId: 'B', hanzi: '小' })])
    expect(errs.some((e) => e.includes('empty scene.id'))).toBe(true)
    expect(errs.some((e) => e.includes('empty scene.en'))).toBe(true)
  })
  it('reports unknown characters', () => {
    const errs = check([item({ characters: ['mama', 'uncle'] }), item({ wordId: 'B', hanzi: '小' })])
    expect(errs).toEqual(['items[0] A: unknown character uncle'])
  })
  it('reports bad prop slugs', () => {
    const errs = check([item({ props: ['bowl', 'Rice Bowl'] }), item({ wordId: 'B', hanzi: '小' })])
    expect(errs).toEqual(['items[0] A: prop Rice Bowl is not a lowercase slug'])
  })
  it('reports a pairWordId that is self, unknown, or not on a pair', () => {
    expect(check([item({ type: 'pair', pairWordId: 'A' }), item({ wordId: 'B', hanzi: '小' })])).toEqual([
      'items[0] A: pairWordId points to itself',
    ])
    expect(check([item({ type: 'pair', pairWordId: 'Q' }), item({ wordId: 'B', hanzi: '小' })])).toEqual([
      'items[0] A: pairWordId Q is not a word',
    ])
    expect(check([item({ pairWordId: 'B' }), item({ wordId: 'B', hanzi: '小' })])).toEqual([
      'items[0] A: pairWordId only allowed on type pair',
    ])
  })
  it('reports wrong order', () => {
    expect(check([item({ wordId: 'B', hanzi: '小' }), item()])).toEqual(['items are not in words.json order'])
  })
  it('counts by type', () => {
    expect(countByType([item(), item({ type: 'comic' })])).toEqual({ object: 1, action: 0, pair: 0, count: 0, position: 0, comic: 1 })
  })
})

describe('data/hsk1/visuals.json', () => {
  it('passes validation (500 words, words.json order)', () => {
    expect(validateVisuals(file, wordRefs)).toEqual([])
    expect(file.items).toHaveLength(500)
  })
  it('knows every dialog speaker', () => {
    expect([...CHARACTER_IDS].sort()).toEqual(Object.keys(dialogs.speakers).sort())
  })
  it('uses every visual type', () => {
    for (const n of Object.values(countByType(file.items))) expect(n).toBeGreaterThan(0)
  })
})
