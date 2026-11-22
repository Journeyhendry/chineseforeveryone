import { useEffect, useRef, useState } from 'react'
import { ArrowRightIcon, CheckIcon, CloseIcon, SpeakerIcon } from '../../../components/icons'
import { useT } from '../../../i18n/context'
import type { BChoice, BQuestion } from '../../../lib/basics-quiz'
import type { Bilingual } from '../../../lib/lesson-types'
import { useSettings } from '../../../lib/settings-context'
import { isInteractiveTarget, useFocusOnChange, useHotkeys } from '../hooks'
import { LessonBar, TonePinyin } from '../parts'
import { SyllableRow } from './SandhiPart'
import { useBasicsAudio } from './audio'
import { StrokeShape } from './common'
import '../quiz.css'

export interface BasicsQuizResult {
  correct: number
  total: number
  wrong: BQuestion[]
}

/** Menjalankan soal Tahap 0 dengan gaya & tombol yang sama dengan latihan unit. */
export function BasicsQuizRunner(props: {
  questions: BQuestion[]
  session: string
  exitHref: string
  exitLabel: string
  context: string
  onFinish: (r: BasicsQuizResult) => void
}) {
  const t = useT()
  const [i, setI] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [correct, setCorrect] = useState(0)
  const [wrong, setWrong] = useState<BQuestion[]>([])
  const total = props.questions.length
  const q = props.questions[i]

  const choose = (c: number) => {
    if (picked !== null || c < 0 || c >= q.choices.length) return
    setPicked(c)
    if (c === q.answer) setCorrect((n) => n + 1)
    else setWrong((w) => [...w, q])
  }
  const next = () => {
    if (picked === null) return
    if (i + 1 >= total) {
      props.onFinish({ correct, total, wrong })
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
      <BQuestionView
        key={`${props.session}:${i}`}
        focusKey={`${props.session}:${i}`}
        forceFocus={i > 0}
        q={q}
        picked={picked}
        last={i + 1 >= total}
        onChoose={choose}
        onNext={next}
      />
    </div>
  )
}

const TITLES = {
  'listen-pinyin': 'basics.q.listenPinyin',
  'read-pinyin': 'basics.q.readPinyin',
  'listen-tone': 'learn.q.tone',
  'read-tone': 'basics.q.readTone',
  sandhi: 'basics.q.sandhi',
  'stroke-name': 'basics.q.strokeName',
  'stroke-first': 'basics.q.strokeFirst',
  'radical-in': 'basics.q.radicalIn',
  'radical-meaning': 'basics.q.radicalMeaning',
  'listen-meaning': 'basics.q.listenMeaning',
  'hanzi-meaning': 'learn.q.hanziMeaning',
} as const

function BQuestionView(props: {
  q: BQuestion
  picked: number | null
  focusKey: string
  forceFocus: boolean
  last: boolean
  onChoose: (i: number) => void
  onNext: () => void
}) {
  const { q, picked } = props
  const t = useT()
  const { settings } = useSettings()
  const lang = settings.lang
  const { play } = useBasicsAudio()
  const h1 = useRef<HTMLHeadingElement>(null)
  const nextBtn = useRef<HTMLButtonElement>(null)
  const answered = picked !== null
  const right = answered && picked === q.answer
  const listen = q.kind === 'listen-pinyin' || q.kind === 'listen-tone' || q.kind === 'listen-meaning'
  const audio = q.audio
  useFocusOnChange(h1, props.focusKey, props.forceFocus)

  useEffect(() => {
    if (listen && audio) play(audio)
  }, [listen, audio, play])

  useEffect(() => {
    if (!answered) return
    nextBtn.current?.focus()
    if (!right && audio) play(audio)
  }, [answered, right, audio, play])

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
      if (audio) play(audio)
    }
  })

  const kindLabel = t(`basics.q.kind.${q.kind}`)
  const correctText = choiceText(q.choices[q.answer], lang, t)

  return (
    <div className="question">
      <div className="question-head">
        <span className="badge badge-purple">{kindLabel}</span>
        <h1 ref={h1} tabIndex={-1} className="question-title">
          {t(TITLES[q.kind])}
        </h1>
      </div>

      <div className="prompt card tone-box">
        {audio ? (
          <button type="button" className="prompt-audio" aria-label={t('learn.q.playAgain')} onClick={() => play(audio)}>
            <SpeakerIcon />
          </button>
        ) : null}
        <div className="prompt-body">
          <PromptBody q={q} lang={lang} showPinyin={settings.showPinyin} />
        </div>
        {right ? (
          <span className="stamp" aria-hidden="true" lang="zh-CN">
            对!
          </span>
        ) : null}
      </div>

      <div className={`choices${q.choices[0].type === 'tone' ? ' choices-tone' : ''}`} role="group" aria-label={t('learn.q.choices')}>
        {q.choices.map((c, ci) => {
          const isPicked = picked === ci
          const state = !answered ? '' : ci === q.answer ? ' is-correct' : isPicked ? ' is-wrong' : ' is-dim'
          return (
            <button
              key={c.key}
              type="button"
              className={`choice-btn${state}`}
              aria-pressed={isPicked}
              aria-disabled={answered || undefined}
              onClick={() => props.onChoose(ci)}
            >
              <span className="choice-key" aria-hidden="true">
                {ci + 1}
              </span>
              <ChoiceBody c={c} lang={lang} />
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
                <Reveal q={q} lang={lang} />
              </span>
            </div>
            <button type="button" ref={nextBtn} className="btn btn-big" onClick={props.onNext}>
              <span>{props.last ? t('learn.q.finish') : t('learn.next')}</span>
              <ArrowRightIcon />
            </button>
          </>
        ) : null}
      </div>
      <p className="key-hint">{t(audio ? 'learn.q.keys' : 'basics.q.keysNoAudio')}</p>
    </div>
  )
}

export function Reveal({ q, lang }: { q: BQuestion; lang: 'id' | 'en' }) {
  const r = q.reveal
  return (
    <>
      {r.hanzi ? (
        <span lang="zh-CN" className="hanzi-inline">
          {r.hanzi}
        </span>
      ) : null}
      {r.pinyin ? (
        <>
          {' '}
          = <span lang="zh-Latn-pinyin">{r.pinyin}</span>
        </>
      ) : null}
      {r.meaning ? <> · {r.meaning[lang]}</> : null}
    </>
  )
}

function PromptBody({ q, lang, showPinyin }: { q: BQuestion; lang: 'id' | 'en'; showPinyin: boolean }) {
  const t = useT()
  const p = q.prompt
  switch (q.kind) {
    case 'listen-pinyin':
    case 'listen-meaning':
      return <span className="prompt-hint">{t('learn.q.listenHint')}</span>
    case 'listen-tone':
      return (
        <>
          <span className="prompt-hint">{t('learn.q.listenHint')}</span>
          {p.meaning ? <span className="prompt-pinyin plain">{bil(p.meaning, lang)}</span> : null}
        </>
      )
    case 'stroke-name':
      return (
        <span className="prompt-stroke">
          <StrokeShape char={p.stroke!.char} index={p.stroke!.index} label={t('basics.q.strokeShapeLabel', { char: p.stroke!.char })} />
        </span>
      )
    case 'radical-meaning':
      return (
        <span className="prompt-hanzi" lang="zh-CN">
          {p.radical}
        </span>
      )
    case 'sandhi':
      return (
        <>
          <span className="prompt-hanzi" lang="zh-CN">
            {p.hanzi}
          </span>
          <span className="prompt-pinyin plain">
            {t('basics.sandhi.written')}: <SyllableRow syllables={p.base!} />
          </span>
          {p.meaning ? <span className="prompt-pinyin plain">{bil(p.meaning, lang)}</span> : null}
        </>
      )
    default:
      return (
        <>
          <span className="prompt-hanzi" lang="zh-CN">
            {p.hanzi}
          </span>
          {p.pinyin && showPinyin && q.kind !== 'read-pinyin' ? (
            q.kind === 'read-tone' ? (
              <span className="prompt-pinyin plain">
                <b lang="zh-Latn-pinyin">{p.pinyin}</b>
              </span>
            ) : (
              <TonePinyin pinyin={p.pinyin} className="prompt-pinyin" />
            )
          ) : null}
          {p.meaning && q.kind !== 'radical-in' ? <span className="prompt-pinyin plain">{bil(p.meaning, lang)}</span> : null}
        </>
      )
  }
}

const bil = (b: Bilingual, lang: 'id' | 'en') => b[lang]

function choiceText(c: BChoice, lang: 'id' | 'en', t: ReturnType<typeof useT>): string {
  switch (c.type) {
    case 'pinyin':
    case 'tone':
      return c.text
    case 'stroke':
      return `${c.hanzi} ${c.pinyin} (${c.meaning[lang]})`
    case 'radical':
      return `${c.radical} (${c.meaning[lang]})`
    case 'meaning':
      return c.meaning[lang] || t('learn.q.choices')
  }
}

const TONE_CURVES: Record<1 | 2 | 3 | 4, string> = {
  1: 'M4 6h32',
  2: 'M4 20 36 4',
  3: 'M4 8q14 22 32-4',
  4: 'M4 4l32 16',
}

function ChoiceBody({ c, lang }: { c: BChoice; lang: 'id' | 'en' }) {
  const t = useT()
  switch (c.type) {
    case 'tone':
      return (
        <span className="choice-body">
          <span className="choice-tone" lang="zh-Latn-pinyin" style={{ color: `var(--tone-${c.tone})` }}>
            {c.text}
          </span>
          <svg className="tone-curve" aria-hidden="true" width="64" height="32" viewBox="0 0 40 24" fill="none" stroke={`var(--tone-${c.tone})`} strokeWidth="3.2" strokeLinecap="round">
            <path d={TONE_CURVES[c.tone]} />
          </svg>
          <span className="choice-label">{t(`tone.${c.tone}`)}</span>
        </span>
      )
    case 'pinyin':
      return (
        <span className="choice-body">
          <TonePinyin pinyin={c.text} className="choice-pinyin-big" />
        </span>
      )
    case 'stroke':
      return (
        <span className="choice-body">
          <span className="choice-hanzi" lang="zh-CN">
            {c.hanzi}
          </span>
          <span className="choice-pinyin" lang="zh-Latn-pinyin">
            {c.pinyin} · {c.meaning[lang]}
          </span>
        </span>
      )
    case 'radical':
      return (
        <span className="choice-body">
          <span className="choice-hanzi" lang="zh-CN">
            {c.radical}
          </span>
          <span className="choice-pinyin">{c.meaning[lang]}</span>
        </span>
      )
    case 'meaning':
      return <span className="choice-body choice-text">{c.meaning[lang]}</span>
  }
}
