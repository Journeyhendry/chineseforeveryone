// Shared head construction: face, ears, eyes, brows, nose, mouth per expression, glasses, cheeks.
// Local coordinates: (0,0) is the face center; the face spans x -54..54, y -52..54 (same as the
// Mom reference drawing, translated). `k` = 1/headScale so outlines keep the same visual weight.
import { circle, d, ellipse, group, INK, line, shape } from './svg.ts'
import type { CharacterSpec, Expression } from './types.ts'

export const CHEEK = '#F28B82'
export const MOUTH = '#B23A3A'
export const MOUTH_DARK = '#8E2B2B'
export const TEAR = '#8FD3F4'
export const WHITE = '#FFFFFF'

export const FACE_FRONT = d('M', -54, -6, 'Q', -54, -52, 0, -52, 'Q', 54, -52, 54, -6, 'Q', 54, 50, 0, 54, 'Q', -54, 50, -54, -6, 'Z')

/** Profile facing right: forehead, nose bump, lips, chin, jaw, round back of skull. */
export const FACE_SIDE = d(
  'M', -50, -8,
  'Q', -52, -54, 0, -54,
  'Q', 46, -54, 51, -14,
  'Q', 53, -4, 52, 2,
  'Q', 62, 9, 61, 15,
  'Q', 60, 21, 51, 21,
  'Q', 53, 26, 50, 30,
  'Q', 52, 36, 46, 41,
  'Q', 38, 54, 16, 54,
  'Q', -18, 56, -36, 40,
  'Q', -52, 24, -50, -8, 'Z',
)

export function earsFront(skin: string, k: number): string {
  return group('ears', [ellipse(-56, 6, 10, 13, skin), ellipse(56, 6, 10, 13, skin), line(d('M', -58, 0, 'Q', -52, 6, -57, 12), 3 * k, 0.4), line(d('M', 58, 0, 'Q', 52, 6, 57, 12), 3 * k, 0.4)])
}

export function earSide(skin: string, k: number): string {
  return group('ears', [ellipse(-12, 6, 10, 13, skin), line(d('M', -9, 0, 'Q', -16, 5, -10, 12), 3 * k, 0.4)])
}

function cheeks(expr: Expression): string {
  const big = expr === 'happy' || expr === 'angry'
  const rx = big ? 13 : 12
  const ry = big ? 9 : 8
  const op = expr === 'angry' ? 0.75 : expr === 'happy' ? 0.65 : 0.55
  return group('cheeks', [ellipse(-34, 20, rx, ry, CHEEK, { stroke: false, opacity: op }), ellipse(34, 20, rx, ry, CHEEK, { stroke: false, opacity: op })])
}

function brows(expr: Expression, k: number): string {
  const sw = 3.5 * k
  switch (expr) {
    case 'happy':
      return group('brows', line(d('M', -36, -16, 'Q', -26, -24, -16, -18, 'M', 16, -18, 'Q', 26, -24, 36, -16), sw))
    case 'sad':
      return group('brows', line(d('M', -37, -10, 'Q', -26, -12, -17, -21, 'M', 17, -21, 'Q', 26, -12, 37, -10), sw))
    case 'surprised':
      return group('brows', line(d('M', -37, -19, 'Q', -27, -28, -16, -23, 'M', 16, -23, 'Q', 27, -28, 37, -19), sw))
    case 'angry':
      return group('brows', line(d('M', -38, -18, 'Q', -27, -16, -15, -7, 'M', 15, -7, 'Q', 27, -16, 38, -18), 4.5 * k))
    default:
      return group('brows', line(d('M', -36, -12, 'Q', -26, -18, -16, -13, 'M', 16, -13, 'Q', 26, -18, 36, -12), sw))
  }
}

