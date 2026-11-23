import type { LessonUnitInfo, UnitData } from '../../../lib/lessons'
import type { Stars } from '../../../lib/progress'

export interface GameResult {
  stars: Stars
  /** Baris skor utama (mis. "Benar 8 dari 10"). */
  score: string
  detail?: string
  /** Aturan bintang singkat. */
  rule: string
}

export interface GameProps {
  /** Nomor main (0, 1, ...); berganti = state baru penuh. */
  play: number
  info: LessonUnitInfo
  data: UnitData
  unitName: string
  onFinish: (r: GameResult) => void
}

export const newSeed = () => Math.floor(Math.random() * 0x7fffffff)
