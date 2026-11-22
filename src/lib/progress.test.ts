import { describe, expect, it } from 'vitest'
import {
  doneCount,
  emptyProgress,
  isUnitUnlocked,
  normalizeProgress,
  recordSkipResult,
  recordUnitResult,
  starsFor,
  suggestedUnit,
  unitStatus,
  type Progress,
} from './progress'

const units = Array.from({ length: 5 }, (_, i) => ({ id: `u0${i + 1}`, order: i + 1 }))
const now = new Date('2026-11-21T10:00:00Z')

describe('normalizeProgress', () => {
  it.each([null, undefined, 42, 'bukan json', '[1,2]', [], 'null'])('data rusak %j -> kosong', (raw) => {
    expect(normalizeProgress(raw)).toEqual(emptyProgress())
  })

  it('memulihkan per kolom', () => {
    const p = normalizeProgress({
      version: 9,
      units: {
        u01: { bestScore: 0.95, stars: 1, completedAt: '2026-01-01T00:00:00Z' },
        u02: { bestScore: 'tinggi', stars: 3 },
        u03: { bestScore: 7 },
        u04: 'x',
        'BAD ID': { bestScore: 1 },
        __proto__: { bestScore: 1 },
      },
      skipUnlockedThrough: 'lima',
    })
    expect(p).toEqual({
      version: 1,
      units: {
        u01: { bestScore: 0.95, stars: 3, completedAt: '2026-01-01T00:00:00Z' },
        u02: { bestScore: 0, stars: 0 },
        u03: { bestScore: 1, stars: 3 },
      },
    })
  })

  it('units salah tipe, skip valid', () => {
    expect(normalizeProgress('{"units":[1],"skipUnlockedThrough":3}')).toEqual({ version: 1, units: {}, skipUnlockedThrough: 3 })
    expect(normalizeProgress({ skipUnlockedThrough: 2.5 }).skipUnlockedThrough).toBeUndefined()
    expect(normalizeProgress({ skipUnlockedThrough: -1 }).skipUnlockedThrough).toBeUndefined()
  })

  it('unit tak dikenal dibuang bila daftar diberikan', () => {
    const p = normalizeProgress({ units: { u01: { bestScore: 1 }, u99: { bestScore: 1 } } }, ['u01'])
    expect(Object.keys(p.units)).toEqual(['u01'])
  })

  it('bolak-balik JSON tetap sama', () => {
    const p = recordUnitResult(emptyProgress(), 'u01', 0.8, now)
    expect(normalizeProgress(JSON.stringify(p))).toEqual(p)
  })
})

describe('starsFor', () => {
  it.each([
    [1, 3],
    [0.9, 3],
    [0.89, 2],
    [0.75, 2],
    [0.74, 1],
    [0.6, 1],
    [0.59, 0],
    [0, 0],
  ])('%f -> %i', (s, n) => expect(starsFor(s)).toBe(n))
})

describe('aturan buka unit', () => {
  it('unit 1 selalu terbuka, unit 2 terkunci di awal', () => {
    const p = emptyProgress()
    expect(isUnitUnlocked(units[0], units, p)).toBe(true)
    expect(unitStatus(units[0], units, p)).toBe('open')
    expect(unitStatus(units[1], units, p)).toBe('locked')
    expect(suggestedUnit(units, p)?.id).toBe('u01')
  })

  it('unit 1 selesai (>= 1 bintang) membuka unit 2', () => {
    const p = recordUnitResult(emptyProgress(), 'u01', 7 / 12, now)
    expect(unitStatus(units[0], units, p)).toBe('open')
    expect(unitStatus(units[1], units, p)).toBe('locked')
    const q = recordUnitResult(p, 'u01', 8 / 12, now)
    expect(unitStatus(units[0], units, q)).toBe('done')
    expect(unitStatus(units[1], units, q)).toBe('open')
    expect(unitStatus(units[2], units, q)).toBe('locked')
    expect(suggestedUnit(units, q)?.id).toBe('u02')
    expect(doneCount(units, q)).toBe(1)
  })

  it('skipUnlockedThrough membuka sampai N', () => {
    const p: Progress = { version: 1, units: {}, skipUnlockedThrough: 3 }
    expect(units.map((u) => unitStatus(u, units, p))).toEqual(['open', 'open', 'open', 'locked', 'locked'])
  })
})

