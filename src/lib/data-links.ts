// Link check for the learning data (task 2b): every word / unit id mentioned anywhere must exist, every word is in
// exactly one unit, and the files built from the data (public/data/hsk1, scene index, stroke files) agree with it.
// Pure function (no file access): scripts/check-data.ts loads the files, src/lib/data-links.test.ts tests it.

export interface DataSet {
  words: { id: string; hanzi: string; chars: string[] }[]
  units: { id: string; order: number; words: string[] }[]
  sentences: { tatoebaId: number; words: string[]; unit: string }[]
  casual: { id: string; unit: string; hsk: { wordIds: string[] } }[]
  dialogs: { id: string; unit: string; lines: { tokens: { wordId?: string; casualId?: string }[] }[] }[]
  visuals: { wordId: string; pairWordId?: string }[]
  scenes: { wordId: string; unitId: string }[]
  /** public/data/hsk1/index.json */
  lessonIndex: { units: { id: string; order: number; wordCount: number }[] }
  /** public/data/hsk1/units/<id>.json, by file name without .json */
  lessonUnits: Record<string, LessonUnitFile>
  /** public/art/scenes/index.json: word ids that have an illustration */
  sceneIndexIds: string[]
  /** File names in public/hanzi without .json (the character) */
  hanziChars: string[]
  preview: {
    words: { id: string; hsk: number; previewFrom?: string }[]
    visuals: { wordId: string }[]
    scenes: { wordId: string }[]
  }
}

export interface LessonUnitFile {
  unit: { id: string }
  words: { id: string; examples: unknown[] }[]
  casual: { id: string; unit: string; hsk: { wordIds: string[] } }[]
  relatedCasual: { id: string; hsk: { wordIds: string[] } }[]
  dialog: { id: string } | null
}

const dupes = (ids: string[]): string[] => [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))]

