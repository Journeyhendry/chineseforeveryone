import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { CheckIcon, CloseIcon, SpeakerIcon } from '../../../components/icons'
import { buildMatchRound, elapsed, formatTime, matchDone, MATCH_PAIRS, matchStars, selectCard, startMatch, type MatchMode, type MatchState, type Side } from '../../../games/match'
import { useT } from '../../../i18n/context'
import { useSettings } from '../../../lib/settings-context'
import { useAudio } from '../hooks'
import { ToneHanzi } from '../parts'
import { meaningShort } from '../text'
import { GameHeader, GameUnavailable } from './GameHeader'
import { newSeed, type GameProps } from './types'

/** Jam dinding (ms); satu titik supaya mudah diganti saat tes. */
const clock = () => Date.now()

export function MatchGame(props: GameProps) {
  const t = useT()
  const { available } = useAudio()
  const [mode, setMode] = useState<MatchMode>('hanzi-meaning')
  const [game, setGame] = useState<MatchState | null>(null)
  const name = useId()
  const effective: MatchMode = available ? mode : 'hanzi-meaning'

  if (props.data.words.length < 2) return <GameUnavailable message={t('game.unavailable')} unitId={props.info.id} />
  if (game) return <MatchBoard {...props} initial={game} />

  const start = () => setGame(startMatch(buildMatchRound(props.data.words, { mode: effective, seed: newSeed(), size: MATCH_PAIRS })))
  return (
    <div className="game game-jodohkan">
      <GameHeader kind="jodohkan" unitId={props.info.id} unitName={props.unitName} play={props.play} count="00:00" value={0} max={1} hint={t('game.jodohkan.hint')} />
      <div className="card match-setup">
        <fieldset className="field">
          <legend>{t('game.jodohkan.modeLegend')}</legend>
          <div className="choices">
            {(['hanzi-meaning', 'audio-hanzi'] as const).map((m) => {
              const disabled = m === 'audio-hanzi' && !available
              return (
                <label key={m} className={`choice${disabled ? ' is-disabled' : ''}`}>
                  <input type="radio" name={name} value={m} checked={effective === m} disabled={disabled} onChange={() => setMode(m)} />
                  <span>{t(m === 'hanzi-meaning' ? 'game.jodohkan.modeMeaning' : 'game.jodohkan.modeAudio')}</span>
                </label>
              )
            })}
          </div>
          {!available ? <p className="muted game-note">{t('game.jodohkan.audioOff')}</p> : null}
        </fieldset>
        <button type="button" className="btn btn-big" onClick={start}>
          {t('game.jodohkan.start')}
        </button>
      </div>
      <p className="key-hint">{t('game.jodohkan.keys')}</p>
    </div>
  )
}

