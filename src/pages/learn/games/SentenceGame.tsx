import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { ArrowRightIcon, SpeakerIcon } from '../../../components/icons'
import { buildLexicon, buildSentenceGame, collectSentences, isSentenceCorrect, placePiece, removeLast, removePiece, type GameSentence, type SentenceQuestion } from '../../../games/sentence'
import { useT } from '../../../i18n/context'
import { starsFor } from '../../../lib/progress'
import { useSettings } from '../../../lib/settings-context'
import { isInteractiveTarget, useAudio, useHotkeys, useWordBank } from '../hooks'
import { Badge, LoadState, MachineTag } from '../parts'
import { tatoebaUrl } from '../text'
import { GameHeader, GameUnavailable } from './GameHeader'
import { newSeed, type GameProps } from './types'

export function SentenceGame(props: GameProps) {
  const bank = useWordBank()
  if (bank.status !== 'ready') return <LoadState status={bank.status} retry={bank.retry} />
  return <SentenceRunner {...props} lexWords={bank.data.words} />
}

function SentenceRunner({ play, info, data, unitName, onFinish, lexWords }: GameProps & { lexWords: Map<string, { hanzi: string; pinyin: string }> }) {
  const t = useT()
  const [questions] = useState<SentenceQuestion[]>(() => buildSentenceGame(collectSentences(data, buildLexicon(lexWords.values())), { seed: newSeed() }))
  const [i, setI] = useState(0)
  const [correct, setCorrect] = useState(0)
  const total = questions.length
  if (total === 0) return <GameUnavailable message={t('game.susun.none')} unitId={info.id} />

  const done = (right: boolean) => {
    const c = correct + (right ? 1 : 0)
    if (i + 1 >= total) {
      onFinish({ stars: starsFor(c / total), score: t('learn.result.score', { correct: c, total }), rule: t('game.rule.score') })
      return
    }
    setCorrect(c)
    setI(i + 1)
  }

  return (
    <div className="game game-susun">
      <GameHeader
        kind="susun"
        unitId={info.id}
        unitName={unitName}
        play={play}
        focusKey={i > 0 ? `q${i}` : undefined}
        count={t('game.count', { n: i + 1, total })}
        value={i}
        max={total}
        hint={t('game.susun.hint')}
      />
      <SentenceQuestionView key={i} q={questions[i]} last={i + 1 >= total} onDone={done} />
    </div>
  )
}

interface Drag {
  piece: number
  from: 'bank' | 'answer'
  pointerId: number
  x0: number
  y0: number
  dx: number
  dy: number
  active: boolean
}

