// Assembles a character from the shared parts and writes the SVG documents + manifest.
// buildAll() is pure (returns path -> file content), so the build script and the test share it.
import { arm, armGeom, CX, makeRig, shadow } from './body.ts'
import { posedArm, posedArmGeom, POSES, shoulderPoint, type ArmPose, type Pose, type PoseId, type PosedArm } from './pose.ts'
import type { Pt } from './svg.ts'
import { earSide, earsFront, FACE_FRONT, FACE_SIDE, faceFront, faceSide } from './head.ts'
import { hairLayers, hat } from './hair.ts'
import { outfitFor } from './outfits.ts'
import { CHARACTERS } from './specs.ts'
import { el, group, INK, num, shape } from './svg.ts'
import { EXPRESSIONS, VIEWS, type CharacterSpec, type Expression, type Rig, type View } from './types.ts'

export const VIEWBOX = '0 0 300 470'
export const WIDTH = 300
export const HEIGHT = 470

function headTransform(view: View, b: Rig): { transform: string; 'stroke-width': string } {
  const hs = b.p.headScale
  const x = view === 'side' ? CX + 4 : CX
  return { transform: `translate(${num(x)} ${num(b.headY)}) scale(${hs})`, 'stroke-width': num(4 / hs) }
}

function head(spec: CharacterSpec, view: View, expr: Expression, b: Rig, withFace = true): { far: string; head: string } {
  const k = 1 / b.p.headScale
  const hair = hairLayers(spec, view, k)
  const t = headTransform(view, b)
  const far = hair.far ? group('hair-far', hair.far, t) : ''
  let parts: string[]
  if (view === 'front') {
    parts = [
      group('hair-back', hair.back),
      earsFront(spec.skin, k),
      shape(FACE_FRONT, spec.skin, { cls: 'face' }),
      group('hair', hair.front),
      withFace ? faceFront(spec, expr, k) : '',
      hat(spec, view, k),
    ]
  } else if (view === 'side') {
    parts = [
      group('hair-back', hair.back),
      shape(FACE_SIDE, spec.skin, { cls: 'face' }),
      group('hair', hair.front),
      hair.coversEars ? '' : earSide(spec.skin, k),
      faceSide(spec, k),
      hat(spec, view, k),
    ]
  } else {
    parts = [shape(FACE_FRONT, spec.skin, { cls: 'face' }), earsFront(spec.skin, k), group('hair', hair.back), hat(spec, view, k)]
  }
  return { far, head: group('head', parts, t) }
}

