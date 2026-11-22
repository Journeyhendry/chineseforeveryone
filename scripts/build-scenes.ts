// Builds the word illustrations from data/hsk1/scenes.json.
//
//   npm run build:scenes
//
// Output: public/art/scenes/<wordId>.svg + index.json. The drawing lives in src/art/scenes/ and
// src/art/characters/ (pure TS); this script only writes the files. Deterministic: running it
// twice gives byte-identical files.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildScenes, type ScenesFile } from '../src/art/scenes/index.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
const outDir = join(root, 'public/art/scenes')
const data = JSON.parse(readFileSync(join(root, 'data/hsk1/scenes.json'), 'utf8')) as ScenesFile

const files = buildScenes(data)
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
const svgCount = files.size - 1
console.log(`scenes: ${svgCount} SVG + index, ${(total / 1024).toFixed(1)} KB total, avg ${(total / 1024 / Math.max(1, svgCount)).toFixed(1)} KB, largest ${largest.path} ${(largest.size / 1024).toFixed(1)} KB`)
