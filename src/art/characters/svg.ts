// Tiny SVG string helpers for the character builder. Pure TypeScript: no DOM, no Node.
// Numbers are rounded to 0.1 so output stays small and byte-identical between runs.

export const INK = '#231942'

export type Attrs = Record<string, string | number | undefined>

export function num(v: number): string {
  const r = Math.round(v * 10) / 10
  return Object.is(r, -0) ? '0' : String(r)
}

function attrText(attrs: Attrs): string {
  let out = ''
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined) continue
    out += ` ${key}="${typeof value === 'number' ? num(value) : value}"`
  }
  return out
}

export function el(tag: string, attrs: Attrs, children?: string | string[]): string {
  const body = Array.isArray(children) ? children.join('') : (children ?? '')
  return body === '' ? `<${tag}${attrText(attrs)}/>` : `<${tag}${attrText(attrs)}>${body}</${tag}>`
}

/** Group with a part name (class) so later animation can target it. */
export function group(cls: string, children: string | string[], attrs: Attrs = {}): string {
  const body = Array.isArray(children) ? children.join('') : children
  if (body === '') return ''
  return el('g', { class: cls, ...attrs }, body)
}

/** Path data from mixed commands and numbers: d('M', 1, 2, 'L', 3, 4). */
export function d(...parts: (string | number)[]): string {
  let out = ''
  for (const p of parts) {
    if (typeof p === 'number') {
      const s = num(p)
      out += out === '' || /[A-Za-z]$/.test(out) ? s : s.startsWith('-') ? s : ` ${s}`
    } else {
      out += p
    }
  }
  return out
}

export interface ShapeOpts {
  sw?: number
  stroke?: boolean
  opacity?: number
  cls?: string
}

/** Filled path with the shared ink outline (inherited from the figure group unless overridden). */
export function shape(pathData: string, fill: string, o: ShapeOpts = {}): string {
  return el('path', {
    class: o.cls,
    d: pathData,
    fill,
    stroke: o.stroke === false ? 'none' : undefined,
    'stroke-width': o.sw,
    opacity: o.opacity,
  })
}

/** Ink line (no fill). */
export function line(pathData: string, sw?: number, opacity?: number): string {
  return el('path', { d: pathData, fill: 'none', 'stroke-width': sw, opacity })
}

export function circle(cx: number, cy: number, r: number, fill: string, o: ShapeOpts = {}): string {
  return el('circle', {
    class: o.cls,
    cx,
    cy,
    r,
    fill,
    stroke: o.stroke === false ? 'none' : undefined,
    'stroke-width': o.sw,
    opacity: o.opacity,
  })
}

export function ellipse(cx: number, cy: number, rx: number, ry: number, fill: string, o: ShapeOpts = {}): string {
  return el('ellipse', {
    class: o.cls,
    cx,
    cy,
    rx,
    ry,
    fill,
    stroke: o.stroke === false ? 'none' : undefined,
    'stroke-width': o.sw,
    opacity: o.opacity,
  })
}

export interface Pt {
  x: number
  y: number
}

const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y })
const add = (a: Pt, b: Pt): Pt => ({ x: a.x + b.x, y: a.y + b.y })
const mul = (a: Pt, k: number): Pt => ({ x: a.x * k, y: a.y * k })
const unit = (a: Pt): Pt => {
  const len = Math.hypot(a.x, a.y) || 1
  return { x: a.x / len, y: a.y / len }
}
const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })

/** Sub-curve [t0, t1] of a quadratic Bézier (de Casteljau). */
export function quadSlice(p0: Pt, p1: Pt, p2: Pt, t0: number, t1: number): [Pt, Pt, Pt] {
  const split = (a: Pt, b: Pt, c: Pt, t: number): { left: [Pt, Pt, Pt]; right: [Pt, Pt, Pt] } => {
    const ab = lerp(a, b, t)
    const bc = lerp(b, c, t)
    const m = lerp(ab, bc, t)
    return { left: [a, ab, m], right: [m, bc, c] }
  }
  let curve: [Pt, Pt, Pt] = [p0, p1, p2]
  if (t1 < 1) curve = split(curve[0], curve[1], curve[2], t1).left
  if (t0 > 0) curve = split(curve[0], curve[1], curve[2], t0 / t1).right
  return curve
}

export function quadPoint(p0: Pt, p1: Pt, p2: Pt, t: number): Pt {
  return lerp(lerp(p0, p1, t), lerp(p1, p2, t), t)
}

/**
 * Outline of a round-capped "tube" of half-width w along a quadratic curve. Used for arms,
 * sleeves and straps, so every colored band is a filled shape with an ink outline.
 */
