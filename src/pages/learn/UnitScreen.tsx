import { useRef } from 'react'
import { useT } from '../../i18n/context'
import type { LessonUnitInfo, UnitData } from '../../lib/lessons'
import { learnHref } from '../../lib/router'
import { useSettings } from '../../lib/settings-context'
import { CasualBox } from './CasualCard'
import { DialogCard } from './DialogCard'
import { useDocumentTitle, useFocusOnChange, useProgress } from './hooks'
import { BackLink, Stars, ToneHanzi, TonePinyin } from './parts'
import { meaningShort } from './text'
import './unit.css'

export function UnitScreen({ info, data }: { info: LessonUnitInfo; data: UnitData }) {
  const t = useT()
  const { settings } = useSettings()
  const lang = settings.lang
  const progress = useProgress()
  const best = progress.units[info.id]
  const h1 = useRef<HTMLHeadingElement>(null)
  useDocumentTitle(`${t('learn.unitNo', { n: info.order })} · ${info.title[lang]}`)
  useFocusOnChange(h1, `unit:${info.id}`)

  return (
    <div className="learn-unit">
      <BackLink href={learnHref({ screen: 'map' })}>{t('learn.backToMap')}</BackLink>
      <header className="page-header unit-header">
        <span className="eyebrow">
          {t('learn.unitNo', { n: info.order })} · {t('learn.wordCount', { n: data.words.length })}
        </span>
        <h1 ref={h1} tabIndex={-1}>
          {info.title[lang]}
        </h1>
        <p className="unit-header-desc">{info.description[lang]}</p>
        {best ? (
          <p className="unit-best">
            {t('learn.unit.best')} <Stars stars={best.stars} />
          </p>
        ) : null}
        <div className="unit-actions">
          <a className="btn" href={learnHref({ screen: 'word', unitId: info.id, index: 1 })}>
            {t('learn.unit.startWords')}
          </a>
          <a className="btn btn-purple" href={learnHref({ screen: 'practice', unitId: info.id })}>
            {t('learn.unit.practice')}
          </a>
        </div>
      </header>

      <section className="card" aria-labelledby="words-title">
        <h2 id="words-title" className="card-title">
          {t('learn.unit.words')}
        </h2>
        <ul className="word-grid">
          {data.words.map((w, i) => (
            <li key={w.id}>
              <a className="word-tile tone-box" href={learnHref({ screen: 'word', unitId: info.id, index: i + 1 })}>
                <ToneHanzi hanzi={w.hanzi} syllables={w.syllables} className="word-tile-hanzi" />
                {settings.showPinyin ? <TonePinyin pinyin={w.pinyin} className="word-tile-pinyin" /> : null}
                <span className="word-tile-meaning">{meaningShort(w, lang)}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <CasualBox items={data.casual} />
      {data.dialog ? <DialogCard dialog={data.dialog} /> : null}
    </div>
  )
}
