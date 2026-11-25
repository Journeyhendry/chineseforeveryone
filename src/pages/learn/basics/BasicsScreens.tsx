import { useEffect, useRef, useState, type ReactNode } from 'react'
import { CheckIcon } from '../../../components/icons'
import { useT } from '../../../i18n/context'
import { waitForAudio } from '../../../lib/audio'
import { BASICS_PARTS, loadBasics, nextPart, type AudioItem, type BasicsData, type BasicsPart } from '../../../lib/basics'
import { loadBasicsAudio } from '../../../lib/basics-audio'
import { buildBasicsQuiz, type BQuestion } from '../../../lib/basics-quiz'
import { basicsDoneCount, recordBasicsResult, starsFor } from '../../../lib/progress'
import { learnHref, type LearnRoute } from '../../../lib/router'
import { useSettings } from '../../../lib/settings-context'
import { updateProgress, useDocumentTitle, useFocusOnChange, useProgress, useResource } from '../hooks'
import { BackLink, LoadState, Stars } from '../parts'
import { ResultScreen } from '../ResultScreen'
import { BasicsQuizRunner, type BasicsQuizResult } from './BasicsQuiz'
import { PartNav } from './common'
import { PhrasesPart } from './PhrasesPart'
import { PinyinPart } from './PinyinPart'
import { RadicalsPart } from './RadicalsPart'
import { SandhiPart } from './SandhiPart'
import { StrokesPart } from './StrokesPart'
import { TonesPart } from './TonesPart'
import '../map.css'
import './basics.css'

type BasicsRouteT = Extract<LearnRoute, { screen: 'basics' | 'basics-part' | 'basics-practice' }>

export function BasicsRoute({ route }: { route: BasicsRouteT }) {
  const t = useT()
  const data = useResource('basics', loadBasics)
  if (data.status !== 'ready') return <BasicsLoading status={data.status} retry={data.retry} title={t('basics.home.title')} />
  if (route.screen === 'basics') return <BasicsHome />
  if (route.screen === 'basics-part') return <BasicsPartScreen key={route.part} part={route.part} data={data.data} />
  return <BasicsPractice key={route.part} part={route.part} data={data.data} />
}

function BasicsLoading({ status, retry, title }: { status: 'loading' | 'error'; retry: () => void; title: string }) {
  useDocumentTitle(title)
  return <LoadState status={status} retry={retry} />
}

const partNo = (part: BasicsPart) => BASICS_PARTS.indexOf(part) + 1

