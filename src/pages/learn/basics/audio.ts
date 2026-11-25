import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { playFile, SLOW_RATE, stopAudio } from '../../../lib/audio'
import { basicsAudioUrl, loadBasicsAudio } from '../../../lib/basics-audio'
import type { AudioItem } from '../../../lib/basics'
import { useSettings } from '../../../lib/settings-context'
import { useAudio } from '../hooks'

// ---------- suara ----------

export type AudioSource = 'file' | 'device' | null

// Manifest dimuat sekali untuk semua komponen (supaya fungsi play tidak berganti setelah tampil).
let audioMap: Map<string, string> | null = null
const audioSubs = new Set<() => void>()
function subscribeAudioMap(cb: () => void) {
  audioSubs.add(cb)
  if (!audioMap) {
    void loadBasicsAudio().then((m) => {
      if (audioMap) return
      audioMap = m
      audioSubs.forEach((f) => f())
    })
  }
  return () => audioSubs.delete(cb)
}
const getAudioMap = () => audioMap

/** Suara Tahap 0: file mp3 P3 bila ada di manifest, selain itu suara perangkat (cadangan). */
export function useBasicsAudio() {
  const map = useSyncExternalStore(subscribeAudioMap, getAudioMap, getAudioMap)
  const { available: device, play: speakDevice } = useAudio()
  const { settings } = useSettings()
  const source = useCallback(
    (item: AudioItem): AudioSource => (map?.has(item.audioId) ? 'file' : device ? 'device' : null),
    [map, device],
  )
  const play = useCallback(
    (item: AudioItem, slow = false): boolean => {
      const path = map?.get(item.audioId)
      if (path) {
        void playFile(basicsAudioUrl(path), { rate: slow ? SLOW_RATE : settings.voiceSpeed })
        return true
      }
      return speakDevice(item.hanzi, slow)
    },
    [map, speakDevice, settings.voiceSpeed],
  )
  const has = useCallback((item: AudioItem) => source(item) !== null, [source])
  return { ready: map !== null, source, play, has }
}

/** Putar beberapa item berurutan (jeda tetap); berhenti saat komponen hilang. */
export function useSequence(play: (item: AudioItem) => boolean) {
  const timers = useRef<number[]>([])
  const [playing, setPlaying] = useState<string | null>(null)
  const stop = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t))
    timers.current = []
    setPlaying(null)
  }, [])
  useEffect(() => () => {
    timers.current.forEach((t) => window.clearTimeout(t))
    stopAudio()
  }, [])
  const run = useCallback(
    (key: string, items: AudioItem[], gapMs = 1100) => {
      stop()
      setPlaying(key)
      items.forEach((it, i) => timers.current.push(window.setTimeout(() => play(it), i * gapMs)))
      timers.current.push(window.setTimeout(() => setPlaying(null), items.length * gapMs))
    },
    [play, stop],
  )
  return { run, playing }
}

