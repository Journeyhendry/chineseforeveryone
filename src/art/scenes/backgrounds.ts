// Calm backgrounds drawn inside a box (full scene or one comic panel): pale wall/sky, floor or
// ground, and at most one or two quiet details. Nothing here competes with the characters.
import { circle, d, el, line, shape } from '../characters/svg.ts'

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

const rect = (x: number, y: number, w: number, h: number, fill: string, extra: Record<string, string | number> = {}) =>
  el('rect', { x, y, width: w, height: h, fill, stroke: 'none', ...extra })

/** y of the floor edge (where wall meets floor) in a box. */
export const horizon = (b: Box) => b.y + b.h * 0.7

function windowAt(x: number, y: number, w: number, h: number, sky = '#D7EEFB'): string {
  return [
    el('rect', { x, y, width: w, height: h, rx: 6, fill: sky, 'stroke-width': 3 }),
    line(d('M', x + w / 2, y, 'L', x + w / 2, y + h, 'M', x, y + h / 2, 'L', x + w, y + h / 2), 3),
  ].join('')
}

function floorBand(b: Box, color: string, lineOp = 0.18): string {
  const hy = horizon(b)
  return rect(b.x, hy, b.w, b.y + b.h - hy, color) + line(d('M', b.x, hy, 'L', b.x + b.w, hy), 3, lineOp)
}

function buildings(b: Box, color: string): string {
  const hy = horizon(b)
  const out: string[] = []
  const widths = [54, 40, 62, 46, 58, 44, 50]
  let x = b.x - 6
  let i = 0
  while (x < b.x + b.w) {
    const w = widths[i % widths.length]
    const h = 50 + ((i * 37) % 60)
    const right = Math.min(x + w, b.x + b.w)
    if (right - x > 8) out.push(rect(Math.max(x, b.x), hy - h, right - Math.max(x, b.x), h, color))
    x += w + 6
    i++
  }
  return out.join('')
}

