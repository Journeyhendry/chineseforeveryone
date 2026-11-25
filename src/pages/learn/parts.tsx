import { useId, type ReactNode } from 'react'
import { ArrowLeftIcon, CloseIcon, SpeakerIcon, SpeakerSlowIcon, StarIcon } from '../../components/icons'
import { useT } from '../../i18n/context'
import type { Voice } from '../../lib/audio'
import { playRecording } from '../../lib/audio'
import type { Tone } from '../../lib/pinyin'
import { charTones, syllableColors, toneBadge } from '../../lib/tones'
import { useAudio, useNativeRecordings } from './hooks'
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

/** Tombol Dengar + Pelan, dengan catatan bila suaranya sementara dari perangkat atau tidak ada. */
export function AudioButtons({ text, label, compact = false, voice }: { text: string; label: string; compact?: boolean; voice?: Voice }) {
  const t = useT()
  const { play, sourceFor } = useAudio()
  const noteId = useId()
  const source = sourceFor(text, voice)
  const disabled = source === 'none'
  return (
    <div className={`audio-buttons ${compact ? 'is-compact' : ''}`}>
      <div className="audio-row">
        <button
          type="button"
          className="btn btn-yellow"
          disabled={disabled}
          aria-describedby={noteId}
          aria-label={t('learn.audio.playLabel', { text: label })}
          onClick={() => play(text, false, voice)}
        >
          <SpeakerIcon />
          <span>{t('learn.audio.play')}</span>
        </button>
        {compact ? null : (
          <button
            type="button"
            className="btn btn-white"
            disabled={disabled}
            aria-describedby={noteId}
            aria-label={t('learn.audio.slowLabel', { text: label })}
            onClick={() => play(text, true, voice)}
          >
            <SpeakerSlowIcon />
            <span>{t('learn.audio.slow')}</span>
          </button>
        )}
      </div>
      <span id={noteId} className="audio-note">
        {source === 'device' ? t('learn.audio.device') : source === 'none' ? t('learn.audio.none') : ''}
      </span>
    </div>
  )
}

/** Tombol dengar kecil (ikon saja) untuk kalimat / baris dialog. `voice="male"` = suara laki-laki (L3). */
export function SpeakButton({ text, label, voice }: { text: string; label: string; voice?: Voice }) {
  const t = useT()
  const { play, sourceFor } = useAudio()
  const source = sourceFor(text, voice)
  const disabled = source === 'none'
  return (
    <button
      type="button"
      className="icon-btn icon-btn-sm"
      disabled={disabled}
      aria-label={disabled ? t('learn.audio.noneShort') : t('learn.audio.playLabel', { text: label })}
      title={disabled ? t('learn.audio.none') : source === 'device' ? t('learn.audio.device') : undefined}
      onClick={() => play(text, false, voice)}
    >
      <SpeakerIcon />
    </button>
  )
}

/** "Dengar penutur asli": hanya tampil bila ada rekaman berlisensi bebas untuk kata ini. */
export function NativeButtons({ id, label }: { id: string; label: string }) {
  const t = useT()
  const recordings = useNativeRecordings(id)
  if (recordings.length === 0) return null
  return (
    <ul className="native-list">
      {recordings.map((r, i) => (
        <li key={r.path} className="native-item">
          <button
            type="button"
            className="btn btn-white"
            aria-label={t('learn.audio.nativeLabel', { text: label })}
            onClick={() => playRecording(r.path)}
          >
            <SpeakerIcon />
            <span>{recordings.length > 1 ? `${t('learn.audio.native')} ${i + 1}` : t('learn.audio.native')}</span>
          </button>
          <span className="native-credit">
            {t('learn.audio.nativeBy', { author: r.author, license: r.license })}{' '}
            <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer">
              {t('learn.audio.nativeSource')}
            </a>
          </span>
        </li>
      ))}
    </ul>
  )
}
