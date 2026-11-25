import { useState } from 'react'
import { useT } from '../../../i18n/context'
import type { BasicsData, Composition, Radical } from '../../../lib/basics'
import { useSettings } from '../../../lib/settings-context'
import { TonePinyin } from '../parts'
import { AudioNote, PlayIconButton, SoundTile } from './common'

export function RadicalsPart({ data }: { data: BasicsData }) {
  const t = useT()
  const lang = useSettings().settings.lang
  const d = data.radicals
  return (
    <>
      <section className="card basics-intro" aria-labelledby="rd-what">
        <h2 id="rd-what" className="card-title">
          {t('basics.radicals.what')}
        </h2>
        <p>{d.intro[lang]}</p>
        <AudioNote items={d.items.flatMap((r) => r.examples)} />
      </section>

      <section className="card" aria-labelledby="rd-list">
        <h2 id="rd-list" className="card-title">
          {t('basics.radicals.list', { n: d.items.length })}
        </h2>
        <p className="muted">{t('basics.radicals.listHint')}</p>
        <ul className="radical-grid">
          {d.items.map((r) => (
            <RadicalCard key={r.radical} r={r} />
          ))}
        </ul>
      </section>

      <section className="card" aria-labelledby="rd-build">
        <h2 id="rd-build" className="card-title">
          {t('basics.radicals.build')}
        </h2>
        <p className="muted">{t('basics.radicals.buildHint')}</p>
        <ul className="compose-grid">
          {d.compositions.map((c) => (
            <CompositionCard key={c.hanzi} c={c} />
          ))}
        </ul>
      </section>
    </>
  )
}

function RadicalCard({ r }: { r: Radical }) {
  const t = useT()
  const lang = useSettings().settings.lang
  const [sel, setSel] = useState<number | null>(null)
  const ex = sel === null ? null : r.examples[sel]
  return (
    <li className="radical-card">
      <div className="radical-head">
        <span className="radical-glyph hanzi" lang="zh-CN">
          {r.radical}
          {r.variant ? <span className="radical-variant"> {r.variant}</span> : null}
        </span>
        <div>
          <h3 className="radical-meaning">{r.meaning[lang]}</h3>
          <p className="radical-from">
            {t('basics.radicals.from')}{' '}
            <span lang="zh-CN" className="hanzi">
              {r.from}
            </span>{' '}
            <span lang="zh-Latn-pinyin">{r.pinyin}</span>
          </p>
        </div>
      </div>
      <div className="radical-examples" role="group" aria-label={t('basics.radicals.examples', { radical: r.radical })}>
        {r.examples.map((e, i) => (
          <SoundTile key={e.audioId} item={e} label={`${e.hanzi} ${e.pinyin}`} className="sound-tile-char" pressed={sel === i} onPlay={() => setSel(i)}>
            <span lang="zh-CN" className="hanzi">
              {e.hanzi}
            </span>
          </SoundTile>
        ))}
      </div>
      <p className="radical-detail" aria-live="polite">
        {ex ? (
          <>
            <span lang="zh-CN" className="hanzi radical-detail-hanzi">
              {ex.hanzi}
            </span>{' '}
            <span lang="zh-Latn-pinyin" className="pinyin">
              {ex.pinyin}
            </span>{' '}
            · {ex.meaning[lang]}
          </>
        ) : (
          <span className="muted">{t('basics.radicals.tapHint')}</span>
        )}
      </p>
    </li>
  )
}

function CompositionCard({ c }: { c: Composition }) {
  const t = useT()
  const lang = useSettings().settings.lang
  const audio = c.audioId ? { audioId: c.audioId, hanzi: c.hanzi, pinyin: c.pinyin } : null
  return (
    <li className="compose-card">
      <div className="compose-row">
        <span
          className={`compose-box compose-${c.layout}`}
          role="img"
          aria-label={t(`basics.radicals.layout.${c.layout}`, { a: c.parts[0], b: c.parts[1] })}
        >
          {c.parts.map((p, i) => (
            <span key={i} className={`compose-part compose-part-${i}`} lang="zh-CN" aria-hidden="true">
              {p}
            </span>
          ))}
        </span>
        <span className="compose-eq" aria-hidden="true">
          =
        </span>
        <span className="compose-result tone-box">
          <span lang="zh-CN" className="hanzi compose-hanzi">
            {c.hanzi}
          </span>
          <TonePinyin pinyin={c.pinyin} className="compose-pinyin" />
        </span>
        {audio ? <PlayIconButton item={audio} label={`${c.hanzi} ${c.pinyin}`} /> : null}
      </div>
      <p className="compose-layout-name">{t(`basics.radicals.layoutName.${c.layout}`)}</p>
      <p className="compose-meaning">
        <b>{c.meaning[lang]}</b> · {c.note[lang]}
      </p>
    </li>
  )
}
