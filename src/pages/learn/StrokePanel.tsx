import { useEffect, useRef, useState } from 'react'
import type HanziWriterType from 'hanzi-writer'
import { PauseIcon, PlayIcon, RepeatIcon } from '../../components/icons'
import { useT } from '../../i18n/context'
import { useReducedMotion } from './hooks'

type Writer = InstanceType<typeof HanziWriterType>
type Load = { char: string; status: 'loading' | 'ready' | 'missing'; strokes: number }

const strokeUrl = (ch: string) => `${import.meta.env.BASE_URL}hanzi/${encodeURIComponent(ch)}.json`

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}
const colors = () => ({ strokeColor: cssVar('--text'), outlineColor: cssVar('--surface-3'), radicalColor: null })

/** Panel urutan coretan (Hanzi Writer, data lokal dari public/hanzi/). */
export function StrokePanel({ chars }: { chars: string[] }) {
  const t = useT()
  const reduced = useReducedMotion()
  const [selected, setSelected] = useState(0)
  const char = chars[Math.min(selected, chars.length - 1)]
  const [load, setLoad] = useState<Load>({ char, status: 'loading', strokes: 0 })
  const [playing, setPlaying] = useState(false)
  const [paused, setPaused] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const target = useRef<HTMLDivElement>(null)
  const writer = useRef<Writer | null>(null)
  const reducedRef = useRef(reduced)
  useEffect(() => {
    reducedRef.current = reduced
  }, [reduced])

  const state: Load = load.char === char ? load : { char, status: 'loading', strokes: 0 }

  const animate = () => {
    const w = writer.current
    if (!w) return
    setPlaying(true)
    setPaused(false)
    void w.animateCharacter({
      onComplete: () => {
        setPlaying(false)
        setPaused(false)
      },
    })
  }

  useEffect(() => {
    const el = target.current
    const outer = box.current
    if (!el || !outer) return
    let alive = true
    let ro: ResizeObserver | null = null
    let mo: MutationObserver | null = null
    setPlaying(false)
    setPaused(false)
    void import('hanzi-writer').then(({ default: HanziWriter }) => {
      if (!alive) return
      el.innerHTML = ''
      const size = Math.max(120, Math.floor(outer.clientWidth))
      const w = HanziWriter.create(el, char, {
        width: size,
        height: size,
        padding: Math.round(size * 0.08),
        showOutline: true,
        showCharacter: true,
        strokeAnimationSpeed: 1,
        delayBetweenStrokes: 250,
        ...colors(),
        charDataLoader: (c: string) =>
          fetch(strokeUrl(c)).then((r) => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`)
            return r.json()
          }),
        onLoadCharDataSuccess: (data) => {
          if (!alive) return
          setLoad({ char, status: 'ready', strokes: data.strokes.length })
          // Gerak dikurangi: huruf tampil diam, animasi hanya bila tombol Putar ditekan.
          if (!reducedRef.current) {
            setPlaying(true)
            void w.animateCharacter({ onComplete: () => alive && setPlaying(false) })
          }
        },
        onLoadCharDataError: () => {
          if (alive) setLoad({ char, status: 'missing', strokes: 0 })
        },
      })
      writer.current = w
      ro = new ResizeObserver(() => {
        const s = Math.max(120, Math.floor(outer.clientWidth))
        w.updateDimensions({ width: s, height: s, padding: Math.round(s * 0.08) })
      })
      ro.observe(outer)
      // Warna ikut tema (terang/gelap).
      mo = new MutationObserver(() => {
        const c = colors()
        void w.updateColor('strokeColor', c.strokeColor)
        void w.updateColor('outlineColor', c.outlineColor)
      })
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    }, () => alive && setLoad({ char, status: 'missing', strokes: 0 }))
    return () => {
      alive = false
      ro?.disconnect()
      mo?.disconnect()
      void writer.current?.pauseAnimation()
      writer.current = null
      el.innerHTML = ''
    }
  }, [char])

  const togglePlay = () => {
    const w = writer.current
    if (!w) return
    if (!playing) return animate()
    if (paused) {
      void w.resumeAnimation()
      setPaused(false)
    } else {
      void w.pauseAnimation()
      setPaused(true)
    }
  }

  return (
    <section className="card stroke-panel" aria-labelledby="stroke-title">
      <div className="stroke-head">
        <h2 id="stroke-title" className="card-title">
          {t('learn.stroke.title')}
        </h2>
        {state.status === 'ready' ? (
          <span className="badge badge-purple">{t(state.strokes === 1 ? 'learn.stroke.countOne' : 'learn.stroke.count', { n: state.strokes })}</span>
        ) : null}
      </div>
      {chars.length > 1 ? (
        <div className="stroke-pick" role="group" aria-label={t('learn.stroke.pick')}>
          {chars.map((c, i) => (
            <button
              key={c}
              type="button"
              lang="zh-CN"
              className="stroke-pick-btn"
              aria-pressed={i === selected}
              onClick={() => setSelected(i)}
            >
              {c}
            </button>
          ))}
        </div>
      ) : null}
      <div className="stroke-box" ref={box} role="img" aria-label={t('learn.stroke.boxLabel', { char })}>
        <svg className="stroke-grid" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path d="M50 0v100M0 50h100M0 0l100 100M100 0 0 100" />
        </svg>
        <div className="stroke-target" ref={target} aria-hidden="true" />
        {state.status === 'missing' ? (
          <span className="stroke-static" lang="zh-CN" aria-hidden="true">
            {char}
          </span>
        ) : null}
      </div>
      {state.status === 'missing' ? <p className="muted stroke-missing">{t('learn.stroke.missing')}</p> : null}
      <div className="row-actions">
        <button type="button" className="btn btn-purple" disabled={state.status !== 'ready'} onClick={togglePlay}>
          {playing && !paused ? <PauseIcon /> : <PlayIcon />}
          <span>{playing && !paused ? t('learn.stroke.pause') : t('learn.stroke.play')}</span>
        </button>
        <button type="button" className="btn btn-white" disabled={state.status !== 'ready'} onClick={animate}>
          <RepeatIcon />
          <span>{t('learn.stroke.replay')}</span>
        </button>
      </div>
      {reduced ? <p className="muted stroke-note">{t('learn.stroke.reduced')}</p> : null}
    </section>
  )
}
