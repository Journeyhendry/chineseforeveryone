import { describe, expect, it } from 'vitest'
import scenesData from '../../data/hsk1/scenes.json'
import previewScenes from '../../data/hsk2-preview/scenes.json'
import unitsData from '../../data/hsk1/units.json'
import wordsData from '../../data/hsk1/words.json'
import { CHARACTERS, EXPRESSIONS, INK, POSE_IDS, SCENE_EXPRESSIONS, VIEWS } from './characters/index.ts'
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
import { GLYPH_STROKES } from './scenes/glyphs.ts'
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
          if (c.expression) expect(['neutral', ...EXPRESSIONS, ...SCENE_EXPRESSIONS], where).toContain(c.expression)
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

describe('tahap 2: units u01–u08', () => {
  const UNITS = ['u01', 'u02', 'u03', 'u04', 'u05', 'u06', 'u07', 'u08']
  const byHanzi = (h: string) => data.scenes.find((s) => s.hanzi === h && UNITS.includes(s.unitId))
  const FAMILY = ['家', '家人', '爸爸', '妈妈', '哥哥', '姐姐', '弟弟', '妹妹', '儿子', '女儿']
  const XIAO = ['yeye', 'nainai', 'baba', 'mama', 'gege', 'meimei']

  it('gives every word of units u01–u08 exactly one scene', () => {
    for (const u of units.filter((u) => UNITS.includes(u.id))) {
      for (const w of u.words) expect(data.scenes.filter((s) => s.wordId === w), `${u.id} ${words.get(w)?.hanzi}`).toHaveLength(1)
    }
  })

  it('puts the family words of u08 in the same Xiǎo family living room, full for 家 and 家人', () => {
    for (const h of FAMILY) {
      const s = byHanzi(h)
      expect(s, h).toBeTruthy()
      expect(s?.background, h).toBe('living')
      expect(s?.panels.every((p) => (p.background ?? 'living') === 'living'), h).toBe(true)
    }
    for (const h of ['家', '家人']) {
      const ids = byHanzi(h)?.panels.flatMap((p) => p.characters.map((c) => c.id)) ?? []
      expect([...new Set(ids)].sort(), h).toEqual([...XIAO].sort())
    }
  })

  it('plays the origin animation for 人 and 家: the picture next to the character drawn stroke by stroke', () => {
    for (const h of ['人', '家']) {
      const s = byHanzi(h)
      expect(s?.play, h).toBe('origin')
      const props = s?.panels.flatMap((p) => p.props) ?? []
      expect(props.some((p) => p.roles?.includes('morph-from')), h).toBe(true)
      const glyph = props.find((p) => p.id === 'glyph')
      expect(glyph?.value, h).toBe(h)
      expect(glyph?.roles, h).toContain('morph-to')
      const svg = built.get(`${s?.wordId}.svg`) as string
      const strokes = [...svg.matchAll(/class="stroke stroke-(\d+)"/g)].map((m) => Number(m[1]))
      expect(strokes, h).toEqual(GLYPH_STROKES[h].map((_, i) => i + 1))
    }
  })

  it('shows three animals and the digit 3 for 只, and the number 1000 for 千', () => {
    const zhi = byHanzi('只')?.panels.flatMap((p) => p.props) ?? []
    expect(zhi.reduce((n, p) => n + (p.count ?? 0), 0)).toBe(3)
    expect(zhi.find((p) => p.id === 'digit')?.value).toBe('3')
    const qian = byHanzi('千')?.panels.flatMap((p) => p.props) ?? []
    expect(qian.find((p) => p.id === 'badge')?.value).toBe('1000')
    expect(qian.reduce((n, p) => n + (p.count ?? 0), 0)).toBe(10)
  })
})

