// Clothes per character, built from the shared body parts. Each outfit draws its own torso
// (with neck and collar in the right stacking order), legs + shoes, arm style and extras.
import {
  bareLegs, buttons, CX, legBottom, neck, pants, shoes, sideDepth, torso, armGeom,
  type ArmStyle, type ShoeStyle, type TorsoOpts,
} from './body.ts'
import { circle, d, group, line, shape, tube, type Pt } from './svg.ts'
import type { CharacterSpec, Rig, View } from './types.ts'

export interface Outfit {
  arms: Omit<ArmStyle, 'skin'>
  legs(view: View, b: Rig): string
  torso(view: View, b: Rig): string
  /** drawn before arms and body (backpack body, etc.) */
  behind?(view: View, b: Rig): string
  /** something held in one hand, drawn between the arm and the hand */
  item?: { side: 'left' | 'right'; draw(view: View, b: Rig, hand: Pt): string }
}

// ---------- helpers ----------

/** Half-width of the front torso at height y. */
function halfAt(b: Rig, y: number, o: TorsoOpts = {}): number {
  const sh = o.shoulderHalf ?? b.p.shoulderHalf
  const bottom = b.hemY + (o.extend ?? 0)
  const bh = o.bottomHalf ?? b.p.hemHalf + (o.extend ?? 0) * 0.12
  const t = (y - b.shoulderY) / (bottom - b.shoulderY)
  return sh + (bh - sh) * Math.max(0, Math.min(1, t))
}

/** Band across the torso between y1 and y2 (belts, ribbed hems, sashes). */
function band(view: View, b: Rig, y1: number, y2: number, fill: string, o: TorsoOpts = {}): string {
  if (view === 'side') {
    const dd = sideDepth(b)
    const fl = (y: number) => ((y - b.shoulderY) / (b.hemY + (o.extend ?? 0) - b.shoulderY)) * (2 + (o.extend ?? 0) * 0.1)
    return shape(d('M', CX - dd - fl(y1), y1, 'L', CX + dd + fl(y1), y1, 'L', CX + dd + fl(y2), y2, 'L', CX - dd - fl(y2), y2, 'Z'), fill)
  }
  const h1 = halfAt(b, y1, o)
  const h2 = halfAt(b, y2, o)
  return shape(d('M', CX - h1, y1, 'L', CX + h1, y1, 'L', CX + h2, y2, 'L', CX - h2, y2, 'Z'), fill)
}

function vNeck(b: Rig, fill: string, half: number, depth: number): string {
  const y = b.shoulderY
  return shape(d('M', CX - half, y, 'L', CX + half, y, 'L', CX, y + depth, 'Z'), fill)
}

function lapels(b: Rig, fill: string, half: number, depth: number): string {
  const y = b.shoulderY
  return [
    shape(d('M', CX - half - 2, y - 1, 'L', CX - half - 12, y + 22, 'L', CX - half - 1, y + 27, 'L', CX - 1, y + depth, 'Z'), fill),
    shape(d('M', CX + half + 2, y - 1, 'L', CX + half + 12, y + 22, 'L', CX + half + 1, y + 27, 'L', CX + 1, y + depth, 'Z'), fill),
  ].join('')
}

function shirtCollar(b: Rig, fill: string, spread = 1): string {
  const y = b.shoulderY
  return group('collar', [
    shape(d('M', CX - 13, y - 5, 'L', CX - 13 - 11 * spread, y + 14, 'L', CX - 1, y + 17, 'Z'), fill, { sw: 3.5 }),
    shape(d('M', CX + 13, y - 5, 'L', CX + 13 + 11 * spread, y + 14, 'L', CX + 1, y + 17, 'Z'), fill, { sw: 3.5 }),
  ])
}

function collarBack(b: Rig, fill: string): string {
  const y = b.shoulderY
  return shape(d('M', CX - 19, y - 3, 'Q', CX, y + 5, CX + 19, y - 3, 'L', CX + 21, y + 8, 'Q', CX, y + 16, CX - 21, y + 8, 'Z'), fill, { sw: 3.5 })
}

function collarSide(b: Rig, fill: string): string {
  const y = b.shoulderY
  return shape(d('M', CX - 16, y - 4, 'L', CX + 10, y - 1, 'L', CX + 16, y + 14, 'L', CX - 14, y + 8, 'Z'), fill, { sw: 3.5 })
}

function strap(p0: Pt, p1: Pt, p2: Pt, w: number, fill: string): string {
  return shape(tube(p0, p1, p2, w), fill, { sw: 3.5 })
}

function bow(x: number, y: number, s: number, fill: string): string {
  return group('bow', [
    shape(d('M', x - 2, y + 2, 'L', x - 9 * s, y + 24 * s, 'L', x - 1, y + 20 * s, 'Z'), fill, { sw: 3 }),
    shape(d('M', x + 2, y + 2, 'L', x + 9 * s, y + 24 * s, 'L', x + 1, y + 20 * s, 'Z'), fill, { sw: 3 }),
    shape(d('M', x, y, 'Q', x - 22 * s, y - 16 * s, x - 22 * s, y, 'Q', x - 22 * s, y + 14 * s, x, y, 'Z'), fill, { sw: 3 }),
    shape(d('M', x, y, 'Q', x + 22 * s, y - 16 * s, x + 22 * s, y, 'Q', x + 22 * s, y + 14 * s, x, y, 'Z'), fill, { sw: 3 }),
    circle(x, y, 5 * s, fill, { sw: 3 }),
  ])
}