function eyes(expr: Expression, k: number): string {
  const sh = { stroke: false } as const
  switch (expr) {
    case 'happy':
      return group('eyes', line(d('M', -32, 8, 'Q', -24, -3, -16, 8, 'M', 16, 8, 'Q', 24, -3, 32, 8), 4 * k))
    case 'sad':
      return group('eyes', [
        ellipse(-24, 6, 6, 7.5, INK, sh), ellipse(24, 6, 6, 7.5, INK, sh),
        circle(-25.5, 8, 2, WHITE, sh), circle(22.5, 8, 2, WHITE, sh),
      ])
    case 'surprised':
      return group('eyes', [
        ellipse(-24, 3, 8.5, 10.5, INK, sh), ellipse(24, 3, 8.5, 10.5, INK, sh),
        circle(-21, -1, 3, WHITE, sh), circle(27, -1, 3, WHITE, sh),
      ])
    case 'sleep':
      return group('eyes', line(d('M', -32, 4, 'Q', -24, 12, -16, 4, 'M', 16, 4, 'Q', 24, 12, 32, 4), 4 * k))
    case 'angry':
      return group('eyes', [
        shape(d('M', -31, -1, 'L', -17, 3, 'Q', -16, 13, -24, 13, 'Q', -32, 12, -31, -1, 'Z'), INK, sh),
        shape(d('M', 31, -1, 'L', 17, 3, 'Q', 16, 13, 24, 13, 'Q', 32, 12, 31, -1, 'Z'), INK, sh),
        circle(-21.5, 5, 1.8, WHITE, sh), circle(26.5, 5, 1.8, WHITE, sh),
      ])
    default:
      return group('eyes', [
        ellipse(-24, 4, 6.5, 8.5, INK, sh), ellipse(24, 4, 6.5, 8.5, INK, sh),
        circle(-21.5, 1, 2.2, WHITE, sh), circle(26.5, 1, 2.2, WHITE, sh),
      ])
  }
}

function mouth(expr: Expression, k: number): string {
  const sw = 3.5 * k
  switch (expr) {
    case 'happy':
      return group('mouth', [
        shape(d('M', -18, 28, 'Q', 0, 31, 18, 28, 'Q', 17, 50, 0, 50, 'Q', -17, 50, -18, 28, 'Z'), MOUTH_DARK, { stroke: false }),
        shape(d('M', -10, 45, 'Q', 0, 37, 10, 45, 'Q', 6, 50, 0, 50, 'Q', -6, 50, -10, 45, 'Z'), CHEEK, { stroke: false }),
        shape(d('M', -18, 28, 'Q', 0, 31, 18, 28, 'Q', 17, 50, 0, 50, 'Q', -17, 50, -18, 28, 'Z'), 'none', { sw }),
      ])
    case 'sad':
      return group('mouth', line(d('M', -12, 41, 'Q', 0, 31, 12, 41), sw))
    case 'surprised':
      return group('mouth', ellipse(0, 38, 8, 10, MOUTH_DARK, { sw }))
    case 'sleep':
      return group('mouth', ellipse(0, 36, 5, 6, MOUTH_DARK, { sw }))
    case 'angry':
      return group('mouth', [
        shape(d('M', -15, 34, 'Q', 0, 29, 15, 34, 'L', 14, 42, 'Q', 0, 38, -14, 42, 'Z'), WHITE, { sw }),
        line(d('M', -14, 38, 'Q', 0, 33.5, 14, 38), 2.5 * k),
      ])
    default:
      return group('mouth', shape(d('M', -14, 32, 'Q', 0, 44, 14, 32), MOUTH, { sw }))
  }
}

function tear(k: number): string {
  return group('tear', shape(d('M', -32, 14, 'Q', -25, 24, -27, 28, 'Q', -31, 32, -35, 28, 'Q', -38, 24, -32, 14, 'Z'), TEAR, { sw: 3 * k }))
}

