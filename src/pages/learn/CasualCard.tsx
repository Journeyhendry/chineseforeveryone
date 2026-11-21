import { useT } from '../../i18n/context'
import type { CasualItem } from '../../lib/lessons'
import { useSettings } from '../../lib/settings-context'
import { Badge, MachineTag, SpeakButton, ToneHanzi, TonePinyin } from './parts'
import { EVIDENCE_NAMES } from './text'

/** Kotak "Versi santai": daftar ungkapan santai. */
export function CasualBox({ items, headingLevel = 2 }: { items: CasualItem[]; headingLevel?: 2 | 3 }) {
  const t = useT()
  const H = headingLevel === 2 ? 'h2' : 'h3'
  if (items.length === 0) return null
  return (
    <section className="card casual-box" aria-labelledby="casual-title">
      <H id="casual-title" className="card-title">
        {t('learn.casual.title')}
      </H>
      <p className="muted">{t('learn.casual.intro')}</p>
      <ul className="casual-list">
        {items.map((c) => (
          <CasualEntry key={c.id} item={c} />
        ))}
      </ul>
    </section>
  )
}

function CasualEntry({ item }: { item: CasualItem }) {
  const t = useT()
  const { settings } = useSettings()
  const lang = settings.lang
  return (
    <li className="casual-item">
      <div className="casual-head">
        <span className="tone-box casual-word">
          <ToneHanzi hanzi={item.hanzi} syllables={item.syllables} className="casual-hanzi" />
          {settings.showPinyin ? <TonePinyin pinyin={item.pinyin} className="casual-pinyin" /> : null}
        </span>
        <SpeakButton text={item.hanzi} label={item.hanzi} />
        <Badge tone="yellow">{t(`learn.casual.label.${item.label}`)}</Badge>
      </div>
      <p className="casual-meaning">
        <strong>{item.meaning[lang]}</strong> {item.machine ? <MachineTag /> : null}
      </p>
      <p className="casual-hsk">
        {t('learn.casual.hsk')}{' '}
        <span lang="zh-CN" className="hanzi-inline">
          {item.hsk.hanzi}
        </span>
      </p>
      <p className="casual-situation">
        <span className="casual-key">{t('learn.casual.situation')}</span> {item.situation[lang]}
      </p>
      <p className="casual-checked">
        {t('learn.casual.checked', { sources: item.evidence.map((e) => EVIDENCE_NAMES[e] ?? e).join(', ') })}
      </p>
    </li>
  )
}
