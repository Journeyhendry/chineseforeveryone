// Hair styles and hats, in the head's local coordinates (see head.ts). Each style gives:
//  - far:   drawn behind the body (long hair falling down the back), front/side views only
//  - back:  behind the face (volume, buns, pigtails)
//  - front: over the face (fringe, side locks); in the side view this also covers the skull
//  - rear:  the whole back-of-head view (drawn over the skin, ears peeking at the sides)
import { circle, d, group, line, shape, tube } from './svg.ts'
import type { CharacterSpec, HatId, View } from './types.ts'

export interface HairLayers {
  far: string
  back: string
  front: string
  /** whether the ears are covered by hair in this view */
  coversEars: boolean
}

/** Bumpy outline through points: each segment is an outward arc (curly hair, tufts). */
function bumps(points: [number, number][], r: number, sweep = 1): string {
  const parts: (string | number)[] = ['M', points[0][0], points[0][1]]
  for (let i = 1; i < points.length; i++) parts.push('A', r, r, 0, 0, sweep, points[i][0], points[i][1])
  return d(...parts)
}

function ellipsePoints(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, count: number): [number, number][] {
  const out: [number, number][] = []
  for (let i = 0; i <= count; i++) {
    const a = ((a0 + ((a1 - a0) * i) / count) * Math.PI) / 180
    out.push([Math.round((cx + rx * Math.cos(a)) * 10) / 10, Math.round((cy + ry * Math.sin(a)) * 10) / 10])
  }
  return out
}

const mirror = (pts: [number, number][]): [number, number][] => pts.map(([x, y]) => [-x, y])

function strands(paths: string[], k: number): string {
  return paths.map((p) => line(p, 3 * k, 0.35)).join('')
}

