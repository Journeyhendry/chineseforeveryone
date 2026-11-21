// Filters the Tatoeba exports down to HSK 1 example sentences.
//
//   npm run build:sentences -- --in <folder with the extracted Tatoeba files> [--out <folder>] [--date <ISO date>]
//
// Writes sentences.json and sentences-report.json (default folder data/hsk1). The files are streamed line by
// line; only rows for sentences that survived the filter are kept in memory. The rules live in src/lib/sentences.ts.
import { createReadStream, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'
import {
  buildLexicon,
  analyzeSentence,
  buildReport,
  compareCandidates,
  DEFAULT_PER_WORD,
  formatSentences,
  MAX_FILE_BYTES,
  MAX_TRANSLATIONS,
  REJECT_REASONS,
  selectPerWord,
  type Analysis,
  type Attribution,
  type AudioRef,
  type Candidate,
  type FilterStats,
  type SentenceEntry,
  type UnitInput,
  type WordInput,
} from '../src/lib/sentences.ts'

const root = new URL('..', import.meta.url)
const CC0_LICENSE = 'CC0 1.0'
const DEFAULT_LICENSE = 'CC BY 2.0 FR'

const fail = (msg: string): never => {
  console.error(`filter-sentences: ${msg}`)
  process.exit(1)
}

function argValue(name: string): string | undefined {
  const i = process.argv.indexOf(name)
  if (i === -1) return undefined
  const v = process.argv[i + 1]
  if (!v || v.startsWith('--')) fail(`${name} needs a value`)
  return v
}

// ---------- locating and reading the export files ----------
interface FileSpec {
  key: string
  pattern: RegExp
  /** Minimum number of tab-separated columns the code reads. */
  minCols: number
  columns: string
}
const FILES: FileSpec[] = [
  { key: 'cmn', pattern: /^cmn_sentences_detailed\.(tsv|csv)$/i, minCols: 4, columns: 'id, lang, text, username, ...' },
  { key: 'eng', pattern: /^eng_sentences_detailed\.(tsv|csv)$/i, minCols: 4, columns: 'id, lang, text, username, ...' },
  { key: 'ind', pattern: /^ind_sentences_detailed\.(tsv|csv)$/i, minCols: 4, columns: 'id, lang, text, username, ...' },
  { key: 'cmnEng', pattern: /^cmn-eng_links\.(tsv|csv)$/i, minCols: 2, columns: 'sentence_id, translation_id' },
  { key: 'cmnInd', pattern: /^cmn-ind_links\.(tsv|csv)$/i, minCols: 2, columns: 'sentence_id, translation_id' },
  { key: 'tags', pattern: /^tags\.(csv|tsv)$/i, minCols: 2, columns: 'sentence_id, tag_name' },
  { key: 'audio', pattern: /^sentences_with_audio\.(csv|tsv)$/i, minCols: 4, columns: 'sentence_id, audio_id, username, license[, attribution_url]' },
  { key: 'cc0', pattern: /^sentences_cc0\.(csv|tsv)$/i, minCols: 1, columns: 'sentence_id, ...' },
]

function locate(dir: string): Record<string, string> {
  const all = readdirSync(dir, { recursive: true, encoding: 'utf8' }).map((p) => join(dir, p))
  const found: Record<string, string> = {}
  for (const spec of FILES) {
    const hits = all.filter((p) => spec.pattern.test(basename(p))).sort((a, b) => a.length - b.length || (a < b ? -1 : 1))
    if (hits.length === 0) fail(`no file matching ${spec.pattern} under ${dir} (expected columns: ${spec.columns})`)
    found[spec.key] = hits[0]
  }
  return found
}

const nullToEmpty = (s: string | undefined): string => (s === undefined || s === '\\N' ? '' : s.trim())
const isId = (s: string | undefined): s is string => s !== undefined && /^\d+$/.test(s)

/** Streams a tab-separated file; prints the first line, fails when it has too few columns, skips other short rows. */
async function eachRow(spec: FileSpec, path: string, onRow: (cols: string[]) => void): Promise<void> {
  const rl = createInterface({ input: createReadStream(path, { encoding: 'utf8' }), crlfDelay: Infinity })
  let first = true
  let rows = 0
  let skipped = 0
  for await (const rawLine of rl) {
    let line = rawLine
    if (first) line = line.replace(/^﻿/, '')
    if (line === '') continue
    const cols = line.split('\t')
    if (first) {
      console.log(`${spec.key}: ${path}\n  first line: ${line.length > 200 ? `${line.slice(0, 200)}...` : line}`)
      if (cols.length < spec.minCols) fail(`${path} has ${cols.length} column(s) in the first line, expected at least ${spec.minCols} (${spec.columns}). Is it really tab-separated?`)
      first = false
    }
    if (cols.length < spec.minCols) {
      skipped++
      continue
    }
    rows++
    onRow(cols)
  }
  if (first) fail(`${path} is empty`)
  console.log(`  rows: ${rows}${skipped > 0 ? `, skipped short rows: ${skipped}` : ''}`)
}

// ---------- main ----------
async function main() {
  const inDir = argValue('--in')
  if (!inDir) return fail('usage: npm run build:sentences -- --in <folder> [--out <folder>] [--date <ISO date>]')
  const outDir = resolve(argValue('--out') ?? fileURLToPath(new URL('data/hsk1', root)))
  const generatedAt = argValue('--date') ?? new Date().toISOString()
  const files = locate(resolve(inDir))
  const spec = Object.fromEntries(FILES.map((f) => [f.key, f]))

  const words = JSON.parse(readFileSync(new URL('data/hsk1/words.json', root), 'utf8')) as WordInput[]
  const units = (JSON.parse(readFileSync(new URL('data/hsk1/units.json', root), 'utf8')) as { units: UnitInput[] }).units
  // CC-CEDICT headwords only help to find word boundaries (太阳 is one word, not 太 + 阳).
  const cedict = JSON.parse(readFileSync(new URL('node_modules/cedict-json/cedict.json', root), 'utf8')) as { simplified: string }[]
  const dictionary = new Set(cedict.map((e) => e.simplified).filter((w) => /^\p{Script=Han}+$/u.test(w)))
  console.log(`dictionary words: ${dictionary.size}`)
  const lex = buildLexicon(words, units, dictionary)

  // 1. Mandarin sentences: apply the text rules right away.
  const stats: FilterStats = {
    cmnSentences: 0,
    rejected: Object.fromEntries(REJECT_REASONS.map((r) => [r, 0])) as FilterStats['rejected'],
    noAuthor: 0,
    noEnglish: 0,
    candidates: 0,
  }
  const survivors = new Map<number, Analysis & { author: string }>()
  await eachRow(spec.cmn, files.cmn, (c) => {
    if (!isId(c[0]) || c[1] !== 'cmn') return
    stats.cmnSentences++
    const result = analyzeSentence(c[2], lex)
    if (!result.ok) {
      stats.rejected[result.reason]++
      return
    }
    const author = nullToEmpty(c[3])
    if (author === '') {
      stats.noAuthor++
      return
    }
    survivors.set(Number(c[0]), { ...result.value, author })
  })
  console.log(`cmn sentences passing the text rules: ${survivors.size} of ${stats.cmnSentences}`)

  // 2. Links: keep only those of surviving sentences. The pair may come in either order.
  const readLinks = async (key: 'cmnEng' | 'cmnInd'): Promise<Map<number, number[]>> => {
    const links = new Map<number, number[]>()
    await eachRow(spec[key], files[key], (c) => {
      if (!isId(c[0]) || !isId(c[1])) return
      let [a, b] = [Number(c[0]), Number(c[1])]
      if (!survivors.has(a) && survivors.has(b)) [a, b] = [b, a]
      if (!survivors.has(a)) return
      const list = links.get(a)
      if (list) list.push(b)
      else links.set(a, [b])
    })
    return links
  }
  const engLinks = await readLinks('cmnEng')
  for (const id of [...survivors.keys()]) {
    if (!engLinks.has(id)) {
      survivors.delete(id)
      stats.noEnglish++
    }
  }
  const indLinks = await readLinks('cmnInd')
  const linkedIds = (links: Map<number, number[]>) => new Set([...links].filter(([id]) => survivors.has(id)).flatMap(([, l]) => l))
  const wantEng = linkedIds(engLinks)
  const wantInd = linkedIds(indLinks)

  // 3. Translation texts.
  const readTexts = async (key: 'eng' | 'ind', wanted: Set<number>): Promise<Map<number, { text: string; author: string }>> => {
    const texts = new Map<number, { text: string; author: string }>()
    await eachRow(spec[key], files[key], (c) => {
      if (!isId(c[0]) || !wanted.has(Number(c[0]))) return
      const author = nullToEmpty(c[3])
      if (author !== '' && c[2].trim() !== '') texts.set(Number(c[0]), { text: c[2].trim(), author })
    })
    return texts
  }
  const engTexts = await readTexts('eng', wantEng)
  const indTexts = await readTexts('ind', wantInd)

  // 4. Tags (OK), CC0 ids and audio, only for the ids we still care about.
  const relevant = new Set<number>([...survivors.keys(), ...wantEng, ...wantInd])
  const okTag = new Set<number>()
  await eachRow(spec.tags, files.tags, (c) => {
    if (isId(c[0]) && c[1].trim() === 'OK' && relevant.has(Number(c[0]))) okTag.add(Number(c[0]))
  })
  const cc0 = new Set<number>()
  await eachRow(spec.cc0, files.cc0, (c) => {
    if (isId(c[0]) && relevant.has(Number(c[0]))) cc0.add(Number(c[0]))
  })
  const audio = new Map<number, AudioRef[]>()
  await eachRow(spec.audio, files.audio, (c) => {
    if (!isId(c[0]) || !isId(c[1]) || !survivors.has(Number(c[0]))) return
    const ref: AudioRef = { audioId: Number(c[1]), author: nullToEmpty(c[2]), license: nullToEmpty(c[3]), attributionUrl: nullToEmpty(c[4]) }
    const list = audio.get(Number(c[0]))
    if (list) list.push(ref)
    else audio.set(Number(c[0]), [ref])
  })

  const licenseOf = (id: number) => (cc0.has(id) ? CC0_LICENSE : DEFAULT_LICENSE)
  const pickTranslations = (ids: number[] | undefined, texts: Map<number, { text: string; author: string }>): Attribution[] =>
    [...new Set(ids ?? [])]
      .filter((id) => texts.has(id))
      .sort((a, b) => Number(okTag.has(b)) - Number(okTag.has(a)) || a - b)
      .slice(0, MAX_TRANSLATIONS)
      .map((id) => ({ tatoebaId: id, text: texts.get(id)!.text, author: texts.get(id)!.author, license: licenseOf(id) }))

  // 5. Build entries, rank per word, cap, and shrink the cap while the file is too big.
  const all = new Map<number, SentenceEntry>()
  for (const [id, s] of survivors) {
    const en = pickTranslations(engLinks.get(id), engTexts)
    if (en.length === 0) {
      stats.noEnglish++
      continue
    }
    all.set(id, {
      tatoebaId: id,
      cmn: s.cmn,
      author: s.author,
      license: licenseOf(id),
      ok: okTag.has(id),
      outside: s.outside,
      words: s.words,
      unit: s.unit,
      en,
      ind: pickTranslations(indLinks.get(id), indTexts),
      audio: (audio.get(id) ?? []).sort((a, b) => a.audioId - b.audioId),
    })
  }
  stats.candidates = all.size
  const candidates: Candidate[] = [...all.values()].map((e) => ({
    tatoebaId: e.tatoebaId,
    words: e.words,
    ok: e.ok,
    licensedAudio: e.audio.some((a) => a.license !== ''),
    hasInd: e.ind.length > 0,
    outside: e.outside,
    length: [...e.cmn].length,
  }))
  candidates.sort(compareCandidates)

  const wordIds = words.map((w) => w.id)
  let perWord = DEFAULT_PER_WORD
  let entries: SentenceEntry[] = []
  let text = ''
  for (const cap of [DEFAULT_PER_WORD, 6, 5]) {
    perWord = cap
    const chosen = selectPerWord(candidates, wordIds, cap)
    entries = [...chosen].sort((a, b) => a - b).map((id) => all.get(id)!)
    text = formatSentences(entries, cap)
    if (Buffer.byteLength(text) <= MAX_FILE_BYTES) break
  }

  const report = buildReport(entries, words, units, stats, { generatedAt, perWordLimit: perWord, fileBytes: Buffer.byteLength(text) })
  mkdirSync(outDir, { recursive: true })
  writeFileSync(join(outDir, 'sentences.json'), text)
  writeFileSync(join(outDir, 'sentences-report.json'), `${JSON.stringify(report, null, 2)}\n`)

  console.log(`\nsentences written: ${entries.length} (limit ${perWord} per word, ${report.fileBytes} bytes) -> ${outDir}`)
  console.log(`rejected: ${JSON.stringify(stats.rejected)}, no author: ${stats.noAuthor}, no English: ${stats.noEnglish}`)
  console.log(`units below 5 sentences: ${report.unitsBelowFive.map((u) => `${u.unit}(${u.count})`).join(' ') || 'none'}`)
  console.log(`words without sentences: ${report.wordsWithoutSentences.length}`)
}

await main()
