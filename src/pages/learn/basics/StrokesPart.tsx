import { useState } from 'react'
import { RepeatIcon } from '../../../components/icons'
import { useT } from '../../../i18n/context'
import type { BasicsData } from '../../../lib/basics'
import { useSettings } from '../../../lib/settings-context'
import { StrokePanel } from '../StrokePanel'
import { StrokeShape } from './common'
import '../word.css'

export function StrokesPart({ data }: { data: BasicsData }) {
  const t = useT()
  const lang = useSettings().settings.lang
  const d = data.strokes
  const [replay, setReplay] = useState<Record<string, number>>({})
  const ruleChars = d.rules.flatMap((r) => r.examples.map((e) => ({ char: e.char, rule: r.id })))
  const [sel, setSel] = useState(ruleChars[0])
  return (
    <>
      <section className="card basics-intro" aria-labelledby="st-what">
        <h2 id="st-what" className="card-title">
          {t('basics.strokes.what')}
        </h2>
        <p>{d.intro[lang]}</p>
      </section>

      <section className="card" aria-labelledby="st-basic">
        <h2 id="st-basic" className="card-title">
          {t('basics.strokes.basic')}
        </h2>
        <p className="muted">{t('basics.strokes.basicHint')}</p>
        <ul className="stroke-cards">
          {d.basic.map((s) => (
            <li key={s.id} className="stroke-card">
              <StrokeShape
                char={s.example.char}
                index={s.example.stroke}
                replay={replay[s.id] ?? 0}
                label={t('basics.strokes.shapeLabel', { name: `${s.hanzi} ${s.pinyin}`, char: s.example.char })}
              />
              <div className="stroke-card-text">
                <h3 className="stroke-card-name">
                  <span lang="zh-CN" className="hanzi">
                    {s.hanzi}
                  </span>{' '}
                  <span lang="zh-Latn-pinyin" className="pinyin">
                    {s.pinyin}
                  </span>
                </h3>
                <p className="stroke-card-meaning">{s.meaning[lang]}</p>
                <p className="stroke-card-desc">{s.desc[lang]}</p>
                <p className="stroke-card-example">
                  {t('basics.strokes.example')}{' '}
                  <span lang="zh-CN" className="hanzi">
                    {s.example.char}
                  </span>
                </p>
                <button
                  type="button"
                  className="btn btn-white btn-small"
                  onClick={() => setReplay((r) => ({ ...r, [s.id]: (r[s.id] ?? 0) + 1 }))}
                >
                  <RepeatIcon />
                  <span>
                    {t('learn.stroke.replay')}
                    <span className="sr-only">: {s.hanzi}</span>
                  </span>
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <div className="stroke-rules-layout">
        <section className="card" aria-labelledby="st-rules">
          <h2 id="st-rules" className="card-title">
            {t('basics.strokes.rules')}
          </h2>
          <p className="muted">{t('basics.strokes.rulesHint')}</p>
          <ol className="rule-list">
            {d.rules.map((r) => (
              <li key={r.id} className="rule-item">
                <div className="rule-text">
                  <span lang="zh-CN" className="hanzi rule-hanzi">
                    {r.hanzi}
                  </span>
                  <span lang="zh-Latn-pinyin" className="rule-pinyin">
                    {r.pinyin}
                  </span>
                  <span className="rule-meaning">{r.text[lang]}</span>
                </div>
                <div className="rule-chars" role="group" aria-label={t('basics.strokes.ruleChars', { rule: r.text[lang] })}>
                  {r.examples.map((e) => (
                    <button
                      key={e.char}
                      type="button"
                      lang="zh-CN"
                      className="stroke-pick-btn"
                      aria-pressed={sel.char === e.char && sel.rule === r.id}
                      aria-label={t('basics.strokes.showChar', { char: e.char })}
                      onClick={() => setSel({ char: e.char, rule: r.id })}
                    >
                      {e.char}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        </section>
        <StrokePanel key={`${sel.rule}:${sel.char}`} chars={[sel.char]} />
      </div>
    </>
  )
}
