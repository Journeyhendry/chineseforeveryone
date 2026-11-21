// Pinyin helpers: split tone-marked pinyin into syllables, read tones, convert to
// numbered form. Pure functions, no dependencies (used by the data build script and the app).
//
// Conventions
// - Tone 5 = neutral tone (no mark). The erhua suffix "r" is its own syllable with tone 5.
// - Numbered form writes ü as "v" (nǚ -> nv3, lǜ -> lv4), tone digit always explicit (ma -> ma5).

export type Tone = 1 | 2 | 3 | 4 | 5

const TONE_MARKS: Record<string, Tone> = {
  '\u0304': 1, // macron
  '\u0301': 2, // acute
  '\u030c': 3, // caron
  '\u0300': 4, // grave
}
const DIAERESIS = '\u0308'
const VOWELS = new Set(['a', 'e', 'i', 'o', 'u', 'ü'])

interface Letter {
  /** Original character (with tone mark, original case). */
  raw: string
  /** Lowercase base letter without tone mark; ü stays ü ("v" is read as ü). */
  base: string
  tone: Tone | 0
}

function readLetters(text: string): Letter[] {
  const out: Letter[] = []
  for (const ch of text.normalize('NFC')) {
    const parts = [...ch.normalize('NFD')]
    let base = parts[0].toLowerCase()
    let tone: Tone | 0 = 0
    for (const mark of parts.slice(1)) {
      if (mark === DIAERESIS) base = base === 'u' ? 'ü' : base
      else if (mark in TONE_MARKS) tone = TONE_MARKS[mark]
    }
    if (base === 'v') base = 'ü'
    out.push({ raw: ch, base, tone })
  }
  return out
}

const isLetter = (l: Letter | undefined): l is Letter => l !== undefined && /^[a-zü]$/.test(l.base)
const isVowel = (l: Letter | undefined): boolean => l !== undefined && VOWELS.has(l.base)

/**
 * Split tone-marked pinyin into syllables. Spaces, hyphens and apostrophes are separators
 * (and are dropped). Case is preserved. Erhua "r" comes out as its own syllable.
 * Examples: "àihào" -> ["ài","hào"]; "xī'ān" -> ["xī","ān"]; "yìdiǎnr" -> ["yì","diǎn","r"].
 */
export function splitSyllables(toneMarked: string): string[] {
  const letters = readLetters(toneMarked)
  const syllables: string[] = []
  let i = 0
  while (i < letters.length) {
    if (!isLetter(letters[i])) {
      i++
      continue
    }
    const start = i
    const first = letters[i].base
    const second = letters[i + 1]?.base
    let hasInitial = false
    if (!VOWELS.has(first)) {
      hasInitial = true
      i += (first === 'z' || first === 'c' || first === 's') && second === 'h' ? 2 : 1
    }
    if (!isVowel(letters[i])) {
      // Initial with no vowel: erhua "r", or a stray consonant (ng, m, ...). Keep as is.
      syllables.push(letters.slice(start, i).map((l) => l.raw).join(''))
      continue
    }
    const nucleusStart = i
    while (isVowel(letters[i])) i++
    const nucleus = letters.slice(nucleusStart, i)
    if (!hasInitial && nucleus.length === 1 && nucleus[0].base === 'e' && letters[i]?.base === 'r' && !isVowel(letters[i + 1])) {
      i++ // syllable "er" (ér, èr...)
    } else if (letters[i]?.base === 'n') {
      const afterN = letters[i + 1]
      if (afterN?.base === 'g') {
        if (!isVowel(letters[i + 2])) i += 2 // "ng" coda
        else i += 1 // "n" + syllable starting with g
      } else if (!isVowel(afterN)) {
        i += 1
      }
    }
    syllables.push(letters.slice(start, i).map((l) => l.raw).join(''))
  }
  return syllables
}

/** Tone of one syllable (1-4 from the mark, 5 if no mark, including the erhua "r"). */
export function syllableTone(syllable: string): Tone {
  for (const l of readLetters(syllable)) if (l.tone) return l.tone
  return 5
}

/** Remove tone marks, keep ü (lǜ -> lü). Case is preserved. Useful for search. */
export function stripTones(text: string): string {
  return text.normalize('NFD').replace(/[\u0300\u0301\u0304\u030c]/g, '').normalize('NFC')
}

/** Numbered form of one syllable: ài -> ai4, lǜ -> lv4, ma -> ma5, Běi -> Bei3. */
export function toNumbered(syllable: string): string {
  const letters = readLetters(syllable).filter(isLetter)
  const body = letters.map((l) => (l.base === 'ü' ? (l.raw === l.raw.toUpperCase() ? 'V' : 'v') : stripTones(l.raw))).join('')
  return `${body}${syllableTone(syllable)}`
}

/** Convert a whole tone-marked string to space-separated numbered syllables. */
export function toNumberedString(toneMarked: string): string {
  return splitSyllables(toneMarked).map(toNumbered).join(' ')
}

/** Normalize CC-CEDICT style numbered pinyin ("Nu:3 er2") to our form ("nv3 er2"), lowercase. */
export function normalizeNumbered(numbered: string): string {
  return numbered.toLowerCase().replace(/u:/g, 'v').replace(/ü/g, 'v').trim().split(/\s+/).join(' ')
}
