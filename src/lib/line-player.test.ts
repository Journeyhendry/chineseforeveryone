import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SpeakOptions } from './audio'
import { estimateMs, LINE_GAP_MS, MIN_LINE_MS, playLines, type PlayerDeps } from './line-player'

let tok = 0
let calls: { text: string; opts: SpeakOptions }[] = []
let sounding = true
const deps: PlayerDeps = {
  speak: (text, opts) => {
    tok++
    calls.push({ text, opts })
    return sounding
  },
  token: () => tok,
  setTimeout: (fn, ms) => setTimeout(fn, ms) as unknown as number,
  clearTimeout: (id) => clearTimeout(id),
}
const LINES = [
  { text: '你吃包子吗？', voice: 'female' as const },
  { text: '好，谢谢！', voice: 'male' as const },
]

beforeEach(() => {
  vi.useFakeTimers()
  tok = 0
  calls = []
  sounding = true
})
afterEach(() => vi.useRealTimers())

describe('playLines', () => {
  it('plays the lines in order, each after the previous sound ends, with the right voice and speed', () => {
    const seen: (number | null)[] = []
    playLines(LINES, { rate: 0.6, onLine: (l) => seen.push(l) }, deps)
    expect(seen).toEqual([0])
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({ text: '你吃包子吗？', opts: { rate: 0.6, voice: 'female' } })
    vi.advanceTimersByTime(5000)
    expect(calls).toHaveLength(1) // still waiting for the sound to end
    calls[0].opts.onEnd?.()
    vi.advanceTimersByTime(LINE_GAP_MS)
    expect(seen).toEqual([0, 1])
    expect(calls[1]).toMatchObject({ text: '好，谢谢！', opts: { voice: 'male' } })
    calls[1].opts.onEnd?.()
    vi.advanceTimersByTime(MIN_LINE_MS + LINE_GAP_MS)
    expect(seen).toEqual([0, 1, null])
  })

  it('waits an estimated time when there is no sound', () => {
    sounding = false
    const seen: (number | null)[] = []
    playLines(LINES, { rate: 1, onLine: (l) => seen.push(l) }, deps)
    vi.advanceTimersByTime(estimateMs(LINES[0].text) + LINE_GAP_MS)
    expect(seen).toEqual([0, 1])
    vi.advanceTimersByTime(estimateMs(LINES[1].text) + MIN_LINE_MS + LINE_GAP_MS)
    expect(seen).toEqual([0, 1, null])
  })

  it('stops when cancelled: no more lines, no more sounds', () => {
    const seen: (number | null)[] = []
    const stop = playLines(LINES, { rate: 1, onLine: (l) => seen.push(l) }, deps)
    stop()
    calls[0].opts.onEnd?.()
    vi.advanceTimersByTime(60_000)
    expect(seen).toEqual([0])
    expect(calls).toHaveLength(1)
  })

  it('stops when another sound takes over and the line never reports its end', () => {
    const seen: (number | null)[] = []
    playLines(LINES, { rate: 1, onLine: (l) => seen.push(l) }, deps)
    tok++ // someone else played a sound
    vi.advanceTimersByTime(60_000)
    expect(seen).toEqual([0, null])
    expect(calls).toHaveLength(1)
  })

  it('estimates longer for longer and slower lines', () => {
    expect(estimateMs('你好！请进！')).toBeGreaterThan(estimateMs('好！'))
    expect(estimateMs('你好', 0.6)).toBeGreaterThan(estimateMs('你好', 1))
  })
})
