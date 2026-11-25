// Membangun file pelajaran public/data/hsk1/{index.json, units/<id>.json} dari data/hsk1/*.json.
// Fungsi murni (tanpa akses file) supaya bisa dites: hasilnya harus sama dengan file yang di-commit.
// Dipakai oleh scripts/build-lessons.ts dan scripts/build-strokes.ts.
import { formatJson } from './casual.ts'
import { splitSyllables, type Tone } from './pinyin.ts'
import type { Bilingual, CasualItem, CasualLabel, Example, ExampleTranslation, LessonDialog, LessonIndex, LessonWord, PlaceKind, UnitData } from './lesson-types.ts'

export const EXAMPLES_PER_WORD = 3

export interface SrcWord {
  id: string
  hanzi: string
  pinyin: string
  syllables: string[]
  tones: Tone[]
  pos: string[]
  en: string[]
  ind: string[]
  idMachine: boolean
  chars: string[]
}
export interface SrcUnit {
  id: string
  order: number
  slug: string
  title: Bilingual
  description: Bilingual
  words: string[]
}
export interface SrcSentence {
  tatoebaId: number
  cmn: string
  author: string
  license: string
  ok: boolean
  outside: string | null
  words: string[]
  unit: string
  en: ExampleTranslation[]
  ind: ExampleTranslation[]
}
export interface SrcCasual {
  id: string
  unit: string
  hanzi: string
  pinyin: string
  label: CasualLabel
  hsk: { hanzi: string; wordIds: string[] }
  meaning: Bilingual
  situation: Bilingual
  evidence: string[]
  machine: boolean
}
export interface SrcDialog {
  id: string
  unit: string
  title: Bilingual
  place: Bilingual
  placeKind: PlaceKind
  goal: Bilingual
  situation: Bilingual
  machine: boolean
  lines: {
    speaker: string
    gender: 'female' | 'male'
    cmn: string
    tokens: { text: string; pinyin?: string }[]
    en: string
    id: string
    machine: boolean
  }[]
}
export interface LessonsInput {
  words: SrcWord[]
  units: SrcUnit[]
  sentences: SrcSentence[]
  casual: SrcCasual[]
  dialogs: { speakers: Record<string, { name: Bilingual; gender: 'female' | 'male' }>; dialogs: SrcDialog[] }
}

const translation = (t: ExampleTranslation | undefined): ExampleTranslation | null =>
  t ? { tatoebaId: t.tatoebaId, text: t.text, author: t.author, license: t.license } : null

/**
 * Maksimal 3 kalimat per kata, urutan pasti: kalimat yang hanya memakai kata unit ini atau sebelumnya,
 * tanpa kata di luar HSK 1, punya terjemahan Indonesia, bertanda OK, lebih pendek, id Tatoeba terkecil.
 */
export function pickExamples(wordId: string, unitOrder: number, sentences: SrcSentence[], orderOf: Map<string, number>): Example[] {
  const key = (s: SrcSentence) => [
    (orderOf.get(s.unit) ?? Infinity) <= unitOrder ? 0 : 1,
    s.outside === null ? 0 : 1,
    s.ind.length > 0 ? 0 : 1,
    s.ok ? 0 : 1,
    [...s.cmn].length,
    s.tatoebaId,
  ]
  const cmp = (a: SrcSentence, b: SrcSentence) => {
    const ka = key(a)
    const kb = key(b)
    for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i] - kb[i]
    return 0
  }
  const seen = new Set<string>()
  const out: Example[] = []
  for (const s of sentences.filter((x) => x.words.includes(wordId)).sort(cmp)) {
    if (out.length === EXAMPLES_PER_WORD) break
    if (seen.has(s.cmn)) continue
    seen.add(s.cmn)
    out.push({
      tatoebaId: s.tatoebaId,
      cmn: s.cmn,
      author: s.author,
      license: s.license,
      outside: s.outside,
      en: translation(s.en[0]),
      ind: translation(s.ind[0]),
    })
  }
  return out
}

function casualItem(c: SrcCasual): CasualItem {
  return {
    id: c.id,
    unit: c.unit,
    hanzi: c.hanzi,
    pinyin: c.pinyin,
    syllables: splitSyllables(c.pinyin),
    label: c.label,
    hsk: { hanzi: c.hsk.hanzi, wordIds: [...c.hsk.wordIds] },
    meaning: { id: c.meaning.id, en: c.meaning.en },
    situation: { id: c.situation.id, en: c.situation.en },
    evidence: [...c.evidence],
    machine: c.machine,
  }
}

