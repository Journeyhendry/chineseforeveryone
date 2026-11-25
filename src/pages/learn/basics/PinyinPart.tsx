import { useT } from '../../../i18n/context'
import type { BasicsData, SoundItem } from '../../../lib/basics'
import { useSettings } from '../../../lib/settings-context'
import { TonePinyin } from '../parts'
import { AudioNote, SoundTile } from './common'

const INITIAL_GROUPS = ['lips', 'tongueTip', 'throat', 'flat', 'curled', 'teeth', 'semi'] as const
const FINAL_GROUPS = ['simple', 'compound', 'nasal'] as const

export function PinyinPart({ data }: { data: BasicsData }) {
  const t = useT()
  const lang = useSettings().settings.lang
  const p = data.pinyin
  return (
    <>
      <section className="card basics-intro" aria-labelledby="py-what">
        <h2 id="py-what" className="card-title">
          {t('basics.pinyin.what')}
        </h2>
        <p>{p.intro[lang]}</p>
        <p className="syllable-formula tone-box" aria-label={t('basics.pinyin.formulaLabel')}>
          <span className="formula-part">
            <b>m</b>
            <small>{t('basics.pinyin.initial')}</small>
          </span>
          <span aria-hidden="true">+</span>
          <span className="formula-part">
            <b>a</b>
            <small>{t('basics.pinyin.final')}</small>
          </span>
          <span aria-hidden="true">+</span>
          <span className="formula-part">
            <b style={{ color: 'var(--tone-1)' }}>¯</b>
            <small>{t('tone.1')}</small>
          </span>
          <span aria-hidden="true">=</span>
          <span className="formula-part">
            <b lang="zh-Latn-pinyin" style={{ color: 'var(--tone-1)' }}>
              mā
            </b>
            <small lang="zh-CN" className="hanzi">
              妈
            </small>
          </span>
        </p>
        <AudioNote items={[...p.initials, ...p.finals]} />
      </section>

      <SoundTable
        id="py-initials"
        title={t('basics.pinyin.initials', { n: p.initials.length })}
        hint={t('basics.pinyin.initialsHint')}
        items={p.initials}
        groups={INITIAL_GROUPS.map((g) => ({ id: g, label: t(`basics.pinyin.group.${g}`) }))}
      />
      <SoundTable
        id="py-finals"
        title={t('basics.pinyin.finals', { n: p.finals.length })}
        hint={t('basics.pinyin.finalsHint')}
        items={p.finals}
        groups={FINAL_GROUPS.map((g) => ({ id: g, label: t(`basics.pinyin.group.${g}`) }))}
      />
    </>
  )
}

function SoundTable({
  id,
  title,
  hint,
  items,
  groups,
}: {
  id: string
  title: string
  hint: string
  items: SoundItem[]
  groups: { id: string; label: string }[]
}) {
  const t = useT()
  const lang = useSettings().settings.lang
  const notes = items.filter((i) => i.note)
  return (
    <section className="card" aria-labelledby={id}>
      <h2 id={id} className="card-title">
        {title}
      </h2>
      <p className="muted">{hint}</p>
      {groups.map((g) => {
        const list = items.filter((i) => i.group === g.id)
        if (list.length === 0) return null
        return (
          <div key={g.id} className="sound-group">
            <h3 className="sound-group-title">{g.label}</h3>
            <ul className="sound-grid">
              {list.map((s) => (
                <li key={s.audioId}>
                  <SoundTile item={s} label={`${s.sound}: ${s.hanzi} ${s.pinyin}`} className="sound-tile-pinyin">
                    <span className="sound-big" lang="zh-Latn-pinyin">
                      {s.sound}
                    </span>
                    <span className="sound-example">
                      <span lang="zh-CN" className="hanzi">
                        {s.hanzi}
                      </span>{' '}
                      <TonePinyin pinyin={s.pinyin} />
                    </span>
                    {s.note ? (
                      <span className="sound-flag" aria-hidden="true">
                        !
                      </span>
                    ) : null}
                  </SoundTile>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
      {notes.length > 0 ? (
        <div className="sound-notes">
          <h3 className="sound-group-title">
            <span className="sound-flag sound-flag-inline" aria-hidden="true">
              !
            </span>{' '}
            {t('basics.pinyin.notes')}
          </h3>
          <dl className="note-list">
            {notes.map((s) => (
              <div key={s.audioId} className="note-item">
                <dt lang="zh-Latn-pinyin">{s.sound}</dt>
                <dd>{s.note![lang]}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
    </section>
  )
}
