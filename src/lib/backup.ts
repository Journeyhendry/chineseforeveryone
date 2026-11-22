// Cadangan progres: file JSON yang diunduh murid dan dipulihkan di browser lain.
import { localDay } from './dates.ts'
import { isMastered } from './leitner.ts'
import { normalizeProgress, type Progress } from './progress.ts'
import { normalizeSettings, type Settings } from './settings.ts'

export const BACKUP_APP = 'xue-mandarin'
export const BACKUP_VERSION = 1
export const BACKUP_MAX_BYTES = 2 * 1024 * 1024

export interface Backup {
  app: typeof BACKUP_APP
  kind: 'backup'
  version: 1
  exportedAt: string
  progress: Progress
  settings: Settings
}

export interface BackupSummary {
  unitsDone: number
  wordsTracked: number
  wordsMastered: number
  bestStreak: number
  /** ISO, atau null bila tanggal di file tidak terbaca. */
  exportedAt: string | null
}

export type BackupError = 'too-big' | 'not-json' | 'not-backup' | 'newer-version'

export type ParsedBackup =
  | { ok: true; progress: Progress; settings: Settings; summary: BackupSummary }
  | { ok: false; error: BackupError }

export function makeBackup(progress: Progress, settings: Settings, now: Date): Backup {
  return { app: BACKUP_APP, kind: 'backup', version: BACKUP_VERSION, exportedAt: now.toISOString(), progress, settings }
}

export const backupFileName = (now: Date) => `xue-mandarin-cadangan-${localDay(now)}.json`

export function summarize(progress: Progress, exportedAt: string | null): BackupSummary {
  const entries = Object.values(progress.words ?? {})
  return {
    unitsDone: Object.values(progress.units).filter((u) => u.stars >= 1).length,
    wordsTracked: entries.length,
    wordsMastered: entries.filter(isMastered).length,
    bestStreak: progress.streak?.best ?? 0,
    exportedAt,
  }
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Baca teks file cadangan. Kolom rusak dipulihkan per kolom; kolom tak dikenal diabaikan. */
export function parseBackup(text: string): ParsedBackup {
  if (text.length > BACKUP_MAX_BYTES) return { ok: false, error: 'too-big' }
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { ok: false, error: 'not-json' }
  }
  if (!isObject(data) || data.app !== BACKUP_APP || data.kind !== 'backup') return { ok: false, error: 'not-backup' }
  const v = data.version
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1) return { ok: false, error: 'not-backup' }
  if (v > BACKUP_VERSION) return { ok: false, error: 'newer-version' }
  if (!isObject(data.progress) && !isObject(data.settings)) return { ok: false, error: 'not-backup' }
  const progress = normalizeProgress(data.progress)
  const settings = normalizeSettings(data.settings)
  const exportedAt = typeof data.exportedAt === 'string' && !Number.isNaN(Date.parse(data.exportedAt)) ? data.exportedAt : null
  return { ok: true, progress, settings, summary: summarize(progress, exportedAt) }
}
