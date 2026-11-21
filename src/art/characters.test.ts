import { describe, expect, it } from 'vitest'
import dialogs from '../../data/hsk1/dialogs.json'
import { buildAll, CHARACTERS, EXPRESSIONS, INK, manifest, VIEWBOX, VIEWS } from './characters/index.ts'

// Files committed in public/art/characters, read as text.
const committed = Object.fromEntries(
  Object.entries(import.meta.glob('../../public/art/characters/**/*.{svg,json}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>).map(
    ([path, text]) => [path.replace('../../public/art/characters/', ''), text],
  ),
)
const built = buildAll()
const svgFiles = [...built].filter(([path]) => path.endsWith('.svg'))
const singleViews = svgFiles.filter(([path]) => !path.endsWith('sheet.svg') && path !== 'lineup.svg')

const KB = 1024
const FORBIDDEN = ['style', 'script', 'text', 'image', 'foreignObject', 'filter', 'linearGradient', 'radialGradient', 'iframe']

/** Minimal well-formedness check: balanced tags, quoted attributes, one root. */
function checkXml(src: string): string | null {
  const stack: string[] = []
  const re = /<(\/?)([A-Za-z][\w:-]*)((?:\s+[\w:-]+="[^"<]*")*)\s*(\/?)>/g
  let pos = 0
  let roots = 0
  for (let m = re.exec(src); m; m = re.exec(src)) {
    if (src.slice(pos, m.index).includes('<')) return `stray "<" before offset ${m.index}`
    pos = re.lastIndex
    const [, close, name, , self] = m
    if (close) {
      if (stack.pop() !== name) return `unexpected </${name}>`
    } else if (!self) {
      if (stack.length === 0) roots++
      stack.push(name)
    } else if (stack.length === 0) roots++
  }
  if (src.slice(pos).trim() !== '') return 'trailing content'
  if (stack.length) return `unclosed <${stack.at(-1)}>`
  return roots === 1 ? null : `${roots} root elements`
}

describe('characters', () => {
  it('covers every speaker in dialogs.json with the same gender', () => {
    const speakers = (dialogs as { speakers: Record<string, { gender: string }> }).speakers
    expect(CHARACTERS.map((c) => c.id).sort()).toEqual(Object.keys(speakers).sort())
    for (const c of CHARACTERS) expect(c.gender, c.id).toBe(speakers[c.id].gender)
  })

  it('builds all views, expressions and sheets per character, plus lineup and manifest', () => {
    for (const c of CHARACTERS) {
      for (const v of VIEWS) expect(built.has(`${c.id}/${v}.svg`)).toBe(true)
      for (const e of EXPRESSIONS) expect(built.has(`${c.id}/expr-${e}.svg`)).toBe(true)
      expect(built.has(`${c.id}/sheet.svg`)).toBe(true)
    }
    expect(built.has('lineup.svg')).toBe(true)
    expect(built.size).toBe(CHARACTERS.length * 8 + 2)
  })

  it('manifest lists every file that exists', () => {
    const m = manifest()
    expect(m.viewBox).toBe(VIEWBOX)
    expect(m.views).toEqual(['front', 'side', 'back'])
    expect(m.expressions).toEqual(['happy', 'sad', 'surprised', 'angry'])
    for (const c of m.characters) {
      const files = [c.files.front, c.files.side, c.files.back, c.files.sheet, ...Object.values(c.files.expressions)]
      expect(Object.keys(c.files.expressions)).toEqual([...EXPRESSIONS])
      for (const f of files) expect(built.has(f), f).toBe(true)
      expect(['family', 'support']).toContain(c.role)
      expect(c.name.id && c.name.en).toBeTruthy()
    }
  })

  it.each(svgFiles)('%s is valid, self-contained SVG', (path, src) => {
    expect(checkXml(src), path).toBeNull()
    expect(src).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="[^"]+" role="img" aria-label="[^"]+">/)
    for (const tag of FORBIDDEN) expect(src, `<${tag}>`).not.toMatch(new RegExp(`<${tag}[\\s/>]`))
    expect(src).not.toMatch(/(?:xlink:)?href="(?!#)/)
    expect(src).not.toMatch(/url\(/)
    const strokes = new Set([...src.matchAll(/\bstroke="([^"]*)"/g)].map((m) => m[1]))
    for (const s of strokes) expect([INK, 'none'], `stroke ${s}`).toContain(s)
  })

  it.each(singleViews)('%s uses the shared viewBox and named part groups', (path, src) => {
    expect(src).toContain(`viewBox="${VIEWBOX}"`)
    for (const part of ['head', 'body', 'arm-left', 'arm-right', 'legs', 'hair']) expect(src, `${path} ${part}`).toContain(`class="${part}"`)
    if (!path.endsWith('back.svg')) for (const part of ['eyes', 'mouth', 'brows']) expect(src, `${path} ${part}`).toContain(`class="${part}"`)
    if (path.endsWith('back.svg')) expect(src).not.toContain('class="eyes"')
  })

  it('keeps each character file at 20 KB or less (lineup at 64 KB or less)', () => {
    for (const [path, src] of built) {
      const limit = path === 'lineup.svg' ? 64 * KB : 20 * KB
      expect(new TextEncoder().encode(src).length, path).toBeLessThanOrEqual(limit)
    }
  })

  it('is deterministic and matches the committed files (run npm run build:characters)', () => {
    const again = buildAll()
    expect([...again]).toEqual([...built])
    expect(Object.keys(committed).sort()).toEqual([...built.keys()].sort())
    for (const [path, src] of built) expect(committed[path], path).toBe(src)
  })
})
