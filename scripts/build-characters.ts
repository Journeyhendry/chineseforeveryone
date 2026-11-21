// Builds the character SVGs (front/side/back, four expressions, sheet), the lineup and the manifest.
//
//   npm run build:characters
//
// Output: public/art/characters/. The drawing lives in src/art/characters/ (pure TS); this script
// only writes the files. Deterministic: running it twice gives byte-identical files.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildAll } from '../src/art/characters/index.ts'

const outDir = fileURLToPath(new URL('../public/art/characters/', import.meta.url))
rmSync(outDir, { recursive: true, force: true })

const files = buildAll()
let total = 0
let largest = { path: '', size: 0 }
for (const [path, content] of files) {
  const full = join(outDir, path)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, content)
  const size = Buffer.byteLength(content)
  total += size
  if (size > largest.size) largest = { path, size }
}
console.log(`characters: ${files.size} files, ${(total / 1024).toFixed(1)} KB total, largest ${largest.path} ${(largest.size / 1024).toFixed(1)} KB`)
