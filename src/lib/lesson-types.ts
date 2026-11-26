// Bentuk file pelajaran di public/data/hsk1/ (dibuat oleh scripts/build-lessons.ts).
import type { Tone } from './pinyin.ts'

export interface Bilingual {
  id: string
  en: string
}

export interface LessonUnitInfo {
  id: string
  order: number
  slug: string
  title: Bilingual
  description: Bilingual
  wordCount: number
}

export interface LessonIndex {
  version: 1
  units: LessonUnitInfo[]
}

export interface ExampleTranslation {
  tatoebaId: number
  text: string
  author: string
  license: string
}

export interface Example {
  tatoebaId: number
  cmn: string
  author: string
  license: string
  /** Kata di luar HSK 1 di kalimat ini (atau null). */
  outside: string | null
  en: ExampleTranslation | null
  ind: ExampleTranslation | null
}

export interface LessonWord {
  id: string
  hanzi: string
  pinyin: string
  syllables: string[]
  tones: Tone[]
  pos: string[]
  en: string[]
  ind: string[]
  idMachine: boolean
  /** Huruf unik (untuk panel coretan). */
  chars: string[]
  examples: Example[]
  /** Kalimat contoh utama yang digambar di adegan (task 6c). */
  sentence: WordSentence | null
  /** Dialog pendek untuk kata yang butuh percakapan (task 6c), atau null. */
  dialog: WordDialog | null
}

/** Kalimat utama per kata (dari data/hsk1/word-sentences.json, hanya field untuk layar). */
export interface WordSentence {
  hanzi: string
  pinyin: string
  id: string
  en: string
  /** id tokoh (kunci di UnitData.speakers), atau null */
  speaker: string | null
  source: 'unit' | 'tatoeba' | 'buatan'
  sourceId: string | number | null
  /** Kata di luar HSK 1 di kalimat ini. */
  outsideWords: string[]
  /** Atribusi Tatoeba (hanya bila source = 'tatoeba'). */
  author?: string
  license?: string
}

export interface WordDialogLine {
  /** id tokoh (kunci di UnitData.speakers) */
  who: string
  hanzi: string
  pinyin: string
  id: string
  en: string
  outsideWords: string[]
}

export interface WordDialog {
  reason: Bilingual
  lines: WordDialogLine[]
}

export interface Speaker {
  name: Bilingual
  gender: 'female' | 'male'
}

export type CasualLabel = 'santai' | 'gaul' | 'kasar'

export interface CasualItem {
  id: string
  unit: string
  hanzi: string
  pinyin: string
  syllables: string[]
  label: CasualLabel
  hsk: { hanzi: string; wordIds: string[] }
  meaning: Bilingual
  situation: Bilingual
  evidence: string[]
  machine: boolean
}

export interface DialogToken {
  text: string
  pinyin?: string
}

export interface DialogLine {
  speaker: string
  gender: 'female' | 'male'
  cmn: string
  tokens: DialogToken[]
  en: string
  id: string
  machine: boolean
}

/** Jenis tempat dialog (task 3d); ikon kecil di DialogCard. */
export type PlaceKind = 'home' | 'school' | 'market' | 'eatery' | 'shop' | 'transport' | 'phone' | 'office' | 'street' | 'clinic' | 'park'

export interface LessonDialog {
  id: string
  title: Bilingual
  place: Bilingual
  placeKind: PlaceKind
  goal: Bilingual
  situation: Bilingual
  machine: boolean
  speakers: Record<string, { name: Bilingual; gender: 'female' | 'male' }>
  lines: DialogLine[]
}

export interface UnitData {
  version: 1
  unit: Omit<LessonUnitInfo, 'wordCount'>
  words: LessonWord[]
  /** Ungkapan santai unit ini. */
  casual: CasualItem[]
  /** Ungkapan dari unit lain yang padanan HSK-nya memakai kata unit ini (untuk layar kenalan kata). */
  relatedCasual: CasualItem[]
  dialog: LessonDialog | null
  /** Tokoh yang dipakai kalimat/dialog kata unit ini (nama ID/EN + suara). */
  speakers: Record<string, Speaker>
}