export function tube(p0: Pt, p1: Pt, p2: Pt, w: number, capStart = true): string {
  const t0 = unit(sub(p1, p0))
  const t2 = unit(sub(p2, p1))
  const n0 = { x: -t0.y, y: t0.x }
  const n2 = { x: -t2.y, y: t2.x }
  const dot = n0.x * n2.x + n0.y * n2.y
  const k = w / Math.max(0.3, 1 + dot)
  const nc = mul(add(n0, n2), k)
  const l0 = add(p0, mul(n0, w))
  const l1 = add(p1, nc)
  const l2 = add(p2, mul(n2, w))
  const r0 = sub(p0, mul(n0, w))
  const r1 = sub(p1, nc)
  const r2 = sub(p2, mul(n2, w))
  const sweep = n2.x * t2.y - n2.y * t2.x > 0 ? 1 : 0
  const start = capStart ? ['A', w, w, 0, 0, sweep, l0.x, l0.y] : ['L', l0.x, l0.y]
  return d(
    'M', l0.x, l0.y, 'Q', l1.x, l1.y, l2.x, l2.y,
    'A', w, w, 0, 0, sweep, r2.x, r2.y,
    'Q', r1.x, r1.y, r0.x, r0.y,
    ...start, 'Z',
  )
}

/**
 * Outline of a round-capped limb of half-width w along a polyline of two segments
 * (shoulder → elbow → hand). The outer side of the elbow is a round arc, the inner side a
 * soft crease, so a bent arm stays one filled shape with one ink outline.
 */
export function limb(p0: Pt, p1: Pt, p2: Pt, w: number): string {
  const u1 = unit(sub(p1, p0))
  const u2 = unit(sub(p2, p1))
  const n1 = { x: -u1.y, y: u1.x }
  const n2 = { x: -u2.y, y: u2.x }
  const cross = u1.x * u2.y - u1.y * u2.x
  const dot = u1.x * u2.x + u1.y * u2.y
  if (Math.abs(cross) < 0.03 && dot > 0) {
    // practically straight: one tube
    return d(
      'M', p0.x + n1.x * w, p0.y + n1.y * w, 'L', p2.x + n2.x * w, p2.y + n2.y * w,
      'A', w, w, 0, 0, 0, p2.x - n2.x * w, p2.y - n2.y * w,
      'L', p0.x - n1.x * w, p0.y - n1.y * w,
      'A', w, w, 0, 0, 0, p0.x + n1.x * w, p0.y + n1.y * w, 'Z',
    )
  }
  // +n side is the inner side when the polyline turns toward +n (cross > 0 in y-down coordinates)
  const innerSign = cross > 0 ? 1 : -1
  const len1 = Math.hypot(p1.x - p0.x, p1.y - p0.y)
  const len2 = Math.hypot(p2.x - p1.x, p2.y - p1.y)
  const bis = unit(add(n1, n2))
  const cosHalf = Math.max(0.2, Math.sqrt(Math.max(0, (1 + (n1.x * n2.x + n1.y * n2.y)) / 2)))
  const miter = Math.min(w / cosHalf, Math.min(len1, len2) * 0.85)
  const inner = add(p1, mul(bis, innerSign * miter))
  const side = (s: number) => ({
    a0: add(p0, mul(n1, s * w)),
    a1: add(p1, mul(n1, s * w)),
    b1: add(p1, mul(n2, s * w)),
    b2: add(p2, mul(n2, s * w)),
  })
  const P = side(1)
  const M = side(-1)
  const parts: (string | number)[] = ['M', P.a0.x, P.a0.y]
  // +n side, going from shoulder to hand
  if (innerSign === 1) parts.push('L', inner.x, inner.y)
  else parts.push('L', P.a1.x, P.a1.y, 'A', w, w, 0, 0, 0, P.b1.x, P.b1.y)
  parts.push('L', P.b2.x, P.b2.y, 'A', w, w, 0, 0, 0, M.b2.x, M.b2.y)
  // -n side, going back from hand to shoulder
  if (innerSign === -1) parts.push('L', inner.x, inner.y)
  else parts.push('L', M.b1.x, M.b1.y, 'A', w, w, 0, 0, 0, M.a1.x, M.a1.y)
  parts.push('L', M.a0.x, M.a0.y, 'A', w, w, 0, 0, 0, P.a0.x, P.a0.y, 'Z')
  return d(...parts)
}

/** Sub-polyline between arc-length fractions t0..t1 of a two-segment polyline. */
export function polySlice(p0: Pt, p1: Pt, p2: Pt, t0: number, t1: number): Pt[] {
  const l1 = Math.hypot(p1.x - p0.x, p1.y - p0.y)
  const l2 = Math.hypot(p2.x - p1.x, p2.y - p1.y)
  const total = l1 + l2
  const at = (t: number): Pt => {
    const s = t * total
    return s <= l1 ? lerp(p0, p1, l1 === 0 ? 0 : s / l1) : lerp(p1, p2, l2 === 0 ? 0 : (s - l1) / l2)
  }
  const a = at(t0)
  const b = at(t1)
  const tElbow = l1 / total
  if (t0 < tElbow && t1 > tElbow) return [a, p1, b]
  return [a, b]
}

export function polyPoint(p0: Pt, p1: Pt, p2: Pt, t: number): Pt {
  return polySlice(p0, p1, p2, 0, t).at(-1) as Pt
}
