// Suara: memutar file mp3 HSK 1 (public/audio/hsk1, dibuat task 4b), cadangan suara bawaan
// browser (speechSynthesis) untuk teks yang tidak punya file.
//
// Peta teks -> file (audio/hsk1/index.json) dimuat MALAS saat suara pertama diminta, bukan di
// bundel awal. API lama tetap ada: audioAvailable, speak, stopAudio, onAudioChange, waitForAudio,
// SLOW_RATE, AUDIO_SOURCE.

export const SLOW_RATE = 0.6
/** 'files' setelah indeks file suara berhasil dimuat; sebelum itu 'device'. */
export let AUDIO_SOURCE: 'device' | 'files' = 'device'

export type Voice = 'female' | 'male'
export interface SpeakOptions {
  /** Kecepatan (< 0,95 = versi pelan). Default 1. */
  rate?: number
  /** Suara tokoh: 'male' memakai L3 (baris dialog laki-laki); default 'female' (P3). */
  voice?: Voice
  /** Berkas langsung, mis. 'dialog/n-u01-03' (tanpa .mp3), mengalahkan pencarian lewat teks. */
  key?: string
}

export interface AudioIndex {
  v: number
  /** teks -> berkas (tanpa .mp3) untuk suara P3 / L3 / versi pelan. */
  P3: Record<string, string>
  L3: Record<string, string>
  slow: Record<string, string>
}

type State = 'idle' | 'loading' | 'ready' | 'failed'
let state: State = 'idle'
let index: AudioIndex | null = null
let indexPromise: Promise<AudioIndex | null> | null = null
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

const filesBase = () => `${import.meta.env.BASE_URL}audio/`

/** Muat indeks file suara (sekali). Hasil null bila gagal; suara perangkat jadi cadangan. */
export function loadAudioIndex(): Promise<AudioIndex | null> {
  if (indexPromise) return indexPromise
  state = 'loading'
  indexPromise = fetch(`${filesBase()}hsk1/index.json`)
    .then((r) => {
      if (!r.ok) throw new Error(String(r.status))
      return r.json() as Promise<AudioIndex>
    })
    .then((idx) => {
      if (!idx || typeof idx !== 'object' || !idx.P3) throw new Error('indeks rusak')
      index = idx
      state = 'ready'
      AUDIO_SOURCE = 'files'
      notify()
      return idx
    })
    .catch(() => {
      state = 'failed'
      notify()
      return null
    })
  return indexPromise
}

function synth(): SpeechSynthesis | null {
  try {
    return typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null
  } catch {
    return null
  }
}

function zhVoice(): SpeechSynthesisVoice | null {
  const s = synth()
  if (!s) return null
  let voices: SpeechSynthesisVoice[] = []
  try {
    voices = s.getVoices()
  } catch {
    return null
  }
  const zh = voices.filter((v) => /^(zh|cmn)([-_]|$)/i.test(v.lang))
  return (
    zh.find((v) => /^zh[-_]CN$/i.test(v.lang) || /^cmn[-_]Hans/i.test(v.lang)) ??
    zh.find((v) => !/HK|TW|yue/i.test(v.lang)) ??
    null
  )
}

const isSlow = (opts: SpeakOptions) => (opts.rate ?? 1) < 0.95

/** Berkas (tanpa .mp3) untuk teks ini, atau null. Hanya berarti setelah indeks dimuat. */
export function fileStem(text: string, opts: SpeakOptions = {}): { stem: string; slow: boolean } | null {
  if (!index) return null
  if (opts.key) return { stem: opts.key, slow: false }
  const slowStem = isSlow(opts) ? index.slow[text] : undefined
  if (slowStem) return { stem: slowStem, slow: true }
  const stem = (opts.voice === 'male' ? index.L3[text] : undefined) ?? index.P3[text]
  return stem ? { stem, slow: false } : null
}

/**
 * Dari mana teks ini akan dibunyikan: 'file' (juga selagi indeks masih dimuat), 'device' (cadangan:
 * UI menampilkan catatan suara perangkat) atau 'none'.
 */
export function audioSourceFor(text: string, opts: SpeakOptions = {}): 'file' | 'device' | 'none' {
  if (state === 'idle' || state === 'loading') return 'file'
  if (fileStem(text, opts)) return 'file'
  return zhVoice() ? 'device' : 'none'
}

/** Cuplikan keadaan untuk useSyncExternalStore; berubah bila indeks selesai dimuat atau suara perangkat berubah. */
export function audioSnapshot(): string {
  return `${state}:${zhVoice() ? 1 : 0}`
}

/** false bila tidak ada file suara dan tidak ada suara Mandarin di perangkat. */
export function audioAvailable(): boolean {
  return state !== 'failed' || zhVoice() !== null
}

// ---------- pemutaran ----------

let current: HTMLAudioElement | null = null
let token = 0

