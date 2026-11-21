import { ComingSoon, PageHeader } from '../components/ComingSoon'
import { useT } from '../i18n/context'

export function DictionaryPage() {
  const t = useT()
  return (
    <>
      <PageHeader title={t('page.dictionary.title')} />
      <ComingSoon message={t('page.dictionary.soon')} />
    </>
  )
}
