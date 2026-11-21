import type { ReactNode } from 'react'
import { useT } from '../i18n/context'

export function ComingSoon({ message }: { message: string }) {
  const t = useT()
  return (
    <section className="card soon" aria-labelledby="soon-title">
      <h2 id="soon-title" className="card-title">
        {t('soon.title')}
      </h2>
      <p>{message}</p>
      <p className="muted">{t('soon.body')}</p>
    </section>
  )
}

export function PageHeader({ title, eyebrow }: { title: string; eyebrow?: ReactNode }) {
  return (
    <header className="page-header">
      {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
      <h1>{title}</h1>
    </header>
  )
}
