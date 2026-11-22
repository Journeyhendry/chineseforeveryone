import { describe, expect, it } from 'vitest'
import scenesData from '../../data/hsk1/scenes.json'
import previewScenes from '../../data/hsk2-preview/scenes.json'
import unitsData from '../../data/hsk1/units.json'
import wordsData from '../../data/hsk1/words.json'
import { CHARACTERS, EXPRESSIONS, INK, POSE_IDS, VIEWS } from './characters/index.ts'
import {
  ACT_TARGETS,
  BACKGROUND_IDS,
  buildScenes,
  PLAY_PRESETS,
  PROP_IDS,
  PROP_ROLES,
  SCENE_H,
  SCENE_VIEWBOX,
  SCENE_W,
  type SceneIndex,
  type ScenesFile,
} from './scenes/index.ts'
import { checkXml } from './xml-check.ts'

const data = scenesData as ScenesFile
const units = (unitsData as { units: { id: string; words: string[] }[] }).units
const words = new Map((wordsData as { id: string; hanzi: string }[]).map((w) => [w.id, w]))

const committed = Object.fromEntries(
  Object.entries(import.meta.glob('../../public/art/scenes/*.{svg,json}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>).map(
    ([path, text]) => [path.replace('../../public/art/scenes/', ''), text],
  ),
)
const preview = previewScenes as ScenesFile
const built = buildScenes(data)
const previewBuilt = buildScenes(preview)
const svgFiles = [...built].filter(([path]) => path.endsWith('.svg'))
const KB = 1024

/** Number shown by counting words (零 = nothing to count). */
const NUMBERS: Record<string, number> = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 }

describe('scenes.json', () => {
  it('has at most one scene per HSK 1 word, listed in unit order with the unit the word is in now', () => {
    const sceneWords = new Set(data.scenes.map((s) => s.wordId))
    expect(sceneWords.size).toBe(data.scenes.length)
    const expected = units.flatMap((u) => u.words.filter((w) => sceneWords.has(w)).map((w) => ({ unitId: u.id, wordId: w })))
    expect(data.version).toBe(1)
    expect(data.scenes.map((s) => ({ unitId: s.unitId, wordId: s.wordId }))).toEqual(expected)
  })

  it('keeps the scenes of the 2021 words that are not in the 300 words in data/hsk2-preview/scenes.json', () => {
    const hsk1 = new Set(words.keys())
    for (const s of data.scenes) expect(hsk1.has(s.wordId), s.wordId).toBe(true)
    for (const s of preview.scenes) expect(hsk1.has(s.wordId), `preview ${s.wordId}`).toBe(false)
    expect(preview.scenes).toHaveLength(12)
  })

  it('matches words.json and has a bilingual alt text', () => {
    for (const s of data.scenes) {
      expect(s.hanzi, s.wordId).toBe(words.get(s.wordId)?.hanzi)
      expect(s.alt.id.trim().length, s.wordId).toBeGreaterThan(10)
      expect(s.alt.en.trim().length, s.wordId).toBeGreaterThan(10)
      expect(['object', 'action', 'pair', 'count', 'position', 'comic']).toContain(s.type)
    }
  })

  it('only uses known characters, poses, props, backgrounds and presets', () => {
    const charIds = CHARACTERS.map((c) => c.id)
    for (const s of data.scenes) {
      const where = `${s.wordId} ${s.hanzi}`
      expect(BACKGROUND_IDS, where).toContain(s.background)
      expect(PLAY_PRESETS, where).toContain(s.play)
      expect([1, 2], where).toContain(s.panels.length)
      for (const p of s.panels) {
        if (p.background) expect(BACKGROUND_IDS, where).toContain(p.background)
        for (const c of p.characters) {
          expect(charIds, where).toContain(c.id)
          if (c.pose) expect(POSE_IDS, where).toContain(c.pose)
          if (c.expression) expect(['neutral', ...EXPRESSIONS], where).toContain(c.expression)
          if (c.view) expect(VIEWS, where).toContain(c.view)
          if (c.act) expect(ACT_TARGETS, where).toContain(c.act)
          for (const r of c.roles ?? []) expect(PROP_ROLES, where).toContain(r)
        }
        for (const pr of p.props) {
          expect(PROP_IDS, where).toContain(pr.id)
          for (const r of pr.roles ?? []) expect(PROP_ROLES, where).toContain(r)
          if (pr.hold) expect(p.characters[pr.hold[0]], `${where} hold`).toBeTruthy()
        }
        for (const b of p.bubbles ?? []) if (b.from !== undefined) expect(p.characters[b.from], `${where} bubble`).toBeTruthy()
      }
    }
  })

  it('keeps every position inside the 480x360 viewBox', () => {
    for (const s of data.scenes) {
      for (const p of s.panels) {
        for (const c of p.characters) {
          expect(c.x, s.wordId).toBeGreaterThanOrEqual(0)
          expect(c.x, s.wordId).toBeLessThanOrEqual(SCENE_W)
          expect(c.y ?? 336, s.wordId).toBeLessThanOrEqual(SCENE_H)
        }
        for (const pr of p.props) {
          if (pr.hold) continue
          expect(pr.x, `${s.wordId} ${pr.id}`).toBeGreaterThanOrEqual(0)
          expect(pr.x, `${s.wordId} ${pr.id}`).toBeLessThanOrEqual(SCENE_W)
          expect(pr.y, `${s.wordId} ${pr.id}`).toBeGreaterThanOrEqual(0)
          expect(pr.y, `${s.wordId} ${pr.id}`).toBeLessThanOrEqual(SCENE_H)
        }
        for (const b of p.bubbles ?? []) {
          expect(b.x >= 0 && b.y >= 0 && b.x + b.w <= SCENE_W && b.y + b.h <= SCENE_H, `${s.wordId} bubble`).toBe(true)
        }
      }
    }
  })

  it('shows exactly the right number of things for number words', () => {
    for (const s of data.scenes) {
      if (!(s.hanzi in NUMBERS)) continue
      const counted = s.panels.flatMap((p) => p.props).reduce((n, p) => n + (p.count ?? 0), 0)
      expect(counted, `${s.hanzi}`).toBe(NUMBERS[s.hanzi])
      const digit = s.panels.flatMap((p) => p.props).find((p) => p.id === 'digit')
      expect(digit?.value, `${s.hanzi} digit`).toBe(String(NUMBERS[s.hanzi]))
    }
  })

  it('puts the learned word, highlighted, in a balloon of every comic scene', () => {
    for (const s of data.scenes) {
      const bubbles = s.panels.flatMap((p) => p.bubbles ?? [])
      for (const b of bubbles) {
        if (b.highlight) expect(b.text, `${s.hanzi}`).toContain(s.hanzi)
        if (b.text) expect(b.text, s.hanzi).not.toMatch(/[A-Za-z]/)
      }
      if (s.type === 'comic') expect(bubbles.some((b) => b.highlight), s.hanzi).toBe(true)
    }
  })
})

