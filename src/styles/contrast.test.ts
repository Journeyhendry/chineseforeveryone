import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('./theme.css', import.meta.url), 'utf8')

function block(selector: string): string {
  const start = css.indexOf(selector + ' {')
  if (start < 0) throw new Error(`blok ${selector} tidak ditemukan`)
  return css.slice(start, css.indexOf('}', start))
}

function tokens(body: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of body.matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) out[m[1]] = m[2]
  return out
}

const light = tokens(block(':root'))
const dark = { ...light, ...tokens(block("[data-theme='dark']")) }

function lum(hex: string): number {
  const c = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}

function ratio(a: string, b: string): number {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

// [teks, latar]; minimal 4.5
const TEXT_PAIRS: [string, string][] = [
  ['--text', '--bg'],
  ['--text', '--surface'],
  ['--text', '--surface-2'],
  ['--text', '--surface-3'],
  ['--text-soft', '--bg'],
  ['--text-soft', '--surface'],
  ['--text-soft', '--surface-2'],
  ['--text-soft', '--surface-3'],
  ['--link', '--bg'],
  ['--link', '--surface'],
  ['--on-btn', '--btn-purple'],
  ['--on-btn', '--btn-green'],
  ['--on-btn', '--btn-orange'],
  ['--ink', '--yellow'],
  ['--tone-1', '--tone-surface'],
  ['--tone-2', '--tone-surface'],
  ['--tone-4', '--tone-surface'],
  ['--tone-5', '--tone-surface'],
  ['--tone-label', '--tone-surface'],
]

// Pengecualian terdokumentasi: #2B8A3E (nada 3, warna final) paling tinggi
// hanya 4.39:1 di atas putih, jadi tidak bisa mencapai 4.5. Ia hanya dipakai
// untuk teks besar tebal (>= 24px, batas AA 3:1); kita tetap menjaga >= 4.3.
const TONE3_LARGE_TEXT_MIN = 4.3

// [garis fokus, latar]; minimal 3
const FOCUS_PAIRS: [string, string][] = [
  ['--focus', '--bg'],
  ['--focus', '--surface'],
  ['--focus', '--surface-2'],
  ['--focus', '--surface-3'],
]

describe.each([
  ['terang', light],
  ['gelap', dark],
] as const)('kontras tema %s', (_name, t) => {
  it.each(TEXT_PAIRS)('%s di atas %s >= 4.5', (fg, bg) => {
    expect(t[fg], fg).toBeDefined()
    expect(t[bg], bg).toBeDefined()
    expect(ratio(t[fg], t[bg])).toBeGreaterThanOrEqual(4.5)
  })

  it('--tone-3 di atas --tone-surface (teks besar) >= 4.3', () => {
    expect(ratio(t['--tone-3'], t['--tone-surface'])).toBeGreaterThanOrEqual(TONE3_LARGE_TEXT_MIN)
  })

  it.each(FOCUS_PAIRS)('%s terhadap %s >= 3', (fg, bg) => {
    expect(ratio(t[fg], t[bg])).toBeGreaterThanOrEqual(3)
  })
})

describe('keputusan final', () => {
  it('warna nada sama di terang dan gelap', () => {
    for (const k of ['--tone-1', '--tone-2', '--tone-3', '--tone-4', '--tone-5']) {
      expect(dark[k]).toBe(light[k])
    }
    expect(light['--tone-1']).toBe('#c92a2a')
    expect(light['--tone-2']).toBe('#b45309')
    expect(light['--tone-3']).toBe('#2b8a3e')
    expect(light['--tone-4']).toBe('#1864ab')
    expect(light['--tone-5']).toBe('#5c5470')
  })
})
