import { describe, expect, it } from 'vitest'
import { learnHref, parseHash, parseLearnRoute, parseReviewRoute } from './router'

describe('parseHash', () => {
  it.each(['', '#', '#/', '/', '#//'])('kosong %j -> belajar', (h) => {
    expect(parseHash(h)).toEqual({ name: 'belajar', params: {}, segments: [] })
  })

  it.each(['belajar', 'ulang', 'kamus', 'progres', 'pengaturan'])('rute %s', (n) => {
    expect(parseHash(`#/${n}`).name).toBe(n)
    expect(parseHash(`#${n}`).name).toBe(n)
  })

  it('rute tak dikenal', () => {
    expect(parseHash('#/xyz')).toEqual({ name: 'notfound', params: {}, segments: ['xyz'] })
  })

  it('garis miring berlebih', () => {
    expect(parseHash('#//kamus//').name).toBe('kamus')
    expect(parseHash('#///ulang///x//').segments).toEqual(['x'])
  })

  it('segmen bertingkat', () => {
    expect(parseHash('#/belajar/unit/3')).toEqual({
      name: 'belajar',
      params: {},
      segments: ['unit', '3'],
    })
  })

  it('parameter query', () => {
    expect(parseHash('#/kamus?q=ni%20hao&x=1')).toEqual({
      name: 'kamus',
      params: { q: 'ni hao', x: '1' },
      segments: [],
    })
  })

  it('huruf besar dan encoding rusak tidak melempar', () => {
    expect(parseHash('#/KAMUS').name).toBe('kamus')
    expect(parseHash('#/kamus/%E0%A4%A').segments).toEqual(['%E0%A4%A'])
  })
})

describe('parseLearnRoute', () => {
  const learn = (h: string) => parseLearnRoute(parseHash(h).segments)

  it('peta', () => {
    expect(learn('#/belajar')).toEqual({ screen: 'map' })
    expect(learn('#/belajar/')).toEqual({ screen: 'map' })
  })

  it('ringkasan unit, kenalan kata, latihan, tes loncat', () => {
    expect(learn('#/belajar/unit/u03')).toEqual({ screen: 'unit', unitId: 'u03' })
    expect(learn('#/belajar/unit/u03/kata/2')).toEqual({ screen: 'word', unitId: 'u03', index: 2 })
    expect(learn('#/belajar/unit/u03/latihan')).toEqual({ screen: 'practice', unitId: 'u03' })
    expect(learn('#/belajar/loncat/u05')).toEqual({ screen: 'skip', unitId: 'u05' })
  })

  it('garis miring berlebih dan huruf besar', () => {
    expect(learn('#//belajar//unit//u03//kata//2//')).toEqual({ screen: 'word', unitId: 'u03', index: 2 })
    expect(learn('#/Belajar/UNIT/U03/Latihan')).toEqual({ screen: 'practice', unitId: 'u03' })
  })

  it.each([
    '#/belajar/unit',
    '#/belajar/unit/u03/kata',
    '#/belajar/unit/u03/kata/0',
    '#/belajar/unit/u03/kata/abc',
    '#/belajar/unit/u03/kata/1/x',
    '#/belajar/unit/u03/lain',
    '#/belajar/loncat',
    '#/belajar/loncat/u03/x',
    '#/belajar/xyz',
    '#/belajar/unit/%3Cscript%3E',
  ])('tidak dikenal %s', (h) => {
    expect(learn(h)).toEqual({ screen: 'notfound' })
  })

  it('learnHref kebalikan dari parse', () => {
    const routes = [
      { screen: 'map' },
      { screen: 'unit', unitId: 'u01' },
      { screen: 'word', unitId: 'u01', index: 3 },
      { screen: 'practice', unitId: 'u01' },
      { screen: 'skip', unitId: 'u04' },
    ] as const
    for (const r of routes) expect(learn(learnHref(r))).toEqual(r)
  })
})

describe('parseReviewRoute', () => {
  it('beranda, sesi, dan sisanya tidak ditemukan', () => {
    expect(parseReviewRoute([])).toEqual({ screen: 'home' })
    expect(parseReviewRoute(['sesi'])).toEqual({ screen: 'session' })
    expect(parseReviewRoute(['SESI'])).toEqual({ screen: 'session' })
    expect(parseReviewRoute(['sesi', 'x'])).toEqual({ screen: 'notfound' })
    expect(parseReviewRoute(['x'])).toEqual({ screen: 'notfound' })
  })
  it('dari hash', () => {
    expect(parseReviewRoute(parseHash('#/ulang/sesi').segments)).toEqual({ screen: 'session' })
    expect(parseReviewRoute(parseHash('#/ulang').segments)).toEqual({ screen: 'home' })
  })
})

describe('parseLearnRoute · Tahap 0 (dasar)', () => {
  const learn = (h: string) => parseLearnRoute(parseHash(h).segments)
  it('ringkasan, bagian, latihan', () => {
    expect(learn('#/belajar/dasar')).toEqual({ screen: 'basics' })
    expect(learn('#/belajar/dasar/')).toEqual({ screen: 'basics' })
    for (const part of ['pinyin', 'nada', 'perubahan-nada', 'coretan', 'radikal', 'ungkapan'] as const) {
      expect(learn(`#/belajar/dasar/${part}`)).toEqual({ screen: 'basics-part', part })
      expect(learn(`#/belajar/dasar/${part}/latihan`)).toEqual({ screen: 'basics-practice', part })
    }
    expect(learn('#/belajar/DASAR/Nada')).toEqual({ screen: 'basics-part', part: 'nada' })
  })
  it.each(['#/belajar/dasar/xyz', '#/belajar/dasar/nada/x', '#/belajar/dasar/nada/latihan/2', '#/belajar/dasar/%3Cb%3E'])('tidak dikenal %s', (h) => {
    expect(learn(h)).toEqual({ screen: 'notfound' })
  })
  it('learnHref kebalikan dari parse', () => {
    const routes = [{ screen: 'basics' }, { screen: 'basics-part', part: 'coretan' }, { screen: 'basics-practice', part: 'ungkapan' }] as const
    for (const r of routes) expect(learn(learnHref(r))).toEqual(r)
  })
})
