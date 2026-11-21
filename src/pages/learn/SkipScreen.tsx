import { useEffect, useMemo, useRef, useState } from 'react'
import { useT } from '../../i18n/context'
import { waitForAudio } from '../../lib/audio'
import { loadUnit, type LessonIndex, type LessonUnitInfo, type LessonWord } from '../../lib/lessons'
import { isUnitUnlocked, recordSkipResult, SKIP_PASS } from '../../lib/progress'
import { buildSkipQuiz, SKIP_QUIZ_LENGTH, type Question } from '../../lib/quiz'
import { learnHref } from '../../lib/router'
import { useSettings } from '../../lib/settings-context'
import { updateProgress, useDocumentTitle, useFocusOnChange, useProgress, useResource } from './hooks'
import { BackLink, LoadState } from './parts'
import { QuizRunner, type QuizResult } from './QuizRunner'
import { ResultScreen } from './ResultScreen'

type Phase = { name: 'intro' } | { name: 'quiz'; questions: Question[]; run: number } | { name: 'result'; r: QuizResult }

export function SkipScreen({ index, info }: { index: LessonIndex; info: LessonUnitInfo }) {
  const t = useT()
  const { settings } = useSettings()
  const lang = settings.lang
  const progress = useProgress()
  const [phase, setPhase] = useState<Phase>({ name: 'intro' })
  const [run, setRun] = useState(0)
  const before = useMemo(() => index.units.filter((u) => u.order < info.order), [index, info.order])
  const key = before.map((u) => u.id).join(',')
  const units = useResource(`skip:${key}`, () => Promise.all(before.map((u) => loadUnit(u.id))))
  const unitsData = units.status === 'ready' ? units.data : null
  const words = useMemo(
    () => new Map<string, LessonWord>((unitsData ?? []).flatMap((d) => d.words.map((w) => [w.id, w] as const))),
    [unitsData],
  )
  const h1 = useRef<HTMLHeadingElement>(null)
  const title = t('learn.skip.title', { n: info.order })
  useDocumentTitle(phase.name === 'result' ? `${t('learn.result.screen')} · ${title}` : title)
  useFocusOnChange(h1, phase.name === 'intro' ? `skip:${info.id}:${run}` : null)

  // Hasil: lolos -> buka sampai unit ini (sekali per hasil).
  const savedFor = useRef<QuizResult | null>(null)
  useEffect(() => {
    if (phase.name !== 'result' || savedFor.current === phase.r) return
    savedFor.current = phase.r
    updateProgress((p) => recordSkipResult(p, info.order, phase.r.correct / phase.r.total))
  }, [phase, info.order])

  const alreadyOpen = isUnitUnlocked(info, index.units, progress)
  const unitHref = learnHref({ screen: 'unit', unitId: info.id })

  if (phase.name === 'quiz') {
    return (
      <QuizRunner
        questions={phase.questions}
        words={words}
        session={`skip:${info.id}:${phase.run}`}
        exitHref={learnHref({ screen: 'map' })}
        exitLabel={t('learn.exitToMap')}
        context={title}
        onFinish={(r) => setPhase({ name: 'result', r })}
      />
    )
  }

  if (phase.name === 'result') {
    const score = phase.r.total ? phase.r.correct / phase.r.total : 0
    const pass = score >= SKIP_PASS
    return (
      <ResultScreen
        title={pass ? t('learn.skip.passTitle') : t('learn.skip.failTitle')}
        stars={null}
        result={phase.r}
        words={words}
        message={pass ? t('learn.skip.pass', { n: info.order }) : t('learn.skip.fail')}
      >
        {pass ? (
          <a className="btn btn-big" href={unitHref}>
            {t('learn.skip.toUnit', { n: info.order })}
          </a>
        ) : (
          <button
            type="button"
            className="btn btn-purple"
            onClick={() => {
              setRun((r) => r + 1)
              setPhase({ name: 'intro' })
            }}
          >
            {t('learn.skip.retry')}
          </button>
        )}
        <a className="btn btn-white" href={learnHref({ screen: 'map' })}>
          {t('learn.backToMap')}
        </a>
      </ResultScreen>
    )
  }

  const start = async () => {
    if (!unitsData) return
    const audio = await waitForAudio()
    const groups = unitsData.map((d) => d.words)
    setPhase({ name: 'quiz', run, questions: buildSkipQuiz(groups, { seed: Math.floor(Math.random() * 0x7fffffff), audio }) })
  }

  return (
    <div className="learn-skip">
      <BackLink href={learnHref({ screen: 'map' })}>{t('learn.backToMap')}</BackLink>
      <section className="card skip-card">
        <span className="eyebrow">{t('learn.map.skip')}</span>
        <h1 ref={h1} tabIndex={-1} className="card-title">
          {title}
        </h1>
        <p className="skip-unit">{info.title[lang]}</p>
        {alreadyOpen ? (
          <>
            <p>{t('learn.skip.alreadyOpen')}</p>
            <div className="row-actions">
              <a className="btn" href={unitHref}>
                {t('learn.skip.toUnit', { n: info.order })}
              </a>
            </div>
          </>
        ) : (
          <>
            <p>
              {t('learn.skip.intro', {
                count: SKIP_QUIZ_LENGTH,
                from: 1,
                to: info.order - 1,
                pct: Math.round(SKIP_PASS * 100),
                n: info.order,
              })}
            </p>
            <p className="muted">{t('learn.skip.note')}</p>
            {units.status === 'ready' ? (
              <div className="row-actions">
                <button type="button" className="btn btn-big" onClick={() => void start()}>
                  {t('learn.skip.start')}
                </button>
              </div>
            ) : (
              <LoadState status={units.status} retry={units.retry} />
            )}
          </>
        )}
      </section>
    </div>
  )
}
