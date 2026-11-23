import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { PageHeader } from '../../components/ComingSoon'
import { useT } from '../../i18n/context'
import { searchDictionary } from '../../lib/dictionary'
import { dictionaryHref, hrefFor } from '../../lib/router'
import { useSettings } from '../../lib/settings-context'
import { useDocumentTitle, type WordBank } from '../learn/hooks'
import type { useDictionaryData } from './data'
import { WordCard } from './WordCard'

type Data = ReturnType<typeof useDictionaryData>

export function SearchScreen({ bank, data, initialQ }: { bank: WordBank; data: Data; initialQ: string }) {
  const t = useT()
  const { settings } = useSettings()
  const lang = settings.lang
  const [q, setQ] = useState(initialQ)
  const [seenInitial, setSeenInitial] = useState(initialQ)
  // Alamat berubah dari luar (mis. tautan "Kamus" di menu): ikuti.
  if (seenInitial !== initialQ) {
    setSeenInitial(initialQ)
    setQ(initialQ)
  }
  const input = useRef<HTMLInputElement>(null)
  const hintId = useId()
  useDocumentTitle(q.trim() ? `${q.trim()} · ${t('page.dictionary.title')}` : t('page.dictionary.title'))

  // Fokus otomatis; ditunda satu frame supaya tidak dikalahkan perpindahan fokus ke <main> saat ganti halaman.
  useEffect(() => {
    const id = requestAnimationFrame(() => input.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [])

  const results = useMemo(() => searchDictionary(data.index, q, lang), [data.index, q, lang])
  const trimmed = q.trim()
  const unitById = useMemo(() => new Map(bank.index.units.map((u) => [u.id, u] as const)), [bank.index])

  const onChange = (value: string) => {
    setQ(value)
    // Simpan query di alamat tanpa menambah riwayat (tombol Kembali tidak penuh).
    const next = dictionaryHref({ screen: 'search', q: value.trim() ? value : '' })
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}${next}`)
  }

  return (
    <>
      <PageHeader title={t('page.dictionary.title')} />
      <div className="dict-page">
        <div className="dict-search" role="search">
          <label className="dict-label" htmlFor="dict-q">
            {t('dict.search.label')}
          </label>
          <input
            ref={input}
            id="dict-q"
            className="dict-input"
            type="search"
            value={q}
            placeholder={t('dict.search.placeholder')}
            aria-describedby={hintId}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="search"
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.preventDefault()
            }}
          />
          <p id={hintId} className="muted dict-hint">
            {t('dict.search.hint')}
          </p>
        </div>

        <p className="dict-count" role="status" aria-live="polite">
          {trimmed ? (results.length === 1 ? t('dict.count.one') : t('dict.count', { n: results.length })) : ''}
        </p>

        {trimmed ? (
          results.length > 0 ? (
            <ul className="dict-list" aria-label={t('dict.results.label')}>
              {results.map((r) => (
                <li key={r.word.id}>
                  <WordCard word={r.word} unit={unitById.get(r.word.unitId)} lang={lang} q={trimmed} />
                </li>
              ))}
            </ul>
          ) : (
            <section className="card dict-none" aria-labelledby="dict-none-title">
              <h2 id="dict-none-title" className="card-title">
                {t('dict.none.title', { q: trimmed })}
              </h2>
              <ul>
                <li>{t('dict.none.tip1')}</li>
                <li>{t('dict.none.tip2')}</li>
                <li>{t('dict.none.tip3')}</li>
              </ul>
            </section>
          )
        ) : (
          <section aria-labelledby="dict-browse">
            <h2 id="dict-browse" className="dict-browse-title">
              {t('dict.browse.title')}
            </h2>
            {bank.index.units.map((u) => (
              <section key={u.id} className="dict-unit" aria-labelledby={`dict-unit-${u.id}`}>
                <h3 id={`dict-unit-${u.id}`}>
                  {t('learn.unitNo', { n: u.order })} · {u.title[lang]}
                </h3>
                <ul className="dict-list is-compact">
                  {data.entries
                    .filter((e) => e.unitId === u.id)
                    .map((w) => (
                      <li key={w.id}>
                        <WordCard word={w} unit={u} lang={lang} q="" compact />
                      </li>
                    ))}
                </ul>
              </section>
            ))}
          </section>
        )}

        <p className="muted dict-foot">
          {t('dict.foot.sources')} <a href={hrefFor('sumber')}>{t('dict.foot.link')}</a>
        </p>
      </div>
    </>
  )
}
