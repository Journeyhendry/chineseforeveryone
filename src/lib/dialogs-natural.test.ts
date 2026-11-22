import { describe, expect, it } from 'vitest'
import unitsFile from '../../data/hsk1/units.json'
import { ALLOWED_PUNCT, type UnitInput, type WordInput } from './sentences.ts'
import type { DialogsFile } from './casual.ts'
import type { CasualRemap } from './casual-remap.ts'
import {
  buildCasualWithNaturalDialogs,
  MAX_LATER_UNIT_WORDS,
  naturalFieldErrors,
  PLACE_KINDS,
  placeVarietyErrors,
  type NaturalDialog,
  type NaturalDialogsFile,
  type PlaceKind,
} from './dialogs-natural.ts'

// ---------- fixtures ----------
const words: (WordInput & { pinyin: string })[] = [
  { id: 'A1', hanzi: '再见', variants: [], traditional: '再見', pinyin: 'zàijiàn' },
  { id: 'A2', hanzi: '谢谢', variants: [], traditional: '謝謝', pinyin: 'xièxie' },
  { id: 'B1', hanzi: '里', variants: [], traditional: '裡', pinyin: 'lǐ' },
  { id: 'B2', hanzi: '边', variants: [], traditional: '邊', pinyin: 'biān' },
  { id: 'B3', hanzi: '上', variants: [], traditional: '上', pinyin: 'shàng' },
  { id: 'B4', hanzi: '下', variants: [], traditional: '下', pinyin: 'xià' },
]
const units: UnitInput[] = [
  { id: 'u1', order: 1, words: ['A1', 'A2'] },
  { id: 'u2', order: 2, words: ['B1', 'B2', 'B3', 'B4'] },
]
const speakers = { mama: { name: { id: 'Ibu', en: 'Mom' }, gender: 'female' as const } }
const line = (cmn: string) => ({ speaker: 'mama', gender: 'female' as const, cmn, en: 'e', id: 'i' })
const bi = (s: string) => ({ id: s, en: s })
const natural = (unit: string, cmn: string[], over: Partial<NaturalDialog> = {}): NaturalDialog => ({
  id: `n-${unit}`,
  unit,
  title: bi('t'),
  place: bi('p'),
  placeKind: 'home',
  goal: bi('g'),
  situation: bi('s'),
  lines: cmn.map(line),
  ...over,
})
const draft: DialogsFile = {
  version: 1,
  speakers,
  dialogs: [
    { id: 'd1', unit: 'u1', title: bi('t'), situation: bi('s'), lines: ['再见！', '谢谢！', '再见！', '谢谢！'].map(line) },
    { id: 'd2', unit: 'u1', title: bi('t'), situation: bi('s'), lines: ['再见！', '谢谢！', '再见！', '谢谢！'].map(line) },
  ],
}
const remap: CasualRemap = { version: 1, note: '', candidates: {}, dialogs: { d1: { unit: 'u1' } } }
const base = { words, units, candidates: { version: 1, items: [] }, dialogs: draft, evidence: null, reviews: null, remap }

describe('naturalFieldErrors', () => {
  it('accepts a complete dialog', () => {
    expect(naturalFieldErrors(natural('u1', ['再见！']))).toEqual([])
  })
  it('needs id n-<unit>, a known placeKind and id + en texts', () => {
    const d = natural('u1', ['再见！'], { id: 'x', placeKind: 'moon' as PlaceKind, goal: { id: '', en: 'g' } })
    expect(naturalFieldErrors(d)).toEqual(['id x should be n-u1', 'unknown placeKind moon', 'goal needs id and en'])
  })
})

