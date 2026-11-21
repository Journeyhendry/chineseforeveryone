// Shared body parts: rig (where everything sits for a given set of proportions), torso, neck,
// arms with sleeves, hands, legs, skirts and shoes, for the front, side (facing right) and back
// views. Absolute viewBox coordinates; every character stands on the floor line FLOOR_Y.
import { circle, d, ellipse, group, INK, quadPoint, quadSlice, shape, tube, type Pt } from './svg.ts'
import type { CharacterSpec, Rig, View } from './types.ts'

export const CX = 150
export const FLOOR_Y = 432
export const SHADOW_Y = 446

export function makeRig(spec: CharacterSpec): Rig {
  const p = spec.body
  const shoeH = 26 * p.shoeScale
  const shoeTop = FLOOR_Y - shoeH
  const hipY = shoeTop - p.legLen
  const hemY = hipY + 6
  const shoulderY = hemY - p.torsoLen
  const chinY = shoulderY - p.neckLen
  const headY = chinY - 54 * p.headScale
  return { skin: spec.skin, skinShade: spec.skinShade, cx: CX, floorY: FLOOR_Y, shoeTop, hipY, hemY, shoulderY, chinY, headY, p }
}

export function shadow(b: Rig): string {
  const rx = Math.max(52, b.p.hemHalf + 26)
  return ellipse(CX, SHADOW_Y, rx, 10, INK, { stroke: false, opacity: 0.12, cls: 'shadow' })
}

// ---------- torso ----------

export interface TorsoOpts {
  /** extra length below the hem (coats, dresses) */
  extend?: number
  /** half-width at the bottom edge (defaults to hemHalf, grows with extend) */
  bottomHalf?: number
  /** shoulder half-width override */
  shoulderHalf?: number
}

export function torsoFrontPath(b: Rig, o: TorsoOpts = {}): string {
  const sh = o.shoulderHalf ?? b.p.shoulderHalf
  const r = Math.min(18, sh * 0.4)
  const bottom = b.hemY + (o.extend ?? 0)
  const bh = o.bottomHalf ?? b.p.hemHalf + (o.extend ?? 0) * 0.12
  const y = b.shoulderY
  return d(
    'M', CX - sh, y + r, 'Q', CX - sh, y + 2, CX - sh + r, y,
    'L', CX + sh - r, y, 'Q', CX + sh, y + 2, CX + sh, y + r,
    'L', CX + bh, bottom, 'L', CX - bh, bottom, 'Z',
  )
}

/** Half depth of the torso in the side view. */
export function sideDepth(b: Rig): number {
  return Math.round(b.p.shoulderHalf * 0.7)
}

export function torsoSidePath(b: Rig, o: TorsoOpts = {}): string {
  const dd = sideDepth(b)
  const y = b.shoulderY
  const bottom = b.hemY + (o.extend ?? 0)
  const flare = 2 + (o.extend ?? 0) * 0.1 + ((o.bottomHalf ?? b.p.hemHalf) - b.p.hemHalf) * 0.5
  const r = Math.min(16, dd * 0.55)
  return d(
    'M', CX - dd, y + r, 'Q', CX - dd, y, CX - dd + r, y,
    'L', CX + dd - r, y, 'Q', CX + dd, y + 1, CX + dd, y + r + 2,
    'L', CX + dd + flare, bottom, 'L', CX - dd - flare, bottom, 'Z',
  )
}

export function torso(view: View, b: Rig, fill: string, o: TorsoOpts = {}): string {
  return shape(view === 'side' ? torsoSidePath(b, o) : torsoFrontPath(b, o), fill)
}

export function neck(view: View, b: Rig, shade: string): string {
  const w = 22 * b.p.headScale
  const x = view === 'side' ? CX - 2 - w / 2 : CX - w / 2
  const top = b.chinY - 8
  const h = b.shoulderY + 6 - top
  return group('neck', `<rect x="${n(x)}" y="${n(top)}" width="${n(w)}" height="${n(h)}" rx="6" fill="${shade}"/>`)
}

const n = (v: number) => String(Math.round(v * 10) / 10)

export function buttons(xs: number, ys: number[], fill: string, r = 3.5): string {
  return group('buttons', ys.map((y) => circle(xs, y, r, fill, { sw: 2.5 })))
}

// ---------- arms ----------

export interface ArmStyle {
  sleeve: string
  /** 1 = long sleeve, smaller = short sleeve ending at that fraction of the arm */
  sleeveFrac: number
  skin: string
  hand?: string
  /** colored band over part of the arm, e.g. oversleeves, cuffs, rolled sleeves: [from, to, color, extra width] */
  band?: [number, number, string, number?]
  /** extra outward spread of the hands (for flared clothes) */
  spread?: number
}