function glassesFront(kind: string, k: number): string {
  const sw = 3.5 * k
  const lens = kind === 'round'
    ? [circle(-24, 4, 14, 'none', { sw }), circle(24, 4, 14, 'none', { sw })]
    : [
        shape(d('M', -40, -6, 'Q', -40, -9, -37, -9, 'L', -11, -9, 'Q', -8, -9, -8, -6, 'L', -9, 12, 'Q', -9, 16, -13, 16, 'L', -35, 16, 'Q', -39, 16, -39, 12, 'Z'), 'none', { sw }),
        shape(d('M', 40, -6, 'Q', 40, -9, 37, -9, 'L', 11, -9, 'Q', 8, -9, 8, -6, 'L', 9, 12, 'Q', 9, 16, 13, 16, 'L', 35, 16, 'Q', 39, 16, 39, 12, 'Z'), 'none', { sw }),
      ]
  const bridge = kind === 'round' ? d('M', -10, 2, 'Q', 0, -4, 10, 2) : d('M', -8, 0, 'Q', 0, -5, 8, 0)
  const arms = kind === 'round' ? d('M', -38, 1, 'L', -53, -3, 'M', 38, 1, 'L', 53, -3) : d('M', -40, -3, 'L', -53, -4, 'M', 40, -3, 'L', 53, -4)
  return group('glasses', [...lens, line(bridge, sw), line(arms, sw)])
}

function mustacheFront(color: string, k: number): string {
  return group('mustache', shape(d('M', 0, 24, 'Q', -8, 20, -17, 23, 'Q', -24, 26, -24, 31, 'Q', -14, 28, -8, 30, 'Q', -2, 31, 0, 28, 'Q', 2, 31, 8, 30, 'Q', 14, 28, 24, 31, 'Q', 24, 26, 17, 23, 'Q', 8, 20, 0, 24, 'Z'), color, { sw: 3 * k }))
}

export function nose(k: number): string {
  return group('nose', line(d('M', 0, 10, 'Q', -3, 20, 2, 22), 3 * k, 0.4))
}

/** Front face features in back-to-front order. */
export function faceFront(spec: CharacterSpec, expr: Expression, k: number): string {
  return [
    cheeks(expr),
    brows(expr, k),
    eyes(expr, k),
    nose(k),
    mouth(expr, k),
    spec.mustache ? mustacheFront(spec.mustache, k) : '',
    expr === 'sad' ? tear(k) : '',
    spec.senior ? group('wrinkles', line(d('M', -39, -3, 'L', -34, 0, 'M', -39, 8, 'L', -34, 6, 'M', 39, -3, 'L', 34, 0, 'M', 39, 8, 'L', 34, 6), 2.5 * k, 0.45)) : '',
    spec.glasses ? glassesFront(spec.glasses, k) : '',
  ].join('')
}

/** Profile features (neutral), facing right. */
export function faceSide(spec: CharacterSpec, k: number): string {
  const sh = { stroke: false } as const
  const out = [
    group('cheeks', ellipse(26, 22, 11, 7, CHEEK, { stroke: false, opacity: 0.55 })),
    group('brows', line(d('M', 22, -15, 'Q', 31, -20, 41, -15), 3.5 * k)),
    group('eyes', [ellipse(33, 3, 5.5, 8.5, INK, sh), circle(35, 0, 2, WHITE, sh)]),
    group('mouth', shape(d('M', 37, 33, 'Q', 44, 39, 50, 33), MOUTH, { sw: 3.5 * k })),
  ]
  if (spec.senior) out.push(group('wrinkles', line(d('M', 21, -3, 'L', 25, 0, 'M', 21, 8, 'L', 25, 6), 2.5 * k, 0.45)))
  if (spec.mustache) {
    out.push(group('mustache', shape(d('M', 52, 23, 'Q', 46, 21, 38, 24, 'Q', 32, 27, 33, 31, 'Q', 42, 29, 48, 30, 'Q', 54, 29, 52, 23, 'Z'), spec.mustache, { sw: 3 * k })))
  }
  if (spec.glasses) {
    const sw = 3.5 * k
    const lens = spec.glasses === 'round'
      ? [ellipse(36, 3, 10, 13, 'none', { sw })]
      : [
          shape(d('M', 26, -8, 'L', 45, -8, 'Q', 47, -8, 47, -6, 'L', 46, 13, 'Q', 46, 15, 44, 15, 'L', 28, 15, 'Q', 26, 15, 26, 13, 'Z'), 'none', { sw }),
        ]
    out.push(group('glasses', [...lens, line(d('M', 26, -1, 'L', -4, -2), sw)]))
  }
  return out.join('')
}
