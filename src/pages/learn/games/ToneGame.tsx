import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRightIcon, CheckIcon, CloseIcon, SpeakerIcon } from '../../../components/icons'
import { buildToneGame, TONE_SIGNS, type ToneQuestion } from '../../../games/tone'
import { useT } from '../../../i18n/context'
import { stripTones } from '../../../lib/pinyin'
import { starsFor } from '../../../lib/progress'
import { toneMark } from '../../../lib/quiz'
import { useSettings } from '../../../lib/settings-context'
import { isInteractiveTarget, useAudio, useHotkeys } from '../hooks'
import { TonePinyin } from '../parts'
import { meaningShort } from '../text'
import { GameHeader, GameUnavailable } from './GameHeader'
import { ToneCurve } from './ToneCurve'
import { newSeed, type GameProps } from './types'

export function ToneGame({ play, info, data, unitName, onFinish }: GameProps) {
  const t = useT()
  const [questions] = useState(() => buildToneGame(data.words, { seed: newSeed() }))
  const [i, setI] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [correct, setCorrect] = useState(0)
  const total = questions.length

  if (total === 0) return <GameUnavailable message={t('game.unavailable')} unitId={info.id} />
  const q = questions[i]

  const choose = (c: number) => {
    if (picked !== null || c < 0 || c >= q.choices.length) return
    setPicked(c)
    if (c === q.answer) setCorrect((n) => n + 1)
  }
  const next = () => {
    if (picked === null) return
    if (i + 1 >= total) {
      onFinish({ stars: starsFor(correct / total), score: t('learn.result.score', { correct, total }), rule: t('game.rule.score') })
      return
    }
    setI(i + 1)
    setPicked(null)
  }

  return (
    <div className="game game-nada">
      <GameHeader
        kind="nada"
        unitId={info.id}
        unitName={unitName}
        play={play}
        focusKey={i > 0 ? `q${i}` : undefined}
        count={t('game.count', { n: i + 1, total })}
        value={i + (picked === null ? 0 : 1)}
        max={total}
        hint={t('game.nada.hint')}
      />
      <ToneQuestionView key={i} q={q} data={data} picked={picked} last={i + 1 >= total} onChoose={choose} onNext={next} />
      <p className="key-hint game-note">{t('game.nada.rule')}</p>
    </div>
  )
}

function ToneQuestionView({ q, data, picked, last, onChoose, onNext }: { q: ToneQuestion; data: GameProps['data']; picked: number | null; last: boolean; onChoose: (c: number) => void; onNext: () => void }) {
  const t = useT()
  const { settings } = useSettings()
  const { available, play } = useAudio()
  const word = useMemo(() => data.words.find((w) => w.id === q.wordId)!, [data, q.wordId])
  const nextBtn = useRef<HTMLButtonElement>(null)
  const answered = picked !== null
  const right = answered && picked === q.answer

  useEffect(() => {
    if (available) play(q.hanzi)
  }, [available, play, q.hanzi])

  useEffect(() => {
    if (answered) nextBtn.current?.focus()
  }, [answered])

  useHotkeys((e) => {
    if (/^[1-4]$/.test(e.key)) {
      e.preventDefault()
      onChoose(Number(e.key) - 1)
    } else if (e.key === 'Enter') {
      if (!answered || isInteractiveTarget(e.target)) return
      e.preventDefault()
      onNext()
    } else if (e.key === ' ' || e.code === 'Space') {
      if (isInteractiveTarget(e.target)) return
      e.preventDefault()
      if (available) play(q.hanzi)
    }
  })

  const pinyinOf = (tones: number[]) => q.syllables.map((s, k) => toneMark(s, tones[k] as 1 | 2 | 3 | 4)).join(' ')
  const plain = q.syllables.map((s) => stripTones(s).toLowerCase()).join(' ')

  return (
    <div className="question">
      <div className="prompt card tone-box">
        <button type="button" className="prompt-audio" disabled={!available} aria-label={available ? t('game.nada.playAgain') : t('learn.audio.noneShort')} onClick={() => play(q.hanzi)}>
          <SpeakerIcon />
        </button>
        <div className="prompt-body">
          {!available || answered ? (
            <span className="prompt-hanzi" lang="zh-CN">
              {q.hanzi}
            </span>
          ) : null}
          {answered ? (
            <TonePinyin pinyin={q.syllables.join('')} className="prompt-pinyin" />
          ) : !available ? (
            <span className="prompt-pinyin plain" lang="zh-Latn-pinyin">
              {plain}
            </span>
          ) : (
            <span className="prompt-hint">{t('learn.q.listenHint')}</span>
          )}
          {q.part && (answered || !available) ? <span className="prompt-hint">{t('game.nada.part', { word: word.hanzi })}</span> : null}
        </div>
      </div>
      {!available ? <p className="game-note muted">{t('game.nada.noAudio')}</p> : null}

      <div className="choices choices-tone" role="group" aria-label={t('learn.q.choices')}>
        {q.choices.map((c, ci) => {
          const isPicked = picked === ci
          const state = !answered ? '' : ci === q.answer ? ' is-correct' : isPicked ? ' is-wrong' : ' is-dim'
          const label = c.map((tone) => t(`tone.${tone}`)).join(' + ')
          return (
            <button
              key={ci}
              type="button"
              className={`choice-btn${state}`}
              aria-pressed={isPicked}
              aria-disabled={answered || undefined}
              aria-label={t('game.nada.choice', { n: ci + 1, tones: label })}
              onClick={() => onChoose(ci)}
            >
              <span className="choice-key" aria-hidden="true">
                {ci + 1}
              </span>
              <span className="choice-body">
                <span className="tone-pattern" aria-hidden="true">
                  {c.map((tone, k) => (
                    <span key={k} className="tone-step">
                      <ToneCurve tone={tone} />
                      <span className="tone-num" style={{ color: `var(--tone-${tone})` }}>
                        {TONE_SIGNS[tone]} {tone}
                      </span>
                    </span>
                  ))}
                </span>
                {settings.showPinyin || !available ? (
                  <span className="tone-choice-pinyin" lang="zh-Latn-pinyin" aria-hidden="true">
                    {pinyinOf(c)}
                  </span>
                ) : null}
              </span>
              {answered && ci === q.answer ? (
                <span className="choice-mark">
                  <CheckIcon />
                  <span className="sr-only">{t('learn.q.correctMark')}</span>
                </span>
              ) : null}
              {answered && isPicked && ci !== q.answer ? (
                <span className="choice-mark">
                  <CloseIcon />
                  <span className="sr-only">{t('learn.q.yourAnswer')}</span>
                </span>
              ) : null}
            </button>
          )
        })}
      </div>

      <div className={`feedback${answered ? (right ? ' is-right' : ' is-wrong') : ''}`} role="status">
        {answered ? (
          <>
            <div className="feedback-text">
              <strong className="feedback-title">{right ? t('learn.q.right') : t('learn.q.wrong')}</strong>
              <span>
                <span lang="zh-CN" className="hanzi-inline">
                  {q.hanzi}
                </span>{' '}
                = <span lang="zh-Latn-pinyin">{q.syllables.join(' ')}</span>
                {q.part ? null : <> · {meaningShort(word, settings.lang)}</>}
              </span>
            </div>
            <button type="button" ref={nextBtn} className="btn btn-big" onClick={onNext}>
              <span>{last ? t('learn.q.finish') : t('learn.next')}</span>
              <ArrowRightIcon />
            </button>
          </>
        ) : null}
      </div>
      <p className="key-hint">{t('game.nada.keys')}</p>
    </div>
  )
}
