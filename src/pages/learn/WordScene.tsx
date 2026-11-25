import { useEffect, useRef, useState } from 'react'
import type { PlayPreset, SceneIndex, SceneIndexEntry } from '../../art/scenes/types'
import { useT } from '../../i18n/context'
import { sanitizeSvg, splitHighlight } from '../../lib/scene-svg'
import { useSettings } from '../../lib/settings-context'
import { useAudio } from './hooks'
import './scene.css'

const sceneUrl = (file: string) => `${import.meta.env.BASE_URL}art/scenes/${file}`

/** How long each action preset plays (ms); must cover the longest animation in scene.css. */
const PLAY_MS: Record<PlayPreset, number> = {
  wave: 2000,
  bow: 2400,
  nod: 1700,
  'shake-head': 1700,
  point: 1700,
  'count-up': 2800,
  'move-to': 1900,
  'pop-bubble': 1800,
  'swap-pair': 2700,
  jump: 1500,
  shrug: 1700,
  beckon: 1900,
  panels: 2700,
  origin: 3200,
}

let indexPromise: Promise<SceneIndex | null> | null = null

function loadIndex(): Promise<SceneIndex | null> {
  indexPromise ??= fetch(sceneUrl('index.json'))
    .then((r) => (r.ok ? (r.json() as Promise<SceneIndex>) : null))
    .catch(() => null)
    .then((idx) => {
      if (!idx) indexPromise = null
      return idx
    })
  return indexPromise
}

type Loaded = { wordId: string; entry: SceneIndexEntry; svg: string }

/**
 * Illustration card for a word: the scene SVG (fetched only for the word on screen), Mandarin
 * text over the comic balloons, idle motion, and an action + the word's audio on click / Enter /
 * Space. Renders nothing for words without a scene or when loading fails.
 */
export function WordScene({ wordId, hanzi }: { wordId: string; hanzi: string }) {
  const t = useT()
  const { settings } = useSettings()
  const { available, play } = useAudio()
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const stage = useRef<HTMLButtonElement>(null)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    let alive = true
    loadIndex()
      .then(async (idx) => {
        const entry = idx?.scenes[wordId]
        if (!entry) return null
        const r = await fetch(sceneUrl(entry.file))
        if (!r.ok) return null
        const svg = sanitizeSvg(await r.text())
        return svg ? { wordId, entry, svg } : null
      })
      .catch(() => null)
      .then((res) => {
        if (alive) setLoaded(res)
      })
    return () => {
      alive = false
    }
  }, [wordId])

  useEffect(
    () => () => {
      window.clearTimeout(timer.current)
    },
    [],
  )

  const current = loaded && loaded.wordId === wordId ? loaded : null
  if (!current) return null
  const { entry, svg } = current
  const alt = entry.alt[settings.lang]

  const onPlay = () => {
    if (available) play(hanzi)
    const el = stage.current
    if (!el) return
    window.clearTimeout(timer.current)
    el.classList.remove('is-playing')
    // restart the CSS animations cleanly instead of stacking them
    void el.offsetWidth
    el.classList.add('is-playing')
    timer.current = window.setTimeout(() => el.classList.remove('is-playing'), PLAY_MS[entry.play] ?? 2000)
  }

  return (
    <section className="card scene-card" aria-label={t('learn.scene.title')}>
      <button
        ref={stage}
        type="button"
        className="scene-stage"
        data-play={entry.play}
        aria-label={t('learn.scene.label', { alt })}
        onClick={onPlay}
      >
        <span className="scene-svg" aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />
        <span className="scene-texts" aria-hidden="true">
          {entry.bubbles.map((b, i) => {
            const len = [...b.text].length
            const size = Math.min(b.h * 0.75 * 0.52, (b.w * 0.86) / Math.max(1, len))
            return (
              <span
                key={i}
                className={`scene-bubble in-panel-${b.panel}`}
                lang="zh-CN"
                style={{ left: `${b.x}%`, top: `${b.y}%`, width: `${b.w}%`, height: `${b.h}%`, fontSize: `${size.toFixed(2)}cqw` }}
              >
                {splitHighlight(b.text, b.highlight ? hanzi : '').map((p, j) =>
                  p.hl ? (
                    <span key={j} className="scene-hl">
                      {p.text}
                    </span>
                  ) : (
                    <span key={j}>{p.text}</span>
                  ),
                )}
              </span>
            )
          })}
        </span>
      </button>
      <p className="scene-hint">{t('learn.scene.hint')}</p>
    </section>
  )
}
