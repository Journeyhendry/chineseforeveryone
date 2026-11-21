// Builds data/hsk1/words.json (+ SOURCES.json) from the pinned HSK 3.0 CSV, CC-CEDICT and
// the hand-made translations/overrides. Deterministic: same inputs -> same output bytes.
//
//   npm run build:words            uses data/raw/hsk30.csv
//   npm run build:words -- --fetch re-downloads the CSV from the pinned commit first
import { readFileSync, writeFileSync } from 'node:fs'
import { splitSyllables, syllableTone, toNumbered, normalizeNumbered } from '../src/lib/pinyin.ts'

const HSK_COMMIT = '4ff9e3915ce87baaecd7ebe263085573a4ea3192'
const HSK_URL = `https://raw.githubusercontent.com/ivankra/hsk30/${HSK_COMMIT}/hsk30.csv`
const MAX_EN = 6

const root = new URL('..', import.meta.url)
const path = (p: string) => new URL(p, root)

// ---------- CSV ----------
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else quoted = false
      } else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      field = ''
      if (row.length > 1 || row[0] !== '') rows.push(row)
      row = []
    } else field += c
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

interface CsvRow {
  ID: string
  Simplified: string
  Traditional: string
  Pinyin: string
  POS: string
  Level: string
  Variants: string
  CEDICT: string
}
interface VariantEntry {
  Simplified: string
  Traditional: string
  Pinyin: string
  Example?: string
}

// ---------- types ----------
interface CedictEntry {
  traditional: string
  simplified: string
  pinyin: string
  english: string[]
}
type Override = { en: string[]; source: string }
type Translation = { ind: string[]; machine: boolean }
type EnLookupSource = 'exact' | 'fallback' | 'erhua'
type EnSource = EnLookupSource | 'override'

const readJson = <T>(p: string): T => JSON.parse(readFileSync(path(p), 'utf8')) as T
const fail = (msg: string): never => {
  console.error(`build-words: ${msg}`)
  process.exit(1)
}

// ---------- CC-CEDICT ----------
// Senses that are never useful for a beginner: classifier lists, variant/surname notes, plus a few
// noise patterns (abbreviations, slang, regional pronunciations). If nothing else is left, keep them.
const DROPPED_SENSE = [
  /^CL:/,
  /^(old |ancient |archaic )?variant of /i,
  /^surname /i,
  /^abbr\. for /i,
  /^\((Internet )?slang\)/i,
  /^Japanese-style /,
  /^Taiwan pr\. /,
  /^also pr\. /,
  /^also written /,
  /Kangxi radical/,
]
const ERHUA_REF = /^erhua (?:variant|form) of (?:[^\s|[]+\|)?([^\s[]+)\[([^\]]+)\]/

function cleanSenses(english: string[]): string[] {
  const kept = english.filter((s) => !DROPPED_SENSE.some((re) => re.test(s.trim())))
  return (kept.length > 0 ? kept : english).map((s) => s.replace(/\s*\(CL:[^)]*\)/g, '').trim())
}

function lookupEn(cedict: Map<string, CedictEntry[]>, hanzi: string, traditional: string, numbered: string): { en: string[]; source: EnLookupSource } | null {
  const same = cedict.get(hanzi) ?? []
  if (same.length === 0) return null
  const exact = same.filter((e) => normalizeNumbered(e.pinyin) === numbered)
  const pick = (list: CedictEntry[]) => {
    const preferred = list.filter((e) => e.traditional === traditional)
    return preferred.length > 0 ? preferred : list
  }
  const [chosen, source] = exact.length > 0 ? [pick(exact), 'exact' as const] : [pick(same), 'fallback' as const]
  const all = chosen.flatMap((e) => e.english)
  // Erhua entries only say "erhua variant of X[...]": take the meaning of X instead.
  const ref = all.length > 0 && all.every((s) => ERHUA_REF.test(s)) ? ERHUA_REF.exec(all[0]) : null
  if (ref) {
    const target = lookupEn(cedict, ref[1], '', normalizeNumbered(ref[2].replace(/\s*:\s*/g, ':')))
    return target ? { en: target.en, source: 'erhua' } : null
  }
  const senses: string[] = []
  for (const s of cleanSenses(all)) if (!senses.includes(s)) senses.push(s)
  return senses.length > 0 ? { en: senses.slice(0, MAX_EN), source } : null
}

