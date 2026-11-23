import { useEffect, useMemo, useRef, useState } from 'react'
import { useT } from '../../i18n/context'
import { waitForAudio } from '../../lib/audio'
import type { LessonIndex, LessonUnitInfo, UnitData } from '../../lib/lessons'
import { localDay } from '../../lib/dates'
import { recordAnswers } from '../../lib/leitner'
import { isUnitUnlocked, recordUnitResult, starsFor } from '../../lib/progress'
import { buildUnitQuiz, type Question } from '../../lib/quiz'
import { learnHref } from '../../lib/router'
import { useSettings } from '../../lib/settings-context'
import { updateProgress, useDocumentTitle, useProgress } from './hooks'
import { LoadState } from './parts'
import { QuizRunner, type QuizResult } from './QuizRunner'
import { ResultScreen } from './ResultScreen'
import { closingGame } from '../../games/kinds'

const newSeed = () => Math.floor(Math.random() * 0x7fffffff)

export function PracticeScreen({ index, info, data }: { index: LessonIndex; info: LessonUnitInfo; data: UnitData }) {
  const t = useT()
  const { settings } = useSettings()
  const lang = settings.lang
  const [attempt, setAttempt] = useState(0)
  const [quiz, setQuiz] = useState<{ attempt: number; questions: Question[] } | null>(null)
  const [result, setResult] = useState<{ attempt: number; r: QuizResult } | null>(null)
  const words = useMemo(() => new Map(data.words.map((w) => [w.id, w])), [data])
  const unitName = `${t('learn.unitNo', { n: info.order })} · ${info.title[lang]}`
  const done = result?.attempt === attempt ? result.r : null
  useDocumentTitle(`${done ? t('learn.result.screen') : t('learn.quiz.screen')} · ${unitName}`)

  useEffect(() => {
    let alive = true
    void waitForAudio().then((audio) => {
      if (alive) setQuiz({ attempt, questions: buildUnitQuiz(data.words, { seed: newSeed(), audio }) })
    })
    return () => {
      alive = false
    }
  }, [attempt, data])

  if (done) {
    return <PracticeResult index={index} info={info} result={done} words={words} onRetry={() => setAttempt((a) => a + 1)} />
  }
  if (!quiz || quiz.attempt !== attempt) return <LoadState status="loading" retry={() => {}} />
  return (
    <QuizRunner
      questions={quiz.questions}
      words={words}
      session={`practice:${info.id}:${attempt}`}
      exitHref={learnHref({ screen: 'unit', unitId: info.id })}
      exitLabel={t('learn.exitToUnit')}
      context={`${unitName} · ${t('learn.quiz.screen')}`}
      onFinish={(r) => setResult({ attempt, r })}
    />
  )
}

function PracticeResult({
  index,
  info,
  result,
  words,
  onRetry,
}: {
  index: LessonIndex
  info: LessonUnitInfo
  result: QuizResult
  words: Map<string, UnitData['words'][number]>
  onRetry: () => void
}) {
  const t = useT()
  const { settings } = useSettings()
  const score = result.total ? result.correct / result.total : 0
  const stars = starsFor(score)
  const saved = useRef(false)
  // Progres disimpan saat layar nilai muncul, sekali per sesi: nilai terbaik + jadwal ulang kata.
  useEffect(() => {
    if (saved.current) return
    saved.current = true
    const now = new Date()
    updateProgress((p) => recordAnswers(recordUnitResult(p, info.id, score, now), result.answers, localDay(now), 'practice'))
  }, [info.id, score, result.answers])
  const progress = useProgress()
  const nextUnit = index.units.find((u) => u.order === info.order + 1)
  const nextOpen = nextUnit ? isUnitUnlocked(nextUnit, index.units, progress) : false
  const message = stars === 3 ? t('learn.result.msg3') : stars >= 1 ? t('learn.result.msgPass') : t('learn.result.msg0')

  return (
    <ResultScreen
      title={t('learn.result.title')}
      stars={stars}
      result={result}
      words={words}
      message={message}
      extra={
        <a className="btn btn-yellow" href={learnHref({ screen: 'game', unitId: info.id, game: closingGame(info.order) })}>
          {t('game.short')}
          <span>: {t(`game.${closingGame(info.order)}.name`)}</span>
        </a>
      }
    >
      {nextUnit && nextOpen ? (
        <a className="btn btn-big" href={learnHref({ screen: 'unit', unitId: nextUnit.id })}>
          {t('learn.result.nextUnit')}
          <span className="sr-only">: {nextUnit.title[settings.lang]}</span>
        </a>
      ) : null}
      <button type="button" className="btn btn-purple" onClick={onRetry}>
        {t('learn.result.retry')}
      </button>
      <a className="btn btn-white" href={learnHref({ screen: 'map' })}>
        {t('learn.backToMap')}
      </a>
    </ResultScreen>
  )
}
