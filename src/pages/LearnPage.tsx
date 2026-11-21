import { ComingSoon, PageHeader } from '../components/ComingSoon'
import { useT } from '../i18n/context'

const TONE_SAMPLES = [
  { tone: 1, pinyin: 'mā' },
  { tone: 2, pinyin: 'má' },
  { tone: 3, pinyin: 'mǎ' },
  { tone: 4, pinyin: 'mà' },
  { tone: 5, pinyin: 'ma' },
] as const

export function LearnPage() {
  const t = useT()
  return (
    <>
      <PageHeader title={t('page.learn.title')} eyebrow={t('page.learn.eyebrow')} />
      <ComingSoon message={t('page.learn.soon')} />
      <section className="card" aria-labelledby="tone-title">
        <h2 id="tone-title" className="card-title">
          {t('tone.title')}
        </h2>
        <p className="muted">{t('tone.desc')}</p>
        <ul className="tone-list">
          {TONE_SAMPLES.map(({ tone, pinyin }) => (
            <li key={tone} className="tone-chip" style={{ color: `var(--tone-${tone})` }}>
              <span className="tone-pinyin" lang="zh-Latn-pinyin">
                {pinyin}
              </span>
              <span className="tone-label">{t(`tone.${tone}`)}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