function SentenceQuestionView({ q, last, onDone }: { q: SentenceQuestion; last: boolean; onDone: (right: boolean) => void }) {
  const t = useT()
  const { settings } = useSettings()
  const lang = settings.lang
  const { available, play } = useAudio()
  const s = q.sentence
  const [answer, setAnswer] = useState<number[]>([])
  const [checked, setChecked] = useState<boolean | null>(null)
  const [warn, setWarn] = useState(false)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [over, setOver] = useState<'answer' | 'bank' | null>(null)
  const answerZone = useRef<HTMLDivElement>(null)
  const bankZone = useRef<HTMLDivElement>(null)
  const checkBtn = useRef<HTMLButtonElement>(null)
  const nextBtn = useRef<HTMLButtonElement>(null)
  const suppressClick = useRef(false)
  const pendingFocus = useRef<(() => void) | null>(null)
  const bankPiece = (p: number) => bankZone.current?.querySelector<HTMLButtonElement>(`button[data-piece="${p}"]`) ?? null
  const answerPiece = (p: number) => answerZone.current?.querySelector<HTMLButtonElement>(`button[data-piece="${p}"]`) ?? null
  const full = answer.length === s.pieces.length
  const locked = checked !== null

  useEffect(() => {
    pendingFocus.current?.()
    pendingFocus.current = null
  })
  useEffect(() => {
    if (locked) nextBtn.current?.focus()
  }, [locked])

  const focusAfterBankMove = (moved: number) => {
    pendingFocus.current = () => {
      const pos = q.bank.indexOf(moved)
      const rest = [...q.bank.slice(pos + 1), ...q.bank.slice(0, pos)]
      const target = rest.map(bankPiece).find(Boolean)
      ;(target ?? checkBtn.current)?.focus()
    }
  }

  const toAnswer = (piece: number, at?: number) => {
    if (locked) return
    setWarn(false)
    setAnswer((a) => placePiece(a, piece, at))
  }
  const toBank = (piece: number) => {
    if (locked) return
    setWarn(false)
    setAnswer((a) => removePiece(a, piece))
    pendingFocus.current = () => bankPiece(piece)?.focus()
  }
  const check = () => {
    if (locked) return
    if (!full) {
      setWarn(true)
      return
    }
    const right = isSentenceCorrect(s, answer)
    setChecked(right)
    if (available) play(s.cmn)
  }

  useHotkeys((e) => {
    if (e.key === 'Backspace' && !locked && answer.length) {
      e.preventDefault()
      const lastPiece = answer[answer.length - 1]
      setAnswer((a) => removeLast(a))
      pendingFocus.current = () => bankPiece(lastPiece)?.focus()
    } else if (e.key === 'Enter' && !isInteractiveTarget(e.target)) {
      e.preventDefault()
      if (locked) onDone(checked === true)
      else check()
    }
  })

  // ---------- seret (Pointer Events: mouse, sentuh, pena) ----------

  const inside = (el: HTMLElement | null, x: number, y: number) => {
    if (!el) return false
    const r = el.getBoundingClientRect()
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom
  }

  /** Posisi sisip di baris jawaban untuk titik (x, y), tanpa menghitung potongan yang diseret. */
  const insertIndex = (piece: number, x: number, y: number) => {
    const others = answer.filter((p) => p !== piece)
    let n = 0
    for (const p of others) {
      const el = answerPiece(p)
      if (!el) continue
      const r = el.getBoundingClientRect()
      const before = r.bottom < y || (r.top <= y && y <= r.bottom && r.left + r.width / 2 < x)
      if (before) n++
    }
    return n
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLButtonElement>, piece: number, from: 'bank' | 'answer') => {
    if (locked || e.button !== 0) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    setDrag({ piece, from, pointerId: e.pointerId, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0, active: false })
  }
  const onPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag || e.pointerId !== drag.pointerId) return
    const dx = e.clientX - drag.x0
    const dy = e.clientY - drag.y0
    const active = drag.active || Math.hypot(dx, dy) > 8
    setDrag({ ...drag, dx, dy, active })
    if (active) setOver(inside(answerZone.current, e.clientX, e.clientY) ? 'answer' : inside(bankZone.current, e.clientX, e.clientY) ? 'bank' : null)
  }
  const onPointerUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag || e.pointerId !== drag.pointerId) return
    if (drag.active) {
      suppressClick.current = true
      if (inside(answerZone.current, e.clientX, e.clientY)) toAnswer(drag.piece, insertIndex(drag.piece, e.clientX, e.clientY))
      else if (drag.from === 'answer' && inside(bankZone.current, e.clientX, e.clientY)) toBank(drag.piece)
    }
    setDrag(null)
    setOver(null)
  }
  const onPointerCancel = () => {
    setDrag(null)
    setOver(null)
  }
  const guarded = (fn: () => void) => {
    if (suppressClick.current) {
      suppressClick.current = false
      return
    }
    fn()
  }
  const dragStyle = (piece: number) => (drag?.active && drag.piece === piece ? { transform: `translate(${drag.dx}px, ${drag.dy}px)`, zIndex: 5 } : undefined)
  const pointer = (piece: number, from: 'bank' | 'answer') => ({
    onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => onPointerDown(e, piece, from),
    onPointerMove,
    onPointerUp,
    onPointerCancel,
  })

  // ---------- arti ----------

  const shown = lang === 'id' ? (s.tr.id ?? s.tr.en) : (s.tr.en ?? s.tr.id)
  const fallback = lang === 'id' ? !s.tr.id : !s.tr.en
  const pinyin = s.pieces.map((p) => p.pinyin).join(' ')
  const inAnswer = new Set(answer)

  return (
    <div className="question sentence">
      <div className="prompt card sentence-prompt">
        <button type="button" className="prompt-audio prompt-audio-sm" disabled={!available} aria-label={available ? t('learn.audio.playLabel', { text: s.cmn }) : t('learn.audio.noneShort')} onClick={() => play(s.cmn)}>
          <SpeakerIcon />
        </button>
        <div className="prompt-body">
          <span className="sentence-label">{t('game.susun.meaning')}</span>
          <span className="prompt-meaning sentence-meaning">{shown}</span>
          {fallback ? <Badge tone="yellow">{t('game.susun.otherLang')}</Badge> : null}
          {s.machine && lang === 'id' && !fallback ? <MachineTag /> : null}
        </div>
      </div>

      <section className={`sentence-zone sentence-answer${over === 'answer' ? ' is-over' : ''}${checked === true ? ' is-right' : checked === false ? ' is-wrong' : ''}`} aria-labelledby="answer-title">
        <h2 id="answer-title" className="sentence-zone-title">
          {t('game.susun.answer')}
        </h2>
        <div ref={answerZone} className="sentence-row tone-box">
          {answer.length === 0 ? <span className="sentence-empty">{t('game.susun.empty')}</span> : null}
          {answer.map((p, k) => (
            <button
              key={p}
              data-piece={p}
              type="button"
              className={`piece${drag?.active && drag.piece === p ? ' is-dragging' : ''}`}
              style={dragStyle(p)}
              aria-disabled={locked || undefined}
              onClick={() => guarded(() => toBank(p))}
              {...pointer(p, 'answer')}
            >
              <span lang="zh-CN">{s.pieces[p].text}</span>
              <span className="sr-only">, {t('game.susun.inAnswer', { n: k + 1 })}</span>
            </button>
          ))}
        </div>
      </section>

      <section className={`sentence-zone sentence-bank${over === 'bank' ? ' is-over' : ''}`} aria-labelledby="bank-title">
        <h2 id="bank-title" className="sentence-zone-title">
          {t('game.susun.bank')}
        </h2>
        <div ref={bankZone} className="sentence-row">
          {q.bank.map((p) =>
            inAnswer.has(p) ? (
              <span key={p} className="piece piece-slot" aria-hidden="true">
                <span lang="zh-CN">{s.pieces[p].text}</span>
              </span>
            ) : (
              <button
                key={p}
                data-piece={p}
                type="button"
                className={`piece tone-box${drag?.active && drag.piece === p ? ' is-dragging' : ''}`}
                style={dragStyle(p)}
                aria-disabled={locked || undefined}
                onClick={() =>
                  guarded(() => {
                    toAnswer(p)
                    focusAfterBankMove(p)
                  })
                }
                {...pointer(p, 'bank')}
              >
                <span lang="zh-CN">{s.pieces[p].text}</span>
              </button>
            ),
          )}
        </div>
      </section>

      {!locked ? (
        <div className="row-actions sentence-actions">
          <button type="button" ref={checkBtn} className="btn btn-big" aria-disabled={!full || undefined} onClick={check}>
            {t('game.susun.check')}
          </button>
          <button type="button" className="btn btn-white" disabled={answer.length === 0} onClick={() => setAnswer([])}>
            {t('game.susun.clear')}
          </button>
          <span className="game-note muted" role="status">
            {warn ? t('game.susun.notFull') : ''}
          </span>
        </div>
      ) : null}

      <div className={`feedback${locked ? (checked ? ' is-right' : ' is-wrong') : ''}`} role="status">
        {locked ? (
          <>
            <div className="feedback-text">
              <strong className="feedback-title">{checked ? t('learn.q.right') : t('learn.q.wrong')}</strong>
              <span>{t('game.susun.correct')}</span>
              <span lang="zh-CN" className="sentence-correct">
                {s.cmn}
              </span>
              <span lang="zh-Latn-pinyin" className="sentence-pinyin">
                {pinyin}
              </span>
              <Attribution s={s} />
            </div>
            <button type="button" ref={nextBtn} className="btn btn-big" onClick={() => onDone(checked === true)}>
              <span>{last ? t('learn.q.finish') : t('learn.next')}</span>
              <ArrowRightIcon />
            </button>
          </>
        ) : null}
      </div>
      <p className="key-hint">{t('game.susun.keys')}</p>
    </div>
  )
}

function Attribution({ s }: { s: GameSentence }) {
  const t = useT()
  const { settings } = useSettings()
  const tb = s.tatoeba
  const tr = useMemo(() => {
    if (!tb) return null
    return settings.lang === 'id' ? (tb.trId ?? tb.trEn) : (tb.trEn ?? tb.trId)
  }, [tb, settings.lang])
  if (!tb) return null
  return (
    <span className="example-src sentence-src">
      <a href={tatoebaUrl(tb.tatoebaId)} target="_blank" rel="noopener noreferrer">
        Tatoeba #{tb.tatoebaId}
      </a>{' '}
      · {tb.author} · {tb.license}
      {tr ? (
        <>
          {' · '}
          {t('learn.examples.translation')}{' '}
          <a href={tatoebaUrl(tr.tatoebaId)} target="_blank" rel="noopener noreferrer">
            #{tr.tatoebaId}
          </a>{' '}
          · {tr.author}
        </>
      ) : null}
    </span>
  )
}
