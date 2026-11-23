import { useRef } from 'react'
import { ReportButton } from '../../components/ReportButton'
import { useT, type MessageKey } from '../../i18n/context'
import { dictionaryHref, learnHref } from '../../lib/router'
import { useSettings } from '../../lib/settings-context'
import { useDocumentTitle, useFocusOnChange } from '../learn/hooks'
import { AudioButtons, BackLink, MachineTag, ToneHanzi, TonePinyin, ToneLabels } from '../learn/parts'
import { meaningFull } from '../learn/text'
import { ExampleItem } from '../learn/WordScreen'
import type { LessonUnitInfo } from '../../lib/lessons'
import type { DictEntry } from './data'
import dictIds from '../../i18n/id.json'

const MAX_EXAMPLES = 3

export function WordDetail({ word, unit, q }: { word: DictEntry; unit: LessonUnitInfo | undefined; q: string }) {
  const t = useT()
  const { settings } = useSettings()
  const lang = settings.lang
  const other = lang === 'id' ? 'en' : 'id'
  const h1 = useRef<HTMLHeadingElement>(null)
  useDocumentTitle(`${word.hanzi} · ${t('page.dictionary.title')}`)
  useFocusOnChange(h1, `dict:${word.id}`)

  const posLabel = (p: string) => {
    const key = `dict.pos.${p}`
    return key in dictIds ? t(key as MessageKey) : p
  }
  const backHref = dictionaryHref({ screen: 'search', q })
  const unitName = unit ? `${t('learn.unitNo', { n: unit.order })} · ${unit.title[lang]}` : null

  return (
    <div className="dict-detail">
      <BackLink href={backHref}>{q ? t('dict.back.results') : t('dict.back.dictionary')}</BackLink>

      <section className="card dict-main" aria-labelledby="dict-hanzi">
        <div className="word-glyph tone-box">
          <h1 id="dict-hanzi" ref={h1} tabIndex={-1} className="word-hanzi">
            <ToneHanzi hanzi={word.hanzi} syllables={word.syllables} />
          </h1>
          <TonePinyin pinyin={word.pinyin} className="word-pinyin" />
          <ToneLabels syllables={word.syllables} showPinyin />
        </div>
        <div className="word-meaning">
          <p className="word-meaning-main">
            <span>{meaningFull(word, lang)}</span> {lang === 'id' && word.idMachine ? <MachineTag /> : null}
          </p>
          <p className="word-meaning-other">
            <span className="lang-tag">{t(`lang.short.${other}`)}:</span> <span lang={other}>{meaningFull(word, other)}</span>{' '}
            {other === 'id' && word.idMachine ? <MachineTag /> : null}
          </p>
          <AudioButtons text={word.hanzi} label={word.hanzi} />
        </div>
      </section>

      <dl className="dict-facts">
        {word.pos.length > 0 ? (
          <div>
            <dt>{t('dict.detail.pos')}</dt>
            <dd>{word.pos.map(posLabel).join(', ')}</dd>
          </div>
        ) : null}
        {unitName ? (
          <div>
            <dt>{t('dict.detail.unit')}</dt>
            <dd>{unitName}</dd>
          </div>
        ) : null}
      </dl>

      <section className="card examples" aria-labelledby="dict-examples-title">
        <h2 id="dict-examples-title" className="card-title">
          {t('learn.examples.title')}
        </h2>
        {word.examples.length === 0 ? (
          <p className="muted">{t('learn.examples.none')}</p>
        ) : (
          <ul className="example-list">
            {word.examples.slice(0, MAX_EXAMPLES).map((ex) => (
              <ExampleItem key={ex.tatoebaId} ex={ex} />
            ))}
          </ul>
        )}
      </section>

      <div className="dict-actions">
        {unit ? (
          <a className="btn btn-purple" href={learnHref({ screen: 'word', unitId: unit.id, index: word.indexInUnit })}>
            {t('dict.detail.learn', { n: unit.order })}
          </a>
        ) : null}
        <ReportButton word={word} context={t('dict.context')} />
      </div>
      {unit ? <p className="muted dict-learn-hint">{t('dict.detail.learnHint')}</p> : null}
    </div>
  )
}
