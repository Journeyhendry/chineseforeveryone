// Menyalin data coretan Hanzi Writer (paket hanzi-writer-data, lisensi Arphic Public License)
// hanya untuk huruf kata HSK 1, ungkapan santai, dan Tahap 0 (data/basics/basics.json) ke
// public/hanzi/<huruf>.json, plus ARPHICPL.TXT.
//
//   npm run build:strokes
//
// Huruf yang tidak punya data dicetak di akhir; UI menampilkan huruf diam untuk huruf itu.
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { basicsChars, type BasicsData } from '../src/lib/basics.ts'
import { strokeChars, strokeFileName } from '../src/lib/lessons-build.ts'

const root = new URL('..', import.meta.url)
const read = <T>(name: string): T => JSON.parse(readFileSync(new URL(`data/hsk1/${name}`, root), 'utf8')) as T
const require = createRequire(import.meta.url)
const dataDir = dirname(require.resolve('hanzi-writer-data/package.json'))
const outDir = new URL('public/hanzi/', root)

const basics = JSON.parse(readFileSync(new URL('data/basics/basics.json', root), 'utf8')) as BasicsData
const chars = strokeChars(read<{ hanzi: string }[]>('words.json'), read<{ items: { hanzi: string }[] }>('casual.json').items, basicsChars(basics))
mkdirSync(outDir, { recursive: true })

const wanted = new Set(['ARPHICPL.TXT'])
const missing: string[] = []
for (const ch of chars) {
  const src = join(dataDir, strokeFileName(ch))
  if (!existsSync(src)) {
    missing.push(ch)
    continue
  }
  wanted.add(strokeFileName(ch))
  copyFileSync(src, new URL(strokeFileName(ch), outDir))
}
copyFileSync(join(dataDir, 'ARPHICPL.TXT'), new URL('ARPHICPL.TXT', outDir))
for (const name of readdirSync(outDir)) if (!wanted.has(name)) rmSync(new URL(name, outDir))

console.log(`copied ${wanted.size - 1} of ${chars.length} characters to public/hanzi/`)
console.log(`missing stroke data: ${missing.length ? missing.join(' ') : 'none'}`)
