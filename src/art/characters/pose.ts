// Poses as data: per arm either joint angles (shoulder + elbow) or a hand target that is solved
// with two-bone IK, plus a small body lean / head tilt. Every character can use every pose: the
// numbers are relative to the character's own proportions, so arms always start at the shoulder.
import { circle, d, group, limb, polySlice, shape, type Pt } from './svg.ts'
import type { Rig, View } from './types.ts'
import { CX, sideDepth } from './body.ts'

export type HandShape = 'fist' | 'open' | 'point' | 'thumb' | 'fingers'

export interface ArmPose {
  /** upper arm angle in degrees from hanging straight down; + = away from the body (front/back
   * view) or forward (side view) */
  a?: number
  /** elbow bend in degrees, added to `a` for the forearm */
  el?: number
  /** instead of angles: where the hand goes. x in shoulder half-widths from the body centre
   * (+ = this arm's own side; side view: + = forward, in torso half-depths), y in torso lengths
   * below the shoulder line (negative = above) */
  to?: [number, number]
  /** IK only: which way the elbow points */
  bend?: 'out' | 'down'
  /** drawn in front of the body and head instead of behind the body */
  front?: boolean
  hand?: HandShape
  /** 'point': finger direction in degrees (same convention as `a`); default = along the forearm */
  aim?: number
}

export interface Pose {
  /** the character's own left arm (viewer's right in the front view, the near arm in the side view) */
  left?: ArmPose
  right?: ArmPose
  /** body lean in degrees around the hips; + = toward the viewer's right / forward in side view */
  lean?: number
  /** head tilt in degrees around the chin; + = clockwise */
  head?: number
  /** sitting: thighs are foreshortened, the body sits lower */
  sit?: boolean
}

/** All poses. Pointing / offering / waving poses use the left arm (toward the viewer's right);
 * mirror the character in a scene to aim the other way. */
