// Comic balloons: speech (rounded box + tail toward the speaker's mouth) and thought (cloud +
// small circles). The SVG balloon is empty: Mandarin text is overlaid as HTML by the app.
import { circle, d, el, num, shape, type Pt } from '../characters/svg.ts'
import { ICONS } from './props.ts'
import type { SceneBubble } from './types.ts'

const WHITE = '#FFFFFF'

/** Point on the box edge nearest to p, kept away from the rounded corners. */
function edgePoint(b: SceneBubble, p: Pt, r: number): { base: Pt; normal: Pt } {
  const cx = Math.max(b.x + r, Math.min(b.x + b.w - r, p.x))
  const cy = Math.max(b.y + r, Math.min(b.y + b.h - r, p.y))
  const below = p.y > b.y + b.h
  const above = p.y < b.y
  const left = p.x < b.x
  const right = p.x > b.x + b.w
  // prefer top/bottom edges (tails usually point down to the speaker)
  if (below) return { base: { x: cx, y: b.y + b.h }, normal: { x: 0, y: 1 } }
  if (above) return { base: { x: cx, y: b.y }, normal: { x: 0, y: -1 } }
  if (left) return { base: { x: b.x, y: cy }, normal: { x: -1, y: 0 } }
  if (right) return { base: { x: b.x + b.w, y: cy }, normal: { x: 1, y: 0 } }
  return { base: { x: cx, y: b.y + b.h }, normal: { x: 0, y: 1 } }
}

export interface DrawnBubble {
  svg: string
  /** pivot for the pop animation (tail tip or the box centre) */
  pivot: Pt
}

export function drawBubble(b: SceneBubble, target: Pt | null): DrawnBubble {
  const kind = b.kind ?? 'speech'
  const out: string[] = []
  let pivot: Pt = { x: b.x + b.w / 2, y: b.y + b.h }
  if (kind === 'speech') {
    const r = Math.min(b.h / 2, 22)
    if (target) {
      const { base, normal } = edgePoint(b, target, r + 6)
      const tang = { x: -normal.y, y: normal.x }
      const vx = target.x - base.x
      const vy = target.y - base.y
      const len = Math.hypot(vx, vy) || 1
      const L = Math.min(len, 42)
      const tip = { x: base.x + (vx / len) * L, y: base.y + (vy / len) * L }
      const hw = 10
      const b1 = { x: base.x + tang.x * hw, y: base.y + tang.y * hw }
      const b2 = { x: base.x - tang.x * hw, y: base.y - tang.y * hw }
      out.push(shape(d('M', b1.x, b1.y, 'L', tip.x, tip.y, 'L', b2.x, b2.y, 'Z'), WHITE))
      out.push(el('rect', { x: b.x, y: b.y, width: b.w, height: b.h, rx: r, fill: WHITE }))
      const i1 = { x: b1.x - normal.x * 4 - tang.x * 1.2, y: b1.y - normal.y * 4 - tang.y * 1.2 }
      const i2 = { x: b2.x - normal.x * 4 + tang.x * 1.2, y: b2.y - normal.y * 4 + tang.y * 1.2 }
      const t2 = { x: base.x + (vx / len) * Math.min(6, L), y: base.y + (vy / len) * Math.min(6, L) }
      out.push(shape(d('M', i1.x, i1.y, 'L', t2.x, t2.y, 'L', i2.x, i2.y, 'Z'), WHITE, { stroke: false }))
      pivot = tip
    } else {
      out.push(el('rect', { x: b.x, y: b.y, width: b.w, height: b.h, rx: r, fill: WHITE }))
    }
  } else {
    // cloud: bumps around the box
    const cx = b.x + b.w / 2
    const cy = b.y + b.h / 2
    const rx = b.w / 2
    const ry = b.h / 2
    const n = Math.max(8, Math.round((b.w + b.h) / 26))
    const pts: Pt[] = []
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2
      pts.push({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) })
    }
    const parts: (string | number)[] = ['M', pts[0].x, pts[0].y]
    for (let i = 1; i <= n; i++) {
      const p = pts[i % n]
      const q = pts[i - 1]
      const rr = Math.hypot(p.x - q.x, p.y - q.y) * 0.6
      parts.push('A', rr, rr, 0, 0, 1, p.x, p.y)
    }
    parts.push('Z')
    if (target) {
      const vx = target.x - cx
      const vy = target.y - cy
      const len = Math.hypot(vx, vy) || 1
      const ux = vx / len
      const uy = vy / len
      // edge of the ellipse in that direction
      const t = 1 / Math.sqrt((ux * ux) / (rx * rx) + (uy * uy) / (ry * ry))
      const e = { x: cx + ux * (t + 10), y: cy + uy * (t + 10) }
      const room = Math.max(0, len - t - 10)
      out.push(circle(e.x + ux * Math.min(8, room * 0.25), e.y + uy * Math.min(8, room * 0.25), 7, WHITE, { sw: 3 }))
      out.push(circle(e.x + ux * Math.min(26, room * 0.7), e.y + uy * Math.min(26, room * 0.7), 4.5, WHITE, { sw: 3 }))
      pivot = { x: e.x, y: e.y }
    }
    out.push(shape(d(...parts), WHITE))
  }
  if (b.icon) {
    const s = Math.min(b.h / 50, b.w / 50, 1.3)
    out.push(ICONS[b.icon](b.x + b.w / 2, b.y + b.h / 2 - (b.icon === 'question' || b.icon === 'exclaim' ? 1 : 0), s))
  }
  return { svg: out.join(''), pivot: { x: Number(num(pivot.x)), y: Number(num(pivot.y)) } }
}