describe('build-scenes', () => {
  it('is deterministic and matches the committed files (run npm run build:scenes)', () => {
    expect([...buildScenes(data)]).toEqual([...built])
    // the SVG files of the HSK 2 preview scenes stay in the same folder (they are not in index.json)
    const expected = new Map(built)
    for (const [path, src] of previewBuilt) if (path !== 'index.json') expected.set(path, src)
    expect(Object.keys(committed).sort()).toEqual([...expected.keys()].sort())
    for (const [path, src] of expected) expect(committed[path], path).toBe(src)
  })

  it('writes a complete index', () => {
    const index = JSON.parse(built.get('index.json') as string) as SceneIndex
    expect(index.viewBox).toBe(SCENE_VIEWBOX)
    expect(Object.keys(index.scenes)).toEqual(data.scenes.map((s) => s.wordId))
    for (const s of data.scenes) {
      const e = index.scenes[s.wordId]
      expect(e.file).toBe(`${s.wordId}.svg`)
      expect(built.has(e.file)).toBe(true)
      expect(e.alt).toEqual(s.alt)
      expect(e.play).toBe(s.play)
      const texts = s.panels.flatMap((p) => p.bubbles ?? []).filter((b) => b.text)
      expect(e.bubbles.map((b) => b.text)).toEqual(texts.map((b) => b.text))
      for (const b of e.bubbles) {
        expect(b.x >= 0 && b.y >= 0 && b.x + b.w <= 100.01 && b.y + b.h <= 100.01).toBe(true)
      }
    }
  })
})

describe('scene SVG files', () => {
  const FORBIDDEN = ['style', 'script', 'image', 'foreignObject', 'filter', 'linearGradient', 'radialGradient', 'iframe', 'clipPath', 'mask']

  it.each(svgFiles)('%s is valid, self-contained and small', (path, src) => {
    expect(checkXml(src), path).toBeNull()
    expect(src).toMatch(new RegExp(`^<svg xmlns="http://www\\.w3\\.org/2000/svg" viewBox="${SCENE_VIEWBOX}" role="img" aria-label="[^"]+">`))
    for (const tag of FORBIDDEN) expect(src, `<${tag}>`).not.toMatch(new RegExp(`<${tag}[\\s/>]`))
    expect(src).not.toMatch(/(?:xlink:)?href=/)
    expect(src).not.toMatch(/url\(|\son[a-z]+=|style=/)
    for (const m of src.matchAll(/<text\b[^>]*>([^<]*)<\/text>/g)) expect(m[1], 'text must be digits').toMatch(/^[0-9]+$/)
    const strokes = new Set([...src.matchAll(/\bstroke="([^"]*)"/g)].map((m) => m[1]))
    for (const s of strokes) expect([INK, 'none'], `stroke ${s}`).toContain(s)
    expect(new TextEncoder().encode(src).length, path).toBeLessThanOrEqual(40 * KB)
    expect(src).not.toMatch(/NaN|Infinity/)
  })

  it('marks the parts the animations use', () => {
    for (const [path, src] of svgFiles) {
      const scene = data.scenes.find((s) => `${s.wordId}.svg` === path)
      if (scene?.panels.some((p) => p.characters.length)) {
        expect(src, path).toContain('class="char ')
        expect(src, path).toMatch(/class="[^"]*\beyes\b/)
      }
      if (scene?.play === 'count-up') expect(src, path).toContain('count-item')
      if (scene?.play === 'panels') expect(src, path).toContain('class="panel panel-2"')
      if (scene && ['wave', 'bow', 'nod', 'shake-head', 'beckon', 'jump', 'shrug'].includes(scene.play)) expect(src, path).toMatch(/class="[^"]*\bact\b/)
    }
  })

  it('averages 20 KB or less per scene', () => {
    const total = svgFiles.reduce((n, [, src]) => n + new TextEncoder().encode(src).length, 0)
    expect(total / svgFiles.length).toBeLessThanOrEqual(20 * KB)
  })
})