export const POSES = {
  stand: {},
  wave: { left: { a: 82, el: 84, hand: 'open' }, head: 4 },
  waveBye: { left: { a: 118, el: 40, hand: 'open' }, head: 5 },
  point: { left: { a: 80, el: 6, hand: 'point' } },
  pointUp: { left: { a: 128, el: 8, hand: 'point' }, head: -4 },
  pointDown: { left: { a: 40, el: -4, hand: 'point' }, head: 6 },
  pointSelf: { right: { to: [0.32, 0.36], bend: 'down', front: true, hand: 'point', aim: -60 }, head: -4 },
  pointSelfLeft: { left: { to: [0.32, 0.36], bend: 'down', front: true, hand: 'point', aim: -60 }, head: 4 },
  bow: { lean: 24, head: 14, left: { a: 6, el: 8 }, right: { a: 6, el: 8 } },
  handsTogether: {
    left: { to: [-0.12, 0.42], bend: 'down', front: true, hand: 'fist' },
    right: { to: [-0.12, 0.42], bend: 'down', front: true, hand: 'fist' },
  },
  shrug: { left: { a: 34, el: 78, hand: 'open' }, right: { a: 34, el: 78, hand: 'open' }, head: 9 },
  thinking: { right: { to: [0.5, -0.06], bend: 'down', front: true, hand: 'fist' }, head: 7 },
  holdObject: {
    left: { to: [0.42, 0.5], bend: 'out', front: true, hand: 'fist' },
    right: { to: [0.42, 0.5], bend: 'out', front: true, hand: 'fist' },
  },
  hug: {
    left: { to: [0.3, 0.44], bend: 'out', front: true, hand: 'fist' },
    right: { to: [0.3, 0.44], bend: 'out', front: true, hand: 'fist' },
  },
  offer: { left: { a: 52, el: 34, hand: 'open' }, head: 4 },
  holdUp: { left: { a: 38, el: 106, hand: 'fist' }, head: 5 },
  raiseHand: { left: { a: 160, el: 6, hand: 'open' }, head: 5 },
  thumbsUp: { left: { a: 26, el: 118, hand: 'thumb' }, head: 5 },
  armsCross: {
    left: { to: [-1.05, -0.38], bend: 'down', front: true, hand: 'open' },
    right: { to: [-1.05, -0.38], bend: 'down', front: true, hand: 'open' },
  },
  count: { left: { a: 30, el: 122, hand: 'fingers' }, head: 4 },
  beckon: { left: { a: 48, el: 60, hand: 'open' }, head: 5 },
  stop: { left: { a: 84, el: 52, hand: 'open' }, lean: -3 },
  reach: { left: { a: 84, el: 4, hand: 'open' }, lean: 4 },
  armsUp: { left: { a: 150, el: 12, hand: 'open' }, right: { a: 150, el: 12, hand: 'open' } },
  armsOpen: { left: { a: 72, el: 18, hand: 'open' }, right: { a: 72, el: 18, hand: 'open' } },
  hips: { left: { to: [1.0, 0.86], bend: 'out', hand: 'fist' }, right: { to: [1.0, 0.86], bend: 'out', hand: 'fist' } },
  headScratch: { left: { to: [0.98, -0.78], bend: 'out', front: true, hand: 'fist' }, head: -6 },
  callOut: { left: { to: [0.82, -0.2], bend: 'down', front: true, hand: 'open' }, right: { a: 10, el: 0 }, head: -4 },
  carry: { left: { a: 12, el: 0, hand: 'fist' } },
  pat: { left: { a: 46, el: -6, hand: 'open' }, lean: 4 },
  sit: { sit: true, left: { to: [0.62, 0.98], bend: 'out', front: true, hand: 'fist' }, right: { to: [0.62, 0.98], bend: 'out', front: true, hand: 'fist' } },
  sitPat: { sit: true, left: { a: 44, el: -6, hand: 'open' }, right: { to: [0.62, 0.98], bend: 'out', front: true, hand: 'fist' } },
  eat: { left: { to: [0.15, -0.32], bend: 'out', front: true, hand: 'fist' }, right: { to: [0.4, 0.62], bend: 'out', front: true, hand: 'fist' }, head: -3 },
  sweep: {
    left: { to: [0.15, 0.3], bend: 'out', front: true, hand: 'fist' },
    right: { to: [-0.2, 0.72], bend: 'out', front: true, hand: 'fist' },
    lean: 6, head: 6,
  },
  hold: { left: { to: [0.7, 0.62], bend: 'out', front: true, hand: 'fist' }, head: 3 },
  holdBoth: {
    left: { to: [0.55, 0.72], bend: 'out', front: true, hand: 'fist' },
    right: { to: [0.55, 0.72], bend: 'out', front: true, hand: 'fist' },
  },
  emptyHands: { left: { a: 38, el: 50, hand: 'open' }, right: { a: 38, el: 50, hand: 'open' }, head: -6 },
  pointHeld: {
    left: { a: 26, el: 104, hand: 'fist' },
    right: { to: [-0.2, 0.32], bend: 'down', front: true, hand: 'point', aim: -75 },
    head: 6,
  },
  pointHold: { left: { a: 80, el: 6, hand: 'point' }, right: { a: 30, el: 112, hand: 'fist' } },
  holdUpBoth: { left: { a: 36, el: 104, hand: 'fist' }, right: { a: 36, el: 104, hand: 'fist' }, head: 3 },
  pointDownHold: { left: { a: 40, el: -4, hand: 'point' }, right: { a: 30, el: 112, hand: 'fist' }, head: 8 },
  holdEar: { left: { to: [1.45, -0.5], bend: 'down', front: true, hand: 'fist' }, head: -8 },
  pinch: { left: { a: 30, el: 112, hand: 'point', aim: 150 }, head: 4 },
} as const satisfies Record<string, Pose>

export type PoseId = keyof typeof POSES
export const POSE_IDS = Object.keys(POSES) as PoseId[]

// ---------- geometry ----------

const rad = (deg: number) => (deg * Math.PI) / 180

