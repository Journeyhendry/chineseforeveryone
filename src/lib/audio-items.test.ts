/// <reference types="node" />
import { existsSync, readFileSync, statSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import words from '../../data/hsk1/words.json'
import sentencesFile from '../../data/hsk1/sentences.json'
import casualFile from '../../data/hsk1/casual.json'
import dialogsFile from '../../data/hsk1/dialogs.json'
import itemsFile from '../../data/hsk1/audio-items.json'
import { NATIVE_LICENSES } from './native-audio'

const ROOT = new URL('../../', import.meta.url)
const AUDIO = new URL('public/audio/hsk1/', ROOT)
const items = itemsFile.items as Array<{
  key: string
  kind: string
  text: string
  voice: 'P3' | 'L3'
  speed: number
  pinyin?: string
  sourceId: string
  hash: string
}>
const ofKind = (k: string) => items.filter((i) => i.kind === k)

describe('audio-items.json (daftar teks audio)', () => {
  it('has exactly one main item per word, sentence, casual expression and dialog line', () => {
    expect(ofKind('word').map((i) => i.text)).toEqual(words.map((w) => w.hanzi))
    expect(ofKind('word').map((i) => i.sourceId)).toEqual(words.map((w) => w.id))
    expect(ofKind('sentence').map((i) => [i.sourceId, i.text])).toEqual(
      sentencesFile.sentences.map((s) => [String(s.tatoebaId), s.cmn]),
    )
    expect(ofKind('casual').map((i) => [i.sourceId, i.text])).toEqual(casualFile.items.map((c) => [c.id, c.hanzi]))
    const lines = dialogsFile.dialogs.flatMap((d) => d.lines.map((l, n) => ({ id: `${d.id}-${String(n + 1).padStart(2, '0')}`, l })))
    expect(ofKind('dialog').map((i) => [i.sourceId, i.text, i.voice])).toEqual(
      lines.map(({ id, l }) => [id, l.cmn, l.gender === 'male' ? 'L3' : 'P3']),
    )
  })

  it('has a slow version (speed 0.75) of every word and casual expression', () => {
    expect(ofKind('word-slow').map((i) => i.sourceId)).toEqual(ofKind('word').map((i) => i.sourceId))
    expect(ofKind('casual-slow').map((i) => i.sourceId)).toEqual(ofKind('casual').map((i) => i.sourceId))
    for (const i of [...ofKind('word-slow'), ...ofKind('casual-slow')]) expect(i.speed).toBe(0.75)
    for (const i of [...ofKind('word'), ...ofKind('casual'), ...ofKind('sentence'), ...ofKind('dialog')]) expect(i.speed).toBe(1)
  })

  it('uses P3 for everything except male dialog lines (L3)', () => {
    for (const i of items) expect(i.voice).toBe(i.kind === 'dialog' && i.voice === 'L3' ? 'L3' : 'P3')
    expect(ofKind('dialog').filter((i) => i.voice === 'L3').length).toBe(
      dialogsFile.dialogs.flatMap((d) => d.lines).filter((l) => l.gender === 'male').length,
    )
  })

  it('has unique, file-safe keys', () => {
    expect(new Set(items.map((i) => i.key)).size).toBe(items.length)
    for (const i of items) {
      expect(i.key).toMatch(/^[A-Za-z0-9._-]+$/)
      expect(i.hash).toMatch(/^[0-9a-f]{16}$/)
    }
  })
})

type Entry = { path: string; kind: string; text: string; voice: string; speed: number; durationSec: number; ok: boolean; hash: string; attempts: number }
const manifestUrl = new URL('manifest.json', AUDIO)
const manifest = existsSync(manifestUrl)
  ? (JSON.parse(readFileSync(manifestUrl, 'utf8')) as {
      files: Record<string, Entry>
      voices: Record<string, { model: string; modelRevision: string; voiceId: string }>
      whisper: { passed: number; total: number; wordsPassed: number; wordsTotal: number; byKind: Record<string, { passed: number; total: number }> }
    })
  : null
const issuesFile = new URL('data/hsk1/audio-issues.json', ROOT)
const issues = existsSync(issuesFile) ? (JSON.parse(readFileSync(issuesFile, 'utf8')) as { issues: { key: string }[] }).issues : []

describe.skipIf(!manifest)('audio manifest (hanya bila audio sudah dibuat)', () => {
  it('pins the P3 / L3 voices', () => {
    expect(manifest!.voices.P3).toMatchObject({ model: 'Kokoro-82M v1.1-zh', voiceId: 'zf_001' })
    expect(manifest!.voices.L3).toMatchObject({ model: 'Kokoro-82M v1.1-zh', voiceId: 'zm_010' })
  })

  it('has a file (> 1 KB) or a recorded issue for every item, and no stale audio', () => {
    const flagged = new Set(issues.map((i) => i.key))
    const bad: string[] = []
    for (const it of items) {
      const e = manifest!.files[it.key]
      if (!e) {
        bad.push(`${it.key}: tidak ada di manifest`)
        continue
      }
      if (e.hash !== it.hash) bad.push(`${it.key}: hash basi (data/pengaturan berubah, jalankan workflow Build HSK 1 audio)`)
      const p = new URL(e.path, AUDIO)
      if (!existsSync(p) || statSync(p).size <= 1024) bad.push(`${it.key}: berkas ${e.path} tidak ada / terlalu kecil`)
      if (!e.ok && !flagged.has(it.key)) bad.push(`${it.key}: gagal cek Whisper tapi tidak tercatat di audio-issues.json`)
    }
    expect(bad).toEqual([])
    expect(Object.keys(manifest!.files).length).toBe(items.length)
  })

  it('lists exactly the failed items in audio-issues.json', () => {
    const failed = Object.entries(manifest!.files).filter(([, e]) => !e.ok).map(([k]) => k).sort()
    expect(issues.map((i) => i.key).sort()).toEqual(failed)
  })

  it('has plausible durations (words 0.3-3 s, sentences <= 12 s)', () => {
    for (const [k, e] of Object.entries(manifest!.files)) {
      if (!e.ok) continue
      if (e.kind === 'word') expect(e.durationSec, k).toBeGreaterThanOrEqual(0.3)
      if (e.kind === 'word') expect(e.durationSec, k).toBeLessThanOrEqual(3)
      if (e.kind === 'sentence' || e.kind === 'dialog') expect(e.durationSec, k).toBeLessThanOrEqual(12)
    }
  })

  it('meets the Whisper targets (words >= 95 %, overall >= 90 %)', () => {
    const w = manifest!.whisper
    expect(w.wordsPassed / w.wordsTotal).toBeGreaterThanOrEqual(0.95)
    expect(w.passed / w.total).toBeGreaterThanOrEqual(0.9)
  })

  it('has a compact index that points at existing files', () => {
    const idx = JSON.parse(readFileSync(new URL('index.json', AUDIO), 'utf8')) as { P3: Record<string, string>; L3: Record<string, string>; slow: Record<string, string> }
    for (const t of [...Object.values(idx.P3), ...Object.values(idx.L3), ...Object.values(idx.slow)]) {
      expect(existsSync(new URL(`${t}.mp3`, AUDIO)), t).toBe(true)
    }
    for (const w of words) expect(idx.P3[w.hanzi] ?? '', w.hanzi).not.toBe('')
  })
})

type Native = Record<string, { path: string; author: string; license: string; sourceUrl: string }[]>
const nativeUrl = new URL('data/hsk1/native-audio.json', ROOT)
const native = existsSync(nativeUrl) ? (JSON.parse(readFileSync(nativeUrl, 'utf8')) as Native) : null

describe.skipIf(!native)('native-audio.json (rekaman penutur asli)', () => {
  it('has author, free license, source URL and an existing file for each entry', () => {
    const wordIds = new Set(words.map((w) => w.id))
    for (const [id, list] of Object.entries(native!)) {
      expect(wordIds.has(id) || sentencesFile.sentences.some((s) => String(s.tatoebaId) === id), id).toBe(true)
      expect(list.length, id).toBeGreaterThan(0)
      expect(list.length, id).toBeLessThanOrEqual(2)
      for (const e of list) {
        expect(e.author.trim(), id).not.toBe('')
        expect(e.license, id).toMatch(NATIVE_LICENSES)
        expect(e.sourceUrl, id).toMatch(/^https:\/\/commons\.wikimedia\.org\//)
        const p = new URL(`public/audio/${e.path}`, ROOT)
        expect(existsSync(p) && statSync(p).size > 1024, e.path).toBe(true)
      }
    }
  })

  it('is mirrored in public/audio/native/index.json', () => {
    const copy = new URL('public/audio/native/index.json', ROOT)
    expect(existsSync(copy)).toBe(true)
    expect(JSON.parse(readFileSync(copy, 'utf8'))).toEqual(native)
  })
})

describe('Tatoeba audio is not used', () => {
  it('only has empty-license or CC BY-NC audio in sentences.json (not free, so no native sentence audio)', () => {
    const counts = new Map<string, number>()
    for (const s of sentencesFile.sentences) for (const a of s.audio ?? []) counts.set(a.license, (counts.get(a.license) ?? 0) + 1)
    for (const lic of counts.keys()) expect(['', 'CC BY-NC 4.0']).toContain(lic)
    expect(native ? Object.keys(native).every((k) => !/^\d+$/.test(k)) : true).toBe(true)
  })
})
