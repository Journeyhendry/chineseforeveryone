import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  audioAvailable,
  audioSourceFor,
  fileStem,
  loadAudioIndex,
  playRecording,
  resetAudioForTests,
  speak,
  stopAudio,
  waitForAudio,
  AUDIO_SOURCE,
} from './audio'

const INDEX = {
  v: 1,
  P3: { 你好: 'word/L1-0001', 我走了: 'sentence/9' },
  L3: { 我走了: 'dialog/n-u01-03' },
  slow: { 你好: 'word-slow/L1-0001' },
}

class FakeAudio {
  static made: FakeAudio[] = []
  url: string
  playbackRate = 1
  preservesPitch = false
  paused = false
  onended: (() => void) | null = null
  onerror: (() => void) | null = null
  rejectPlay = false
  constructor(url: string) {
    this.url = url
    FakeAudio.made.push(this)
  }
  play() {
    return this.rejectPlay ? Promise.reject(new Error('blocked')) : Promise.resolve()
  }
  pause() {
    this.paused = true
  }
}

const spoken: string[] = []
function stubDevice(hasVoice: boolean) {
  const synth = {
    getVoices: () => (hasVoice ? [{ lang: 'zh-CN' }] : []),
    cancel: vi.fn(),
    speak: (u: { text: string }) => spoken.push(u.text),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }
  vi.stubGlobal('window', { speechSynthesis: synth })
  vi.stubGlobal('SpeechSynthesisUtterance', class { text: string; lang = ''; voice: unknown; rate = 1; constructor(t: string) { this.text = t } })
  return synth
}
const stubFetch = (ok: boolean) =>
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok, status: ok ? 200 : 404, json: async () => INDEX })))
const flush = () => new Promise((r) => setTimeout(r, 0))

beforeEach(() => {
  resetAudioForTests()
  FakeAudio.made = []
  spoken.length = 0
  vi.stubGlobal('Audio', FakeAudio)
})
afterEach(() => vi.unstubAllGlobals())

describe('audio.ts (file playback)', () => {
  it('loads the index lazily, not at import', async () => {
    stubDevice(true)
    stubFetch(true)
    expect(fetch).not.toHaveBeenCalled()
    expect(AUDIO_SOURCE).toBe('device')
    await loadAudioIndex()
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(String((fetch as ReturnType<typeof vi.fn>).mock.calls[0][0])).toContain('audio/hsk1/index.json')
  })

  it('maps text to a file and plays it, with the speaking-speed setting as playbackRate', async () => {
    stubDevice(false)
    stubFetch(true)
    await loadAudioIndex()
    expect(speak('你好')).toBe(true)
    expect(FakeAudio.made).toHaveLength(1)
    expect(FakeAudio.made[0].url).toMatch(/audio\/hsk1\/word\/L1-0001\.mp3$/)
    expect(FakeAudio.made[0].playbackRate).toBe(1)
    expect(FakeAudio.made[0].preservesPitch).toBe(true)
  })

  it('uses the -slow file when it exists, otherwise playbackRate with preserved pitch', async () => {
    stubDevice(false)
    stubFetch(true)
    await loadAudioIndex()
    speak('你好', { rate: 0.75 })
    expect(FakeAudio.made[0].url).toMatch(/word-slow\/L1-0001\.mp3$/)
    expect(FakeAudio.made[0].playbackRate).toBe(1)
    speak('我走了', { rate: 0.75 })
    expect(FakeAudio.made[1].url).toMatch(/sentence\/9\.mp3$/)
    expect(FakeAudio.made[1].playbackRate).toBe(0.75)
  })

  it('picks the male voice (L3) for male dialog lines and falls back to P3 when there is no L3 file', async () => {
    stubDevice(false)
    stubFetch(true)
    await loadAudioIndex()
    expect(fileStem('我走了', { voice: 'male' })?.stem).toBe('dialog/n-u01-03')
    expect(fileStem('我走了', { voice: 'female' })?.stem).toBe('sentence/9')
    expect(fileStem('你好', { voice: 'male' })?.stem).toBe('word/L1-0001')
    expect(fileStem('x', { key: 'dialog/n-u01-03' })?.stem).toBe('dialog/n-u01-03')
  })

  it('plays only one voice at a time', async () => {
    stubDevice(false)
    stubFetch(true)
    await loadAudioIndex()
    speak('你好')
    speak('我走了')
    expect(FakeAudio.made[0].paused).toBe(true)
    expect(FakeAudio.made[1].paused).toBe(false)
    stopAudio()
    expect(FakeAudio.made[1].paused).toBe(true)
    playRecording('native/L1-0001-1.mp3')
    expect(FakeAudio.made[2].url).toMatch(/audio\/native\/L1-0001-1\.mp3$/)
  })

  it('falls back to the device voice for text without a file, and says so', async () => {
    stubDevice(true)
    stubFetch(true)
    await loadAudioIndex()
    expect(AUDIO_SOURCE).toBe('files')
    expect(audioSourceFor('你好')).toBe('file')
    expect(audioSourceFor('没有文件')).toBe('device')
    expect(speak('没有文件')).toBe(true)
    expect(spoken).toEqual(['没有文件'])
    expect(FakeAudio.made).toHaveLength(0)
  })

  it('reports none when there is no file and no device voice', async () => {
    stubDevice(false)
    stubFetch(true)
    await loadAudioIndex()
    expect(audioSourceFor('没有文件')).toBe('none')
    expect(speak('没有文件')).toBe(false)
  })

  it('uses the device voice when the index cannot be loaded', async () => {
    stubDevice(true)
    stubFetch(false)
    expect(await waitForAudio()).toBe(true)
    expect(audioAvailable()).toBe(true)
    expect(speak('你好', { rate: 0.6 })).toBe(true)
    expect(spoken).toEqual(['你好'])
  })

  it('is unavailable when the index fails and the device has no voice', async () => {
    stubDevice(false)
    stubFetch(false)
    expect(await waitForAudio(50)).toBe(false)
    expect(audioAvailable()).toBe(false)
    expect(speak('你好')).toBe(false)
  })

  it('falls back to the device voice if the file cannot be played', async () => {
    stubDevice(true)
    stubFetch(true)
    await loadAudioIndex()
    speak('你好')
    FakeAudio.made[0].onerror?.()
    expect(spoken).toEqual(['你好'])
  })

  it('waits for the index when speak is called before it has loaded', async () => {
    stubDevice(false)
    stubFetch(true)
    expect(speak('你好')).toBe(true)
    await flush()
    await flush()
    expect(FakeAudio.made).toHaveLength(1)
    expect(FakeAudio.made[0].url).toMatch(/word\/L1-0001\.mp3$/)
  })
})
