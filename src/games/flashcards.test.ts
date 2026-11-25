import { describe, expect, it } from 'vitest'
import { againIds, againRound, createDeck, currentCard, deckDone, flashStars, flashSummary, markCard, roundOver } from './flashcards'
import { UNITS } from './testdata'

const ids = UNITS[0].words.map((w) => w.id)

describe('kartu bolak-balik', () => {
  it('dek = semua kata unit, acak, semua belum', () => {
    const s = createDeck(ids, 1)
    expect([...s.queue].sort()).toEqual([...ids].sort())
    expect(s.queue).not.toEqual(ids)
    expect(Object.values(s.status).every((v) => v === 'belum')).toBe(true)
    expect(currentCard(s)).toBe(s.queue[0])
  })

  it('semua tahu -> selesai, 3 bintang', () => {
    let s = createDeck(ids, 2)
    while (!roundOver(s)) s = markCard(s, true)
    expect(deckDone(s)).toBe(true)
    expect(currentCard(s)).toBeNull()
    const sum = flashSummary(s)
    expect(sum).toMatchObject({ total: ids.length, firstTry: ids.length, repeated: 0, known: ids.length, again: 0 })
    expect(flashStars(sum)).toBe(3)
  })

  it('"Ulang lagi" hanya kartu ulang; selesai bila semua tahu', () => {
    let s = createDeck(ids, 3)
    const missed: string[] = []
    let i = 0
    while (!roundOver(s)) {
      const id = currentCard(s)!
      const known = i++ % 2 === 0
      if (!known) missed.push(id)
      s = markCard(s, known)
    }
    expect(deckDone(s)).toBe(false)
    expect(againIds(s).sort()).toEqual([...missed].sort())
    s = againRound(s)
    expect(s.round).toBe(2)
    expect([...s.queue].sort()).toEqual([...missed].sort())
    // Satu kartu salah lagi, sisanya tahu.
    s = markCard(s, false)
    while (!roundOver(s)) s = markCard(s, true)
    expect(againIds(s)).toHaveLength(1)
    s = againRound(s)
    s = markCard(s, true)
    expect(deckDone(s)).toBe(true)
    const sum = flashSummary(s)
    expect(sum.repeated).toBe(missed.length)
    expect(sum.firstTry).toBe(ids.length - missed.length)
    expect(flashStars(sum)).toBe(2)
  })

  it('aturan bintang', () => {
    expect(flashStars({ total: 10, firstTry: 8, repeated: 2, known: 10, again: 0 })).toBe(3)
    expect(flashStars({ total: 10, firstTry: 5, repeated: 5, known: 10, again: 0 })).toBe(2)
    expect(flashStars({ total: 10, firstTry: 4, repeated: 6, known: 10, again: 0 })).toBe(1)
    expect(flashStars({ total: 0, firstTry: 0, repeated: 0, known: 0, again: 0 })).toBe(0)
  })

  it('buat ulang -> state awal (tidak ada sisa)', () => {
    let s = createDeck(ids, 4)
    s = markCard(markCard(s, false), true)
    const fresh = createDeck(ids, 4)
    expect(fresh.pos).toBe(0)
    expect(fresh.missed).toEqual([])
    expect(Object.values(fresh.status).every((v) => v === 'belum')).toBe(true)
    expect(s.pos).toBe(2)
  })

  it('data kecil: 3 kata, id kembar dibuang; dek kosong tidak pernah selesai', () => {
    let s = createDeck(['a', 'b', 'c', 'a'], 5)
    expect(s.queue).toHaveLength(3)
    s = markCard(markCard(markCard(s, true), true), true)
    expect(deckDone(s)).toBe(true)
    expect(markCard(s, false)).toBe(s)
    const empty = createDeck([], 1)
    expect(deckDone(empty)).toBe(false)
    expect(againRound(empty)).toBe(empty)
  })
})