const P = (x: number, y: number): Pt => ({ x, y })

function trousers(color: string, shoe: string, style: ShoeStyle, sole?: string) {
  return (view: View, b: Rig) => group('legs', [pants(view, b, color), shoes(view, b, shoe, style, sole)])
}

function skirtLegs(o: { skirt?: string; knee: number; legs: string; sock?: string; shoe: string; style: ShoeStyle; skirtFlare?: number }) {
  return (view: View, b: Rig) => {
    const knee = b.hipY + (legBottom(b) - b.hipY) * o.knee
    const parts = [bareLegs(view, b, o.legs === 'skin' ? b.skin : o.legs, b.hemY - 10, o.sock), shoes(view, b, o.shoe, o.style)]
    if (o.skirt) {
      const fl = o.skirtFlare ?? 8
      if (view === 'side') {
        const dd = sideDepth(b)
        parts.push(shape(d('M', CX - dd - 2, b.hemY - 8, 'L', CX + dd + 2, b.hemY - 8, 'L', CX + dd + fl, knee, 'Q', CX, knee + 4, CX - dd - fl, knee, 'Z'), o.skirt))
      } else {
        const h = b.p.hemHalf
        parts.push(shape(d('M', CX - h + 1, b.hemY - 8, 'L', CX + h - 1, b.hemY - 8, 'L', CX + h + fl, knee, 'Q', CX, knee + 5, CX - h - fl, knee, 'Z'), o.skirt))
      }
    }
    return group('legs', parts)
  }
}

// ---------- outfits ----------

