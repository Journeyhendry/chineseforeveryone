// Manifest audio Tahap 0 (public/audio/basics/manifest.json, dibuat workflow basics-audio.yml).
export interface BasicsAudioFile {
  path: string
  durationSec: number
  transcript: string
  ok: boolean
  attempts: number
}

export interface BasicsAudioManifest {
  version: 1
  generatedAt: string
  voice: { code: string; model: string; modelRevision: string; voiceId: string }
  whisper: { model: string; passed: number; total: number }
  files: Record<string, BasicsAudioFile>
}

export const BASICS_AUDIO_DIR = 'audio/basics/'

const SAFE_ID = /^[a-z0-9-]{1,48}$/
const SAFE_PATH = /^[a-z0-9-]{1,48}\.mp3$/

/**
 * Ambil hanya entri yang aman dipakai sebagai URL DAN lolos cek otomatis (`ok: true`).
 * File yang gagal cek (bunyi/nada mungkin salah) tidak pernah diputar: item itu memakai suara perangkat.
 * Manifest rusak -> tanpa file (pakai suara perangkat).
 */
export function audioFileMap(raw: unknown): Map<string, string> {
  const out = new Map<string, string>()
  if (typeof raw !== 'object' || raw === null) return out
  const files = (raw as { files?: unknown }).files
  if (typeof files !== 'object' || files === null) return out
  for (const [id, f] of Object.entries(files as Record<string, unknown>)) {
    if (typeof f !== 'object' || f === null) continue
    const { path, ok } = f as { path?: unknown; ok?: unknown }
    if (ok === true && SAFE_ID.test(id) && typeof path === 'string' && SAFE_PATH.test(path)) out.set(id, path)
  }
  return out
}

let cache: Promise<Map<string, string>> | null = null

/** Peta audioId -> path relatif. Tidak pernah gagal: tanpa manifest = peta kosong. */
export function loadBasicsAudio(): Promise<Map<string, string>> {
  cache ??= fetch(`${import.meta.env.BASE_URL}${BASICS_AUDIO_DIR}manifest.json`)
    .then((r) => (r.ok ? r.json() : null))
    .then(audioFileMap, () => new Map<string, string>())
  return cache
}

export const basicsAudioUrl = (path: string) => `${import.meta.env.BASE_URL}${BASICS_AUDIO_DIR}${path}`
