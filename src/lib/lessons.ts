// Pemuat file pelajaran untuk UI. File dimuat lewat fetch supaya data besar tidak ikut bundle JavaScript.
export type * from './lesson-types.ts'
import type { LessonIndex, UnitData } from './lesson-types.ts'

// ---------- pemuat (UI) ----------

const cache = new Map<string, Promise<unknown>>()

function dataUrl(path: string): string {
  return `${import.meta.env.BASE_URL}data/hsk1/${path}`
}

function loadJson<T>(path: string): Promise<T> {
  const hit = cache.get(path)
  if (hit) return hit as Promise<T>
  const p = fetch(dataUrl(path)).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return r.json() as Promise<T>
  })
  // Gagal -> boleh dicoba lagi.
  p.catch(() => cache.delete(path))
  cache.set(path, p)
  return p
}

export const loadIndex = () => loadJson<LessonIndex>('index.json')
export const loadUnit = (unitId: string) => loadJson<UnitData>(`units/${encodeURIComponent(unitId)}.json`)