export function hairLayers(spec: CharacterSpec, view: View, k: number): HairLayers {
  const c = spec.hairColor
  const acc = spec.hairAccent ?? '#F28B82'
  const H = (p: string) => shape(p, c)
  const none: HairLayers = { far: '', back: '', front: '', coversEars: false }
  switch (spec.hair) {
    case 'bun': {
      if (view === 'front') return { ...none,
        back: circle(0, -64, 24, c) + H(d('M', -60, 10, 'Q', -64, -58, 0, -64, 'Q', 64, -58, 60, 10, 'Q', 62, 32, 50, 42, 'L', -50, 42, 'Q', -62, 32, -60, 10, 'Z')),
        front: H(d('M', -54, -6, 'Q', -58, -48, 0, -52, 'Q', 58, -48, 54, -6, 'Q', 36, -18, 26, -36, 'Q', 10, -22, -30, -22, 'Q', -44, -20, -54, -6, 'Z')),
      }
      if (view === 'side') return { ...none,
        back: circle(-26, -60, 23, c),
        front: H(d('M', 51, -14, 'Q', 55, -62, 0, -62, 'Q', -58, -60, -58, -4, 'Q', -60, 28, -46, 42, 'Q', -36, 46, -31, 36, 'Q', -27, 20, -27, 6, 'Q', -26, -12, -12, -18, 'Q', 12, -22, 26, -34, 'Q', 38, -18, 51, -14, 'Z')),
      }
      return { ...none,
        back: circle(0, -64, 24, c) + H(d('M', -58, 8, 'Q', -64, -60, 0, -64, 'Q', 64, -60, 58, 8, 'Q', 60, 34, 48, 42, 'Q', 0, 48, -48, 42, 'Q', -60, 34, -58, 8, 'Z'))
          + strands([d('M', -34, 30, 'Q', -30, -16, -10, -46), d('M', 34, 30, 'Q', 30, -16, 10, -46), d('M', 0, 36, 'L', 0, -44)], k),
      }
    }
    case 'grayBun': {
      const bunPin = shape(tube({ x: -24, y: -80 }, { x: 0, y: -74 }, { x: 26, y: -62 }, 2.5), '#8A5A3B', { sw: 3 * k })
      if (view === 'front') return { ...none,
        back: circle(0, -68, 21, c) + bunPin + H(d('M', -60, 14, 'Q', -68, -60, 0, -64, 'Q', 68, -60, 60, 14, 'Q', 56, 24, 46, 20, 'L', -46, 20, 'Q', -56, 24, -60, 14, 'Z')),
        front: H(d('M', -55, -2, 'Q', -62, -56, 0, -57, 'Q', 62, -55, 55, -2, 'Q', 52, -26, 36, -36, 'Q', 18, -44, -6, -36, 'Q', -26, -42, -42, -32, 'Q', -53, -20, -55, -2, 'Z'))
          + strands([d('M', 30, -46, 'Q', 42, -40, 46, -26), d('M', -20, -48, 'Q', -36, -44, -44, -30)], k),
      }
      if (view === 'side') return { ...none,
        back: circle(-30, -62, 21, c) + shape(tube({ x: -50, y: -76 }, { x: -30, y: -66 }, { x: -8, y: -58 }, 2.5), '#8A5A3B', { sw: 3 * k }),
        front: H(d('M', 50, -20, 'Q', 54, -64, 0, -64, 'Q', -60, -62, -60, -4, 'Q', -60, 16, -48, 24, 'Q', -36, 26, -30, 14, 'Q', -28, -6, -14, -18, 'Q', 14, -34, 32, -36, 'Q', 44, -32, 50, -20, 'Z'))
          + strands([d('M', 20, -52, 'Q', -10, -50, -30, -32)], k),
      }
      return { ...none,
        back: circle(0, -68, 21, c) + bunPin + H(d('M', -58, 14, 'Q', -66, -62, 0, -64, 'Q', 66, -62, 58, 14, 'Q', 52, 40, 0, 42, 'Q', -52, 40, -58, 14, 'Z'))
          + strands([d('M', -36, 30, 'Q', -36, -24, -12, -48), d('M', 36, 30, 'Q', 36, -24, 12, -48), d('M', 0, 38, 'L', 0, -46)], k),
      }
    }
    case 'tufts': {
      const tuftL: [number, number][] = [[-47, 2], [-58, -4], [-62, -16], [-56, -28], [-44, -33], [-40, -24]]
      const tuftPath = (pts: [number, number][], sweep: number) => bumps(pts, 7, sweep) + d('Q', pts[0][0] < 0 ? -46 : 46, -12, pts[0][0], pts[0][1], 'Z')
      if (view === 'front') return { ...none,
        front: H(tuftPath(tuftL, 1)) + H(tuftPath(mirror(tuftL), 0)) + line(d('M', -8, -51, 'Q', -6, -62, 6, -60, 'M', 4, -51, 'Q', 8, -60, 16, -56), 3.5 * k),
      }
      if (view === 'side') return { ...none,
        front: H(bumps([[-24, 26], [-40, 30], [-52, 20], [-58, 6], [-58, -10], [-52, -24], [-38, -30], [-26, -26]], 7) + d('Q', -18, -10, -24, 26, 'Z'))
          + line(d('M', 4, -53, 'Q', 8, -62, 18, -58), 3.5 * k),
      }
      return { ...none,
        back: H(bumps([[-56, -16], [-58, 0], [-54, 16], [-44, 28], [-30, 34], [-14, 38], [0, 39], [14, 38], [30, 34], [44, 28], [54, 16], [58, 0], [56, -16]], 9, 0) + d('Q', 40, -2, 0, 2, 'Q', -40, -2, -56, -16, 'Z')),
      }
    }
    case 'sidePart': {
      if (view === 'front') return { ...none,
        back: H(d('M', -58, 6, 'Q', -62, -66, 0, -72, 'Q', 62, -66, 58, 6, 'Z')),
        front: H(d('M', -54, -4, 'Q', -62, -66, -4, -72, 'Q', 62, -70, 54, -4, 'Q', 52, -26, 44, -34, 'Q', 14, -26, -12, -44, 'Q', -32, -38, -46, -26, 'Q', -52, -16, -54, -4, 'Z'))
          + line(d('M', -12, -44, 'Q', -18, -56, -24, -66, 'M', 6, -50, 'Q', 22, -48, 36, -42), 3 * k, 0.5),
      }
      if (view === 'side') return { ...none,
        front: H(d('M', 50, -22, 'Q', 58, -72, -2, -72, 'Q', -60, -68, -58, -4, 'Q', -58, 14, -50, 24, 'Q', -38, 26, -30, 18, 'Q', -27, -4, -16, -18, 'Q', 18, -28, 36, -42, 'Q', 46, -34, 50, -22, 'Z'))
          + strands([d('M', 30, -52, 'Q', 0, -56, -30, -40)], k),
      }
      return { ...none,
        back: H(d('M', -58, 4, 'Q', -62, -70, 0, -72, 'Q', 62, -70, 58, 4, 'Q', 56, 32, 44, 38, 'Q', 0, 44, -44, 38, 'Q', -56, 32, -58, 4, 'Z'))
          + strands([d('M', -24, 34, 'Q', -22, -20, -6, -56), d('M', 20, 22, 'Q', 22, -20, 10, -56)], k),
      }
    }
    case 'spiky': {
      if (view === 'front') return { ...none,
        back: H(d('M', -58, 6, 'Q', -64, -56, 0, -62, 'Q', 64, -56, 58, 6, 'Z')),
        front: H(d('M', -54, -4, 'Q', -60, -40, -46, -54, 'L', -50, -68, 'L', -32, -60, 'L', -24, -76, 'L', -10, -64, 'L', 2, -79, 'L', 14, -64, 'L', 30, -74, 'L', 34, -58, 'L', 50, -62, 'L', 47, -46, 'Q', 58, -30, 54, -4,
          'Q', 50, -26, 42, -34, 'L', 33, -27, 'L', 22, -38, 'L', 9, -29, 'L', -2, -40, 'L', -15, -30, 'L', -25, -40, 'Q', -44, -30, -54, -4, 'Z')),
      }
      if (view === 'side') return { ...none,
        front: H(d('M', 50, -18, 'L', 56, -36, 'L', 42, -40, 'Q', 40, -58, 18, -62, 'L', 24, -76, 'L', 2, -66, 'L', -6, -80, 'L', -18, -64, 'L', -38, -72, 'L', -38, -56, 'L', -58, -56, 'L', -52, -40, 'L', -68, -30, 'L', -57, -18,
          'Q', -58, 10, -50, 22, 'Q', -38, 26, -30, 16, 'Q', -27, -6, -14, -20, 'Q', 10, -22, 28, -30, 'Q', 38, -20, 50, -18, 'Z')),
      }
      return { ...none,
        back: H(d('M', -58, 6, 'Q', -62, -40, -48, -52, 'L', -52, -68, 'L', -32, -60, 'L', -24, -76, 'L', -10, -64, 'L', 0, -79, 'L', 10, -64, 'L', 24, -76, 'L', 32, -60, 'L', 52, -68, 'L', 48, -52, 'Q', 62, -40, 58, 6,
          'Q', 56, 30, 44, 36, 'L', 34, 28, 'L', 22, 42, 'L', 10, 32, 'L', 0, 44, 'L', -10, 32, 'L', -22, 42, 'L', -34, 28, 'L', -44, 36, 'Q', -56, 30, -58, 6, 'Z')),
      }
    }
    case 'pigtails': {
      const tail = (s: number) => H(d('M', s * 54, -30, 'Q', s * 86, -44, s * 96, -14, 'Q', s * 102, 10, s * 86, 32, 'Q', s * 84, 12, s * 74, 2, 'Q', s * 62, -8, s * 54, -12, 'Z'))
      const tie = (s: number) => circle(s * 58, -22, 8, acc)
      if (view === 'front') return { ...none,
        back: tail(-1) + tail(1) + H(d('M', -58, 10, 'Q', -62, -60, 0, -62, 'Q', 62, -60, 58, 10, 'Q', 58, 26, 48, 30, 'L', -48, 30, 'Q', -58, 26, -58, 10, 'Z')),
        front: H(d('M', -54, -4, 'Q', -58, -52, 0, -56, 'Q', 58, -52, 54, -4, 'Q', 50, -16, 46, -28, 'Q', 40, -22, 36, -32, 'Q', 28, -26, 20, -33, 'Q', 11, -26, 3, -33, 'Q', -6, -26, -14, -33, 'Q', -22, -26, -30, -32, 'Q', -38, -24, -44, -30, 'Q', -50, -18, -54, -4, 'Z'))
          + tie(-1) + tie(1),
      }
      if (view === 'side') return { ...none,
        back: H(d('M', -48, -40, 'Q', -84, -46, -96, -18, 'Q', -104, 6, -92, 28, 'Q', -88, 8, -76, -2, 'Q', -62, -10, -52, -20, 'Z')),
        front: H(d('M', 50, -20, 'Q', 54, -62, 0, -62, 'Q', -58, -60, -58, -2, 'Q', -58, 20, -48, 28, 'Q', -36, 30, -30, 20, 'Q', -27, -6, -14, -18, 'Q', 14, -16, 30, -24, 'Q', 40, -18, 50, -20, 'Z'))
          + circle(-52, -30, 8, acc),
      }
      return { ...none,
        back: tail(-1) + tail(1) + H(d('M', -58, 10, 'Q', -62, -62, 0, -62, 'Q', 62, -62, 58, 10, 'Q', 58, 36, 46, 40, 'Q', 0, 46, -46, 40, 'Q', -58, 36, -58, 10, 'Z'))
          + line(d('M', 0, -62, 'L', 0, -40), 3 * k, 0.4) + tie(-1) + tie(1),
      }
    }
    case 'lowPonytail': {
      if (view === 'front') return { ...none,
        back: H(d('M', -58, 14, 'Q', -62, -50, 0, -54, 'Q', 62, -50, 58, 14, 'Q', 56, 26, 48, 28, 'L', -48, 28, 'Q', -56, 26, -58, 14, 'Z')),
        front: H(d('M', -54, -2, 'Q', -58, -30, -46, -40, 'L', 46, -40, 'Q', 58, -30, 54, -2, 'Q', 46, -18, 30, -24, 'Q', 6, -20, -18, -28, 'Q', -40, -20, -54, -2, 'Z')),
      }
      if (view === 'side') return { ...none,
        back: H(d('M', -50, 4, 'Q', -78, 10, -76, 42, 'Q', -74, 62, -62, 70, 'Q', -66, 44, -50, 26, 'Z')) + circle(-54, 12, 7, acc),
        front: H(d('M', 50, -16, 'Q', 52, -48, 0, -50, 'Q', -58, -50, -58, 0, 'Q', -58, 18, -48, 26, 'Q', -36, 28, -30, 18, 'Q', -27, -2, -14, -16, 'Q', 16, -18, 32, -24, 'Q', 42, -16, 50, -16, 'Z')),
      }
      return { ...none,
        back: H(d('M', -58, 12, 'Q', -62, -50, 0, -54, 'Q', 62, -50, 58, 12, 'Q', 52, 28, 0, 30, 'Q', -52, 28, -58, 12, 'Z'))
          + H(d('M', -12, 22, 'Q', -18, 52, -8, 78, 'Q', 0, 84, 8, 78, 'Q', 18, 52, 12, 22, 'Z')) + circle(0, 24, 8, acc),
      }
    }
    case 'quiff': {
      if (view === 'front') return { ...none,
        back: H(d('M', -58, 4, 'Q', -62, -60, 0, -64, 'Q', 62, -60, 58, 4, 'Z')),
        front: H(d('M', -54, -6, 'Q', -60, -56, -18, -63, 'Q', -4, -78, 20, -72, 'Q', 52, -64, 54, -6, 'Q', 50, -28, 40, -34, 'Q', 22, -30, 10, -44, 'Q', -6, -32, -28, -36, 'Q', -46, -28, -54, -6, 'Z'))
          + line(d('M', -6, -66, 'Q', 8, -62, 14, -50), 3 * k, 0.5),
      }
      if (view === 'side') return { ...none,
        front: H(d('M', 50, -22, 'Q', 66, -54, 40, -70, 'Q', 10, -78, -10, -64, 'Q', -60, -62, -58, -4, 'Q', -58, 14, -50, 24, 'Q', -38, 26, -30, 18, 'Q', -27, -4, -16, -18, 'Q', 18, -26, 40, -38, 'Q', 46, -30, 50, -22, 'Z')),
      }
      return { ...none,
        back: H(d('M', -58, 4, 'Q', -62, -64, 0, -66, 'Q', 62, -64, 58, 4, 'Q', 56, 32, 44, 38, 'Q', 0, 44, -44, 38, 'Q', -56, 32, -58, 4, 'Z'))
          + strands([d('M', -30, 32, 'Q', -26, -30, 0, -60), d('M', 26, 20, 'Q', 28, -24, 12, -58)], k),
      }
    }
    case 'bob': {
      if (view === 'front') {
        const lock = (s: number) => H(d('M', s * 52, -14, 'Q', s * 64, 10, s * 62, 40, 'Q', s * 52, 48, s * 42, 40, 'Q', s * 50, 18, s * 46, -10, 'Z'))
        return { ...none, coversEars: true,
          back: H(d('M', -62, 34, 'Q', -72, -62, 0, -64, 'Q', 72, -62, 62, 34, 'Q', 62, 44, 52, 44, 'L', -52, 44, 'Q', -62, 44, -62, 34, 'Z')),
          front: H(d('M', -54, 6, 'Q', -60, -56, 0, -58, 'Q', 60, -54, 55, -2, 'Q', 50, -32, 18, -40, 'Q', -12, -34, -30, -18, 'Q', -44, -6, -54, 6, 'Z')) + lock(-1) + lock(1),
        }
      }
      if (view === 'side') return { ...none, coversEars: true,
        front: H(d('M', 50, -20, 'Q', 54, -64, 0, -64, 'Q', -66, -62, -66, -2, 'Q', -68, 30, -60, 42, 'Q', -40, 50, -4, 44, 'Q', 2, 30, 0, 14, 'Q', -2, -6, 8, -18, 'Q', 28, -24, 38, -36, 'Q', 46, -28, 50, -20, 'Z'))
          + strands([d('M', -40, 38, 'Q', -48, 0, -26, -40), d('M', -14, 40, 'Q', -20, 10, -6, -20)], k),
      }
      return { ...none,
        back: H(d('M', -64, 32, 'Q', -72, -64, 0, -64, 'Q', 72, -64, 64, 32, 'Q', 64, 46, 50, 46, 'Q', 0, 50, -50, 46, 'Q', -64, 46, -64, 32, 'Z'))
          + strands([d('M', -30, 40, 'Q', -34, -10, -6, -56), d('M', 30, 40, 'Q', 34, -10, 6, -56)], k),
      }
    }
    case 'slick': {
      if (view === 'front') return { ...none,
        back: H(d('M', -58, 0, 'Q', -62, -60, 0, -62, 'Q', 62, -60, 58, 0, 'Z')),
        front: H(d('M', -54, -8, 'Q', -58, -60, 0, -62, 'Q', 58, -60, 54, -8, 'Q', 52, -26, 44, -33, 'Q', 22, -42, 0, -42, 'Q', -22, -42, -44, -33, 'Q', -52, -26, -54, -8, 'Z'))
          + strands([d('M', -30, -40, 'Q', -20, -54, 0, -58), d('M', 10, -42, 'Q', 22, -54, 36, -52)], k),
      }
      if (view === 'side') return { ...none,
        front: H(d('M', 46, -32, 'Q', 40, -62, -4, -62, 'Q', -58, -60, -58, -6, 'Q', -58, 12, -52, 20, 'Q', -40, 22, -32, 14, 'Q', -27, -10, -14, -22, 'Q', 16, -36, 46, -32, 'Z'))
          + strands([d('M', 38, -40, 'Q', 0, -54, -40, -36), d('M', 20, -32, 'Q', -10, -40, -36, -22)], k),
      }
      return { ...none,
        back: H(d('M', -58, 0, 'Q', -62, -62, 0, -62, 'Q', 62, -62, 58, 0, 'Q', 56, 30, 44, 36, 'Q', 0, 42, -44, 36, 'Q', -56, 30, -58, 0, 'Z'))
          + strands([d('M', -20, 32, 'Q', -24, -20, -10, -56), d('M', 20, 20, 'Q', 24, -20, 10, -56)], k),
      }
    }
    case 'cropped': {
      if (view === 'front') return { ...none,
        front: H(d('M', -54, -4, 'Q', -57, -30, -46, -40, 'L', 46, -40, 'Q', 57, -30, 54, -4, 'Q', 50, -18, 44, -26, 'L', -44, -26, 'Q', -50, -18, -54, -4, 'Z')),
      }
      if (view === 'side') return { ...none,
        front: H(d('M', 44, -30, 'Q', 44, -48, 0, -48, 'Q', -58, -48, -58, -4, 'Q', -58, 12, -52, 20, 'Q', -40, 22, -32, 14, 'Q', -28, -8, -16, -20, 'Q', 20, -26, 44, -30, 'Z')),
      }
      return { ...none,
        back: H(d('M', -58, -4, 'Q', -60, -50, 0, -50, 'Q', 60, -50, 58, -4, 'Q', 56, 28, 44, 34, 'Q', 0, 40, -44, 34, 'Q', -56, 28, -58, -4, 'Z')),
      }
    }
    case 'long': {
      const band = (p0: [number, number], p1: [number, number], p2: [number, number]) =>
        shape(tube({ x: p0[0], y: p0[1] }, { x: p1[0], y: p1[1] }, { x: p2[0], y: p2[1] }, 5), acc)
      if (view === 'front') {
        const lock = (s: number) => H(d('M', s * 50, -16, 'Q', s * 66, 20, s * 64, 76, 'Q', s * 56, 86, s * 44, 80, 'Q', s * 50, 40, s * 44, 0, 'Z'))
        return { coversEars: true,
          far: H(d('M', -64, 60, 'Q', -76, -60, 0, -64, 'Q', 76, -60, 64, 60, 'Q', 64, 86, 50, 92, 'L', -50, 92, 'Q', -64, 86, -64, 60, 'Z')),
          back: '',
          front: H(d('M', -54, 4, 'Q', -60, -56, 0, -58, 'Q', 60, -56, 54, 4, 'Q', 48, -22, 30, -36, 'Q', 14, -28, 4, -46, 'Q', -10, -26, -34, -30, 'Q', -48, -16, -54, 4, 'Z'))
            + lock(-1) + lock(1) + band([-52, -26], [0, -76], [52, -26]),
        }
      }
      if (view === 'side') return { coversEars: false,
        far: H(d('M', -10, -54, 'Q', -72, -50, -66, 30, 'Q', -64, 70, -58, 94, 'Q', -40, 100, -18, 92, 'Q', -20, 60, -24, 40, 'Z')),
        back: '',
        front: H(d('M', 50, -20, 'Q', 54, -64, 0, -64, 'Q', -64, -62, -64, -2, 'Q', -64, 40, -56, 62, 'Q', -44, 68, -34, 58, 'Q', -28, 30, -28, 8, 'Q', -26, -10, -12, -20, 'Q', 20, -26, 36, -36, 'Q', 44, -28, 50, -20, 'Z'))
          + band([40, -46], [-4, -76], [-38, -46]),
      }
      return { ...none,
        back: H(d('M', -62, 60, 'Q', -74, -62, 0, -64, 'Q', 74, -62, 62, 60, 'Q', 62, 88, 50, 94, 'Q', 0, 100, -50, 94, 'Q', -62, 88, -62, 60, 'Z'))
          + strands([d('M', -30, 86, 'Q', -36, 20, -10, -50), d('M', 30, 86, 'Q', 36, 20, 10, -50), d('M', 0, 90, 'L', 0, 10)], k)
          + band([-56, -30], [0, -74], [56, -30]),
      }
    }
    case 'curly': {
      const top = ellipsePoints(0, -18, 64, 54, 168, 372, 11)
      if (view === 'front') return { ...none,
        back: H(bumps(top, 15) + d('Q', 0, 30, top[0][0], top[0][1], 'Z')),
        front: H(bumps(ellipsePoints(0, -20, 58, 44, 175, 365, 9), 13) + bumps([[56, -8], [44, -26], [28, -24], [12, -30], [-6, -26], [-22, -30], [-38, -24], [-50, -26], [-57, -8]], 9, 1).replace('M', 'L') + 'Z'),
      }
      if (view === 'side') {
        const pts = ellipsePoints(-6, -20, 60, 52, 150, 352, 10)
        return { ...none,
          front: H(bumps(pts, 14) + bumps([[52, -26], [38, -28], [22, -26], [6, -22], [-12, -20], [-24, -6], [-28, 10], [-38, 22], [-52, 18]], 9, 1).replace('M', 'L') + 'Z'),
        }
      }
      const pts = ellipsePoints(0, -10, 64, 50, 160, 380, 12)
      return { ...none, back: H(bumps(pts, 15) + bumps(ellipsePoints(0, -10, 58, 40, 20, 160, 6), 12, 1).replace('M', 'L') + 'Z') }
    }
  }
}

