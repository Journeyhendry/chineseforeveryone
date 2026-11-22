import { useEffect, useRef, useState } from 'react'
import { ArrowRightIcon, CheckIcon, CloseIcon, SpeakerIcon } from '../../components/icons'
import { useT } from '../../i18n/context'
import type { LessonWord } from '../../lib/lessons'
import { stripTones } from '../../lib/pinyin'
import type { Choice, Question } from '../../lib/quiz'
import { useSettings } from '../../lib/settings-context'
import { isInteractiveTarget, useAudio, useFocusOnChange, useHotkeys } from './hooks'
import { LessonBar, ToneHanzi, TonePinyin } from './parts'
import { meaningShort } from './text'
import './quiz.css'

export interface QuizResult {
  correct: number
  total: number
  /** Kata yang dijawab salah (unik, urut kemunculan). */
  wrong: string[]
  /** Jawaban per soal, urut soal (untuk jadwal ulang). */
  answers: { wordId: string; correct: boolean }[]
}

interface Props {
  questions: Question[]
  words: Map<string, LessonWord>
  /** Kunci unik sesi (untuk fokus). */
  session: string
  exitHref: string
  exitLabel: string
  context: string
  onFinish: (r: QuizResult) => void
}

/** Menjalankan serangkaian soal (dipakai latihan unit, tes loncat, dan ulangan harian). */
export function QuizRunner(props: Props) {
  const t = useT()
  const [i, setI] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [correct, setCorrect] = useState(0)
  const [wrong, setWrong] = useState<string[]>([])
  const [answers, setAnswers] = useState<QuizResult['answers']>([])
  const total = props.questions.length
  const q = props.questions[i]

  const choose = (c: number) => {
    if (picked !== null || c < 0 || c >= q.choices.length) return
    setPicked(c)
    setAnswers((a) => [...a, { wordId: q.wordId, correct: c === q.answer }])
    if (c === q.answer) setCorrect((n) => n + 1)
    else setWrong((w) => (w.includes(q.wordId) ? w : [...w, q.wordId]))
  }
  const next = () => {
    if (picked === null) return
    if (i + 1 >= total) {
      props.onFinish({ correct, total, wrong, answers })
      return
    }
    setI(i + 1)
    setPicked(null)
  }

  return (
    <div className="learn-quiz">
      <LessonBar
        exitHref={props.exitHref}
        exitLabel={props.exitLabel}
        context={props.context}
        count={t('learn.quiz.count', { n: i + 1, total })}
        value={i + (picked === null ? 0 : 1)}
        max={total}
        barLabel={t('learn.quiz.progress')}
      />
      <QuestionView
        key={`${props.session}:${i}`}
        focusKey={`${props.session}:${i}`}
        forceFocus={i > 0}
        q={q}
        words={props.words}
        picked={picked}
        onChoose={choose}
        onNext={next}
        last={i + 1 >= total}
      />
    </div>
  )
}

