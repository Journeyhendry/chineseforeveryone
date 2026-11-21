// Visual plan per HSK 1 word (task 3c, part B). Pure checks, no file access, so the script
// (scripts/check-visuals.ts) and the tests share the same rules.

export type VisualType = 'object' | 'action' | 'pair' | 'count' | 'position' | 'comic'
export const VISUAL_TYPES: VisualType[] = ['object', 'action', 'pair', 'count', 'position', 'comic']

/** Character ids, same as `speakers` in data/hsk1/dialogs.json. */
export const CHARACTER_IDS = [
  'yeye',
  'nainai',
  'baba',
  'mama',
  'gege',
  'meimei',
  'seller',
  'doctor',
  'teacher',
  'waiter',
  'driver',
  'friend',
  'classmate',
] as const

export const PROP_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/

export interface VisualItem {
  wordId: string
  hanzi: string
  type: VisualType
  scene: { id: string; en: string }
  characters: string[]
  props: string[]
  pairWordId?: string
}

export interface VisualsFile {
  version: number
  items: VisualItem[]
}

export interface WordRef {
  id: string
  hanzi: string
}

/** Returns a list of problems; empty means the file is valid. */
export function validateVisuals(file: VisualsFile, words: WordRef[], characterIds: readonly string[] = CHARACTER_IDS): string[] {
  const errors: string[] = []
  if (file.version !== 1) errors.push(`version must be 1, got ${String(file.version)}`)
  if (!Array.isArray(file.items)) return [...errors, 'items must be an array']

  const byId = new Map(words.map((w) => [w.id, w]))
  const known = new Set(characterIds)
  const seen = new Map<string, number>()

  file.items.forEach((item, i) => {
    const at = `items[${i}] ${item.wordId ?? '?'}`
    const word = byId.get(item.wordId)
    if (!word) errors.push(`${at}: unknown wordId`)
    else if (item.hanzi !== word.hanzi) errors.push(`${at}: hanzi ${item.hanzi} does not match ${word.hanzi}`)
    seen.set(item.wordId, (seen.get(item.wordId) ?? 0) + 1)

    if (!VISUAL_TYPES.includes(item.type)) errors.push(`${at}: invalid type ${String(item.type)}`)
    if (typeof item.scene?.id !== 'string' || !item.scene.id.trim()) errors.push(`${at}: empty scene.id`)
    if (typeof item.scene?.en !== 'string' || !item.scene.en.trim()) errors.push(`${at}: empty scene.en`)

    if (!Array.isArray(item.characters)) errors.push(`${at}: characters must be an array`)
    else {
      for (const c of item.characters) if (!known.has(c)) errors.push(`${at}: unknown character ${c}`)
      if (new Set(item.characters).size !== item.characters.length) errors.push(`${at}: duplicate character`)
    }

    if (!Array.isArray(item.props)) errors.push(`${at}: props must be an array`)
    else {
      for (const p of item.props) if (!PROP_SLUG.test(p)) errors.push(`${at}: prop ${p} is not a lowercase slug`)
      if (new Set(item.props).size !== item.props.length) errors.push(`${at}: duplicate prop`)
    }

    if (item.pairWordId !== undefined) {
      if (item.type !== 'pair') errors.push(`${at}: pairWordId only allowed on type pair`)
      if (item.pairWordId === item.wordId) errors.push(`${at}: pairWordId points to itself`)
      else if (!byId.has(item.pairWordId)) errors.push(`${at}: pairWordId ${item.pairWordId} is not a word`)
    }
  })

  for (const w of words) {
    const n = seen.get(w.id) ?? 0
    if (n === 0) errors.push(`missing entry for ${w.id} ${w.hanzi}`)
    else if (n > 1) errors.push(`${n} entries for ${w.id} ${w.hanzi}`)
  }

  const order = file.items.map((it) => it.wordId)
  const expected = words.map((w) => w.id).filter((id) => seen.has(id))
  if (errors.length === 0 && order.join() !== expected.join()) errors.push('items are not in words.json order')

  return errors
}

export function countByType(items: VisualItem[]): Record<VisualType, number> {
  const counts = Object.fromEntries(VISUAL_TYPES.map((t) => [t, 0])) as Record<VisualType, number>
  for (const it of items) if (it.type in counts) counts[it.type]++
  return counts
}
