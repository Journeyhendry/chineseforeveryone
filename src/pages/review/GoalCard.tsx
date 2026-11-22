import { useId } from 'react'
import { useT } from '../../i18n/context'
import { todayCount } from '../../lib/leitner'
import { DAILY_GOALS, type DailyGoal } from '../../lib/settings'
import { useSettings } from '../../lib/settings-context'
import { useProgress } from '../learn/hooks'

/** Bar target harian (progressbar ber-ARIA) dengan teks "x dari y kata". */
export function GoalBar({ done, goal, label }: { done: number; goal: number; label: string }) {
  const t = useT()
  const shown = Math.min(done, goal)
  const text = t('review.goalCount', { done, goal })
  return (
    <>
      <div className="goal-line">
        <span className="goal-count">{text}</span>
      </div>
      <div
        className="progress"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={goal}
        aria-valuenow={shown}
        aria-valuetext={text}
      >
        <div className="progress-fill progress-green" style={{ width: `${goal ? (100 * shown) / goal : 0}%` }} />
      </div>
    </>
  )
}

/** Kartu "Target harian": progres hari ini + pilihan 10/20/30 (tersimpan di Pengaturan). */
export function GoalCard({ today }: { today: string }) {
  const t = useT()
  const { settings, update } = useSettings()
  const progress = useProgress()
  const done = todayCount(progress, today)
  const hintId = useId()
  return (
    <section className="card goal-card" aria-labelledby="goal-title">
      <h2 id="goal-title" className="card-title">
        {t('review.goalTitle')}
      </h2>
      <GoalBar done={done} goal={settings.dailyGoal} label={t('review.goalTitle')} />
      {done >= settings.dailyGoal ? <p className="goal-reached">{t('review.goalReached')}</p> : null}
      <fieldset className="goal-choices" aria-describedby={hintId}>
        <legend>{t('review.goalLegend')}</legend>
        <div className="choices">
          {DAILY_GOALS.map((g: DailyGoal) => (
            <label key={g} className="choice">
              <input type="radio" name="dailyGoal" checked={settings.dailyGoal === g} onChange={() => update({ dailyGoal: g })} />
              <span>{t('review.goalOption', { n: g })}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <p id={hintId} className="muted goal-hint">
        {t('review.goalHint')}
      </p>
    </section>
  )
}