export interface PosedArm {
  s: Pt
  e: Pt
  /** end of the arm tube */
  t: Pt
  hand: Pt
  /** unit vector along the forearm (world) */
  f: Pt
  w: number
  handR: number
  /** world x of "outward" for this arm (+1 / -1) */
  sign: number
}

/** World direction for an arm-space angle (0 = down, + = outward / forward). */
function dirFor(sign: number, deg: number): Pt {
  return { x: sign * Math.sin(rad(deg)), y: Math.cos(rad(deg)) }
}

export function armSign(view: View, side: 'left' | 'right'): number {
  if (view === 'side') return 1
  return (view === 'front') === (side === 'right') ? -1 : 1
}

export function shoulderPoint(view: View, b: Rig, side: 'left' | 'right'): Pt {
  const y0 = b.shoulderY
  if (view === 'side') return { x: side === 'left' ? CX - 4 : CX + 4, y: y0 + 14 }
  const sign = armSign(view, side)
  return { x: CX + sign * (b.p.shoulderHalf - 10), y: y0 + 16 }
}

export function posedArmGeom(view: View, b: Rig, side: 'left' | 'right', ap: ArmPose): PosedArm {
  const p = b.p
  const w = p.armHalf
  const handR = 13 * (w / 10)
  const sign = armSign(view, side)
  const s = shoulderPoint(view, b, side)
  const U = p.armLen * 0.52
  const L = p.armLen * 0.5
  let e: Pt
  let hand: Pt
  if (ap.to) {
    const unitX = view === 'side' ? sideDepth(b) : p.shoulderHalf
    const target = { x: CX + sign * ap.to[0] * unitX, y: b.shoulderY + ap.to[1] * p.torsoLen }
    const reach = L + 5
    const dx = target.x - s.x
    const dy = target.y - s.y
    let dist = Math.hypot(dx, dy)
    const maxD = U + reach - 0.5
    const minD = Math.abs(U - reach) + 0.5
    const k = dist > maxD ? maxD / dist : dist < minD ? minD / dist : 1
    dist = Math.max(minD, Math.min(maxD, dist))
    const ux = (dx * k) / dist
    const uy = (dy * k) / dist
    // law of cosines: angle at the shoulder between the target line and the upper arm
    const cosA = (U * U + dist * dist - reach * reach) / (2 * U * dist)
    const A = Math.acos(Math.max(-1, Math.min(1, cosA)))
    const cand = [1, -1].map((sg) => {
      const c = Math.cos(sg * A)
      const sn = Math.sin(sg * A)
      return { x: s.x + U * (ux * c - uy * sn), y: s.y + U * (ux * sn + uy * c) }
    })
    const score = (pt: Pt) => (ap.bend === 'down' ? pt.y : sign * pt.x)
    e = score(cand[0]) >= score(cand[1]) ? cand[0] : cand[1]
    hand = { x: s.x + dx * k, y: s.y + dy * k }
  } else {
    const a = ap.a ?? 10
    const up = dirFor(sign, a)
    e = { x: s.x + up.x * U, y: s.y + up.y * U }
    const fd = dirFor(sign, a + (ap.el ?? 0))
    hand = { x: e.x + fd.x * (L + 5), y: e.y + fd.y * (L + 5) }
  }
  const fl = Math.hypot(hand.x - e.x, hand.y - e.y) || 1
  const f = { x: (hand.x - e.x) / fl, y: (hand.y - e.y) / fl }
  const t = { x: hand.x - f.x * 5, y: hand.y - f.y * 5 }
  return { s, e, t, hand, f, w, handR, sign }
}

// ---------- hands ----------

function fingerTube(from: Pt, dir: Pt, len: number, w: number, fill: string): string {
  const to = { x: from.x + dir.x * len, y: from.y + dir.y * len }
  return shape(limb(from, { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }, to, w), fill, { sw: 3 })
}

const rot = (v: Pt, deg: number): Pt => {
  const c = Math.cos(rad(deg))
  const s = Math.sin(rad(deg))
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c }
}

