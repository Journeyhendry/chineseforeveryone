// Plays a word's sentence / dialog line by line (task 6c): line 1 shows and sounds, the next line
// starts when its sound has ended (or after an estimate when there is no sound), and so on. One
// sound at a time: starting again or cancelling stops the sequence. The audio and timers are passed
// in, so the order can be tested without a browser.
import type { SpeakOptions, Voice } from './audio.ts'

export interface PlayerLine {
  text: string
  voice: Voice
}

export interface PlayerDeps {
  speak: (text: string, opts: SpeakOptions) => boolean
  /** Changes whenever any sound starts or stops (audio.ts audioToken). */
  token: () => number
  setTimeout: (fn: () => void, ms: number) => number
  clearTimeout: (id: number) => void
}

export interface PlayOptions {
  rate: number
  /** Line now playing (0-based), or null when the sequence has ended or stopped. */
  onLine: (line: number | null) => void
}

/** Pause between two lines (ms). */
export const LINE_GAP_MS = 350
/** A line stays at least this long, so its balloon animation is seen (ms). */
export const MIN_LINE_MS = 900

const HAN = /[㐀-鿿]/gu

/** Rough speaking time of a line (ms) when there is no sound to wait for. */
export function estimateMs(text: string, rate = 1): number {
  const n = (text.match(HAN) ?? []).length
  return Math.round((500 + n * 320) / Math.max(0.3, rate))
}

/**
 * Starts playing `lines`; returns a function that stops the sequence (without touching the sound:
 * the caller stops it). If another sound interrupts a line, the sequence stops.
 */
export function playLines(lines: PlayerLine[], opts: PlayOptions, deps: PlayerDeps): () => void {
  let stopped = false
  const timers = new Set<number>()
  const later = (fn: () => void, ms: number) => {
    const id = deps.setTimeout(() => {
      timers.delete(id)
      if (!stopped) fn()
    }, ms)
    timers.add(id)
  }
  const stop = () => {
    if (stopped) return
    stopped = true
    for (const id of timers) deps.clearTimeout(id)
    timers.clear()
  }

  const playLine = (i: number) => {
    if (i >= lines.length) {
      stop()
      opts.onLine(null)
      return
    }
    opts.onLine(i)
    const line = lines[i]
    const startedAt = Date.now()
    const est = estimateMs(line.text, opts.rate)
    let advanced = false
    const next = () => {
      if (advanced || stopped) return
      advanced = true
      const wait = Math.max(0, MIN_LINE_MS - (Date.now() - startedAt)) + LINE_GAP_MS
      later(() => playLine(i + 1), wait)
    }
    const sounding = deps.speak(line.text, { rate: opts.rate, voice: line.voice, onEnd: next })
    if (!sounding) {
      later(next, est)
      return
    }
    const mine = deps.token()
    // safety net: some device voices never report the end; if another sound took over, stop
    later(() => {
      if (advanced) return
      if (deps.token() !== mine) {
        stop()
        opts.onLine(null)
      } else next()
    }, est * 3 + 4000)
  }

  playLine(0)
  return stop
}
