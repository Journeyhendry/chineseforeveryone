import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import casualFile from '../../data/hsk1/casual.json'
import dialogsFile from '../../data/hsk1/dialogs.json'
import sentencesFile from '../../data/hsk1/sentences.json'
import unitsFile from '../../data/hsk1/units.json'
import wordsFile from '../../data/hsk1/words.json'
import wordSentencesFile from '../../data/hsk1/word-sentences.json'
import dialogsNaturalFile from '../../data/hsk1/dialogs-natural.json'
import basicsFile from '../../data/basics/basics.json'
import { basicsChars, type BasicsData } from './basics'
import { buildLessons, strokeChars, strokeFileName, type LessonsInput } from './lessons-build'
import type { UnitData } from './lesson-types'

const input = {
  words: wordsFile,
  units: unitsFile.units,
  sentences: sentencesFile.sentences,
  casual: casualFile.items,
  dialogs: dialogsFile,
  wordSentences: wordSentencesFile.entries,
  speakers: dialogsNaturalFile.speakers,
} as unknown as LessonsInput

const outDir = new URL('../../public/data/hsk1/', import.meta.url)
const hanziDir = new URL('../../public/hanzi/', import.meta.url)
const fresh = buildLessons(input)

/** Huruf HSK 1 yang (sengaja) tidak punya data coretan. Kosong saat ini. */
const STROKE_EXCEPTIONS: string[] = []

describe('public/data/hsk1 (npm run build:lessons)', () => {
  it('sama dengan build ulang', () => {
    const committed = ['index.json', ...readdirSync(new URL('units/', outDir)).map((n) => `units/${n}`)].sort()
    expect(committed).toEqual(Object.keys(fresh).sort())
    for (const [name, text] of Object.entries(fresh)) expect(readFileSync(new URL(name, outDir), 'utf8'), name).toBe(text)
  })

  it('deterministik', () => {
    expect(buildLessons(structuredClone(input))).toEqual(fresh)
  })

  it('setiap kata HSK 1 ada di tepat satu file unit', () => {
    const seen = new Map<string, number>()
    for (const [name, text] of Object.entries(fresh)) {
      if (!name.startsWith('units/')) continue
      for (const w of (JSON.parse(text) as UnitData).words) seen.set(w.id, (seen.get(w.id) ?? 0) + 1)
    }
    expect(seen.size).toBe(wordsFile.length)
    for (const w of wordsFile) expect(seen.get(w.id), w.id).toBe(1)
  })

  it('maksimal 3 contoh per kata, kalimat memang memuat kata itu', () => {
    const sById = new Map(sentencesFile.sentences.map((s) => [s.tatoebaId, s]))
    for (const [name, text] of Object.entries(fresh)) {
      if (!name.startsWith('units/')) continue
      for (const w of (JSON.parse(text) as UnitData).words) {
        expect(w.examples.length).toBeLessThanOrEqual(3)
        for (const e of w.examples) expect(sById.get(e.tatoebaId)!.words).toContain(w.id)
      }
    }
  })

  it('setiap unit punya 1 dialog dengan tempat, jenis tempat, dan tujuan (task 3d)', () => {
    for (const u of unitsFile.units) {
      const d = (JSON.parse(fresh[`units/${u.id}.json`]) as UnitData).dialog
      expect(d, u.id).not.toBeNull()
      expect(d!.place.id && d!.place.en && d!.goal.id && d!.goal.en && d!.placeKind, u.id).toBeTruthy()
    }
  })

  it('setiap kata punya kalimat utama (+ dialog bila ada) dari word-sentences.json, tanpa analysis (task 6c)', () => {
    const ws = new Map(wordSentencesFile.entries.map((e) => [e.wordId, e]))
    for (const [name, text] of Object.entries(fresh)) {
      if (!name.startsWith('units/')) continue
      const unit = JSON.parse(text) as UnitData
      for (const w of unit.words) {
        const src = ws.get(w.id)!
        expect(w.sentence?.hanzi, w.id).toBe(src.sentence.hanzi)
        expect(w.sentence?.pinyin, w.id).toBe(src.sentence.pinyin)
        expect(w.dialog?.lines.map((l) => l.hanzi) ?? null, w.id).toEqual(src.dialog?.lines.map((l) => l.hanzi) ?? null)
        expect(JSON.stringify(w), w.id).not.toContain('analysis')
        if (w.sentence?.speaker) expect(unit.speakers[w.sentence.speaker], w.id).toBeTruthy()
        for (const l of w.dialog?.lines ?? []) expect(unit.speakers[l.who], w.id).toBeTruthy()
        if (w.sentence?.source === 'tatoeba') expect(w.sentence.author && w.sentence.license, w.id).toBeTruthy()
      }
    }
  })

  it('index kecil dan berisi 20 unit', () => {
    const index = JSON.parse(fresh['index.json'])
    expect(index.units).toHaveLength(unitsFile.units.length)
    expect(fresh['index.json'].length).toBeLessThan(20_000)
  })
})

describe('public/hanzi (npm run build:strokes)', () => {
  const chars = strokeChars(wordsFile, casualFile.items, basicsChars(basicsFile as unknown as BasicsData))
  const require = createRequire(import.meta.url)
  const dataDir = dirname(require.resolve('hanzi-writer-data/package.json'))

  it('setiap huruf kata HSK 1 punya data coretan (atau tercatat pengecualian)', () => {
    const hskChars = new Set(wordsFile.flatMap((w) => [...w.hanzi]))
    for (const ch of hskChars) {
      if (STROKE_EXCEPTIONS.includes(ch)) continue
      expect(existsSync(new URL(strokeFileName(ch), hanziDir)), ch).toBe(true)
    }
  })

  it('isi folder sama dengan build ulang', () => {
    const want = chars.filter((ch) => existsSync(join(dataDir, strokeFileName(ch)))).map(strokeFileName)
    expect(readdirSync(hanziDir).sort()).toEqual([...want, 'ARPHICPL.TXT'].sort())
    for (const name of want) {
      expect(readFileSync(new URL(name, hanziDir), 'utf8'), name).toBe(readFileSync(join(dataDir, name), 'utf8'))
    }
    expect(readFileSync(new URL('ARPHICPL.TXT', hanziDir), 'utf8')).toBe(readFileSync(join(dataDir, 'ARPHICPL.TXT'), 'utf8'))
  })
})