/** Hats sit on top of everything in the head. */
export function hat(spec: CharacterSpec, view: View, k: number): string {
  if (!spec.hat) return ''
  return group('hat', hatShape(spec.hat.id, spec.hat.color, spec.hat.band ?? '#231942', view, k), { transform: `translate(0 ${spec.hat.id === 'cap' ? -6 : -8})` })
}

function hatShape(id: HatId, c: string, band: string, view: View, k: number): string {
  if (id === 'cap') {
    if (view === 'front') return [
      shape(d('M', -57, -28, 'Q', -60, -80, 0, -82, 'Q', 60, -80, 57, -28, 'Z'), c),
      line(d('M', 0, -82, 'L', 0, -36), 3 * k, 0.4),
      shape(d('M', -48, -36, 'Q', 0, -48, 48, -36, 'Q', 54, -24, 44, -18, 'Q', 0, -30, -44, -18, 'Q', -54, -24, -48, -36, 'Z'), c),
      circle(0, -82, 5, c, { sw: 3 * k }),
    ].join('')
    if (view === 'side') return [
      shape(d('M', 48, -24, 'Q', 52, -80, -4, -80, 'Q', -60, -78, -60, -22, 'Z'), c),
      shape(d('M', 42, -30, 'Q', 70, -32, 86, -24, 'Q', 90, -16, 80, -14, 'Q', 62, -18, 42, -18, 'Z'), c),
      circle(-4, -80, 5, c, { sw: 3 * k }),
    ].join('')
    return [
      shape(d('M', -57, -26, 'Q', -60, -80, 0, -82, 'Q', 60, -80, 57, -26, 'Z'), c),
      line(d('M', 0, -82, 'L', 0, -26), 3 * k, 0.4),
      shape(d('M', -14, -30, 'Q', -14, -40, 0, -40, 'Q', 14, -40, 14, -30, 'Z'), '#FFFFFF', { sw: 3 * k }),
      circle(0, -82, 5, c, { sw: 3 * k }),
    ].join('')
  }
  // driver's peaked cap
  if (view === 'front') return [
    shape(d('M', -54, -38, 'Q', -72, -66, -30, -78, 'Q', 0, -84, 30, -78, 'Q', 72, -66, 54, -38, 'Z'), c),
    shape(d('M', -52, -42, 'L', 52, -42, 'L', 50, -28, 'L', -50, -28, 'Z'), band),
    shape(d('M', -48, -30, 'Q', 0, -38, 48, -30, 'Q', 52, -20, 42, -17, 'Q', 0, -25, -42, -17, 'Q', -52, -20, -48, -30, 'Z'), '#2E2838'),
    circle(0, -58, 6, '#F2C14E', { sw: 3 * k }),
  ].join('')
  if (view === 'side') return [
    shape(d('M', 46, -38, 'Q', 60, -74, 8, -80, 'Q', -50, -82, -64, -60, 'Q', -66, -46, -56, -36, 'Z'), c),
    shape(d('M', -56, -42, 'L', 46, -40, 'L', 46, -28, 'L', -56, -30, 'Z'), band),
    shape(d('M', 40, -30, 'Q', 62, -30, 74, -22, 'Q', 76, -16, 68, -16, 'Q', 54, -20, 40, -18, 'Z'), '#2E2838'),
  ].join('')
  return [
    shape(d('M', -54, -38, 'Q', -72, -66, -30, -78, 'Q', 0, -84, 30, -78, 'Q', 72, -66, 54, -38, 'Z'), c),
    shape(d('M', -52, -42, 'L', 52, -42, 'L', 50, -28, 'L', -50, -28, 'Z'), band),
  ].join('')
}