export const BACKGROUNDS: Record<string, (b: Box) => string> = {
  plain: (b) => rect(b.x, b.y, b.w, b.h, '#FFF3DA') + floorBand(b, '#F6E2BE'),
  'plain-mint': (b) => rect(b.x, b.y, b.w, b.h, '#E3F4E6') + floorBand(b, '#CDE9D2'),
  'plain-sky': (b) => rect(b.x, b.y, b.w, b.h, '#E1F1FB') + floorBand(b, '#CBE4F3'),
  'plain-lilac': (b) => rect(b.x, b.y, b.w, b.h, '#EFE9FB') + floorBand(b, '#DDD3F3'),
  'plain-peach': (b) => rect(b.x, b.y, b.w, b.h, '#FFE9DC') + floorBand(b, '#F9D4BE'),
  home: (b) =>
    [
      rect(b.x, b.y, b.w, b.h, '#FCEBD0'),
      floorBand(b, '#E8C9A0', 0.25),
      line(d('M', b.x, horizon(b) - 10, 'L', b.x + b.w, horizon(b) - 10), 3, 0.15),
      windowAt(b.x + b.w - 104, b.y + 34, 76, 70),
    ].join(''),
  'home-left': (b) =>
    [rect(b.x, b.y, b.w, b.h, '#FCEBD0'), floorBand(b, '#E8C9A0', 0.25), line(d('M', b.x, horizon(b) - 10, 'L', b.x + b.w, horizon(b) - 10), 3, 0.15), windowAt(b.x + 28, b.y + 34, 76, 70)].join(''),
  room: (b) => [rect(b.x, b.y, b.w, b.h, '#FCEBD0'), floorBand(b, '#E8C9A0', 0.25), line(d('M', b.x, horizon(b) - 10, 'L', b.x + b.w, horizon(b) - 10), 3, 0.15)].join(''),
  kitchen: (b) => {
    const hy = horizon(b)
    const tiles: string[] = []
    for (let x = b.x + 20; x < b.x + b.w; x += 40) tiles.push(`M${x} ${b.y + 40}L${x} ${hy - 4}`)
    for (let y = b.y + 40; y < hy; y += 40) tiles.push(`M${b.x} ${y}L${b.x + b.w} ${y}`)
    return [rect(b.x, b.y, b.w, b.h, '#E9F4F1'), el('path', { d: tiles.join(''), fill: 'none', 'stroke-width': 2, opacity: 0.1 }), floorBand(b, '#D9CBB4', 0.25)].join('')
  },
  park: (b) => {
    const hy = horizon(b)
    return [
      rect(b.x, b.y, b.w, b.h, '#DDF0FA'),
      buildings(b, '#EEE6F4'),
      rect(b.x, hy, b.w, b.y + b.h - hy, '#BFE3A8'),
      line(d('M', b.x, hy, 'L', b.x + b.w, hy), 3, 0.2),
      shape(d('M', b.x + 30, b.y + 52, 'Q', b.x + 26, b.y + 38, b.x + 44, b.y + 38, 'Q', b.x + 52, b.y + 26, b.x + 68, b.y + 36, 'Q', b.x + 84, b.y + 34, b.x + 82, b.y + 52, 'Z'), '#FFFFFF', { stroke: false }),
    ].join('')
  },
  street: (b) => {
    const hy = horizon(b)
    return [
      rect(b.x, b.y, b.w, b.h, '#DDF0FA'),
      buildings(b, '#EDE3D6'),
      rect(b.x, hy, b.w, b.y + b.h - hy, '#E3DED6'),
      line(d('M', b.x, hy, 'L', b.x + b.w, hy), 3, 0.2),
    ].join('')
  },
  classroom: (b) => {
    const hy = horizon(b)
    return [rect(b.x, b.y, b.w, b.h, '#E8F3E5'), floorBand(b, '#D9C3A0', 0.25), line(d('M', b.x, hy - 10, 'L', b.x + b.w, hy - 10), 3, 0.15)].join('')
  },
  market: (b) => {
    const hy = horizon(b)
    return [rect(b.x, b.y, b.w, b.h, '#FFF1DC'), rect(b.x, hy, b.w, b.y + b.h - hy, '#E6D8C2'), line(d('M', b.x, hy, 'L', b.x + b.w, hy), 3, 0.2)].join('')
  },
  restaurant: (b) => {
    const hy = horizon(b)
    return [rect(b.x, b.y, b.w, b.h, '#FFF0DE'), rect(b.x, hy - 70, b.w, 60, '#F6DCC0'), line(d('M', b.x, hy - 70, 'L', b.x + b.w, hy - 70), 3, 0.2), floorBand(b, '#E2C7A4', 0.25)].join('')
  },
  metro: (b) => {
    const hy = horizon(b)
    return [rect(b.x, b.y, b.w, b.h, '#EEF1F6'), rect(b.x, b.y + 16, b.w, 10, '#9EC5F0'), floorBand(b, '#D8DCE4', 0.25), line(d('M', b.x, hy - 10, 'L', b.x + b.w, hy - 10), 3, 0.12)].join('')
  },
  airport: (b) => {
    const hy = horizon(b)
    return [
      rect(b.x, b.y, b.w, b.h, '#EEF1F6'),
      el('rect', { x: b.x + 16, y: b.y + 20, width: b.w - 32, height: hy - b.y - 40, rx: 8, fill: '#D7EEFB', 'stroke-width': 3 }),
      line(d('M', b.x + b.w / 3, b.y + 20, 'L', b.x + b.w / 3, hy - 20, 'M', b.x + (2 * b.w) / 3, b.y + 20, 'L', b.x + (2 * b.w) / 3, hy - 20), 3),
      floorBand(b, '#D8DCE4', 0.25),
    ].join('')
  },
  sky: (b) => rect(b.x, b.y, b.w, b.h, '#DDF0FA') + rect(b.x, horizon(b) + 20, b.w, b.y + b.h - horizon(b) - 20, '#BFE3A8'),
  night: (b) => rect(b.x, b.y, b.w, b.h, '#3B3363') + circle(b.x + b.w - 60, b.y + 60, 22, '#FFE8A3', { stroke: false }),
}

export const BACKGROUND_IDS = Object.keys(BACKGROUNDS)
