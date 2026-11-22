import { describe, expect, it } from 'vitest'
import casualFile from '../../data/hsk1/casual.json'
import dialogsFile from '../../data/hsk1/dialogs.json'
import sentencesFile from '../../data/hsk1/sentences.json'
import scenesFile from '../../data/hsk1/scenes.json'
import unitsFile from '../../data/hsk1/units.json'
import visualsFile from '../../data/hsk1/visuals.json'
import words from '../../data/hsk1/words.json'
import previewScenes from '../../data/hsk2-preview/scenes.json'
import previewVisuals from '../../data/hsk2-preview/visuals.json'
import previewWords from '../../data/hsk2-preview/words.json'
import lessonIndex from '../../public/data/hsk1/index.json'
import sceneIndex from '../../public/art/scenes/index.json'
import { checkDataLinks, type DataSet } from './data-links.ts'

const lessonUnitFiles = import.meta.glob('../../public/data/hsk1/units/*.json', { eager: true, import: 'default' }) as Record<string, DataSet['lessonUnits'][string]>
const hanziFiles = Object.keys(import.meta.glob('../../public/hanzi/*.json')).map((p) => p.replace('../../public/hanzi/', '').replace('.json', ''))

const real: DataSet = {
  words,
  units: unitsFile.units,
  sentences: sentencesFile.sentences,
  casual: casualFile.items,
  dialogs: dialogsFile.dialogs as DataSet['dialogs'],
  visuals: visualsFile.items,
  scenes: scenesFile.scenes,
  lessonIndex,
  lessonUnits: Object.fromEntries(Object.entries(lessonUnitFiles).map(([p, f]) => [p.replace('../../public/data/hsk1/units/', '').replace('.json', ''), f])),
  sceneIndexIds: Object.keys(sceneIndex.scenes),
  hanziChars: hanziFiles,
  preview: { words: previewWords, visuals: previewVisuals.items, scenes: previewScenes.scenes },
}

describe('checkDataLinks on the real data', () => {
  it('finds no broken id or link (npm run check:data)', () => {
    expect(checkDataLinks(real)).toEqual([])
  })
  it('has the HSK 2 preview words of the 2021 list that are not in the 300 words', () => {
    expect(real.preview.words).toHaveLength(500 - 266)
    expect(real.words).toHaveLength(300)
  })
})

describe('checkDataLinks finds problems', () => {
  const small = (): DataSet => ({
    words: [
      { id: 'A', hanzi: '一', chars: ['一'] },
      { id: 'B', hanzi: '二', chars: ['二'] },
    ],
    units: [
      { id: 'u01', order: 1, words: ['A'] },
      { id: 'u02', order: 2, words: ['B'] },
    ],
    sentences: [{ tatoebaId: 1, words: ['A', 'B'], unit: 'u02' }],
    casual: [{ id: 'c1', unit: 'u01', hsk: { wordIds: ['A'] } }],
    dialogs: [{ id: 'd1', unit: 'u02', lines: [{ tokens: [{ wordId: 'A' }, { casualId: 'c1' }] }] }],
    visuals: [{ wordId: 'A' }, { wordId: 'B', pairWordId: 'A' }],
    scenes: [{ wordId: 'A', unitId: 'u01' }],
    lessonIndex: { units: [{ id: 'u01', order: 1, wordCount: 1 }, { id: 'u02', order: 2, wordCount: 1 }] },
    lessonUnits: {
      u01: { unit: { id: 'u01' }, words: [{ id: 'A', examples: [] }], casual: [{ id: 'c1', unit: 'u01', hsk: { wordIds: ['A'] } }], relatedCasual: [], dialog: null },
      u02: { unit: { id: 'u02' }, words: [{ id: 'B', examples: [] }], casual: [], relatedCasual: [], dialog: { id: 'd1' } },
    },
    sceneIndexIds: ['A'],
    hanziChars: ['一', '二'],
    preview: { words: [{ id: 'P', hsk: 2, previewFrom: 'hsk1-2021' }], visuals: [{ wordId: 'P' }], scenes: [] },
  })
  const check = (change: (d: DataSet) => void): string[] => {
    const d = small()
    change(d)
    return checkDataLinks(d)
  }

  it('accepts the small valid set', () => expect(checkDataLinks(small())).toEqual([]))
  it('word in no unit / in two units / unknown in a unit', () => {
    expect(check((d) => d.units[1].words.push('A'))).toContain('units.json: word A is in both u01 and u02')
    expect(check((d) => (d.units[1].words = []))).toContain('units.json: word B 二 is in no unit')
    expect(check((d) => d.units[0].words.push('Z'))).toContain('units.json u01: unknown word id Z')
  })
  it('unknown ids in sentences, casual, dialogs, visuals and scenes', () => {
    expect(check((d) => d.sentences[0].words.push('Z'))).toContain('sentences.json 1: unknown word id Z')
    expect(check((d) => (d.sentences[0].unit = 'u99'))).toContain('sentences.json 1: unknown unit u99')
    expect(check((d) => d.casual[0].hsk.wordIds.push('Z'))).toContain('casual.json c1: unknown word id Z')
    expect(check((d) => d.dialogs[0].lines[0].tokens.push({ wordId: 'Z' }))).toContain('dialogs.json d1: unknown word id Z')
    expect(check((d) => d.dialogs[0].lines[0].tokens.push({ casualId: 'c9' }))).toContain('dialogs.json d1: unknown casual id c9')
    expect(check((d) => (d.visuals[1].pairWordId = 'Z'))).toContain('visuals.json B pairWordId: unknown word id Z')
    expect(check((d) => d.visuals.pop())).toContain('visuals.json: no entry for B')
    expect(check((d) => (d.scenes[0].unitId = 'u02'))).toContain('scenes.json A: unitId u02 but the word is in u01')
  })
  it('built files that disagree with the data', () => {
    expect(check((d) => delete d.lessonUnits.u02)).toContain('public/data/hsk1/units/u02.json: missing')
    expect(check((d) => (d.lessonUnits.u01.words = []))).toContain('public/data/hsk1/units/u01.json: words differ from units.json')
    expect(check((d) => d.sceneIndexIds.push('B'))).toContain('public/art/scenes/index.json: differs from scenes.json')
    expect(check((d) => (d.hanziChars = ['一']))).toContain('public/hanzi: no stroke file for 二 (B 二)')
  })
  it('preview words that are also HSK 1 words or point to nothing', () => {
    expect(check((d) => d.preview.words.push({ id: 'A', hsk: 2, previewFrom: 'hsk1-2021' }))).toContain('hsk2-preview/words.json: A is also an HSK 1 word')
    expect(check((d) => d.preview.scenes.push({ wordId: 'X' }))).toContain('hsk2-preview/scenes.json: X is not a preview word')
  })
})
