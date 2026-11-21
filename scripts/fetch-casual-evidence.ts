// Collects external evidence (layer 2) for every casual candidate.
//
//   npm run fetch:casual-evidence -- --tatoeba <path to cmn_sentences.tsv or cmn_sentences_detailed.tsv> [--date <YYYY-MM-DD>]
//
// Sources: CC-CEDICT (local npm package cedict-json), en.wiktionary with zh.wiktionary fallback (API, needs
// network), Tatoeba (the export file, streamed line by line). A network failure is recorded as "error", never as
// "absent". Writes data/hsk1/casual-evidence-raw.json. Runs in GitHub Actions (.github/workflows/casual-evidence.yml).
import { createReadStream, readFileSync, writeFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { createInterface } from 'node:readline'
import { setTimeout as sleep } from 'node:timers/promises'
import {
  combineWiktionary,
  formatJson,
  indexCedict,
  lookupCedict,
  parseWikitext,
  TatoebaMatcher,
  type CandidatesFile,
  type CedictEntry,
  type RawEvidenceFile,
  type WiktionaryPage,
} from '../src/lib/casual.ts'

const root = new URL('..', import.meta.url)
const USER_AGENT = 'chineseforeveryone-casual-check/1.0 (https://github.com/Journeyhendry/chineseforeveryone; free HSK 1 learning site)'
const DELAY_MS = 250
const RETRIES = 3
const TIMEOUT_MS = 20_000

const fail = (msg: string): never => {
  console.error(`fetch-casual-evidence: ${msg}`)
  process.exit(1)
}
function argValue(name: string): string | undefined {
  const i = process.argv.indexOf(name)
  if (i === -1) return undefined
  const v = process.argv[i + 1]
  if (!v || v.startsWith('--')) fail(`${name} needs a value`)
  return v
}

// ---------- Wiktionary ----------
type ApiResult = { status: 'found'; wikitext: string } | { status: 'absent' } | { status: 'error'; error: string }

async function fetchWikitext(site: 'en' | 'zh', title: string): Promise<ApiResult> {
  const url = `https://${site}.wiktionary.org/w/api.php?action=parse&format=json&formatversion=2&redirects=1&prop=wikitext&page=${encodeURIComponent(title)}`
  let lastError = ''
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    await sleep(DELAY_MS * attempt)
    try {
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, 'Api-User-Agent': USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS) })
      if (res.status === 429 || res.status >= 500) {
        lastError = `HTTP ${res.status}`
        continue
      }
      if (!res.ok) return { status: 'error', error: `HTTP ${res.status}` }
      const body = (await res.json()) as { parse?: { wikitext?: string }; error?: { code?: string; info?: string } }
      if (body.error?.code === 'missingtitle' || body.error?.code === 'invalidtitle') return { status: 'absent' }
      if (body.error) {
        lastError = `API ${body.error.code}: ${body.error.info ?? ''}`
        continue
      }
      if (typeof body.parse?.wikitext !== 'string') {
        lastError = 'no wikitext in response'
        continue
      }
      return { status: 'found', wikitext: body.parse.wikitext }
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e)
    }
  }
  return { status: 'error', error: lastError }
}

async function wiktionaryPage(site: 'en' | 'zh', title: string): Promise<WiktionaryPage> {
  const r = await fetchWikitext(site, title)
  if (r.status === 'error') return { site, title, status: 'error', error: r.error }
  if (r.status === 'absent') return { site, title, status: 'absent' }
  const info = parseWikitext(r.wikitext, site)
  return { site, title, status: info.hasChinese ? 'found' : 'absent', info }
}

/** en.wiktionary first (following one {{zh-see}} soft redirect), zh.wiktionary when en has nothing. */
async function wiktionaryFor(forms: string[]): Promise<WiktionaryPage[]> {
  const pages: WiktionaryPage[] = []
  for (const form of forms) {
    const en = await wiktionaryPage('en', form)
    pages.push(en)
    if (en.status === 'found') {
      if (en.info?.see && en.info.see !== form) pages.push(await wiktionaryPage('en', en.info.see))
      return pages
    }
  }
  for (const form of forms) {
    const zh = await wiktionaryPage('zh', form)
    pages.push(zh)
    if (zh.status === 'found') return pages
  }
  return pages
}

// ---------- Tatoeba ----------
async function scanTatoeba(path: string, matcher: TatoebaMatcher): Promise<number> {
  const rl = createInterface({ input: createReadStream(path, { encoding: 'utf8' }), crlfDelay: Infinity })
  let first = true
  let rows = 0
  for await (const raw of rl) {
    const line = first ? raw.replace(/^﻿/, '') : raw
    if (line === '') continue
    const cols = line.split('\t')
    if (first) {
      console.log(`tatoeba: ${path}\n  first line: ${line.length > 200 ? `${line.slice(0, 200)}...` : line}`)
      if (cols.length < 3 || !/^\d+$/.test(cols[0]) || cols[1] !== 'cmn')
        fail(`${path}: expected tab-separated columns "id, lang (cmn), text, ..." but the first line has ${cols.length} column(s)`)
      first = false
    }
    if (cols.length < 3 || !/^\d+$/.test(cols[0]) || cols[1] !== 'cmn') continue
    rows++
    matcher.add(Number(cols[0]), cols[2].trim())
  }
  if (first) fail(`${path} is empty`)
  console.log(`  cmn rows: ${rows}`)
  return rows
}

// ---------- main ----------
async function main() {
  const tatoebaPath = argValue('--tatoeba')
  if (!tatoebaPath) return fail('usage: npm run fetch:casual-evidence -- --tatoeba <cmn_sentences.tsv> [--date YYYY-MM-DD]')
  const fetchedAt = argValue('--date') ?? new Date().toISOString().slice(0, 10)
  const candidates = (JSON.parse(readFileSync(new URL('data/hsk1/casual-candidates.json', root), 'utf8')) as CandidatesFile).items
  const items = [...candidates].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))

  const cedict = indexCedict(JSON.parse(readFileSync(new URL('node_modules/cedict-json/cedict.json', root), 'utf8')) as CedictEntry[])
  const matcher = new TatoebaMatcher(items.map((c) => ({ key: c.id, forms: [c.hanzi, ...c.variants] })))
  await scanTatoeba(resolve(tatoebaPath), matcher)

  const out: RawEvidenceFile = { version: 1, fetchedAt, tatoebaFile: basename(tatoebaPath), items: [] }
  for (const c of items) {
    const forms = [c.hanzi, ...c.variants]
    const wiktionary = combineWiktionary(await wiktionaryFor(forms))
    const entry = { id: c.id, hanzi: c.hanzi, variants: c.variants, cedict: lookupCedict(cedict, forms), wiktionary, tatoeba: matcher.get(c.id) }
    out.items.push(entry)
    console.log(`${c.id} ${c.hanzi}: cedict=${entry.cedict.found} wiktionary=${wiktionary.status} [${wiktionary.labels.join(', ')}] tatoeba=${entry.tatoeba.count}`)
  }
  writeFileSync(new URL('data/hsk1/casual-evidence-raw.json', root), formatJson(out))
  const errors = out.items.filter((i) => i.wiktionary.status === 'error').length
  console.log(`\nwritten ${out.items.length} items; wiktionary errors: ${errors}`)
}

await main()
