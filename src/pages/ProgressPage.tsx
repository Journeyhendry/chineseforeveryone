import { ComingSoon, PageHeader } from '../components/ComingSoon'
import { useT } from '../i18n/context'

export function ProgressPage() {
  const t = useT()
  return (
    <>
      <PageHeader title={t('page.progress.title')} />
      <ComingSoon message={t('page.progress.soon')} />
    </>
  )
}
