import { describe, expect, it } from 'vitest'
import type { CasualCandidate, DialogsFile, RawEvidenceFile, ReviewFile } from './casual.ts'
import { buildCasualRemapped, hskVersionWordIds, remapCandidates, remapDialogs, type CasualRemap } from './casual-remap.ts'
import { buildLexicon, type UnitInput, type WordInput } from './sentences.ts'

const words: (WordInput & { pinyin: string })[] = [
  { id: 'A1', hanzi: '再见', variants: [], traditional: '再見', pinyin: 'zàijiàn' },
  { id: 'A2', hanzi: '里', variants: [], traditional: '裡', pinyin: 'lǐ' },
  { id: 'A3', hanzi: '边', variants: [], traditional: '邊', pinyin: 'biān' },
  { id: 'A4', hanzi: '谢谢', variants: [], traditional: '謝謝', pinyin: 'xièxie' },
]
const units: UnitInput[] = [
  { id: 'u1', order: 1, words: ['A1', 'A4'] },
  { id: 'u2', order: 2, words: ['A2', 'A3'] },
]
const cand = (id: string, unit: string, hanzi: string, pinyin: string, hskHanzi: string, wordIds: string[]): CasualCandidate => ({
  id,
  unit,
  hanzi,
  variants: [],
  pinyin,
  label: 'santai',
  hsk: { hanzi: hskHanzi, wordIds },
  meaning: { id: 'arti', en: 'meaning' },
  situation: { id: 'situasi', en: 'situation' },
  note: 'n',
})
const items = [cand('c1', 'u1', '拜拜', 'bái bái', '再见', ['A1']), cand('c2', 'u1', '里头', 'lǐ tou', '里边', ['OLD-里边']), cand('c3', 'u1', '多谢', 'duō xiè', '谢谢', ['A4'])]
const remap: CasualRemap = {
  version: 1,
  note: '',
  candidates: { c1: { unit: 'u2' }, c3: { drop: 'no longer wanted' } },
  dialogs: { d1: { unit: 'u2' } },
}

describe('hskVersionWordIds', () => {
  it('reads the words of the HSK version against the new word list (里边 is 里 + 边 now)', () => {
    expect(hskVersionWordIds('里边', buildLexicon(words, units))).toEqual(['A2', 'A3'])
  })
})

describe('remapCandidates', () => {
  const out = remapCandidates(items, remap, words, units)
  it('moves candidates to the unit of the remap file and re-reads their HSK word ids', () => {
    expect(out.items.map((c) => [c.id, c.unit, c.hsk.wordIds])).toEqual([
      ['c1', 'u2', ['A1']],
      ['c2', 'u1', ['A2', 'A3']],
    ])
  })
  it('returns dropped candidates with their reason, and never changes the input', () => {
    expect(out.dropped).toEqual([{ id: 'c3', hanzi: '多谢', draftUnit: 'u1', reason: 'no longer wanted' }])
    expect(items[0].unit).toBe('u1')
    expect(items[1].hsk.wordIds).toEqual(['OLD-里边'])
  })
})

describe('remapDialogs / buildCasualRemapped', () => {
  const speakers = { a: { name: { id: 'A', en: 'A' }, gender: 'female' as const } }
  const line = (cmn: string) => ({ speaker: 'a', gender: 'female' as const, cmn, en: 'e', id: 'i' })
  const dialog = (id: string, cmn: string) => ({ id, unit: 'u1', title: { id: 't', en: 't' }, situation: { id: 's', en: 's' }, lines: [line(cmn), line(cmn), line(cmn), line(cmn)] })
  const draft: DialogsFile = { version: 1, speakers, dialogs: [dialog('d1', '再见！'), dialog('d2', '再见！'), dialog('d3', '再见喝！')] }
  const remap2: CasualRemap = { ...remap, dialogs: { d1: { unit: 'u2' }, d3: { unit: 'u2' } } }

  it('uses the unit of the remap file and reports dialogs without an entry', () => {
    const r = remapDialogs(draft, remap2)
    expect(r.dialogs.map((d) => [d.id, d.unit])).toEqual([['d1', 'u2'], ['d3', 'u2']])
    expect(r.unplaced.map((d) => d.id)).toEqual(['d2'])
  })

  const evidence: RawEvidenceFile = { version: 1, fetchedAt: 'x', tatoebaFile: 'x', items: [] }
  const reviews: ReviewFile = { version: 1, reviews: [] }
  const out = buildCasualRemapped({ words, units, candidates: { version: 1, items }, dialogs: draft, evidence, reviews, remap: remap2 })

  it('keeps the dialogs that pass, retires the rest with their draft text and a reason', () => {
    const kept = JSON.parse(out['dialogs.json']).dialogs.map((d: { id: string; unit: string }) => [d.id, d.unit])
    expect(kept).toEqual([['d1', 'u2']])
    const retired = JSON.parse(out['dialogs-retired.json']).dialogs as { id: string; unit: string; retired: { reason: string; details: string[] } }[]
    expect(retired.map((d) => d.id)).toEqual(['d2', 'd3'])
    expect(retired[0].unit).toBe('u1')
    expect(retired[0].retired.reason).toMatch(/no matching unit/)
    expect(retired[1].retired.details[0]).toMatch(/not HSK 1/)
  })
  it('keeps a line of evidence for dropped candidates, in draft order, and lists them in the report', () => {
    const evid = JSON.parse(out['casual-evidence.json']).items as { id: string; unit: string | null; dropped?: string; passed: boolean }[]
    expect(evid.map((e) => e.id)).toEqual(['c1', 'c2', 'c3'])
    expect(evid[2]).toMatchObject({ unit: null, dropped: 'no longer wanted', passed: false })
    expect(JSON.parse(out['casual-report.json']).droppedCandidates).toHaveLength(1)
  })
  it('is deterministic', () => {
    expect(buildCasualRemapped({ words, units, candidates: { version: 1, items }, dialogs: draft, evidence, reviews, remap: remap2 })).toEqual(out)
  })
})
