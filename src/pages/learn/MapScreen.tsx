import { useRef } from 'react'
import { ArrowRightIcon, CheckIcon, FlameIcon, LockIcon } from '../../components/icons'
import { useT } from '../../i18n/context'
import { currentStreak, dueWords, trackedCount } from '../../lib/leitner'
import type { LessonIndex } from '../../lib/lessons'
import { doneCount, suggestedUnit, unitStatus } from '../../lib/progress'
import { hrefFor, learnHref } from '../../lib/router'
import { useSettings } from '../../lib/settings-context'
import { useDocumentTitle, useFocusOnChange, useProgress, useToday, useWordBank } from './hooks'
import { BasicsMapCard } from './basics/MapCard'
import { Badge, Stars } from './parts'
import '../review/review.css'
import './map.css'

export function MapScreen({ index }: { index: LessonIndex }) {
  const t = useT()
  const { settings } = useSettings()
  const lang = settings.lang
  const progress = useProgress()
  const units = index.units
  const next = suggestedUnit(units, progress)
  const done = doneCount(units, progress)
  const bank = useWordBank()
  const today = useToday()
  const streak = currentStreak(progress, today)
  // Kartu ulangan hanya tampil bila ada kata tercatat (di antara kata yang masih ada di data).
  const known = bank.status === 'ready' ? bank.data.knownIds : null
  const hasTracked = known ? trackedCount(progress, known) > 0 : false
  const dueCount = known ? dueWords(progress, today, known).length : 0
  const h1 = useRef<HTMLHeadingElement>(null)
  useDocumentTitle(t('page.learn.title'))
  useFocusOnChange(h1, 'map')

  return (
    <div className="learn-map">
      <header className="page-header map-header">
        <div>
          <span className="eyebrow">{t('page.learn.eyebrow')}</span>
          <h1 ref={h1} tabIndex={-1}>
            {t('learn.map.title')}
          </h1>
        </div>
        <p className="streak-chip">
          <FlameIcon />
          <span>{streak > 0 ? t('streak.chip', { n: streak }) : t('streak.chipZero')}</span>
        </p>
        <div className="map-summary">
          <span className="map-summary-text">{t('learn.map.done', { done, total: units.length })}</span>
          <div
            className="progress"
            role="progressbar"
            aria-label={t('learn.map.doneLabel')}
            aria-valuemin={0}
            aria-valuemax={units.length}
            aria-valuenow={done}
          >
            <div className="progress-fill progress-green" style={{ width: `${(100 * done) / units.length}%` }} />
          </div>
        </div>
      </header>

      <div className="map-layout">
        <div className="map-main">
        <BasicsMapCard />
        <section className="card unit-path-card" aria-labelledby="path-title">
          <h2 id="path-title" className="sr-only">
            {t('learn.map.pathLabel')}
          </h2>
          <ol className="unit-path">
            {units.map((u) => {
              const status = unitStatus(u, units, progress)
              const isNext = next?.id === u.id
              const stars = progress.units[u.id]?.stars ?? 0
              const href = learnHref({ screen: 'unit', unitId: u.id })
              return (
                <li key={u.id} className={`unit-node is-${status}${isNext ? ' is-next' : ''}`}>
                  <span className="unit-badge" aria-hidden="true">
                    {status === 'locked' ? <LockIcon /> : status === 'done' ? <CheckIcon /> : u.order}
                  </span>
                  <div className="unit-body">
                    <span className="unit-no">
                      {t('learn.unitNo', { n: u.order })}
                      {isNext ? <Badge tone="purple">{t('learn.map.next')}</Badge> : null}
                    </span>
                    <h3 className="unit-title">
                      {status === 'locked' ? (
                        <span>{u.title[lang]}</span>
                      ) : (
                        <a href={href}>{u.title[lang]}</a>
                      )}
                    </h3>
                    <p className="unit-desc">{u.description[lang]}</p>
                    <p className="unit-meta">
                      <span>{t('learn.wordCount', { n: u.wordCount })}</span>
                      {status !== 'locked' ? <Stars stars={stars} /> : null}
                      <span className={`unit-status status-${status}`}>{t(`learn.status.${status}`)}</span>
                    </p>
                    {isNext ? (
                      <a className="btn" href={href}>
                        {t(stars > 0 || progress.units[u.id] ? 'learn.map.continue' : 'learn.map.start')}
                        <span className="sr-only">: {u.title[lang]}</span>
                      </a>
                    ) : null}
                    {status === 'locked' ? (
                      <a className="btn-skip" href={learnHref({ screen: 'skip', unitId: u.id })}>
                        <ArrowRightIcon />
                        <span>
                          {t('learn.map.skip')}
                          <span className="sr-only">: {t('learn.unitNo', { n: u.order })}</span>
                        </span>
                      </a>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ol>
        </section>
        </div>

        <aside className="map-aside">
          {hasTracked ? (
            <section className="card review-mini" aria-labelledby="review-mini-title">
              <h2 id="review-mini-title" className="card-title">
                {t('learn.map.reviewTitle')}
              </h2>
              <p>{dueCount > 0 ? t('learn.map.reviewDue', { n: dueCount }) : t('learn.map.reviewNone')}</p>
              <a className="btn btn-orange" href={hrefFor('ulang')}>
                {t('learn.map.reviewGo')}
              </a>
            </section>
          ) : null}
          <section className="card card-soft" aria-labelledby="skip-info">
            <h2 id="skip-info" className="card-title">
              {t('learn.map.skipInfoTitle')}
            </h2>
            <p>{t('learn.map.skipInfo')}</p>
          </section>
        </aside>
      </div>
    </div>
  )
}
