import { useT } from '../../../i18n/context'
import { changedSyllables, type BasicsData } from '../../../lib/basics'
import { syllableTone } from '../../../lib/pinyin'
import { useSettings } from '../../../lib/settings-context'
import { ToneHanzi } from '../parts'
import { AudioNote, PlayIconButton } from './common'

/** Pinyin per suku kata berwarna nada; suku kata yang berubah ditandai (bukan warna saja). */
export function SyllableRow({ syllables, changed, srChanged }: { syllables: string[]; changed?: Set<number>; srChanged?: string }) {
  return (
    <span className="syl-row" lang="zh-Latn-pinyin">
      {syllables.map((s, i) => {
        const tone = syllableTone(s)
        const isChanged = changed?.has(i)
        return (
          <span key={i} className={`syl${isChanged ? ' is-changed' : ''}`} style={{ color: `var(--tone-${tone})` }}>
            {s}
            {isChanged && srChanged ? <span className="sr-only"> ({srChanged})</span> : null}
          </span>
        )
      })}
    </span>
  )
}

export function SandhiPart({ data }: { data: BasicsData }) {
  const t = useT()
  const lang = useSettings().settings.lang
  const d = data.sandhi
  return (
    <>
      <section className="card basics-intro" aria-labelledby="sd-what">
        <h2 id="sd-what" className="card-title">
          {t('basics.sandhi.what')}
        </h2>
        <p>{d.intro[lang]}</p>
        <p className="sandhi-legend">
          <span className="syl is-changed">ní</span> = {t('basics.sandhi.legend')}
        </p>
        <AudioNote items={d.rules.flatMap((r) => r.examples)} />
      </section>

      {d.rules.map((r) => (
        <section key={r.id} className="card" aria-labelledby={`sd-${r.id}`}>
          <h2 id={`sd-${r.id}`} className="card-title">
            <span lang="zh-CN">{r.title[lang]}</span>
          </h2>
          <p className="sandhi-rule">{r.rule[lang]}</p>
          <ul className="sandhi-list">
            {r.examples.map((ex) => {
              const changed = changedSyllables(ex)
              return (
                <li key={ex.audioId} className="sandhi-item tone-box">
                  <ToneHanzi hanzi={ex.hanzi} syllables={ex.spoken} className="sandhi-hanzi" />
                  <div className="sandhi-forms">
                    <span className="sandhi-form">
                      <span className="sandhi-label">{t('basics.sandhi.written')}</span>
                      <SyllableRow syllables={ex.base} />
                    </span>
                    <span className="sandhi-arrow" aria-hidden="true">
                      →
                    </span>
                    <span className="sandhi-form">
                      <span className="sandhi-label">{t('basics.sandhi.spoken')}</span>
                      <SyllableRow syllables={ex.spoken} changed={changed} srChanged={t('basics.sandhi.changedSr')} />
                    </span>
                    {changed.size === 0 ? <span className="badge">{t('basics.sandhi.noChange')}</span> : null}
                  </div>
                  <span className="sandhi-meaning">{ex.meaning[lang]}</span>
                  <PlayIconButton item={ex} label={`${ex.hanzi} ${ex.spoken.join(' ')}`} />
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </>
  )
}
