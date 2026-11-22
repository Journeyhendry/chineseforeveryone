import { describe, expect, it } from 'vitest'
import { backupFileName, BACKUP_MAX_BYTES, makeBackup, parseBackup } from './backup'
import { recordAnswers } from './leitner'
import { emptyProgress, normalizeProgress, recordUnitResult, type Progress } from './progress'
import { DEFAULT_SETTINGS, type Settings } from './settings'

const now = new Date('2026-11-22T08:30:00Z')
const settings: Settings = { ...DEFAULT_SETTINGS, lang: 'en', dailyGoal: 30, theme: 'dark', showPinyin: false }

function sample(): Progress {
  let p = recordUnitResult(emptyProgress(), 'u01', 0.95, now)
  p = recordAnswers(p, [{ wordId: 'a', correct: true }, { wordId: 'b', correct: false }], '2026-11-21', 'practice')
  p = recordAnswers(p, [{ wordId: 'a', correct: true }], '2026-11-22', 'review')
  p = recordAnswers(p, [{ wordId: 'a', correct: true }], '2026-11-24', 'review')
  p = recordAnswers(p, [{ wordId: 'a', correct: true }], '2026-11-30', 'review')
  return normalizeProgress(p)
}

describe('makeBackup / backupFileName', () => {
  it('bentuk objek dan nama file', () => {
    const b = makeBackup(emptyProgress(), settings, now)
    expect(b).toMatchObject({ app: 'xue-mandarin', kind: 'backup', version: 1, exportedAt: now.toISOString() })
    expect(backupFileName(new Date(2026, 10, 3, 12))).toBe('xue-mandarin-cadangan-2026-11-03.json')
  })
})

describe('parseBackup', () => {
  it('bolak-balik make -> stringify -> parse sama persis', () => {
    const p = sample()
    const r = parseBackup(JSON.stringify(makeBackup(p, settings, now)))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.progress).toEqual(p)
    expect(r.settings).toEqual(settings)
    expect(r.summary).toEqual({ unitsDone: 1, wordsTracked: 2, wordsMastered: 1, bestStreak: 2, exportedAt: now.toISOString() })
  })

  it('terlalu besar', () => {
    expect(parseBackup(' '.repeat(BACKUP_MAX_BYTES + 1))).toEqual({ ok: false, error: 'too-big' })
  })
  it('bukan JSON', () => {
    expect(parseBackup('{rusak')).toEqual({ ok: false, error: 'not-json' })
    expect(parseBackup('')).toEqual({ ok: false, error: 'not-json' })
  })
  it('bukan cadangan', () => {
    const bad = [
      'null',
      '[]',
      '42',
      '{}',
      JSON.stringify({ app: 'lain', kind: 'backup', version: 1, progress: {} }),
      JSON.stringify({ app: 'xue-mandarin', kind: 'settings', version: 1, progress: {} }),
      JSON.stringify({ app: 'xue-mandarin', kind: 'backup', progress: {} }),
      JSON.stringify({ app: 'xue-mandarin', kind: 'backup', version: 'satu', progress: {} }),
      JSON.stringify({ app: 'xue-mandarin', kind: 'backup', version: 1 }),
      JSON.stringify({ version: 1, units: {} }),
    ]
    for (const t of bad) expect(parseBackup(t), t).toEqual({ ok: false, error: 'not-backup' })
  })
  it('versi lebih baru', () => {
    const t = JSON.stringify({ ...makeBackup(emptyProgress(), settings, now), version: 2 })
    expect(parseBackup(t)).toEqual({ ok: false, error: 'newer-version' })
  })
  it('file sebagian rusak tetap dipulihkan per kolom', () => {
    const t = JSON.stringify({
      app: 'xue-mandarin',
      kind: 'backup',
      version: 1,
      exportedAt: 'kemarin',
      progress: {
        units: { u01: { bestScore: 0.8 }, u02: 'x' },
        words: { a: { box: 9.4, due: '2026-12-01', seen: -3, wrong: 'x' }, 'bad id!': { box: 1, due: '2026-12-01' }, c: { box: 2 } },
        streak: 'rusak',
      },
      settings: { lang: 'en', dailyGoal: 15, theme: 'neon' },
    })
    const r = parseBackup(t)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.progress.units).toEqual({ u01: { bestScore: 0.8, stars: 2 } })
    expect(r.progress.words).toEqual({ a: { box: 5, due: '2026-12-01', seen: 0, wrong: 0 } })
    expect(r.progress.streak).toBeUndefined()
    expect(r.settings).toEqual({ ...DEFAULT_SETTINGS, lang: 'en' })
    expect(r.summary.exportedAt).toBeNull()
  })
  it('hanya settings yang berisi tetap diterima; kolom tak dikenal diabaikan', () => {
    const t = JSON.stringify({ app: 'xue-mandarin', kind: 'backup', version: 1, settings: { lang: 'en' }, extra: { x: 1 }, progress: { hack: true } })
    const r = parseBackup(t)
    expect(r.ok && r.progress).toEqual(emptyProgress())
    expect(r.ok && r.settings.lang).toBe('en')
    expect(r.ok && 'extra' in r.progress).toBe(false)
  })
})
