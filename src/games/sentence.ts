// Susun kalimat: potong kalimat jadi potongan kata, acak, cek jawaban. Fungsi murni.
import type { Example, LessonDialog } from '../lib/lesson-types.ts'
import { mulberry32, shuffle } from '../lib/quiz.ts'

export const SENTENCE_QUESTIONS = 5
export const MIN_PIECES = 3
export const MAX_PIECES = 7

export interface Piece {
  /** Huruf potongan (tanda baca di tengah kalimat ikut potongan sebelumnya). */
  text: string
  /** Pinyin kata (null bila tidak diketahui). */
  pinyin: string | null
}

export interface TatoebaRef {
  tatoebaId: number
  author: string
  license: string
}

export interface GameSentence {
  /** Kunci unik: `t:<tatoebaId>` atau `d:<dialogId>:<baris>`. */
  key: string
  /** Kalimat tanpa tanda baca akhir. */
  text: string
  /** Kalimat asli (dengan tanda baca akhir). */
  cmn: string
  pieces: Piece[]
  /** Terjemahan; null bila tidak ada di bahasa itu. */
  tr: { id: string | null; en: string | null }
  /** Terjemahan Indonesia buatan mesin (dialog). */
  machine: boolean
  /** Atribusi bila dari Tatoeba (plus terjemahannya). */
  tatoeba: (TatoebaRef & { trId: TatoebaRef | null; trEn: TatoebaRef | null }) | null
}

const PUNCT = /[\p{P}\p{S}\s]/u

/** Kamus untuk pemotong: hanzi kata -> pinyin. */
export type Lexicon = Map<string, string>

export function buildLexicon(words: Iterable<{ hanzi: string; pinyin: string }>): Lexicon {
  const lex: Lexicon = new Map()
  for (const w of words) if (w.hanzi && !lex.has(w.hanzi)) lex.set(w.hanzi, w.pinyin)
  return lex
}

/** Buang tanda baca / spasi di akhir kalimat. */
export function stripEnd(text: string): string {
  const chars = [...text.trim()]
  while (chars.length && PUNCT.test(chars[chars.length - 1])) chars.pop()
  return chars.join('')
}

/**
 * Pemotong longest-match terhadap kata HSK 1. Huruf yang bukan bagian kata mana pun jadi potongan
 * 1 huruf (`known: false`). Tanda baca akhir dibuang; tanda baca di tengah ikut potongan sebelumnya.
 */
export function tokenize(text: string, lex: Lexicon): { pieces: Piece[]; unknown: number } {
  const chars = [...stripEnd(text)]
  let maxLen = 1
  for (const k of lex.keys()) maxLen = Math.max(maxLen, [...k].length)
  const pieces: Piece[] = []
  let unknown = 0
  let i = 0
  while (i < chars.length) {
    if (PUNCT.test(chars[i])) {
      if (pieces.length) pieces[pieces.length - 1] = { ...pieces[pieces.length - 1], text: pieces[pieces.length - 1].text + chars[i] }
      i++
      continue
    }
    let hit = false
    for (let len = Math.min(maxLen, chars.length - i); len >= 1; len--) {
      const s = chars.slice(i, i + len).join('')
      const py = lex.get(s)
      if (py !== undefined) {
        pieces.push({ text: s, pinyin: py })
        i += len
        hit = true
        break
      }
    }
    if (!hit) {
      pieces.push({ text: chars[i], pinyin: null })
      unknown++
      i++
    }
  }
  return { pieces, unknown }
}

/** Potongan dari token dialog (sudah dipotong di data): token tanpa pinyin = tanda baca. */
export function piecesFromTokens(tokens: readonly { text: string; pinyin?: string }[]): Piece[] {
  const out: Piece[] = []
  tokens.forEach((tk, i) => {
    const rest = tokens.slice(i + 1)
    const isPunct = !tk.pinyin && [...tk.text].every((c) => PUNCT.test(c))
    if (isPunct) {
      // Tanda baca akhir dibuang; di tengah ikut potongan sebelumnya.
      const trailing = rest.every((r) => !r.pinyin && [...r.text].every((c) => PUNCT.test(c)))
      if (!trailing && out.length) out[out.length - 1] = { ...out[out.length - 1], text: out[out.length - 1].text + tk.text }
      return
    }
    out.push({ text: tk.text, pinyin: tk.pinyin ?? null })
  })
  return out
}

const joined = (pieces: readonly Piece[]) => pieces.map((p) => p.text).join('')

/** Bisa diacak menjadi urutan yang berbeda (bukan semua potongan sama)? */
const scramblable = (pieces: readonly Piece[]) => new Set(pieces.map((p) => p.text)).size > 1

