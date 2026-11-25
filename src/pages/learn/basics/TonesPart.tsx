import { PlayIcon } from '../../../components/icons'
import { useT } from '../../../i18n/context'
import type { BasicsData } from '../../../lib/basics'
import { syllableTone } from '../../../lib/pinyin'
import { useSettings } from '../../../lib/settings-context'
import { ToneHanzi, TonePinyin } from '../parts'
import { useBasicsAudio, useSequence } from './audio'
import { AudioNote, SoundTile, ToneContour } from './common'

export function TonesPart({ data }: { data: BasicsData }) {
  const t = useT()
  const lang = useSettings().settings.lang
  const d = data.tones
  const audio = useBasicsAudio()
  const seq = useSequence(audio.play)
  const firstSet = d.sets[0]
  return (
    <>
      <section className="card basics-intro" aria-labelledby="tn-what">
        <h2 id="tn-what" className="card-title">
          {t('basics.tones.what')}
        </h2>
        <p>{d.intro[lang]}</p>
        <AudioNote items={d.sets.flatMap((s) => s.items)} />
      </section>

      <section aria-labelledby="tn-cards">
        <h2 id="tn-cards" className="sr-only">
          {t('basics.tones.cards')}
        </h2>
        <ul className="tone-cards">
          {d.tones.map((tn) => {
            const example = tn.tone === 5 ? d.neutral[0] : firstSet.items[tn.tone - 1]
            const syllables = tn.tone === 5 ? d.neutral[0].syllables : [example.pinyin]
            return (
              <li key={tn.tone} className={`card tone-box tone-card tone-card-${tn.tone}`}>
                <div className="tone-card-head">
                  <span className="tone-mark" lang="zh-Latn-pinyin" style={{ color: `var(--tone-${tn.tone})` }}>
                    {tn.mark}
                  </span>
                  <ToneContour tone={tn} />
                </div>
                <h3 className="tone-card-name">{tn.name[lang]}</h3>
                <p className="tone-card-desc">{tn.desc[lang]}</p>
                <SoundTile item={example} label={`${example.hanzi} ${example.pinyin}`} className="sound-tile-inline">
                  <ToneHanzi hanzi={example.hanzi} syllables={syllables} className="sound-hanzi-sm" />
                  <TonePinyin pinyin={example.pinyin} className="sound-pinyin" />
                </SoundTile>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="card" aria-labelledby="tn-sets">
        <h2 id="tn-sets" className="card-title">
          {t('basics.tones.sets')}
        </h2>
        <p className="muted">{t('basics.tones.setsHint')}</p>
        <ul className="tone-sets">
          {d.sets.map((set) => {
            const name = set.items.map((i) => i.pinyin).join(' ')
            return (
              <li key={set.id} className="tone-set">
                <button
                  type="button"
                  className="btn btn-yellow tone-set-all"
                  disabled={!set.items.some(audio.has)}
                  aria-label={t('basics.tones.playAllLabel', { text: name })}
                  aria-pressed={seq.playing === set.id}
                  onClick={() => seq.run(set.id, set.items.filter(audio.has))}
                >
                  <PlayIcon />
                  <span>{t('basics.tones.playAll')}</span>
                </button>
                <ul className="tone-set-items">
                  {set.items.map((it) => (
                    <li key={it.audioId}>
                      <SoundTile item={it} label={`${it.hanzi} ${it.pinyin}, ${t(`tone.${syllableTone(it.pinyin)}`)}`} className="sound-tile-word">
                        <ToneHanzi hanzi={it.hanzi} syllables={[it.pinyin]} className="sound-hanzi" />
                        <TonePinyin pinyin={it.pinyin} className="sound-pinyin" />
                        <span className="sound-meaning">{it.meaning[lang]}</span>
                      </SoundTile>
                    </li>
                  ))}
                </ul>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="card" aria-labelledby="tn-neutral">
        <h2 id="tn-neutral" className="card-title">
          {t('basics.tones.neutral')}
        </h2>
        <p className="muted">{t('basics.tones.neutralHint')}</p>
        <ul className="sound-grid sound-grid-wide">
          {d.neutral.map((it) => (
            <li key={it.audioId}>
              <SoundTile item={it} label={`${it.hanzi} ${it.pinyin}`} className="sound-tile-word">
                <ToneHanzi hanzi={it.hanzi} syllables={it.syllables} className="sound-hanzi" />
                <TonePinyin pinyin={it.pinyin} className="sound-pinyin" />
                <span className="sound-meaning">{it.meaning[lang]}</span>
              </SoundTile>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
