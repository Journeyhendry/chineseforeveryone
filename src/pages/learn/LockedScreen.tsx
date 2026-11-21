import { useRef } from 'react'
import { LockIcon } from '../../components/icons'
import { useT } from '../../i18n/context'
import type { LessonUnitInfo } from '../../lib/lessons'
import { learnHref } from '../../lib/router'
import { useSettings } from '../../lib/settings-context'
import { useDocumentTitle, useFocusOnChange } from './hooks'

export function LockedScreen({ info }: { info: LessonUnitInfo }) {
  const t = useT()
  const { settings } = useSettings()
  const h1 = useRef<HTMLHeadingElement>(null)
  useDocumentTitle(t('learn.locked.title'))
  useFocusOnChange(h1, `locked:${info.id}`)
  return (
    <section className="card locked-card">
      <span className="locked-icon" aria-hidden="true">
        <LockIcon />
      </span>
      <h1 ref={h1} tabIndex={-1} className="card-title">
        {t('learn.locked.title')}
      </h1>
      <p>
        {t('learn.locked.body', { n: info.order, title: info.title[settings.lang], prev: info.order - 1 })}
      </p>
      <div className="row-actions">
        <a className="btn btn-purple" href={learnHref({ screen: 'skip', unitId: info.id })}>
          {t('learn.map.skip')}
        </a>
        <a className="btn btn-white" href={learnHref({ screen: 'map' })}>
          {t('learn.backToMap')}
        </a>
      </div>
    </section>
  )
}