export interface ArmGeom {
  s: Pt
  c: Pt
  e: Pt
  hand: Pt
  w: number
  handR: number
}

export function armGeom(view: View, b: Rig, side: 'left' | 'right', spread = 0): ArmGeom {
  const p = b.p
  const w = p.armHalf
  const handR = 13 * (w / 10)
  const y0 = b.shoulderY
  const a = p.armLen
  if (view === 'side') {
    // facing right: the near arm is the character's left arm
    const near = side === 'left'
    const x = near ? CX - 4 : CX + 4
    const s = { x, y: y0 + 14 }
    const c = { x: x + (near ? 6 : 12), y: y0 + 14 + a * 0.5 }
    const e = { x: x + (near ? 10 : 16), y: y0 + 12 + a }
    return { s, c, e, hand: { x: e.x, y: e.y + 6 }, w, handR }
  }
  // front: the character's right arm is on the viewer's left; back: the other way round
  const sign = (view === 'front') === (side === 'right') ? -1 : 1
  const sh = p.shoulderHalf
  const s = { x: CX + sign * (sh - 10), y: y0 + 16 }
  const c = { x: CX + sign * (sh + 10 + spread * 0.5), y: y0 + 16 + a * 0.32 }
  const e = { x: CX + sign * (sh + 12 + spread), y: y0 + 16 + a }
  return { s, c, e, hand: { x: e.x, y: e.y + 6 }, w, handR }
}

export function arm(view: View, b: Rig, side: 'left' | 'right', st: ArmStyle, item = ''): string {
  const g = armGeom(view, b, side, st.spread ?? 0)
  const parts: string[] = []
  if (st.sleeveFrac >= 1) {
    parts.push(shape(tube(g.s, g.c, g.e, g.w), st.sleeve))
  } else {
    parts.push(shape(tube(g.s, g.c, g.e, g.w * 0.92), st.skin))
    const [a, bb, c] = quadSlice(g.s, g.c, g.e, 0, st.sleeveFrac)
    parts.push(shape(tube(a, bb, c, g.w + 2), st.sleeve))
  }
  if (st.band) {
    const [from, to, color, extra] = st.band
    const [a, bb, c] = quadSlice(g.s, g.c, g.e, from, to)
    parts.push(shape(tube(a, bb, c, g.w + (extra ?? 1.5)), color))
  }
  parts.push(item)
  parts.push(circle(g.hand.x, g.hand.y, g.handR, st.hand ?? st.skin, { cls: 'hand' }))
  return group(`arm-${side}`, parts)
}

export function pointOnArm(view: View, b: Rig, side: 'left' | 'right', t: number, spread = 0): Pt {
  const g = armGeom(view, b, side, spread)
  return quadPoint(g.s, g.c, g.e, t)
}

// ---------- legs ----------

export function legCenters(b: Rig): [number, number] {
  const off = 2 + b.p.legWidth / 2
  return [CX - off, CX + off]
}

export function legBottom(b: Rig): number {
  return b.shoeTop + 14 * b.p.shoeScale
}

/** Trouser legs from hipY down into the shoes. */
export function pants(view: View, b: Rig, fill: string): string {
  const W = b.p.legWidth
  const yb = legBottom(b)
  if (view === 'side') {
    const legs = [CX + 10, CX - 6].map((lc) =>
      shape(d('M', lc - W / 2, b.hipY, 'L', lc + W / 2, b.hipY, 'L', lc + W / 2 - 3, yb, 'L', lc - W / 2 + 2, yb, 'Z'), fill),
    )
    return legs.join('')
  }
  return legCenters(b)
    .map((lc, i) => {
      const inner = i === 0 ? lc + W / 2 : lc - W / 2
      const outer = i === 0 ? lc - W / 2 : lc + W / 2
      const dir = i === 0 ? -1 : 1
      return shape(d('M', outer, b.hipY, 'L', inner, b.hipY, 'L', inner + dir * 2, yb, 'L', outer - dir * 4, yb, 'Z'), fill)
    })
    .join('')
}