// ---------- main ----------
async function main() {
  if (process.argv.includes('--fetch')) {
    const res = await fetch(HSK_URL)
    if (!res.ok) fail(`download failed: ${res.status} ${HSK_URL}`)
    writeFileSync(path('data/raw/hsk30.csv'), Buffer.from(await res.arrayBuffer()))
    console.log(`downloaded ${HSK_URL}`)
  }

  const table = parseCsv(readFileSync(path('data/raw/hsk30.csv'), 'utf8'))
  const header = table[0]
  const rows = table.slice(1).map((cells) => Object.fromEntries(header.map((h, i) => [h, cells[i] ?? ''])) as unknown as CsvRow)
  const level1 = rows.filter((r) => r.Level === '1')

  const cedictPath = path('node_modules/cedict-json/cedict.json')
  const cedictList = JSON.parse(readFileSync(cedictPath, 'utf8')) as CedictEntry[]
  const cedictVersion = (JSON.parse(readFileSync(path('node_modules/cedict-json/package.json'), 'utf8')) as { version: string }).version
  const cedict = new Map<string, CedictEntry[]>()
  for (const e of cedictList) {
    const list = cedict.get(e.simplified)
    if (list) list.push(e)
    else cedict.set(e.simplified, [e])
  }

  const translations = readJson<Record<string, Translation>>('data/hsk1/translations-id.json')
  const overrides = readJson<Record<string, Override>>('data/hsk1/en-overrides.json')

  const ids = new Set(level1.map((r) => r.ID))
  for (const id of Object.keys(translations)) if (!ids.has(id)) fail(`translations-id.json has unknown id ${id}`)
  for (const id of Object.keys(overrides)) if (!ids.has(id)) fail(`en-overrides.json has unknown id ${id}`)

  const enSource: Record<EnSource, string[]> = { exact: [], fallback: [], erhua: [], override: [] }
  const mismatches: { id: string; hanzi: string; pinyin: string; syllables: number; chars: number; resolution: string }[] = []
  const variantCases: { id: string; hanzi: string; variants: string[] }[] = []
  const altPronunciations: { id: string; hanzi: string; used: string; ignored: string }[] = []
  const csvCedictDisagree: { id: string; hanzi: string; ours: string; csv: string }[] = []
  const missingEn: string[] = []
  const words = []

  for (const r of level1) {
    // Written forms: use the Variants column when present (skipping "Example" rows), else the plain columns.
    const parsed: VariantEntry[] = r.Variants ? (JSON.parse(r.Variants) as VariantEntry[]) : []
    const forms = parsed.filter((v) => !v.Example)
    if (forms.length === 0) {
      const simp = r.Simplified.split('|')
      const trad = r.Traditional.split('|')
      const pin = r.Pinyin.split('|')
      simp.forEach((s, i) => forms.push({ Simplified: s, Traditional: trad[i] ?? trad[0], Pinyin: pin[i] ?? pin[0] }))
    }
    const main = forms[0]
    const hanzi = main.Simplified
    const variants = [...new Set(forms.slice(1).map((f) => f.Simplified))].filter((v) => v !== hanzi)
    if (variants.length > 0) variantCases.push({ id: r.ID, hanzi, variants })
    const traditional = main.Traditional.split('|')[0]

    // Same written form listed twice with another reading (谁: shéi / shuí): keep the first reading.
    const pinyinAlts = [main.Pinyin, ...forms.slice(1).filter((f) => f.Simplified === hanzi).map((f) => f.Pinyin)].flatMap((p) => p.split('/')).map((p) => p.trim())
    if (pinyinAlts.length > 1) altPronunciations.push({ id: r.ID, hanzi, used: pinyinAlts[0], ignored: [...new Set(pinyinAlts.slice(1))].join('/') })
    const pinyin = pinyinAlts[0].replace(/\s+/g, '')
    let syllables = splitSyllables(pinyin)
    const hanziChars = [...hanzi]
    if (syllables.length !== hanziChars.length) {
      // Fall back on the CEDICT column of the CSV (numbered pinyin per syllable) as the reference count.
      const csvNumbered = /\[([^\]]+)\]/.exec(r.CEDICT.split('/')[0])?.[1] ?? ''
      const refCount = csvNumbered ? csvNumbered.split(/\s+/).length : 0
      mismatches.push({
        id: r.ID,
        hanzi,
        pinyin,
        syllables: syllables.length,
        chars: hanziChars.length,
        resolution: refCount === hanziChars.length ? `CEDICT column agrees with char count (${refCount}); split not corrected` : `unresolved (CEDICT column count ${refCount})`,
      })
    }
    syllables = syllables.length > 0 ? syllables : [pinyin]
    const numbered = syllables.map(toNumbered).join(' ')
    const tones = syllables.map(syllableTone)

    const csvNumberedFull = /\[([^\]]+)\]/.exec(r.CEDICT.split('/')[0])?.[1]
    if (csvNumberedFull && parsed.length === 0 && normalizeNumbered(csvNumberedFull) !== numbered.toLowerCase()) {
      csvCedictDisagree.push({ id: r.ID, hanzi, ours: numbered, csv: normalizeNumbered(csvNumberedFull) })
    }

    let en: string[]
    const override = overrides[r.ID]
    const found = lookupEn(cedict, hanzi, traditional, numbered.toLowerCase())
    if (override) {
      en = override.en
      enSource.override.push(r.ID)
    } else if (found) {
      en = found.en
      enSource[found.source].push(r.ID)
    } else {
      missingEn.push(`${r.ID} ${hanzi} ${numbered}`)
      continue
    }

    const tr = translations[r.ID]
    if (!tr || !Array.isArray(tr.ind) || tr.ind.length === 0) return fail(`no Indonesian translation for ${r.ID} ${hanzi}`)
    if (tr.machine !== true) return fail(`translation for ${r.ID} must have "machine": true`)

    words.push({
      id: r.ID,
      hanzi,
      variants,
      traditional,
      pinyin,
      pinyinNumbered: numbered,
      syllables,
      tones,
      pos: r.POS.split('/').map((p) => p.trim()).filter(Boolean),
      en,
      ind: tr.ind,
      idMachine: true,
      hsk: 1,
      chars: [...new Set(hanziChars)],
    })
  }

  if (missingEn.length > 0) fail(`no English meaning (add to data/hsk1/en-overrides.json):\n  ${missingEn.join('\n  ')}`)
  words.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  if (new Set(words.map((w) => w.id)).size !== words.length) fail('duplicate ids')

  writeFileSync(path('data/hsk1/words.json'), `${JSON.stringify(words, null, 2)}\n`)

  const sources = {
    hskList: {
      url: HSK_URL,
      repo: 'https://github.com/ivankra/hsk30',
      commit: HSK_COMMIT,
      localCopy: 'data/raw/hsk30.csv',
      license: 'Code MIT; word list derived from the official HSK 3.0 (2021) list',
      level1Rows: level1.length,
    },
    cedict: {
      package: 'cedict-json',
      version: cedictVersion,
      source: 'https://cc-cedict.org',
      license: 'CC BY-SA 4.0',
    },
    indonesian: 'data/hsk1/translations-id.json: machine translation (written by Claude) from the English meaning and HSK 1 context; every entry is flagged machine: true',
    wordCount: words.length,
    englishMeaning: {
      exactPinyinMatch: enSource.exact.length,
      fallbackSameSimplified: enSource.fallback.length,
      erhuaRedirect: enSource.erhua.length,
      manualOverride: enSource.override.length,
      fallbackIds: enSource.fallback,
      erhuaRedirectIds: enSource.erhua,
      overrideIds: enSource.override,
    },
    specialCases: {
      syllableCharMismatch: mismatches,
      wordsWithVariants: variantCases,
      alternativePronunciationsIgnored: altPronunciations,
      pinyinDisagreeingWithCsvCedictColumn: csvCedictDisagree,
      rules: [
        'hanzi = first form in the Variants column (or first of "a|b"); other forms go to variants[]. Rows whose Variants entry is only an example (第（第二）, 们（朋友们）, 子（桌子）) keep just the bare character.',
        'Erhua r is its own syllable (tone 5) and its Han character 儿 counts as one character.',
        'pinyin has no spaces; apostrophes are kept (nǚ\'ér). pinyinNumbered is space separated per syllable, ü written as v.',
        'en[]: CEDICT entries with the same simplified form and exact numbered pinyin (traditional form preferred); else same simplified form; senses starting with CL:, variant of, surname, abbr. for, (slang), Japanese-style, Taiwan pr., also pr., also written, or mentioning Kangxi radical are dropped unless they are all there is; erhua entries (erhua variant of X) take the meaning of X; at most 6.',
        'Manual English overrides (en-overrides.json) are used for the one word missing from CEDICT and for words whose first six CEDICT senses miss the HSK 1 usage (本 次 比 打 点 别 元 行 一块儿 一点儿).',
      ],
    },
    notes: [
      'HSK 3.0 final syllabus (CLEC, published Nov 2025, new exam from 13 Dec 2026): according to secondary sources (studycli.org, thatsmandarin.com, hsklord.com) it cuts HSK 1 to 300 words (from 500 in the 2021 list). The full official list was not obtained. BUILD_PLAN section 1 keeps 500 words; changing to 300 needs a decision by the owner.',
    ],
  }
  writeFileSync(path('data/hsk1/SOURCES.json'), `${JSON.stringify(sources, null, 2)}\n`)

  console.log(`words: ${words.length}`)
  console.log(`EN exact: ${enSource.exact.length}, fallback: ${enSource.fallback.length}, erhua redirect: ${enSource.erhua.length}, override: ${enSource.override.length}`)
  console.log(`syllable/char mismatches: ${mismatches.length}`)
}

await main()