/** Daftar 6 bagian (dipakai di beranda Tahap 0). */
function PartList() {
  const t = useT()
  const progress = useProgress()
  const firstOpen = BASICS_PARTS.find((p) => (progress.basics?.[p]?.stars ?? 0) < 1)
  return (
    <ol className="unit-path basics-path">
      {BASICS_PARTS.map((part) => {
        const best = progress.basics?.[part]
        const done = (best?.stars ?? 0) >= 1
        const isNext = part === firstOpen
        return (
          <li key={part} className={`unit-node ${done ? 'is-done' : 'is-open'}${isNext ? ' is-next' : ''}`}>
            <span className="unit-badge" aria-hidden="true">
              {done ? <CheckIcon /> : partNo(part)}
            </span>
            <div className="unit-body">
              <span className="unit-no">{t('basics.partNo', { n: partNo(part) })}</span>
              <h2 className="unit-title">
                <a href={learnHref({ screen: 'basics-part', part })}>{t(`basics.part.${part}.title`)}</a>
              </h2>
              <p className="unit-desc">{t(`basics.part.${part}.desc`)}</p>
              <p className="unit-meta">
                {best ? <Stars stars={best.stars} /> : null}
                <span className={`unit-status status-${done ? 'done' : 'open'}`}>{t(done ? 'learn.status.done' : 'learn.status.open')}</span>
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function BasicsHome() {
  const t = useT()
  const progress = useProgress()
  const done = basicsDoneCount(progress)
  const h1 = useRef<HTMLHeadingElement>(null)
  const first = BASICS_PARTS.find((p) => (progress.basics?.[p]?.stars ?? 0) < 1) ?? BASICS_PARTS[0]
  useDocumentTitle(t('basics.home.title'))
  useFocusOnChange(h1, 'basics-home')
  return (
    <div className="learn-basics">
      <BackLink href={learnHref({ screen: 'map' })}>{t('learn.backToMap')}</BackLink>
      <header className="page-header unit-header">
        <span className="eyebrow">{t('basics.eyebrow')}</span>
        <h1 ref={h1} tabIndex={-1}>
          {t('basics.home.title')}
        </h1>
        <p className="unit-header-desc">{t('basics.home.desc')}</p>
        <p className="unit-best">{t('basics.map.done', { done, total: BASICS_PARTS.length })}</p>
        <div className="unit-actions">
          <a className="btn" href={learnHref({ screen: 'basics-part', part: first })}>
            {t(done > 0 ? 'learn.map.continue' : 'basics.home.start')}
          </a>
          <a className="btn btn-white" href={learnHref({ screen: 'unit', unitId: 'u01' })}>
            {t('basics.home.skipToUnit1')}
          </a>
        </div>
      </header>
      <section className="card" aria-label={t('basics.home.partsLabel')}>
        <PartList />
      </section>
    </div>
  )
}

const PART_VIEWS: Record<BasicsPart, (p: { data: BasicsData }) => ReactNode> = {
  pinyin: PinyinPart,
  nada: TonesPart,
  'perubahan-nada': SandhiPart,
  coretan: StrokesPart,
  radikal: RadicalsPart,
  ungkapan: PhrasesPart,
}

function BasicsPartScreen({ part, data }: { part: BasicsPart; data: BasicsData }) {
  const t = useT()
  const progress = useProgress()
  const best = progress.basics?.[part]
  const h1 = useRef<HTMLHeadingElement>(null)
  const title = t(`basics.part.${part}.title`)
  const i = BASICS_PARTS.indexOf(part)
  const View = PART_VIEWS[part]
  useDocumentTitle(`${title} · ${t('basics.eyebrow')}`)
  useFocusOnChange(h1, `basics:${part}`)
  return (
    <div className="learn-basics">
      <BackLink href={learnHref({ screen: 'basics' })}>{t('basics.backToHome')}</BackLink>
      <header className="page-header unit-header">
        <span className="eyebrow">
          {t('basics.eyebrow')} · {t('basics.partNo', { n: i + 1 })}
        </span>
        <h1 ref={h1} tabIndex={-1}>
          {title}
        </h1>
        <p className="unit-header-desc">{t(`basics.part.${part}.desc`)}</p>
        {best ? (
          <p className="unit-best">
            {t('learn.unit.best')} <Stars stars={best.stars} />
          </p>
        ) : null}
        <div className="unit-actions">
          <a className="btn btn-purple" href={learnHref({ screen: 'basics-practice', part })}>
            {t('basics.practice.start')}
          </a>
        </div>
      </header>
      <View data={data} />
      <section className="card card-soft basics-practice-cta" aria-labelledby="practice-cta">
        <h2 id="practice-cta" className="card-title">
          {t('basics.practice.ctaTitle')}
        </h2>
        <p>{t('basics.practice.ctaBody')}</p>
        <PartNav part={part} prev={BASICS_PARTS[i - 1] ?? null} next={BASICS_PARTS[i + 1] ?? null} />
      </section>
    </div>
  )
}

const newSeed = () => Math.floor(Math.random() * 0x7fffffff)

function BasicsPractice({ part, data }: { part: BasicsPart; data: BasicsData }) {
  const t = useT()
  const [attempt, setAttempt] = useState(0)
  const [quiz, setQuiz] = useState<{ attempt: number; questions: BQuestion[] } | null>(null)
  const [result, setResult] = useState<{ attempt: number; r: BasicsQuizResult } | null>(null)
  const title = t(`basics.part.${part}.title`)
  const done = result?.attempt === attempt ? result.r : null
  useDocumentTitle(`${done ? t('learn.result.screen') : t('learn.quiz.screen')} · ${title}`)

  useEffect(() => {
    let alive = true
    void Promise.all([waitForAudio(), loadBasicsAudio()]).then(([device, files]) => {
      if (!alive) return
      const hasAudio = (it: AudioItem) => files.has(it.audioId) || device
      setQuiz({ attempt, questions: buildBasicsQuiz(part, data, { seed: newSeed(), hasAudio }) })
    })
    return () => {
      alive = false
    }
  }, [attempt, part, data])

  if (done) return <BasicsResult part={part} result={done} onRetry={() => setAttempt((a) => a + 1)} />
  if (!quiz || quiz.attempt !== attempt) return <LoadState status="loading" retry={() => {}} />
  return (
    <BasicsQuizRunner
      questions={quiz.questions}
      session={`basics:${part}:${attempt}`}
      exitHref={learnHref({ screen: 'basics-part', part })}
      exitLabel={t('basics.exitToPart')}
      context={`${t('basics.eyebrow')} · ${title} · ${t('learn.quiz.screen')}`}
      onFinish={(r) => setResult({ attempt, r })}
    />
  )
}

function BasicsResult({ part, result, onRetry }: { part: BasicsPart; result: BasicsQuizResult; onRetry: () => void }) {
  const t = useT()
  const lang = useSettings().settings.lang
  const score = result.total ? result.correct / result.total : 0
  const stars = starsFor(score)
  const saved = useRef(false)
  useEffect(() => {
    if (saved.current) return
    saved.current = true
    updateProgress((p) => recordBasicsResult(p, part, score, new Date()))
  }, [part, score])
  const next = nextPart(part)
  const message = stars === 3 ? t('basics.result.msg3') : stars >= 1 ? t('basics.result.msgPass') : t('basics.result.msg0')
  const wrongItems = result.wrong.map((q, i) => ({
    key: `${i}`,
    hanzi: q.reveal.hanzi ?? '',
    pinyin: q.reveal.pinyin ?? '',
    meaning: q.reveal.meaning?.[lang] ?? '',
  }))
  return (
    <ResultScreen
      title={t('learn.result.title')}
      stars={stars}
      result={{ correct: result.correct, total: result.total, wrong: [] }}
      words={new Map()}
      message={message}
      wrongItems={wrongItems}
      wrongTitle={t('basics.result.wrongTitle')}
    >
      {next ? (
        <a className="btn btn-big" href={learnHref({ screen: 'basics-part', part: next })}>
          {t('basics.result.nextPart')}
          <span className="sr-only">: {t(`basics.part.${next}.title`)}</span>
        </a>
      ) : (
        <a className="btn btn-big" href={learnHref({ screen: 'unit', unitId: 'u01' })}>
          {t('basics.result.toUnit1')}
        </a>
      )}
      <button type="button" className="btn btn-purple" onClick={onRetry}>
        {t('learn.result.retry')}
      </button>
      <a className="btn btn-white" href={learnHref({ screen: 'basics-part', part })}>
        {t('basics.result.backToPart')}
      </a>
      <a className="btn btn-white" href={learnHref({ screen: 'map' })}>
        {t('learn.backToMap')}
      </a>
    </ResultScreen>
  )
}
