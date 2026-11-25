import { useT } from '../../i18n/context'
import type { LessonUnitInfo } from '../../lib/lessons'
import { dictionaryHref } from '../../lib/router'
import type { Lang } from '../../lib/settings'
import { ToneHanzi, TonePinyin } from '../learn/parts'
import { meaningShort } from '../learn/text'
import type { DictEntry } from './data'

/** Kartu hasil: tautan ke detail kata. */
export function WordCard({
  word,
  unit,
  lang,
  q,
  compact = false,
}: {
  word: DictEntry
  unit: LessonUnitInfo | undefined
  lang: Lang
  q: string
  compact?: boolean
}) {
  const t = useT()
  const other: Lang = lang === 'id' ? 'en' : 'id'
  const otherText = meaningShort(word, other)
  return (
    <a className={`dict-card ${compact ? 'is-compact' : ''}`} href={dictionaryHref({ screen: 'word', wordId: word.id, q })}>
      <span className="dict-card-glyph tone-box">
        <ToneHanzi hanzi={word.hanzi} syllables={word.syllables} className="dict-card-hanzi" />
        <TonePinyin pinyin={word.pinyin} className="dict-card-pinyin" />
      </span>
      <span className="dict-card-text">
        <span className="dict-card-meaning">{meaningShort(word, lang)}</span>
        {compact ? null : (
          <>
            <span className="dict-card-other" lang={other}>
              <span className="lang-tag">{t(`lang.short.${other}`)}:</span> {otherText}
            </span>
            {unit ? (
              <span className="dict-card-unit">
                {t('learn.unitNo', { n: unit.order })} · {unit.title[lang]}
              </span>
            ) : null}
          </>
        )}
      </span>
    </a>
  )
}