describe('tahap 3: units u09–u12', () => {
  const UNITS = ['u01', 'u02', 'u03', 'u04', 'u05', 'u06', 'u07', 'u08', 'u09', 'u10', 'u11', 'u12']
  const byHanzi = (h: string) => {
    const s = data.scenes.find((s) => s.hanzi === h && UNITS.includes(s.unitId))
    if (!s) throw new Error(`no scene for ${h}`)
    return s
  }
  const props = (h: string) => byHanzi(h).panels.flatMap((p) => p.props)
  const prop = (h: string, id: string) => props(h).filter((p) => p.id === id)

  it('gives every word of units u01–u12 exactly one scene (177 HSK 1 scenes in all)', () => {
    for (const u of units.filter((u) => UNITS.includes(u.id))) {
      for (const w of u.words) expect(data.scenes.filter((s) => s.wordId === w), `${u.id} ${words.get(w)?.hanzi}`).toHaveLength(1)
    }
    expect(units.filter((u) => UNITS.includes(u.id)).flatMap((u) => u.words)).toHaveLength(176)
    // 176 words of u01–u12 + 一下 (u14, drawn in tahap 1) = 177 scenes after tahap 3; tahap 4 adds u13–u16
    expect(data.scenes.filter((s) => UNITS.includes(s.unitId) || s.hanzi === '一下')).toHaveLength(177)
  })

  it('plays the origin animation for 日 and 月: the picture next to the character drawn stroke by stroke', () => {
    for (const h of ['日', '月']) {
      const s = byHanzi(h)
      expect(s.play, h).toBe('origin')
      expect(props(h).some((p) => p.roles?.includes('morph-from')), h).toBe(true)
      const glyph = prop(h, 'glyph')[0]
      expect(glyph?.value, h).toBe(h)
      expect(glyph?.roles, h).toContain('morph-to')
      const svg = built.get(`${s.wordId}.svg`) as string
      const strokes = [...svg.matchAll(/class="stroke stroke-(\d+)"/g)].map((m) => Number(m[1]))
      expect(strokes, h).toEqual(GLYPH_STROKES[h].map((_, i) => i + 1))
      expect(svg, h).not.toContain('<text')
    }
    expect(prop('日', 'sun-dot')).toHaveLength(1)
    expect(prop('月', 'moon-old')).toHaveLength(1)
  })

  it('shows the right time on the clocks of the time words', () => {
    const TIMES: Record<string, string> = {
      现在: '0800', 点: '0700', 分: '0305', 分钟: '0310', 小时: '0400', 时间: '0755', 时候: '0600',
      早上: '0600', 上午: '1000', 中午: '1200', 下午: '0300', 晚上: '0800', 早: '0700', 晚: '0820',
    }
    for (const [h, t] of Object.entries(TIMES)) {
      const clocks = prop(h, 'clock')
      expect(clocks.map((c) => c.value), h).toEqual([t])
    }
    // the sun / moon dial puts the parts of the day in order
    const hours = ['早上', '上午', '中午', '下午', '晚上'].map((h) => Number(prop(h, 'day-dial')[0]?.value))
    expect(hours).toEqual([...hours].sort((a, b) => a - b))
    expect(prop('分', 'clock')[0].variant).toBe('m5')
    expect(prop('分', 'digit')[0].value).toBe('5')
    expect(prop('分钟', 'clock')[0].variant).toBe('m10')
    expect(prop('分钟', 'digit')[0].value).toBe('10')
    expect(prop('小时', 'clock')[0].variant).toBe('hour')
    for (const h of ['分', '分钟', '小时']) expect(byHanzi(h).play, h).toBe('clock')
  })

  it('draws clock hands that point at the time', () => {
    const svg = built.get(`${byHanzi('分').wordId}.svg`) as string
    // 3:05 -> hour hand at 92.5 degrees, minute hand at 30 degrees
    expect(svg).toMatch(/class="hand-h"><g transform="rotate\(92\.5\)"/)
    expect(svg).toMatch(/class="hand-m sweep-m5"><g transform="rotate\(30\)"/)
  })

  it('tells today, tomorrow and yesterday (and this, next and last year) apart', () => {
    expect(prop('今天', 'days3')[0].variant).toBeUndefined()
    expect(prop('明天', 'days3')[0].variant).toBe('tomorrow')
    expect(prop('昨天', 'days3')[0].variant).toBe('yesterday')
    const hl = (h: string) => prop(h, 'year-cal').filter((p) => p.variant === 'hl').map((p) => p.value)
    for (const h of ['今年', '明年', '去年']) expect(hl(h), h).toEqual(['2026'])
    expect(prop('明年', 'year-cal').find((p) => p.color)?.value).toBe('2027')
    expect(prop('去年', 'year-cal').find((p) => p.color)?.value).toBe('2025')
    const week = prop('星期', 'day-box').reduce((n, p) => n + (p.count ?? 0), 0)
    expect(week).toBe(7)
    expect(built.get(`${byHanzi('星期天').wordId}.svg`)).not.toBe(built.get(`${byHanzi('星期日').wordId}.svg`))
  })

  it('draws the position pairs with the same things in different places', () => {
    for (const [a, b] of [['上', '下'], ['前', '后'], ['里', '外']]) {
      const ids = (h: string) => [...new Set(props(h).map((p) => p.id))].sort()
      expect(ids(a), `${a}/${b}`).toEqual(ids(b))
      expect(byHanzi(a).background, `${a}/${b}`).toBe(byHanzi(b).background)
      expect(prop(a, 'marker'), a).toHaveLength(1)
      expect(prop(b, 'marker'), b).toHaveLength(1)
    }
    for (const h of ['来', '去', '回', '到']) {
      const s = byHanzi(h)
      expect(s.play, h).toBe('move-to')
      expect(s.panels.some((p) => p.characters.some((c) => c.roles?.includes('mover'))), h).toBe(true)
    }
  })
})

