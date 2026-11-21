import type { Bilingual, LessonWord } from '../../lib/lessons'
import { cleanEn, meaningShort } from '../../lib/quiz'
import type { Lang } from '../../lib/settings'
import { splitSyllables } from '../../lib/pinyin'

export const pick = (b: Bilingual, lang: Lang) => b[lang]

/** Arti lengkap kata di bahasa tertentu. */
export function meaningFull(w: Pick<LessonWord, 'en' | 'ind'>, lang: Lang): string {
  if (lang === 'id') return w.ind.join(', ')
  return w.en.slice(0, 2).map(cleanEn).join('; ')
}

export { meaningShort }

/** Pinyin (boleh berspasi) -> kata -> suku kata, untuk pewarnaan. */
export function pinyinWords(pinyin: string): string[][] {
  return pinyin
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => {
      const s = splitSyllables(p)
      return s.length ? s : [p]
    })
}

export const tatoebaUrl = (id: number) => `https://tatoeba.org/sentences/show/${id}`

export const EVIDENCE_NAMES: Record<string, string> = {
  cedict: 'CC-CEDICT',
  wiktionary: 'Wiktionary',
  tatoeba: 'Tatoeba',
}