const usable = (pieces: Piece[]) => pieces.length >= MIN_PIECES && pieces.length <= MAX_PIECES && scramblable(pieces) && pieces.every((p) => p.pinyin !== null)

/**
 * Kalimat unit: contoh Tatoeba milik kata-kata unit (hanya `outside === null`, semua potongan kata
 * HSK 1, punya terjemahan) + baris dialog unit. 3-7 potongan, unik per teks.
 */
export function collectSentences(unit: { words: readonly { examples: readonly Example[] }[]; dialog: LessonDialog | null }, lex: Lexicon): GameSentence[] {
  const out: GameSentence[] = []
  const seen = new Set<string>()
  for (const w of unit.words) {
    for (const ex of w.examples) {
      if (ex.outside !== null || (!ex.en && !ex.ind)) continue
      const text = stripEnd(ex.cmn)
      if (seen.has(text)) continue
      const { pieces, unknown } = tokenize(ex.cmn, lex)
      if (unknown > 0 || !usable(pieces)) continue
      seen.add(text)
      const ref = (r: { tatoebaId: number; author: string; license: string } | null) => (r ? { tatoebaId: r.tatoebaId, author: r.author, license: r.license } : null)
      out.push({
        key: `t:${ex.tatoebaId}`,
        text,
        cmn: ex.cmn,
        pieces,
        tr: { id: ex.ind?.text ?? null, en: ex.en?.text ?? null },
        machine: false,
        tatoeba: { tatoebaId: ex.tatoebaId, author: ex.author, license: ex.license, trId: ref(ex.ind), trEn: ref(ex.en) },
      })
    }
  }
  unit.dialog?.lines.forEach((line, i) => {
    const pieces = piecesFromTokens(line.tokens)
    const text = joined(pieces)
    if (seen.has(text) || !usable(pieces) || stripEnd(line.cmn) !== text) return
    seen.add(text)
    out.push({
      key: `d:${unit.dialog!.id}:${i}`,
      text,
      cmn: line.cmn,
      pieces,
      tr: { id: line.id || null, en: line.en || null },
      machine: line.machine,
      tatoeba: null,
    })
  })
  return out
}

export interface SentenceQuestion {
  sentence: GameSentence
  /** Urutan potongan di "bank" (indeks ke sentence.pieces); tidak pernah sama dengan urutan benar. */
  bank: number[]
}

/** Acak potongan sampai hasilnya berbeda dari kalimat benar (string huruf berbeda). */
export function scramble(pieces: readonly Piece[], rng: () => number): number[] {
  const idx = pieces.map((_, i) => i)
  if (!scramblable(pieces)) return idx
  const target = joined(pieces)
  for (let tries = 0; tries < 50; tries++) {
    const order = shuffle(idx, rng)
    if (order.map((i) => pieces[i].text).join('') !== target) return order
  }
  // Cadangan pasti: putar satu langkah sampai berbeda.
  for (let k = 1; k < idx.length; k++) {
    const order = [...idx.slice(k), ...idx.slice(0, k)]
    if (order.map((i) => pieces[i].text).join('') !== target) return order
  }
  return idx
}

export function buildSentenceGame(sentences: readonly GameSentence[], opts: { seed: number; count?: number }): SentenceQuestion[] {
  const rng = mulberry32(opts.seed)
  const count = Math.max(1, opts.count ?? SENTENCE_QUESTIONS)
  return shuffle(sentences, rng)
    .slice(0, count)
    .map((sentence) => ({ sentence, bank: scramble(sentence.pieces, rng) }))
}

/** Benar bila string huruf sama dengan kalimat asli (urutan potongan kembar mana pun diterima). */
export function isSentenceCorrect(sentence: GameSentence, answer: readonly number[]): boolean {
  if (answer.length !== sentence.pieces.length) return false
  if (new Set(answer).size !== answer.length) return false
  return answer.map((i) => sentence.pieces[i]?.text ?? '\u0000').join('') === joined(sentence.pieces)
}

// ---------- baris jawaban (state murni) ----------

/** Masukkan potongan ke jawaban di posisi `at` (bawaan: akhir). Bila sudah ada, dipindah. */
export function placePiece(answer: readonly number[], piece: number, at?: number): number[] {
  const rest = answer.filter((p) => p !== piece)
  const pos = at === undefined ? rest.length : Math.max(0, Math.min(rest.length, at))
  return [...rest.slice(0, pos), piece, ...rest.slice(pos)]
}

export const removePiece = (answer: readonly number[], piece: number): number[] => answer.filter((p) => p !== piece)

export const removeLast = (answer: readonly number[]): number[] => answer.slice(0, -1)
