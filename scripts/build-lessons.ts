// Membangun file pelajaran untuk website.
//
//   npm run build:lessons
//
// Membaca data/hsk1/{words,units,sentences,casual,dialogs,word-sentences,dialogs-natural}.json dan menulis public/data/hsk1/index.json
// + public/data/hsk1/units/<unitId>.json. Deterministik; aturannya ada di src/lib/lessons-build.ts.
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { buildLessons, type LessonsInput } from '../src/lib/lessons-build.ts'

const root = new URL('..', import.meta.url)
const read = <T>(name: string): T => JSON.parse(readFileSync(new URL(`data/hsk1/${name}`, root), 'utf8')) as T
const outDir = new URL('public/data/hsk1/', root)

const input: LessonsInput = {
  words: read('words.json'),
  units: read<{ units: LessonsInput['units'] }>('units.json').units,
  sentences: read<{ sentences: LessonsInput['sentences'] }>('sentences.json').sentences,
  casual: read<{ items: LessonsInput['casual'] }>('casual.json').items,
  dialogs: read('dialogs.json'),
  wordSentences: read<{ entries: LessonsInput['wordSentences'] }>('word-sentences.json').entries,
  speakers: read<{ speakers: LessonsInput['speakers'] }>('dialogs-natural.json').speakers,
}
const out = buildLessons(input)

mkdirSync(new URL('units/', outDir), { recursive: true })
// File unit lama yang tidak dibuat lagi dihapus, supaya folder selalu sama dengan hasil build.
for (const name of readdirSync(new URL('units/', outDir))) {
  if (!(`units/${name}` in out)) rmSync(new URL(`units/${name}`, outDir))
}
let bytes = 0
for (const [name, text] of Object.entries(out)) {
  writeFileSync(new URL(name, outDir), text)
  bytes += Buffer.byteLength(text)
}
console.log(`wrote ${Object.keys(out).length} files (${(bytes / 1024).toFixed(1)} KB) to public/data/hsk1/`)
