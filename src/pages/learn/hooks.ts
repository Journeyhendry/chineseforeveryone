import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type RefObject } from 'react'
import { audioAvailable, onAudioChange, SLOW_RATE, speak } from '../../lib/audio'
import { loadProgress, PROGRESS_KEY, saveProgress, type Progress } from '../../lib/progress'
import { useSettings } from '../../lib/settings-context'
import { useT } from '../../i18n/context'

// ---------- progres (satu sumber untuk semua layar) ----------

let current: Progress | null = null
const listeners = new Set<() => void>()
const getProgress = () => (current ??= loadProgress())

function subscribeProgress(cb: () => void) {
  listeners.add(cb)
  const onStorage = (e: StorageEvent) => {
    if (e.key !== PROGRESS_KEY) return
    current = null
    cb()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(cb)
    window.removeEventListener('storage', onStorage)
  }
}

export function updateProgress(fn: (p: Progress) => Progress): Progress {
  const prev = getProgress()
  const next = fn(prev)
  if (next !== prev) {
    current = next
    saveProgress(next)
    listeners.forEach((l) => l())
  }
  return next
}

export function useProgress(): Progress {
  return useSyncExternalStore(subscribeProgress, getProgress, getProgress)
}

// ---------- memuat data ----------

export type Resource<T> = { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: T }

export function useResource<T>(key: string, load: () => Promise<T>): Resource<T> & { retry: () => void } {
  const [state, setState] = useState<{ key: string; attempt: number; res: Resource<T> }>({
    key,
    attempt: 0,
    res: { status: 'loading' },
  })
  const [attempt, setAttempt] = useState(0)
  const loadRef = useRef(load)
  useEffect(() => {
    loadRef.current = load
  })
  useEffect(() => {
    let alive = true
    loadRef.current().then(
      (data) => alive && setState({ key, attempt, res: { status: 'ready', data } }),
      () => alive && setState({ key, attempt, res: { status: 'error' } }),
    )
    return () => {
      alive = false
    }
  }, [key, attempt])
  const res: Resource<T> = state.key === key && state.attempt === attempt ? state.res : { status: 'loading' }
  const retry = useCallback(() => setAttempt((a) => a + 1), [])
  return { ...res, retry }
}

// ---------- suara ----------

const serverFalse = () => false

export function useAudio() {
  const available = useSyncExternalStore(onAudioChange, audioAvailable, serverFalse)
  const { settings } = useSettings()
  const play = useCallback(
    (text: string, slow = false) => speak(text, { rate: slow ? SLOW_RATE : settings.voiceSpeed }),
    [settings.voiceSpeed],
  )
  return { available, play }
}

// ---------- judul & fokus ----------

export function useDocumentTitle(page: string) {
  const t = useT()
  const title = t('app.titleTemplate', { page })
  useEffect(() => {
    document.title = title
  }, [title])
}

let navigated = false
if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    navigated = true
  })
}

/**
 * Pindahkan fokus ke `ref` (judul layar) setiap `key` berganti. Tidak memindah fokus saat halaman
 * pertama kali dibuka (kecuali `force`). `key` null = belum siap (mis. masih memuat).
 */
export function useFocusOnChange(ref: RefObject<HTMLElement | null>, key: string | null, force = false) {
  const last = useRef<string | null>(null)
  useEffect(() => {
    if (key === null) return
    if (last.current === key) return
    const first = last.current === null
    last.current = key
    if (!first || navigated || force) ref.current?.focus()
  }, [key, ref, force])
}

// ---------- keyboard ----------

export function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false
  return t.isContentEditable || t.matches('input, textarea, select')
}

export function isInteractiveTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false
  return t.matches('a[href], button, input, textarea, select, summary, [role="button"], [role="radio"], [contenteditable="true"]')
}

/** Pasang listener keydown di window selama komponen tampil (otomatis dibersihkan). */
export function useHotkeys(handler: (e: KeyboardEvent) => void) {
  const ref = useRef(handler)
  useEffect(() => {
    ref.current = handler
  })
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return
      if (isTypingTarget(e.target)) return
      ref.current(e)
    }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [])
}

export function go(href: string) {
  window.location.hash = href
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeMotion, getMotion, serverFalse)
}
const motionQuery = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null)
function subscribeMotion(cb: () => void) {
  const q = motionQuery()
  q?.addEventListener('change', cb)
  return () => q?.removeEventListener('change', cb)
}
const getMotion = () => motionQuery()?.matches ?? false