const OUTFITS: Record<string, Outfit> = {
  mama: {
    arms: { sleeve: '#D9534F', sleeveFrac: 1 },
    legs: trousers('#3D4B80', '#8A5A3B', 'shoe'),
    torso(view, b) {
      const y = b.shoulderY
      const top = '#D9534F'
      const apron = '#FFF4E0'
      if (view === 'side') {
        const dd = sideDepth(b)
        return [
          torso(view, b, top),
          line(d('M', CX - dd, y + 68, 'L', CX + dd, y + 68), 3.5),
          bow(CX - dd - 4, y + 68, 0.7, apron),
          shape(d('M', CX + dd - 8, y + 30, 'L', CX + dd + 3, y + 30, 'L', CX + dd + 9, b.hemY + 12, 'L', CX + dd - 4, b.hemY + 12, 'Z'), apron),
          line(d('M', CX + dd - 4, y + 31, 'L', CX - 4, y + 3), 4),
          neck(view, b, b.skinShade),
        ].join('')
      }
      if (view === 'back') {
        return [torso(view, b, top), line(d('M', CX - b.p.shoulderHalf - 1, y + 68, 'L', CX + b.p.shoulderHalf + 1, y + 68), 3.5), bow(CX, y + 68, 1, apron), neck(view, b, b.skinShade)].join('')
      }
      return [
        torso(view, b, top),
        shape(d('M', CX - 30, y + 30, 'L', CX + 30, y + 30, 'L', CX + 40, b.hemY + 12, 'L', CX - 40, b.hemY + 12, 'Z'), apron, { cls: 'apron' }),
        line(d('M', CX - 30, y + 30, 'L', CX - 14, y + 4, 'M', CX + 30, y + 30, 'L', CX + 14, y + 4), 4),
        shape(d('M', CX - 20, y + 76, 'L', CX + 20, y + 76, 'L', CX + 18, y + 106, 'L', CX - 18, y + 106, 'Z'), '#FFD9A8', { sw: 3.5 }),
        line(d('M', CX, y + 76, 'L', CX, y + 106), 3),
        neck(view, b, b.skinShade),
      ].join('')
    },
  },

  yeye: {
    arms: { sleeve: '#3E7C74', sleeveFrac: 1, band: [0.86, 1, '#F5E6C8'] },
    legs: trousers('#4A4458', '#2E2838', 'cloth', '#FFFFFF'),
    torso(view, b) {
      const y = b.shoulderY
      const c = '#3E7C74'
      const knot = (x: number, yy: number) => line(d('M', x - 9, yy, 'L', x + 9, yy), 3.5) + circle(x, yy, 3.5, '#F5E6C8', { sw: 2.5 })
      if (view === 'side') {
        const dd = sideDepth(b)
        return [torso(view, b, c), neck(view, b, b.skinShade), shape(d('M', CX - 13, y - 6, 'L', CX + 13, y - 3, 'L', CX + 14, y + 8, 'L', CX - 13, y + 6, 'Z'), c, { sw: 3.5 }),
          ...[30, 54, 78, 102].map((o) => circle(CX + dd - 5, y + o, 3.5, '#F5E6C8', { sw: 2.5 }))].join('')
      }
      if (view === 'back') {
        return [torso(view, b, c), neck(view, b, b.skinShade), shape(d('M', CX - 17, y - 4, 'Q', CX, y + 2, CX + 17, y - 4, 'L', CX + 17, y + 7, 'Q', CX, y + 13, CX - 17, y + 7, 'Z'), c, { sw: 3.5 }), line(d('M', CX, y + 14, 'L', CX, b.hemY), 3, 0.35)].join('')
      }
      return [
        torso(view, b, c), neck(view, b, b.skinShade),
        shape(d('M', CX - 17, y - 6, 'Q', CX, y + 4, CX + 17, y - 6, 'L', CX + 17, y + 6, 'Q', CX, y + 14, CX - 17, y + 6, 'Z'), c, { sw: 3.5 }),
        line(d('M', CX, y + 11, 'L', CX, b.hemY), 3.5),
        ...[30, 54, 78, 102].map((o) => knot(CX, y + o)),
        shape(d('M', CX - 38, y + 80, 'L', CX - 16, y + 80), 'none', { sw: 3 }),
        shape(d('M', CX + 16, y + 80, 'L', CX + 38, y + 80), 'none', { sw: 3 }),
      ].join('')
    },
  },

  nainai: {
    arms: { sleeve: '#9A5B8F', sleeveFrac: 1, band: [0.86, 1, '#86497B'] },
    legs: trousers('#6B5E7A', '#5A3B2E', 'flat'),
    torso(view, b) {
      const y = b.shoulderY
      const c = '#9A5B8F'
      const hemBand = band(view, b, b.hemY - 12, b.hemY, '#86497B')
      if (view === 'side') {
        const dd = sideDepth(b)
        return [torso(view, b, c), hemBand, neck(view, b, b.skinShade), shape(d('M', CX + 4, y + 2, 'L', CX + dd - 6, y + 5, 'L', CX + dd - 5, y + 28, 'Z'), '#FFF4E0', { sw: 3.5 }),
          ...[46, 70, 94].map((o) => circle(CX + dd - 5, y + o, 3.5, '#F5E6C8', { sw: 2.5 }))].join('')
      }
      if (view === 'back') return [torso(view, b, c), hemBand, neck(view, b, b.skinShade)].join('')
      return [
        torso(view, b, c), hemBand,
        vNeck(b, '#FFF4E0', 20, 46),
        neck(view, b, b.skinShade),
        shape(d('M', CX - 13, y - 4, 'Q', CX - 22, y + 2, CX - 18, y + 12, 'Q', CX - 8, y + 12, CX, y + 8, 'Z'), '#FFFFFF', { sw: 3 }),
        shape(d('M', CX + 13, y - 4, 'Q', CX + 22, y + 2, CX + 18, y + 12, 'Q', CX + 8, y + 12, CX, y + 8, 'Z'), '#FFFFFF', { sw: 3 }),
        line(d('M', CX, y + 46, 'L', CX, b.hemY - 12), 3),
        buttons(CX - 5, [y + 58, y + 78], '#F5E6C8'),
        shape(d('M', CX - 38, b.hemY - 40, 'L', CX - 16, b.hemY - 40, 'L', CX - 16, b.hemY - 20, 'L', CX - 38, b.hemY - 20, 'Z'), c, { sw: 3 }),
        shape(d('M', CX + 16, b.hemY - 40, 'L', CX + 38, b.hemY - 40, 'L', CX + 38, b.hemY - 20, 'L', CX + 16, b.hemY - 20, 'Z'), c, { sw: 3 }),
      ].join('')
    },
  },

  baba: {
    arms: { sleeve: '#8EC5E8', sleeveFrac: 0.66, band: [0.56, 0.68, '#8EC5E8', 3.5] },
    legs: trousers('#34406B', '#5A3B2E', 'shoe'),
    torso(view, b) {
      const y = b.shoulderY
      const c = '#8EC5E8'
      const belt = band(view, b, b.hemY - 14, b.hemY, '#6B4A3A')
      if (view === 'side') {
        const dd = sideDepth(b)
        return [torso(view, b, c), belt, neck(view, b, b.skinShade), collarSide(b, c), line(d('M', CX + dd - 6, y + 16, 'L', CX + dd - 4, b.hemY - 14), 3, 0.5),
          shape(d('M', CX + dd - 10, b.hemY - 14, 'L', CX + dd + 2, b.hemY - 14, 'L', CX + dd + 2, b.hemY, 'L', CX + dd - 10, b.hemY, 'Z'), '#F2C14E', { sw: 3 })].join('')
      }
      if (view === 'back') return [torso(view, b, c), belt, neck(view, b, b.skinShade), collarBack(b, c), line(d('M', CX - b.p.shoulderHalf + 6, y + 30, 'Q', CX, y + 36, CX + b.p.shoulderHalf - 6, y + 30), 3, 0.35)].join('')
      return [
        torso(view, b, c), belt,
        shape(d('M', CX - 8, b.hemY - 14, 'L', CX + 8, b.hemY - 14, 'L', CX + 8, b.hemY, 'L', CX - 8, b.hemY, 'Z'), '#F2C14E', { sw: 3 }),
        neck(view, b, b.skinShade),
        shirtCollar(b, c),
        line(d('M', CX, y + 17, 'L', CX, b.hemY - 14), 3, 0.5),
        buttons(CX, [y + 34, y + 58, y + 82], '#FFFFFF', 3),
        shape(d('M', CX + 16, y + 34, 'L', CX + 36, y + 34, 'L', CX + 36, y + 52, 'Q', CX + 26, y + 56, CX + 16, y + 52, 'Z'), c, { sw: 3 }),
      ].join('')
    },
  },

  gege: {
    arms: { sleeve: '#F29E4C', sleeveFrac: 1, band: [0.88, 1, '#E0863A'] },
    legs: trousers('#4E6FA8', '#FFFFFF', 'sneaker', '#E05A47'),
    torso(view, b) {
      const y = b.shoulderY
      const c = '#F29E4C'
      const rib = band(view, b, b.hemY - 12, b.hemY, '#E0863A')
      if (view === 'side') {
        const dd = sideDepth(b)
        return [
          torso(view, b, c), rib,
          shape(d('M', CX - dd + 2, y + 18, 'Q', CX - dd - 16, y - 6, CX - 14, y - 16, 'Q', CX + 2, y - 12, CX + 6, y + 6, 'Z'), c),
          neck(view, b, b.skinShade),
          shape(d('M', CX + dd - 22, b.hemY - 50, 'L', CX + dd + 2, b.hemY - 50, 'L', CX + dd + 3, b.hemY - 14, 'L', CX + dd - 30, b.hemY - 14, 'Z'), c, { sw: 3.5 }),
          line(d('M', CX + dd - 8, y + 10, 'L', CX + dd - 6, y + 40), 3),
        ].join('')
      }
      if (view === 'back') return [
        torso(view, b, c), rib, neck(view, b, b.skinShade),
        shape(d('M', CX - 30, y + 2, 'Q', CX - 34, y - 14, CX - 14, y - 12, 'L', CX + 14, y - 12, 'Q', CX + 34, y - 14, CX + 30, y + 2, 'Q', CX + 26, y + 50, CX, y + 56, 'Q', CX - 26, y + 50, CX - 30, y + 2, 'Z'), c, { cls: 'hood' }),
        line(d('M', CX, y - 10, 'L', CX, y + 54), 3, 0.35),
      ].join('')
      return [
        torso(view, b, c), rib,
        shape(d('M', CX - 32, y + 8, 'Q', CX - 36, y - 14, CX - 16, y - 14, 'L', CX + 16, y - 14, 'Q', CX + 36, y - 14, CX + 32, y + 8, 'Q', CX, y + 30, CX - 32, y + 8, 'Z'), c, { cls: 'hood' }),
        neck(view, b, b.skinShade),
        shape(d('M', CX - 18, y - 2, 'Q', CX, y + 20, CX + 18, y - 2), 'none', { sw: 3.5 }),
        line(d('M', CX - 8, y + 12, 'L', CX - 10, y + 44, 'M', CX + 8, y + 12, 'L', CX + 10, y + 44), 3),
        circle(CX - 10, y + 46, 3, '#FFFFFF', { sw: 2.5 }), circle(CX + 10, y + 46, 3, '#FFFFFF', { sw: 2.5 }),
        shape(d('M', CX - 26, b.hemY - 50, 'L', CX + 26, b.hemY - 50, 'L', CX + 36, b.hemY - 14, 'L', CX - 36, b.hemY - 14, 'Z'), c, { sw: 3.5, cls: 'pocket' }),
      ].join('')
    },
  },

  meimei: {
    arms: { sleeve: '#FFD166', sleeveFrac: 0.34, spread: 8 },
    legs: skirtLegs({ knee: 0, legs: 'skin', sock: '#FFFFFF', shoe: '#E05A47', style: 'kid' }),
    torso(view, b) {
      const y = b.shoulderY
      const c = '#FFD166'
      const o: TorsoOpts = { extend: 26, bottomHalf: b.p.hemHalf + 16 }
      const sash = band(view, b, y + 42, y + 52, '#F28B82', o)
      if (view === 'side') {
        const dd = sideDepth(b)
        return [torso(view, b, c, o), sash, bow(CX - dd - 4, y + 47, 0.6, '#F28B82'), neck(view, b, b.skinShade), shape(d('M', CX - 6, y - 2, 'Q', CX + 16, y - 4, CX + dd + 2, y + 8, 'Q', CX + 8, y + 16, CX - 6, y + 8, 'Z'), '#FFFFFF', { sw: 3 })].join('')
      }
      if (view === 'back') return [torso(view, b, c, o), sash, bow(CX, y + 47, 0.75, '#F28B82'), neck(view, b, b.skinShade)].join('')
      return [
        torso(view, b, c, o), sash,
        neck(view, b, b.skinShade),
        shape(d('M', CX - 12, y - 3, 'Q', CX - 24, y + 2, CX - 20, y + 13, 'Q', CX - 8, y + 14, CX, y + 6, 'Z'), '#FFFFFF', { sw: 3 }),
        shape(d('M', CX + 12, y - 3, 'Q', CX + 24, y + 2, CX + 20, y + 13, 'Q', CX + 8, y + 14, CX, y + 6, 'Z'), '#FFFFFF', { sw: 3 }),
        circle(CX - 16, b.hemY + 6, 5, '#FFFFFF', { sw: 2.5 }), circle(CX + 18, b.hemY - 2, 4, '#FFFFFF', { sw: 2.5 }),
        line(d('M', CX - halfAt(b, b.hemY + 18, o) + 2, b.hemY + 18, 'L', CX + halfAt(b, b.hemY + 18, o) - 2, b.hemY + 18), 3, 0.5),
      ].join('')
    },
  },

  seller: {
    arms: { sleeve: '#F4A7B9', sleeveFrac: 1, band: [0.45, 1, '#7FA7D9'] },
    legs: trousers('#3A3346', '#3A3346', 'sneaker', '#FFFFFF'),
    torso(view, b) {
      const y = b.shoulderY
      const c = '#F4A7B9'
      const ap = '#3F8F5A'
      if (view === 'side') {
        const dd = sideDepth(b)
        return [
          torso(view, b, c), neck(view, b, b.skinShade),
          line(d('M', CX - dd, y + 58, 'L', CX + dd, y + 58), 3.5), bow(CX - dd - 4, y + 58, 0.7, ap),
          shape(d('M', CX + dd - 12, y + 14, 'L', CX + dd + 4, y + 14, 'L', CX + dd + 12, b.hemY + 22, 'L', CX + dd - 6, b.hemY + 22, 'Z'), ap),
          shape(d('M', CX + dd - 4, b.hemY - 30, 'L', CX + dd + 9, b.hemY - 30, 'L', CX + dd + 11, b.hemY - 4, 'L', CX + dd - 2, b.hemY - 4, 'Z'), '#2F6F45', { sw: 3 }),
          line(d('M', CX + dd - 6, y + 15, 'L', CX - 8, y - 2), 4),
        ].join('')
      }
      if (view === 'back') return [torso(view, b, c), neck(view, b, b.skinShade), line(d('M', CX - b.p.shoulderHalf - 1, y + 58, 'L', CX + b.p.shoulderHalf + 1, y + 58), 3.5), line(d('M', CX - 12, y, 'Q', CX, y + 8, CX + 12, y), 4), bow(CX, y + 58, 1, ap)].join('')
      return [
        torso(view, b, c), neck(view, b, b.skinShade),
        shirtCollar(b, c, 0.8),
        shape(d('M', CX - 26, y + 14, 'L', CX + 26, y + 14, 'Q', CX + 30, y + 40, CX + 44, y + 52, 'L', CX + 48, b.hemY + 22, 'L', CX - 48, b.hemY + 22, 'L', CX - 44, y + 52, 'Q', CX - 30, y + 40, CX - 26, y + 14, 'Z'), ap, { cls: 'apron' }),
        line(d('M', CX - 24, y + 15, 'L', CX - 14, y + 2, 'M', CX + 24, y + 15, 'L', CX + 14, y + 2), 4),
        shape(d('M', CX - 34, b.hemY - 34, 'L', CX + 34, b.hemY - 34, 'L', CX + 36, b.hemY - 2, 'L', CX - 36, b.hemY - 2, 'Z'), '#2F6F45', { sw: 3.5, cls: 'pocket' }),
        line(d('M', CX, b.hemY - 34, 'L', CX, b.hemY - 2), 3),
      ].join('')
    },
  },

  doctor: {
    arms: { sleeve: '#FFFFFF', sleeveFrac: 1, band: [0.86, 1, '#F1EEF6'] },
    legs: trousers('#5E5A6E', '#3A3346', 'shoe'),
    torso(view, b) {
      const y = b.shoulderY
      const coat = '#FFFFFF'
      const o: TorsoOpts = { extend: 40, bottomHalf: b.p.hemHalf + 8 }
      const steth = '#6E6A80'
      if (view === 'side') {
        const dd = sideDepth(b)
        return [
          torso(view, b, coat, o), neck(view, b, b.skinShade),
          shape(d('M', CX - 6, y - 3, 'L', CX + 14, y - 1, 'L', CX + dd - 2, y + 48, 'L', CX + 6, y + 22, 'Z'), coat, { sw: 3.5 }),
          strap(P(CX - 6, y + 2), P(CX + 16, y + 30), P(CX + dd - 2, y + 50), 2.5, steth),
          circle(CX + dd - 1, y + 56, 7, '#CFCAD8', { sw: 3 }),
          line(d('M', CX + dd + 3, b.hemY + 6, 'L', CX + dd - 16, b.hemY + 6), 3),
        ].join('')
      }
      if (view === 'back') return [torso(view, b, coat, o), neck(view, b, b.skinShade), collarBack(b, coat), line(d('M', CX, b.hemY + 6, 'L', CX, b.hemY + 40), 3.5), line(d('M', CX - halfAt(b, b.hemY - 10, o) + 2, b.hemY - 10, 'L', CX + halfAt(b, b.hemY - 10, o) - 2, b.hemY - 10), 3, 0.35)].join('')
      return [
        torso(view, b, coat, o),
        vNeck(b, '#A9CBEB', 17, 62),
        neck(view, b, b.skinShade),
        shape(d('M', CX - 5, y + 9, 'L', CX + 5, y + 9, 'L', CX + 7, y + 46, 'L', CX, y + 56, 'L', CX - 7, y + 46, 'Z'), '#34406B', { sw: 3, cls: 'tie' }),
        shape(d('M', CX - 6, y + 2, 'L', CX + 6, y + 2, 'L', CX + 5, y + 10, 'L', CX - 5, y + 10, 'Z'), '#34406B', { sw: 3 }),
        lapels(b, coat, 17, 64),
        line(d('M', CX, y + 64, 'L', CX, b.hemY + 40), 3.5),
        buttons(CX + 6, [y + 76, y + 100], '#E4E0EC'),
        shape(d('M', CX + 22, y + 34, 'L', CX + 40, y + 34, 'L', CX + 40, y + 52, 'L', CX + 22, y + 52, 'Z'), coat, { sw: 3 }),
        shape(d('M', CX + 27, y + 22, 'L', CX + 32, y + 22, 'L', CX + 32, y + 36, 'L', CX + 27, y + 36, 'Z'), '#4C9BE8', { sw: 2.5 }),
        shape(d('M', CX - 46, b.hemY + 2, 'L', CX - 18, b.hemY + 2, 'L', CX - 18, b.hemY + 26, 'L', CX - 46, b.hemY + 26, 'Z'), coat, { sw: 3 }),
        shape(d('M', CX + 18, b.hemY + 2, 'L', CX + 46, b.hemY + 2, 'L', CX + 46, b.hemY + 26, 'L', CX + 18, b.hemY + 26, 'Z'), coat, { sw: 3 }),
        group('stethoscope', [
          strap(P(CX - 18, y - 2), P(CX - 26, y + 50), P(CX - 10, y + 62), 2.5, steth),
          strap(P(CX + 18, y - 2), P(CX + 26, y + 50), P(CX + 10, y + 62), 2.5, steth),
          strap(P(CX - 10, y + 62), P(CX, y + 66), P(CX + 10, y + 62), 2.5, steth),
          strap(P(CX - 4, y + 64), P(CX - 18, y + 80), P(CX - 22, y + 92), 2.5, steth),
          circle(CX - 22, y + 98, 7, '#CFCAD8', { sw: 3 }),
        ]),
      ].join('')
    },
  },

  teacher: {
    arms: { sleeve: '#2F8F83', sleeveFrac: 1, band: [0.9, 1, '#FFFFFF'] },
    legs: skirtLegs({ skirt: '#3D4B80', knee: 0.5, legs: 'skin', shoe: '#3A3346', style: 'flat' }),
    torso(view, b) {
      const y = b.shoulderY
      const c = '#2F8F83'
      if (view === 'side') {
        const dd = sideDepth(b)
        return [torso(view, b, c), neck(view, b, b.skinShade), shape(d('M', CX + 4, y + 2, 'L', CX + dd - 6, y + 5, 'L', CX + dd - 4, y + 42, 'Z'), '#FFFFFF', { sw: 3.5 }), shape(d('M', CX + 6, y + 4, 'L', CX + dd - 5, y + 44, 'L', CX + 4, y + 22, 'Z'), c, { sw: 3.5 })].join('')
      }
      if (view === 'back') return [torso(view, b, c), neck(view, b, b.skinShade), collarBack(b, c), line(d('M', CX, y + 14, 'L', CX, b.hemY), 3, 0.35)].join('')
      return [
        torso(view, b, c),
        vNeck(b, '#FFFFFF', 16, 52),
        neck(view, b, b.skinShade),
        lapels(b, c, 16, 54),
        buttons(CX, [y + 68, y + 90], '#F2C14E'),
        line(d('M', CX - 38, b.hemY - 24, 'L', CX - 18, b.hemY - 24, 'M', CX + 18, b.hemY - 24, 'L', CX + 38, b.hemY - 24), 3),
      ].join('')
    },
    item: {
      side: 'left',
      draw(view, _b, h) {
        const w = 17
        return group('book', [
          shape(d('M', h.x - w, h.y - 8, 'L', h.x + w, h.y - 8, 'L', h.x + w, h.y + 40, 'L', h.x - w, h.y + 40, 'Z'), '#E05A47'),
          shape(d('M', h.x - w + 2, h.y + 40, 'L', h.x + w - 2, h.y + 40, 'L', h.x + w - 2, h.y + 45, 'L', h.x - w + 2, h.y + 45, 'Z'), '#FFFFFF', { sw: 3 }),
          view === 'back' ? '' : shape(d('M', h.x - 9, h.y + 14, 'L', h.x + 9, h.y + 14, 'L', h.x + 9, h.y + 28, 'L', h.x - 9, h.y + 28, 'Z'), '#FFD166', { sw: 2.5 }),
        ])
      },
    },
  },

  waiter: {
    arms: { sleeve: '#FFFFFF', sleeveFrac: 1, band: [0.88, 1, '#FFFFFF'] },
    legs: trousers('#33293F', '#2A2233', 'shoe'),
    torso(view, b) {
      const y = b.shoulderY
      const vest = '#33293F'
      const o: TorsoOpts = { extend: 6 }
      const bowTie = (x: number, yy: number) => group('bowtie', [
        shape(d('M', x, yy, 'L', x - 18, yy - 10, 'L', x - 18, yy + 10, 'Z'), '#D9534F', { sw: 3 }),
        shape(d('M', x, yy, 'L', x + 18, yy - 10, 'L', x + 18, yy + 10, 'Z'), '#D9534F', { sw: 3 }),
        circle(x, yy, 5, '#D9534F', { sw: 3 }),
      ])
      if (view === 'side') {
        const dd = sideDepth(b)
        return [
          torso(view, b, '#FFFFFF'),
          shape(d('M', CX - dd, y + 18, 'Q', CX - dd, y + 2, CX - dd + 14, y + 2, 'L', CX + 2, y + 4, 'L', CX + dd - 4, y + 52, 'L', CX + dd + 3, b.hemY + 8, 'L', CX - dd - 3, b.hemY + 6, 'Z'), vest),
          neck(view, b, b.skinShade), collarSide(b, '#FFFFFF'),
          shape(d('M', CX + dd - 2, y + 6, 'L', CX + dd + 8, y - 2, 'L', CX + dd + 8, y + 14, 'Z'), '#D9534F', { sw: 3 }),
        ].join('')
      }
      if (view === 'back') return [torso(view, b, vest, o), neck(view, b, b.skinShade), collarBack(b, '#FFFFFF'), line(d('M', CX - 16, y + 82, 'L', CX + 16, y + 82), 3.5), circle(CX, y + 82, 3.5, '#9C97AA', { sw: 2.5 })].join('')
      return [
        torso(view, b, vest, o),
        vNeck(b, '#FFFFFF', 20, 64),
        neck(view, b, b.skinShade),
        shirtCollar(b, '#FFFFFF', 0.7),
        bowTie(CX, y + 10),
        buttons(CX, [y + 76, y + 96], '#9C97AA'),
        line(d('M', CX, y + 64, 'L', CX, b.hemY + 6), 3, 0.6),
        line(d('M', CX - 36, y + 70, 'L', CX - 18, y + 70, 'M', CX + 18, y + 70, 'L', CX + 36, y + 70), 3, 0.6),
      ].join('')
    },
    item: {
      side: 'left',
      draw(view, b) {
        if (view === 'back') return ''
        const g = armGeom(view, b, 'left')
        const x = (g.c.x + g.e.x) / 2 + (view === 'side' ? 2 : g.e.x > CX ? 7 : -7)
        const yy = (g.c.y + g.e.y) / 2 + 6
        return group('towel', [shape(d('M', x - 13, yy - 14, 'L', x + 13, yy - 14, 'L', x + 15, yy + 28, 'L', x - 11, yy + 28, 'Z'), '#F5E6C8', { sw: 3.5 }), shape(d('M', x - 12, yy + 14, 'L', x + 14, yy + 14, 'L', x + 14.5, yy + 19, 'L', x - 11.5, yy + 19, 'Z'), '#D9534F', { stroke: false })])
      },
    },
  },

  driver: {
    arms: { sleeve: '#B5A36A', sleeveFrac: 1, band: [0.88, 1, '#9C8B53'], hand: '#FFFFFF' },
    legs: trousers('#4A4458', '#2E2838', 'shoe'),
    torso(view, b) {
      const y = b.shoulderY
      const c = '#B5A36A'
      const dark = '#9C8B53'
      const rib = band(view, b, b.hemY - 12, b.hemY, dark)
      if (view === 'side') {
        const dd = sideDepth(b)
        return [torso(view, b, c), rib, neck(view, b, b.skinShade), collarSide(b, dark), line(d('M', CX + dd - 4, y + 14, 'L', CX + dd - 2, b.hemY - 12), 3, 0.6),
          shape(d('M', CX + 4, y + 34, 'L', CX + dd - 4, y + 34, 'L', CX + dd - 4, y + 46, 'L', CX + 4, y + 46, 'Z'), dark, { sw: 3 })].join('')
      }
      if (view === 'back') return [torso(view, b, c), rib, neck(view, b, b.skinShade), collarBack(b, dark), line(d('M', CX - b.p.shoulderHalf + 4, y + 34, 'Q', CX, y + 40, CX + b.p.shoulderHalf - 4, y + 34), 3, 0.4)].join('')
      return [
        torso(view, b, c), rib, neck(view, b, b.skinShade),
        shirtCollar(b, dark, 1.2),
        line(d('M', CX, y + 17, 'L', CX, b.hemY), 3.5),
        line(d('M', CX - 4, y + 22, 'L', CX + 4, y + 22, 'M', CX - 4, y + 34, 'L', CX + 4, y + 34), 2.5, 0.6),
        shape(d('M', CX - 42, y + 32, 'L', CX - 14, y + 32, 'L', CX - 14, y + 44, 'Q', CX - 28, y + 48, CX - 42, y + 44, 'Z'), dark, { sw: 3 }),
        shape(d('M', CX + 14, y + 32, 'L', CX + 42, y + 32, 'L', CX + 42, y + 44, 'Q', CX + 28, y + 48, CX + 14, y + 44, 'Z'), dark, { sw: 3 }),
        line(d('M', CX - 42, y + 56, 'L', CX - 14, y + 56, 'M', CX + 14, y + 56, 'L', CX + 42, y + 56), 3, 0.4),
      ].join('')
    },
  },

  friend: {
    arms: { sleeve: '#F7A38C', sleeveFrac: 0.42 },
    legs: trousers('#5B83C4', '#FFD166', 'sneaker', '#FFFFFF'),
    torso(view, b) {
      const y = b.shoulderY
      const tee = '#F7A38C'
      const den = '#5B83C4'
      const sh = b.p.shoulderHalf
      if (view === 'side') {
        const dd = sideDepth(b)
        return [
          torso(view, b, tee), neck(view, b, b.skinShade),
          shape(d('M', CX + 2, y + 48, 'L', CX + dd + 1, y + 48, 'L', CX + dd + 2, b.hemY, 'L', CX - dd - 2, b.hemY, 'L', CX - dd, y + 80, 'Z'), den),
          strap(P(CX + dd - 8, y + 50), P(CX + 4, y + 4), P(CX - 10, y + 4), 5, den),
          circle(CX + dd - 7, y + 52, 3.5, '#F2C14E', { sw: 2.5 }),
          line(d('M', CX + dd - 2, y + 64, 'L', CX + dd - 14, y + 64), 3, 0.5),
        ].join('')
      }
      if (view === 'back') return [
        torso(view, b, tee), neck(view, b, b.skinShade),
        shape(d('M', CX - b.p.hemHalf + 3, b.hemY - 40, 'L', CX + b.p.hemHalf - 3, b.hemY - 40, 'L', CX + b.p.hemHalf, b.hemY, 'L', CX - b.p.hemHalf, b.hemY, 'Z'), den),
        strap(P(CX - sh + 16, y + 2), P(CX - 4, y + 40), P(CX + 18, b.hemY - 40), 5, den),
        strap(P(CX + sh - 16, y + 2), P(CX + 4, y + 40), P(CX - 18, b.hemY - 40), 5, den),
      ].join('')
      return [
        torso(view, b, tee), neck(view, b, b.skinShade),
        shape(d('M', CX - 14, y - 3, 'Q', CX, y + 12, CX + 14, y - 3), 'none', { sw: 3.5 }),
        strap(P(CX - 25, y + 50), P(CX - 26, y + 20), P(CX - sh + 16, y + 2), 5, den),
        strap(P(CX + 25, y + 50), P(CX + 26, y + 20), P(CX + sh - 16, y + 2), 5, den),
        shape(d('M', CX - 27, y + 48, 'L', CX + 27, y + 48, 'L', CX + 30, b.hemY - 20, 'L', CX + b.p.hemHalf, b.hemY, 'L', CX - b.p.hemHalf, b.hemY, 'L', CX - 30, b.hemY - 20, 'Z'), den, { cls: 'overalls' }),
        shape(d('M', CX - 14, y + 58, 'L', CX + 14, y + 58, 'L', CX + 13, y + 78, 'L', CX - 13, y + 78, 'Z'), den, { sw: 3 }),
        circle(CX - 24, y + 52, 3.5, '#F2C14E', { sw: 2.5 }), circle(CX + 24, y + 52, 3.5, '#F2C14E', { sw: 2.5 }),
      ].join('')
    },
  },

  classmate: {
    arms: { sleeve: '#7CC6A4', sleeveFrac: 0.42 },
    legs: trousers('#C9B28A', '#6E6A80', 'sneaker', '#FFFFFF'),
    behind(view, b) {
      const y = b.shoulderY
      const sh = b.p.shoulderHalf
      const pack = '#E05A47'
      if (view === 'front') return group('backpack', shape(d('M', CX - sh + 8, y + 20, 'L', CX - sh + 8, y - 2, 'Q', CX - sh + 8, y - 16, CX - sh + 24, y - 16, 'L', CX + sh - 24, y - 16, 'Q', CX + sh - 8, y - 16, CX + sh - 8, y - 2, 'L', CX + sh - 8, y + 20, 'Z'), pack))
      if (view === 'side') {
        const dd = sideDepth(b)
        return group('backpack', [
          shape(d('M', CX - dd + 6, y - 4, 'Q', CX - dd - 30, y - 6, CX - dd - 30, y + 22, 'L', CX - dd - 30, y + 84, 'Q', CX - dd - 30, y + 98, CX - dd - 14, y + 98, 'L', CX - dd + 6, y + 98, 'Z'), pack),
          shape(d('M', CX - dd - 30, y + 54, 'Q', CX - dd - 42, y + 56, CX - dd - 42, y + 70, 'L', CX - dd - 42, y + 84, 'Q', CX - dd - 42, y + 92, CX - dd - 30, y + 92, 'Z'), '#C94A3A', { sw: 3.5 }),
        ])
      }
      return ''
    },
    torso(view, b) {
      const y = b.shoulderY
      const tee = '#7CC6A4'
      const sh = b.p.shoulderHalf
      const pack = '#E05A47'
      const webbing = '#3A3346'
      if (view === 'side') {
        const dd = sideDepth(b)
        return [
          torso(view, b, tee), neck(view, b, b.skinShade),
          strap(P(CX - dd + 2, y + 4), P(CX + dd - 6, y - 2), P(CX + dd - 8, y + 46), 4, webbing),
          strap(P(CX + dd - 8, y + 46), P(CX + dd - 10, y + 76), P(CX - dd + 4, y + 88), 3.5, webbing),
        ].join('')
      }
      if (view === 'back') {
        return [
          torso(view, b, tee), neck(view, b, b.skinShade),
          group('backpack', [
            shape(d('M', CX - sh + 6, y + 14, 'Q', CX - sh + 6, y - 8, CX - sh + 28, y - 8, 'L', CX + sh - 28, y - 8, 'Q', CX + sh - 6, y - 8, CX + sh - 6, y + 14, 'L', CX + sh - 6, b.hemY - 16, 'Q', CX + sh - 6, b.hemY - 4, CX + sh - 18, b.hemY - 4, 'L', CX - sh + 18, b.hemY - 4, 'Q', CX - sh + 6, b.hemY - 4, CX - sh + 6, b.hemY - 16, 'Z'), pack),
            shape(d('M', CX - 24, b.hemY - 52, 'L', CX + 24, b.hemY - 52, 'Q', CX + 28, b.hemY - 52, CX + 28, b.hemY - 46, 'L', CX + 28, b.hemY - 16, 'L', CX - 28, b.hemY - 16, 'L', CX - 28, b.hemY - 46, 'Q', CX - 28, b.hemY - 52, CX - 24, b.hemY - 52, 'Z'), '#C94A3A', { sw: 3.5 }),
            line(d('M', CX - sh + 14, y + 12, 'Q', CX, y + 2, CX + sh - 14, y + 12), 3, 0.5),
            shape(d('M', CX - 8, y - 14, 'Q', CX, y - 24, CX + 8, y - 14), 'none', { sw: 4 }),
          ]),
        ].join('')
      }
      return [
        torso(view, b, tee), neck(view, b, b.skinShade),
        shape(d('M', CX - 14, y - 3, 'Q', CX, y + 12, CX + 14, y - 3), 'none', { sw: 3.5 }),
        strap(P(CX - sh + 12, y + 2), P(CX - sh + 14, y + 40), P(CX - sh + 16, y + 84), 5, webbing),
        strap(P(CX + sh - 12, y + 2), P(CX + sh - 14, y + 40), P(CX + sh - 16, y + 84), 5, webbing),
        shape(d('M', CX - 12, y + 44, 'L', CX + 12, y + 44, 'L', CX + 12, y + 60, 'L', CX - 12, y + 60, 'Z'), pack, { sw: 3, cls: 'print' }),
      ].join('')
    },
  },
}

export function outfitFor(spec: CharacterSpec): Outfit {
  const o = OUTFITS[spec.id]
  if (!o) throw new Error(`no outfit for ${spec.id}`)
  return o
}
