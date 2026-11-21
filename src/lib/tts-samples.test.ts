/// <reference types="node" />
import { existsSync, readFileSync, statSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import words from '../../data/hsk1/words.json'
import sentencesFile from '../../data/hsk1/sentences.json'
import dialogsFile from '../../data/hsk1/dialogs.json'
import samples from '../../scripts/tts/samples.json'
import voicesFile from '../../scripts/tts/voices.json'

const SAMPLES_DIR = new URL('../../public/audio/samples/', import.meta.url)
const MANIFEST = new URL('manifest.json', SAMPLES_DIR)

type Item = (typeof samples.items)[number]
type Source = Item['source'] & { wordId?: string; wordIds?: string[]; tatoebaId?: number; dialogId?: string; line?: number }

const wordById = new Map(words.map((w) => [w.id, w]))
const PUNCT = /[，。？！、,.?!\s]/g
const letters = (s: string) => s.replace(PUNCT, '')

describe('samples.json', () => {
  it('has 5 words and 2 sentences with unique ids', () => {
    expect(samples.items.filter((i) => i.kind === 'word')).toHaveLength(5)
    expect(samples.items.filter((i) => i.kind === 'sentence')).toHaveLength(2)
    expect(new Set(samples.items.map((i) => i.id)).size).toBe(samples.items.length)
  })

  it('has the five required words', () => {
    const hanzi = samples.items.filter((i) => i.kind === 'word').map((i) => i.hanzi)
    expect(hanzi).toEqual(['你好', '谢谢', '妈妈', '学校', '喝水'])
  })

  it('pinyin has one syllable per hanzi letter', () => {
    for (const it of samples.items) {
      const syl = letters(it.pinyin.replace(/\s+/g, ' ').replace(/ /g, '|')).split('|').filter(Boolean)
      expect(syl.length, it.id).toBe(letters(it.hanzi).length)
    }
  })

  it('word items match words.json (wordId <-> hanzi)', () => {
    for (const it of samples.items.filter((i) => i.kind === 'word')) {
      const s = it.source as Source
      const ids = s.wordIds ?? (s.wordId ? [s.wordId] : [])
      expect(ids.length, it.id).toBeGreaterThan(0)
      const joined = ids
        .map((id) => {
          const w = wordById.get(id)
          expect(w, `${it.id}: ${id}`).toBeDefined()
          return w?.hanzi ?? ''
        })
        .join('')
      expect(joined, it.id).toBe(it.hanzi)
    }
  })

  it('Tatoeba sentence exists with same hanzi and author, 6-12 letters', () => {
    const it = samples.items.find((i) => (i.source as Source).tatoebaId)!
    const s = it.source as Source & { author: string }
    const row = sentencesFile.sentences.find((x) => x.tatoebaId === s.tatoebaId)
    expect(row).toBeDefined()
    expect(row?.cmn).toBe(it.hanzi)
    expect(row?.author).toBe(s.author)
    expect(letters(it.hanzi).length).toBeGreaterThanOrEqual(6)
    expect(letters(it.hanzi).length).toBeLessThanOrEqual(12)
  })

  it('dialog line exists with same hanzi', () => {
    const it = samples.items.find((i) => (i.source as Source).dialogId)!
    const s = it.source as Source
    const d = dialogsFile.dialogs.find((x) => x.id === s.dialogId)
    expect(d).toBeDefined()
    expect(d?.lines[(s.line ?? 0) - 1]?.cmn).toBe(it.hanzi)
  })

  it('sentences contain only Mandarin letters and punctuation', () => {
    for (const it of samples.items) {
      expect(it.hanzi, it.id).toMatch(/^[一-鿿，。？！、]+$/)
    }
  })
})

describe('voices.json', () => {
  const voices = voicesFile.voices
  it('has unique codes, >= 3 female (P) and >= 2 male (L)', () => {
    expect(new Set(voices.map((v) => v.code)).size).toBe(voices.length)
    expect(voices.filter((v) => v.gender === 'female').length).toBeGreaterThanOrEqual(3)
    expect(voices.filter((v) => v.gender === 'male').length).toBeGreaterThanOrEqual(2)
    for (const v of voices) {
      expect(v.code).toMatch(v.gender === 'female' ? /^P\d$/ : /^L\d$/)
    }
  })
})

describe('manifest.json (when generated)', () => {
  it.skipIf(!existsSync(MANIFEST))('every ok voice has all items and real mp3 files', () => {
    const m = JSON.parse(readFileSync(MANIFEST, 'utf8'))
    expect(m.version).toBe(1)
    expect(m.items.map((i: Item) => i.id)).toEqual(samples.items.map((i) => i.id))
    expect(m.voices.length).toBeGreaterThan(0)
    for (const v of m.voices) {
      expect(['ok', 'skipped']).toContain(v.status)
      if (v.status === 'skipped') {
        expect(v.reason, v.code).toBeTruthy()
        continue
      }
      for (const it of samples.items) {
        const f = v.files[it.id]
        expect(f, `${v.code}/${it.id}`).toBeDefined()
        const p = new URL(f.path, SAMPLES_DIR)
        expect(existsSync(p), f.path).toBe(true)
        expect(statSync(p).size, f.path).toBeGreaterThan(1024)
        expect(typeof f.whisperOk).toBe('boolean')
      }
    }
    const ok = m.voices.filter((v: { status: string }) => v.status === 'ok')
    expect(ok.filter((v: { gender: string }) => v.gender === 'female').length).toBeGreaterThanOrEqual(3)
    expect(ok.filter((v: { gender: string }) => v.gender === 'male').length).toBeGreaterThanOrEqual(2)
  })
})
