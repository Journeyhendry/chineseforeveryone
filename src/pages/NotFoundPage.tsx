import { PageHeader } from '../components/ComingSoon'
import { useT } from '../i18n/context'
import { hrefFor } from '../lib/router'

export function NotFoundPage() {
  const t = useT()
  return (
    <>
      <PageHeader title={t('notfound.title')} />
      <section className="card">
        <p>{t('notfound.body')}</p>
        <a className="btn" href={hrefFor('belajar')}>
          {t('notfound.back')}
        </a>
      </section>
    </>
  )
}
