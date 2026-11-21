import { describe, expect, it } from 'vitest'
import { parseHash } from './router'

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
