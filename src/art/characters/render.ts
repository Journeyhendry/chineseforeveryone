// Assembles a character from the shared parts and writes the SVG documents + manifest.
// buildAll() is pure (returns path -> file content), so the build script and the test share it.
import { arm, armGeom, CX, makeRig, shadow } from './body.ts'
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
