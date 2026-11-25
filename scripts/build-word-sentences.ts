// Merges the per-unit drafts data/hsk1/word-sentences/uNN.json (task 6c stage 1) into
// data/hsk1/word-sentences.json and writes data/hsk1/word-sentences-report.json. Deterministic.
//
//   npm run build:word-sentences                     exit 1 (and write nothing) on validation errors
//   npm run build:word-sentences -- --allow-errors   write the files anyway and exit 0 (drafts still incomplete)
//   npm run build:word-sentences -- --export-review <path>   also write the reviewer input JSON
//
// The rules live in src/lib/word-sentences.ts.
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildOutputs, exportReview, formatJson } from '../src/lib/word-sentences.ts'
import { fileUrl, loadWordSentencesInput, WORD_SENTENCES, WORD_SENTENCES_REPORT } from './word-sentences-input.ts'

const args = process.argv.slice(2)
const allowErrors = args.includes('--allow-errors')
const exportAt = args.indexOf('--export-review')
const exportPath = exportAt >= 0 ? args[exportAt + 1] : undefined
if (exportAt >= 0 && !exportPath) throw new Error('--export-review needs a path')

const { ctx, drafts } = loadWordSentencesInput()
const { result, json, report } = buildOutputs(drafts, ctx)
const errors = result.problems.filter((p) => p.level === 'error')
const warnings = result.problems.length - errors.length
const r = JSON.parse(report) as { totals: { entries: number; dialogs: number; inScopePct: number; draftsMissing: string[] }; sources: Record<string, number> }

console.log(`drafts ${result.present.length}/${ctx.units.length}${r.totals.draftsMissing.length ? ` (missing ${r.totals.draftsMissing.join(' ')})` : ''}`)
console.log(`entries ${r.totals.entries}, dialogs ${r.totals.dialogs}, in scope ${r.totals.inScopePct}%, sources ${JSON.stringify(r.sources)}`)
console.log(`${errors.length} error(s), ${warnings} warning(s)`)
for (const p of errors.slice(0, 30)) console.log(`  ${p.unit} ${p.wordId}: ${p.message}`)
if (errors.length > 30) console.log(`  … ${errors.length - 30} more in ${WORD_SENTENCES_REPORT}`)

if (errors.length > 0 && !allowErrors) {
  console.error('not written: fix the errors or pass --allow-errors')
  process.exit(1)
}
writeFileSync(fileUrl(WORD_SENTENCES), json)
writeFileSync(fileUrl(WORD_SENTENCES_REPORT), report)
console.log(`wrote ${WORD_SENTENCES} and ${WORD_SENTENCES_REPORT}`)
if (exportPath) {
  writeFileSync(resolve(exportPath), formatJson(exportReview(result.file, ctx)))
  console.log(`wrote reviewer input ${exportPath}`)
}