describe('recordUnitResult', () => {
  it('nilai terbaik tidak turun', () => {
    const a = recordUnitResult(emptyProgress(), 'u01', 1, now)
    expect(a.units.u01).toEqual({ bestScore: 1, stars: 3, completedAt: now.toISOString() })
    const b = recordUnitResult(a, 'u01', 0.5, new Date('2026-12-01T00:00:00Z'))
    expect(b).toBe(a)
  })

  it('nilai 0 bintang tidak memberi completedAt; naik kemudian memberi', () => {
    const a = recordUnitResult(emptyProgress(), 'u01', 0.3, now)
    expect(a.units.u01).toEqual({ bestScore: 0.3, stars: 0 })
    const later = new Date('2026-11-22T00:00:00Z')
    const b = recordUnitResult(a, 'u01', 0.7, later)
    expect(b.units.u01).toEqual({ bestScore: 0.7, stars: 1, completedAt: later.toISOString() })
    const c = recordUnitResult(b, 'u01', 0.95, new Date('2026-11-23T00:00:00Z'))
    expect(c.units.u01.completedAt).toBe(later.toISOString())
  })
})

describe('recordSkipResult', () => {
  it('< 0.8 tidak mengubah apa pun', () => {
    const p = emptyProgress()
    expect(recordSkipResult(p, 3, 0.79)).toBe(p)
    expect(recordSkipResult(p, 3, Number.NaN)).toBe(p)
  })

  it('>= 0.8 membuka sampai N, tanpa bintang', () => {
    const p = recordSkipResult(emptyProgress(), 3, 0.8)
    expect(p.skipUnlockedThrough).toBe(3)
    expect(p.units).toEqual({})
    expect(units.map((u) => unitStatus(u, units, p))).toEqual(['open', 'open', 'open', 'locked', 'locked'])
    expect(suggestedUnit(units, p)?.id).toBe('u03')
    const q = recordUnitResult(p, 'u03', 1, now)
    expect(suggestedUnit(units, q)?.id).toBe('u04')
  })

  it('tidak menurunkan skip yang sudah lebih jauh', () => {
    const p = recordSkipResult(emptyProgress(), 5, 1)
    expect(recordSkipResult(p, 3, 1)).toBe(p)
  })
})

describe('progres lama dengan unit / kata yang sudah tidak ada (task 2b: HSK 1 jadi 300 kata)', () => {
  // Progres yang disimpan sebelum silabus 2025: unit u06..u20 dan id kata L1-0xxx yang kini ada di unit lain atau di pratinjau HSK 2.
  const old = {
    version: 1,
    units: { u01: { bestScore: 0.9 }, u02: { bestScore: 0.7 }, u20: { bestScore: 1 }, u45: { bestScore: 1 }, 'L1-0436': { bestScore: 1 } },
    skipUnlockedThrough: 99,
    words: { 'L1-0436': { box: 3, due: '2026-12-01' }, 'L1-0001': { box: 1 } },
    streak: 4,
  }

  it('dibaca tanpa error; kolom yang belum dikenal dan id aneh diabaikan', () => {
    expect(() => normalizeProgress(JSON.stringify(old))).not.toThrow()
    const p = normalizeProgress(JSON.stringify(old))
    expect(Object.keys(p.units).sort()).toEqual(['u01', 'u02', 'u20', 'u45'])
    expect(p).not.toHaveProperty('words')
  })

  it('unit di luar daftar yang sekarang dibuang bila daftar diberikan', () => {
    const ids = units.map((u) => u.id)
    const p = normalizeProgress(old, ids)
    expect(Object.keys(p.units).sort()).toEqual(['u01', 'u02'])
  })

  it('aturan buka unit dan unit yang disarankan tetap jalan untuk daftar unit yang sekarang', () => {
    const p = normalizeProgress(old)
    expect(units.map((u) => unitStatus(u, units, p))).toEqual(['done', 'done', 'open', 'open', 'open'])
    expect(doneCount(units, p)).toBe(2)
    expect(suggestedUnit(units, p)?.id).toBeDefined()
    const q = normalizeProgress({ units: { u20: { bestScore: 1 } } })
    expect(doneCount(units, q)).toBe(0)
    expect(unitStatus(units[0], units, q)).toBe('open')
  })

  it('hasil latihan baru tetap bisa disimpan di atas progres lama', () => {
    const p = recordUnitResult(normalizeProgress(old), 'u03', 0.8, now)
    expect(p.units.u03.stars).toBe(2)
    expect(p.units.u45.stars).toBe(3)
  })
})
