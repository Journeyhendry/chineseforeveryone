// Builds data/hsk1/words.json (the 300 words of the HSK syllabus 2025), data/hsk2-preview/words.json
// (2021-list words that are not in the 2025 syllabus) and data/hsk1/SOURCES.json.
// Deterministic: same inputs -> same output bytes.
//
//   npm run build:words            uses the copies in data/raw/
//   npm run build:words -- --fetch re-downloads both lists from their pinned commits first
//
// Inputs
//   data/raw/hsk31_words_level1.txt        2025 list (becky82/mteh, 300 words, order = list order)
//   data/raw/hsk31_syllabus_level1.tsv     the same list as printed in the official syllabus PDF (number, pinyin, POS)
//   data/raw/hsk30.csv                     2021 list (ivankra/hsk30); only used to keep the old word ids and for HSK 2 preview
//   data/hsk1/translations-id.json, en-overrides.json   hand-made, keyed by word id
// The 2021 words are first built exactly as in task 2; each 2025 entry then reuses the id (and data) of the
// 2021 word with the same written form, or gets a new id L1-0501... in list order.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { splitSyllables, syllableTone, toNumbered, normalizeNumbered } from '../src/lib/pinyin.ts'

const HSK_COMMIT = '4ff9e3915ce87baaecd7ebe263085573a4ea3192'
const HSK_URL = `https://raw.githubusercontent.com/ivankra/hsk30/${HSK_COMMIT}/hsk30.csv`
const SYLLABUS_COMMIT = '6be297fc92f85590a4fc001f8f734ed5624497fc'
const SYLLABUS_URL = `https://raw.githubusercontent.com/becky82/mteh/${SYLLABUS_COMMIT}/sources/HSK3.1/HSK3.1_words_level1.txt`
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


// ---------- 2021 list (task 2 pipeline, unchanged) ----------
interface Word {
  id: string
  hanzi: string
  variants: string[]
  traditional: string
  pinyin: string
  pinyinNumbered: string
  syllables: string[]
  tones: number[]
  pos: string[]
  en: string[]
  ind: string[]
  idMachine: true
  hsk: number
  chars: string[]
}

interface Ctx {
  cedict: Map<string, CedictEntry[]>
  cedictVersion: string
  translations: Record<string, Translation>
  overrides: Record<string, Override>
}

function build2021(ctx: Ctx) {
  const table = parseCsv(readFileSync(path('data/raw/hsk30.csv'), 'utf8'))
  const header = table[0]
  const rows = table.slice(1).map((cells) => Object.fromEntries(header.map((h, i) => [h, cells[i] ?? ''])) as unknown as CsvRow)
  const level1 = rows.filter((r) => r.Level === '1')
  const { translations, overrides, cedict } = ctx

  const ids = new Set(level1.map((r) => r.ID))
  for (const id of Object.keys(translations)) if (!ids.has(id) && !/^L1-05\d\d$/.test(id)) fail(`translations-id.json has unknown id ${id}`)
  for (const id of Object.keys(overrides)) if (!ids.has(id) && !/^L1-05\d\d$/.test(id)) fail(`en-overrides.json has unknown id ${id}`)

  const enSource: Record<EnSource, string[]> = { exact: [], fallback: [], erhua: [], override: [] }
  const mismatches: { id: string; hanzi: string; pinyin: string; syllables: number; chars: number; resolution: string }[] = []
  const variantCases: { id: string; hanzi: string; variants: string[] }[] = []
  const altPronunciations: { id: string; hanzi: string; used: string; ignored: string }[] = []
  const csvCedictDisagree: { id: string; hanzi: string; ours: string; csv: string }[] = []
  const missingEn: string[] = []
  const words: Word[] = []

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
  return { words, level1Rows: level1.length, enSource, mismatches, variantCases, altPronunciations, csvCedictDisagree }
}

// ---------- 2025 syllabus ----------
interface SyllabusRow {
  no: number
  hanzi: string
  pinyin: string
  pos: string
  form1219: string
  pinyin1219: string
}

