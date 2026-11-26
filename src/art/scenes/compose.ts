// Assembles one scene: background(s), props, posed characters (rendered by the same code as the
// character sheets), comic balloons and panel frames, into one SVG in the 480x360 viewBox.
// Animated parts are wrapped so that each animated group's local origin is its pivot point
// (CSS transforms in the app then rotate/scale around the right spot without transform-origin).
import { CHARACTERS } from '../characters/specs.ts'
import { posedFigure, type FigureAnchors } from '../characters/render.ts'
import { POSES } from '../characters/pose.ts'
import { el, INK, num, type Pt } from '../characters/svg.ts'
import { BACKGROUNDS, type Box } from './backgrounds.ts'
import { drawBubble } from './bubble.ts'
import { drawProp, PROPS } from './props.ts'
import {
  SCENE_H,
  SCENE_VIEWBOX,
  SCENE_W,
  type Scene,
  type SceneCharacter,
  type SceneIndex,
  type SceneIndexBubble,
  type SceneIndexEntry,
  type SceneProp,
  type ScenesFile,
} from './types.ts'

/** Default character scale: an adult is about 260 of the 360 units tall. */
export const CHAR_SCALE = 0.62
export const FLOOR = 336

const FIG_CX = 150
const FIG_FLOOR = 432

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Group with its local origin at `at` (pivot), extra transform after the translate. */
function pivotGroup(cls: string, at: Pt, extra: string, body: string): string {
  return `<g transform="translate(${num(at.x)} ${num(at.y)})${extra}"><g class="${cls}">${body}</g></g>`
}

interface PlacedChar {
  svg: string
  anchors: FigureAnchors
}

