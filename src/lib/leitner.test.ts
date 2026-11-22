import { describe, expect, it } from 'vitest'
import {
  boxCounts,
  bumpStreak,
  currentStreak,
  dueWords,
  isMastered,
  nextDueDay,
  normalizeEntry,
  recordAnswer,
  recordAnswers,
  todayCount,
  trackedCount,
  type LeitnerEntry,
} from './leitner'
import { addDays } from './dates'
import { emptyProgress, type Progress } from './progress'

const D0 = '2026-11-20'
const withWords = (words: Record<string, LeitnerEntry>): Progress => ({ ...emptyProgress(), words })
const e = (box: LeitnerEntry['box'], due: string, extra: Partial<LeitnerEntry> = {}): LeitnerEntry => ({ box, due, seen: 1, wrong: 0, ...extra })

describe('recordAnswer', () => {
  it('kata baru benar -> kotak 2, due +2', () => {
    const p = recordAnswer(emptyProgress(), 'a', true, D0, 'practice')
    expect(p.words!.a).toEqual({ box: 2, due: '2026-11-22', seen: 1, wrong: 0, last: D0 })
  })
  it('kata baru salah -> kotak 1, due +1, wrong +1', () => {
    const p = recordAnswer(emptyProgress(), 'a', false, D0, 'skip')
    expect(p.words!.a).toEqual({ box: 1, due: '2026-11-21', seen: 1, wrong: 1, last: D0 })
  })
  it('jatuh tempo: benar naik satu kotak, salah kembali ke kotak 1', () => {
    const p = withWords({ a: e(2, D0), b: e(3, '2026-11-01') })
    const r1 = recordAnswer(p, 'a', true, D0, 'practice')
    expect(r1.words!.a).toMatchObject({ box: 3, due: addDays(D0, 4), seen: 2 })
    const r2 = recordAnswer(p, 'b', false, D0, 'practice')
    expect(r2.words!.b).toMatchObject({ box: 1, due: addDays(D0, 1), wrong: 1 })
  })
  it('kotak 5 tetap kotak 5 (maks)', () => {
    const p = recordAnswer(withWords({ a: e(5, D0) }), 'a', true, D0, 'review')
    expect(p.words!.a).toMatchObject({ box: 5, due: addDays(D0, 16) })
  })
  it('belum jatuh tempo, bukan ulangan: benar tidak mengubah kotak/due, tetap seen+1 dan last', () => {
    const before = e(3, '2026-11-25', { seen: 4, wrong: 1, last: '2026-11-18' })
    const p = recordAnswer(withWords({ a: before }), 'a', true, D0, 'practice')
    expect(p.words!.a).toEqual({ box: 3, due: '2026-11-25', seen: 5, wrong: 1, last: D0 })
  })
  it('belum jatuh tempo, bukan ulangan: salah -> kotak 1 besok', () => {
    const p = recordAnswer(withWords({ a: e(4, '2026-12-30') }), 'a', false, D0, 'skip')
    expect(p.words!.a).toMatchObject({ box: 1, due: '2026-11-21', wrong: 1 })
  })
  it('source review menaikkan kotak walau belum jatuh tempo', () => {
    const p = recordAnswer(withWords({ a: e(2, '2026-12-30') }), 'a', true, D0, 'review')
    expect(p.words!.a).toMatchObject({ box: 3, due: addDays(D0, 4) })
  })
  it('jawaban benar kedua di hari yang sama tidak menaikkan kotak lagi', () => {
    let p = withWords({ a: e(1, D0) })
    p = recordAnswer(p, 'a', true, D0, 'practice')
    expect(p.words!.a.box).toBe(2)
    p = recordAnswer(p, 'a', true, D0, 'practice')
    expect(p.words!.a).toMatchObject({ box: 2, due: addDays(D0, 2), seen: 3 })
  })
  it('salah lalu benar di hari yang sama: tetap kotak 1', () => {
    let p = recordAnswer(emptyProgress(), 'a', false, D0, 'practice')
    p = recordAnswer(p, 'a', true, D0, 'practice')
    expect(p.words!.a).toMatchObject({ box: 1, due: addDays(D0, 1), seen: 2, wrong: 1 })
  })
  it('tidak mengubah data masukan', () => {
    const p = withWords({ a: e(1, D0) })
    const copy = JSON.stringify(p)
    recordAnswer(p, 'a', true, D0, 'practice')
    expect(JSON.stringify(p)).toBe(copy)
  })

  it('jadwal: benar terus dari kotak 1 -> jatuh tempo +2, +4, +8, +16, +16', () => {
    let day = D0
    let p = emptyProgress()
    const gaps: number[] = []
    const boxes: number[] = []
    p = recordAnswer(p, 'a', true, day, 'practice')
    for (let i = 0; i < 5; i++) {
      const due = p.words!.a.due
      gaps.push(Math.round((Date.parse(due) - Date.parse(day)) / 86_400_000))
      boxes.push(p.words!.a.box)
      day = due
      p = recordAnswer(p, 'a', true, day, 'review')
    }
    expect(gaps).toEqual([2, 4, 8, 16, 16])
    expect(boxes).toEqual([2, 3, 4, 5, 5])
    expect(p.words!.a.box).toBe(5)
  })
  it('salah di kotak 4 -> kotak 1, besok', () => {
    const p = recordAnswer(withWords({ a: e(4, D0) }), 'a', false, D0, 'review')
    expect(p.words!.a).toMatchObject({ box: 1, due: '2026-11-21' })
  })
})

