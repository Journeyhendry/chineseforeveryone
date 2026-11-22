// Builds the word illustrations from data/hsk1/scenes.json (and data/hsk2-preview/scenes.json).
//
//   npm run build:scenes
//
// Output: public/art/scenes/<wordId>.svg + index.json. index.json lists only the HSK 1 scenes; the SVG files of the
// HSK 2 preview words (2021-list words that are not in the 300) are written to the same folder so they are not lost,
// but they are not in the index. The drawing lives in src/art/scenes/ and src/art/characters/ (pure TS); this script
// only writes the files. Deterministic: running it twice gives byte-identical files.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildScenes, type ScenesFile } from '../src/art/scenes/index.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
const outDir = join(root, 'public/art/scenes')
const data = JSON.parse(readFileSync(join(root, 'data/hsk1/scenes.json'), 'utf8')) as ScenesFile

const files = buildScenes(data)
const preview = JSON.parse(readFileSync(join(root, 'data/hsk2-preview/scenes.json'), 'utf8')) as ScenesFile
for (const [path, content] of buildScenes(preview)) {
  if (path === 'index.json') continue
  if (files.has(path)) throw new Error(`scene ${path} is in both data/hsk1 and data/hsk2-preview`)
  files.set(path, content)
}
rmSync(outDir, { recursive: true, force: true })
mkdirSync(outDir, { recursive: true })
let total = 0
let largest = { path: '', size: 0 }
for (const [path, content] of files) {
  writeFileSync(join(outDir, path), content)
  const size = Buffer.byteLength(content)
  total += size
  if (size > largest.size) largest = { path, size }
}
const svgCount = files.size - 1 // minus index.json
console.log(`scenes: ${svgCount} SVG + index, ${(total / 1024).toFixed(1)} KB total, avg ${(total / 1024 / Math.max(1, svgCount)).toFixed(1)} KB, largest ${largest.path} ${(largest.size / 1024).toFixed(1)} KB`)
