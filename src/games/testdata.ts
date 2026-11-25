// Data tes bersama: kata & unit dari file pelajaran yang sudah dibangun (public/data/hsk1).
import { readdirSync, readFileSync } from 'node:fs'
import type { UnitData } from '../lib/lesson-types.ts'

const dir = new URL('../../public/data/hsk1/units/', import.meta.url)
export const UNITS: UnitData[] = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .sort()
  .map((f) => JSON.parse(readFileSync(new URL(f, dir), 'utf8')) as UnitData)
export const ALL_WORDS = UNITS.flatMap((u) => u.words)
