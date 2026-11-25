// Link check of the learning data.
//
//   npm run check:data
//
// Every word / unit id in units, sentences, casual, dialogs, visuals, scenes and public/data/hsk1 must exist,
// every word is in exactly one unit, and the files built from the data agree. Exits with code 1 on any problem.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { checkDataLinks, type DataSet } from '../src/lib/data-links.ts'

const root = new URL('..', import.meta.url)
const read = <T>(path: string): T => JSON.parse(readFileSync(new URL(path, root), 'utf8')) as T
const hsk1 = <T>(name: string): T => read<T>(`data/hsk1/${name}`)
const names = (dir: string, ext: string) => readdirSync(new URL(dir, root)).filter((n) => n.endsWith(ext)).map((n) => n.slice(0, -ext.length))

const lessonUnits: DataSet['lessonUnits'] = {}
for (const id of names('public/data/hsk1/units/', '.json')) lessonUnits[id] = read(`public/data/hsk1/units/${id}.json`)

const data: DataSet = {
  words: hsk1('words.json'),
  units: hsk1<{ units: DataSet['units'] }>('units.json').units,
  sentences: hsk1<{ sentences: DataSet['sentences'] }>('sentences.json').sentences,
  casual: hsk1<{ items: DataSet['casual'] }>('casual.json').items,
  dialogs: hsk1<{ dialogs: DataSet['dialogs'] }>('dialogs.json').dialogs,
  visuals: hsk1<{ items: DataSet['visuals'] }>('visuals.json').items,
  scenes: hsk1<{ scenes: DataSet['scenes'] }>('scenes.json').scenes,
  lessonIndex: read('public/data/hsk1/index.json'),
  lessonUnits,
  sceneIndexIds: Object.keys(read<{ scenes: Record<string, unknown> }>('public/art/scenes/index.json').scenes),
  hanziChars: names('public/hanzi/', '.json'),
  preview: {
    words: read('data/hsk2-preview/words.json'),
    visuals: read<{ items: DataSet['preview']['visuals'] }>('data/hsk2-preview/visuals.json').items,
    scenes: read<{ scenes: DataSet['preview']['scenes'] }>('data/hsk2-preview/scenes.json').scenes,
  },
}

const errors = checkDataLinks(data)

// Audio freshness: audio-items.json must match the text data, and the generated audio must match audio-items.json.
{
  type AudioItem = { key: string; kind: string; text: string; voice: string; hash: string }
  const audioItems = hsk1<{ items: AudioItem[] }>('audio-items.json').items
  const textWords = hsk1<{ id: string; hanzi: string }[]>('words.json')
  const textSentences = hsk1<{ sentences: { tatoebaId: number; cmn: string }[] }>('sentences.json').sentences
  const textCasual = hsk1<{ items: { id: string; hanzi: string }[] }>('casual.json').items
  const textDialogs = hsk1<{ dialogs: { id: string; lines: { cmn: string; gender: string }[] }[] }>('dialogs.json').dialogs
  const expected: string[] = [
    ...textWords.map((w) => `word|${w.id}|${w.hanzi}|P3`),
    ...textWords.map((w) => `word-slow|${w.id}|${w.hanzi}|P3`),
    ...textSentences.map((s) => `sentence|${s.tatoebaId}|${s.cmn}|P3`),
    ...textCasual.map((c) => `casual|${c.id}|${c.hanzi}|P3`),
    ...textCasual.map((c) => `casual-slow|${c.id}|${c.hanzi}|P3`),
    ...textDialogs.flatMap((d) =>
      d.lines.map((l, n) => `dialog|${d.id}-${String(n + 1).padStart(2, '0')}|${l.cmn}|${l.gender === 'male' ? 'L3' : 'P3'}`),
    ),
  ]
  const actual = audioItems.map((i) => `${i.kind}|${i.key.slice(i.kind.length + 1)}|${i.text}|${i.voice}`)
  if (JSON.stringify(expected) !== JSON.stringify(actual)) {
    errors.push('data/hsk1/audio-items.json is out of date with words/sentences/casual/dialogs: run `python3 scripts/tts-hsk1/hsk1_items.py` and commit, then run the "Build HSK 1 audio" workflow')
  } else if (existsSync(new URL('public/audio/hsk1/manifest.json', root))) {
    const manifest = read<{ files: Record<string, { hash: string; path: string }> }>('public/audio/hsk1/manifest.json')
    const stale = audioItems.filter((i) => manifest.files[i.key]?.hash !== i.hash)
    if (stale.length > 0) {
      errors.push(`${stale.length} audio file(s) are stale or missing (data or settings changed without regenerating audio, e.g. ${stale.slice(0, 3).map((i) => i.key).join(', ')}): run the "Build HSK 1 audio" workflow`)
    }
    for (const [key, e] of Object.entries(manifest.files)) {
      const f = new URL(`public/audio/hsk1/${e.path}`, root)
      if (!existsSync(f) || statSync(f).size <= 1024) errors.push(`audio file missing or too small: ${key} (${e.path})`)
    }
  }
}
console.log(
  `words ${data.words.length}, units ${data.units.length}, sentences ${data.sentences.length}, casual ${data.casual.length}, dialogs ${data.dialogs.length}, visuals ${data.visuals.length}, scenes ${data.scenes.length}, HSK 2 preview words ${data.preview.words.length}`,
)
if (errors.length > 0) {
  console.error(`\n${errors.length} problem(s):`)
  for (const e of errors) console.error(`  - ${e}`)
  process.exit(1)
}
console.log('OK: all ids and links are fine')
