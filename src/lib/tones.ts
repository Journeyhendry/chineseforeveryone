// Pemetaan huruf -> nada untuk pewarnaan hanzi dan pinyin (fungsi murni).
import { syllableTone, type Tone } from './pinyin.ts'

const isErhua = (syllable: string | undefined) => syllable !== undefined && syllable.toLowerCase() === 'r'

/**
 * Nada tiap huruf (null = tidak diwarnai).
 * - Jumlah huruf = jumlah suku kata: huruf ke-i memakai nada suku kata ke-i.
 * - Huruf terakhir 儿 dengan suku kata erhua ("r" terpisah, atau suku kata terakhir berakhiran r):
 *   memakai nada suku kata sebelumnya / suku kata yang memuat r itu.
 * - Selain itu: tidak diwarnai.
 */
export function charTones(hanzi: string, syllables: string[]): (Tone | null)[] {
  const chars = [...hanzi]
  const tones = syllables.map(syllableTone)
  const last = chars.length - 1
  if (chars.length >= 2 && chars[last] === '儿') {
    if (chars.length === syllables.length && isErhua(syllables[last])) {
      return chars.map((_, i) => (i === last ? tones[last - 1] : tones[i]))
    }
    if (chars.length === syllables.length + 1 && /r$/i.test(syllables[syllables.length - 1] ?? '')) {
      return chars.map((_, i) => (i === last ? tones[last - 1] : tones[i]))
    }
  }
  if (chars.length === syllables.length) return tones
  return chars.map(() => null)
}

/** Nada untuk mewarnai tiap suku kata pinyin; suku kata erhua "r" ikut nada sebelumnya. */
export function syllableColors(syllables: string[]): Tone[] {
  const tones = syllables.map(syllableTone)
  return tones.map((t, i) => (i > 0 && isErhua(syllables[i]) ? tones[i - 1] : t))
}

/** Isi lencana nada: suku kata hanya ditampilkan bila pinyin boleh tampil. */
export function toneBadge(syllable: string, showPinyin: boolean): { pinyin: string | null; tone: Tone } {
  return { pinyin: showPinyin ? syllable : null, tone: syllableTone(syllable) }
}
