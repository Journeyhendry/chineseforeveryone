// Loads everything src/lib/word-sentences.ts needs from disk (shared by build-word-sentences.ts and check-data.ts).
import { existsSync, readFileSync } from 'node:fs'
import { makeContext, type Context, type Speaker, type WordRow } from '../src/lib/word-sentences.ts'
import type { UnitInput } from '../src/lib/sentences.ts'

const root = new URL('..', import.meta.url)
const read = <T>(path: string): T => JSON.parse(readFileSync(new URL(path, root), 'utf8')) as T

export const WORD_SENTENCES = 'data/hsk1/word-sentences.json'
export const WORD_SENTENCES_REPORT = 'data/hsk1/word-sentences-report.json'
export const WORD_SENTENCES_REVIEW = 'data/hsk1/word-sentences-review.json'
export const fileUrl = (path: string) => new URL(path, root)

export function loadWordSentencesInput(): { ctx: Context; drafts: Record<string, unknown> } {
  const units = read<{ units: UnitInput[] }>('data/hsk1/units.json').units
  const natural = read<{ speakers: Record<string, Speaker>; dialogs: { lines: { cmn: string }[] }[] }>('data/hsk1/dialogs-natural.json')
  const sentences = read<{ sentences: { tatoebaId: number; cmn: string }[] }>('data/hsk1/sentences.json').sentences
  const casual = read<{ items: { hanzi: string }[] }>('data/hsk1/casual.json').items
  const ctx = makeContext({
    words: read<WordRow[]>('data/hsk1/words.json'),
    units,
    dictionary: [
      ...read<{ hanzi: string }[]>('data/hsk2-preview/words.json').map((w) => w.hanzi),
      ...read<{ simplified: string }[]>('node_modules/cedict-json/cedict.json').map((c) => c.simplified),
    ],
    speakers: natural.speakers,
    sceneRefs: read<{ scenes: { wordId: string }[] }>('data/hsk1/scenes.json').scenes.map((s) => s.wordId),
    tatoeba: sentences,
    corpus: [...sentences.map((s) => s.cmn), ...natural.dialogs.flatMap((d) => d.lines.map((l) => l.cmn)), ...casual.map((c) => c.hanzi)],
  })
  const drafts: Record<string, unknown> = {}
  for (const u of units) {
    const url = fileUrl(`data/hsk1/word-sentences/${u.id}.json`)
    if (!existsSync(url)) continue
    try {
      drafts[u.id] = JSON.parse(readFileSync(url, 'utf8'))
    } catch (e) {
      drafts[u.id] = (e as Error).message
    }
  }
  return { ctx, drafts }
}
