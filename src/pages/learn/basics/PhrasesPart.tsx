import { useT } from '../../../i18n/context'
import type { BasicsData } from '../../../lib/basics'
import { splitSyllables } from '../../../lib/pinyin'
import { useSettings } from '../../../lib/settings-context'
import { ToneHanzi, TonePinyin } from '../parts'
import { AudioNote, PlayIconButton, SoundTile } from './common'

export function PhrasesPart({ data }: { data: BasicsData }) {
  const t = useT()
  const lang = useSettings().settings.lang
  const d = data.phrases
  return (
    <>
      <section className="card basics-intro" aria-labelledby="ph-what">
        <h2 id="ph-what" className="card-title">
          {t('basics.phrases.what')}
        </h2>
        <p>{d.intro[lang]}</p>
        <AudioNote items={[...d.numbers, ...d.greetings]} />
      </section>

      <section className="card" aria-labelledby="ph-numbers">
        <h2 id="ph-numbers" className="card-title">
          {t('basics.phrases.numbers')}
        </h2>
        <ul className="number-grid">
          {d.numbers.map((n) => (
            <li key={n.audioId}>
              <SoundTile item={n} label={`${n.value}: ${n.hanzi} ${n.pinyin}`} className="sound-tile-word number-tile">
                <span className="number-value" aria-hidden="true">
                  {n.value}
                </span>
                <ToneHanzi hanzi={n.hanzi} syllables={[n.pinyin]} className="sound-hanzi" />
                <TonePinyin pinyin={n.pinyin} className="sound-pinyin" />
                <span className="sound-meaning">{n.meaning[lang]}</span>
              </SoundTile>
            </li>
          ))}
        </ul>
      </section>

      <section className="card" aria-labelledby="ph-greet">
        <h2 id="ph-greet" className="card-title">
          {t('basics.phrases.greetings')}
        </h2>
        <ul className="greet-list">
          {d.greetings.map((g) => (
            <li key={g.audioId} className="greet-item tone-box">
              <div className="greet-main">
                <ToneHanzi hanzi={g.hanzi} syllables={splitSyllables(g.pinyin)} className="greet-hanzi" />
                <TonePinyin pinyin={g.pinyin} className="greet-pinyin" />
              </div>
              <div className="greet-text">
                <b>{g.meaning[lang]}</b>
                <span>{g.use[lang]}</span>
              </div>
              <PlayIconButton item={g} label={`${g.hanzi} ${g.pinyin}`} />
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
