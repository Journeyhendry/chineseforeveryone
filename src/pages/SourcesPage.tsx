import type { ReactNode } from 'react'
import creditsMd from '../../CREDITS.md?raw'
import { PageHeader } from '../components/ComingSoon'
import { useT } from '../i18n/context'
import { parseCredits, type Block, type Inline } from '../lib/credits'
import { issueUrl, REPO_URL } from '../lib/dictionary'
import { useSettings } from '../lib/settings-context'
import './sources/sources.css'

const BLOCKS = parseCredits(creditsMd)

function renderInline(nodes: Inline[]): ReactNode[] {
  return nodes.map((n, i) => {
    switch (n.type) {
      case 'text':
        return n.text
      case 'code':
        return <code key={i}>{n.text}</code>
      case 'bold':
        return <strong key={i}>{renderInline(n.children)}</strong>
      case 'link': {
        const external = /^https?:/i.test(n.href)
        return (
          <a key={i} href={n.href} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
            {renderInline(n.children)}
          </a>
        )
      }
    }
  })
}

// Judul "#" dari CREDITS.md menjadi h2 (h1 halaman ada di PageHeader); level lain ikut bergeser satu.
const HEADINGS = { 1: 'h2', 2: 'h3', 3: 'h4' } as const

function renderBlock(b: Block, i: number): ReactNode {
  switch (b.type) {
    case 'heading': {
      const H = HEADINGS[b.level]
      return <H key={i}>{renderInline(b.children)}</H>
    }
    case 'paragraph':
      return <p key={i}>{renderInline(b.children)}</p>
    case 'list':
      return (
        <ul key={i}>
          {b.items.map((it, j) => (
            <li key={j}>
              {renderInline(it.children)}
              {it.sub.length > 0 ? (
                <ul>
                  {it.sub.map((s, k) => (
                    <li key={k}>{renderInline(s)}</li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      )
  }
}

export function SourcesPage() {
  const t = useT()
  const { settings } = useSettings()
  const reportHref = issueUrl({ context: t('page.sources.title'), pageUrl: `${window.location.origin}${window.location.pathname}#/sumber`, lang: settings.lang })
  return (
    <>
      <PageHeader title={t('sources.title')} />
      <div className="sources-page">
        <p className="sources-intro">{t('sources.intro')}</p>
        {settings.lang === 'en' ? (
          <p className="sources-note" role="note">
            {t('sources.idOnly')}
          </p>
        ) : null}
        <section className="card sources-links" aria-labelledby="sources-links-title">
          <h2 id="sources-links-title" className="card-title">
            {t('sources.links')}
          </h2>
          <ul>
            <li>
              <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
                {t('sources.repo')}
                <span className="sr-only"> {t('report.newTab')}</span>
              </a>
            </li>
            <li>
              <a href={reportHref} target="_blank" rel="noopener noreferrer">
                {t('sources.report')}
                <span className="sr-only"> {t('report.newTab')}</span>
              </a>
            </li>
          </ul>
        </section>
        <article className="card sources-credits" aria-labelledby="sources-content-title" lang="id">
          <h2 id="sources-content-title" className="sr-only">
            {t('sources.content')}
          </h2>
          {BLOCKS.map(renderBlock)}
        </article>
      </div>
    </>
  )
}
