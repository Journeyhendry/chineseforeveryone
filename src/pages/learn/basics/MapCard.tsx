import { CheckIcon } from '../../../components/icons'
import { useT } from '../../../i18n/context'
import { BASICS_PARTS } from '../../../lib/basics'
import { basicsDoneCount } from '../../../lib/progress'
import { learnHref } from '../../../lib/router'
import { useProgress } from '../hooks'
import { Stars } from '../parts'
import './map-card.css'

const partNo = (i: number) => i + 1

/** Kartu Tahap 0 di peta belajar (di atas unit 1). */
export function BasicsMapCard() {
  const t = useT()
  const progress = useProgress()
  const done = basicsDoneCount(progress)
  const first = BASICS_PARTS.find((p) => (progress.basics?.[p]?.stars ?? 0) < 1)
  return (
    <section className="card basics-map-card" aria-labelledby="basics-map-title">
      <div className="basics-map-head">
        <span className="unit-badge basics-map-badge" aria-hidden="true">
          {done === BASICS_PARTS.length ? <CheckIcon /> : '0'}
        </span>
        <div className="unit-body">
          <span className="unit-no">{t('basics.eyebrow')}</span>
          <h2 id="basics-map-title" className="unit-title">
            <a href={learnHref({ screen: 'basics' })}>{t('basics.home.title')}</a>
          </h2>
          <p className="unit-desc">{t('basics.map.desc')}</p>
          <p className="unit-meta">
            <span>{t('basics.map.done', { done, total: BASICS_PARTS.length })}</span>
            <span className={`unit-status status-${done === BASICS_PARTS.length ? 'done' : 'open'}`}>
              {t(done === BASICS_PARTS.length ? 'learn.status.done' : 'learn.status.open')}
            </span>
          </p>
        </div>
      </div>
      <ol className="basics-map-parts">
        {BASICS_PARTS.map((part) => {
          const best = progress.basics?.[part]
          const isDone = (best?.stars ?? 0) >= 1
          return (
            <li key={part}>
              <a className={`basics-chip${isDone ? ' is-done' : ''}`} href={learnHref({ screen: 'basics-part', part })}>
                <span className="basics-chip-no" aria-hidden="true">
                  {isDone ? <CheckIcon /> : partNo(BASICS_PARTS.indexOf(part))}
                </span>
                <span className="basics-chip-text">
                  <span>{t(`basics.part.${part}.short`)}</span>
                  {isDone ? <span className="sr-only"> ({t('learn.status.done')})</span> : null}
                </span>
                {best ? <Stars stars={best.stars} className="basics-chip-stars" /> : null}
              </a>
            </li>
          )
        })}
      </ol>
      {first ? (
        <a className="btn btn-white basics-map-go" href={learnHref({ screen: 'basics-part', part: first })}>
          {t(done > 0 ? 'learn.map.continue' : 'basics.map.start')}
          <span className="sr-only">: {t(`basics.part.${first}.title`)}</span>
        </a>
      ) : null}
    </section>
  )
}
