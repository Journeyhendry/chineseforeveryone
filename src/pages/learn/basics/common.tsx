import { useEffect, useId, useState, type ReactNode } from 'react'
import { SpeakerIcon } from '../../../components/icons'
import { useT } from '../../../i18n/context'
import type { AudioItem, BasicsPart, ToneInfo } from '../../../lib/basics'
import { learnHref } from '../../../lib/router'
import { useBasicsAudio } from './audio'

/** Catatan kecil sumber suara (sama seperti di unit). */
export function AudioNote({ items }: { items: AudioItem[] }) {
  const t = useT()
  const { source, ready } = useBasicsAudio()
  if (!ready) return null
  const sources = new Set(items.map(source))
  let text = ''
  if (sources.has(null) && sources.size === 1) text = t('learn.audio.none')
  else if (sources.has('device')) text = t('basics.audio.device')
  else if (sources.has('file')) text = t('basics.audio.file')
  return text ? <p className="audio-note basics-audio-note">{text}</p> : null
}

/** Tombol bunyi (petak): isi bebas, klik/Enter = dengar. */
export function SoundTile({
  item,
  label,
  children,
  className,
  pressed,
  onPlay,
}: {
  item: AudioItem
  label: string
  children: ReactNode
  className?: string
  pressed?: boolean
  onPlay?: () => void
}) {
  const t = useT()
  const { has, play } = useBasicsAudio()
  const can = has(item)
  return (
    <button
      type="button"
      className={`sound-tile tone-box ${className ?? ''}`}
      aria-label={can ? t('learn.audio.playLabel', { text: label }) : `${label} (${t('learn.audio.noneShort')})`}
      aria-pressed={pressed}
      onClick={() => {
        if (can) play(item)
        onPlay?.()
      }}
    >
      {children}
    </button>
  )
}

/** Tombol dengar kecil (ikon). */
export function PlayIconButton({ item, label }: { item: AudioItem; label: string }) {
  const t = useT()
  const { has, play } = useBasicsAudio()
  const can = has(item)
  return (
    <button
      type="button"
      className="icon-btn icon-btn-sm"
      disabled={!can}
      aria-label={can ? t('learn.audio.playLabel', { text: label }) : t('learn.audio.noneShort')}
      onClick={() => play(item)}
    >
      <SpeakerIcon />
    </button>
  )
}

// ---------- garis nada ----------

const level = (l: number) => 52 - (l - 1) * 11

/** Garis nada (skala tinggi 1-5) berwarna nada. Selalu dipasangkan dengan tanda nada di teks. */
export function ToneContour({ tone, size = 120 }: { tone: ToneInfo; size?: number }) {
  const c = tone.contour
  let d: string
  if (c.length === 1) d = `M42 ${level(c[0])}h16`
  else if (c.length === 2) d = `M12 ${level(c[0])}L88 ${level(c[1])}`
  else {
    const p0 = [12, level(c[0])]
    const p1 = [46, level(c[1])]
    const p2 = [88, level(c[2])]
    const ctrl = [2 * p1[0] - (p0[0] + p2[0]) / 2, 2 * p1[1] - (p0[1] + p2[1]) / 2]
    d = `M${p0[0]} ${p0[1]}Q${ctrl[0]} ${ctrl[1]} ${p2[0]} ${p2[1]}`
  }
  return (
    <svg className="tone-contour" width={size} height={(size * 64) / 100} viewBox="0 0 100 64" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((l) => (
        <line key={l} x1="4" x2="96" y1={level(l)} y2={level(l)} className="tone-contour-grid" />
      ))}
      <path d={d} fill="none" stroke={`var(--tone-${tone.tone})`} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ---------- satu coretan yang disorot ----------

interface CharData {
  strokes: string[]
  medians: number[][][]
}
const charCache = new Map<string, Promise<CharData>>()
function loadChar(ch: string): Promise<CharData> {
  let p = charCache.get(ch)
  if (!p) {
    p = fetch(`${import.meta.env.BASE_URL}hanzi/${encodeURIComponent(ch)}.json`).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return r.json() as Promise<CharData>
    })
    p.catch(() => charCache.delete(ch))
    charCache.set(ch, p)
  }
  return p
}

/** Huruf `char` dengan coretan ke-`index` disorot dan digambar ulang (animasi CSS; mati bila gerak dikurangi). */
export function StrokeShape({ char, index, label, replay = 0 }: { char: string; index: number; label: string; replay?: number }) {
  const [data, setData] = useState<{ char: string; d: CharData | null } | null>(null)
  const clip = `stk-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  useEffect(() => {
    let alive = true
    loadChar(char).then(
      (d) => alive && setData({ char, d }),
      () => alive && setData({ char, d: null }),
    )
    return () => {
      alive = false
    }
  }, [char])
  const cur = data?.char === char ? data.d : undefined
  return (
    <span className="stroke-shape" role="img" aria-label={label}>
      <svg viewBox="0 0 1024 1024" aria-hidden="true">
        <path className="stroke-shape-grid" d="M512 0v1024M0 512h1024" />
        {cur ? (
          <g transform="translate(0 900) scale(1 -1)">
            {cur.strokes.map((s, i) => (i === index ? null : <path key={i} d={s} className="stroke-shape-other" />))}
            <clipPath id={clip}>
              <path d={cur.strokes[index]} />
            </clipPath>
            <path d={cur.strokes[index]} className="stroke-shape-ghost" />
            <polyline
              key={replay}
              clipPath={`url(#${clip})`}
              className="stroke-shape-draw"
              points={(cur.medians[index] ?? []).map((p) => p.join(',')).join(' ')}
              pathLength={1}
            />
          </g>
        ) : null}
      </svg>
      {cur === null ? (
        <span className="stroke-shape-static" lang="zh-CN" aria-hidden="true">
          {char}
        </span>
      ) : null}
    </span>
  )
}

// ---------- kerangka halaman bagian ----------

export function PartNav({ part, prev, next }: { part: BasicsPart; prev: BasicsPart | null; next: BasicsPart | null }) {
  const t = useT()
  return (
    <nav className="basics-nav" aria-label={t('basics.nav.label')}>
      {prev ? (
        <a className="btn btn-white" href={learnHref({ screen: 'basics-part', part: prev })}>
          ← {t(`basics.part.${prev}.title`)}
        </a>
      ) : (
        <a className="btn btn-white" href={learnHref({ screen: 'basics' })}>
          ← {t('basics.home.title')}
        </a>
      )}
      <a className="btn btn-purple" href={learnHref({ screen: 'basics-practice', part })}>
        {t('basics.practice.start')}
      </a>
      {next ? (
        <a className="btn btn-white" href={learnHref({ screen: 'basics-part', part: next })}>
          {t(`basics.part.${next}.title`)} →
        </a>
      ) : null}
    </nav>
  )
}
