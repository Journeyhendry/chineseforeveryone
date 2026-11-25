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
}

export const PROP_IDS = Object.keys(PROPS)

export function drawProp(id: string, o: PropOpts): string {
  const f = PROPS[id]
  if (!f) throw new Error(`unknown prop ${id}`)
  return f(o)
}