/** Bare (or stockinged) legs under a skirt or dress, with optional socks. */
export function bareLegs(view: View, b: Rig, fill: string, top: number, sock?: string): string {
  const W = b.p.legWidth * 0.62
  const yb = legBottom(b)
  const centers = view === 'side' ? [CX + 10, CX - 6] : legCenters(b).map((c, i) => c + (i === 0 ? 3 : -3))
  const out: string[] = []
  for (const lc of centers) {
    out.push(shape(d('M', lc - W / 2, top, 'L', lc + W / 2, top, 'L', lc + W / 2 - 1, yb, 'L', lc - W / 2 + 1, yb, 'Z'), fill))
    if (sock) {
      const st = b.shoeTop - 10 * b.p.shoeScale
      out.push(shape(d('M', lc - W / 2 - 1, st, 'L', lc + W / 2 + 1, st, 'L', lc + W / 2 + 1, yb, 'L', lc - W / 2 - 1, yb, 'Z'), sock))
    }
  }
  return out.join('')
}

export type ShoeStyle = 'shoe' | 'sneaker' | 'flat' | 'kid' | 'cloth'

function shoeFront(lc: number, dir: number, top: number, k: number, fill: string, style: ShoeStyle, sole?: string): string {
  // dir = -1 toe points to the viewer's left, +1 to the right
  const x = (v: number) => lc - dir * v * k
  const y = (v: number) => top + v * k
  const outline = d(
    'M', x(18), y(12), 'Q', x(18), y(0), x(10), y(0),
    'L', x(-12), y(0), 'Q', x(-22), y(0), x(-23), y(12),
    'L', x(-27), y(20), 'Q', x(-29), y(26), x(-23), y(26),
    'L', x(18), y(26), 'Z',
  )
  const parts = [shape(outline, fill)]
  if (style === 'sneaker' || style === 'cloth') {
    parts.push(shape(d('M', x(-27), y(20), 'Q', x(-29), y(26), x(-23), y(26), 'L', x(18), y(26), 'L', x(18), y(19), 'Z'), sole ?? '#FFFFFF', { sw: 3 }))
  }
  if (style === 'sneaker') parts.push(shape(d('M', x(-12), y(7), 'L', x(6), y(7)), 'none', { sw: 3 }))
  if (style === 'kid') parts.push(shape(d('M', x(-14), y(1), 'Q', x(-4), y(8), x(10), y(1)), 'none', { sw: 3 }))
  return parts.join('')
}

function shoeSide(lc: number, top: number, k: number, fill: string, style: ShoeStyle, sole?: string): string {
  const x = (v: number) => lc + v * k
  const y = (v: number) => top + v * k
  const outline = d(
    'M', x(-19), y(26), 'L', x(-19), y(6), 'Q', x(-19), y(0), x(-13), y(0),
    'L', x(8), y(0), 'Q', x(14), y(0), x(18), y(7),
    'Q', x(34), y(10), x(35), y(19), 'Q', x(36), y(26), x(29), y(26), 'Z',
  )
  const parts = [shape(outline, fill)]
  if (style === 'sneaker' || style === 'cloth') {
    parts.push(shape(d('M', x(-19), y(19), 'L', x(35.5), y(19), 'Q', x(36), y(26), x(29), y(26), 'L', x(-19), y(26), 'Z'), sole ?? '#FFFFFF', { sw: 3 }))
  }
  if (style === 'sneaker') parts.push(shape(d('M', x(2), y(5), 'L', x(16), y(12)), 'none', { sw: 3 }))
  if (style === 'kid') parts.push(shape(d('M', x(-4), y(1), 'L', x(10), y(10)), 'none', { sw: 3 }))
  return parts.join('')
}

function shoeBack(lc: number, top: number, k: number, fill: string, style: ShoeStyle, sole?: string): string {
  const x = (v: number) => lc + v * k
  const y = (v: number) => top + v * k
  const outline = d('M', x(-20), y(26), 'L', x(-20), y(8), 'Q', x(-20), y(0), x(-12), y(0), 'L', x(12), y(0), 'Q', x(20), y(0), x(20), y(8), 'L', x(20), y(26), 'Z')
  const parts = [shape(outline, fill)]
  if (style === 'sneaker' || style === 'cloth') parts.push(shape(d('M', x(-20), y(19), 'L', x(20), y(19), 'L', x(20), y(26), 'L', x(-20), y(26), 'Z'), sole ?? '#FFFFFF', { sw: 3 }))
  return parts.join('')
}

export function shoes(view: View, b: Rig, fill: string, style: ShoeStyle, sole?: string): string {
  const k = b.p.shoeScale
  const top = b.shoeTop
  if (view === 'side') return [CX + 10, CX - 6].map((lc) => shoeSide(lc, top, k, fill, style, sole)).join('')
  const [l, r] = legCenters(b)
  if (view === 'back') return [shoeBack(l, top, k, fill, style, sole), shoeBack(r, top, k, fill, style, sole)].join('')
  return [shoeFront(l, -1, top, k, fill, style, sole), shoeFront(r, 1, top, k, fill, style, sole)].join('')
}
