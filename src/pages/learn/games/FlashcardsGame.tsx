import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeftIcon, ArrowRightIcon, SpeakerIcon } from '../../../components/icons'
import { againRound, createDeck, currentCard, deckDone, flashStars, flashSummary, markCard, roundOver } from '../../../games/flashcards'
import { useT } from '../../../i18n/context'
import { useSettings } from '../../../lib/settings-context'
import { isInteractiveTarget, useAudio, useHotkeys } from '../hooks'
import { TonePinyin, ToneLabels } from '../parts'
import { meaningShort } from '../text'
import { GameHeader, GameUnavailable } from './GameHeader'
import { newSeed, type GameProps } from './types'

export function FlashcardsGame({ play, info, data, unitName, onFinish }: GameProps) {
  const t = useT()
  const { settings } = useSettings()
  const lang = settings.lang
  const { available, play: speak } = useAudio()
  const words = useMemo(() => new Map(data.words.map((w) => [w.id, w])), [data])
  const [deck, setDeck] = useState(() => createDeck(data.words.map((w) => w.id), newSeed()))
  const [flipped, setFlipped] = useState(false)
  const cardRef = useRef<HTMLButtonElement>(null)
  const repeatRef = useRef<HTMLButtonElement>(null)
  const id = currentCard(deck)
  const word = id ? words.get(id) : undefined
  const over = roundOver(deck)
  const finished = useRef(false)

  useEffect(() => {
    if (over && deckDone(deck) && !finished.current) {
      finished.current = true
      const sum = flashSummary(deck)
      onFinish({
        stars: flashStars(sum),
        score: t('game.kartu.summary', { first: sum.firstTry, total: sum.total, repeated: sum.repeated }),
        rule: t('game.kartu.rule'),
      })
    } else if (over) repeatRef.current?.focus()
  }, [over, deck, onFinish, t])

  const flip = () => setFlipped((f) => !f)
  const mark = (known: boolean) => {
    if (!flipped || !id) return
    setDeck((d) => markCard(d, known))
    setFlipped(false)
    cardRef.current?.focus()
  }
  const repeat = () => {
    setDeck((d) => againRound(d))
    setFlipped(false)
    requestAnimationFrame(() => cardRef.current?.focus())
  }

  useHotkeys((e) => {
    if (over) return
    if (e.key === 'ArrowLeft' || e.key === '1') {
      e.preventDefault()
      mark(true)
    } else if (e.key === 'ArrowRight' || e.key === '2') {
      e.preventDefault()
      mark(false)
    } else if ((e.key === ' ' || e.key === 'Enter') && !isInteractiveTarget(e.target)) {
      e.preventDefault()
      flip()
    }
  })

  if (data.words.length === 0) return <GameUnavailable message={t('game.unavailable')} unitId={info.id} />
  const knownCount = deck.ids.filter((x) => deck.status[x] === 'tahu').length
  const summary = flashSummary(deck)

  return (
    <div className="game game-kartu">
      <GameHeader
        kind="kartu"
        unitId={info.id}
        unitName={unitName}
        play={play}
        count={`${t('game.kartu.round', { n: deck.round })} · ${t('game.count', { n: Math.min(deck.pos + 1, deck.queue.length), total: deck.queue.length })}`}
        value={knownCount}
        max={deck.ids.length}
        hint={t('game.kartu.hint')}
      />
      {over && deckDone(deck) ? null : over ? (
        <div className="card game-round" role="status">
          <h2 className="card-title">{t('game.kartu.roundOver')}</h2>
          <p>{t('game.kartu.roundSummary', { known: summary.known, again: summary.again })}</p>
          <button type="button" ref={repeatRef} className="btn btn-big" onClick={repeat}>
            {t('game.kartu.repeat', { n: summary.again })}
          </button>
        </div>
      ) : word ? (
        <>
          <div className="flip-stage">
            <button
              type="button"
              ref={cardRef}
              className={`flip-card${flipped ? ' is-flipped' : ''}`}
              aria-label={flipped ? t('game.kartu.cardBack', { hanzi: word.hanzi }) : t('game.kartu.cardLabel', { hanzi: word.hanzi })}
              aria-pressed={flipped}
              onClick={flip}
            >
              <span className="flip-inner">
                <span className="flip-face flip-front tone-box" aria-hidden={flipped}>
                  <span className="flip-hanzi" lang="zh-CN">
                    {word.hanzi}
                  </span>
                  <span className="flip-tap">{t('game.kartu.tapToFlip')} ↻</span>
                </span>
                <span className="flip-face flip-back tone-box" aria-hidden={!flipped}>
                  <span className="flip-hanzi-sm" lang="zh-CN">
                    {word.hanzi}
                  </span>
                  <TonePinyin pinyin={word.pinyin} className="flip-pinyin" />
                  <span className="flip-meaning">{meaningShort(word, lang)}</span>
                </span>
              </span>
            </button>
          </div>
          {/* Isi belakang kartu untuk pembaca layar (kartu = tombol, isinya disembunyikan dari label). */}
          <div className="sr-only" aria-live="polite">
            {flipped ? `${word.hanzi}, ${word.pinyin}, ${meaningShort(word, lang)}` : ''}
          </div>
          <div className="flip-tools">
            {flipped ? <ToneLabels syllables={word.syllables} showPinyin={false} /> : null}
            <button type="button" className="btn btn-yellow" disabled={!available} onClick={() => speak(word.hanzi)} aria-label={available ? t('learn.audio.playLabel', { text: word.hanzi }) : t('learn.audio.noneShort')}>
              <SpeakerIcon />
              <span>{t('game.listen')}</span>
            </button>
          </div>
          <div className="row-actions flip-actions">
            <button type="button" className="btn btn-big" aria-disabled={!flipped || undefined} onClick={() => mark(true)}>
              <ArrowLeftIcon />
              <span>{t('game.kartu.know')}</span>
            </button>
            <button type="button" className="btn btn-big btn-purple" aria-disabled={!flipped || undefined} onClick={() => mark(false)}>
              <span>{t('game.kartu.again')}</span>
              <ArrowRightIcon />
            </button>
          </div>
          {!flipped ? <p className="key-hint game-note">{t('game.kartu.flipFirst')}</p> : null}
        </>
      ) : null}
      <p className="key-hint">{t('game.kartu.keys')}</p>
    </div>
  )
}
