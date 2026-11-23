import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { audioFileMap } from './basics-audio'

describe('audioFileMap', () => {
  it('hanya file yang lolos cek (ok: true) yang dipakai; yang gagal -> suara perangkat', () => {
    const m = audioFileMap({
      files: {
        'py-i-b': { path: 'py-i-b.mp3', ok: true },
        'py-i-j': { path: 'py-i-j.mp3', ok: false },
        'py-i-x': { path: 'py-i-x.mp3' },
        'py-i-q': { path: 'py-i-q.mp3', ok: 'true' },
      },
    })
    expect([...m.entries()]).toEqual([['py-i-b', 'py-i-b.mp3']])
  })

  it('id/path tidak aman atau manifest rusak diabaikan', () => {
    expect(audioFileMap(null).size).toBe(0)
    expect(audioFileMap({ files: 'x' }).size).toBe(0)
    expect(audioFileMap({ files: { 'a/b': { path: 'a.mp3', ok: true }, ok1: { path: '../x.mp3', ok: true } } }).size).toBe(0)
  })

  it('manifest nyata: tidak ada file gagal yang masuk peta', () => {
    const raw = JSON.parse(readFileSync(new URL('../../public/audio/basics/manifest.json', import.meta.url), 'utf8')) as {
      files: Record<string, { ok: boolean }>
    }
    const m = audioFileMap(raw)
    for (const [id, f] of Object.entries(raw.files)) expect(m.has(id), id).toBe(f.ok)
  })
})