function QuestionView(props: {
  q: Question
  words: Map<string, LessonWord>
  picked: number | null
  focusKey: string
  forceFocus: boolean
  last: boolean
  onChoose: (i: number) => void
  onNext: () => void
}) {
  const { q, words, picked } = props
  const t = useT()
  const { settings } = useSettings()
  const lang = settings.lang
  const { available, play } = useAudio()
  const word = words.get(q.wordId)!
  const h1 = useRef<HTMLHeadingElement>(null)
  const nextBtn = useRef<HTMLButtonElement>(null)
  const answered = picked !== null
  const right = answered && picked === q.answer
  const listen = q.kind === 'audio-hanzi' || q.kind === 'tone'
  useFocusOnChange(h1, props.focusKey, props.forceFocus)

  // Soal dengar: putar sekali saat soal tampil.
  useEffect(() => {
    if (listen && available) play(word.hanzi)
  }, [listen, available, play, word.hanzi])

  // Setelah menjawab: fokus ke tombol Lanjut; salah -> putar suara jawaban benar.
  useEffect(() => {
    if (!answered) return
    nextBtn.current?.focus()
    if (!right && available) play(word.hanzi)
  }, [answered, right, available, play, word.hanzi])

  useHotkeys((e) => {
    if (/^[1-9]$/.test(e.key)) {
      const n = Number(e.key) - 1
      if (n < q.choices.length) {
        e.preventDefault()
        props.onChoose(n)
      }
    } else if (e.key === 'Enter') {
      if (!answered || isInteractiveTarget(e.target)) return
      e.preventDefault()
      props.onNext()
    } else if (e.key === ' ' || e.code === 'Space') {
      if (isInteractiveTarget(e.target)) return
      e.preventDefault()
      if (available) play(word.hanzi)
    }
  })

  const titleKey = {
    'hanzi-meaning': 'learn.q.hanziMeaning',
    'meaning-hanzi': 'learn.q.meaningHanzi',
    'audio-hanzi': 'learn.q.audioHanzi',
    tone: 'learn.q.tone',
  } as const

  const correctText = choiceText(q.choices[q.answer], q, words, lang)

  return (
    <div className="question">
      <div className="question-head">
        <span className="badge badge-purple">{t(`learn.q.kind.${q.kind}`)}</span>
        <h1 ref={h1} tabIndex={-1} className="question-title">
          {t(titleKey[q.kind])}
        </h1>
      </div>

      <div className="prompt card tone-box">
        {listen || q.kind === 'hanzi-meaning' ? (
          <button
            type="button"
            className="prompt-audio"
            disabled={!available}
            aria-label={available ? t('learn.q.playAgain') : t('learn.audio.noneShort')}
            onClick={() => play(word.hanzi)}
          >
            <SpeakerIcon />
          </button>
        ) : null}
        <div className="prompt-body">
          {q.kind === 'hanzi-meaning' ? (
            <>
              <ToneHanzi hanzi={word.hanzi} syllables={word.syllables} className="prompt-hanzi" />
              {settings.showPinyin ? <TonePinyin pinyin={word.pinyin} className="prompt-pinyin" /> : null}
            </>
          ) : null}
          {q.kind === 'meaning-hanzi' ? <span className="prompt-meaning">{meaningShort(word, lang)}</span> : null}
          {q.kind === 'audio-hanzi' ? <span className="prompt-hint">{available ? t('learn.q.listenHint') : t('learn.audio.none')}</span> : null}
          {q.kind === 'tone' ? <TonePrompt q={q} word={word} lang={lang} /> : null}
        </div>
        {right ? (
          <span className="stamp" aria-hidden="true" lang="zh-CN">
            对!
          </span>
        ) : null}
      </div>

      <div className={`choices${q.kind === 'tone' ? ' choices-tone' : ''}`} role="group" aria-label={t('learn.q.choices')}>
        {q.choices.map((c, ci) => {
          const isPicked = picked === ci
          const state = !answered ? '' : ci === q.answer ? ' is-correct' : isPicked ? ' is-wrong' : ' is-dim'
          return (
            <button
              key={ci}
              type="button"
              className={`choice-btn${state}`}
              aria-pressed={isPicked}
              aria-disabled={answered || undefined}
              onClick={() => props.onChoose(ci)}
            >
              <span className="choice-key" aria-hidden="true">
                {ci + 1}
              </span>
              <ChoiceContent c={c} q={q} words={words} />
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
                {right ? null : <>{t('learn.q.answerWas', { answer: correctText })} </>}
                <span lang="zh-CN" className="hanzi-inline">
                  {word.hanzi}
                </span>{' '}
                = <span lang="zh-Latn-pinyin">{word.pinyin}</span> · {meaningShort(word, lang)}
              </span>
            </div>
            <button type="button" ref={nextBtn} className="btn btn-big" onClick={props.onNext}>
              <span>{props.last ? t('learn.q.finish') : t('learn.next')}</span>
              <ArrowRightIcon />
            </button>
          </>
        ) : null}
      </div>
      <p className="key-hint">{t('learn.q.keys')}</p>
    </div>
  )
}

function TonePrompt({ q, word, lang }: { q: Question; word: LessonWord; lang: 'id' | 'en' }) {
  const t = useT()
  const { settings } = useSettings()
  const showPinyin = settings.showPinyin
  const chars = [...word.hanzi]
  const s = q.syllable ?? 0
  const aligned = chars.length === word.syllables.length
  return (
    <>
      <span className="prompt-hanzi" lang="zh-CN">
        {chars.map((ch, i) => (
          <span key={i} className={aligned && i === s ? 'is-target' : undefined}>
            {ch}
          </span>
        ))}
      </span>
      <span className="prompt-pinyin plain">
        {word.syllables.length > 1 && (showPinyin || !aligned) ? <>{t('learn.q.syllable', { n: s + 1 })} </> : null}
        {showPinyin ? (
          <>
            <b lang="zh-Latn-pinyin">{stripTones(word.syllables[s]).toLowerCase()}</b> ·{' '}
          </>
        ) : null}
        {meaningShort(word, lang)}
      </span>
    </>
  )
}

function choiceText(c: Choice, q: Question, words: Map<string, LessonWord>, lang: 'id' | 'en'): string {
  if (c.type === 'tone') return c.text
  const w = words.get(c.wordId)!
  return q.kind === 'hanzi-meaning' ? meaningShort(w, lang) : w.hanzi
}

function ChoiceContent({ c, q, words }: { c: Choice; q: Question; words: Map<string, LessonWord> }) {
  const t = useT()
  const { settings } = useSettings()
  if (c.type === 'tone') {
    return (
      <span className="choice-body">
        <span className="choice-tone" lang="zh-Latn-pinyin" style={{ color: `var(--tone-${c.tone})` }}>
          {c.text}
        </span>
        <ToneCurve tone={c.tone} />
        <span className="choice-label">{t(`tone.${c.tone}`)}</span>
      </span>
    )
  }
  const w = words.get(c.wordId)!
  if (q.kind === 'hanzi-meaning') {
    return <span className="choice-body choice-text">{meaningShort(w, settings.lang)}</span>
  }
  return (
    <span className="choice-body">
      <span className="choice-hanzi" lang="zh-CN">
        {w.hanzi}
      </span>
      {q.kind === 'meaning-hanzi' && settings.showPinyin ? (
        <span className="choice-pinyin" lang="zh-Latn-pinyin">
          {w.pinyin}
        </span>
      ) : null}
    </span>
  )
}

const CURVES: Record<1 | 2 | 3 | 4, string> = {
  1: 'M4 6h32',
  2: 'M4 20 36 4',
  3: 'M4 8q14 22 32-4',
  4: 'M4 4l32 16',
}

function ToneCurve({ tone }: { tone: 1 | 2 | 3 | 4 }) {
  return (
    <svg className="tone-curve" aria-hidden="true" width="64" height="32" viewBox="0 0 40 24" fill="none" stroke={`var(--tone-${tone})`} strokeWidth="3.2" strokeLinecap="round">
      <path d={CURVES[tone]} />
    </svg>
  )
}