function stopFile() {
  if (!current) return
  const a = current
  current = null
  a.onended = null
  a.onerror = null
  try {
    a.pause()
  } catch {
    /* abaikan */
  }
}

function speakDevice(text: string, rate: number): boolean {
  const s = synth()
  const voice = zhVoice()
  if (!s || !voice) return false
  try {
    s.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'zh-CN'
    u.voice = voice
    u.rate = rate
    s.speak(u)
    return true
  } catch {
    return false
  }
}

function playUrl(url: string, rate: number, onFail: () => void): boolean {
  try {
    synth()?.cancel()
    const a = new Audio(url)
    current = a
    a.preservesPitch = true
    a.playbackRate = Math.min(2, Math.max(0.5, rate))
    const fail = () => {
      if (current !== a) return
      current = null
      onFail()
    }
    a.onerror = fail
    a.onended = () => {
      if (current === a) current = null
    }
    const p = a.play()
    if (p && typeof p.catch === 'function') p.catch(fail)
    return true
  } catch {
    return false
  }
}

function playNow(text: string, opts: SpeakOptions): boolean {
  const rate = opts.rate ?? 1
  const hit = fileStem(text, opts)
  if (hit) {
    return playUrl(`${filesBase()}hsk1/${hit.stem}.mp3`, hit.slow ? 1 : rate, () => void speakDevice(text, rate))
  }
  return speakDevice(text, rate)
}

/**
 * Putar teks Mandarin: file mp3 bila ada, kalau tidak suara perangkat. Mengembalikan false bila
 * tidak ada suara sama sekali. Hanya satu suara berbunyi pada satu waktu.
 */
export function speak(text: string, opts: SpeakOptions = {}): boolean {
  const mine = ++token
  stopFile()
  if (index) return playNow(text, opts)
  if (state === 'failed') return speakDevice(text, opts.rate ?? 1)
  void loadAudioIndex().then(() => {
    if (mine === token) playNow(text, opts)
  })
  return true
}

/** Putar rekaman (path relatif terhadap public/audio, mis. 'native/L1-0001-1.mp3'), mis. penutur asli. */
export function playRecording(path: string, opts: { rate?: number } = {}): boolean {
  token++
  stopFile()
  return playUrl(`${filesBase()}${path}`, opts.rate ?? 1, () => {})
}

export function stopAudio(): void {
  token++
  stopFile()
  try {
    synth()?.cancel()
  } catch {
    /* abaikan */
  }
}

// ---------- pemutar file mp3 Tahap 0 (public/audio/basics) ----------

/**
 * Putar satu file audio lewat URL lengkap (mis. Tahap 0: `audio/basics/x.mp3`). Memakai elemen
 * pemutar yang sama dengan speak(), jadi tetap hanya satu suara pada satu waktu. Selesai dengan
 * false bila file gagal dimuat/diputar (pemanggil boleh memakai suara perangkat sebagai cadangan).
 */
export function playFile(url: string, opts: { rate?: number } = {}): Promise<boolean> {
  token++
  stopFile()
  if (typeof Audio === 'undefined') return Promise.resolve(false)
  return new Promise((resolve) => {
    const ok = playUrl(url, opts.rate ?? 1, () => resolve(false))
    if (!ok) resolve(false)
    else if (current) {
      const a = current
      a.addEventListener('playing', () => resolve(true), { once: true })
    }
  })
}

/** Dipanggil saat daftar suara berubah (browser memuat suara secara asinkron) atau indeks file selesai dimuat. */
export function onAudioChange(cb: () => void): () => void {
  listeners.add(cb)
  const s = synth()
  const canListen = !!s && typeof s.addEventListener === 'function'
  if (canListen) s.addEventListener('voiceschanged', cb)
  return () => {
    listeners.delete(cb)
    if (canListen) s.removeEventListener('voiceschanged', cb)
  }
}

/** Tunggu sebentar sampai suara siap (atau batas waktu), lalu jawab apakah suara tersedia. */
export async function waitForAudio(timeoutMs = 800): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs)
  })
  const idx = await Promise.race([loadAudioIndex(), timeout])
  clearTimeout(timer)
  if (idx || audioAvailable()) return audioAvailable()
  if (!synth()) return false
  return new Promise((resolve) => {
    let done = false
    const finish = () => {
      if (done) return
      done = true
      off()
      clearTimeout(t2)
      resolve(audioAvailable())
    }
    const off = onAudioChange(() => {
      if (audioAvailable()) finish()
    })
    const t2 = setTimeout(finish, timeoutMs)
  })
}

/** Hanya untuk tes: kembalikan keadaan awal. */
export function resetAudioForTests(): void {
  stopFile()
  state = 'idle'
  index = null
  indexPromise = null
  AUDIO_SOURCE = 'device'
  token = 0
}
