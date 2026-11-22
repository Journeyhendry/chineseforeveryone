import { useT } from '../../i18n/context'
import { formatDay } from '../../lib/dates'
import { dueWords, nextDueDay, trackedCount } from '../../lib/leitner'
import { learnHref } from '../../lib/router'
import { useSettings } from '../../lib/settings-context'
import { PageHeader } from '../../components/ComingSoon'
import { useProgress, useToday, type WordBank } from '../learn/hooks'
import { GoalCard } from './GoalCard'

export function ReviewHome({ bank, onStart, starting }: { bank: WordBank; onStart: () => void; starting: boolean }) {
  const t = useT()
  const { settings } = useSettings()
  const progress = useProgress()
  const today = useToday()
  const tracked = trackedCount(progress, bank.knownIds)
  const due = dueWords(progress, today, bank.knownIds)
  const next = nextDueDay(progress, bank.knownIds)
  const session = Math.min(due.length, settings.dailyGoal)

  return (
    <>
      <PageHeader title={t('review.title')} eyebrow={t('page.review.title')} />
      <div className="review-layout">
        <section className="card review-card" aria-labelledby="review-today">
          <h2 id="review-today" className="card-title">
            {t('review.todayTitle')}
          </h2>
          {tracked === 0 ? (
            <>
              <p>
                <strong>{t('review.empty.title')}</strong>
              </p>
              <p>{t('review.empty.body')}</p>
              <div className="row-actions">
                <a className="btn btn-big" href={learnHref({ screen: 'map' })}>
                  {t('review.empty.link')}
                </a>
              </div>
            </>
          ) : due.length === 0 ? (
            <>
              <p>
                <strong>{t('review.allDone')}</strong>
              </p>
              {next ? <p>{t('review.nextDue', { date: formatDay(next, settings.lang) })}</p> : null}
            </>
          ) : (
            <>
              <p className="review-due">{t('review.dueCount', { n: due.length })}</p>
              <p className="muted">{t('review.sessionInfo', { n: settings.dailyGoal })}</p>
              <div className="row-actions">
                <button type="button" className="btn btn-orange btn-big" onClick={onStart} disabled={starting || session === 0}>
                  {t('review.start')}
                </button>
              </div>
            </>
          )}
        </section>
        <GoalCard today={today} />
      </div>
    </>
  )
}