/** Returns one message per problem; empty means all links are fine. */
export function checkDataLinks(d: DataSet): string[] {
  const errors: string[] = []
  const wordIds = new Set(d.words.map((w) => w.id))
  const unitIds = new Set(d.units.map((u) => u.id))
  const unitOf = new Map<string, string>()
  const word = (where: string, id: string | undefined) => {
    if (id !== undefined && !wordIds.has(id)) errors.push(`${where}: unknown word id ${id}`)
  }
  const unit = (where: string, id: string) => {
    if (!unitIds.has(id)) errors.push(`${where}: unknown unit ${id}`)
  }

  for (const id of dupes(d.words.map((w) => w.id))) errors.push(`words.json: duplicate id ${id}`)
  for (const id of dupes(d.units.map((u) => u.id))) errors.push(`units.json: duplicate unit ${id}`)

  // units.json: every word in exactly one unit
  for (const u of d.units) {
    for (const id of u.words) {
      word(`units.json ${u.id}`, id)
      if (unitOf.has(id)) errors.push(`units.json: word ${id} is in both ${unitOf.get(id)} and ${u.id}`)
      else unitOf.set(id, u.id)
    }
  }
  for (const w of d.words) if (!unitOf.has(w.id)) errors.push(`units.json: word ${w.id} ${w.hanzi} is in no unit`)

  for (const s of d.sentences) {
    unit(`sentences.json ${s.tatoebaId}`, s.unit)
    for (const id of s.words) word(`sentences.json ${s.tatoebaId}`, id)
  }
  for (const c of d.casual) {
    unit(`casual.json ${c.id}`, c.unit)
    for (const id of c.hsk.wordIds) word(`casual.json ${c.id}`, id)
  }
  const casualIds = new Set(d.casual.map((c) => c.id))
  for (const dl of d.dialogs) {
    unit(`dialogs.json ${dl.id}`, dl.unit)
    for (const line of dl.lines) {
      for (const t of line.tokens) {
        word(`dialogs.json ${dl.id}`, t.wordId)
        if (t.casualId !== undefined && !casualIds.has(t.casualId)) errors.push(`dialogs.json ${dl.id}: unknown casual id ${t.casualId}`)
      }
    }
  }
  for (const v of d.visuals) {
    word('visuals.json', v.wordId)
    word(`visuals.json ${v.wordId} pairWordId`, v.pairWordId)
  }
  for (const id of dupes(d.visuals.map((v) => v.wordId))) errors.push(`visuals.json: two entries for ${id}`)
  for (const id of wordIds) if (!d.visuals.some((v) => v.wordId === id)) errors.push(`visuals.json: no entry for ${id}`)
  for (const s of d.scenes) {
    word('scenes.json', s.wordId)
    unit(`scenes.json ${s.wordId}`, s.unitId)
    if (unitOf.has(s.wordId) && unitOf.get(s.wordId) !== s.unitId) errors.push(`scenes.json ${s.wordId}: unitId ${s.unitId} but the word is in ${unitOf.get(s.wordId)}`)
  }
  for (const id of dupes(d.scenes.map((s) => s.wordId))) errors.push(`scenes.json: two scenes for ${id}`)

  // public/data/hsk1
  if (d.lessonIndex.units.map((u) => u.id).join() !== d.units.map((u) => u.id).join()) errors.push('public/data/hsk1/index.json: unit list differs from units.json')
  for (const u of d.units) {
    const file = d.lessonUnits[u.id]
    if (!file) {
      errors.push(`public/data/hsk1/units/${u.id}.json: missing`)
      continue
    }
    const at = `public/data/hsk1/units/${u.id}.json`
    if (file.unit.id !== u.id) errors.push(`${at}: unit id ${file.unit.id}`)
    if (file.words.map((w) => w.id).join() !== u.words.join()) errors.push(`${at}: words differ from units.json`)
    const index = d.lessonIndex.units.find((x) => x.id === u.id)
    if (index && index.wordCount !== u.words.length) errors.push(`public/data/hsk1/index.json ${u.id}: wordCount ${index.wordCount} but ${u.words.length} words`)
    for (const c of [...file.casual, ...file.relatedCasual]) for (const id of c.hsk.wordIds) word(`${at} casual ${c.id}`, id)
    for (const c of file.casual) if (c.unit !== u.id) errors.push(`${at}: casual ${c.id} belongs to ${c.unit}`)
  }
  for (const name of Object.keys(d.lessonUnits)) if (!unitIds.has(name)) errors.push(`public/data/hsk1/units/${name}.json: no such unit in units.json`)
  for (const id of d.sceneIndexIds) word('public/art/scenes/index.json', id)
  const sceneIds = new Set(d.scenes.map((s) => s.wordId))
  if (d.sceneIndexIds.join() !== d.scenes.map((s) => s.wordId).join() || sceneIds.size !== d.sceneIndexIds.length) errors.push('public/art/scenes/index.json: differs from scenes.json')
  const have = new Set(d.hanziChars)
  for (const w of d.words) for (const ch of w.chars) if (!have.has(ch)) errors.push(`public/hanzi: no stroke file for ${ch} (${w.id} ${w.hanzi})`)

  // HSK 2 preview: separate ids, nothing of it in HSK 1
  const previewIds = new Set(d.preview.words.map((w) => w.id))
  for (const id of previewIds) if (wordIds.has(id)) errors.push(`hsk2-preview/words.json: ${id} is also an HSK 1 word`)
  for (const id of dupes(d.preview.words.map((w) => w.id))) errors.push(`hsk2-preview/words.json: duplicate id ${id}`)
  for (const w of d.preview.words) if (w.hsk !== 2 || w.previewFrom !== 'hsk1-2021') errors.push(`hsk2-preview/words.json ${w.id}: needs hsk 2 and previewFrom hsk1-2021`)
  for (const v of d.preview.visuals) if (!previewIds.has(v.wordId)) errors.push(`hsk2-preview/visuals.json: ${v.wordId} is not a preview word`)
  for (const s of d.preview.scenes) if (!previewIds.has(s.wordId)) errors.push(`hsk2-preview/scenes.json: ${s.wordId} is not a preview word`)
  return errors
}