function MatchBoard({ play, info, data, unitName, onFinish, initial }: GameProps & { initial: MatchState }) {
  const t = useT()
  const { settings } = useSettings()
  const lang = settings.lang
  const { available, play: speak } = useAudio()
  const words = useMemo(() => new Map(data.words.map((w) => [w.id, w])), [data])
  const [s, setS] = useState(initial)
  const [now, setNow] = useState(clock)
  const [status, setStatus] = useState('')
  const board = useRef<HTMLDivElement>(null)
  const round = s.round
  const audioMode = round.mode === 'audio-hanzi'
  const done = matchDone(s)
  const running = s.startedAt !== null && !done

  // Jam: diperbarui 4x per detik selama berjalan (tidak diumumkan pembaca layar).
  useEffect(() => {
    if (!running) return
    const timer = setInterval(() => setNow(clock()), 250)
    return () => clearInterval(timer)
  }, [running])

  useEffect(() => {
    if (!done) return
    const ms = elapsed(s, clock())
    const timer = setTimeout(() => {
      const n = round.ids.length
      onFinish({
        stars: matchStars(ms, s.mistakes, n),
        score: t('game.jodohkan.summary', { time: formatTime(ms), n: s.mistakes }),
        rule: t('game.jodohkan.rule', { s3: 6 * n, s2: 12 * n }),
      })
    }, 600)
    return () => clearTimeout(timer)
  }, [done, s, round.ids.length, onFinish, t])

  const pick = (side: Side, id: string) => {
    if (side === 'left' && audioMode && available) speak(words.get(id)!.hanzi)
    const at = clock()
    const next = selectCard(s, side, id, at)
    if (next === s) return
    setNow(at)
    if (next.matched.length > s.matched.length) {
      const w = words.get(id)!
      setStatus(`${t('game.jodohkan.ok')} ${w.hanzi} = ${meaningShort(w, lang)}`)
      // Fokus ke kartu kiri pertama yang belum cocok, supaya keyboard tidak tersangkut di kartu terkunci.
      const nextLeft = round.left.find((x) => !next.matched.includes(x))
      if (nextLeft) board.current?.querySelector<HTMLButtonElement>(`[data-side="left"][data-id="${nextLeft}"]`)?.focus()
    } else if (next.mistakes > s.mistakes) {
      setStatus(t('game.jodohkan.no'))
    }
    setS(next)
  }

  const cardState = (side: Side, id: string) => {
    if (s.matched.includes(id)) return ' is-matched'
    if ((side === 'left' ? s.selLeft : s.selRight) === id) return ' is-selected'
    // Dua nama animasi bergantian supaya goyang terulang tanpa memasang ulang tombol (fokus tetap).
    if (s.lastWrong && s.lastWrong[side] === id) return ` is-wrong shake-${s.wrongSeq % 2}`
    return ''
  }

  const soundNo = (id: string) => round.left.indexOf(id) + 1

  return (
    <div className="game game-jodohkan">
      <GameHeader
        kind="jodohkan"
        unitId={info.id}
        unitName={unitName}
        play={play}
        focusKey="board"
        count={t('game.count', { n: s.matched.length, total: round.ids.length })}
        value={s.matched.length}
        max={round.ids.length}
        hint={t('game.jodohkan.hint')}
      />
      <div className="match-stats">
        <span className="match-timer">
          <span className="sr-only">{t('game.jodohkan.time')}: </span>
          <span aria-hidden="true">⏱ </span>
          <span className="match-time">{formatTime(elapsed(s, now))}</span>
        </span>
        <span className="match-mistakes">{t('game.jodohkan.mistakes', { n: s.mistakes })}</span>
      </div>
      <div className="match-board" ref={board}>
        {(['left', 'right'] as const).map((side) => (
          <div key={side} className="match-col" role="group" aria-label={side === 'left' ? t(audioMode ? 'game.jodohkan.leftAudio' : 'game.jodohkan.left') : t(audioMode ? 'game.jodohkan.left' : 'game.jodohkan.right')}>
            <h2 className="match-col-title" aria-hidden="true">
              {side === 'left' ? t(audioMode ? 'game.jodohkan.leftAudio' : 'game.jodohkan.left') : t(audioMode ? 'game.jodohkan.left' : 'game.jodohkan.right')}
            </h2>
            {(side === 'left' ? round.left : round.right).map((id) => {
              const w = words.get(id)!
              const st = cardState(side, id)
              const matched = st === ' is-matched'
              const wrong = st.startsWith(' is-wrong')
              const showHanzi = side === 'right' ? audioMode : !audioMode
              return (
                <button
                  key={id}
                  data-side={side}
                  data-id={id}
                  type="button"
                  className={`match-card tone-box${st}${showHanzi ? ' is-hanzi' : ''}`}
                  aria-pressed={st === ' is-selected'}
                  aria-disabled={matched || undefined}
                  onClick={() => !matched && pick(side, id)}
                >
                  {side === 'left' && audioMode ? (
                    <span className="match-sound">
                      <SpeakerIcon />
                      <span>{t('game.jodohkan.sound', { n: soundNo(id) })}</span>
                    </span>
                  ) : showHanzi ? (
                    <ToneHanzi hanzi={w.hanzi} syllables={w.syllables} className="match-hanzi" />
                  ) : (
                    <span className="match-meaning">{meaningShort(w, lang)}</span>
                  )}
                  {matched ? (
                    <span className="match-mark">
                      <CheckIcon />
                      <span className="sr-only">{t('game.jodohkan.matched')}</span>
                    </span>
                  ) : wrong ? (
                    <span className="match-mark">
                      <CloseIcon />
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>
        ))}
      </div>
      <p className="match-status" role="status">
        {status}
      </p>
      <p className="key-hint">{t('game.jodohkan.keys')}</p>
    </div>
  )
}