const FIGURE_ATTRS = { stroke: INK, 'stroke-width': 4, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' } as const

/** Front-view face (brows, eyes, mouth...) alone, positioned like inside the figure. */
export function faceLayer(spec: CharacterSpec, expr: Expression): string {
  const b = makeRig(spec)
  return el('g', FIGURE_ATTRS, group('head', faceFront(spec, expr, 1 / b.p.headScale), headTransform('front', b)))
}

/** The figure without the <svg> wrapper, in the shared 300x470 frame. With withFace=false the
 * front face features are left out (the sheet draws them on top of one shared body). */
export function figure(spec: CharacterSpec, view: View, expr: Expression = 'neutral', withFace = true): string {
  const b = makeRig(spec)
  const o = outfitFor(spec)
  const st = { ...o.arms, skin: spec.skin }
  const armWith = (side: 'left' | 'right') => {
    const item = o.item && o.item.side === side ? o.item.draw(view, b, armGeom(view, b, side, st.spread ?? 0).hand) : ''
    return arm(view, b, side, st, item)
  }
  const h = head(spec, view, expr, b, withFace)
  const legs = o.legs(view, b)
  const body = group('body', o.torso(view, b))
  const behind = o.behind ? o.behind(view, b) : ''
  let layers: string[]
  if (view === 'side') {
    layers = [h.far, behind, armWith('right'), legs, body, h.head, armWith('left')]
  } else {
    layers = [h.far, behind, legs, armWith('left'), armWith('right'), body, h.head]
  }
  return [
    shadow(b),
    el('g', { class: 'figure', ...FIGURE_ATTRS }, layers),
  ].join('')
}

function svgDoc(viewBox: string, label: string, body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" role="img" aria-label="${label}">${body}</svg>\n`
}

const VIEW_LABEL: Record<View, string> = { front: 'front view', side: 'side view facing right', back: 'back view' }

export function characterFile(spec: CharacterSpec, view: View, expr: Expression = 'neutral'): string {
  const what = expr === 'neutral' ? VIEW_LABEL[view] : `${expr} face, front view`
  return svgDoc(VIEWBOX, `${spec.label}, ${what}`, figure(spec, view, expr))
}

/** Seven frames: front, side, back, then the four expressions. The front body is defined once
 * and reused (<use>) under each face, which keeps the file small. */
export function sheetFile(spec: CharacterSpec): string {
  const baseId = `${spec.id}-front-body`
  const defs = el('defs', {}, el('g', { id: baseId }, figure(spec, 'front', 'neutral', false)))
  const useBase = `<use href="#${baseId}"/>`
  const frames: string[] = []
  const items: [View, Expression][] = [...VIEWS.map((v): [View, Expression] => [v, 'neutral']), ...EXPRESSIONS.map((e): [View, Expression] => ['front', e])]
  items.forEach(([v, e], i) => {
    const content = v === 'front' ? useBase + faceLayer(spec, e) : figure(spec, v, e)
    frames.push(el('g', { class: `frame frame-${v === 'front' && e !== 'neutral' ? e : v}`, transform: i === 0 ? undefined : `translate(${i * WIDTH} 0)` }, content))
  })
  return svgDoc(`0 0 ${items.length * WIDTH} ${HEIGHT}`, `${spec.label}: character sheet with front, side and back views and four expressions`, defs + frames.join(''))
}

// ---------- posed figures for scenes ----------

export interface FigureAnchors {
  mouth: Pt
  headTop: Pt
  headCenter: Pt
  hands: { left: Pt; right: Pt }
  /** hand centres before the body lean (coordinates inside the upper-body group) */
  handsRaw: { left: Pt; right: Pt }
  chest: Pt
}

export interface PosedFigure {
  /** figure markup in the 300x470 frame (feet at y=432) */
  svg: string
  anchors: FigureAnchors
}

export interface PosedOptions {
  /** wrap animated parts (char parts, head, arms, eyes) in pivot groups for CSS animation */
  anim?: boolean
  /** fingers shown by the 'count' pose (1-5), or by 'countBoth' (6-10: five on the left hand) */
  fingers?: number
  /** extra class names for arm groups, e.g. { left: 'act' } */
  armClass?: Partial<Record<'left' | 'right', string>>
  headClass?: string
  upperClass?: string
  /** markup drawn on top of the upper body (things held in the hands), in figure coordinates */
  held?: string
}

const rotAround = (p: Pt, c: Pt, deg: number): Pt => {
  if (!deg) return p
  const r = (deg * Math.PI) / 180
  const dx = p.x - c.x
  const dy = p.y - c.y
  return { x: c.x + dx * Math.cos(r) - dy * Math.sin(r), y: c.y + dx * Math.sin(r) + dy * Math.cos(r) }
}

/** Group whose local origin is the pivot point, so CSS transforms rotate/scale around it. */
export function pivot(cls: string, at: Pt, body: string, extra = ''): string {
  if (body === '') return ''
  const x = num(at.x)
  const y = num(at.y)
  return `<g transform="translate(${x} ${y})${extra}"><g class="${cls}"><g transform="translate(${num(-at.x)} ${num(-at.y)})">${body}</g></g></g>`
}

/**
 * A character in any pose from POSES, using the same parts as the character sheets. Arms
 * without pose data keep the sheet's resting arm.
 */
export function posedFigure(spec: CharacterSpec, view: View, expr: Expression, poseId: PoseId, opts: PosedOptions = {}): PosedFigure {
  const pose: Pose = POSES[poseId]
  const s2: CharacterSpec = pose.sit ? { ...spec, body: { ...spec.body, legLen: spec.body.legLen * 0.42 } } : spec
  const b = makeRig(s2)
  const o = outfitFor(spec)
  const st = { ...o.arms, skin: spec.skin }
  const anim = opts.anim ?? false
  const hipC = { x: CX, y: b.hipY }
  const chinC = { x: view === 'side' ? CX + 2 : CX, y: b.chinY }
  const lean = pose.lean ?? 0
  const tilt = pose.head ?? 0

  const hands: Record<'left' | 'right', Pt> = { left: { x: 0, y: 0 }, right: { x: 0, y: 0 } }
  const drawArm = (side: 'left' | 'right'): { svg: string; front: boolean } => {
    const ap: ArmPose | undefined = pose[side]
    const cls = opts.armClass?.[side]
    let svg: string
    let front = false
    if (!ap) {
      const g = armGeom(view, b, side, st.spread ?? 0)
      const item = o.item && o.item.side === side ? o.item.draw(view, b, g.hand) : ''
      svg = arm(view, b, side, st, item)
      hands[side] = g.hand
    } else {
      const g: PosedArm = posedArmGeom(view, b, side, ap)
      // more than five fingers: five on the left hand, the rest on the right (pose countBoth)
      const fingers = opts.fingers !== undefined && opts.fingers > 5 ? (side === 'left' ? 5 : opts.fingers - 5) : opts.fingers
      svg = posedArm(g, ap, st, side, fingers)
      hands[side] = g.hand
      front = ap.front ?? false
    }
    if (cls) svg = svg.replace(`class="arm-${side}"`, `class="arm-${side} ${cls}"`)
    if (anim) {
      const m = /^<g class="([^"]+)">([\s\S]*)<\/g>$/.exec(svg)
      if (m) svg = pivot(m[1], shoulderPoint(view, b, side), m[2])
    }
    return { svg, front }
  }

  // head (with pivot at the chin)
  const k = 1 / b.p.headScale
  const hs = b.p.headScale
  const hx = view === 'side' ? CX + 4 : CX
  const hair = hairLayers(spec, view, k)
  const t = headTransform(view, b)
  const far = hair.far ? group('hair-far', hair.far, t) : ''
  let face: string[]
  if (view === 'side') {
    face = [group('hair-back', hair.back), shape(FACE_SIDE, spec.skin, { cls: 'face' }), group('hair', hair.front), hair.coversEars ? '' : earSide(spec.skin, k), faceSide(spec, k), hat(spec, view, k)]
  } else if (view === 'front') {
    face = [group('hair-back', hair.back), earsFront(spec.skin, k), shape(FACE_FRONT, spec.skin, { cls: 'face' }), group('hair', hair.front), faceFront(spec, expr, k), hat(spec, view, k)]
  } else {
    face = [shape(FACE_FRONT, spec.skin, { cls: 'face' }), earsFront(spec.skin, k), group('hair', hair.back), hat(spec, view, k)]
  }
  let faceSvg = face.join('')
  if (anim) {
    const eyeY = view === 'side' ? 3 : 4
    const eyeX = view === 'side' ? 33 : 0
    faceSvg = faceSvg.replace(/<g class="eyes">([\s\S]*?)<\/g>/, (_m, inner: string) => pivot('eyes', { x: eyeX, y: eyeY }, inner))
  }
  const headClass = ['head', opts.headClass].filter(Boolean).join(' ')
  const headInner = el('g', t, faceSvg)
  const tiltAttr = tilt ? ` rotate(${tilt})` : ''
  const headSvg = anim
    ? pivot(headClass, chinC, headInner, tiltAttr)
    : `<g transform="translate(${num(chinC.x)} ${num(chinC.y)})${tiltAttr} translate(${num(-chinC.x)} ${num(-chinC.y)})">${el('g', { class: headClass, ...t }, faceSvg)}</g>`

  const legs = o.legs(view, b)
  const body = group('body', o.torso(view, b))
  const behind = o.behind ? o.behind(view, b) : ''
  const L = drawArm('left')
  const R = drawArm('right')
  let upper: string[]
  if (view === 'side') {
    upper = [far, behind, R.svg, body, headSvg, L.svg]
  } else {
    const back = [L, R].filter((a) => !a.front).map((a) => a.svg)
    const fr = [L, R].filter((a) => a.front).map((a) => a.svg)
    upper = [far, behind, ...back, body, headSvg, ...fr]
  }
  if (opts.held) upper.push(opts.held)
  const upperSvg = upper.join('')
  const leanAttr = lean ? ` rotate(${lean})` : ''
  const upperClass = ['upper', opts.upperClass].filter(Boolean).join(' ')
  const upperWrapped = anim || lean
    ? anim
      ? pivot(upperClass, hipC, upperSvg, leanAttr)
      : `<g transform="translate(${num(hipC.x)} ${num(hipC.y)})${leanAttr} translate(${num(-hipC.x)} ${num(-hipC.y)})">${upperSvg}</g>`
    : upperSvg

  const svg = [shadow(b), el('g', { class: 'figure', ...FIGURE_ATTRS }, [legs, upperWrapped])].join('')

  // anchors in figure coordinates (after head tilt and body lean)
  const headPt = (lx: number, ly: number) => rotAround(rotAround({ x: hx + lx * hs, y: b.headY + ly * hs }, chinC, tilt), hipC, lean)
  const anchors: FigureAnchors = {
    mouth: view === 'side' ? headPt(46, 34) : headPt(0, 36),
    headTop: headPt(0, -60),
    headCenter: headPt(0, 0),
    hands: { left: rotAround(hands.left, hipC, lean), right: rotAround(hands.right, hipC, lean) },
    handsRaw: { left: hands.left, right: hands.right },
    chest: rotAround({ x: CX, y: b.shoulderY + b.p.torsoLen * 0.35 }, hipC, lean),
  }
  return { svg, anchors }
}

