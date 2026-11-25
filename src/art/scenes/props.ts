// Props (things) in the same style as the characters: flat colours, ink outline (#231942),
// round joins. Each prop is drawn around its own origin = bottom centre, so it can stand on a
// table or the floor; the composer moves/scales it. Outline width is inherited from the scene
// (3.5); details use 2.5–3.
import { circle, d, el, ellipse, group, limb, line, num, shape, type Pt } from '../characters/svg.ts'
import { GLYPH_STROKES } from './glyphs.ts'

export interface PropOpts {
  value?: string
  variant?: string
  color?: string
}

type Draw = (o: PropOpts) => string

const rect = (x: number, y: number, w: number, h: number, rx: number, fill: string, sw?: number) =>
  el('rect', { x, y, width: w, height: h, rx, fill, 'stroke-width': sw })

/** Flat colour block without outline (glows, sky strips). */
const flat = (x: number, y: number, w: number, h: number, fill: string, rx = 0, opacity?: number) =>
  el('rect', { x, y, width: w, height: h, rx: rx || undefined, fill, stroke: 'none', opacity })

/** Digits as text (the only text allowed in scenes). */
export function digits(x: number, y: number, value: string, size: number, fill = '#231942'): string {
  if (!/^[0-9]+$/.test(value)) throw new Error(`digits only: ${value}`)
  return `<text x="${num(x)}" y="${num(y)}" font-family="Baloo 2, Nunito, sans-serif" font-weight="800" font-size="${num(size)}" text-anchor="middle" fill="${fill}" stroke="none">${value}</text>`
}

/** Coloured band along a polyline: a filled shape (ink outline unless outline=false). */
function band(pts: [number, number][], w: number, fill: string, outline = true, sw?: number): string {
  const P = pts.map(([x, y]): Pt => ({ x, y }))
  const out: string[] = []
  for (let i = 0; i + 1 < P.length; i++) {
    const a = P[i]
    const b = P[i + 1]
    out.push(shape(limb(a, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, b, w), fill, outline ? { sw } : { stroke: false }))
  }
  return out.join('')
}

/** Group whose local origin is (x, y): the CSS idle animations (blink, wag) pivot there. */
const pivot = (x: number, y: number, body: string) => el('g', { transform: `translate(${num(x)} ${num(y)})` }, body)

const RED = '#E5484D'
const LEAF = '#4CAF50'
const WOOD = '#C98B5B'
const WOOD_D = '#A86F45'
const WHITE = '#FFFFFF'
const YELLOW = '#FFD43B'

function star5(cx: number, cy: number, R: number, r: number): string {
  const pts: (string | number)[] = []
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2
    const rr = i % 2 === 0 ? R : r
    pts.push(i === 0 ? 'M' : 'L', cx + rr * Math.cos(a), cy + rr * Math.sin(a))
  }
  pts.push('Z')
  return d(...pts)
}

function heartPath(cx: number, cy: number, s: number): string {
  return d('M', cx, cy + 9 * s, 'C', cx - 16 * s, cy - 2 * s, cx - 10 * s, cy - 15 * s, cx, cy - 7 * s, 'C', cx + 10 * s, cy - 15 * s, cx + 16 * s, cy - 2 * s, cx, cy + 9 * s, 'Z')
}

export const ICONS = {
  question: (cx: number, cy: number, s = 1) =>
    group('icon', [
      shape(d('M', cx - 9 * s, cy - 8 * s, 'Q', cx - 9 * s, cy - 18 * s, cx, cy - 18 * s, 'Q', cx + 10 * s, cy - 18 * s, cx + 10 * s, cy - 9 * s, 'Q', cx + 10 * s, cy - 3 * s, cx + 3 * s, cy, 'Q', cx, cy + 2 * s, cx, cy + 6 * s), 'none', { sw: 5.5 * s }),
      circle(cx, cy + 15 * s, 3.4 * s, '#231942', { stroke: false }),
    ]),
  exclaim: (cx: number, cy: number, s = 1) =>
    group('icon', [shape(d('M', cx, cy - 17 * s, 'L', cx, cy + 4 * s), 'none', { sw: 6 * s }), circle(cx, cy + 14 * s, 3.6 * s, '#231942', { stroke: false })]),
  heart: (cx: number, cy: number, s = 1) => group('icon', shape(heartPath(cx, cy, s * 1.1), '#F06595', { sw: 3 })),
  check: (cx: number, cy: number, s = 1) => group('icon', band([[cx - 14 * s, cy], [cx - 4 * s, cy + 10 * s], [cx + 15 * s, cy - 12 * s]], 4.5 * s, '#40C057', true, 3)),
  cross: (cx: number, cy: number, s = 1) => group('icon', band([[cx - 12 * s, cy - 12 * s], [cx + 12 * s, cy + 12 * s]], 4.5 * s, '#FA5252', true, 3) + band([[cx + 12 * s, cy - 12 * s], [cx - 12 * s, cy + 12 * s]], 4.5 * s, '#FA5252', true, 3)),
  dots: (cx: number, cy: number, s = 1) => group('icon', [-14, 0, 14].map((o) => circle(cx + o * s, cy, 4 * s, '#231942', { stroke: false })).join('')),
} as const

/** Big coloured mark (tick / cross) used as a prop. */
function mark(kind: 'check' | 'cross'): string {
  if (kind === 'check') return band([[-24, -28], [-8, -10], [26, -50]], 7, '#40C057')
  return band([[-20, -46], [20, -6]], 7, '#FA5252') + band([[20, -46], [-20, -6]], 7, '#FA5252')
}

