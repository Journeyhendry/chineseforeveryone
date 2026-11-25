import { useRef, type ReactNode } from 'react'
import { useT } from '../../i18n/context'
import type { LessonWord } from '../../lib/lessons'
import { useSettings } from '../../lib/settings-context'
import type { QuizResult } from './QuizRunner'
import { useFocusOnChange } from './hooks'
import { StarIcon } from '../../components/icons'
import { meaningShort } from './text'

/** Layar nilai: bintang, skor, daftar kata yang salah, lalu tombol aksi (children). */
export function ResultScreen({
  title,
  stars,
  result,
  words,
  message,
  children,
  extra,
}: {
  title: string
  stars: number | null
  result: QuizResult
  words: Map<string, LessonWord>
  message: string
  children: ReactNode
  /** Task 7: "satu game singkat" setelah latihan. */
  extra?: ReactNode
}) {
  const t = useT()
  const { settings } = useSettings()
  const h1 = useRef<HTMLHeadingElement>(null)
  useFocusOnChange(h1, 'result', true)
  const wrong = result.wrong.map((id) => words.get(id)!).filter(Boolean)
  return (
    <section className="card result-card" aria-labelledby="result-title">
      <h1 id="result-title" ref={h1} tabIndex={-1} className="result-title">
        {title}
      </h1>
      {stars !== null ? (
        <div className="result-stars">
          {[1, 2, 3].map((n) => (
            <span key={n} className={`result-star${n <= stars ? ' is-on' : ''}`} style={{ animationDelay: `${n * 120}ms` }}>
              <StarIcon filled={n <= stars} />
            </span>
          ))}
          <span className="sr-only">{t('learn.stars', { n: stars })}</span>
        </div>
      ) : null}
      <p className="result-score">{t('learn.result.score', { correct: result.correct, total: result.total })}</p>
      <p className="result-message">{message}</p>
      <div className="row-actions result-actions">{children}</div>
      {extra ? <div className="result-extra">{extra}</div> : null}
      {wrong.length > 0 ? (
        <section className="result-wrong" aria-labelledby="wrong-title">
          <h2 id="wrong-title" className="card-title">
            {t('learn.result.wrongTitle')}
          </h2>
          <ul className="wrong-list">
            {wrong.map((w) => (
              <li key={w.id} className="wrong-item">
                <span lang="zh-CN" className="wrong-hanzi">
                  {w.hanzi}
                </span>
                <span lang="zh-Latn-pinyin" className="wrong-pinyin">
                  {w.pinyin}
                </span>
                <span className="wrong-meaning">{meaningShort(w, settings.lang)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="muted">{t('learn.result.noWrong')}</p>
      )}
    </section>
  )
}
