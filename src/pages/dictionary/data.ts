import { useMemo } from 'react'
import { buildDictionaryIndex, type DictWord } from '../../lib/dictionary'
import type { LessonWord } from '../../lib/lessons'
import type { WordBank } from '../learn/hooks'

/** Kata pelajaran + kolom yang dibutuhkan kamus. */
export type DictEntry = LessonWord & DictWord

export function toEntries(bank: WordBank): DictEntry[] {
  return bank.index.units.flatMap((u, i) =>
    (bank.groups[i] ?? []).map((w, j) => ({ ...w, unitId: u.id, unitOrder: u.order, indexInUnit: j + 1 })),
  )
}

export function useDictionaryData(bank: WordBank) {
  return useMemo(() => {
    const entries = toEntries(bank)
    return {
      entries,
      index: buildDictionaryIndex(entries),
      byId: new Map(entries.map((e) => [e.id.toUpperCase(), e] as const)),
    }
  }, [bank])
}