export const PROPS: Record<string, Draw> = {
  // ---------- food ----------
  apple: (o) => {
    const rotten = o.variant === 'rotten'
    const body = rotten ? '#A07A4F' : (o.color ?? RED)
    return [
      shape(d('M', 0, -30, 'Q', 2, -40, 6, -44), 'none', { sw: 3.5 }),
      rotten ? '' : shape(d('M', 3, -38, 'Q', 14, -46, 20, -38, 'Q', 12, -32, 3, -38, 'Z'), LEAF, { sw: 3 }),
      shape(d('M', 0, -30, 'Q', -10, -38, -18, -30, 'Q', -27, -20, -20, -7, 'Q', -12, 4, 0, -2, 'Q', 12, 4, 20, -7, 'Q', 27, -20, 18, -30, 'Q', 10, -38, 0, -30, 'Z'), body),
      rotten
        ? [circle(-8, -16, 4, '#6E5236', { stroke: false }), circle(8, -10, 3, '#6E5236', { stroke: false }), circle(6, -22, 2.5, '#6E5236', { stroke: false })].join('')
        : ellipse(-9, -20, 4, 6, WHITE, { stroke: false, opacity: 0.55 }),
    ].join('')
  },
  orange: (o) =>
    [
      circle(0, -17, 17, o.color ?? '#F59F00'),
      shape(d('M', -1, -33, 'Q', 6, -42, 14, -37, 'Q', 8, -30, -1, -33, 'Z'), LEAF, { sw: 3 }),
      circle(-6, -22, 2, WHITE, { stroke: false, opacity: 0.6 }),
    ].join(''),
  baozi: (o) =>
    o.variant === 'half'
      ? [
          shape(d('M', -22, -2, 'Q', -24, -24, 0, -28, 'L', 2, -18, 'L', -3, -12, 'L', 3, -6, 'L', 0, 0, 'Q', -12, 1, -22, -2, 'Z'), '#FFF8EC'),
          shape(d('M', 0, -28, 'L', 2, -18, 'L', -3, -12, 'L', 3, -6, 'L', 0, 0, 'Q', 6, -14, 0, -28, 'Z'), '#E9B872', { sw: 2.5 }),
        ].join('')
      : [
      shape(d('M', -24, -2, 'Q', -26, -26, 0, -32, 'Q', 26, -26, 24, -2, 'Q', 0, 3, -24, -2, 'Z'), '#FFF8EC'),
      line(d('M', 0, -31, 'Q', -4, -22, -10, -18, 'M', 0, -31, 'Q', 4, -22, 10, -18, 'M', 0, -31, 'L', 0, -20), 2.5, 0.55),
    ].join(''),
  dumpling: () =>
    [
      shape(d('M', -22, 0, 'Q', -22, -22, 0, -24, 'Q', 22, -22, 22, 0, 'Q', 0, 4, -22, 0, 'Z'), '#FFF8EC'),
      line(d('M', -14, -16, 'L', -10, -11, 'M', -5, -21, 'L', -3, -15, 'M', 5, -21, 'L', 3, -15, 'M', 14, -16, 'L', 10, -11), 2.5, 0.55),
    ].join(''),
  egg: () => [shape(d('M', 0, -36, 'Q', 16, -36, 16, -14, 'Q', 16, 0, 0, 0, 'Q', -16, 0, -16, -14, 'Q', -16, -36, 0, -36, 'Z'), '#FFF6E6'), ellipse(-6, -22, 3, 5, WHITE, { stroke: false })].join(''),
  candy: (o) =>
    [
      shape(d('M', -12, -10, 'L', -24, -18, 'L', -24, -2, 'Z'), o.color ?? '#F06595', { sw: 3 }),
      shape(d('M', 12, -10, 'L', 24, -18, 'L', 24, -2, 'Z'), o.color ?? '#F06595', { sw: 3 }),
      ellipse(0, -10, 13, 10, o.color ?? '#F06595', { sw: 3 }),
      line(d('M', -5, -17, 'Q', 0, -10, 5, -3), 2.5, 0.5),
    ].join(''),
  watermelon: (o) =>
    o.variant === 'half'
      ? [
          shape(d('M', -40, -30, 'A', 40, 30, 0, 0, 0, 40, -30, 'Z'), '#2F9E44'),
          shape(d('M', -34, -30, 'A', 34, 24, 0, 0, 0, 34, -30, 'Z'), '#FF6B6B', { stroke: false }),
          line(d('M', -40, -30, 'L', 40, -30), 3.5),
          ...[[-16, -20], [0, -14], [16, -20], [-6, -24], [8, -24]].map(([x, y]) => ellipse(x, y, 2, 3, '#231942', { stroke: false })),
        ].join('')
      : [ellipse(0, -30, 40, 30, '#2F9E44'), line(d('M', -16, -56, 'Q', -26, -30, -16, -4, 'M', 0, -60, 'L', 0, 0, 'M', 16, -56, 'Q', 26, -30, 16, -4), 3, 0.45)].join(''),
  rice: () => [shape(d('M', -26, 0, 'Q', -26, -22, 0, -24, 'Q', 26, -22, 26, 0, 'Z'), WHITE), line(d('M', -10, -12, 'L', -8, -10, 'M', 6, -16, 'L', 8, -14, 'M', 12, -8, 'L', 14, -6), 2.5, 0.4)].join(''),
  vegetables: () =>
    [
      circle(-8, -22, 10, '#3E9B4F'),
      circle(6, -26, 11, '#3E9B4F'),
      circle(0, -14, 9, '#3E9B4F'),
      shape(d('M', -3, -12, 'L', -5, 0, 'L', 5, 0, 'L', 3, -12, 'Z'), '#A8D58A', { sw: 3 }),
    ].join(''),

  // ---------- tableware & kitchen ----------
  bowl: (o) => {
    const fill = o.variant ?? 'empty'
    const top =
      fill === 'rice'
        ? shape(d('M', -30, -30, 'Q', -26, -54, 0, -56, 'Q', 26, -54, 30, -30, 'Z'), WHITE)
        : fill === 'full'
          ? [
              [-18, -44], [0, -46], [18, -44], [-9, -58], [9, -58], [0, -70],
            ].map(([x, y]) => group('dumpling', PROPS.dumpling({}), { transform: `translate(${x} ${y + 14}) scale(0.62)` })).join('')
          : fill === 'few' || fill === 'some'
            ? (fill === 'few' ? [[-11, -36], [11, -36]] : [[-16, -30], [0, -30], [16, -30], [-8, -40], [8, -40]]).map(([x, y]) => group('dumpling', PROPS.dumpling({}), { transform: `translate(${x} ${y + 6}) scale(0.62)` })).join('')
            : ''
    return [
      top,
      shape(d('M', -34, -30, 'L', 34, -30, 'Q', 32, -2, 0, -2, 'Q', -32, -2, -34, -30, 'Z'), o.color ?? WHITE),
      rect(-12, -4, 24, 4, 2, o.color ?? WHITE, 3),
      line(d('M', -24, -16, 'Q', 0, -10, 24, -16), 3, 0.35),
    ].join('')
  },
  plate: (o) =>
    [
      ellipse(0, -7, 46, 9, o.color ?? WHITE),
      ellipse(0, -8, 30, 5, '#F1EEF6', { sw: 2.5 }),
      o.variant === 'crumbs' ? [circle(-8, -9, 1.8, '#C98B5B', { stroke: false }), circle(6, -7, 1.6, '#C98B5B', { stroke: false }), circle(12, -10, 1.5, '#C98B5B', { stroke: false })].join('') : '',
    ].join(''),
  cup: (o) => {
    const tea = o.variant === 'little' ? 3 : o.variant === 'empty' ? 0 : 12
    return [
      shape(d('M', -16, -30, 'L', 16, -30, 'L', 12, 0, 'L', -12, 0, 'Z'), o.color ?? '#F8F1E4'),
      tea ? shape(d('M', -12.5, -tea - 2, 'L', 12.5, -tea - 2, 'L', 12, -2, 'L', -12, -2, 'Z'), '#C9A227', { stroke: false, opacity: 0.85 }) : '',
      shape(d('M', -16, -30, 'L', 16, -30, 'L', 12, 0, 'L', -12, 0, 'Z'), 'none'),
      line(d('M', -14, -20, 'L', 14, -20), 2.5, 0.35),
    ].join('')
  },
  teapot: () =>
    [
      band([[20, -22], [38, -30], [46, -44]], 4, '#4C9BE8'),
      shape(d('M', -26, -30, 'Q', -42, -30, -38, -16, 'Q', -34, -8, -24, -12), 'none', { sw: 4 }),
      shape(d('M', -28, -6, 'Q', -32, -40, 0, -42, 'Q', 32, -40, 28, -6, 'Q', 26, 0, 0, 0, 'Q', -26, 0, -28, -6, 'Z'), '#4C9BE8'),
      ellipse(0, -42, 16, 4, '#3A80C8', { sw: 3 }),
      circle(0, -48, 4.5, '#3A80C8', { sw: 3 }),
      line(d('M', -20, -20, 'Q', 0, -14, 20, -20), 3, 0.4),
    ].join(''),
  pot: () =>
    [
      line(d('M', -10, -58, 'Q', -16, -66, -10, -74, 'M', 6, -60, 'Q', 0, -68, 6, -76), 3, 0.5),
      shape(d('M', -50, -40, 'L', -60, -44, 'M', 50, -40, 'L', 60, -44), 'none', { sw: 6 }),
      shape(d('M', -46, -46, 'L', 46, -46, 'L', 42, -4, 'Q', 40, 0, 34, 0, 'L', -34, 0, 'Q', -40, 0, -42, -4, 'Z'), '#8A94A6'),
      rect(-50, -52, 100, 8, 4, '#6E7889', 3),
    ].join(''),
  stove: () =>
    [
      rect(-70, -40, 140, 40, 8, '#E9E4F0'),
      ellipse(-34, -40, 24, 5, '#4A4458', { sw: 3 }),
      ellipse(34, -40, 24, 5, '#4A4458', { sw: 3 }),
      circle(-40, -18, 5, '#BDB6C9', { sw: 2.5 }),
      circle(40, -18, 5, '#BDB6C9', { sw: 2.5 }),
    ].join(''),
  flame: () => shape(d('M', 0, 0, 'Q', -14, -12, -6, -26, 'Q', -2, -16, 2, -22, 'Q', 4, -30, 0, -36, 'Q', 16, -24, 10, -8, 'Q', 8, 0, 0, 0, 'Z'), '#FF922B', { sw: 3 }),
  spoon: () => [shape(d('M', -2, 0, 'L', -2, -30, 'L', 2, -30, 'L', 2, 0, 'Z'), '#E9E4F0', { sw: 3 }), ellipse(0, -38, 9, 11, '#E9E4F0', { sw: 3 })].join(''),
  chopsticks: () => shape(d('M', -6, 0, 'L', 2, -60, 'M', 4, 0, 'L', 8, -60), 'none', { sw: 4 }),
  'bubble-tea': (o) =>
    [
      shape(d('M', 4, -56, 'L', 10, -76, 'L', 15, -75), 'none', { sw: 5 }),
      shape(d('M', -18, -52, 'L', 18, -52, 'L', 14, 0, 'L', -14, 0, 'Z'), o.color ?? '#E7C7A0'),
      ...[[-7, -8], [3, -7], [9, -11], [-2, -13], [-9, -14]].map(([x, y]) => circle(x, y, 3, '#3A2C2A', { stroke: false })),
      shape(d('M', -20, -52, 'Q', 0, -66, 20, -52, 'Z'), WHITE, { sw: 3 }),
      rect(-20, -55, 40, 5, 2.5, WHITE, 3),
    ].join(''),
  cake: (o) =>
    [
      rect(-40, -46, 80, 46, 10, '#FFC9DE'),
      shape(d('M', -40, -32, 'Q', -30, -24, -20, -32, 'Q', -10, -24, 0, -32, 'Q', 10, -24, 20, -32, 'Q', 30, -24, 40, -32), 'none', { sw: 3 }),
      ellipse(0, -46, 40, 8, WHITE),
      o.value
        ? group('candle', [
            shape(d('M', 0, -94, 'Q', -6, -100, 0, -108, 'Q', 6, -100, 0, -94, 'Z'), '#FF922B', { sw: 2.5 }),
            rect(-12, -92, 24, 40, 6, '#7FB3F5', 3),
            digits(0, -62, o.value, 30, WHITE),
          ])
        : '',
    ].join(''),

  // ---------- furniture & home ----------
  table: (o) => {
    const w = Number(o.value ?? 200) / 2
    return [
      rect(-w + 12, -58, 14, 58, 4, WOOD_D),
      rect(w - 26, -58, 14, 58, 4, WOOD_D),
      rect(-w, -70, w * 2, 16, 6, o.color ?? WOOD),
    ].join('')
  },
  chair: () =>
    [
      rect(-26, -110, 52, 62, 8, WOOD),
      rect(-30, -56, 60, 12, 5, WOOD),
      rect(-26, -46, 9, 46, 3, WOOD_D),
      rect(17, -46, 9, 46, 3, WOOD_D),
      line(d('M', -14, -96, 'L', 14, -96, 'M', -14, -80, 'L', 14, -80), 3, 0.4),
    ].join(''),
  sofa: (o) =>
    [
      rect(-110, -98, 220, 60, 18, o.color ?? '#7AA6D8'),
      rect(-122, -66, 36, 60, 14, o.color ?? '#7AA6D8'),
      rect(86, -66, 36, 60, 14, o.color ?? '#7AA6D8'),
      rect(-88, -54, 176, 34, 10, '#9CC0E8'),
      line(d('M', 0, -54, 'L', 0, -20), 3, 0.5),
      rect(-110, -20, 220, 14, 6, '#5E88BB'),
    ].join(''),
  door: (o) => {
    const open = o.variant === 'open'
    return [
      rect(-50, -190, 100, 190, 6, '#8A5A3B'),
      open
        ? [rect(-42, -182, 84, 182, 3, '#3A2C2A'), shape(d('M', 42, -182, 'L', 70, -196, 'L', 70, 14, 'L', 42, 0, 'Z'), '#C0392B'), circle(62, -88, 4, YELLOW, { sw: 2.5 })].join('')
        : [rect(-42, -182, 84, 182, 3, o.color ?? '#C0392B'), rect(-28, -166, 56, 40, 6, '#FFE8B0', 3), circle(28, -88, 5, YELLOW, { sw: 2.5 })].join(''),
    ].join('')
  },
  'door-shadow': () =>
    [
      rect(-50, -190, 100, 190, 6, '#8A5A3B'),
      rect(-42, -182, 84, 182, 3, '#C0392B'),
      rect(-26, -168, 52, 46, 6, '#FFE8B0', 3),
      shape(d('M', -10, -122, 'Q', -12, -146, 0, -148, 'Q', 12, -146, 10, -122, 'Z'), '#7A6B8F', { stroke: false, opacity: 0.8 }),
      circle(0, -154, 9, '#7A6B8F', { stroke: false, opacity: 0.8 }),
      rect(-26, -168, 52, 46, 6, 'none', 3),
      circle(28, -88, 5, YELLOW, { sw: 2.5 }),
    ].join(''),
  wardrobe: (o) =>
    [
      rect(-62, -200, 124, 196, 8, WOOD),
      o.variant === 'open'
        ? [rect(-54, -190, 54, 178, 4, '#3A2C2A'), rect(0, -190, 54, 178, 4, '#E2C29E', 3)].join('')
        : [rect(-54, -190, 54, 178, 4, '#E2C29E', 3), rect(0, -190, 54, 178, 4, '#E2C29E', 3)].join(''),
      circle(-8, -100, 3.5, YELLOW, { sw: 2.5 }),
      circle(8, -100, 3.5, YELLOW, { sw: 2.5 }),
      rect(-56, -6, 12, 6, 2, WOOD_D, 2.5),
      rect(44, -6, 12, 6, 2, WOOD_D, 2.5),
    ].join(''),
  shelf: () =>
    [
      rect(-70, -130, 10, 130, 3, WOOD_D),
      rect(60, -130, 10, 130, 3, WOOD_D),
      rect(-74, -70, 148, 10, 4, WOOD),
      rect(-74, -6, 148, 10, 4, WOOD),
    ].join(''),
  'wardrobe-door': () => [rect(-27, -190, 54, 178, 4, '#E2C29E', 3), circle(-18, -100, 3.5, '#FFD43B', { sw: 2.5 })].join(''),
  'balloon-post': () => rect(-5, -120, 10, 120, 4, '#8A5A3B'),
  paper: (o) => {
    const parts = (o.value ?? '').split('')
    const step = 15
    const x0 = -((parts.length - 1) * step) / 2
    const content = parts.map((ch, i) => {
      const x = x0 + i * step
      if (ch === '+') return band([[x - 5, -52], [x + 5, -52]], 1.6, '#231942', false) + band([[x, -57], [x, -47]], 1.6, '#231942', false)
      if (ch === '=') return band([[x - 5, -55], [x + 5, -55]], 1.6, '#231942', false) + band([[x - 5, -49], [x + 5, -49]], 1.6, '#231942', false)
      return digits(x, -45, ch, 20)
    })
    const m = o.variant === 'cross' ? mark('cross') : o.variant === 'check' ? mark('check') : ''
    return [rect(-46, -86, 92, 86, 4, WHITE), ...content, m ? group('mark', m, { transform: 'translate(22 4) scale(0.6)' }) : ''].join('')
  },
  shelfBoard: () => rect(-80, -10, 160, 12, 4, WOOD),
  window: () =>
    [
      rect(-50, -90, 100, 90, 8, '#CFE8F7'),
      line(d('M', 0, -90, 'L', 0, 0, 'M', -50, -45, 'L', 50, -45), 4),
      rect(-56, -4, 112, 8, 4, WHITE, 3),
    ].join(''),

  // ---------- toys & things ----------
  ball: (o) =>
    [
      circle(0, -18, 18, o.color ?? '#4C9BE8'),
      shape(d('M', -18, -18, 'Q', 0, -10, 18, -18), 'none', { sw: 3 }),
      shape(d('M', 0, -36, 'Q', -8, -18, 0, 0), 'none', { sw: 3 }),
    ].join(''),
  balloon: (o) =>
    [
      shape(d('M', 0, -40, 'Q', -6, -22, 2, -12, 'Q', 8, -4, 0, 0), 'none', { sw: 2.5 }),
      shape(d('M', -3, -36, 'L', 3, -36, 'L', 4, -41, 'L', -4, -41, 'Z'), o.color ?? RED, { sw: 2.5 }),
      shape(d('M', 0, -40, 'Q', -24, -48, -24, -72, 'Q', -24, -96, 0, -96, 'Q', 24, -96, 24, -72, 'Q', 24, -48, 0, -40, 'Z'), o.color ?? RED),
      ellipse(-10, -78, 4, 8, WHITE, { stroke: false, opacity: 0.55 }),
    ].join(''),
  'toy-bear': (o) => {
    const c = o.color ?? '#C98B5B'
    return [
      circle(-17, -66, 9, c), circle(17, -66, 9, c),
      ellipse(0, -22, 22, 22, c),
      circle(-18, -10, 8, c), circle(18, -10, 8, c),
      circle(0, -54, 20, c),
      ellipse(0, -48, 9, 7, '#F1D2B0', { sw: 2.5 }),
      circle(0, -51, 2.6, '#231942', { stroke: false }),
      circle(-7, -58, 2.4, '#231942', { stroke: false }), circle(7, -58, 2.4, '#231942', { stroke: false }),
      ellipse(0, -22, 11, 12, '#F1D2B0', { sw: 2.5 }),
    ].join('')
  },
  'gift-box': () =>
    [
      rect(-30, -50, 60, 50, 6, '#9775FA'),
      rect(-34, -60, 68, 14, 5, '#B197FC'),
      rect(-6, -60, 12, 60, 2, YELLOW, 3),
      shape(d('M', 0, -60, 'Q', -20, -80, -22, -64, 'Q', -20, -58, 0, -60, 'Z'), YELLOW, { sw: 3 }),
      shape(d('M', 0, -60, 'Q', 20, -80, 22, -64, 'Q', 20, -58, 0, -60, 'Z'), YELLOW, { sw: 3 }),
    ].join(''),
  'jump-rope': () =>
    [
      shape(d('M', -34, -60, 'Q', -40, 10, 0, 6, 'Q', 40, 10, 34, -60), 'none', { sw: 3.5 }),
      rect(-40, -76, 12, 20, 5, RED, 3), rect(28, -76, 12, 20, 5, RED, 3),
    ].join(''),
  umbrella: (o) =>
    o.variant === 'open'
      ? [
          shape(d('M', 0, -64, 'L', 0, -8, 'Q', 0, 0, 8, 0), 'none', { sw: 4 }),
          shape(d('M', -50, -64, 'Q', -48, -106, 0, -108, 'Q', 48, -106, 50, -64, 'Q', 38, -72, 25, -64, 'Q', 12, -72, 0, -64, 'Q', -12, -72, -25, -64, 'Q', -38, -72, -50, -64, 'Z'), o.color ?? '#4C9BE8'),
        ].join('')
      : [
          shape(d('M', 0, -96, 'L', 0, -8, 'Q', 0, 0, 8, 0), 'none', { sw: 4 }),
          shape(d('M', 0, -98, 'Q', 12, -60, 6, -26, 'L', -6, -26, 'Q', -12, -60, 0, -98, 'Z'), o.color ?? '#4C9BE8'),
        ].join(''),
  suitcase: () =>
    [
      shape(d('M', -10, -84, 'L', -10, -100, 'L', 10, -100, 'L', 10, -84), 'none', { sw: 4 }),
      rect(-28, -86, 56, 76, 8, '#9775FA'),
      line(d('M', -14, -76, 'L', -14, -20, 'M', 14, -76, 'L', 14, -20), 3, 0.5),
      circle(-18, -4, 5, '#4A4458', { sw: 2.5 }), circle(18, -4, 5, '#4A4458', { sw: 2.5 }),
    ].join(''),
  phone: () =>
    [rect(-16, -56, 32, 56, 6, '#4A4458'), rect(-12, -50, 24, 42, 3, '#9FD3F5', 2.5), circle(0, -4, 2, '#BDB6C9', { stroke: false })].join(''),
  'phone-photo': () =>
    [
      rect(-18, -62, 36, 62, 6, '#4A4458'),
      rect(-14, -56, 28, 46, 3, '#FFE3EC', 2.5),
      circle(0, -38, 8, '#F6D3B3', { sw: 2.5 }),
      shape(d('M', -8, -42, 'Q', 0, -52, 8, -42, 'Q', 0, -46, -8, -42, 'Z'), '#2B2233', { sw: 2 }),
      shape(d('M', -10, -16, 'Q', -10, -28, 0, -28, 'Q', 10, -28, 10, -16, 'Z'), '#FFD166', { sw: 2.5 }),
    ].join(''),
  photo: () =>
    [
      rect(-30, -70, 60, 70, 4, WHITE),
      rect(-24, -64, 48, 50, 2, '#FFE3EC', 2.5),
      circle(0, -42, 12, '#F6D3B3', { sw: 2.5 }),
      shape(d('M', -12, -46, 'Q', 0, -60, 12, -46, 'Q', 0, -52, -12, -46, 'Z'), '#2B2233', { sw: 2 }),
      shape(d('M', -14, -14, 'Q', -14, -26, 0, -26, 'Q', 14, -26, 14, -14, 'Z'), '#FFD166', { sw: 2.5 }),
    ].join(''),
  wallet: () =>
    [rect(-26, -36, 52, 36, 6, '#8A5A3B'), shape(d('M', 6, -26, 'L', 26, -26, 'L', 26, -10, 'L', 6, -10, 'Q', 0, -18, 6, -26, 'Z'), '#6E4A30', { sw: 3 }), circle(14, -18, 3, YELLOW, { sw: 2 })].join(''),
  coin: () => [circle(0, -14, 14, '#FCC419'), circle(0, -14, 8, 'none', { sw: 2.5 })].join(''),
  dust: () => [circle(-8, -6, 3, '#BDB6C9', { stroke: false }), circle(4, -12, 2.5, '#BDB6C9', { stroke: false }), circle(10, -4, 2, '#BDB6C9', { stroke: false }), circle(-2, -18, 2, '#BDB6C9', { stroke: false })].join(''),
  'shopping-bag': () =>
    [shape(d('M', -10, -40, 'Q', -10, -56, 0, -56, 'Q', 10, -56, 10, -40), 'none', { sw: 3.5 }), shape(d('M', -22, -42, 'L', 22, -42, 'L', 26, 0, 'L', -26, 0, 'Z'), '#F4E3C3')].join(''),
  schoolbag: () =>
    [rect(-24, -54, 48, 54, 12, '#F06595'), rect(-16, -30, 32, 22, 6, '#E64980', 3), shape(d('M', -10, -54, 'Q', 0, -66, 10, -54), 'none', { sw: 4 })].join(''),
  basket: () =>
    [
      circle(-16, -42, 12, RED), circle(12, -44, 12, '#F59F00'), circle(-2, -50, 11, '#FAB005'),
      shape(d('M', -6, -58, 'Q', 0, -70, 6, -58), 'none', { sw: 3 }),
      shape(d('M', -40, -36, 'L', 40, -36, 'L', 32, 0, 'L', -32, 0, 'Z'), '#D9A066'),
      line(d('M', -36, -24, 'L', 36, -24, 'M', -34, -12, 'L', 34, -12), 3, 0.45),
    ].join(''),
  broom: () =>
    [
      band([[0, -150], [0, -40]], 4, '#E2C29E', true, 3),
      shape(d('M', -10, -44, 'L', 10, -44, 'L', 24, 0, 'L', -24, 0, 'Z'), '#E8B04B'),
      line(d('M', -8, -30, 'L', -12, 0, 'M', 0, -30, 'L', 0, 0, 'M', 8, -30, 'L', 12, 0), 2.5, 0.5),
    ].join(''),
  star: (o) => shape(star5(0, -22, 23, 10), o.color ?? YELLOW),
  sparkle: () => shape(d('M', 0, -20, 'Q', 2, -12, 10, -10, 'Q', 2, -8, 0, 0, 'Q', -2, -8, -10, -10, 'Q', -2, -12, 0, -20, 'Z'), YELLOW, { sw: 2.5 }),
  sweat: () => shape(d('M', 0, -18, 'Q', 8, -6, 4, -2, 'Q', 0, 2, -4, -2, 'Q', -8, -6, 0, -18, 'Z'), '#8FD3F4', { sw: 2.5 }),
  shoe: (o) =>
    group('shoe', shape(d('M', -18, 0, 'L', -18, -14, 'Q', -18, -20, -12, -20, 'L', 2, -20, 'Q', 6, -12, 14, -10, 'Q', 24, -8, 24, -2, 'Q', 24, 0, 20, 0, 'Z'), o.color ?? '#E05A47')),
  'name-tag': () => [rect(-20, -16, 40, 16, 4, WHITE, 3)].join(''),
  gear: () => {
    const teeth: string[] = []
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4
      teeth.push(el('rect', { x: -5, y: -24, width: 10, height: 10, rx: 2, fill: '#BDB6C9', transform: `rotate(${(a * 180) / Math.PI} 0 0)`, 'stroke-width': 2.5 }))
    }
    return group('gear', [...teeth, circle(0, 0, 17, '#BDB6C9', { sw: 3 }), circle(0, 0, 6, WHITE, { sw: 2.5 })], { transform: 'translate(0 -24)' })
  },
  medal: (o) =>
    [
      shape(d('M', -10, -60, 'L', -4, -30, 'L', 4, -30, 'L', 10, -60, 'Z'), '#4C9BE8', { sw: 3 }),
      circle(0, -18, 16, o.color ?? '#FCC419'),
      o.value ? digits(0, -10, o.value, 22) : '',
    ].join(''),
  podium: (o) => {
    const h = Number(o.variant ?? 60)
    return [rect(-46, -h, 92, h, 6, o.color ?? '#E9E4F0'), o.value ? digits(0, -h / 2 + 12, o.value, 34) : ''].join('')
  },
  calendar: (o) =>
    [
      rect(-50, -110, 100, 110, 8, WHITE),
      rect(-50, -110, 100, 26, 8, '#E5484D'),
      el('rect', { x: -50, y: -94, width: 100, height: 10, fill: '#E5484D', stroke: 'none' }),
      line(d('M', -50, -84, 'L', 50, -84), 3.5),
      circle(-26, -110, 4, WHITE, { sw: 2.5 }), circle(26, -110, 4, WHITE, { sw: 2.5 }),
      ...Array.from({ length: 12 }, (_, i) => circle(-33 + (i % 4) * 22, -70 + Math.floor(i / 4) * 26, 3.5, '#D8D2E4', { stroke: false })),
      o.value ? digits(11, -18, o.value, 30) : '',
      o.value ? el('path', { d: d('M', -12, -30, 'A', 23, 18, 0, 1, 1, -6, -16), fill: 'none', 'stroke-width': 3.5 }) : '',
    ].join(''),
  blackboard: (o) => {
    const chalk = '#F8F9FA'
    const content: string[] = []
    if (o.value) {
      // value like "2+2=4": digits as text, + and = drawn as chalk strokes
      const parts = o.value.split('')
      const step = 34
      const x0 = -((parts.length - 1) * step) / 2
      parts.forEach((ch, i) => {
        const x = x0 + i * step
        if (ch === '+') content.push(band([[x - 10, -70], [x + 10, -70]], 2.4, chalk, false) + band([[x, -80], [x, -60]], 2.4, chalk, false))
        else if (ch === '=') content.push(band([[x - 10, -75], [x + 10, -75]], 2.4, chalk, false) + band([[x - 10, -65], [x + 10, -65]], 2.4, chalk, false))
        else content.push(digits(x, -57, ch, 40, chalk))
      })
    }
    return [rect(-110, -130, 220, 120, 8, '#8A5A3B'), rect(-102, -122, 204, 104, 4, '#2F5D50', 3), ...content, rect(-60, -14, 40, 6, 3, '#F8F9FA', 2)].join('')
  },
  board100: () => {
    const dots: string[] = []
    for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++) dots.push(shape(star5(-63 + c * 14, -133 + r * 13, 6.2, 2.7), YELLOW, { sw: 1.6 }))
    return [rect(-80, -150, 160, 150, 10, '#4C6EF5'), ...dots].join('')
  },
  board100row: () => {
    const dots: string[] = []
    for (let c = 0; c < 10; c++) dots.push(shape(star5(-63 + c * 14, -6, 6.2, 2.7), YELLOW, { sw: 1.6 }))
    return dots.join('')
  },
  board: () => rect(-80, -150, 160, 150, 10, '#4C6EF5'),

  // ---------- places & outdoor ----------
  sun: () => {
    const rays: string[] = []
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4
      rays.push(`M${num(Math.cos(a) * 30)} ${num(-30 + Math.sin(a) * 30)}L${num(Math.cos(a) * 40)} ${num(-30 + Math.sin(a) * 40)}`)
    }
    return [el('path', { d: rays.join(''), fill: 'none', 'stroke-width': 4 }), circle(0, -30, 22, '#FFD43B')].join('')
  },
  cloud: (o) =>
    shape(d('M', -40, 0, 'Q', -54, 0, -50, -14, 'Q', -46, -28, -30, -24, 'Q', -26, -44, -4, -42, 'Q', 14, -50, 24, -32, 'Q', 44, -34, 46, -16, 'Q', 52, 0, 36, 0, 'Z'), o.color ?? WHITE, { sw: 3 }),
  'apartment-tower': () => {
    const wins: string[] = []
    for (let r = 0; r < 11; r++) for (let c = 0; c < 3; c++) wins.push(rect(-30 + c * 22, -300 + r * 26, 14, 14, 2, '#CFE8F7', 2.5))
    return [rect(-44, -320, 88, 320, 4, '#E8DCC8'), rect(-50, -326, 100, 12, 3, '#B8A88E', 3), ...wins, rect(-12, -28, 24, 28, 2, '#8A5A3B', 3)].join('')
  },
  pagoda: () => {
    const tiers: string[] = []
    for (let i = 0; i < 4; i++) {
      const y = -i * 22
      const w = 30 - i * 5
      tiers.push(rect(-w + 6, y - 18, (w - 6) * 2, 18, 2, '#F2E2C4', 2.5))
      tiers.push(shape(d('M', -w - 6, y - 16, 'Q', 0, y - 24, w + 6, y - 16, 'L', w - 2, y - 24, 'L', -w + 2, y - 24, 'Z'), '#2F8F83', { sw: 2.5 }))
    }
    tiers.push(shape(d('M', 0, -108, 'L', 0, -96), 'none', { sw: 3 }))
    return tiers.join('')
  },
  hill: (o) => shape(d('M', -150, 0, 'Q', -70, -130, 0, -130, 'Q', 70, -130, 150, 0, 'Z'), o.color ?? '#8CC97E'),
  tree: () => [rect(-7, -60, 14, 60, 4, '#8A5A3B'), circle(0, -84, 34, '#69B85E')].join(''),
  'market-stall': () =>
    [
      rect(-120, -150, 10, 150, 3, '#8A5A3B'),
      rect(110, -150, 10, 150, 3, '#8A5A3B'),
      ...Array.from({ length: 6 }, (_, i) => shape(d('M', -126 + i * 42, -180, 'L', -84 + i * 42, -180, 'L', -84 + i * 42, -150, 'Q', -105 + i * 42, -136, -126 + i * 42, -150, 'Z'), i % 2 ? WHITE : '#E5484D', { sw: 3 })),
      rect(-130, -76, 260, 76, 6, '#D9A066'),
      line(d('M', -130, -56, 'L', 130, -56), 3, 0.4),
    ].join(''),
  'tea-shop': () =>
    [
      rect(-90, -180, 180, 180, 6, '#FFE8CC'),
      ...Array.from({ length: 5 }, (_, i) => shape(d('M', -98 + i * 39.2, -190, 'L', -58.8 + i * 39.2, -190, 'L', -58.8 + i * 39.2, -164, 'Q', -78.4 + i * 39.2, -152, -98 + i * 39.2, -164, 'Z'), i % 2 ? WHITE : '#2F9E44', { sw: 3 })),
      rect(-70, -140, 140, 70, 6, '#CFE8F7', 3),
      rect(-90, -66, 180, 66, 4, '#F4A261'),
      group('cup-sign', PROPS['bubble-tea']({}), { transform: 'translate(0 -76) scale(0.8)' }),
    ].join(''),
  road: () => [el('rect', { x: -240, y: -40, width: 480, height: 40, fill: '#8E8AA0', stroke: 'none' }), ...[-200, -120, -40, 40, 120, 200].map((x) => el('rect', { x: x - 18, y: -23, width: 36, height: 6, rx: 3, fill: WHITE, stroke: 'none' }))].join(''),
  'metro-map': () =>
    [
      rect(-90, -130, 180, 120, 8, WHITE),
      band([[-70, -100], [-10, -100], [30, -60], [70, -60]], 3.2, '#E5484D', false),
      band([[-60, -30], [-20, -70], [-20, -110]], 3.2, '#4C9BE8', false),
      band([[-20, -70], [60, -110]], 3.2, '#4C9BE8', false),
      band([[-76, -50], [70, -30]], 3.2, '#2F9E44', false),
      ...[[-70, -100], [-10, -100], [30, -60], [70, -60], [-60, -30], [-20, -70], [60, -110], [-76, -50], [70, -30], [-20, -110]].map(([x, y]) => circle(x, y, 5, WHITE, { sw: 2.5 })),
      rect(-6, -136, 12, 6, 2, '#BDB6C9', 2),
    ].join(''),
  map: () =>
    [
      shape(d('M', -44, -60, 'L', -14, -66, 'L', 14, -60, 'L', 44, -66, 'L', 44, 0, 'L', 14, 6, 'L', -14, 0, 'L', -44, 6, 'Z'), '#FFF1C9'),
      line(d('M', -14, -66, 'L', -14, 0, 'M', 14, -60, 'L', 14, 6), 2.5, 0.4),
      el('path', { d: d('M', -36, -16, 'Q', -10, -40, 8, -24, 'Q', 24, -10, 36, -40), fill: 'none', 'stroke-width': 3, 'stroke-dasharray': '5 6' }),
    ].join(''),
  'location-pin': (o) =>
    [shape(d('M', 0, 0, 'Q', -20, -24, -20, -36, 'Q', -20, -56, 0, -56, 'Q', 20, -56, 20, -36, 'Q', 20, -24, 0, 0, 'Z'), o.color ?? '#E5484D'), circle(0, -36, 7, WHITE, { sw: 3 })].join(''),
  plane: () =>
    [
      shape(d('M', -34, -22, 'L', -42, -42, 'L', -30, -42, 'L', -18, -22, 'Z'), '#4C9BE8', { sw: 3 }),
      rect(-44, -26, 88, 18, 9, '#F1F3F7', 3),
      shape(d('M', -4, -16, 'L', -22, 6, 'L', -10, 6, 'L', 14, -16, 'Z'), '#4C9BE8', { sw: 3 }),
      ...[-22, -12, -2, 8, 18, 28].map((x) => circle(x, -20, 2.2, '#4C9BE8', { stroke: false })),
    ].join(''),
  'gate-sign': () => [rect(-40, -36, 80, 36, 6, '#FFD43B'), shape(d('M', -14, -18, 'L', 14, -18, 'M', 4, -26, 'L', 14, -18, 'L', 4, -10), 'none', { sw: 4 })].join(''),

  // ---------- marks & symbols (no letters) ----------
  check: () => mark('check'),
  cross: () => mark('cross'),
  question: () => ICONS.question(0, -26, 1.4),
  heart: () => shape(heartPath(0, -14, 1.3), '#F06595', { sw: 3 }),
  plus: () => shape(d('M', -16, -20, 'L', 16, -20, 'M', 0, -36, 'L', 0, -4), 'none', { sw: 9 }),
  equals: () => shape(d('M', -18, -26, 'L', 18, -26, 'M', -18, -12, 'L', 18, -12), 'none', { sw: 9 }),
  arrow: (o) => {
    const c = o.color ?? '#FFD43B'
    if (o.variant === 'curve') {
      return [band([[-50, 0], [-20, -34], [16, -36], [40, -16]], 5, c, true, 3), shape(d('M', 28, -30, 'L', 56, -2, 'L', 50, -36, 'Z'), c, { sw: 3 })].join('')
    }
    return shape(d('M', -50, -10, 'L', 20, -10, 'L', 20, -24, 'L', 50, 0, 'L', 20, 24, 'L', 20, 10, 'L', -50, 10, 'Z'), c, { sw: 3.5 }).replace(/d="([^"]*)"/, (_m, p) => `d="${p}" transform="translate(0 -24)"`)
  },
  digit: (o) => [circle(0, -26, 26, o.color ?? YELLOW), digits(0, -14, o.value ?? '0', o.value && o.value.length > 2 ? 24 : 34)].join(''),
  steam: () => line(d('M', -10, 0, 'Q', -16, -10, -10, -20, 'Q', -4, -30, -10, -40, 'M', 8, 0, 'Q', 2, -10, 8, -20, 'Q', 14, -30, 8, -40), 3.5, 0.35),
  hotLines: () => shape(d('M', -14, 0, 'Q', -20, -12, -14, -24, 'M', 0, 0, 'Q', -6, -12, 0, -24, 'M', 14, 0, 'Q', 8, -12, 14, -24), 'none', { sw: 4 }),
  'motion-lines': () => line(d('M', -30, -10, 'L', -10, -10, 'M', -34, 0, 'L', -6, 0, 'M', -30, 10, 'L', -10, 10), 3.5, 0.5),
  bell: () => [shape(d('M', -14, -6, 'Q', -14, -34, 0, -34, 'Q', 14, -34, 14, -6, 'L', 18, 0, 'L', -18, 0, 'Z'), YELLOW, { sw: 3 }), circle(0, 4, 4, YELLOW, { sw: 2.5 })].join(''),
  'sound-lines': () => shape(d('M', 0, -30, 'Q', 10, -20, 0, -10, 'M', 10, -38, 'Q', 26, -20, 10, -2), 'none', { sw: 3.5 }),
  puddle: () => shape(d('M', -34, -2, 'Q', -36, -10, -20, -10, 'Q', -10, -16, 4, -11, 'Q', 22, -14, 30, -6, 'Q', 34, 2, 14, 0, 'Q', -2, 4, -14, 1, 'Q', -30, 4, -34, -2, 'Z'), '#D9B86A', { sw: 2.5 }),
  shirt: (o) =>
    shape(d('M', -14, -40, 'Q', 0, -34, 14, -40, 'L', 32, -30, 'L', 26, -18, 'L', 18, -22, 'L', 18, 0, 'L', -18, 0, 'L', -18, -22, 'L', -26, -18, 'L', -32, -30, 'Z'), o.color ?? '#74C0FC'),
  crumbs: () => [circle(-8, -3, 2, '#C98B5B', { stroke: false }), circle(4, -2, 2, '#C98B5B', { stroke: false })].join(''),

  // ---------- animals (tahap 2) ----------
  cat: (o) => {
    const c = o.color ?? '#F4A259'
    if (o.variant === 'sleep') {
      // curled up, side view, head on the left
      return [
        ellipse(4, -20, 36, 20, c),
        line(d('M', 0, -38, 'Q', 4, -30, 2, -24, 'M', 14, -38, 'Q', 18, -30, 16, -24, 'M', 26, -33, 'Q', 28, -27, 26, -22), 3, 0.5),
        band([[38, -12], [22, -2], [-6, -1], [-26, -6]], 5.5, c, true, 3),
        shape(d('M', -38, -26, 'L', -40, -44, 'L', -28, -36, 'Z'), c, { sw: 3 }),
        shape(d('M', -22, -34, 'L', -16, -48, 'L', -10, -34, 'Z'), c, { sw: 3 }),
        ellipse(-26, -22, 17, 15, c),
        line(d('M', -35, -24, 'Q', -31, -20, -27, -24, 'M', -22, -24, 'Q', -18, -20, -14, -24), 2.5),
        shape(d('M', -26, -17, 'L', -23, -17, 'L', -24.5, -15, 'Z'), '#F28B82', { sw: 1.5 }),
        line(d('M', -32, -33, 'L', -30, -29, 'M', -26, -35, 'L', -26, -30, 'M', -20, -33, 'L', -22, -29), 2.5, 0.5),
      ].join('')
    }
    return [
      pivot(14, -6, group('tail', band([[0, 0], [20, -4], [24, -24], [16, -34]], 5.5, c, true, 3))),
      shape(d('M', -19, 0, 'Q', -25, -28, -12, -44, 'L', 12, -44, 'Q', 25, -28, 19, 0, 'Z'), c),
      line(d('M', -18, -22, 'L', -10, -20, 'M', 18, -22, 'L', 10, -20, 'M', -19, -12, 'L', -11, -11, 'M', 19, -12, 'L', 11, -11), 2.5, 0.5),
      ellipse(0, -16, 9, 13, '#FFF1E0', { sw: 2.5 }),
      ellipse(-9, -3, 7, 4.5, c, { sw: 2.5 }),
      ellipse(9, -3, 7, 4.5, c, { sw: 2.5 }),
      shape(d('M', -18, -66, 'L', -16, -86, 'L', -3, -76, 'Z'), c, { sw: 3 }),
      shape(d('M', 18, -66, 'L', 16, -86, 'L', 3, -76, 'Z'), c, { sw: 3 }),
      shape(d('M', -14, -70, 'L', -14, -80, 'L', -7, -75, 'Z'), '#F7B7B0', { stroke: false }),
      shape(d('M', 14, -70, 'L', 14, -80, 'L', 7, -75, 'Z'), '#F7B7B0', { stroke: false }),
      ellipse(0, -60, 21, 18, c),
      line(d('M', -6, -77, 'L', -5, -71, 'M', 0, -78, 'L', 0, -72, 'M', 6, -77, 'L', 5, -71), 2.5, 0.55),
      group('eyes', [circle(-8, -61, 2.8, '#231942', { stroke: false }), circle(8, -61, 2.8, '#231942', { stroke: false })], { transform: 'translate(0 0)' }),
      shape(d('M', -3, -55, 'L', 3, -55, 'L', 0, -52, 'Z'), '#F28B82', { sw: 1.5 }),
      line(d('M', -5, -49, 'Q', -2.5, -47, 0, -51, 'Q', 2.5, -47, 5, -49, 'M', -12, -54, 'L', -24, -56, 'M', -12, -51, 'L', -23, -49, 'M', 12, -54, 'L', 24, -56, 'M', 12, -51, 'L', 23, -49), 2, 0.7),
    ].join('')
  },
  dog: (o) => {
    const c = o.color ?? '#F2C14E'
    const ear = '#B5793A'
    const run = o.variant === 'run'
    const legs = run
      ? [band([[-22, -22], [-34, -8], [-40, -2]], 5.5, c, true, 3), band([[-12, -22], [-6, -10], [-2, -2]], 5.5, c, true, 3), band([[12, -22], [6, -8], [2, -2]], 5.5, c, true, 3), band([[20, -22], [32, -12], [40, -6]], 5.5, c, true, 3)]
      : [-22, -10, 10, 22].map((x) => rect(x - 5, -26, 10, 26, 4, c, 3))
    return [
      pivot(-30, -34, group('tail', band([[0, 0], [-12, -12], [-16, -26]], 4.5, c, true, 3))),
      ...legs,
      el('rect', { x: -34, y: -46, width: 64, height: 28, rx: 14, fill: c }),
      ellipse(30, -50, 17, 15, c),
      ellipse(44, -44, 9, 7, '#FFE8B0', { sw: 2.5 }),
      circle(51, -46, 3.2, '#231942', { stroke: false }),
      run ? shape(d('M', 40, -38, 'Q', 42, -30, 46, -32, 'Q', 47, -36, 45, -39), '#F06595', { sw: 2 }) : line(d('M', 40, -39, 'Q', 44, -37, 48, -40), 2.5),
      group('eyes', circle(34, -54, 2.8, '#231942', { stroke: false })),
      shape(d('M', 20, -62, 'Q', 12, -60, 14, -44, 'Q', 22, -44, 24, -56, 'Z'), ear, { sw: 3 }),
    ].join('')
  },
  bird: (o) => {
    const c = o.color ?? '#4C9BE8'
    return [
      line(d('M', -3, -6, 'L', -5, 0, 'M', 4, -6, 'L', 4, 0), 2.5),
      shape(d('M', -14, -18, 'L', -24, -22, 'L', -22, -12, 'Z'), c, { sw: 2.5 }),
      ellipse(0, -18, 15, 13, c),
      ellipse(4, -14, 7, 5, '#FFF4D6', { stroke: false }),
      shape(d('M', -10, -20, 'Q', -2, -24, 4, -16, 'Q', -6, -10, -10, -20, 'Z'), c, { sw: 2.5 }),
      shape(d('M', 14, -22, 'L', 22, -19, 'L', 14, -16, 'Z'), '#F59F00', { sw: 2 }),
      group('eyes', circle(8, -23, 2.2, '#231942', { stroke: false })),
    ].join('')
  },
  branch: () =>
    [
      band([[-170, 4], [-60, -2], [60, 2], [170, -4]], 5, '#8A5A3B', true, 3),
      ...[[-140, 2, -30], [150, -4, 25], [-60, -2, -20], [90, 2, 35]].map(([x, y, r]) => shape(d('M', 0, 0, 'Q', 10, -14, 26, -10, 'Q', 16, 4, 0, 0, 'Z'), LEAF, { sw: 2.5 }).replace('<path', `<path transform="translate(${x} ${y}) rotate(${r})"`)),
    ].join(''),
  pig: () =>
    [
      shape(d('M', -40, -40, 'Q', -54, -46, -50, -54, 'Q', -46, -60, -48, -50), 'none', { sw: 3 }),
      ...[-28, -14, 16, 28].map((x) => rect(x - 5, -20, 10, 20, 4, '#F7A9B8', 3)),
      ellipse(0, -36, 42, 24, '#FBC4CF'),
      shape(d('M', 22, -58, 'L', 30, -72, 'L', 36, -56, 'Z'), '#F7A9B8', { sw: 3 }),
      ellipse(36, -42, 18, 16, '#FBC4CF'),
      ellipse(50, -40, 8, 9, '#F7A9B8', { sw: 3 }),
      circle(48, -41, 1.6, '#231942', { stroke: false }),
      circle(52, -39, 1.6, '#231942', { stroke: false }),
      group('eyes', circle(36, -48, 2.6, '#231942', { stroke: false })),
    ].join(''),

  // ---------- home & things (tahap 2) ----------
  bicycle: (o) => {
    const c = o.color ?? '#E5484D'
    return [
      circle(-38, -28, 26, 'none', { sw: 5 }),
      circle(38, -28, 26, 'none', { sw: 5 }),
      circle(-38, -28, 3, '#BDB6C9', { sw: 2 }),
      circle(38, -28, 3, '#BDB6C9', { sw: 2 }),
      band([[-38, -28], [-6, -28], [-16, -62], [-38, -28]], 3.6, c, true, 2.5),
      band([[-6, -28], [26, -62], [-16, -62]], 3.6, c, true, 2.5),
      band([[38, -28], [24, -72]], 3.6, c, true, 2.5),
      band([[16, -76], [30, -74]], 3, '#4A4458', true, 2.5),
      band([[-24, -68], [-8, -68]], 4, '#4A4458', true, 2.5),
    ].join('')
  },
  'banana-bunch': (o) => {
    // bananas lying on their side, stacked and joined at one stem (right); 'y' = ripe, 'g' = green
    const pattern = (o.value ?? 'yyyyy').split('')
    const out: string[] = []
    pattern.forEach((k, i) => {
      const fill = k === 'g' ? '#8BC34A' : YELLOW
      const tip = k === 'g' ? '#4E7A27' : '#6E5236'
      const y = -i * 15
      const a = (i - (pattern.length - 1) / 2) * -5
      const b = [
        shape(d('M', -62, -26, 'Q', -40, 6, 0, 2, 'Q', 24, 0, 34, -14, 'L', 30, -22, 'Q', 16, -12, 0, -12, 'Q', -36, -10, -62, -26, 'Z'), fill, { sw: 3 }),
        circle(-61, -25, 3, tip, { stroke: false }),
        line(d('M', -40, -8, 'Q', -10, 0, 22, -10), 2, 0.3),
      ].join('')
      out.push(el('g', { transform: `translate(0 ${y}) rotate(${num(a)} 32 -18)` }, el('g', { class: `banana bn-${k}` }, b)))
    })
    return [...out.reverse(), rect(28, -36 - (pattern.length - 1) * 15, 16, 26 + (pattern.length - 1) * 15, 6, '#7A9A3A', 3)].join('')
  },
  handbag: (o) =>
    [
      shape(d('M', -14, -34, 'Q', -14, -50, 0, -50, 'Q', 14, -50, 14, -34), 'none', { sw: 4 }),
      shape(d('M', -24, -34, 'L', 24, -34, 'L', 28, 0, 'L', -28, 0, 'Z'), o.color ?? '#9775FA'),
      rect(-6, -30, 12, 8, 2, YELLOW, 2.5),
    ].join(''),
  trophy: () =>
    [
      shape(d('M', -20, -66, 'Q', -36, -66, -32, -52, 'Q', -28, -42, -16, -44, 'M', 20, -66, 'Q', 36, -66, 32, -52, 'Q', 28, -42, 16, -44), 'none', { sw: 5 }),
      rect(-22, -10, 44, 10, 3, '#8A5A3B'),
      rect(-6, -26, 12, 18, 2, '#FCC419', 3),
      shape(d('M', -22, -70, 'L', 22, -70, 'Q', 22, -30, 0, -28, 'Q', -22, -30, -22, -70, 'Z'), '#FCC419'),
      shape(star5(0, -50, 8, 3.5), WHITE, { sw: 2 }),
    ].join(''),
  comb: () => [rect(-26, -12, 52, 12, 4, '#F06595', 3), line(d(...Array.from({ length: 8 }, (_, i) => ['M', -21 + i * 6, 0, 'L', -21 + i * 6, 9]).flat()), 2.5)].join(''),
  bed: (o) =>
    [
      rect(-84, -86, 16, 86, 5, WOOD_D),
      rect(70, -54, 14, 54, 5, WOOD_D),
      rect(-74, -46, 152, 26, 8, WOOD),
      rect(-70, -62, 46, 20, 9, WHITE, 3),
      shape(d('M', -26, -66, 'L', 76, -66, 'Q', 82, -66, 82, -58, 'L', 82, -20, 'L', -26, -20, 'Z'), o.color ?? '#F7A1C4'),
      line(d('M', -10, -66, 'L', -10, -20), 3, 0.35),
    ].join(''),
  desk: (o) =>
    [
      rect(-62, -58, 12, 58, 4, WOOD_D),
      rect(28, -58, 36, 58, 4, WOOD),
      line(d('M', 30, -30, 'L', 62, -30), 3),
      circle(46, -44, 2.5, YELLOW, { sw: 2 }),
      rect(-70, -70, 140, 14, 5, o.color ?? WOOD),
    ].join(''),
  book: (o) =>
    o.variant === 'closed'
      ? [rect(-18, -26, 36, 26, 3, o.color ?? '#4C9BE8'), rect(-18, -6, 36, 6, 2, WHITE, 2.5)].join('')
      : [
          shape(d('M', 0, -4, 'Q', -14, -10, -30, -6, 'L', -30, -30, 'Q', -14, -34, 0, -28, 'Z'), WHITE, { sw: 3 }),
          shape(d('M', 0, -4, 'Q', 14, -10, 30, -6, 'L', 30, -30, 'Q', 14, -34, 0, -28, 'Z'), WHITE, { sw: 3 }),
          line(d('M', -24, -24, 'L', -6, -22, 'M', -24, -17, 'L', -6, -15, 'M', 6, -22, 'L', 24, -24, 'M', 6, -15, 'L', 24, -17), 2, 0.35),
          shape(d('M', -32, -4, 'Q', -14, -8, 0, 0, 'Q', 14, -8, 32, -4, 'L', 32, -1, 'Q', 14, -4, 0, 3, 'Q', -14, -4, -32, -1, 'Z'), o.color ?? '#4C9BE8', { sw: 2.5 }),
        ].join(''),
  newspaper: () =>
    [
      rect(-30, -44, 60, 44, 3, '#F4F1EA'),
      rect(-24, -38, 22, 16, 2, '#C5D7E8', 2),
      line(d('M', 4, -36, 'L', 24, -36, 'M', 4, -29, 'L', 24, -29, 'M', -24, -15, 'L', 24, -15, 'M', -24, -8, 'L', 24, -8), 2.5, 0.35),
      line(d('M', 0, -44, 'L', 0, 0), 2.5, 0.5),
    ].join(''),
  tray: () => [rect(-90, -12, 180, 12, 6, '#E8A15A'), rect(-96, -16, 12, 8, 3, '#C8813A', 2.5), rect(84, -16, 12, 8, 3, '#C8813A', 2.5)].join(''),
  glass: (o) =>
    [
      shape(d('M', -15, -50, 'L', 15, -50, 'L', 12, 0, 'L', -12, 0, 'Z'), '#EAF6FD'),
      shape(d('M', -13.6, -36, 'L', 13.6, -36, 'L', 11.8, -2, 'L', -11.8, -2, 'Z'), o.color ?? WHITE, { stroke: false }),
      line(d('M', -13.6, -36, 'L', 13.6, -36), 2.5, 0.4),
      shape(d('M', -15, -50, 'L', 15, -50, 'L', 12, 0, 'L', -12, 0, 'Z'), 'none'),
    ].join(''),
  'old-photo': (o) => {
    const brothers = o.variant === 'brothers'
    const kid = (x: number, h: number, hair: string, shirt: string, girl: boolean, extra = '') => {
      const r = h * 0.2
      const hy = -h + r
      const body = [
        rect(x - h * 0.08, -h * 0.34, h * 0.07, h * 0.34, 2, '#5C5470', 2),
        rect(x + h * 0.01, -h * 0.34, h * 0.07, h * 0.34, 2, '#5C5470', 2),
        girl
          ? shape(d('M', x - h * 0.13, hy + r + 2, 'L', x + h * 0.13, hy + r + 2, 'L', x + h * 0.21, -h * 0.3, 'L', x - h * 0.21, -h * 0.3, 'Z'), shirt, { sw: 2.5 })
          : rect(x - h * 0.15, hy + r + 2, h * 0.3, h * 0.38, 4, shirt, 2.5),
      ]
      const hairSvg = girl
        ? [circle(x - r * 1.05, hy - r * 0.1, r * 0.45, hair, { sw: 2.5 }), circle(x + r * 1.05, hy - r * 0.1, r * 0.45, hair, { sw: 2.5 })].join('')
        : ''
      return [
        ...body,
        hairSvg,
        circle(x, hy, r, '#F6D3B3', { sw: 2.5 }),
        shape(d('M', x - r, hy - r * 0.05, 'Q', x - r, hy - r * 1.1, x, hy - r * 1.05, 'Q', x + r, hy - r * 1.1, x + r, hy - r * 0.05, 'Q', x, hy - r * 0.6, x - r, hy - r * 0.05, 'Z'), hair, { sw: 2 }),
        circle(x - r * 0.35, hy + r * 0.15, 1.3, '#231942', { stroke: false }),
        circle(x + r * 0.35, hy + r * 0.15, 1.3, '#231942', { stroke: false }),
        line(d('M', x - r * 0.3, hy + r * 0.45, 'Q', x, hy + r * 0.7, x + r * 0.3, hy + r * 0.45), 1.8),
        extra,
      ].join('')
    }
    const people = brothers
      ? [kid(-22, 84, '#2B2233', '#74C0FC', false), kid(26, 50, '#2B2233', '#8CE99A', false)]
      : [kid(-22, 84, '#2B2233', '#B197FC', true), kid(26, 52, '#2B2233', '#FFA8A8', true)]
    return [rect(-66, -120, 132, 120, 6, '#C98B5B'), rect(-56, -110, 112, 100, 3, '#F3E3C3', 2.5), el('g', { transform: 'translate(0 -14)' }, people.join(''))].join('')
  },
  'photo-frame': (o) => {
    const w = Number(o.value ?? 240) / 2
    const h = Number(o.variant ?? 180)
    return [rect(-w, -h, w * 2, h, 8, '#C98B5B'), rect(-w + 10, -h + 10, w * 2 - 20, h - 20, 4, '#DFF1D8', 3), el('rect', { x: -w + 12, y: -h * 0.36, width: w * 2 - 24, height: h * 0.36 - 12, fill: '#B9DFA5', stroke: 'none' })].join('')
  },
  'apartment-night': () => {
    const wins: string[] = []
    for (let r = 0; r < 6; r++)
      for (let c = 0; c < 3; c++) {
        if (r === 3 && c === 1) continue
        wins.push(rect(-66 + c * 50, -258 + r * 40, 32, 26, 3, (r + c) % 3 === 0 ? '#FFE8A3' : '#4B4F7A', 2.5))
      }
    return [
      rect(-90, -280, 180, 280, 4, '#8E86B0'),
      rect(-98, -288, 196, 14, 3, '#6E6690', 3),
      ...wins,
      group('home-window', [
        rect(-34, -146, 68, 50, 4, '#FFD43B', 3),
        ...[-18, -4, 10, 22].map((x, i) => circle(x, -124 + (i === 3 ? 6 : 0), i === 3 ? 4.5 : 6, '#5F4BB6', { stroke: false })),
        el('rect', { x: -30, y: -112, width: 60, height: 6, fill: '#8A5A3B', stroke: 'none' }),
        rect(-40, -98, 80, 8, 2, '#C9C3DC', 2.5),
      ]),
      rect(-18, -34, 36, 34, 3, '#8A5A3B', 3),
    ].join('')
  },
  marker: (o) => shape(d('M', -16, -46, 'L', 16, -46, 'L', 16, -26, 'L', 28, -26, 'L', 0, 0, 'L', -28, -26, 'L', -16, -26, 'Z'), o.color ?? YELLOW, { sw: 3.5 }),
  gender: (o) =>
    o.variant === 'female'
      ? [circle(0, -44, 16, WHITE, { sw: 5.5 }), shape(d('M', 0, -28, 'L', 0, 0, 'M', -10, -12, 'L', 10, -12), 'none', { sw: 5.5 })].join('')
      : [circle(-6, -18, 16, WHITE, { sw: 5.5 }), shape(d('M', 5, -29, 'L', 22, -46, 'M', 8, -46, 'L', 22, -46, 'L', 22, -32), 'none', { sw: 5.5 })].join(''),
  lamp: () => [rect(-16, -4, 32, 6, 3, '#4A4458', 2.5), band([[0, -4], [0, -130]], 2.5, '#4A4458', true, 2.5), shape(d('M', -26, -126, 'L', 26, -126, 'L', 16, -160, 'L', -16, -160, 'Z'), '#FFE8A3')].join(''),
  plant: () =>
    [
      ...[[-14, -64, -30], [12, -70, 25], [0, -82, 0], [-20, -44, -55], [20, -48, 55]].map(([x, y, r]) =>
        shape(d('M', 0, 0, 'Q', -12, -18, 0, -36, 'Q', 12, -18, 0, 0, 'Z'), '#4CAF50', { sw: 3 }).replace('<path', `<path transform="translate(${x * 0.4} ${-36}) rotate(${r}) translate(0 ${y + 36})"`),
      ),
      shape(d('M', -20, -38, 'L', 20, -38, 'L', 15, 0, 'L', -15, 0, 'Z'), '#E8590C'),
    ].join(''),

  /** Digits on a wide yellow badge (numbers with many digits, e.g. 1000). */
  badge: (o) => {
    const v = o.value ?? '0'
    const w = 26 + v.length * 21
    return [rect(-w / 2, -50, w, 50, 25, o.color ?? YELLOW), digits(0, -12, v, 38)].join('')
  },
  /** A light board of 10 x 10 dots (one hundred), cheap enough to repeat ten times. */
  'board100-dots': () => {
    const rows = Array.from({ length: 10 }, (_, r) => `M-45 ${-98 + r * 10}h90`).join('')
    return [rect(-58, -112, 116, 112, 8, '#BFD3FF'), el('path', { d: rows, fill: 'none', 'stroke-width': 5.5, 'stroke-dasharray': '0 10' })].join('')
  },
  // ---------- picture characters (origin animations, tahap 2) ----------
  walker: (o) => {
    const c = o.color ?? '#5F4BB6'
    // a person in profile walking to the left, leaning forward: legs make an upside-down V like 人
    return [
      band([[6, -112], [26, -86], [34, -62]], 8, c, true, 3),
      band([[2, -70], [26, -36], [40, 0]], 10, c, true, 3),
      shape(d('M', -2, -128, 'Q', 14, -128, 14, -104, 'L', 8, -64, 'Q', -2, -58, -10, -66, 'L', -14, -104, 'Q', -16, -128, -2, -128, 'Z'), c),
      band([[-4, -70], [-22, -36], [-40, 0]], 10, c, true, 3),
      band([[-6, -112], [-26, -92], [-40, -82]], 8, c, true, 3),
      circle(-8, -146, 17, c),
    ].join('')
  },
  roof: (o) =>
    [
      rect(-6, -126, 12, 22, 4, o.color ?? '#D9480F', 3),
      shape(d('M', -100, -74, 'Q', -60, -96, -40, -108, 'L', 40, -108, 'Q', 60, -96, 100, -74, 'Q', 104, -64, 92, -66, 'L', -92, -66, 'Q', -104, -64, -100, -74, 'Z'), o.color ?? '#D9480F'),
      line(d('M', -60, -92, 'L', 60, -92, 'M', -30, -106, 'L', -36, -70, 'M', 0, -106, 'L', 0, -70, 'M', 30, -106, 'L', 36, -70), 3, 0.35),
      rect(-84, -66, 14, 66, 3, '#C98B5B'),
      rect(70, -66, 14, 66, 3, '#C98B5B'),
    ].join(''),
  /** Plain card behind a picture (same size as the glyph card). */
  card: (o) => rect(-72, -144, 144, 144, 14, o.color ?? WHITE),
  glyph: (o) => {
    const ch = o.value ?? '人'
    const strokes = GLYPH_STROKES[ch]
    if (!strokes) throw new Error(`no glyph ${ch}`)
    const s = 0.12
    const paths = strokes.map((p, i) => el('path', { class: `stroke stroke-${i + 1}`, d: p, fill: '#231942', stroke: 'none' })).join('')
    return [
      rect(-72, -144, 144, 144, 14, o.color ?? WHITE),
      el('path', { d: 'M-72 -72L72 -72M0 -144L0 0', fill: 'none', 'stroke-width': 2, 'stroke-dasharray': '6 6', opacity: 0.25 }),
      el('g', { transform: `matrix(${s} 0 0 ${-s} ${num(-512 * s)} ${num(-10 - 124 * s)})` }, paths),
    ].join('')
  },
  // ---------- food & drink (tahap 3, u09) ----------
  /** Bowl of noodles in soup with a few greens and half an egg. variant 'lift': fewer noodles left. */
  'noodle-bowl': (o) =>
    [
      shape(d('M', -36, -30, 'Q', 0, -40, 36, -30, 'Z'), '#F4C06A', { sw: 3 }),
      line(d('M', -26, -33, 'Q', -18, -38, -10, -33, 'Q', -2, -28, 6, -33, 'Q', 14, -38, 22, -33, 'M', -20, -36, 'Q', -12, -31, -4, -36, 'Q', 4, -41, 12, -36), 2.5),
      o.variant === 'lift' ? '' : [ellipse(16, -37, 8, 5, WHITE, { sw: 2.5 }), circle(16, -37, 3.2, YELLOW, { stroke: false })].join(''),
      shape(d('M', -22, -36, 'Q', -16, -46, -8, -38, 'Q', -14, -34, -22, -36, 'Z'), '#4CAF50', { sw: 2.5 }),
      shape(d('M', -38, -30, 'L', 38, -30, 'Q', 36, -2, 0, -2, 'Q', -36, -2, -38, -30, 'Z'), o.color ?? WHITE),
      line(d('M', -30, -18, 'Q', 0, -11, 30, -18), 3, 0.3),
      rect(-13, -4, 26, 4, 2, o.color ?? WHITE, 3),
    ].join(''),
  /** Chopsticks lifting long noodles (origin = the hand holding the chopsticks). */
  'noodles-lift': () =>
    [
      ...[[[22, 12], [17, 50], [23, 92]], [[27, 10], [32, 50], [28, 94]], [[32, 9], [39, 46], [35, 88]], [[25, 12], [27, 48], [19, 86]]].map((pts) => band(pts as [number, number][], 2.2, '#F4D58D', true, 2.5)),
      shape(d('M', 0, 0, 'L', 34, 18, 'M', 2, -6, 'L', 38, 10), 'none', { sw: 4 }),
    ].join(''),
  'rice-cooker': () =>
    [
      rect(-44, -62, 88, 62, 18, '#F8F9FA'),
      shape(d('M', -46, -60, 'Q', -46, -86, 0, -88, 'Q', 46, -86, 46, -60, 'Z'), '#E9ECEF'),
      rect(-10, -96, 20, 10, 4, '#ADB5BD', 3),
      rect(-18, -40, 36, 18, 5, '#74C0FC', 3),
      circle(0, -31, 4, '#FA5252', { sw: 2 }),
    ].join(''),
  /** Plate of stir-fried greens (bok choy). */
  'greens-plate': () =>
    [
      ...[[-22, -14, -30], [-8, -18, -10], [8, -18, 12], [22, -14, 30], [0, -12, 0]].map(([x, y, r]) =>
        el('g', { transform: `translate(${x} ${y}) rotate(${r})` }, [shape(d('M', 0, 4, 'Q', -12, -8, -4, -24, 'Q', 0, -28, 4, -24, 'Q', 12, -8, 0, 4, 'Z'), '#40A24E', { sw: 2.5 }), line(d('M', 0, 2, 'L', 0, -18), 2.5, 0.6)].join('')),
      ),
      ellipse(0, -7, 46, 9, WHITE),
      ellipse(0, -8, 30, 5, '#F1EEF6', { sw: 2.5 }),
    ].join(''),
  'water-bottle': () =>
    [
      rect(-7, -82, 14, 10, 3, '#4C9BE8', 2.5),
      shape(d('M', -8, -72, 'L', 8, -72, 'Q', 16, -64, 16, -52, 'L', 16, -4, 'Q', 16, 0, 12, 0, 'L', -12, 0, 'Q', -16, 0, -16, -4, 'L', -16, -52, 'Q', -16, -64, -8, -72, 'Z'), '#E7F5FF'),
      shape(d('M', -14, -40, 'L', 14, -40, 'L', 14, -4, 'L', -14, -4, 'Z'), '#A5D8FF', { stroke: false }),
      line(d('M', -14, -40, 'L', 14, -40), 2.5, 0.4),
      shape(d('M', -8, -72, 'L', 8, -72, 'Q', 16, -64, 16, -52, 'L', 16, -4, 'Q', 16, 0, 12, 0, 'L', -12, 0, 'Q', -16, 0, -16, -4, 'L', -16, -52, 'Q', -16, -64, -8, -72, 'Z'), 'none'),
    ].join(''),
  /** Milk carton with cow spots (no writing). */
  'milk-carton': () =>
    [
      shape(d('M', -22, -78, 'L', 0, -96, 'L', 22, -78, 'Z'), '#4C9BE8'),
      rect(-6, -104, 12, 10, 2, '#4C9BE8', 2.5),
      rect(-22, -78, 44, 78, 4, WHITE),
      shape(d('M', -22, -60, 'Q', -10, -66, -6, -54, 'Q', -10, -44, -22, -46, 'Z'), '#231942', { stroke: false }),
      shape(d('M', 6, -40, 'Q', 16, -48, 22, -40, 'L', 22, -24, 'Q', 10, -20, 6, -30, 'Z'), '#231942', { stroke: false }),
      ellipse(-6, -18, 6, 4, '#231942', { stroke: false }),
      rect(-22, -78, 44, 78, 4, 'none'),
    ].join(''),
  mug: (o) =>
    [
      band([[22, -42], [38, -40], [40, -26], [36, -16], [22, -14]], 4, o.color ?? '#7FB3F5', true, 3),
      rect(-24, -54, 48, 54, 8, o.color ?? '#7FB3F5'),
      shape(star5(-6, -30, 9, 4), YELLOW, { sw: 2 }),
      shape(star5(10, -14, 5, 2.2), YELLOW, { sw: 1.8 }),
      shape(star5(12, -42, 5, 2.2), YELLOW, { sw: 1.8 }),
    ].join(''),
  'apple-bite': () =>
    [
      shape(d('M', 0, -30, 'Q', 2, -40, 6, -44), 'none', { sw: 3.5 }),
      shape(d('M', 3, -38, 'Q', 14, -46, 20, -38, 'Q', 12, -32, 3, -38, 'Z'), LEAF, { sw: 3 }),
      shape(d('M', 0, -30, 'Q', -10, -38, -18, -30, 'Q', -27, -20, -20, -7, 'Q', -12, 4, 0, -2, 'Q', 12, 4, 20, -7, 'Q', 22, -11, 21, -14, 'Q', 13, -14, 13, -21, 'Q', 13, -28, 20, -29, 'Q', 10, -38, 0, -30, 'Z'), RED),
      shape(d('M', 21, -14, 'Q', 13, -14, 13, -21, 'Q', 13, -28, 20, -29), '#FFF3D6', { sw: 2.5 }),
    ].join(''),
  wok: () =>
    [
      band([[44, -22], [86, -34]], 5, '#3B3363', true, 3),
      shape(d('M', -50, -26, 'L', 50, -26, 'Q', 44, 0, 0, 0, 'Q', -44, 0, -50, -26, 'Z'), '#5C5470'),
      line(d('M', -54, -26, 'L', 54, -26), 4),
    ].join(''),
  'fried-egg': () =>
    [
      shape(d('M', -22, 0, 'Q', -26, -10, -14, -12, 'Q', -6, -20, 6, -14, 'Q', 22, -16, 22, -6, 'Q', 24, 2, 10, 0, 'Q', 0, 4, -10, 1, 'Q', -18, 4, -22, 0, 'Z'), WHITE, { sw: 2.5 }),
      circle(0, -7, 6.5, '#FFB703', { sw: 2.5 }),
    ].join(''),
  bread: () =>
    [
      rect(-70, -8, 140, 8, 3, WOOD_D, 2.5),
      shape(d('M', -56, -8, 'L', -56, -42, 'Q', -56, -60, -36, -60, 'L', 20, -60, 'Q', 40, -60, 40, -42, 'L', 40, -8, 'Z'), '#E0A458'),
      line(d('M', -36, -58, 'L', -40, -12, 'M', -16, -60, 'L', -20, -10, 'M', 4, -60, 'L', 0, -10, 'M', 24, -58, 'L', 20, -12), 2.5, 0.45),
      shape(d('M', 46, -8, 'L', 46, -44, 'Q', 46, -56, 56, -56, 'Q', 66, -56, 66, -44, 'L', 66, -8, 'Z'), '#FFE8B6', { sw: 3 }),
    ].join(''),
  'bread-slice': () => shape(d('M', -14, 0, 'L', -14, -26, 'Q', -20, -28, -20, -34, 'Q', -20, -42, -8, -42, 'L', 8, -42, 'Q', 20, -42, 20, -34, 'Q', 20, -28, 14, -26, 'L', 14, 0, 'Z'), '#FFE8B6', { sw: 3 }),
  /** Open bamboo steamer with buns, the lid leaning behind it. */
  steamer: () =>
    [
      shape(d('M', 6, -60, 'L', 74, -96, 'L', 82, -84, 'L', 20, -46, 'Z'), '#E8C07A'),
      line(d('M', 30, -68, 'L', 70, -90, 'M', 34, -62, 'L', 74, -84), 2.5, 0.4),
      ...[[-30, -40], [0, -42], [30, -40], [-15, -52], [15, -52]].map(([x, y]) => group('bun', PROPS.baozi({}), { transform: `translate(${x} ${y + 6}) scale(0.7)` })),
      rect(-58, -40, 116, 40, 10, '#E8C07A'),
      line(d('M', -56, -26, 'L', 56, -26, 'M', -56, -12, 'L', 56, -12), 2.5, 0.4),
    ].join(''),
  'rolling-pin': () => [rect(-40, -12, 80, 12, 6, '#E2C29E', 3), rect(-56, -9, 16, 6, 3, WOOD_D, 2.5), rect(40, -9, 16, 6, 3, WOOD_D, 2.5)].join(''),
  'tea-leaves': () =>
    [[-12, 0, -30], [6, 0, 20], [0, -2, 70]].map(([x, y, r]) => el('g', { transform: `translate(${x} ${y}) rotate(${r})` }, shape(d('M', 0, 0, 'Q', -7, -9, 0, -18, 'Q', 7, -9, 0, 0, 'Z'), '#5FA34A', { sw: 2.5 }))).join(''),
  /** Small tea cup (no handle) with green tea. */
  'tea-cup': () =>
    [
      shape(d('M', -16, -24, 'L', 16, -24, 'Q', 14, 0, 0, 0, 'Q', -14, 0, -16, -24, 'Z'), '#F8F1E4'),
      ellipse(0, -24, 16, 4, '#B5C96A', { sw: 2.5 }),
    ].join(''),
  /** Clay (yixing-style) teapot. */
  'clay-teapot': () =>
    [
      band([[22, -20], [40, -28], [48, -40]], 4, '#A0522D'),
      shape(d('M', -28, -30, 'Q', -46, -30, -42, -14, 'Q', -38, -6, -26, -10), 'none', { sw: 5 }),
      shape(d('M', -30, -6, 'Q', -34, -36, 0, -38, 'Q', 34, -36, 30, -6, 'Q', 28, 0, 0, 0, 'Q', -28, 0, -30, -6, 'Z'), '#A0522D'),
      ellipse(0, -38, 18, 4, '#8B4513', { sw: 3 }),
      circle(0, -44, 4.5, '#8B4513', { sw: 3 }),
    ].join(''),
  'bitter-melon': () =>
    [
      shape(d('M', -36, -10, 'Q', -30, -26, 0, -26, 'Q', 30, -26, 38, -12, 'Q', 30, 0, 0, 0, 'Q', -30, 0, -36, -10, 'Z'), '#7BBF5A'),
      ...[[-22, -14], [-10, -18], [2, -14], [14, -18], [24, -12], [-14, -8], [8, -7]].map(([x, y]) => circle(x, y, 2.6, '#5A9E3C', { sw: 1.8 })),
      shape(d('M', 38, -12, 'L', 46, -16), 'none', { sw: 3.5 }),
    ].join(''),
  'lunch-box': () =>
    [
      shape(d('M', -40, -40, 'L', 40, -40, 'L', 46, -64, 'L', -34, -64, 'Z'), '#74C0FC', { sw: 3 }),
      rect(-44, -40, 88, 40, 8, '#4C9BE8'),
      shape(d('M', -40, -38, 'Q', -20, -50, 0, -38, 'Z'), WHITE, { sw: 2.5 }),
      circle(14, -42, 7, '#40A24E', { sw: 2.5 }),
      ellipse(30, -40, 8, 5, '#E8590C', { sw: 2.5 }),
    ].join(''),
  // ---------- time, days, calendars (tahap 3, u10–u11) ----------
  /**
   * Analogue clock showing value "HHMM" (12-hour face, digits 12/3/6/9). The hands sit in groups
   * whose origin is the clock centre (classes hand-h / hand-m). variant tokens: 'alarm' (bells +
   * feet), 'm5' / 'm10' (yellow wedge: the last 5 / 10 minutes, minute hand sweeps on click),
   * 'hour' (the minute hand goes once round, the hour hand moves one hour).
   */
  clock: (o) => {
    const v = (o.value ?? '0300').padStart(4, '0')
    const hh = Number(v.slice(0, 2)) % 12
    const mm = Number(v.slice(2))
    const opts = (o.variant ?? '').split(' ')
    const alarm = opts.includes('alarm')
    const cy = alarm ? -62 : -54
    const R = 44
    const out: string[] = []
    if (alarm) {
      out.push(circle(-32, cy - 42, 13, o.color ?? '#E5484D'), circle(32, cy - 42, 13, o.color ?? '#E5484D'))
      out.push(shape(d('M', -30, -8, 'L', -38, 0, 'M', 30, -8, 'L', 38, 0), 'none', { sw: 5 }))
    }
    if (opts.includes('hour')) {
      const r = R + 18
      const a0 = (-80 * Math.PI) / 180
      const a1 = (250 * Math.PI) / 180
      const p = (a: number, rr = r) => [Math.cos(a) * rr, cy + Math.sin(a) * rr] as const
      const [x0, y0] = p(a0)
      const [x1, y1] = p(a1)
      out.push(el('path', { class: 'ring', d: d('M', x0, y0, 'A', r, r, 0, 1, 1, x1, y1), fill: 'none', 'stroke-width': 4.5 }))
      out.push(shape(d('M', x0 - 4, y0 - 12, 'L', x0 + 14, y0, 'L', x0 - 4, y0 + 12, 'Z'), YELLOW, { sw: 3 }))
    }
    out.push(circle(0, cy, R + 8, o.color ?? '#4C9BE8'), circle(0, cy, R, WHITE, { sw: 3 }))
    const sector = (from: number, to: number, r: number, fill: string, cls: string) => {
      const a = (m: number) => ((m / 60) * 360 - 90) * (Math.PI / 180)
      const large = to - from > 30 ? 1 : 0
      return el('path', { class: cls, d: d('M', 0, cy, 'L', Math.cos(a(from)) * r, cy + Math.sin(a(from)) * r, 'A', r, r, 0, large, 1, Math.cos(a(to)) * r, cy + Math.sin(a(to)) * r, 'Z'), fill, stroke: 'none', opacity: 0.85 })
    }
    for (const t of opts) {
      const m = /^m(\d+)$/.exec(t)
      if (m) out.push(sector(mm - Number(m[1]), mm, R - 2, YELLOW, 'wedge'))
    }
    if (opts.includes('hour')) out.push(sector((hh - 1) * 5, hh * 5, R - 16, '#FFC9A8', 'wedge'))
    const ticks: string[] = []
    for (let i = 0; i < 60; i++) {
      if (i % 15 === 0) continue
      const a = ((i / 60) * 360 - 90) * (Math.PI / 180)
      const r1 = i % 5 === 0 ? R - 9 : R - 5
      ticks.push(`M${num(Math.cos(a) * r1)} ${num(cy + Math.sin(a) * r1)}L${num(Math.cos(a) * (R - 2))} ${num(cy + Math.sin(a) * (R - 2))}`)
    }
    out.push(el('path', { d: ticks.join(''), fill: 'none', 'stroke-width': 2 }))
    out.push(digits(0, cy - R + 20, '12', 15), digits(R - 12, cy + 5, '3', 15), digits(0, cy + R - 7, '6', 15), digits(-R + 12, cy + 5, '9', 15))
    const sweep = opts.find((t) => /^m\d+$/.test(t))
    const ha = (hh + mm / 60) * 30
    const ma = mm * 6
    const hand = (cls: string, ang: number, len: number, w: number, fill: string) =>
      el('g', { transform: `translate(0 ${cy})` }, el('g', { class: cls }, el('g', { transform: `rotate(${num(ang)})` }, shape(limb({ x: 0, y: 8 }, { x: 0, y: (8 - len) / 2 }, { x: 0, y: -len }, w), fill, { sw: 2.5 }))))
    out.push(hand(`hand-h${opts.includes('hour') ? ' sweep-h1' : ''}`, ha, 24, 4.2, '#231942'))
    out.push(hand(`hand-m${sweep ? ` sweep-${sweep}` : opts.includes('hour') ? ' sweep-m60' : ''}`, ma, 37, 2.4, '#E5484D'))
    out.push(circle(0, cy, 4.5, YELLOW, { sw: 2.5 }))
    return out.join('')
  },
  /** A small sky window: where the sun (or the moon) is at hour `value` (0–23). */
  'day-dial': (o) => {
    const h = Number(o.value ?? 12)
    const night = h >= 19 || h < 5
    const out: string[] = [rect(-70, -86, 140, 86, 12, night ? '#3B3363' : '#BFE6FA'), flat(-68, -16, 136, 14, night ? '#2E7D4F' : '#8CC97E')]
    out.push(el('path', { d: d('M', -52, -16, 'A', 52, 56, 0, 0, 1, 52, -16), fill: 'none', 'stroke-width': 2.5, 'stroke-dasharray': '5 6', opacity: night ? 0 : 0.45 }))
    if (night) {
      out.push(shape(d('M', 10, -70, 'A', 20, 20, 0, 1, 0, 30, -38, 'A', 15, 15, 0, 1, 1, 10, -70, 'Z'), '#FFE8A3', { sw: 2.5 }))
      for (const [x, y] of [[-46, -66], [-24, -50], [-50, -36], [48, -66]]) out.push(shape(star5(x, y, 6, 2.6), '#FFE8A3', { sw: 1.5 }))
    } else {
      const t = Math.max(0, Math.min(1, (h - 6) / 12))
      const a = Math.PI * (1 - t)
      const sx = Math.cos(a) * 52
      const sy = -16 - Math.sin(a) * 56
      const rays: string[] = []
      for (let i = 0; i < 8; i++) {
        const b = (i * Math.PI) / 4
        rays.push(`M${num(sx + Math.cos(b) * 17)} ${num(sy + Math.sin(b) * 17)}L${num(sx + Math.cos(b) * 23)} ${num(sy + Math.sin(b) * 23)}`)
      }
      out.push(el('path', { d: rays.join(''), fill: 'none', 'stroke-width': 3 }), circle(sx, sy, 13, h < 8 || h > 16 ? '#FFA94D' : YELLOW, { sw: 3 }))
    }
    out.push(rect(-70, -86, 140, 86, 12, 'none'))
    return out.join('')
  },
  /** Three day pages (yesterday, today, tomorrow); today is yellow. variant 'tomorrow' / 'yesterday': that page is green, with an arrow from today. */
  days3: (o) => {
    const today = Number(o.value ?? 24)
    const target = o.variant === 'tomorrow' ? 1 : o.variant === 'yesterday' ? -1 : 0
    const out: string[] = []
    for (const k of [-1, 0, 1]) {
      const x = k * 78
      const fill = k === 0 ? '#FFE066' : k === target ? '#B2F2BB' : WHITE
      if (k === 0) out.push(flat(x - 38, -96, 76, 96, YELLOW, 12, 0.6))
      out.push(rect(x - 32, -90, 64, 84, 8, fill, k === 0 || k === target ? 4.5 : 3.5))
      out.push(el('path', { d: d('M', x - 32, -72, 'L', x - 32, -82, 'Q', x - 32, -90, x - 24, -90, 'L', x + 24, -90, 'Q', x + 32, -90, x + 32, -82, 'L', x + 32, -72, 'Z'), fill: '#E5484D', 'stroke-width': 3 }))
      out.push(digits(x, -24, String(today + k), 34))
    }
    return out.join('')
  },
  /** One day box of a week strip; variant 'school' (school bag) or 'play' (ball, weekend). */
  'day-box': (o) => {
    const play = o.variant === 'play'
    return [
      rect(-20, -54, 40, 54, 7, play ? '#FFE3E3' : WHITE),
      el('path', { d: 'M-20 -40L-20 -47Q-20 -54 -13 -54L13 -54Q20 -54 20 -47L20 -40Z', fill: play ? '#E5484D' : '#4C9BE8', 'stroke-width': 3 }),
      play
        ? [circle(0, -20, 11, '#FF922B', { sw: 2.5 }), line(d('M', -11, -20, 'L', 11, -20, 'M', 0, -31, 'Q', -6, -20, 0, -9), 2, 0.6)].join('')
        : [rect(-11, -32, 22, 24, 5, '#7950F2', 2.5), shape(d('M', -6, -32, 'Q', 0, -40, 6, -32), 'none', { sw: 2.5 }), rect(-11, -26, 22, 7, 3, '#9775FA', 2)].join(''),
    ].join('')
  },
  /** A week strip of 7 boxes; variant 'sunday': the last one glows with a sun. */
  week: (o) => {
    const out: string[] = []
    for (let i = 0; i < 7; i++) {
      const x = -138 + i * 46
      const last = i === 6
      const hl = last && o.variant === 'sunday'
      if (hl) out.push(flat(x - 26, -64, 52, 68, YELLOW, 12, 0.7))
      out.push(rect(x - 20, -54, 40, 54, 7, hl ? '#FFE066' : i >= 5 ? '#FFE3E3' : WHITE, hl ? 4.5 : 3))
      out.push(el('path', { d: `M${x - 20} -40L${x - 20} -47Q${x - 20} -54 ${x - 13} -54L${x + 13} -54Q${x + 20} -54 ${x + 20} -47L${x + 20} -40Z`, fill: i >= 5 ? '#E5484D' : '#4C9BE8', 'stroke-width': 3 }))
      if (hl) out.push(circle(x, -20, 9, '#FF922B', { sw: 2.5 }))
    }
    return out.join('')
  },
  /** A year calendar: the year in digits on top, twelve little month grids. variant 'hl' (glowing) / 'dim'. */
  'year-cal': (o) => {
    const out: string[] = []
    if (o.variant === 'hl') out.push(flat(-68, -158, 136, 162, YELLOW, 16, 0.75))
    out.push(rect(-60, -150, 120, 150, 10, WHITE))
    out.push(el('path', { d: 'M-60 -116L-60 -140Q-60 -150 -50 -150L50 -150Q60 -150 60 -140L60 -116Z', fill: o.color ?? '#E5484D', 'stroke-width': 3.5 }))
    out.push(digits(0, -124, o.value ?? '2026', 26, WHITE))
    const cells: string[] = []
    for (let i = 0; i < 12; i++) {
      const x = -48 + (i % 3) * 34
      const y = -108 + Math.floor(i / 3) * 26
      cells.push(`M${x} ${y}h28v20h-28Z`)
    }
    out.push(el('path', { d: cells.join(''), fill: '#F1EEF6', 'stroke-width': 2 }))
    const dots: string[] = []
    for (let i = 0; i < 12; i++) {
      const x = -48 + (i % 3) * 34
      const y = -108 + Math.floor(i / 3) * 26
      dots.push(`M${x + 6} ${y + 7}h18M${x + 6} ${y + 13}h18`)
    }
    out.push(el('path', { d: dots.join(''), fill: 'none', 'stroke-width': 3, 'stroke-dasharray': '0 6', opacity: 0.5 }))
    const g = out.join('')
    return o.variant === 'dim' ? el('g', { opacity: 0.6 }, g) : g
  },
  /** Crescent moon. */
  moon: (o) => shape(d('M', -4, -60, 'A', 30, 30, 0, 1, 0, 26, -10, 'A', 24, 24, 0, 1, 1, -4, -60, 'Z'), o.color ?? '#FFE8A3'),
  /** Picture of the sun as the old character drew it: a round sun with a dot in the middle. */
  'sun-dot': () => {
    const rays: string[] = []
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6
      rays.push(`M${num(Math.cos(a) * 50)} ${num(-64 + Math.sin(a) * 50)}L${num(Math.cos(a) * 62)} ${num(-64 + Math.sin(a) * 62)}`)
    }
    return [el('path', { d: rays.join(''), fill: 'none', 'stroke-width': 5 }), circle(0, -64, 42, YELLOW, { sw: 5 }), circle(0, -64, 8, '#231942', { stroke: false })].join('')
  },
  /** Picture of the moon as the old character drew it: a crescent with a stroke inside. */
  'moon-old': () =>
    [
      shape(d('M', 20, -122, 'A', 58, 58, 0, 0, 0, 20, -6, 'A', 90, 90, 0, 0, 1, 20, -122, 'Z'), '#FFE066', { sw: 5 }),
      shape(d('M', -30, -66, 'L', -8, -62), 'none', { sw: 6 }),
    ].join(''),
  /** The same tree in a season: variant spring / summer / autumn / winter. */
  'season-tree': (o) => {
    const v = o.variant ?? 'summer'
    const crown = v === 'spring' ? '#FFD6E7' : v === 'autumn' ? '#FFA94D' : v === 'winter' ? '#F8F9FA' : '#69B85E'
    const out = [rect(-7, -60, 14, 60, 4, '#8A5A3B'), circle(0, -88, 34, crown)]
    if (v === 'spring') for (const [x, y] of [[-14, -98], [10, -106], [16, -82], [-8, -76], [0, -92], [-20, -84]]) out.push(circle(x, y, 4, '#F06595', { sw: 1.8 }))
    if (v === 'summer') out.push(line(d('M', -16, -96, 'Q', -8, -104, 0, -98, 'M', 6, -78, 'Q', 14, -86, 20, -80), 2.5, 0.4))
    if (v === 'autumn') for (const [x, y] of [[-30, -30], [26, -18], [36, -44]]) out.push(shape(d('M', x, y, 'Q', x - 6, y - 6, x, y - 12, 'Q', x + 6, y - 6, x, y, 'Z'), '#E8590C', { sw: 2 }))
    if (v === 'winter') {
      out.push(line(d('M', 0, -64, 'L', -14, -92, 'M', 0, -70, 'L', 16, -96, 'M', -6, -82, 'L', -20, -80), 3, 0.35))
      for (const [x, y] of [[-40, -120], [36, -126], [44, -60], [-46, -50]]) out.push(circle(x, y, 3.5, WHITE, { sw: 2 }))
    }
    return out.join('')
  },
  /** Dashed arc across the sky (the sun's path). */
  'sky-arc': () => el('path', { d: 'M-180 0A180 150 0 0 1 180 0', fill: 'none', 'stroke-width': 3, 'stroke-dasharray': '8 9', opacity: 0.45 }),
  /** Kite on a string; origin = the end of the string (the hand). */
  kite: () =>
    [
      line(d('M', 0, 0, 'Q', 40, -30, 86, -128), 2.5, 0.7),
      el('path', { d: d('M', 86, -128, 'Q', 74, -100, 92, -84, 'Q', 104, -70, 92, -56), fill: 'none', 'stroke-width': 3 }),
      shape(d('M', 86, -186, 'L', 116, -156, 'L', 86, -128, 'L', 56, -156, 'Z'), '#E5484D'),
      shape(d('M', 86, -186, 'L', 116, -156, 'L', 86, -156, 'Z'), YELLOW, { sw: 3 }),
      shape(d('M', 86, -128, 'L', 56, -156, 'L', 86, -156, 'Z'), YELLOW, { sw: 3 }),
    ].join(''),
  hourglass: () =>
    [
      rect(-24, -78, 48, 8, 3, WOOD, 3),
      rect(-24, -8, 48, 8, 3, WOOD, 3),
      shape(d('M', -16, -70, 'L', 16, -70, 'Q', 16, -50, 3, -39, 'Q', 16, -28, 16, -8, 'L', -16, -8, 'Q', -16, -28, -3, -39, 'Q', -16, -50, -16, -70, 'Z'), '#E7F5FF'),
      shape(d('M', -8, -52, 'L', 8, -52, 'L', 1, -42, 'L', -1, -42, 'Z'), '#F4C06A', { stroke: false }),
      shape(d('M', -14, -10, 'Q', 0, -26, 14, -10, 'Z'), '#F4C06A', { sw: 2 }),
    ].join(''),
  // ---------- places & directions (tahap 3, u12) ----------
  /** Bus stop: pole and a round sign with a bus drawn on it (no writing). */
  'bus-stop': () =>
    [
      rect(-4, -170, 8, 170, 3, '#868E96', 3),
      circle(0, -186, 26, '#4C9BE8'),
      rect(-15, -198, 30, 20, 4, WHITE, 2.5),
      line(d('M', -15, -190, 'L', 15, -190), 2, 0.6),
      circle(-8, -176, 3.5, '#231942', { stroke: false }),
      circle(8, -176, 3.5, '#231942', { stroke: false }),
    ].join(''),
  /** Cardboard box; variant 'back' (open box, inside wall) / 'front' (front wall and flaps) / default closed. */
  box: (o) => {
    const v = o.variant ?? 'closed'
    if (v === 'back')
      return [
        shape(d('M', -56, -76, 'L', -40, -96, 'L', 40, -96, 'L', 56, -76, 'Z'), '#B07A45'),
        shape(d('M', -40, -96, 'L', -50, -124, 'L', 30, -124, 'L', 40, -96, 'Z'), '#D9A066', { sw: 3 }),
      ].join('')
    const front = [
      rect(-56, -76, 112, 76, 4, '#D9A066'),
      rect(-14, -76, 28, 18, 0, '#E9C9A0', 2.5),
    ]
    if (v === 'front')
      return [
        ...front,
        shape(d('M', -56, -76, 'L', -76, -60, 'L', -66, -50, 'L', -56, -60, 'Z'), '#E6B47A', { sw: 3 }),
        shape(d('M', 56, -76, 'L', 76, -60, 'L', 66, -50, 'L', 56, -60, 'Z'), '#E6B47A', { sw: 3 }),
      ].join('')
    return [shape(d('M', -56, -76, 'L', -40, -96, 'L', 72, -96, 'L', 56, -76, 'Z'), '#E6B47A'), shape(d('M', 56, -76, 'L', 72, -96, 'L', 72, -20, 'L', 56, 0, 'Z'), '#B07A45'), ...front].join('')
  },
  /** House front with a see-through window (characters drawn before it show inside). variant 'inside': the room behind the window. */
  house: (o) => {
    if (o.variant === 'inside') return flat(-96, -124, 76, 64, '#F3D9B5')
    const wall = 'M-120 -150L120 -150L120 0L-120 0Z M-92 -120L-24 -120L-24 -64L-92 -64Z'
    return [
      el('path', { d: wall, fill: o.color ?? '#FFE8CC', 'fill-rule': 'evenodd' }),
      shape(d('M', -136, -146, 'L', 0, -216, 'L', 136, -146, 'Z'), '#D9480F'),
      rect(-98, -126, 80, 68, 6, 'none', 6),
      rect(28, -100, 56, 100, 6, '#8A5A3B'),
      circle(72, -50, 4, YELLOW, { sw: 2 }),
    ].join('')
  },
  /** School building with a flag (no writing). */
  school: () =>
    [
      rect(-2, -230, 5, 92, 2, '#868E96', 2.5),
      shape(d('M', 3, -228, 'L', 42, -220, 'L', 3, -206, 'Z'), '#E5484D', { sw: 2.5 }),
      rect(-110, -140, 220, 140, 6, '#F8E3C4'),
      rect(-118, -150, 236, 14, 4, '#C2410C', 3),
      ...[-84, -48, 28, 64].flatMap((x) => [rect(x, -120, 24, 24, 3, '#CFE8F7', 2.5), rect(x, -76, 24, 24, 3, '#CFE8F7', 2.5)]),
      rect(-18, -60, 36, 60, 4, '#8A5A3B', 3),
      rect(-22, -118, 44, 34, 6, '#FFD43B', 3),
    ].join(''),
  /** Arched arrow pointing to the right (flip for left), e.g. from today to tomorrow. */
  'arc-arrow': (o) => {
    const pts: [number, number][] = []
    for (let i = 0; i <= 8; i++) {
      const a = Math.PI * (1 - (i / 8) * 0.82)
      pts.push([Math.cos(a) * 60, -Math.sin(a) * 40])
    }
    const [ex, ey] = pts[pts.length - 1]
    return [band(pts, 5, o.color ?? YELLOW, true, 3), shape(d('M', ex - 14, ey - 8, 'L', ex + 16, ey + 2, 'L', ex - 2, ey + 22, 'Z'), o.color ?? YELLOW, { sw: 3 })].join('')
  },
  /** U-turn arrow: goes right, turns, comes back left. */
  'u-turn': (o) =>
    [
      band([[-80, -20], [40, -20], [72, -40], [72, -60], [40, -80], [-30, -80]], 6, o.color ?? YELLOW, true, 3),
      shape(d('M', -26, -98, 'L', -58, -80, 'L', -26, -62, 'Z'), o.color ?? YELLOW, { sw: 3 }),
    ].join(''),
  bench: () =>
    [
      rect(-50, -48, 100, 12, 4, WOOD),
      rect(-54, -30, 108, 10, 4, WOOD),
      rect(-44, -20, 8, 20, 2, '#5C5470', 2.5),
      rect(36, -20, 8, 20, 2, '#5C5470', 2.5),
    ].join(''),
}

export const PROP_IDS = Object.keys(PROPS)

export function drawProp(id: string, o: PropOpts): string {
  const f = PROPS[id]
  if (!f) throw new Error(`unknown prop ${id}`)
  return f(o)
}
