import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const FONT_FILES = [
  'lxgw-wenkai-regular-core.woff2',
  'lxgw-wenkai-regular-extra.woff2',
  'lxgw-wenkai-bold-core.woff2',
  'lxgw-wenkai-bold-extra.woff2',
]

const fontDir = new URL('../assets/fonts/', import.meta.url)
const dataDir = new URL('../../data/hsk1/', import.meta.url)
const css = readFileSync(new URL('./fonts.css', import.meta.url), 'utf8')

type CharsFile = { source: string; fontVersion: string; core: string; extra: string; missing: string[] }
const chars = JSON.parse(readFileSync(new URL('lxgw-wenkai-chars.json', fontDir), 'utf8')) as CharsFile

const HAN = /[㐀-鿿豈-﫿]/g

function hanIn(text: string): Set<string> {
  return new Set(text.match(HAN) ?? [])
}

describe('font LXGW WenKai', () => {
  it('setiap huruf Han di data/hsk1/*.json ada di core atau extra (kecuali yang ada di missing)', () => {
    const covered = new Set([...chars.core, ...chars.extra, ...chars.missing])
    const used = new Set<string>()
    for (const name of readdirSync(dataDir)) {
      if (!name.endsWith('.json')) continue
      for (const ch of hanIn(readFileSync(new URL(name, dataDir), 'utf8'))) used.add(ch)
    }
    expect(used.size).toBeGreaterThan(0)
    const uncovered = [...used].filter((ch) => !covered.has(ch))
    expect(uncovered).toEqual([])
  })

  it('missing kosong atau paling banyak 5 huruf', () => {
    expect(chars.missing.length).toBeLessThanOrEqual(5)
  })

  it.each(FONT_FILES)('%s ada, tidak kosong, dan berformat woff2', (file) => {
    const url = new URL(file, fontDir)
    expect(existsSync(url)).toBe(true)
    expect(statSync(url).size).toBeGreaterThan(0)
    expect(readFileSync(url).subarray(0, 4).toString('ascii')).toBe('wOF2')
  })

  it.each(FONT_FILES)('fonts.css merujuk ke %s', (file) => {
    expect(css).toContain(`url('../assets/fonts/${file}')`)
  })
})