function placeChar(c: SceneCharacter, index: number, held: { p: SceneProp; countFrom: number }[] = []): PlacedChar {
  const spec = CHARACTERS.find((s) => s.id === c.id)
  if (!spec) throw new Error(`unknown character ${c.id}`)
  const pose = c.pose ?? 'stand'
  if (!(pose in POSES)) throw new Error(`unknown pose ${pose}`)
  const view = c.view ?? 'front'
  const act = c.act
  const s = (c.scale ?? 1) * CHAR_SCALE
  const fx = c.flip ? -1 : 1
  const opts = {
    anim: true,
    fingers: c.fingers,
    armClass: act === 'arm-left' ? { left: 'act' } : act === 'arm-right' ? { right: 'act' } : undefined,
    headClass: act === 'head' ? 'act' : undefined,
    upperClass: act === 'upper' ? 'act' : undefined,
  }
  let fig = posedFigure(spec, view, c.expression ?? 'neutral', pose, opts)
  if (held.length) {
    // things in the hands live inside the upper body, so they move with it
    const raw = fig.anchors.handsRaw
    const heldSvg = held
      .map(({ p, countFrom }) => {
        const side = (p.hold as [number, 'left' | 'right'])[1]
        const h = raw[side]
        const k = (p.scale ?? 1) / s
        const at = { x: h.x + (fx * p.x) / s, y: h.y + p.y / s }
        return placeProp({ ...p, scale: undefined, flip: undefined }, [at], countFrom, `${p.rotate ? ` rotate(${fx * p.rotate})` : ''} scale(${num(fx * (p.flip ? -1 : 1) * k)} ${num(k)})`)
      })
      .join('')
    fig = posedFigure(spec, view, c.expression ?? 'neutral', pose, { ...opts, held: heldSvg })
  }
  const x = c.x
  const y = c.y ?? FLOOR
  const cls = ['char', `c-${index + 1}`, `ch-${c.id}`, act === 'char' ? 'act' : '', ...(c.roles ?? [])].filter(Boolean).join(' ')
  const inner = `<g transform="translate(${-FIG_CX} ${-FIG_FLOOR})">${fig.svg}</g>`
  const svg = pivotGroup(cls, { x, y }, `${c.rotate ? ` rotate(${num(c.rotate)})` : ''} scale(${num(fx * s)} ${num(s)})`, inner)
  const rad = ((c.rotate ?? 0) * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const map = (p: Pt): Pt => {
    const lx = fx * s * (p.x - FIG_CX)
    const ly = s * (p.y - FIG_FLOOR)
    return rad ? { x: x + lx * cos - ly * sin, y: y + lx * sin + ly * cos } : { x: x + lx, y: y + ly }
  }
  const a = fig.anchors
  return {
    svg,
    anchors: {
      mouth: map(a.mouth),
      headTop: map(a.headTop),
      headCenter: map(a.headCenter),
      hands: { left: map(a.hands.left), right: map(a.hands.right) },
      handsRaw: { left: map(a.handsRaw.left), right: map(a.handsRaw.right) },
      chest: map(a.chest),
    },
  }
}

function propCopies(p: SceneProp): Pt[] {
  const n = p.count ?? p.repeat ?? 1
  const cols = Math.min(p.cols ?? n, n)
  const dx = p.dx ?? 50
  const dy = p.dy ?? 50
  const rows = Math.ceil(n / cols)
  const pts: Pt[] = []
  for (let i = 0; i < n; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    const inRow = row === rows - 1 ? n - row * cols : cols
    pts.push({ x: p.x - ((inRow - 1) * dx) / 2 + col * dx, y: p.y + row * dy })
  }
  return pts
}

function placeProp(p: SceneProp, at: Pt[], countFrom: number, forced?: string): string {
  if (!PROPS[p.id]) throw new Error(`unknown prop ${p.id}`)
  const body = drawProp(p.id, { value: p.value, variant: p.variant, color: p.color })
  const s = p.scale ?? 1
  const roles = p.roles ?? []
  const counting = (p.count ?? 1) > 1 || p.count === 1
  return at
    .map((pt, i) => {
      const cls = ['prop', `p-${p.id}`, p.id === 'digit' ? 'digit' : '', counting ? `count-item ci-${countFrom + i}` : '', ...roles].filter(Boolean).join(' ')
      const extra = forced ?? `${p.rotate ? ` rotate(${p.rotate})` : ''}${s !== 1 || p.flip ? ` scale(${num((p.flip ? -1 : 1) * s)} ${num(s)})` : ''}`
      return pivotGroup(cls, pt, extra, body)
    })
    .join('')
}

const PANEL_BOXES: Record<number, Box[]> = {
  1: [{ x: 0, y: 0, w: SCENE_W, h: SCENE_H }],
  2: [
    { x: 8, y: 8, w: 228, h: 344 },
    { x: 244, y: 8, w: 228, h: 344 },
  ],
}

export interface ComposedScene {
  svg: string
  entry: SceneIndexEntry
}

export function composeScene(scene: Scene): ComposedScene {
  const boxes = PANEL_BOXES[scene.panels.length]
  if (!boxes) throw new Error(`${scene.wordId}: 1 or 2 panels`)
  const layers: string[] = []
  const bubblesOut: SceneIndexBubble[] = []
  let charIndex = 0
  let countIndex = 1
  if (scene.panels.length > 1) layers.push(el('rect', { x: 0, y: 0, width: SCENE_W, height: SCENE_H, fill: '#FFF7E8', stroke: 'none' }))
  scene.panels.forEach((panel, pi) => {
    const box = boxes[pi]
    const bgId = panel.background ?? scene.background
    const bg = BACKGROUNDS[bgId]
    if (!bg) throw new Error(`${scene.wordId}: unknown background ${bgId}`)
    const back: string[] = []
    const front: string[] = []
    const heldBy = new Map<number, { p: SceneProp; countFrom: number }[]>()
    for (const p of panel.props) {
      const countFrom = countIndex
      if (p.count !== undefined) countIndex += p.count
      if (p.hold) {
        const ci = p.hold[0]
        if (!panel.characters[ci]) throw new Error(`${scene.wordId}: hold refers to missing character ${ci}`)
        heldBy.set(ci, [...(heldBy.get(ci) ?? []), { p, countFrom }])
        continue
      }
      const svg = placeProp(p, propCopies(p), countFrom)
      ;(p.front ? front : back).push(svg)
    }
    const firstChar = charIndex
    const placed = panel.characters.map((c, i) => placeChar(c, charIndex++, heldBy.get(i)))
    const bubbles = (panel.bubbles ?? []).map((b, bi) => {
      const target = b.from === undefined ? null : placed[b.from]?.anchors.mouth
      if (b.from !== undefined && !target) throw new Error(`${scene.wordId}: bubble from missing character ${b.from}`)
      const drawn = drawBubble(b, target ?? null)
      if (b.text) {
        const pc = (v: number, of: number) => Math.round((v / of) * 10000) / 100
        const out: SceneIndexBubble = { x: pc(b.x, SCENE_W), y: pc(b.y, SCENE_H), w: pc(b.w, SCENE_W), h: pc(b.h, SCENE_H), text: b.text, highlight: b.highlight ?? false, panel: pi + 1 }
        if (b.line !== undefined) out.line = b.line
        if (b.line !== undefined && b.from !== undefined) out.char = firstChar + b.from + 1
        bubblesOut.push(out)
      }
      const cls = ['bubble', `b-${bi + 1}`, b.text ? 'has-text' : '', b.line !== undefined ? `line-${b.line}` : ''].filter(Boolean).join(' ')
      return `<g transform="translate(${num(drawn.pivot.x)} ${num(drawn.pivot.y)})"><g class="${cls}"><g transform="translate(${num(-drawn.pivot.x)} ${num(-drawn.pivot.y)})">${drawn.svg}</g></g></g>`
    })
    const content = [bg(box), ...back, ...placed.map((c) => c.svg), ...front, ...bubbles].join('')
    if (scene.panels.length > 1) {
      layers.push(`<g class="panel panel-${pi + 1}">${content}${el('rect', { x: box.x, y: box.y, width: box.w, height: box.h, rx: 14, fill: 'none', 'stroke-width': 4 })}</g>`)
    } else {
      layers.push(content)
    }
  })
  const root = el('g', { stroke: INK, 'stroke-width': 3.5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, layers)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${SCENE_VIEWBOX}" role="img" aria-label="${esc(scene.alt.en)}">${root}</svg>\n`
  return {
    svg,
    entry: { file: `${scene.wordId}.svg`, alt: scene.alt, play: scene.play, bubbles: bubblesOut },
  }
}

/** Where the characters' heads and mouths are, per panel (in scene units), e.g. to keep balloons off faces. */
export function characterAnchors(scene: Scene): FigureAnchors[][] {
  let n = 0
  return scene.panels.map((panel) => panel.characters.map((c) => placeChar(c, n++).anchors))
}

/**
 * Box around a character's face (hair and hat included, roughly), in scene units. Balloons must not
 * cover it.
 */
export function faceBox(c: SceneCharacter, a: FigureAnchors): Box {
  const s = (c.scale ?? 1) * CHAR_SCALE
  const r = 64 * s
  const cx = a.headCenter.x
  const cy = a.headCenter.y
  return { x: cx - r, y: cy - 70 * s, w: 2 * r, h: 70 * s + 54 * s }
}

/** Every output file, keyed by path relative to public/art/scenes/. */
export function buildScenes(file: ScenesFile): Map<string, string> {
  const out = new Map<string, string>()
  const index: SceneIndex = { version: 1, viewBox: SCENE_VIEWBOX, scenes: {} }
  for (const scene of file.scenes) {
    const { svg, entry } = composeScene(scene)
    out.set(`${scene.wordId}.svg`, svg)
    index.scenes[scene.wordId] = entry
  }
  // one line per scene: small to download, still readable in a diff
  const lines = Object.entries(index.scenes).map(([id, e]) => `    ${JSON.stringify(id)}: ${JSON.stringify(e)}`)
  out.set('index.json', `{\n  "version": 1,\n  "viewBox": ${JSON.stringify(index.viewBox)},\n  "scenes": {\n${lines.join(',\n')}\n  }\n}\n`)
  return out
}
