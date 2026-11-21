import { describe, expect, it } from 'vitest'
import id from './id.json'
import en from './en.json'
import { translate } from './context'

const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()

describe('kamus i18n', () => {
  it('kunci sama persis', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(id).sort())
  })

  it('tidak ada nilai kosong', () => {
    for (const [name, dict] of [['id', id], ['en', en]] as const) {
      for (const [k, v] of Object.entries(dict)) {
        expect(v.trim(), `${name}:${k}`).not.toBe('')
      }
    }
  })

  it('isian {var} sama di kedua bahasa', () => {
    const idd = id as Record<string, string>
    const end = en as Record<string, string>
    for (const k of Object.keys(idd)) expect(vars(end[k]), k).toEqual(vars(idd[k]))
  })
})

describe('translate', () => {
  it('mengisi variabel', () => {
    expect(translate('id', 'app.titleTemplate', { page: 'Kamus' })).toBe('Kamus · Xué Mandarin')
    expect(translate('en', 'app.titleTemplate', { page: 'Dictionary' })).toBe(
      'Dictionary · Xué Mandarin',
    )
  })

  it('kunci hilang -> kunci itu sendiri', () => {
    expect(translate('id', 'tidak.ada')).toBe('tidak.ada')
  })
})
