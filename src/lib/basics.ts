// Tahap 0 · Dasar: bentuk data data/basics/basics.json + fungsi bantu murni.
// Data dimuat lewat import() dinamis supaya tidak ikut bundle utama.
import type { Bilingual } from './lesson-types.ts'

export const BASICS_PARTS = ['pinyin', 'nada', 'perubahan-nada', 'coretan', 'radikal', 'ungkapan'] as const
export type BasicsPart = (typeof BASICS_PARTS)[number]

export const isBasicsPart = (s: string): s is BasicsPart => (BASICS_PARTS as readonly string[]).includes(s)

export function nextPart(part: BasicsPart): BasicsPart | null {
  const i = BASICS_PARTS.indexOf(part)
  return BASICS_PARTS[i + 1] ?? null
}

/** Item yang bersuara: audioId (nama file), hanzi (dibacakan), pinyin (target bunyi, bertanda nada). */
export interface AudioItem {
  audioId: string
  hanzi: string
  pinyin: string
}

export interface SoundItem extends AudioItem {
  /** Bunyi awal/akhir dalam pinyin (mis. "zh", "üe"). */
  sound: string
  group: string
  meaning: Bilingual
  /** Pengecoh mirip (suku kata bertanda nada, nada sama dengan pinyin). */
  distractors: string[]
  note?: Bilingual
}

export type ToneNo = 1 | 2 | 3 | 4 | 5

export interface ToneInfo {
  tone: ToneNo
  mark: string
  /** Tinggi nada 1..5 (skala Chao), untuk garis nada SVG. */
  contour: number[]
  name: Bilingual
  desc: Bilingual
}

export interface ToneSetItem extends AudioItem {
  meaning: Bilingual
}

export interface NeutralItem extends AudioItem {
  syllables: string[]
  meaning: Bilingual
}

export interface SandhiExample extends AudioItem {
  /** Pinyin dasar per huruf. */
  base: string[]
  /** Pinyin yang diucapkan per huruf. */
  spoken: string[]
  /** Suku kata yang (bisa) berubah. */
  focus: number
  meaning: Bilingual
}

export interface SandhiRule {
  id: string
  title: Bilingual
  rule: Bilingual
  examples: SandhiExample[]
}

export type StrokeId = 'dian' | 'heng' | 'shu' | 'pie' | 'na' | 'ti' | 'zhe' | 'gou'

export interface BasicStroke {
  id: StrokeId
  hanzi: string
  pinyin: string
  meaning: Bilingual
  desc: Bilingual
  /** Contoh: coretan ke-`stroke` (mulai 0) dari huruf `char`. */
  example: { char: string; stroke: number }
}

export interface StrokeRule {
  id: string
  hanzi: string
  pinyin: string
  text: Bilingual
  examples: { char: string; first: StrokeId; avoid?: StrokeId[] }[]
}

export interface RadicalExample extends AudioItem {
  meaning: Bilingual
  /** Radikal lain (dari daftar) yang juga ada di huruf ini. */
  also?: string[]
}

export interface Radical {
  radical: string
  variant?: string
  from: string
  pinyin: string
  meaning: Bilingual
  examples: RadicalExample[]
}

export type Layout = 'lr' | 'tb' | 'oi'

export interface Composition {
  audioId?: string
  hanzi: string
  pinyin: string
  parts: string[]
  layout: Layout
  meaning: Bilingual
  note: Bilingual
}

export interface NumberItem extends AudioItem {
  value: number
  meaning: Bilingual
}

export interface Greeting extends AudioItem {
  meaning: Bilingual
  use: Bilingual
}

export interface BasicsData {
  version: 1
  pinyin: { intro: Bilingual; initials: SoundItem[]; finals: SoundItem[] }
  tones: { intro: Bilingual; tones: ToneInfo[]; sets: { id: string; items: ToneSetItem[] }[]; neutral: NeutralItem[] }
  sandhi: { intro: Bilingual; rules: SandhiRule[] }
  strokes: { intro: Bilingual; basic: BasicStroke[]; rules: StrokeRule[] }
  radicals: { intro: Bilingual; items: Radical[]; compositions: Composition[] }
  phrases: { intro: Bilingual; numbers: NumberItem[]; greetings: Greeting[] }
}

/** Semua objek ber-audioId (urut kemunculan), sama dengan scripts/tts-basics/basics.py. */
export function audioItems(data: unknown): AudioItem[] {
  const out: AudioItem[] = []
  const walk = (node: unknown) => {
    if (Array.isArray(node)) node.forEach(walk)
    else if (typeof node === 'object' && node !== null) {
      const o = node as Record<string, unknown>
      if (typeof o.audioId === 'string') out.push({ audioId: o.audioId, hanzi: String(o.hanzi), pinyin: String(o.pinyin) })
      Object.values(o).forEach(walk)
    }
  }
  walk(data)
  return out
}

const HAN = /[\u3400-\u9fff]/

/** Huruf Han yang tampil di Tahap 0 (untuk data coretan & font), urut kode. */
export function basicsChars(data: BasicsData): string[] {
  const set = new Set<string>()
  const add = (s: string) => {
    for (const ch of s) if (HAN.test(ch)) set.add(ch)
  }
  for (const s of [...data.pinyin.initials, ...data.pinyin.finals]) add(s.hanzi)
  for (const set of data.tones.sets) for (const i of set.items) add(i.hanzi)
  for (const n of data.tones.neutral) add(n.hanzi)
  for (const r of data.sandhi.rules) for (const e of r.examples) add(e.hanzi)
  for (const s of data.strokes.basic) add(s.hanzi + s.example.char)
  for (const r of data.strokes.rules) add(r.hanzi + r.examples.map((e) => e.char).join(''))
  for (const r of data.radicals.items) add(r.radical + (r.variant ?? '') + r.from + r.examples.map((e) => e.hanzi).join(''))
  for (const c of data.radicals.compositions) add(c.hanzi + c.parts.join(''))
  for (const n of data.phrases.numbers) add(n.hanzi)
  for (const g of data.phrases.greetings) add(g.hanzi)
  return [...set].sort((a, b) => a.codePointAt(0)! - b.codePointAt(0)!)
}

let cache: Promise<BasicsData> | null = null

export function loadBasics(): Promise<BasicsData> {
  if (!cache) {
    cache = import('../../data/basics/basics.json').then((m) => m.default as unknown as BasicsData)
    cache.catch(() => (cache = null))
  }
  return cache
}

/** Indeks suku kata yang dibaca berbeda dari tulisan dasarnya. */
export const changedSyllables = (ex: Pick<SandhiExample, 'base' | 'spoken'>) =>
  new Set(ex.base.map((b, i) => (b !== ex.spoken[i] ? i : -1)).filter((i) => i >= 0))