describe('dueWords', () => {
  const p = withWords({
    z: e(1, '2026-11-19'),
    b: e(1, '2026-11-19'),
    a: e(1, '2026-11-18'),
    c: e(2, '2026-11-01'),
    d: e(1, D0),
    future: e(1, '2026-11-21'),
    gone: e(1, '2026-11-01'),
  })
  it('kotak terendah, due paling lama, lalu id; due <= hari ini', () => {
    expect(dueWords(p, D0)).toEqual(['gone', 'a', 'b', 'z', 'd', 'c'])
  })
  it('menyaring knownIds', () => {
    expect(dueWords(p, D0, new Set(['a', 'c', 'future', 'nope']))).toEqual(['a', 'c'])
  })
  it('kosong bila belum ada kata', () => {
    expect(dueWords(emptyProgress(), D0)).toEqual([])
  })
})

describe('isMastered / boxCounts / nextDueDay / trackedCount', () => {
  it('kotak >= 4 dikuasai', () => {
    expect(isMastered(e(3, D0))).toBe(false)
    expect(isMastered(e(4, D0))).toBe(true)
    expect(isMastered(e(5, D0))).toBe(true)
  })
  const p = withWords({ a: e(1, '2026-12-01'), b: e(1, '2026-11-30'), c: e(4, '2026-12-09'), d: e(5, '2026-12-20') })
  it('boxCounts', () => {
    expect(boxCounts(p)).toEqual([2, 0, 0, 1, 1])
    expect(boxCounts(p, new Set(['a', 'd']))).toEqual([1, 0, 0, 0, 1])
    expect(boxCounts(emptyProgress())).toEqual([0, 0, 0, 0, 0])
  })
  it('nextDueDay & trackedCount', () => {
    expect(nextDueDay(p)).toBe('2026-11-30')
    expect(nextDueDay(p, new Set(['c', 'd']))).toBe('2026-12-09')
    expect(nextDueDay(emptyProgress())).toBeUndefined()
    expect(trackedCount(p, new Set(['a', 'x']))).toBe(1)
  })
})

