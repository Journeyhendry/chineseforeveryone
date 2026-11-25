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

const HAN = /[\u3400-\u9fff\uf900-\ufaff]/g

// File data yang TIDAK tampil di website, jadi hurufnya tidak perlu ada di font:
// - audio-issues.json: catatan cek audio (transkrip Whisper yang salah dengar, mis. 导演 untuk 到).
// - tone-refs.json (task 4c): ukuran rujukan penutur asli; huruf Han hanya di nama penutur dan teks kata (tidak tampil)
// - native-audio.json: huruf Han hanya ada di nama perekam (baris kredit .native-credit, memakai
//   --font-body Nunito/system-ui, bukan LXGW WenKai) dan di sourceUrl (hanya href, tidak tampil).
const NOT_DISPLAYED = new Set(['audio-issues.json', 'native-audio.json', 'tone-refs.json'])

function hanIn(text: string): Set<string> {
  return new Set(text.match(HAN) ?? [])
}

describe('font LXGW WenKai', () => {
  it('setiap huruf Han di data/hsk1/*.json yang tampil di website ada di core atau extra (kecuali yang ada di missing)', () => {
    const covered = new Set([...chars.core, ...chars.extra, ...chars.missing])
    const used = new Set<string>()
    for (const name of readdirSync(dataDir)) {
      if (!name.endsWith('.json') || NOT_DISPLAYED.has(name)) continue
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
