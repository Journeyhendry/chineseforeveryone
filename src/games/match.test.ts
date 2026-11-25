import { describe, expect, it } from 'vitest'
import { meaningShort } from '../lib/quiz'
import { buildMatchRound, elapsed, formatTime, matchDone, matchStars, MATCH_PAIRS, selectCard, startMatch, type MatchMode } from './match'
import { ALL_WORDS, UNITS } from './testdata'

const byId = new Map(ALL_WORDS.map((w) => [w.id, w]))
const norm = (s: string) => s.trim().toLowerCase()

describe('ronde jodohkan', () => {
  it.each(['hanzi-meaning', 'audio-hanzi'] as MatchMode[])('semua unit, banyak seed: %s', (mode) => {
    for (const unit of UNITS) {
      const unitIds = new Set(unit.words.map((w) => w.id))
      for (let seed = 1; seed <= 30; seed++) {
        const r = buildMatchRound(unit.words, { mode, seed })
        expect(r.ids.length).toBeLessThanOrEqual(MATCH_PAIRS)
        expect(r.ids.length).toBeGreaterThanOrEqual(Math.min(4, unit.words.length))
        expect(new Set(r.ids).size).toBe(r.ids.length)
        expect(r.ids.every((id) => unitIds.has(id))).toBe(true)
        expect([...r.left].sort()).toEqual([...r.ids].sort())
        expect([...r.right].sort()).toEqual([...r.ids].sort())
        const ws = r.ids.map((id) => byId.get(id)!)
        expect(new Set(ws.map((w) => w.hanzi)).size).toBe(ws.length)
        if (mode === 'hanzi-meaning') {
          expect(new Set(ws.map((w) => norm(meaningShort(w, 'id')))).size).toBe(ws.length)
          expect(new Set(ws.map((w) => norm(meaningShort(w, 'en')))).size).toBe(ws.length)
        } else {
          expect(new Set(ws.map((w) => norm(w.pinyin).replace(/[\s'-]/g, ''))).size).toBe(ws.length)
        }
      }
    }
  })

  it('arti kembar tidak muncul bersamaan', () => {
    const base = UNITS[0].words[0]
    const twin = { ...base, id: 'X-1', hanzi: '甲' }
    const other = { ...UNITS[0].words[1] }
    for (let seed = 1; seed < 20; seed++) {
      const r = buildMatchRound([base, twin, other], { mode: 'hanzi-meaning', seed })
      expect(r.ids.includes(base.id) && r.ids.includes('X-1')).toBe(false)
      expect(r.ids).toHaveLength(2)
    }
  })

  it('homofon / hanzi sama dihindari di mode suara', () => {
    const base = UNITS[0].words[0]
    const homo = { ...base, id: 'X-2', hanzi: '乙', en: ['zzz'], ind: ['zzz'] }
    const same = { ...base, id: 'X-3', pinyin: 'qqq', en: ['yyy'], ind: ['yyy'] }
    for (let seed = 1; seed < 20; seed++) {
      const ids = buildMatchRound([base, homo, same], { mode: 'audio-hanzi', seed }).ids
      expect(ids.includes(base.id) && ids.includes('X-2')).toBe(false)
      expect(ids.includes(base.id) && ids.includes('X-3')).toBe(false)
      expect(buildMatchRound([base, homo], { mode: 'hanzi-meaning', seed }).ids).toHaveLength(2)
    }
  })

  it('data kecil (3 kata) -> 3 pasangan', () => {
    const r = buildMatchRound(UNITS[1].words.slice(0, 3), { mode: 'hanzi-meaning', seed: 7 })
    expect(r.ids).toHaveLength(3)
  })
})

describe('state jodohkan', () => {
  const round = buildMatchRound(UNITS[2].words, { mode: 'hanzi-meaning', seed: 11 })

  it('benar terkunci, salah dihitung dan dilepas, waktu dari pilihan pertama', () => {
    let s = startMatch(round)
    expect(elapsed(s, 5000)).toBe(0)
    const [a, b] = round.ids
    s = selectCard(s, 'left', a, 1000)
    expect(s.startedAt).toBe(1000)
    expect(s.selLeft).toBe(a)
    s = selectCard(s, 'right', b, 2000)
    expect(s.mistakes).toBe(1)
    expect(s.lastWrong).toEqual({ left: a, right: b })
    expect(s.selLeft).toBeNull()
    expect(s.selRight).toBeNull()
    s = selectCard(s, 'right', a, 3000)
    s = selectCard(s, 'left', a, 3500)
    expect(s.matched).toEqual([a])
    // Kartu terkunci tidak bisa dipilih lagi.
    expect(selectCard(s, 'left', a, 3600)).toBe(s)
    // Klik dua kali = batal.
    const t = selectCard(selectCard(s, 'left', b, 3700), 'left', b, 3800)
    expect(t.selLeft).toBeNull()
    let now = 4000
    for (const id of round.ids.slice(1)) {
      s = selectCard(s, 'left', id, now++)
      s = selectCard(s, 'right', id, now++)
    }
    expect(matchDone(s)).toBe(true)
    expect(s.finishedAt).toBe(now - 1)
    expect(elapsed(s, 999999)).toBe(now - 1 - 1000)
    expect(s.mistakes).toBe(1)
    expect(selectCard(s, 'left', a, now)).toBe(s)
  })

  it('id tak dikenal diabaikan; main lagi = state awal', () => {
    const s = startMatch(round)
    expect(selectCard(s, 'left', 'nope', 1)).toBe(s)
    expect(startMatch(round)).toEqual(s)
  })

  it('aturan bintang & format waktu', () => {
    expect(matchStars(36_000, 1, 6)).toBe(3)
    expect(matchStars(36_001, 0, 6)).toBe(2)
    expect(matchStars(20_000, 2, 6)).toBe(2)
    expect(matchStars(72_001, 0, 6)).toBe(1)
    expect(matchStars(10_000, 4, 6)).toBe(1)
    expect(matchStars(1000, 0, 0)).toBe(0)
    expect(formatTime(0)).toBe('00:00')
    expect(formatTime(65_999)).toBe('01:05')
    expect(formatTime(-5)).toBe('00:00')
  })
})