function lessonDialog(d: SrcDialog, speakers: LessonsInput['dialogs']['speakers']): LessonDialog {
  const used: LessonDialog['speakers'] = {}
  for (const l of d.lines) {
    const sp = speakers[l.speaker]
    if (!sp) throw new Error(`dialog ${d.id}: unknown speaker ${l.speaker}`)
    used[l.speaker] = { name: { id: sp.name.id, en: sp.name.en }, gender: sp.gender }
  }
  return {
    id: d.id,
    title: { id: d.title.id, en: d.title.en },
    place: { id: d.place.id, en: d.place.en },
    placeKind: d.placeKind,
    goal: { id: d.goal.id, en: d.goal.en },
    situation: { id: d.situation.id, en: d.situation.en },
    machine: d.machine,
    speakers: used,
    lines: d.lines.map((l) => ({
      speaker: l.speaker,
      gender: l.gender,
      cmn: l.cmn,
      tokens: l.tokens.map((t) => (t.pinyin ? { text: t.text, pinyin: t.pinyin } : { text: t.text })),
      en: l.en,
      id: l.id,
      machine: l.machine,
    })),
  }
}

/** Isi file keluaran: path relatif terhadap public/data/hsk1/ -> teks JSON. */
export function buildLessons(input: LessonsInput): Record<string, string> {
  const wordById = new Map(input.words.map((w) => [w.id, w]))
  const units = [...input.units].sort((a, b) => a.order - b.order)
  const orderOf = new Map(units.map((u) => [u.id, u.order]))
  const index: LessonIndex = {
    version: 1,
    units: units.map((u) => ({
      id: u.id,
      order: u.order,
      slug: u.slug,
      title: { id: u.title.id, en: u.title.en },
      description: { id: u.description.id, en: u.description.en },
      wordCount: u.words.length,
    })),
  }
  const out: Record<string, string> = { 'index.json': formatJson(index) }
  for (const u of units) {
    const words: LessonWord[] = u.words.map((id) => {
      const w = wordById.get(id)
      if (!w) throw new Error(`unit ${u.id}: unknown word ${id}`)
      return {
        id: w.id,
        hanzi: w.hanzi,
        pinyin: w.pinyin,
        syllables: [...w.syllables],
        tones: [...w.tones],
        pos: [...w.pos],
        en: [...w.en],
        ind: [...w.ind],
        idMachine: w.idMachine,
        chars: [...w.chars],
        examples: pickExamples(w.id, u.order, input.sentences, orderOf),
      }
    })
    const own = new Set(u.words)
    const casual = input.casual.filter((c) => c.unit === u.id).map(casualItem)
    const relatedCasual = input.casual
      .filter((c) => c.unit !== u.id && c.hsk.wordIds.some((id) => own.has(id)))
      .map(casualItem)
    const dialog = input.dialogs.dialogs.find((d) => d.unit === u.id)
    const data: UnitData = {
      version: 1,
      unit: { id: u.id, order: u.order, slug: u.slug, title: { ...u.title }, description: { ...u.description } },
      words,
      casual,
      relatedCasual,
      dialog: dialog ? lessonDialog(dialog, input.dialogs.speakers) : null,
    }
    out[`units/${u.id}.json`] = formatJson(data)
  }
  return out
}

const HAN = /\p{Script=Han}/u

/** Huruf yang butuh data coretan: semua huruf kata HSK 1 dan ungkapan santai, urut kode Unicode. */
export function strokeChars(words: Pick<SrcWord, 'hanzi'>[], casual: Pick<SrcCasual, 'hanzi'>[], extra: string[] = []): string[] {
  const set = new Set<string>()
  for (const x of [...words, ...casual, ...extra.map((hanzi) => ({ hanzi }))]) for (const ch of x.hanzi) if (HAN.test(ch)) set.add(ch)
  return [...set].sort((a, b) => a.codePointAt(0)! - b.codePointAt(0)!)
}

/** Nama file data coretan (huruf itu sendiri; aman di URL lewat encodeURIComponent saat dimuat). */
export const strokeFileName = (ch: string) => `${ch}.json`