describe('tahap 4: units u13–u16', () => {
  const UNITS = ['u01', 'u02', 'u03', 'u04', 'u05', 'u06', 'u07', 'u08', 'u09', 'u10', 'u11', 'u12', 'u13', 'u14', 'u15', 'u16']
  const byHanzi = (h: string) => {
    const s = data.scenes.find((s) => s.hanzi === h && UNITS.includes(s.unitId))
    if (!s) throw new Error(`no scene for ${h}`)
    return s
  }
  const props = (h: string) => byHanzi(h).panels.flatMap((p) => p.props)
  const prop = (h: string, id: string) => props(h).filter((p) => p.id === id)
  const chars = (h: string) => byHanzi(h).panels.flatMap((p) => p.characters)
  const charIds = (h: string) => chars(h).map((c) => c.id)
  const texts = (h: string) => byHanzi(h).panels.flatMap((p) => p.bubbles ?? []).map((b) => b.text ?? '')
  const svg = (h: string) => built.get(`${byHanzi(h).wordId}.svg`) as string

  it('gives every word of units u01–u16 exactly one scene (233 HSK 1 scenes in all)', () => {
    for (const u of units.filter((u) => UNITS.includes(u.id))) {
      for (const w of u.words) expect(data.scenes.filter((s) => s.wordId === w), `${u.id} ${words.get(w)?.hanzi}`).toHaveLength(1)
    }
    expect(units.filter((u) => UNITS.includes(u.id)).flatMap((u) => u.words)).toHaveLength(233)
    expect(data.scenes).toHaveLength(233)
    // every scene of the 56 new words is its own picture
    const fresh = data.scenes.filter((s) => ['u13', 'u14', 'u15', 'u16'].includes(s.unitId) && s.hanzi !== '一下')
    expect(fresh).toHaveLength(56)
    expect(new Set(fresh.map((s) => built.get(`${s.wordId}.svg`))).size).toBe(56)
  })

  it('tells places apart by what is in them, and draws the vehicles without writing', () => {
    expect(prop('店', 'shopfront')).toHaveLength(1)
    expect(prop('商店', 'counter')[0]?.variant).toBe('qr')
    expect(prop('书店', 'shop-shelf').every((p) => p.variant === 'books')).toBe(true)
    expect(prop('超市', 'cart')).toHaveLength(1)
    expect(prop('饭店', 'round-table')).toHaveLength(1)
    expect(charIds('饭店')).toContain('waiter')
    expect(prop('电影院', 'cinema-screen')).toHaveLength(1)
    expect(prop('公司', 'office-building')).toHaveLength(1)
    const vehicles = props('车').filter((p) => ['car', 'bus', 'bicycle'].includes(p.id))
    expect(new Set(vehicles.map((p) => p.id)).size).toBe(3)
    expect(prop('出租车', 'car')[0]?.variant).toBe('taxi')
    expect(prop('火车', 'train')).toHaveLength(1)
    expect(prop('飞机', 'plane')).toHaveLength(1)
    for (const h of ['店', '商店', '书店', '超市', '饭店', '电影院', '公司', '车', '出租车', '火车', '飞机']) expect(svg(h), h).not.toContain('<text')
  })

  it('draws 上课 and 下课 differently: sitting down at the desks vs running out of the door', () => {
    const shang = byHanzi('上课')
    const xia = byHanzi('下课')
    expect(shang.background).toBe('classroom')
    expect(xia.background).toBe('classroom')
    expect(prop('上课', 'desk').length).toBeGreaterThan(0)
    expect(chars('上课').filter((c) => c.pose === 'sit').length).toBeGreaterThanOrEqual(2)
    expect(prop('上课', 'door')).toHaveLength(0)
    expect(prop('下课', 'door')[0]?.variant).toBe('open')
    expect(chars('下课').some((c) => c.pose === 'sit')).toBe(false)
    expect(chars('下课').filter((c) => c.roles?.includes('mover')).length).toBeGreaterThanOrEqual(2)
    expect(xia.play).toBe('move-to')
    expect(texts('上课')).toContain('上课了！')
    expect(texts('下课')).toContain('下课了！')
  })

  it('draws 睡 (a nap in the armchair) and 睡觉 (lying in bed at night) differently', () => {
    expect(prop('睡', 'armchair')).toHaveLength(1)
    expect(prop('睡', 'bed')).toHaveLength(0)
    expect(chars('睡').every((c) => c.expression === 'sleep')).toBe(true)
    expect(prop('睡觉', 'bed')).toHaveLength(1)
    expect(prop('睡觉', 'blanket')[0]?.front).toBe(true)
    const sleeper = chars('睡觉')[0]
    expect(sleeper.expression).toBe('sleep')
    expect(sleeper.rotate).toBe(-90)
    expect(byHanzi('睡觉').background).toBe('room-night')
    expect(charIds('睡')).not.toEqual(charIds('睡觉'))
    // 起床 uses the same bed, sitting up
    expect(prop('起床', 'bed')).toHaveLength(1)
    expect(chars('起床')[0].rotate).toBeUndefined()
    expect(prop('起床', 'clock')[0]?.variant).toBe('alarm')
  })

  it('tells breakfast, lunch and dinner apart by the food, the clock and the sun / moon', () => {
    const meals = ['早饭', '午饭', '晚饭']
    expect(meals.map((h) => prop(h, 'clock')[0]?.value)).toEqual(['0730', '1200', '0700'])
    const hours = meals.map((h) => Number(prop(h, 'day-dial')[0]?.value))
    expect(hours).toEqual([7, 12, 19])
    expect(prop('早饭', 'youtiao')).toHaveLength(1)
    expect(prop('午饭', 'noodle-bowl')).toHaveLength(1)
    expect(prop('晚饭', 'fish-plate')).toHaveLength(1)
    const food = (h: string) => new Set(props(h).filter((p) => p.front && !['table'].includes(p.id)).map((p) => p.id))
    expect(food('早饭')).not.toEqual(food('午饭'))
    expect(food('午饭')).not.toEqual(food('晚饭'))
    for (const h of meals) expect(texts(h).join(''), h).toContain(h)
  })

  it('shows 了 as before → after, 正在 as in the middle of it, 再 as asking for more and 还 as still up at night', () => {
    expect(byHanzi('了').panels).toHaveLength(2)
    expect(byHanzi('了').play).toBe('panels')
    expect(prop('了', 'bowl').map((p) => p.variant)).toEqual(['rice', undefined])
    expect(texts('正在').join('')).toContain('我正在吃饭')
    expect(texts('再').join('')).toContain('再来')
    expect(prop('还', 'clock')[0]?.value).toBe('1100')
    expect(byHanzi('还').background).toBe('room-night')
    expect(texts('还').join('')).toContain('还在')
  })

  it('keeps 爱 (a family hug) and 喜欢 (liking a thing) apart', () => {
    expect(charIds('爱').sort()).toEqual(['mama', 'meimei'])
    expect(chars('爱').every((c) => c.pose === 'hug')).toBe(true)
    expect(charIds('喜欢')).toEqual(['meimei'])
    expect(prop('喜欢', 'toy-panda')).toHaveLength(1)
    expect(prop('爱', 'toy-panda')).toHaveLength(0)
    expect(texts('爱').join('')).toContain('我爱你')
    expect(texts('喜欢').join('')).toContain('喜欢')
  })

  it('keeps 要 / 不要 and 会 / 能 clearly apart', () => {
    expect(texts('要').join('')).toContain('我要')
    expect(texts('要').join('')).not.toContain('不要')
    expect(texts('不要').join('')).toContain('不要')
    expect(prop('不要', 'cross')).toHaveLength(1)
    expect(prop('要', 'cross')).toHaveLength(0)
    expect(byHanzi('要').play).not.toBe(byHanzi('不要').play)
    expect(byHanzi('不要').play).toBe('shake-head')
    // 会 = a learned skill (riding a bike alone); 能 = able / strong enough (lifting a heavy box)
    expect(prop('会', 'bicycle')).toHaveLength(1)
    expect(prop('会', 'box')).toHaveLength(0)
    expect(prop('能', 'box')).toHaveLength(1)
    expect(prop('能', 'bicycle')).toHaveLength(0)
    expect(texts('会').join('')).toContain('我会')
    expect(texts('能').join('')).toContain('能！')
    // 学 = still learning (Mom holds the bike), 会 = can do it alone
    expect(charIds('学')).toContain('mama')
    expect(chars('学').find((c) => c.id === 'mama')?.x).toBeLessThan(chars('学').find((c) => c.id === 'meimei')?.x ?? 0)
  })

  it('draws 高兴 as a pair', () => {
    const s = byHanzi('高兴')
    expect(s.panels).toHaveLength(2)
    expect(s.play).toBe('swap-pair')
    expect(chars('高兴').map((c) => c.expression)).toEqual(['happy', 'sad'])
  })

  it('gives each school level a matching age: Little Sister at primary, never Big Brother at secondary, Big Brother at university', () => {
    for (const h of ['小学', '小学生']) expect(charIds(h), h).toContain('meimei')
    for (const h of ['中学', '中学生']) {
      expect(charIds(h), h).not.toContain('gege')
      expect(charIds(h), h).toContain('classmate')
    }
    for (const h of ['大学', '大学生']) expect(charIds(h), h).toContain('gege')
    expect(prop('小学', 'school-small')).toHaveLength(1)
    expect(prop('中学', 'school-tall')).toHaveLength(1)
    expect(prop('大学', 'university')).toHaveLength(1)
    for (const [h, t] of [['小学生', '我是小学生'], ['中学生', '我是中学生'], ['大学生', '我是大学生']]) expect(texts(h).join(''), h).toContain(t)
  })
})
