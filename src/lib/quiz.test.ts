import { describe, expect, it } from 'vitest'
import unitsFile from '../../data/hsk1/units.json'
import wordsFile from '../../data/hsk1/words.json'
import { syllableTone } from './pinyin'
import {
  buildReviewQuiz,
  buildSkipQuiz,
  buildUnitQuiz,
  cleanEn,
  meaningShort,
  mulberry32,
  QUESTION_KINDS,
  toneMark,
  type Question,
  type QuizWord,
} from './quiz'

const byId = new Map<string, QuizWord>(wordsFile.map((w) => [w.id, w]))
const unitWords = unitsFile.units.map((u) => u.words.map((id) => byId.get(id)!))

function check(q: Question, pool: Map<string, QuizWord>) {
  const word = pool.get(q.wordId)!
  expect(q.choices.length).toBeGreaterThanOrEqual(3)
  expect(q.choices.length).toBeLessThanOrEqual(4)
  expect(q.answer).toBeGreaterThanOrEqual(0)
  expect(q.answer).toBeLessThan(q.choices.length)
  if (q.kind === 'tone') {
    expect(q.choices).toHaveLength(4)
    const tone = syllableTone(word.syllables[q.syllable!])
    expect(tone).toBeGreaterThanOrEqual(1)
    expect(tone).toBeLessThanOrEqual(4)
    const right = q.choices.filter((c) => c.type === 'tone' && c.tone === tone)
    expect(right).toHaveLength(1)
    expect(q.choices[q.answer]).toBe(right[0])
    expect(new Set(q.choices.map((c) => (c.type === 'tone' ? c.text : ''))).size).toBe(4)
    return
  }
  const ws = q.choices.map((c) => (c.type === 'word' ? pool.get(c.wordId)! : undefined))
  expect(ws.every(Boolean)).toBe(true)
  expect(ws.filter((w) => w!.id === q.wordId)).toHaveLength(1)
  expect(ws[q.answer]!.id).toBe(q.wordId)
  expect(new Set(ws.map((w) => w!.hanzi)).size).toBe(ws.length)
  for (const lang of ['id', 'en'] as const) {
    expect(new Set(ws.map((w) => meaningShort(w!, lang).toLowerCase())).size, `${q.wordId} ${lang}`).toBe(ws.length)
  }
  if (q.kind === 'audio-hanzi') {
    const others = ws.filter((w) => w!.id !== q.wordId).map((w) => w!.pinyin.replace(/\s/g, ''))
    expect(others).not.toContain(word.pinyin.replace(/\s/g, ''))
  }
}

describe('toneMark', () => {
  it.each([
    ['nv3', 3, 'nǚ'],
    ['nü', 3, 'nǚ'],
    ['lve4', 4, 'lüè'],
    ['lüe', 4, 'lüè'],
    ['gui3', 3, 'guǐ'],
    ['liu2', 2, 'liú'],
    ['er2', 2, 'ér'],
    ['er', 4, 'èr'],
    ['hao', 3, 'hǎo'],
    ['dou', 1, 'dōu'],
    ['ma', 5, 'ma'],
    ['mǎ', 1, 'mā'],
  ] as const)('%s nada %i -> %s', (s, t, want) => {
    expect(toneMark(s, t)).toBe(want)
  })
})

describe('meaningShort / cleanEn', () => {
  it('membersihkan notasi CC-CEDICT', () => {
    expect(cleanEn('you (informal, as opposed to courteous 您[nin2])')).toBe('you (informal, as opposed to courteous 您)')
    expect(cleanEn('variant of 你|您[ni3]')).toBe('variant of 你')
  })
  it('mengambil arti pertama', () => {
    const w = { en: ['to love; to be fond of; to like'], ind: ['cinta', 'mencintai', 'menyukai'] }
    expect(meaningShort(w, 'id')).toBe('cinta, mencintai')
    expect(meaningShort(w, 'en')).toBe('to love; to be fond of')
  })
})

describe('mulberry32', () => {
  it('deterministik', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    for (let i = 0; i < 5; i++) expect(a()).toBe(b())
  })
})

