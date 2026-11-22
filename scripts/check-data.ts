// Link check of the learning data.
//
//   npm run check:data
//
// Every word / unit id in units, sentences, casual, dialogs, visuals, scenes and public/data/hsk1 must exist,
// every word is in exactly one unit, and the files built from the data agree. Exits with code 1 on any problem.
import { readdirSync, readFileSync } from 'node:fs'
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
console.log(
  `words ${data.words.length}, units ${data.units.length}, sentences ${data.sentences.length}, casual ${data.casual.length}, dialogs ${data.dialogs.length}, visuals ${data.visuals.length}, scenes ${data.scenes.length}, HSK 2 preview words ${data.preview.words.length}`,
)
if (errors.length > 0) {
  console.error(`\n${errors.length} problem(s):`)
  for (const e of errors) console.error(`  - ${e}`)
  process.exit(1)
}
console.log('OK: all ids and links are fine')