function readSyllabusTable(): SyllabusRow[] {
  const lines = readFileSync(path('data/raw/hsk31_syllabus_level1.tsv'), 'utf8').split('\n').filter((l) => l !== '' && !l.startsWith('#'))
  if (!lines[0].startsWith('no\thanzi\t')) fail('hsk31_syllabus_level1.tsv: unexpected header')
  return lines.slice(1).map((l) => {
    const c = l.split('\t')
    return { no: Number(c[0]), hanzi: c[1], pinyin: c[2], pos: c[3] ?? '', form1219: c[4] ?? '', pinyin1219: c[5] ?? '' }
  })
}

/**
 * Entries of the 2025 list that are not plain "same written form as a 2021 word". The choices are explained in
 * SOURCES.json (rules). `reuse` keeps the id (scenes, visuals, sentences) of the 2021 word that differs only by
 * erhua or by an optional part; the 2021 form moves to variants.
 */
const FORM_DECISIONS: Record<string, { hanzi: string; variants: string[]; reuse?: string; why: string }> = {
  '没（有）': { hanzi: '没有', variants: ['没'], reuse: 'L1-0236', why: 'optional part: the second official PDF (1219) prints 没有; 没 stays as a variant. Reuses the 2021 word 没有.' },
  '有（一）点儿': { hanzi: '有点儿', variants: ['有一点儿'], why: 'optional part: the second official PDF (1219) prints 有点儿 (shorter, the common form); 有一点儿 stays as a variant.' },
  没事: { hanzi: '没事', variants: ['没事儿'], reuse: 'L1-0235', why: 'the 2021 list had the erhua form 没事儿; the id is reused.' },
  一下: { hanzi: '一下', variants: ['一下儿'], reuse: 'L1-0434', why: 'the 2021 list had the erhua form 一下儿; the id is reused.' },
  玩: { hanzi: '玩', variants: ['玩儿'], reuse: 'L1-0371', why: 'the 2021 list had the erhua form 玩儿; the id is reused.' },
}

/** Official POS label -> the codes used in words.json (only for words that are new in 2025). */
const POS_CODES: Record<string, string> = { 名: 'N', 动: 'V', 形: 'Adj', 副: 'Adv', 代: 'Pron', 量: 'M', 数: 'Num', 助: 'Aux', 介: 'Prep', 连: 'Conj', 叹: 'Interj', 前缀: 'Prefix', 后缀: 'Suffix' }
function posCodes(label: string): string[] {
  const out: string[] = []
  if (label.trim() === '') return out
  for (const part of label.split('、')) {
    const bare = part.replace(/[（）]/g, '')
    const codes = bare === '数量' ? ['Num', 'M'] : [POS_CODES[bare]]
    for (const c of codes) {
      if (!c) fail(`unknown POS label "${label}"`)
      if (!out.includes(c)) out.push(c)
    }
  }
  return out
}

