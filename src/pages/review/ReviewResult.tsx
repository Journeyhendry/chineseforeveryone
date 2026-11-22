import { useRef } from 'react'
import { useT } from '../../i18n/context'
import { currentStreak, dueWords, todayCount } from '../../lib/leitner'
import type { LessonWord } from '../../lib/lessons'
import type { Progress } from '../../lib/progress'
import { REVIEW_HOME } from '../../lib/router'
import { useSettings } from '../../lib/settings-context'
import { useFocusOnChange, useProgress, type WordBank } from '../learn/hooks'
import type { QuizResult } from '../learn/QuizRunner'
import { meaningShort } from '../learn/text'
import { FlameIcon } from '../../components/icons'
import { GoalBar } from './GoalCard'

function WordList({ title, empty, ids, words, progress, showBox }: {
  title: string
  empty: string
  ids: string[]
  words: Map<string, LessonWord>
  progress: Progress
  showBox: boolean
}) {
  const t = useT()
  const { settings } = useSettings()
  return (
    <section className="result-wrong" aria-label={title}>
      <h2 className="card-title">{title}</h2>
      {ids.length === 0 ? (
        <p className="muted">{empty}</p>
      ) : (
        <ul className="wrong-list">
          {ids.map((id) => {
            const w = words.get(id)!
            return (
              <li key={id} className="wrong-item">
                <span lang="zh-CN" className="wrong-hanzi">
                  {w.hanzi}
                </span>
                <span lang="zh-Latn-pinyin" className="wrong-pinyin">
                  {w.pinyin}
                </span>
                {showBox ? <span className="badge badge-purple">{t('review.result.boxTo', { box: progress.words?.[id]?.box ?? 1 })}</span> : null}
                <span className="wrong-meaning">{meaningShort(w, settings.lang)}</span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

/** Layar hasil ulangan. Data sudah disimpan oleh ReviewPage sebelum layar ini muncul. */
export function ReviewResult({ finished, words, data, onAgain, starting }: {
  finished: { r: QuizResult; before: Record<string, number>; today: string }
  words: Map<string, LessonWord>
  data: WordBank
  onAgain: () => void
  starting: boolean
}) {
  const t = useT()
  const { settings } = useSettings()
  const progress = useProgress()
  const h1 = useRef<HTMLHeadingElement>(null)
  useFocusOnChange(h1, 'review-result', true)
  const { r, before, today } = finished
  const correctIds = r.answers.filter((a) => a.correct && words.has(a.wordId)).map((a) => a.wordId)
  const up = correctIds.filter((id) => (progress.words?.[id]?.box ?? 0) > (before[id] ?? 0))
  const down = r.answers.filter((a) => !a.correct && words.has(a.wordId)).map((a) => a.wordId)
  const remaining = dueWords(progress, today, data.knownIds).length
  const streak = currentStreak(progress, today)
  const done = todayCount(progress, today)

  return (
    <section className="card result-card" aria-labelledby="review-result-title">
      <h1 id="review-result-title" ref={h1} tabIndex={-1} className="result-title">
        {t('review.result.title')}
      </h1>
      <p className="result-score">{t('learn.result.score', { correct: r.correct, total: r.total })}</p>
      <p className="result-message">
        {remaining > 0 ? t('review.result.moreDue', { n: remaining }) : t('review.result.allDone')}
      </p>
      <p className="streak-chip result-streak">
        <FlameIcon />
        <span>{t('streak.chip', { n: streak })}</span>
      </p>
      <div className="result-goal">
        <GoalBar done={done} goal={settings.dailyGoal} label={t('review.goalTitle')} />
      </div>
      <div className="row-actions result-actions">
        {remaining > 0 ? (
          <button type="button" className="btn btn-big" onClick={onAgain} disabled={starting}>
            {t('review.result.again')}
          </button>
        ) : null}
        <a className="btn btn-white" href={REVIEW_HOME}>
          {t('review.result.back')}
        </a>
      </div>
      <WordList title={t('review.result.upTitle')} empty={t('review.result.upNone')} ids={up} words={words} progress={progress} showBox />
      <WordList title={t('review.result.downTitle')} empty={t('review.result.downNone')} ids={down} words={words} progress={progress} showBox={false} />
    </section>
  )
}