export const LINEUP_STEP = 190

export function lineupFile(): string {
  const frames = CHARACTERS.map((spec, i) =>
    el('g', { class: `frame frame-${spec.id}`, transform: i === 0 ? undefined : `translate(${i * LINEUP_STEP} 0)` }, figure(spec, 'front')),
  )
  const w = (CHARACTERS.length - 1) * LINEUP_STEP + WIDTH
  const floor = `<path class="floor" d="M10 432H${w - 10}" fill="none" stroke="${INK}" stroke-width="3" opacity="0.25"/>`
  return svgDoc(`0 0 ${w} ${HEIGHT}`, 'All characters standing side by side on one floor line', floor + frames.join(''))
}

export interface Manifest {
  version: 1
  viewBox: string
  views: View[]
  expressions: string[]
  characters: {
    id: string
    name: { id: string; en: string }
    gender: 'male' | 'female'
    role: 'family' | 'support'
    files: { front: string; side: string; back: string; expressions: Record<string, string>; sheet: string }
  }[]
}

export function manifest(): Manifest {
  return {
    version: 1,
    viewBox: VIEWBOX,
    views: [...VIEWS],
    expressions: [...EXPRESSIONS],
    characters: CHARACTERS.map((c) => ({
      id: c.id,
      name: c.name,
      gender: c.gender,
      role: c.role,
      files: {
        front: `${c.id}/front.svg`,
        side: `${c.id}/side.svg`,
        back: `${c.id}/back.svg`,
        expressions: Object.fromEntries(EXPRESSIONS.map((e) => [e, `${c.id}/expr-${e}.svg`])),
        sheet: `${c.id}/sheet.svg`,
      },
    })),
  }
}

/** Every output file, keyed by path relative to public/art/characters/. */
export function buildAll(): Map<string, string> {
  const out = new Map<string, string>()
  for (const spec of CHARACTERS) {
    for (const v of VIEWS) out.set(`${spec.id}/${v}.svg`, characterFile(spec, v))
    for (const e of EXPRESSIONS) out.set(`${spec.id}/expr-${e}.svg`, characterFile(spec, 'front', e))
    out.set(`${spec.id}/sheet.svg`, sheetFile(spec))
  }
  out.set('lineup.svg', lineupFile())
  out.set('manifest.json', `${JSON.stringify(manifest(), null, 2)}\n`)
  return out
}