const comparable = (p: string) => p.replace(/[\s'’()（）]/g, '').toLowerCase()
const countBy = <T>(list: T[], key: (x: T) => string) => list.reduce<Record<string, number>>((m, x) => ((m[key(x)] = (m[key(x)] ?? 0) + 1), m), {})

async function main() {
  if (process.argv.includes('--fetch')) {
    for (const [url, file] of [
      [HSK_URL, 'data/raw/hsk30.csv'],
      [SYLLABUS_URL, 'data/raw/hsk31_words_level1.txt'],
    ] as const) {
      const res = await fetch(url)
      if (!res.ok) fail(`download failed: ${res.status} ${url}`)
      writeFileSync(path(file), Buffer.from(await res.arrayBuffer()))
      console.log(`downloaded ${url}`)
    }
  }

  const cedictList = JSON.parse(readFileSync(path('node_modules/cedict-json/cedict.json'), 'utf8')) as CedictEntry[]
  const cedictVersion = (JSON.parse(readFileSync(path('node_modules/cedict-json/package.json'), 'utf8')) as { version: string }).version
  const cedict = new Map<string, CedictEntry[]>()
  for (const e of cedictList) {
    const list = cedict.get(e.simplified)
    if (list) list.push(e)
    else cedict.set(e.simplified, [e])
  }
  const ctx: Ctx = {
    cedict,
    cedictVersion,
    translations: readJson<Record<string, Translation>>('data/hsk1/translations-id.json'),
    overrides: readJson<Record<string, Override>>('data/hsk1/en-overrides.json'),
  }

  // 1. The 2021 words (500), exactly as task 2 built them.
  const old = build2021(ctx)
  const oldById = new Map(old.words.map((w) => [w.id, w]))

  // 2. The 2025 list, cross-checked against the official table.
  const list = readFileSync(path('data/raw/hsk31_words_level1.txt'), 'utf8').split(/\s+/).filter(Boolean)
  const table = readSyllabusTable()
  if (list.length !== 300) fail(`2025 list has ${list.length} entries, expected 300`)
  if (new Set(list).size !== list.length) fail('2025 list has duplicates')
  if (table.length !== 300) fail(`official table has ${table.length} rows, expected 300`)
  table.forEach((row, i) => {
    if (row.no !== i + 1) fail(`official table row ${i + 1} has number ${row.no}`)
    if (row.hanzi.replace(/\d+$/, '') !== list[i]) fail(`list and official table differ at no. ${i + 1}: ${list[i]} / ${row.hanzi}`)
  })
  for (const row of table) {
    if (row.form1219 !== '' && row.form1219 !== FORM_DECISIONS[row.hanzi]?.hanzi) fail(`2nd PDF spells ${row.hanzi} as ${row.form1219}, formDecisions says ${FORM_DECISIONS[row.hanzi]?.hanzi}`)
  }

  const oldByHanzi = new Map<string, Word[]>()
  for (const w of old.words) oldByHanzi.set(w.hanzi, [...(oldByHanzi.get(w.hanzi) ?? []), w])

  const words: Word[] = []
  const newIds: string[] = []
  const reusedIds = new Set<string>()
  const changedForm: { id: string; from: string; to: string; why: string }[] = []
  const pinyinChanged: { id: string; hanzi: string; from: string; to: string }[] = []
  const posFromSyllabus: string[] = []
  const missingEn: string[] = []
  const enSource: Record<EnSource | 'kept2021', string[]> = { kept2021: [], exact: [], fallback: [], erhua: [], override: [] }
  const cedictPinyinDiffers: { id: string; hanzi: string; syllabus: string; cedict: string }[] = []
  let nextNew = 501

  list.forEach((entry, i) => {
    const row = table[i]
    const decision = FORM_DECISIONS[entry]
    const hanzi = decision?.hanzi ?? entry
    const variants = decision?.variants ?? []
    const rawPinyin = (row.pinyin1219 || row.pinyin).split('/')[0]
    const pinyin = rawPinyin.replace(/\s+/g, '')

    // Which 2021 word is this?
    let match: Word | undefined
    if (decision?.reuse) {
      match = oldById.get(decision.reuse)
      if (!match) return fail(`reuse id ${decision.reuse} for ${entry} does not exist`)
    } else {
      const candidates = oldByHanzi.get(hanzi) ?? []
      match = candidates.length === 1 ? candidates[0] : candidates.find((c) => comparable(c.pinyin) === comparable(pinyin))
      if (candidates.length > 1 && !match) return fail(`${entry}: several 2021 words, none with pinyin ${pinyin}`)
    }
    if (match && reusedIds.has(match.id)) return fail(`2021 word ${match.id} reused twice (${entry})`)

    const id = match?.id ?? `L1-${String(nextNew++).padStart(4, '0')}`
    if (match) reusedIds.add(id)
    else newIds.push(id)

    const syllables = splitSyllables(pinyin)
    if (syllables.length !== [...hanzi].length) fail(`${entry}: ${syllables.length} syllables for ${[...hanzi].length} characters (${pinyin})`)
    const numbered = syllables.map(toNumbered).join(' ')

    // CC-CEDICT entry of the written form (traditional form + a pinyin sanity check for words that are new or changed).
    const same = cedict.get(hanzi) ?? []
    const cedictEntry = same.find((e) => normalizeNumbered(e.pinyin) === numbered.toLowerCase()) ?? same[0]
    const traditional = match && match.hanzi === hanzi ? match.traditional : (cedictEntry?.traditional ?? hanzi)

    // English meaning: keep the 2021 one when the written form is unchanged; else CEDICT / override.
    let en: string[]
    const override = ctx.overrides[id]
    if (match && match.hanzi === hanzi && !override) {
      en = match.en
      enSource.kept2021.push(id)
    } else if (override) {
      en = override.en
      enSource.override.push(id)
    } else {
      const found = lookupEn(cedict, hanzi, traditional, numbered.toLowerCase())
      if (!found) {
        missingEn.push(`${id} ${hanzi} ${numbered}`)
        return
      }
      en = found.en
      enSource[found.source].push(id)
    }

    const tr = ctx.translations[id]
    if (!tr || !Array.isArray(tr.ind) || tr.ind.length === 0) return fail(`no Indonesian translation for ${id} ${hanzi}`)
    if (tr.machine !== true) return fail(`translation for ${id} must have "machine": true`)

    if (match && comparable(match.pinyin) !== comparable(pinyin)) pinyinChanged.push({ id, hanzi, from: match.pinyin, to: pinyin })
    if (match && match.hanzi !== hanzi) changedForm.push({ id, from: match.hanzi, to: hanzi, why: decision?.why ?? '' })
    if (!match) {
      if (cedictEntry && normalizeNumbered(cedictEntry.pinyin) !== numbered.toLowerCase()) cedictPinyinDiffers.push({ id, hanzi, syllabus: pinyin, cedict: normalizeNumbered(cedictEntry.pinyin) })
      posFromSyllabus.push(id)
    }

    words.push({
      id,
      hanzi,
      variants: match && match.hanzi === hanzi ? [...new Set([...match.variants, ...variants])].filter((v) => v !== hanzi) : variants,
      traditional,
      pinyin: match && comparable(match.pinyin) === comparable(pinyin) ? match.pinyin : pinyin,
      pinyinNumbered: numbered,
      syllables: match && comparable(match.pinyin) === comparable(pinyin) ? match.syllables : syllables,
      tones: syllables.map(syllableTone),
      pos: match ? match.pos : posCodes(row.pos),
      en,
      ind: tr.ind,
      idMachine: true,
      hsk: 1,
      chars: [...new Set([...hanzi])],
    })
  })
  if (missingEn.length > 0) fail(`no English meaning (add to data/hsk1/en-overrides.json):\n  ${missingEn.join('\n  ')}`)
  if (words.length !== 300) fail(`built ${words.length} words, expected 300`)
  // A word that kept its id and form must be identical to the 2021 word except for a changed pinyin.
  for (const w of words) {
    const o = oldById.get(w.id)
    if (o && o.hanzi === w.hanzi && comparable(o.pinyin) === comparable(w.pinyin) && JSON.stringify({ ...o, variants: w.variants }) !== JSON.stringify(w)) fail(`${w.id} ${w.hanzi} differs from the 2021 word although nothing changed`)
  }

  // 3. HSK 2 preview: every 2021 word that was not reused.
  const preview = old.words.filter((w) => !reusedIds.has(w.id)).map((w) => ({ ...w, hsk: 2, previewFrom: 'hsk1-2021' }))
  mkdirSync(path('data/hsk2-preview/'), { recursive: true })
  writeFileSync(path('data/hsk1/words.json'), `${JSON.stringify(words, null, 2)}\n`)
  writeFileSync(path('data/hsk2-preview/words.json'), `${JSON.stringify(preview, null, 2)}\n`)

  // Cross-check with the official table: hanzi order was checked above; pinyin is compared here.
  const crossPinyin = words.map((w, i) => ({ w, row: table[i] })).filter(({ w, row }) => comparable(w.pinyin) !== comparable((row.pinyin1219 || row.pinyin).split('/')[0]))
  if (crossPinyin.length > 0) fail(`pinyin differs from the official table: ${crossPinyin.map(({ w, row }) => `${w.hanzi} ${w.pinyin} / ${row.pinyin}`).join('; ')}`)

  const sources = {
    hskList: {
      name: 'HSK 3.1: the HSK syllabus published by CLEC in Nov 2025 (new exam from 13 Dec 2026), level 1',
      url: SYLLABUS_URL,
      repo: 'https://github.com/becky82/mteh',
      commit: SYLLABUS_COMMIT,
      localCopy: 'data/raw/hsk31_words_level1.txt',
      license: 'CC BY-SA 4.0, © 2025 Rebecca J. Stones (repo README, section "License")',
      entries: list.length,
      order: 'words.json follows the order of this list (alphabetical by pinyin, same as the official table)',
    },
    officialTable: {
      files: ['新版HSK考试大纲（词汇、汉字、语法）.pdf (published 2025-11, in force 2026-07)', '新版HSK考试大纲1219.pdf'],
      location: 'github.com/becky82/mteh, sources/HSK3.1/, same commit',
      localCopy: 'data/raw/hsk31_syllabus_level1.tsv',
      use: 'cross-check of the 300 words, official pinyin (all 300 words use it) and the part of speech of the new words. Only the list itself (words, numbers, pinyin, POS) is copied, not the document.',
    },
    crossCheck: {
      listVsOfficialPdf: `${list.length} of ${list.length} words identical to rows 1-${table.length} of the vocabulary table of the first PDF, same order`,
      listVsSecondPdf: 'same 300 words (second PDF sorts differently); only two spellings differ: 没（有） / 有（一）点儿 are printed 没有 / 有点儿 there',
      npmPackage: '@leonsilicon/hsk3.1@0.0.1 (derived from mteh, only a sanity check): the same 300 words in the same order; it writes the two optional forms as arrays ["没","没有"] and ["有点儿","有一点儿"]',
      pinyinVsOfficialTable: 'all 300 words have the pinyin of the official table (checked by this script)',
      pinyinChangedFrom2021: pinyinChanged,
      pinyinChangedNote: '2021 list wrote 不客气 bùkèqì and 一-words without tone change; the 2025 syllabus writes the pronounced tones (bú kèqi, yíbàn, yìdiǎnr, yíxià, yìxiē). 还 is the reading hái (the 2021 list also had huán, which is not in the 2025 syllabus). 没事 / 玩 / 一下 lost the erhua r of the 2021 forms.',
      newWordPinyinDifferingFromCedict: cedictPinyinDiffers,
      unexplainedDifferences: 0,
    },
    hsk2021List: {
      url: HSK_URL,
      repo: 'https://github.com/ivankra/hsk30',
      commit: HSK_COMMIT,
      localCopy: 'data/raw/hsk30.csv',
      license: 'Code MIT; word list derived from the official HSK 3.0 (2021) list',
      level1Rows: old.level1Rows,
      use: 'only for the ids of words that stay and for data/hsk2-preview/ (the old words that are not in the 2025 syllabus)',
    },
    cedict: {
      package: 'cedict-json',
      version: cedictVersion,
      source: 'https://cc-cedict.org',
      license: 'CC BY-SA 4.0',
    },
    indonesian: 'data/hsk1/translations-id.json: machine translation (written by Claude) from the English meaning and HSK 1 context; every entry is flagged machine: true',
    wordCount: words.length,
    ids: {
      reused: words.filter((w) => reusedIds.has(w.id)).length,
      newIds,
      reusedWithChangedForm: changedForm,
      movedToHsk2Preview: preview.map((w) => w.id),
      movedToHsk2PreviewCount: preview.length,
    },
    englishMeaning: {
      kept2021: enSource.kept2021.length,
      newExactPinyinMatch: enSource.exact.length,
      newFallbackSameSimplified: enSource.fallback.length,
      newErhuaRedirect: enSource.erhua.length,
      manualOverride: enSource.override.length,
      fallbackIds: enSource.fallback,
      erhuaRedirectIds: enSource.erhua,
      overrideIds: enSource.override,
    },
    partOfSpeech: {
      fromOfficialTable: posFromSyllabus,
      note: 'words that were already in the 2021 list keep their POS from that list; new words take the official POS label (名 N, 动 V, 形 Adj, 副 Adv, 代 Pron, 量 M, 数 Num, 助 Aux, 介 Prep, 连 Conj, 叹 Interj, 前缀 Prefix, 后缀 Suffix; 数量 = Num + M), brackets removed. Some words have no POS in the table (不客气 打电话 没关系 你好 下雨 做饭).',
      distribution: countBy(words.flatMap((w) => (w.pos.length ? w.pos : ['(none)'])), (p) => p),
    },
    specialCases: {
      syllableCharMismatch2021: old.mismatches,
      wordsWithVariants: words.filter((w) => w.variants.length > 0).map((w) => ({ id: w.id, hanzi: w.hanzi, variants: w.variants })),
      alternativePronunciationsIgnored2021: old.altPronunciations,
      rules: [
        'The 2025 list decides which words exist and their order. A word keeps its 2021 id (L1-0xxx) when the written form is the same (or differs only by erhua / an optional part, see formDecisions); other words get L1-0501... in list order.',
        'formDecisions: ' + Object.entries(FORM_DECISIONS).map(([k, v]) => `${k} -> ${v.hanzi} [${v.variants.join(', ')}]: ${v.why}`).join(' | '),
        'Erhua r is its own syllable (tone 5) and its Han character 儿 counts as one character.',
        'pinyin has no spaces; apostrophes are kept (nǚ\'ér). pinyinNumbered is space separated per syllable, ü written as v. Where the official table gives two readings (谁 shéi/shuí) the first is used.',
        'en[]: for 2021 words with an unchanged form the 2021 meaning is kept. Otherwise: CEDICT entries with the same simplified form and exact numbered pinyin (traditional form preferred); else same simplified form; senses starting with CL:, variant of, surname, abbr. for, (slang), Japanese-style, Taiwan pr., also pr., also written, or mentioning Kangxi radical are dropped unless they are all there is; erhua entries take the meaning of X; at most 6. Manual overrides in en-overrides.json win over everything.',
        'traditional[] of new words comes from the CC-CEDICT entry of the written form.',
      ],
    },
    hsk2021Details: {
      note: 'details of the 2021 build (task 2) that still apply to the kept words',
      wordsWithVariants2021: old.variantCases,
      pinyinDisagreeingWithCsvCedictColumn: old.csvCedictDisagree,
      englishMeaning2021: {
        exactPinyinMatch: old.enSource.exact.length,
        fallbackSameSimplified: old.enSource.fallback.length,
        erhuaRedirect: old.enSource.erhua.length,
        manualOverride: old.enSource.override.length,
      },
    },
    notes: [
      'BUILD_PLAN section 1 (owner decision 2026-11-22): HSK 1 = the 300 words of the 2025 syllabus. Words of the 2021 list that are not in it moved to data/hsk2-preview/ (task 2b).',
    ],
  }
  writeFileSync(path('data/hsk1/SOURCES.json'), `${JSON.stringify(sources, null, 2)}\n`)

  console.log(`words: ${words.length} (reused ids: ${reusedIds.size}, new: ${newIds.length}, moved to HSK 2 preview: ${preview.length})`)
  console.log(`pinyin changed from 2021: ${pinyinChanged.map((c) => `${c.hanzi} ${c.from}->${c.to}`).join(', ') || 'none'}`)
  console.log(`EN: kept ${enSource.kept2021.length}, exact ${enSource.exact.length}, fallback ${enSource.fallback.length}, erhua ${enSource.erhua.length}, override ${enSource.override.length}`)
}

await main()