export function drawHand(g: PosedArm, ap: ArmPose, fill: string, fingers = 5): string {
  const { hand: H, f, handR: r, sign } = g
  const shapeId = ap.hand ?? 'fist'
  // perpendicular on the thumb side: inward and up
  const perpA = { x: -f.y, y: f.x }
  const want = { x: -sign * 0.6, y: -0.8 }
  const perp = perpA.x * want.x + perpA.y * want.y >= 0 ? perpA : { x: -perpA.x, y: -perpA.y }
  switch (shapeId) {
    case 'point': {
      const aim = ap.aim === undefined ? f : dirFor(sign, ap.aim)
      return [fingerTube(H, aim, r * 1.7, r * 0.34, fill), circle(H.x, H.y, r, fill, { cls: 'hand' })].join('')
    }
    case 'thumb': {
      return [
        fingerTube({ x: H.x, y: H.y - r * 0.2 }, { x: 0, y: -1 }, r * 1.55, r * 0.42, fill),
        circle(H.x, H.y, r, fill, { cls: 'hand' }),
        shape(d('M', H.x - sign * r * 0.55, H.y - r * 0.15, 'Q', H.x - sign * r * 0.1, H.y + r * 0.1, H.x + sign * r * 0.45, H.y - r * 0.15), 'none', { sw: 2.5 }),
      ].join('')
    }
    case 'fingers':
    case 'open': {
      const open = shapeId === 'open'
      const n = open ? 5 : Math.max(1, Math.min(5, fingers))
      const base = { x: H.x + f.x * r * 0.2, y: H.y + f.y * r * 0.2 }
      const out: string[] = []
      const four = n === 5 ? 4 : n
      const fw = r * 0.3
      const gap = r * 0.56
      const lens = [1.5, 1.75, 1.75, 1.55]
      for (let i = 0; i < four; i++) {
        const k = i - (four - 1) / 2
        const from = { x: base.x + perpA.x * k * gap, y: base.y + perpA.y * k * gap }
        const len = r * (four === 4 ? lens[i] : 1.75)
        out.push(fingerTube(from, rot(f, k * (open ? 7 : 10)), len, fw, fill))
      }
      if (n === 5) {
        const thumbDir = { x: perp.x * 0.85 + f.x * 0.45, y: perp.y * 0.85 + f.y * 0.45 }
        const tl = Math.hypot(thumbDir.x, thumbDir.y)
        out.push(fingerTube({ x: base.x - f.x * r * 0.3, y: base.y - f.y * r * 0.3 }, { x: thumbDir.x / tl, y: thumbDir.y / tl }, r * 1.35, fw * 1.1, fill))
      }
      out.push(circle(base.x, base.y, r * 1.02, fill, { cls: 'hand' }))
      return out.join('')
    }
    default:
      return circle(H.x, H.y, r, fill, { cls: 'hand' })
  }
}

export interface ArmPaint {
  sleeve: string
  sleeveFrac: number
  skin: string
  hand?: string
  band?: [number, number, string, number?]
}

/** A posed arm: one limb outline (sleeve / skin / bands) plus the hand shape. */
export function posedArm(g: PosedArm, ap: ArmPose, st: ArmPaint, side: 'left' | 'right', fingers?: number): string {
  const parts: string[] = []
  const slice = (t0: number, t1: number, w: number, fill: string) => {
    const pts = polySlice(g.s, g.e, g.t, t0, t1)
    const path = pts.length === 3 ? limb(pts[0], pts[1], pts[2], w) : limb(pts[0], { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 }, pts[1], w)
    return shape(path, fill)
  }
  if (st.sleeveFrac >= 1) parts.push(slice(0, 1, g.w, st.sleeve))
  else {
    parts.push(slice(0, 1, g.w * 0.92, st.skin))
    parts.push(slice(0, st.sleeveFrac, g.w + 2, st.sleeve))
  }
  if (st.band) {
    const [from, to, color, extra] = st.band
    parts.push(slice(from, to, g.w + (extra ?? 1.5), color))
  }
  parts.push(drawHand(g, ap, st.hand ?? st.skin, fingers))
  return group(`arm-${side}`, parts)
}