describe('buildUnitQuiz', () => {
  it('deterministik dengan seed sama', () => {
    expect(buildUnitQuiz(unitWords[0], { seed: 7, audio: true })).toEqual(buildUnitQuiz(unitWords[0], { seed: 7, audio: true }))
    expect(buildUnitQuiz(unitWords[0], { seed: 7, audio: true })).not.toEqual(buildUnitQuiz(unitWords[0], { seed: 8, audio: true }))
  })

  it.each(unitsFile.units.map((u, i) => [u.id, i] as const))('%s: 12 soal valid, semua jenis muncul', (_id, i) => {
    const pool = new Map(unitWords[i].map((w) => [w.id, w]))
    for (const seed of [1, 2, 3, 99]) {
      for (const audio of [true, false]) {
        const qs = buildUnitQuiz(unitWords[i], { seed, audio })
        expect(qs).toHaveLength(12)
        expect(new Set(qs.map((q) => q.wordId)).size).toBe(12)
        const kinds = new Set(qs.map((q) => q.kind))
        const want = audio ? QUESTION_KINDS : QUESTION_KINDS.filter((k) => k !== 'audio-hanzi')
        expect([...kinds].sort()).toEqual([...want].sort())
        for (const q of qs) check(q, pool)
      }
    }
  })

  it('posisi jawaban teracak (soal kata)', () => {
    const qs = [1, 2, 3, 4, 5].flatMap((seed) => buildUnitQuiz(unitWords[2], { seed, audio: true }))
    const positions = new Set(qs.filter((q) => q.kind !== 'tone').map((q) => q.answer))
    expect(positions.size).toBe(4)
  })

  it('unit kecil: minimal 3 pilihan', () => {
    const small = unitWords[0].slice(0, 3)
    const qs = buildUnitQuiz(small, { seed: 1, audio: true })
    expect(qs).toHaveLength(3)
    for (const q of qs) check(q, new Map(small.map((w) => [w.id, w])))
  })
})

describe('buildSkipQuiz', () => {
  it.each([2, 3, 10, 20])('ke unit %i: 15 soal hanya dari unit sebelumnya', (n) => {
    const groups = unitWords.slice(0, n - 1)
    const allowed = new Map(groups.flat().map((w) => [w.id, w]))
    const qs = buildSkipQuiz(groups, { seed: n, audio: true })
    expect(qs).toHaveLength(15)
    for (const q of qs) {
      expect(allowed.has(q.wordId)).toBe(true)
      check(q, allowed)
      // pengecoh dari unit yang sama dengan jawaban
      if (q.kind !== 'tone') {
        const g = groups.find((x) => x.some((w) => w.id === q.wordId))!
        for (const c of q.choices) if (c.type === 'word') expect(g.some((w) => w.id === c.wordId)).toBe(true)
      }
    }
    expect(new Set(qs.map((q) => q.kind)).size).toBeGreaterThanOrEqual(3)
  })
})

describe('buildReviewQuiz', () => {
  const asked = [unitWords[2][0], unitWords[0][1], unitWords[1][2], unitWords[0][3], unitWords[2][4]]
  it('satu soal per kata, urutan sesuai input, pilihan valid', () => {
    for (const audio of [true, false]) {
      const qs = buildReviewQuiz(asked, unitWords, { seed: 7, audio })
      expect(qs.map((q) => q.wordId)).toEqual(asked.map((w) => w.id))
      for (const q of qs) {
        check(q, byId)
        if (!audio) expect(q.kind).not.toBe('audio-hanzi')
      }
    }
  })
  it('kata kembar di masukan dibuang', () => {
    const qs = buildReviewQuiz([asked[0], asked[1], asked[0]], unitWords, { seed: 1, audio: true })
    expect(qs.map((q) => q.wordId)).toEqual([asked[0].id, asked[1].id])
  })
  it('pengecoh dari unit kata itu', () => {
    const qs = buildReviewQuiz(asked, unitWords, { seed: 3, audio: true })
    for (const q of qs) {
      const group = unitWords.find((g) => g.some((w) => w.id === q.wordId))!
      const ids = new Set(group.map((w) => w.id))
      for (const c of q.choices) if (c.type === 'word') expect(ids.has(c.wordId)).toBe(true)
    }
  })
  it('deterministik dengan seed, kosong -> kosong', () => {
    expect(buildReviewQuiz(asked, unitWords, { seed: 5, audio: true })).toEqual(buildReviewQuiz(asked, unitWords, { seed: 5, audio: true }))
    expect(buildReviewQuiz([], unitWords, { seed: 5, audio: true })).toEqual([])
  })
  it('semua kata dari satu daftar (tanpa unit lain) tetap menghasilkan soal valid', () => {
    const all = unitWords.flat()
    const qs = buildReviewQuiz(all.slice(0, 20), [all], { seed: 9, audio: true })
    expect(qs).toHaveLength(20)
    qs.forEach((q) => check(q, byId))
  })
})
