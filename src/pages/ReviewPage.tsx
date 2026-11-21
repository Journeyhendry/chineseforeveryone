import { ComingSoon, PageHeader } from '../components/ComingSoon'
import { useT } from '../i18n/context'

export function ReviewPage() {
  const t = useT()
  return (
    <>
      <PageHeader title={t('page.review.title')} />
      <ComingSoon message={t('page.review.soon')} />
    </>
  )
}
