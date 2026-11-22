import { describe, expect, it } from 'vitest'
import dialogs from '../../data/hsk1/dialogs.json'
import { buildAll, CHARACTERS, EXPRESSIONS, INK, manifest, POSE_IDS, POSES, posedFigure, VIEWBOX, VIEWS } from './characters/index.ts'
import { makeRig } from './characters/body.ts'
import { posedArmGeom, shoulderPoint } from './characters/pose.ts'
import { checkXml } from './xml-check.ts'

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

describe('poses', () => {
  const views = ['front', 'side', 'back'] as const

  it('has the poses the scenes need', () => {
    for (const id of ['wave', 'point', 'bow', 'handsTogether', 'shrug', 'thinking', 'holdObject', 'thumbsUp', 'armsCross', 'count', 'beckon', 'sit']) {
      expect(POSE_IDS, id).toContain(id)
    }
  })

  it('renders every character in every pose and view as valid markup with both arms', () => {
    for (const c of CHARACTERS) {
      for (const pose of POSE_IDS) {
        for (const view of views) {
          const f = posedFigure(c, view, 'happy', pose, { anim: true, fingers: 3 })
          const svg = `<svg xmlns="http://www.w3.org/2000/svg">${f.svg}</svg>`
          expect(checkXml(svg), `${c.id} ${pose} ${view}`).toBeNull()
          expect(svg).toContain('class="arm-left')
          expect(svg).toContain('class="arm-right')
          expect(svg).not.toMatch(/NaN|Infinity/)
          for (const p of [f.anchors.mouth, f.anchors.hands.left, f.anchors.hands.right]) {
            expect(Number.isFinite(p.x) && Number.isFinite(p.y), `${c.id} ${pose} ${view} anchor`).toBe(true)
          }
        }
      }
    }
  })

  it('keeps posed arms attached at the shoulder with constant bone lengths', () => {
    for (const c of CHARACTERS) {
      const b = makeRig(c)
      for (const pose of POSE_IDS) {
        for (const view of views) {
          for (const side of ['left', 'right'] as const) {
            const ap = (POSES[pose] as Record<string, unknown>)[side]
            if (!ap) continue
            const g = posedArmGeom(view, b, side, ap)
            const s = shoulderPoint(view, b, side)
            const where = `${c.id} ${pose} ${view} ${side}`
            expect(g.s, where).toEqual(s)
            // the shoulder end sits inside the torso (hidden under or on the shoulder)
            expect(Math.abs(s.x - 150), where).toBeLessThan(c.body.shoulderHalf)
            expect(Math.hypot(g.e.x - g.s.x, g.e.y - g.s.y), where).toBeCloseTo(c.body.armLen * 0.52, 3)
            expect(Math.hypot(g.hand.x - g.e.x, g.hand.y - g.e.y), where).toBeCloseTo(c.body.armLen * 0.5 + 5, 3)
          }
        }
      }
    }
  })
})

