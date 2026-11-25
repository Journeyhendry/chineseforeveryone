/// <reference types="node" />
import { existsSync, readFileSync, statSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import raw from '../../data/basics/basics.json'
import words from '../../data/hsk1/words.json'
import fontChars from '../assets/fonts/lxgw-wenkai-chars.json'
import { audioItems, basicsChars, BASICS_PARTS, changedSyllables, isBasicsPart, nextPart, type BasicsData } from './basics'
import { normalizeNumbered, splitSyllables, syllableTone, toNumbered } from './pinyin'

const data = raw as unknown as BasicsData
const root = new URL('../../', import.meta.url)
const cedict = JSON.parse(readFileSync(new URL('node_modules/cedict-json/cedict.json', root), 'utf8')) as { simplified: string; pinyin: string }[]

const HAN = /[㐀-鿿]/g
const hanOf = (s: string) => s.match(HAN) ?? []

// Bacaan CC-CEDICT per huruf (bernomor, huruf kecil, ü = v) dan semua suku kata sah (tanpa nada).
const readings = new Map<string, Set<string>>()
const validBases = new Set<string>()
for (const e of cedict) {
  const syl = normalizeNumbered(e.pinyin).split(' ')
  for (const s of syl) if (/^[a-z]+[1-5]$/.test(s)) validBases.add(s.slice(0, -1))
  const chars = [...e.simplified]
  if (chars.length !== syl.length) continue
  chars.forEach((ch, i) => {
    if (!readings.has(ch)) readings.set(ch, new Set())
    readings.get(ch)!.add(syl[i])
  })
}
const num = (syllable: string) => toNumbered(syllable).toLowerCase()
const base = (syllable: string) => num(syllable).slice(0, -1)

/** Suku kata `s` cocok dengan bacaan CEDICT huruf `ch` (nada ringan boleh untuk bacaan apa pun). */
function matchesCedict(ch: string, s: string): boolean {
  const r = readings.get(ch)
  if (!r) return false
  if (r.has(num(s))) return true
  return syllableTone(s) === 5 && [...r].some((x) => x.slice(0, -1) === base(s))
}

const hskWords = new Set(words.map((w) => w.hanzi))
const hskChars = new Set(words.flatMap((w) => [...w.hanzi]))

/** Bisa dipecah jadi kata-kata HSK 1 (pencocokan terpanjang dulu). */
function onlyHskWords(text: string): boolean {
  const t = text.replace(/[，。？！\s]/g, '')
  const ok = (i: number): boolean => {
    if (i === t.length) return true
    for (let j = t.length; j > i; j--) if (hskWords.has(t.slice(i, j)) && ok(j)) return true
    return false
  }
  return ok(0)
}

const items = audioItems(data)

describe('basics.json · struktur', () => {
  it('23 bunyi awal sesuai daftar', () => {
    expect(data.pinyin.initials.map((i) => i.sound)).toEqual(
      'b p m f d t n l g k h j q x zh ch sh r z c s y w'.split(' '),
    )
  })

  it('minimal 24 bunyi akhir, termasuk yang wajib', () => {
    const finals = data.pinyin.finals.map((f) => f.sound)
    expect(finals.length).toBeGreaterThanOrEqual(24)
    for (const f of 'a o e i u ü ai ei ui ao ou iu ie üe er an en in un ün ang eng ing ong'.split(' ')) expect(finals).toContain(f)
    expect(new Set(finals).size).toBe(finals.length)
  })

  it('bunyi sulit punya catatan pelafalan', () => {
    const all = [...data.pinyin.initials, ...data.pinyin.finals]
    for (const s of 'zh ch sh r z c s j q x ü e en eng'.split(' ')) {
      expect(all.find((x) => x.sound === s)?.note, s).toBeDefined()
    }
  })

  it('pengecoh pinyin: 3 unik, sah, nada sama, bukan jawabannya', () => {
    for (const s of [...data.pinyin.initials, ...data.pinyin.finals]) {
      expect(s.distractors, s.sound).toHaveLength(3)
      expect(new Set([s.pinyin, ...s.distractors]).size, s.sound).toBe(4)
      for (const d of s.distractors) {
        expect(validBases.has(base(d)), `${s.sound}: ${d}`).toBe(true)
        expect(syllableTone(d), `${s.sound}: ${d}`).toBe(syllableTone(s.pinyin))
      }
    }
  })

  it('4 nada + nada ringan dengan tanda dan garis nada', () => {
    expect(data.tones.tones.map((t) => t.tone)).toEqual([1, 2, 3, 4, 5])
    for (const t of data.tones.tones) {
      expect(t.contour.length).toBeGreaterThan(0)
      for (const l of t.contour) expect(l >= 1 && l <= 5).toBe(true)
      expect(syllableTone(t.mark)).toBe(t.tone)
    }
  })

  it('minimal 4 set nada, masing-masing nada 1-4 dengan bunyi sama', () => {
    expect(data.tones.sets.length).toBeGreaterThanOrEqual(4)
    for (const set of data.tones.sets) {
      expect(set.items.map((i) => syllableTone(i.pinyin)), set.id).toEqual([1, 2, 3, 4])
      expect(new Set(set.items.map((i) => base(i.pinyin))).size, set.id).toBe(1)
    }
    expect(data.tones.sets.slice(0, 2).map((s) => s.items.map((i) => i.hanzi).join(''))).toEqual(['妈麻马骂', '八拔把爸'])
  })

  it('contoh nada ringan memuat suku kata nada 5', () => {
    for (const n of data.tones.neutral) expect(n.syllables.some((s) => syllableTone(s) === 5), n.hanzi).toBe(true)
  })

  it('perubahan nada: 3+3, 不, 一; pinyin dasar & diucapkan per huruf; jawaban sesuai aturan', () => {
    expect(data.sandhi.rules.map((r) => r.id)).toEqual(['third', 'bu', 'yi'])
    for (const r of data.sandhi.rules) {
      expect(r.examples.length).toBeGreaterThanOrEqual(3)
      for (const ex of r.examples) {
        const n = hanOf(ex.hanzi).length
        expect(ex.base, ex.hanzi).toHaveLength(n)
        expect(ex.spoken, ex.hanzi).toHaveLength(n)
        expect(ex.pinyin).toBe(ex.spoken.join(' '))
        ex.base.forEach((b, i) => expect(base(b), ex.hanzi).toBe(base(ex.spoken[i])))
        const t = ex.base.map(syllableTone)
        const sp = ex.spoken.map(syllableTone)
        const f = ex.focus
        if (r.id === 'third') expect([t[f], t[f + 1], sp[f]]).toEqual([3, 3, 2])
        if (r.id === 'bu') expect(sp[f]).toBe(t[f + 1] === 4 ? 2 : 4)
        if (r.id === 'yi') {
          const nextTone = t[f + 1]
          expect(sp[f], ex.hanzi).toBe(nextTone === undefined ? 1 : nextTone === 4 ? 2 : 4)
        }
      }
    }
    const bu = data.sandhi.rules[1].examples
    expect(bu.some((e) => changedSyllables(e).size > 0) && bu.some((e) => changedSyllables(e).size === 0)).toBe(true)
  })

  it('8 coretan dasar dan minimal 7 aturan urutan', () => {
    expect(data.strokes.basic.map((s) => s.id)).toEqual(['dian', 'heng', 'shu', 'pie', 'na', 'ti', 'zhe', 'gou'])
    expect(data.strokes.basic.map((s) => s.hanzi).join('')).toBe('点横竖撇捺提折钩')
    expect(data.strokes.rules.length).toBeGreaterThanOrEqual(7)
    const ids = new Set(data.strokes.basic.map((s) => s.id))
    for (const r of data.strokes.rules) {
      expect(r.examples.length).toBeGreaterThan(0)
      for (const e of r.examples) expect(ids.has(e.first)).toBe(true)
    }
  })

  it('contoh coretan: huruf HSK 1, data coretan ada, indeks coretan sah', () => {
    for (const s of data.strokes.basic) {
      expect(hskChars.has(s.example.char), s.example.char).toBe(true)
      const file = new URL(`public/hanzi/${s.example.char}.json`, root)
      const strokes = (JSON.parse(readFileSync(file, 'utf8')) as { strokes: string[] }).strokes
      expect(s.example.stroke).toBeLessThan(strokes.length)
    }
    for (const r of data.strokes.rules) for (const e of r.examples) expect(hskChars.has(e.char), e.char).toBe(true)
  })

  it('minimal 10 radikal, 2-4 huruf contoh dari kata HSK 1', () => {
    expect(data.radicals.items.length).toBeGreaterThanOrEqual(10)
    const radicals = new Set(data.radicals.items.map((r) => r.radical))
    for (const r of data.radicals.items) {
      expect(r.examples.length, r.radical).toBeGreaterThanOrEqual(2)
      expect(r.examples.length, r.radical).toBeLessThanOrEqual(4)
      for (const e of r.examples) {
        expect(hskChars.has(e.hanzi), `${r.radical} ${e.hanzi}`).toBe(true)
        for (const a of e.also ?? []) expect(radicals.has(a) && a !== r.radical, `${e.hanzi} also ${a}`).toBe(true)
      }
    }
  })

  it('minimal 5 contoh susunan huruf dengan 3 posisi', () => {
    const c = data.radicals.compositions
    expect(c.length).toBeGreaterThanOrEqual(5)
    expect(new Set(c.map((x) => x.layout))).toEqual(new Set(['lr', 'tb', 'oi']))
    for (const x of c) {
      expect(x.parts, x.hanzi).toHaveLength(2)
      expect(hskChars.has(x.hanzi), x.hanzi).toBe(true)
    }
  })

  it('ungkapan kelas: angka 1-10 dan salam hanya kata HSK 1', () => {
    expect(data.phrases.numbers.map((n) => n.hanzi).join('')).toBe('一二三四五六七八九十')
    expect(data.phrases.numbers.map((n) => n.value)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(data.phrases.greetings.length).toBeGreaterThanOrEqual(8)
    for (const p of [...data.phrases.numbers, ...data.phrases.greetings]) expect(onlyHskWords(p.hanzi), p.hanzi).toBe(true)
  })

  it('semua teks ID & EN terisi', () => {
    let n = 0
    const walk = (node: unknown, path: string) => {
      if (Array.isArray(node)) node.forEach((x, i) => walk(x, `${path}[${i}]`))
      else if (typeof node === 'object' && node !== null) {
        const o = node as Record<string, unknown>
        const keys = Object.keys(o)
        if (keys.length === 2 && 'id' in o && 'en' in o) {
          n++
          expect(String(o.id).trim(), path).not.toBe('')
          expect(String(o.en).trim(), path).not.toBe('')
          expect(o.id === o.en && /[a-z]{4}/.test(String(o.id)), `${path}: belum diterjemahkan?`).toBe(false)
          return
        }
        for (const [k, v] of Object.entries(o)) walk(v, `${path}.${k}`)
      }
    }
    walk(data, 'basics')
    expect(n).toBeGreaterThan(150)
  })
})

describe('basics.json · audio & pinyin', () => {
  it('audioId unik dan aman untuk nama file', () => {
    expect(items.length).toBeGreaterThan(100)
    expect(new Set(items.map((i) => i.audioId)).size).toBe(items.length)
    for (const i of items) expect(i.audioId).toMatch(/^[a-z0-9-]{1,48}$/)
  })

  it('pinyin bertanda nada sah: satu suku kata per huruf, suku kata dikenal', () => {
    for (const i of items) {
      const syl = splitSyllables(i.pinyin)
      expect(syl.length, `${i.audioId} ${i.pinyin}`).toBe(hanOf(i.hanzi).length)
      for (const s of syl) expect(validBases.has(base(s)), `${i.audioId}: ${s}`).toBe(true)
      expect(i.pinyin).toBe(i.pinyin.normalize('NFC'))
    }
  })

  it('pinyin tiap huruf cocok dengan bacaan CC-CEDICT', () => {
    const check = (hanzi: string, pinyin: string[] | string, id: string) => {
      const chars = hanOf(hanzi)
      const syl = Array.isArray(pinyin) ? pinyin : splitSyllables(pinyin)
      chars.forEach((ch, k) => expect(matchesCedict(ch, syl[k]), `${id}: ${ch} ${syl[k]}`).toBe(true))
    }
    const sandhiIds = new Set(data.sandhi.rules.flatMap((r) => r.examples.map((e) => e.audioId)))
    // Contoh perubahan nada: yang dicek pinyin dasarnya (nada yang berubah memang tidak ada di kamus).
    for (const r of data.sandhi.rules) for (const e of r.examples) check(e.hanzi, e.base, e.audioId)
    for (const i of items) {
      if (sandhiIds.has(i.audioId)) continue
      if (i.audioId === 'ph-nihao' || i.audioId === 'ph-bukeqi') continue // dicek terpisah di bawah
      check(i.hanzi, i.pinyin, i.audioId)
    }
    // 不客气 bú kèqi: tulisan resmi HSK memakai nada yang sudah berubah.
    expect(matchesCedict('不', 'bù') && matchesCedict('客', 'kè')).toBe(true)
    for (const s of data.strokes.basic) check(s.hanzi, s.pinyin, s.id)
    for (const r of data.radicals.items) if (r.from !== r.radical || readings.has(r.from)) check(r.from, r.pinyin, r.radical)
  })
})

describe('basics · huruf, coretan, font', () => {
  const chars = basicsChars(data)
  it('setiap huruf punya data coretan lokal', () => {
    for (const ch of chars) expect(existsSync(new URL(`public/hanzi/${ch}.json`, root)), ch).toBe(true)
  })
  it('setiap huruf ada di subset font WenKai', () => {
    const covered = new Set([...fontChars.core, ...fontChars.extra, ...fontChars.missing])
    expect(chars.filter((c) => !covered.has(c))).toEqual([])
  })
})

describe('audio Tahap 0 (bila manifest sudah dibuat workflow)', () => {
  const dir = new URL('public/audio/basics/', root)
  const manifestUrl = new URL('manifest.json', dir)
  const has = existsSync(manifestUrl)
  it.skipIf(!has)('tiap item bersuara punya file atau tercatat di audio-issues.json; file > 1 KB', () => {
    const manifest = JSON.parse(readFileSync(manifestUrl, 'utf8')) as {
      voice: { code: string; voiceId: string }
      whisper: { passed: number; total: number }
      files: Record<string, { path: string; ok: boolean; hanzi: string }>
    }
    const issues = JSON.parse(readFileSync(new URL('data/basics/audio-issues.json', root), 'utf8')) as { items: { audioId: string }[] }
    const listed = new Set(issues.items.map((i) => i.audioId))
    expect(manifest.voice.code).toBe('P3')
    expect(manifest.voice.voiceId).toBe('zf_001')
    for (const i of items) {
      const f = manifest.files[i.audioId]
      if (!f) {
        expect(listed.has(i.audioId), i.audioId).toBe(true)
        continue
      }
      const file = new URL(f.path, dir)
      expect(existsSync(file), f.path).toBe(true)
      expect(statSync(file).size, f.path).toBeGreaterThan(1024)
      if (!f.ok) expect(listed.has(i.audioId), i.audioId).toBe(true)
    }
    expect(manifest.whisper.total).toBe(items.length)
  })
})

describe('bagian Tahap 0', () => {
  it('urutan dan bagian berikutnya', () => {
    expect(BASICS_PARTS).toEqual(['pinyin', 'nada', 'perubahan-nada', 'coretan', 'radikal', 'ungkapan'])
    expect(nextPart('pinyin')).toBe('nada')
    expect(nextPart('ungkapan')).toBeNull()
    expect(isBasicsPart('nada')).toBe(true)
    expect(isBasicsPart('unit')).toBe(false)
  })
})