describe('streak', () => {
  it('pertama kali -> 1', () => {
    expect(bumpStreak(undefined, D0)).toEqual({ last: D0, current: 1, best: 1 })
  })
  it('kemarin -> +1 dan best ikut naik', () => {
    expect(bumpStreak({ last: '2026-11-19', current: 3, best: 3 }, D0)).toEqual({ last: D0, current: 4, best: 4 })
  })
  it('hari ini -> tetap', () => {
    const s = { last: D0, current: 3, best: 7 }
    expect(bumpStreak(s, D0)).toBe(s)
  })
  it('bolong 2 hari -> kembali 1, best tetap', () => {
    expect(bumpStreak({ last: '2026-11-18', current: 5, best: 5 }, D0)).toEqual({ last: D0, current: 1, best: 5 })
  })
  it('jam mundur: tidak error dan tidak menaikkan', () => {
    const s = { last: '2026-11-25', current: 4, best: 4 }
    expect(bumpStreak(s, D0)).toBe(s)
  })
  it('lintas tahun', () => {
    expect(bumpStreak({ last: '2026-12-31', current: 2, best: 2 }, '2027-01-01').current).toBe(3)
  })
  it('currentStreak: 0 bila lebih tua dari kemarin, tanpa mengubah data', () => {
    const p: Progress = { ...emptyProgress(), streak: { last: '2026-11-18', current: 5, best: 9 } }
    const copy = JSON.stringify(p)
    expect(currentStreak(p, D0)).toBe(0)
    expect(currentStreak(p, '2026-11-19')).toBe(5)
    expect(currentStreak(p, '2026-11-18')).toBe(5)
    expect(currentStreak(emptyProgress(), D0)).toBe(0)
    expect(JSON.stringify(p)).toBe(copy)
  })
  it('currentStreak saat jam mundur tidak error', () => {
    const p: Progress = { ...emptyProgress(), streak: { last: '2026-11-25', current: 5, best: 5 } }
    expect(currentStreak(p, D0)).toBe(5)
  })
})

describe('recordAnswers', () => {
  const answers = [
    { wordId: 'a', correct: true },
    { wordId: 'b', correct: false },
  ]
  it('Leitner, daftar hari ini, dan streak berubah bersama', () => {
    const p = recordAnswers(emptyProgress(), answers, D0, 'practice')
    expect(Object.keys(p.words!)).toEqual(['a', 'b'])
    expect(p.today).toEqual({ day: D0, words: ['a', 'b'] })
    expect(p.streak).toEqual({ last: D0, current: 1, best: 1 })
    expect(todayCount(p, D0)).toBe(2)
  })
  it('tanpa jawaban: tidak ada yang berubah', () => {
    const p = emptyProgress()
    expect(recordAnswers(p, [], D0, 'review')).toBe(p)
  })
  it('kata unik di daftar hari ini; sesi kedua di hari yang sama menambah', () => {
    let p = recordAnswers(emptyProgress(), answers, D0, 'practice')
    p = recordAnswers(p, [{ wordId: 'a', correct: true }, { wordId: 'c', correct: true }], D0, 'skip')
    expect(p.today!.words).toEqual(['a', 'b', 'c'])
    expect(p.streak!.current).toBe(1)
  })
  it('todayCount: ganti hari -> 0 dan daftar dikosongkan saat jawaban berikutnya', () => {
    let p = recordAnswers(emptyProgress(), answers, D0, 'practice')
    expect(todayCount(p, '2026-11-21')).toBe(0)
    p = recordAnswers(p, [{ wordId: 'a', correct: true }], '2026-11-21', 'practice')
    expect(p.today).toEqual({ day: '2026-11-21', words: ['a'] })
    expect(p.streak).toEqual({ last: '2026-11-21', current: 2, best: 2 })
  })
  it('daftar hari ini dibatasi', () => {
    const many = Array.from({ length: 700 }, (_, i) => ({ wordId: `w${i}`, correct: true }))
    expect(recordAnswers(emptyProgress(), many, D0, 'practice').today!.words).toHaveLength(500)
  })
  it('todayCount tanpa data -> 0', () => {
    expect(todayCount(emptyProgress(), D0)).toBe(0)
  })
})

describe('normalizeEntry', () => {
  it('due rusak + last valid -> dihitung dari last + jarak kotak', () => {
    expect(normalizeEntry({ box: 3, due: 'besok', last: '2026-11-10', seen: 2, wrong: 1 })).toEqual({
      box: 3,
      due: '2026-11-14',
      seen: 2,
      wrong: 1,
      last: '2026-11-10',
    })
  })
  it('due dan last rusak -> dibuang', () => {
    expect(normalizeEntry({ box: 3, due: '2026-02-30' })).toBeNull()
    expect(normalizeEntry(null)).toBeNull()
    expect(normalizeEntry([])).toBeNull()
  })
})
