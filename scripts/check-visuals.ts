// Checks data/hsk1/visuals.json against words.json and the character list.
//
//   npm run check:visuals
//
// Prints a count per visual type; exits with code 1 if anything is wrong.
import { readFileSync } from 'node:fs'
import { CHARACTER_IDS, countByType, validateVisuals, type VisualsFile, type WordRef } from '../src/lib/visuals.ts'

const root = new URL('..', import.meta.url)
const read = <T>(name: string) => JSON.parse(readFileSync(new URL(`data/hsk1/${name}`, root), 'utf8')) as T

const words = read<WordRef[]>('words.json')
const visuals = read<VisualsFile>('visuals.json')
const speakers = Object.keys(read<{ speakers: Record<string, unknown> }>('dialogs.json').speakers)

const errors = validateVisuals(visuals, words, CHARACTER_IDS)
const missingSpeakers = speakers.filter((s) => !(CHARACTER_IDS as readonly string[]).includes(s))
if (missingSpeakers.length) errors.push(`dialog speakers missing from CHARACTER_IDS: ${missingSpeakers.join(', ')}`)

const counts = countByType(visuals.items ?? [])
console.log(`visuals.json: ${visuals.items?.length ?? 0} items for ${words.length} words`)
for (const [type, n] of Object.entries(counts)) console.log(`  ${type.padEnd(8)} ${n}`)
const pairs = (visuals.items ?? []).filter((it) => it.pairWordId).length
const props = new Set((visuals.items ?? []).flatMap((it) => it.props)).size
console.log(`  with pairWordId: ${pairs}, distinct props: ${props}`)

if (errors.length) {
  console.error(`\n${errors.length} problem(s):`)
  for (const e of errors) console.error(`  - ${e}`)
  process.exit(1)
}
console.log('OK')
