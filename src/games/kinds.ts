// Jenis game per unit (task 7). Nama = segmen rute: #/belajar/unit/<id>/game/<jenis>.
export const GAME_KINDS = ['kartu', 'jodohkan', 'nada', 'susun'] as const
export type GameKind = (typeof GAME_KINDS)[number]

export function isGameKind(s: string): s is GameKind {
  return (GAME_KINDS as readonly string[]).includes(s)
}

/**
 * Game penutup di layar nilai latihan ("satu game singkat"): bergiliran per unit, deterministik.
 * Unit ber-order ganjil -> jodohkan, genap -> kartu (keduanya game pendek).
 */
export function closingGame(unitOrder: number): GameKind {
  return Math.abs(Math.trunc(unitOrder)) % 2 === 1 ? 'jodohkan' : 'kartu'
}