describe('placeVarietyErrors', () => {
  const kinds = (list: string[]) => list.map((k) => ({ placeKind: k as PlaceKind }))
  it('accepts 7+ kinds including phone, transport, market/shop, eatery and school', () => {
    expect(placeVarietyErrors(kinds(['home', 'school', 'shop', 'eatery', 'transport', 'phone', 'park']))).toEqual([])
  })
  it('reports too few kinds, overused kinds and missing required kinds', () => {
    expect(placeVarietyErrors(kinds(['home', 'home', 'home', 'home', 'home', 'home', 'park']))).toEqual([
      'only 2 place kinds (need 7)',
      'placeKind home used 6 times (max 5)',
      'no dialog with placeKind phone',
      'no dialog with placeKind transport',
      'no dialog with placeKind market or shop',
      'no dialog with placeKind eatery',
      'no dialog with placeKind school',
    ])
  })
})

describe('buildCasualWithNaturalDialogs', () => {
  const nat: NaturalDialogsFile = {
    version: 1,
    speakers,
    dialogs: [
      natural('u1', ['再见！', '谢谢！', '里边！', '再见！']),
      natural('u1', ['再见！', '谢谢！', '再见！', '谢谢！'], { id: 'n-u1' }),
      natural('u2', ['再见！', '谢谢！', '再见！', '谢谢！'], { placeKind: 'nowhere' as PlaceKind }),
    ],
  }
  const out = buildCasualWithNaturalDialogs({ ...base, natural: nat })
  const report = JSON.parse(out['casual-report.json'])

  it('writes only passing natural dialogs, with place, placeKind and goal', () => {
    const dl = JSON.parse(out['dialogs.json'])
    expect(dl.speakers).toEqual(speakers)
    expect(dl.dialogs).toHaveLength(1)
    expect(Object.keys(dl.dialogs[0])).toEqual(['id', 'unit', 'title', 'place', 'placeKind', 'goal', 'situation', 'machine', 'lines'])
    expect(dl.dialogs[0].lines[2]).toMatchObject({ cmn: '里边！', pinyin: 'lǐ biān！', machine: true })
  })
  it('reports failed dialogs (second one for a unit, bad placeKind) and units without dialog', () => {
    expect(report.failedDialogs).toEqual([
      { id: 'n-u1', unit: 'u1', reasons: ['second dialog for unit u1'] },
      { id: 'n-u2', unit: 'u2', reasons: ['unknown placeKind nowhere'] },
    ])
    expect(report.unitsWithoutDialog).toEqual(['u2'])
    expect(report.totals).toMatchObject({ dialogs: 3, dialogsPassed: 1 })
    expect(report.dialogs[0]).toMatchObject({ id: 'n-u1', passed: true, laterUnitWords: ['B1', 'B2'] })
  })
  it(`rejects more than ${MAX_LATER_UNIT_WORDS} words from later units`, () => {
    const many = buildCasualWithNaturalDialogs({ ...base, natural: { ...nat, dialogs: [natural('u1', ['里边上下！', '再见！', '再见！', '再见！'])] } })
    expect(JSON.parse(many['casual-report.json']).failedDialogs[0].reasons).toEqual(['4 words from later units (max 3)'])
  })
  it('retires every draft dialog, also the one that used to pass', () => {
    const retired = JSON.parse(out['dialogs-retired.json']).dialogs
    expect(retired.map((d: { id: string }) => d.id)).toEqual(['d1', 'd2'])
    expect(retired[0].retired.reason).toMatch(/replaced by the natural dialog/)
    expect(report.retiredDialogs).toEqual(['d1', 'd2'])
  })
  it('is deterministic and works without a natural file', () => {
    expect(buildCasualWithNaturalDialogs({ ...base, natural: structuredClone(nat) })).toEqual(out)
    expect(JSON.parse(buildCasualWithNaturalDialogs({ ...base, natural: null })['dialogs.json']).dialogs).toEqual([])
  })
})

