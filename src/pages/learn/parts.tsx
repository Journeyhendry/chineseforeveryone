import { useId, type ReactNode } from 'react'
import { ArrowLeftIcon, CloseIcon, SpeakerIcon, SpeakerSlowIcon, StarIcon } from '../../components/icons'
import { useT } from '../../i18n/context'
import { AUDIO_SOURCE } from '../../lib/audio'
import type { Tone } from '../../lib/pinyin'
import { charTones, syllableColors, toneBadge } from '../../lib/tones'
import { useAudio } from './hooks'
import { pinyinWords } from './text'
import './learn.css'

const toneStyle = (tone: Tone | null) => (tone ? { color: `var(--tone-${tone})` } : undefined)

/** Hanzi berwarna nada. Harus berada di atas --tone-surface (kelas .tone-box). */
export function ToneHanzi({ hanzi, syllables, className }: { hanzi: string; syllables: string[]; className?: string }) {
  const tones = charTones(hanzi, syllables)
  return (
    <span lang="zh-CN" className={`hanzi ${className ?? ''}`}>
      {[...hanzi].map((ch, i) => (
        <span key={i} style={toneStyle(tones[i])}>
          {ch}
        </span>
      ))}
    </span>
  )
}

/** Pinyin bertanda nada, tiap suku kata berwarna nada. */
export function TonePinyin({ pinyin, className }: { pinyin: string; className?: string }) {
  const words = pinyinWords(pinyin)
  return (
    <span lang="zh-Latn-pinyin" className={`pinyin ${className ?? ''}`}>
      {words.map((syls, wi) => {
        const colors = syllableColors(syls)
        return (
          <span key={wi}>
            {wi > 0 ? ' ' : null}
            {syls.map((s, i) => (
              <span key={i} style={toneStyle(colors[i])}>
                {s}
              </span>
            ))}
          </span>
        )
      })}
    </span>
  )
}

const TONE_SIGNS: Record<Tone, string> = { 1: '¯', 2: '´', 3: 'ˇ', 4: '`', 5: '·' }

/** Label nada per suku kata; suku kata (pinyin) hanya tampil bila `showPinyin`. */
export function ToneLabels({ syllables, showPinyin }: { syllables: string[]; showPinyin: boolean }) {
  const t = useT()
  return (
    <ul className="tone-labels">
      {syllables.map((s, i) => {
        const { pinyin, tone } = toneBadge(s, showPinyin)
        return (
          <li key={i} className={`tone-tag tone-tag-${tone}`}>
            {pinyin !== null ? (
              <>
                <span lang="zh-Latn-pinyin">{pinyin}</span> ·{' '}
              </>
            ) : null}
            {t(`tone.${tone}`)} <span aria-hidden="true">{TONE_SIGNS[tone]}</span>
          </li>
        )
      })}
    </ul>
  )
}

export function Stars({ stars, className }: { stars: number; className?: string }) {
  const t = useT()
  return (
    <span className={`stars ${className ?? ''}`}>
      {[1, 2, 3].map((n) => (
        <StarIcon key={n} filled={n <= stars} />
      ))}
      <span className="sr-only">{t('learn.stars', { n: stars })}</span>
    </span>
  )
}

export function Badge({ children, tone = 'plain' }: { children: ReactNode; tone?: 'plain' | 'purple' | 'yellow' | 'machine' }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

export function MachineTag() {
  const t = useT()
  return <Badge tone="machine">{t('learn.machine')}</Badge>
}

export function LoadState({ status, retry }: { status: 'loading' | 'error'; retry: () => void }) {
  const t = useT()
  if (status === 'loading') {
    return (
      <p className="card load-state" role="status">
        {t('learn.loading')}
      </p>
    )
  }
  return (
    <div className="card load-state" role="alert">
      <p>{t('learn.loadError')}</p>
      <button type="button" className="btn" onClick={retry}>
        {t('learn.retry')}
      </button>
    </div>
  )
}

/** Bar atas pelajaran: tombol keluar, konteks, hitungan, progressbar. */
export function LessonBar(props: {
  exitHref: string
  exitLabel: string
  context: string
  count: string
  value: number
  max: number
  barLabel: string
}) {
  return (
    <div className="lesson-bar">
      <a className="icon-btn" href={props.exitHref} aria-label={props.exitLabel}>
        <CloseIcon />
      </a>
      <div className="lesson-bar-main">
        <div className="lesson-bar-text">
          <span>{props.context}</span>
          <span>{props.count}</span>
        </div>
        <div
          className="progress"
          role="progressbar"
          aria-label={props.barLabel}
          aria-valuemin={0}
          aria-valuemax={props.max}
          aria-valuenow={props.value}
          aria-valuetext={props.count}
        >
          <div className="progress-fill" style={{ width: `${props.max ? (100 * props.value) / props.max : 0}%` }} />
        </div>
      </div>
    </div>
  )
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a className="back-link" href={href}>
      <ArrowLeftIcon />
      <span>{children}</span>
    </a>
  )
}

/** Tombol Dengar + Pelan, dengan catatan sumber suara atau alasan nonaktif. */
export function AudioButtons({ text, label, compact = false }: { text: string; label: string; compact?: boolean }) {
  const t = useT()
  const { available, play } = useAudio()
  const noteId = useId()
  return (
    <div className={`audio-buttons ${compact ? 'is-compact' : ''}`}>
      <div className="audio-row">
        <button
          type="button"
          className="btn btn-yellow"
          disabled={!available}
          aria-describedby={noteId}
          aria-label={t('learn.audio.playLabel', { text: label })}
          onClick={() => play(text)}
        >
          <SpeakerIcon />
          <span>{t('learn.audio.play')}</span>
        </button>
        {compact ? null : (
          <button
            type="button"
            className="btn btn-white"
            disabled={!available}
            aria-describedby={noteId}
            aria-label={t('learn.audio.slowLabel', { text: label })}
            onClick={() => play(text, true)}
          >
            <SpeakerSlowIcon />
            <span>{t('learn.audio.slow')}</span>
          </button>
        )}
      </div>
      <span id={noteId} className="audio-note">
        {available ? (AUDIO_SOURCE === 'device' ? t('learn.audio.device') : '') : t('learn.audio.none')}
      </span>
    </div>
  )
}

/** Tombol dengar kecil (ikon saja) untuk kalimat / baris dialog. */
export function SpeakButton({ text, label }: { text: string; label: string }) {
  const t = useT()
  const { available, play } = useAudio()
  return (
    <button
      type="button"
      className="icon-btn icon-btn-sm"
      disabled={!available}
      aria-label={available ? t('learn.audio.playLabel', { text: label }) : t('learn.audio.noneShort')}
      title={available ? undefined : t('learn.audio.none')}
      onClick={() => play(text)}
    >
      <SpeakerIcon />
    </button>
  )
}
