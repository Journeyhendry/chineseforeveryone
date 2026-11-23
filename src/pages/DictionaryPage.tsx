import { useT } from '../i18n/context'
import { dictionaryHref, hrefFor, parseDictionaryRoute, useRoute, type DictionaryRoute } from '../lib/router'
import { PageHeader } from '../components/ComingSoon'
import { useDocumentTitle, useWordBank } from './learn/hooks'
import { BackLink } from './learn/parts'
import { useDictionaryData } from './dictionary/data'
import { SearchScreen } from './dictionary/SearchScreen'
import { WordDetail } from './dictionary/WordDetail'
import './dictionary/dictionary.css'
import type { WordBank } from './learn/hooks'

/** Halaman Kamus: pencarian (#/kamus?q=...) dan detail kata (#/kamus/<id>). */
export function DictionaryPage() {
  const t = useT()
  const route = useRoute()
  const dict = parseDictionaryRoute(route.segments, route.params)
  const bank = useWordBank()
  if (bank.status !== 'ready') return <DictLoading status={bank.status} retry={bank.retry} title={t('page.dictionary.title')} />
  if (dict.screen === 'notfound') return <DictNotFound q="" />
  return <Ready bank={bank.data} dict={dict} />
}

function Ready({ bank, dict }: { bank: WordBank; dict: Exclude<DictionaryRoute, { screen: 'notfound' }> }) {
  const data = useDictionaryData(bank)
  if (dict.screen === 'search') return <SearchScreen bank={bank} data={data} initialQ={dict.q} />
  const word = data.byId.get(dict.wordId)
  if (!word) return <DictNotFound q={dict.q} />
  const unit = bank.index.units.find((u) => u.id === word.unitId)
  return <WordDetail key={word.id} word={word} unit={unit} q={dict.q} />
}

function DictLoading({ status, retry, title }: { status: 'loading' | 'error'; retry: () => void; title: string }) {
  const t = useT()
  useDocumentTitle(title)
  return (
    <>
      <PageHeader title={title} />
      {status === 'loading' ? (
        <p className="card load-state" role="status">
          {t('dict.loading')}
        </p>
      ) : (
        <div className="card load-state" role="alert">
          <p>{t('dict.loadError')}</p>
          <button type="button" className="btn" onClick={retry}>
            {t('dict.retry')}
          </button>
        </div>
      )}
    </>
  )
}

function DictNotFound({ q }: { q: string }) {
  const t = useT()
  useDocumentTitle(t('dict.notfound.title'))
  return (
    <>
      <PageHeader title={t('dict.notfound.title')} />
      <section className="card">
        <p>{t('dict.notfound.body')}</p>
        <BackLink href={q ? dictionaryHref({ screen: 'search', q }) : hrefFor('kamus')}>{t('dict.back.dictionary')}</BackLink>
      </section>
    </>
  )
}
