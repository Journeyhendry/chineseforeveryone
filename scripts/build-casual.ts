// Builds the casual-expression and dialog outputs from the draft, the fetched evidence and the review.
//
//   npm run build:casual
//
// Reads data/hsk1/casual-candidates.json, dialogs-draft.json, casual-evidence-raw.json, casual-review.json
// (the last three may be missing: then every candidate fails layer 2 or 3) and casual-remap.json (which unit each
// draft goes to in the 2025 units, task 2b) and writes casual.json, casual-evidence.json, dialogs.json,
// dialogs-retired.json and casual-report.json. Deterministic; the rules live in src/lib/casual.ts,
// src/lib/casual-remap.ts and src/lib/dialogs-natural.ts.
//
// Dialogs (task 3d): dialogs.json is built from data/hsk1/dialogs-natural.json (one hand-written dialog per unit,
// with place and goal); dialogs that fail the check are left out and printed below. The old drafts of
// dialogs-draft.json are not shown any more and all go to dialogs-retired.json. There is no separate
// build:dialogs step: run npm run build:casual, then npm run build:lessons.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import type { CandidatesFile, DialogsFile, RawEvidenceFile, ReviewFile } from '../src/lib/casual.ts'
import type { CasualRemap } from '../src/lib/casual-remap.ts'
import { buildCasualWithNaturalDialogs, type NaturalDialogsFile } from '../src/lib/dialogs-natural.ts'
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

const out = buildCasualWithNaturalDialogs({
  remap: JSON.parse(readFileSync(dataUrl('casual-remap.json'), 'utf8')) as CasualRemap,
  words,
  units,
  candidates,
  dialogs: readOptional<DialogsFile>('dialogs-draft.json'),
  evidence: readOptional<RawEvidenceFile>('casual-evidence-raw.json'),
  reviews: readOptional<ReviewFile>('casual-review.json'),
  natural: readOptional<NaturalDialogsFile>('dialogs-natural.json'),
})
for (const [name, text] of Object.entries(out)) writeFileSync(dataUrl(name), text)

const report = JSON.parse(out['casual-report.json']) as {
  totals: Record<string, number>
  unitsBelowThree: { unit: string; count: number }[]
  failedDialogs: { id: string; reasons: string[] }[]
  droppedCandidates: { id: string }[]
  unitsWithoutDialog: string[]
  placeVariety: string[]
  dialogs: { id: string; placeKind: string; laterUnitWords: string[] }[]
}
console.log(`totals: ${JSON.stringify(report.totals)}`)
console.log(`dropped candidates: ${report.droppedCandidates.length}`)
console.log(`units below 3: ${report.unitsBelowThree.map((u) => `${u.unit}(${u.count})`).join(' ') || 'none'}`)
for (const d of report.failedDialogs) console.log(`dialog ${d.id} failed: ${d.reasons.join('; ')}`)
console.log(`units without dialog: ${report.unitsWithoutDialog.join(' ') || 'none'}`)
for (const e of report.placeVariety) console.log(`place variety: ${e}`)
for (const d of report.dialogs) console.log(`dialog ${d.id} ${d.placeKind}: ${d.laterUnitWords.length} later-unit word(s)`)
