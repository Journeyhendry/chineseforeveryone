// Builds the casual-expression and dialog outputs from the draft, the fetched evidence and the review.
//
//   npm run build:casual
//
// Reads data/hsk1/casual-candidates.json, dialogs-draft.json, casual-evidence-raw.json, casual-review.json
// (the last three may be missing: then every candidate fails layer 2 or 3) and casual-remap.json (which unit each
// draft goes to in the 2025 units, task 2b) and writes casual.json, casual-evidence.json, dialogs.json,
// dialogs-retired.json and casual-report.json. Deterministic; the rules live in src/lib/casual.ts and
// src/lib/casual-remap.ts.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import type { CandidatesFile, DialogsFile, RawEvidenceFile, ReviewFile } from '../src/lib/casual.ts'
import { buildCasualRemapped, type CasualRemap } from '../src/lib/casual-remap.ts'
import type { UnitInput, WordInput } from '../src/lib/sentences.ts'

const root = new URL('..', import.meta.url)
const dataUrl = (name: string) => new URL(`data/hsk1/${name}`, root)

function readOptional<T>(name: string): T | null {
  const url = dataUrl(name)
  if (!existsSync(url)) {
    console.log(`${name}: missing`)
    return null
  }
  return JSON.parse(readFileSync(url, 'utf8')) as T
}

const words = JSON.parse(readFileSync(dataUrl('words.json'), 'utf8')) as (WordInput & { pinyin: string })[]
const units = (JSON.parse(readFileSync(dataUrl('units.json'), 'utf8')) as { units: UnitInput[] }).units
const candidates = readOptional<CandidatesFile>('casual-candidates.json') ?? { version: 1, items: [] }

const out = buildCasualRemapped({
  remap: JSON.parse(readFileSync(dataUrl('casual-remap.json'), 'utf8')) as CasualRemap,
  words,
  units,
  candidates,
  dialogs: readOptional<DialogsFile>('dialogs-draft.json'),
  evidence: readOptional<RawEvidenceFile>('casual-evidence-raw.json'),
  reviews: readOptional<ReviewFile>('casual-review.json'),
})
for (const [name, text] of Object.entries(out)) writeFileSync(dataUrl(name), text)

const report = JSON.parse(out['casual-report.json']) as {
  totals: Record<string, number>
  unitsBelowThree: { unit: string; count: number }[]
  failedDialogs: { id: string; reasons: string[] }[]
  droppedCandidates: { id: string }[]
}
console.log(`totals: ${JSON.stringify(report.totals)}`)
console.log(`dropped candidates: ${report.droppedCandidates.length}`)
console.log(`units below 3: ${report.unitsBelowThree.map((u) => `${u.unit}(${u.count})`).join(' ') || 'none'}`)
for (const d of report.failedDialogs) console.log(`dialog ${d.id} failed: ${d.reasons.join('; ')}`)
