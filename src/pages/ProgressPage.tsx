import { PageHeader } from '../components/ComingSoon'
import { useT } from '../i18n/context'
import { BOXES, BOX_DAYS, boxCounts, currentStreak, trackedCount, todayCount } from '../lib/leitner'
import { doneCount } from '../lib/progress'
import { useSettings } from '../lib/settings-context'
import { useProgress, useToday, useWordBank, type WordBank } from './learn/hooks'
import { LoadState } from './learn/parts'
import { BackupPanel } from './progress/BackupPanel'
import './progress/progress.css'

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="stat">
      <dt>{label}</dt>
      <dd>
        <span className="stat-value">{value}</span>
        {note ? <span className="stat-note">{note}</span> : null}
      </dd>
    </div>
  )
}

function Summary({ bank }: { bank: WordBank }) {
  const t = useT()
  const { settings } = useSettings()
  const progress = useProgress()
  const today = useToday()
  const counts = boxCounts(progress, bank.knownIds)
  const mastered = counts[3] + counts[4]
  const tracked = trackedCount(progress, bank.knownIds)
  const max = Math.max(1, ...counts)
  const units = bank.index.units
  return (
    <>
      <section className="card" aria-labelledby="stats-title">
        <h2 id="stats-title" className="sr-only">
          {t('progress.statsLabel')}
        </h2>
        <dl className="stats">
          <Stat label={t('progress.unitsDone')} value={t('progress.of', { n: doneCount(units, progress), total: units.length })} />
          <Stat label={t('progress.mastered')} value={t('progress.of', { n: mastered, total: bank.knownIds.size })} />
          <Stat label={t('progress.learning')} value={String(tracked - mastered)} />
          <Stat
            label={t('progress.streak')}
            value={String(currentStreak(progress, today))}
            note={t('progress.streakValue', { current: currentStreak(progress, today), best: progress.streak?.best ?? 0 })}
          />
          <Stat label={t('progress.today')} value={t('progress.of', { n: todayCount(progress, today), total: settings.dailyGoal })} />
        </dl>
      </section>

      <section className="card" aria-labelledby="boxes-title">
        <h2 id="boxes-title" className="card-title">
          {t('progress.boxes.title')}
        </h2>
        <table className="box-table">
          <caption className="sr-only">{t('progress.boxes.caption')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('progress.boxes.colBox')}</th>
              <th scope="col">{t('progress.boxes.colWhen')}</th>
              <th scope="col">{t('progress.boxes.colCount')}</th>
            </tr>
          </thead>
          <tbody>
            {BOXES.map((b) => (
              <tr key={b}>
                <th scope="row">{t('progress.box.label', { n: b })}</th>
                <td>{BOX_DAYS[b] === 1 ? t('progress.box.next1') : t('progress.box.nextN', { days: BOX_DAYS[b] })}</td>
                <td>
                  <div className="box-count">
                    <span className="box-bar" aria-hidden="true">
                      <span className="box-bar-fill" style={{ width: `${(100 * counts[b - 1]) / max}%` }} />
                    </span>
                    <span className="box-num">{counts[b - 1]}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted box-note">{t('progress.boxes.note')}</p>
      </section>
    </>
  )
}

export function ProgressPage() {
  const t = useT()
  const bank = useWordBank()
  return (
    <>
      <PageHeader title={t('page.progress.title')} />
      <div className="progress-page">
        {bank.status === 'ready' ? <Summary bank={bank.data} /> : <LoadState status={bank.status} retry={bank.retry} />}
        <BackupPanel />
      </div>
    </>
  )
}