// ---------- data ----------
const files = import.meta.glob('../../data/hsk1/{dialogs-natural,dialogs,casual-report}.json', { eager: true, import: 'default' })
const file = <T,>(name: string) => files[`../../data/hsk1/${name}`] as T
const nat = file<NaturalDialogsFile>('dialogs-natural.json')
const built = file<NaturalDialogsFile & { dialogs: { lines: { cmn: string }[] }[] }>('dialogs.json')
const report = file<{ dialogs: { id: string; laterUnitWords: string[] }[]; placeVariety: string[] }>('casual-report.json')
const allUnits = unitsFile.units as UnitInput[]

describe('data/hsk1/dialogs-natural.json (task 3d)', () => {
  it('has exactly one dialog per unit, id n-<unit>, in unit order', () => {
    expect(nat.dialogs.map((d) => d.unit)).toEqual(allUnits.map((u) => u.id))
    for (const d of nat.dialogs) expect(naturalFieldErrors(d), d.id).toEqual([])
  })
  it('uses the speakers of dialogs.json unchanged and the speaker gender on every line', () => {
    expect(nat.speakers).toEqual(built.speakers)
    for (const d of nat.dialogs) for (const l of d.lines) expect(l.gender, `${d.id} ${l.speaker}`).toBe(nat.speakers[l.speaker].gender)
  })
  it('has 4-8 lines, Mandarin text with full-width punctuation only and both translations', () => {
    const punct = new RegExp(`^[\\p{Script=Han}${ALLOWED_PUNCT}]+$`, 'u')
    for (const d of nat.dialogs) {
      expect(d.lines.length, d.id).toBeGreaterThanOrEqual(4)
      expect(d.lines.length, d.id).toBeLessThanOrEqual(8)
      for (const l of d.lines) {
        expect(l.cmn, d.id).toMatch(punct)
        expect(l.en.trim() !== '' && l.id.trim() !== '', `${d.id} ${l.cmn}`).toBe(true)
      }
    }
  })
  it('varies the places', () => {
    expect(placeVarietyErrors(nat.dialogs)).toEqual([])
    expect(report.placeVariety).toEqual([])
    for (const d of nat.dialogs) expect(PLACE_KINDS).toContain(d.placeKind)
  })
  it(`all pass the vocabulary check with at most ${MAX_LATER_UNIT_WORDS} later-unit words`, () => {
    expect(built.dialogs.map((d) => d.id)).toEqual(nat.dialogs.map((d) => d.id))
    for (const d of report.dialogs) expect(d.laterUnitWords.length, d.id).toBeLessThanOrEqual(MAX_LATER_UNIT_WORDS)
  })
})

// Task 3d part D: the independent review. Skipped only while data/hsk1/dialog-review.json does not exist yet.
interface Scores {
  natural: number
  clarity: number
  flow: number
}
interface ReviewFile {
  rounds: { round: number; reviews: { id: string; cmn: string[]; scores: Scores }[] }[]
  final: Record<string, { round: number; scores: Scores }>
}
const reviewFiles = import.meta.glob('../../data/hsk1/dialog-review.json', { eager: true, import: 'default' })
const review = reviewFiles['../../data/hsk1/dialog-review.json'] as ReviewFile | undefined

describe('data/hsk1/dialog-review.json (task 3d)', () => {
  if (!review) {
    it.todo('every dialog has a final review with all scores >= 4 (review file not written yet)')
    return
  }
  it('every dialog has a final review with natural, clarity and flow >= 4, made on the current text', () => {
    for (const d of built.dialogs) {
      const final = review.final[d.id]
      expect(final, d.id).toBeDefined()
      for (const k of ['natural', 'clarity', 'flow'] as const) expect(final.scores[k], `${d.id} ${k}`).toBeGreaterThanOrEqual(4)
      const reviewed = review.rounds.find((r) => r.round === final.round)?.reviews.find((r) => r.id === d.id)
      expect(reviewed, `${d.id} round ${final.round}`).toBeDefined()
      expect(reviewed!.cmn, `${d.id}: text changed after the review`).toEqual(d.lines.map((l) => l.cmn))
    }
  })
})
