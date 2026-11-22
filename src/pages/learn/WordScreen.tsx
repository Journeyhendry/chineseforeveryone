import { useRef } from 'react'
import { ArrowLeftIcon, ArrowRightIcon } from '../../components/icons'
import { useT } from '../../i18n/context'
import type { Example, LessonUnitInfo, UnitData } from '../../lib/lessons'
import { learnHref } from '../../lib/router'
import { useSettings } from '../../lib/settings-context'
import { CasualBox } from './CasualCard'
import { go, isInteractiveTarget, useAudio, useDocumentTitle, useFocusOnChange, useHotkeys } from './hooks'
import { AudioButtons, Badge, LessonBar, MachineTag, SpeakButton, ToneHanzi, TonePinyin, ToneLabels } from './parts'
import { StrokePanel } from './StrokePanel'
import { WordScene } from './WordScene'
import { meaningFull, tatoebaUrl } from './text'
import './word.css'

export function WordScreen({ info, data, n }: { info: LessonUnitInfo; data: UnitData; n: number }) {
  const t = useT()
  const { settings } = useSettings()
  const lang = settings.lang
  const other = lang === 'id' ? 'en' : 'id'
  const { available, play } = useAudio()
  const word = data.words[n - 1]
  const total = data.words.length
  const h1 = useRef<HTMLHeadingElement>(null)
  useDocumentTitle(`${word.hanzi} · ${t('learn.word.screen')}`)
  useFocusOnChange(h1, `word:${info.id}:${n}`)

  const unitHref = learnHref({ screen: 'unit', unitId: info.id })
  const prevHref = n > 1 ? learnHref({ screen: 'word', unitId: info.id, index: n - 1 }) : null
  const nextHref = n < total ? learnHref({ screen: 'word', unitId: info.id, index: n + 1 }) : learnHref({ screen: 'practice', unitId: info.id })
  const casual = [...data.casual, ...data.relatedCasual].filter((c) => c.hsk.wordIds.includes(word.id))

  useHotkeys((e) => {
    if (e.key === ' ' || e.code === 'Space') {
      if (isInteractiveTarget(e.target)) return
      e.preventDefault()
      if (available) play(word.hanzi)
    } else if (e.key === 'Enter') {
      if (isInteractiveTarget(e.target)) return
      e.preventDefault()
      go(nextHref)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      go(nextHref)
    } else if (e.key === 'ArrowLeft' && prevHref) {
      e.preventDefault()
      go(prevHref)
    }
  })

  return (
    <div className="learn-word">
      <LessonBar
        exitHref={unitHref}
        exitLabel={t('learn.exitToUnit')}
        context={`${t('learn.unitNo', { n: info.order })} · ${info.title[lang]} · ${t('learn.word.screen')}`}
        count={t('learn.word.count', { n, total })}
        value={n}
        max={total}
        barLabel={t('learn.word.progress')}
      />

      <div className="word-layout">
        <StrokePanel key={word.id} chars={word.chars} />

        <div className="word-info">
          <section className="card word-main" aria-labelledby="word-hanzi">
            <div className="word-glyph tone-box">
              <h1 id="word-hanzi" ref={h1} tabIndex={-1} className="word-hanzi">
                <ToneHanzi hanzi={word.hanzi} syllables={word.syllables} />
              </h1>
              {settings.showPinyin ? <TonePinyin pinyin={word.pinyin} className="word-pinyin" /> : null}
              <ToneLabels syllables={word.syllables} showPinyin={settings.showPinyin} />
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

          <WordScene wordId={word.id} hanzi={word.hanzi} />

          <section className="card examples" aria-labelledby="examples-title">
            <h2 id="examples-title" className="card-title">
              {t('learn.examples.title')}
            </h2>
            {word.examples.length === 0 ? (
              <p className="muted">{t('learn.examples.none')}</p>
            ) : (
              <ul className="example-list">
                {word.examples.map((ex) => (
                  <ExampleItem key={ex.tatoebaId} ex={ex} />
                ))}
              </ul>
            )}
          </section>

          <CasualBox items={casual} />
        </div>
      </div>

      <footer className="word-foot">
        {prevHref ? (
          <a className="btn btn-white" href={prevHref}>
            <ArrowLeftIcon />
            <span>{t('learn.prev')}</span>
          </a>
        ) : (
          <span />
        )}
        <span className="key-hint">{t('learn.word.keys')}</span>
        <a className="btn btn-big" href={nextHref}>
          <span>{n < total ? t('learn.next') : t('learn.word.toPractice')}</span>
          <ArrowRightIcon />
        </a>
      </footer>
    </div>
  )
}

function ExampleItem({ ex }: { ex: Example }) {
  const t = useT()
  const { settings } = useSettings()
  const lang = settings.lang
  const tr = lang === 'id' ? (ex.ind ?? ex.en) : ex.en
  const trLang = tr === ex.ind ? 'id' : 'en'
  return (
    <li className="example">
      <div className="example-head">
        <p className="example-cmn" lang="zh-CN">
          {ex.cmn}
        </p>
        <SpeakButton text={ex.cmn} label={ex.cmn} />
      </div>
      {tr ? (
        <p className="example-tr" lang={trLang}>
          {trLang !== lang ? <Badge>{t(`lang.short.${trLang}`)}</Badge> : null} {tr.text}
        </p>
      ) : null}
      {ex.outside ? (
        <p className="example-outside">
          {t('learn.examples.outside')}{' '}
          <span lang="zh-CN" className="hanzi-inline">
            {ex.outside}
          </span>
        </p>
      ) : null}
      <p className="example-src">
        <a href={tatoebaUrl(ex.tatoebaId)} target="_blank" rel="noopener noreferrer">
          Tatoeba #{ex.tatoebaId}
        </a>{' '}
        · {ex.author} · {ex.license}
        {tr ? (
          <>
            {' · '}
            {t('learn.examples.translation')}{' '}
            <a href={tatoebaUrl(tr.tatoebaId)} target="_blank" rel="noopener noreferrer">
              #{tr.tatoebaId}
            </a>{' '}
            · {tr.author}
          </>
        ) : null}
      </p>
    </li>
  )
}
