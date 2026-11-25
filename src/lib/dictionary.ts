// Kamus: normalisasi pinyin, pencarian (hanzi / pinyin / arti), dan pembuat tautan "Lapor salah".
// Fungsi murni tanpa akses jaringan atau DOM.
import { splitSyllables, stripTones, syllableTone, type Tone } from './pinyin.ts'

export const REPO_URL = 'https://github.com/Journeyhendry/chineseforeveryone'
export const ISSUE_NEW_URL = `${REPO_URL}/issues/new`

export type DictLang = 'id' | 'en'
export type MatchedBy = 'hanzi' | 'pinyin' | 'meaning'

export interface DictWord {
  id: string
  hanzi: string
  pinyin: string
  syllables: string[]
  tones: Tone[]
  en: string[]
  ind: string[]
  unitId: string
  unitOrder: number
  /** Urutan kata dalam unit, mulai 1. */
  indexInUnit: number
}

export interface SearchResult<W extends DictWord = DictWord> {
  word: W
  matchedBy: MatchedBy
}

// ---------- pinyin ----------

/** Pinyin untuk dicari: huruf kecil, tanpa tanda nada, v / u: -> ü; spasi, apostrof, tanda hubung, angka nada dibuang. */
export function normalizePinyin(s: string): string {
  return stripTones(s.toLowerCase().replace(/u:/g, 'ü'))
    .replace(/v/g, 'ü')
    .replace(/[\s'’‘`\d-]/g, '')
}

interface QSyl {
  base: string
  /** null = nada tidak disebut. */
  tone: Tone | null
}

const hasMark = (syl: string) => stripTones(syl) !== syl

/** Pecah pinyin (bertanda nada dan/atau angka nada) menjadi suku kata; nada null bila tidak disebut. */
function parseSyllables(s: string): QSyl[] {
  const text = s.toLowerCase().replace(/u:/g, 'ü').replace(/v/g, 'ü').normalize('NFC')
  const out: QSyl[] = []
  for (const seg of text.split(/[\s'’‘`-]+/)) {
    for (const m of seg.matchAll(/([^\d]+)(\d?)/g)) {
      const syls = splitSyllables(m[1])
      syls.forEach((syl, i) => {
        let tone: Tone | null = hasMark(syl) ? syllableTone(syl) : null
        if (i === syls.length - 1 && m[2] !== '') tone = m[2] === '0' ? 5 : (Number(m[2]) as Tone)
        const base = normalizePinyin(syl)
        if (base) out.push({ base, tone })
      })
    }
  }
  return out
}

/**
 * Bentuk ber-angka tanpa spasi: nǐhǎo / ni3 hao3 -> ni3hao3. Nada ringan SELALU ditulis 5
 * (sama dengan src/lib/pinyin.ts): ma -> ma5, "ne0" -> ne5. Suku kata tanpa tanda/angka dianggap nada ringan.
 * ü tetap ü (nǚ -> nü3).
 */
export function toneKey(s: string): string {
  return parseSyllables(s)
    .map((x) => `${x.base}${x.tone ?? 5}`)
    .join('')
}

// ---------- teks arti ----------

/** Huruf kecil, tanda baca jadi spasi, diakritik dibuang ("(salam)" tetap bisa dicari). */
function normText(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

/** Buang catatan teknis CC-CEDICT: "您[nin2]" dan "|" pada hanzi. */
const cleanMeaning = (s: string) => s.replace(/\|[^\s[\],;()]+/g, '').replace(/\[[A-Za-z0-9: ]+\]/g, '')

interface Meaning {
  lang: DictLang
  text: string
  /** Tanpa isi kurung dan tanpa "to " / "a " di depan: untuk cocok persis. */
  bare: string
  /** Urutan arti dalam daftar bahasanya (0 = arti pertama / utama). */
  rank: number
  /** Jumlah arti di bahasanya: kata dengan sedikit arti lebih "tepat" daripada yang banyak arti. */
  total: number
}

function meaningsOf(w: DictWord): Meaning[] {
  const out: Meaning[] = []
  for (const [lang, list] of [['id', w.ind], ['en', w.en]] as const) {
    let rank = 0
    for (const raw of list) {
      for (const part of cleanMeaning(raw).split(/\s*;\s*/)) {
        const text = normText(part)
        if (!text) continue
        const bare = normText(part.replace(/\([^)]*\)/g, ' ')).replace(/^(to|a|an|the) /, '')
        out.push({ lang, text, bare: bare || text, rank: rank++, total: 0 })
      }
    }
  }
  for (const lang of ['id', 'en'] as const) {
    const mine = out.filter((m) => m.lang === lang)
    for (const m of mine) m.total = mine.length
  }
  return out
}

// ---------- indeks ----------

interface Entry<W extends DictWord> {
  word: W
  /** Pinyin tanpa nada dan tanpa pemisah. */
  plain: string
  /** Posisi awal tiap suku kata di `plain`. */
  starts: Set<number>
  syls: { base: string; tone: Tone }[]
  meanings: Meaning[]
}

export interface DictionaryIndex<W extends DictWord = DictWord> {
  entries: Entry<W>[]
}

export function buildDictionaryIndex<W extends DictWord>(words: W[]): DictionaryIndex<W> {
  const sorted = [...words].sort((a, b) => a.unitOrder - b.unitOrder || a.indexInUnit - b.indexInUnit)
  return {
    entries: sorted.map((word) => {
      const syls = word.syllables.map((s, i) => ({ base: normalizePinyin(s), tone: word.tones[i] ?? syllableTone(s) }))
      const starts = new Set<number>()
      let pos = 0
      for (const s of syls) {
        starts.add(pos)
        pos += s.base.length
      }
      return { word, plain: syls.map((s) => s.base).join(''), starts, syls, meanings: meaningsOf(word) }
    }),
  }
}

// ---------- pencarian ----------

const HAN = /\p{Script=Han}/u
export const DEFAULT_LIMIT = 50

/** 0 = persis, 1 = awalan, 2 = mengandung (pada batas suku kata). null = tidak cocok. */
type Level = 0 | 1 | 2 | null

function plainLevel<W extends DictWord>(e: Entry<W>, p: string): Level {
  if (e.plain === p) return 0
  if (e.plain.startsWith(p)) return 1
  for (const i of e.starts) if (i > 0 && e.plain.startsWith(p, i)) return 2
  return null
}

function toneLevel<W extends DictWord>(e: Entry<W>, q: QSyl[]): Level {
  let best: Level = null
  const last = q.length - 1
  for (let s = 0; s + q.length <= e.syls.length; s++) {
    let ok = true
    for (let k = 0; k <= last && ok; k++) {
      const w = e.syls[s + k]
      const x = q[k]
      if (x.tone !== null && x.tone !== w.tone) ok = false
      else if (k < last || x.tone !== null) ok = w.base === x.base
      else ok = w.base.startsWith(x.base)
    }
    if (!ok) continue
    const level: Level = s > 0 ? 2 : q.length === e.syls.length && e.syls[last].base === q[last].base ? 0 : 1
    if (best === null || level < best) best = level
    if (best === 0) break
  }
  return best
}

function meaningLevel(m: Meaning, q: string): Level {
  if (m.bare === q || m.text === q) return 0
  if (m.text.startsWith(`${q} `) || m.bare.startsWith(`${q} `) || m.text.startsWith(q)) return 1
  if (` ${m.text}`.includes(` ${q}`)) return 2
  return null
}

function hanziLevel(hanzi: string, q: string): Level {
  if (hanzi === q) return 0
  if (hanzi.startsWith(q)) return 1
  if (hanzi.includes(q)) return 2
  return null
}

/** Skor kecil = lebih relevan. Pinyin sebelum arti pada tingkat yang sama; arti bahasa lain sedikit di belakang; arti utama (urutan awal) sebelum arti sampingan. */
const score = (level: 0 | 1 | 2, kind: 'pinyin' | 'meaning', otherLang = false, rank = 0, total = 0) =>
  level * 2 + (kind === 'meaning' ? 1 : 0) + (otherLang ? 0.5 : 0) + Math.min(rank, 20) * 0.01 + Math.min(total, 10) * 0.0005

/**
 * Cari kata. Query kosong -> []. Hasil unik per kata, urut skor lalu urutan unit dan urutan kata.
 * - Ada huruf Han: cocokkan hanzi (persis > awalan > mengandung). Bila tidak ada yang cocok penuh:
 *   kata yang hanzi-nya termuat di query (mis. 你好吗 -> 你好, 你, 好, 吗), lalu kata yang memuat salah satu huruf query.
 * - Huruf Latin: pinyin (tanpa nada = semua nada; dengan tanda/angka nada = nada harus sama) dan arti ID + EN.
 */
export function searchDictionary<W extends DictWord>(
  index: DictionaryIndex<W>,
  query: string,
  lang: DictLang,
  limit: number = DEFAULT_LIMIT,
): SearchResult<W>[] {
  const raw = query.trim().normalize('NFC')
  if (!raw || limit <= 0) return []
  const hits: { entry: Entry<W>; score: number; matchedBy: MatchedBy; order: number }[] = []
  const entries = index.entries

  if (HAN.test(raw)) {
    const q = [...raw].filter((c) => HAN.test(c)).join('')
    entries.forEach((entry, order) => {
      const level = hanziLevel(entry.word.hanzi, q)
      if (level !== null) hits.push({ entry, score: level, matchedBy: 'hanzi', order })
    })
    if (hits.length === 0) {
      const chars = new Set(q)
      entries.forEach((entry, order) => {
        const h = entry.word.hanzi
        if (q.includes(h)) hits.push({ entry, score: 3 + 1 / (1 + h.length), matchedBy: 'hanzi', order })
        else if ([...h].some((c) => chars.has(c))) hits.push({ entry, score: 4, matchedBy: 'hanzi', order })
      })
    }
  } else {
    const plainQ = normalizePinyin(raw)
    const pinyinOk = /^[a-zü]+$/.test(plainQ) && /^[\p{L}\s'’\-:0-5]+$/u.test(raw)
    const qs = pinyinOk ? parseSyllables(raw) : []
    const toneAware = qs.some((x) => x.tone !== null)
    // Query bertanda/berangka nada, atau memuat ü / u:, jelas pinyin: tidak dicari di arti (lǜ tidak boleh cocok dengan "lumpur").
    const textQ = toneAware || /ü|u:/i.test(raw) ? '' : normText(raw)
    entries.forEach((entry, order) => {
      let best = Infinity
      let by: MatchedBy = 'pinyin'
      if (pinyinOk) {
        const level = toneAware ? toneLevel(entry, qs) : plainLevel(entry, plainQ)
        if (level !== null) best = score(level, 'pinyin')
      }
      if (textQ) {
        for (const m of entry.meanings) {
          const level = meaningLevel(m, textQ)
          if (level === null) continue
          const s = score(level, 'meaning', m.lang !== lang, m.rank, m.total)
          if (s < best) {
            best = s
            by = 'meaning'
          }
        }
      }
      if (best < Infinity) hits.push({ entry, score: best, matchedBy: by, order })
    })
  }

  hits.sort((a, b) => a.score - b.score || a.order - b.order)
  return hits.slice(0, limit).map((h) => ({ word: h.entry.word, matchedBy: h.matchedBy }))
}

// ---------- lapor salah ----------

export interface IssueWord {
  id: string
  hanzi: string
  pinyin: string
  en: string[]
  ind: string[]
  unitId?: string
  unitOrder?: number
}

export interface IssueInput {
  word?: IssueWord
  /** Dari layar mana laporan dibuat, mis. "Kamus" atau "Kenalan kata · Unit 2". */
  context: string
  pageUrl: string
  lang: DictLang
}

/** Batas aman panjang URL laporan (karakter). */
export const ISSUE_URL_MAX = 6000

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, Math.max(0, n - 1))}…` : s)

const ISSUE_TEXT = {
  id: {
    title: 'Lapor salah',
    word: 'Kata',
    pinyin: 'Pinyin',
    meaningId: 'Arti (ID)',
    meaningEn: 'Arti (EN)',
    wordId: 'Id kata',
    unit: 'Unit',
    context: 'Dilaporkan dari',
    page: 'Halaman',
    lang: 'Bahasa tampilan',
    wrong: 'Apa yang salah?',
    hint: '(Tulis di bawah ini. Jangan cantumkan data pribadi.)',
  },
  en: {
    title: 'Report a mistake',
    word: 'Word',
    pinyin: 'Pinyin',
    meaningId: 'Meaning (ID)',
    meaningEn: 'Meaning (EN)',
    wordId: 'Word id',
    unit: 'Unit',
    context: 'Reported from',
    page: 'Page',
    lang: 'Display language',
    wrong: 'What is wrong?',
    hint: '(Write below. Please do not include personal information.)',
  },
} as const

function buildUrl(title: string, body: string): string {
  const params = new URLSearchParams({ title, body })
  return `${ISSUE_NEW_URL}?${params.toString()}`
}

/** URL GitHub Issue baru yang sudah terisi. Tanpa label. Tidak memuat data pribadi atau progres. */
export function issueUrl({ word, context, pageUrl, lang }: IssueInput): string {
  const x = ISSUE_TEXT[lang]
  const title = word ? `${x.title}: ${word.hanzi} (${word.pinyin})` : `${x.title}: ${context}`
  const make = (meaningMax: number, includePage = true) => {
    const lines: string[] = []
    if (word) {
      lines.push(`- ${x.word}: ${word.hanzi}`, `- ${x.pinyin}: ${word.pinyin}`)
      if (meaningMax > 0) {
        lines.push(`- ${x.meaningId}: ${clip(word.ind.join('; '), meaningMax)}`)
        lines.push(`- ${x.meaningEn}: ${clip(word.en.join('; '), meaningMax)}`)
      }
      lines.push(`- ${x.wordId}: ${word.id}`)
      if (word.unitId) lines.push(`- ${x.unit}: ${word.unitOrder ? `${word.unitOrder} (${word.unitId})` : word.unitId}`)
    }
    lines.push(`- ${x.context}: ${context}`)
    if (includePage) lines.push(`- ${x.page}: ${pageUrl}`)
    lines.push(`- ${x.lang}: ${lang}`, '', `### ${x.wrong}`, x.hint, '', '')
    return buildUrl(title, lines.join('\n'))
  }
  for (const max of [300, 100, 0]) {
    const url = make(max)
    if (url.length < ISSUE_URL_MAX) return url
  }
  const url = make(0, false)
  return url.length < ISSUE_URL_MAX ? url : buildUrl(clip(title, 200), `${x.wordId}: ${word?.id ?? ''}\n\n### ${x.wrong}\n`)
}
