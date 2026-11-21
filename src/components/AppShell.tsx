import { useEffect, useRef, type ReactNode } from 'react'
import { useT, type MessageKey } from '../i18n/context'
import { hrefFor, useRoute, type RouteName } from '../lib/router'
import { useSettings } from '../lib/settings-context'
import type { Lang } from '../lib/settings'
import { BookIcon, ChartIcon, GearIcon, MapIcon, RepeatIcon } from './icons'
import { LearnPage } from '../pages/LearnPage'
import { ReviewPage } from '../pages/ReviewPage'
import { DictionaryPage } from '../pages/DictionaryPage'
import { ProgressPage } from '../pages/ProgressPage'
import { SettingsPage } from '../pages/SettingsPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import './AppShell.css'

const MAIN_NAV: { name: RouteName & ('belajar' | 'ulang' | 'kamus' | 'progres'); key: MessageKey; icon: ReactNode }[] = [
  { name: 'belajar', key: 'nav.learn', icon: <MapIcon /> },
  { name: 'ulang', key: 'nav.review', icon: <RepeatIcon /> },
  { name: 'kamus', key: 'nav.dictionary', icon: <BookIcon /> },
  { name: 'progres', key: 'nav.progress', icon: <ChartIcon /> },
]

const TITLE_KEYS: Record<RouteName, MessageKey> = {
  belajar: 'page.learn.title',
  ulang: 'page.review.title',
  kamus: 'page.dictionary.title',
  progres: 'page.progress.title',
  pengaturan: 'settings.title',
  notfound: 'notfound.title',
}

function Page({ name }: { name: RouteName }) {
  switch (name) {
    case 'belajar':
      return <LearnPage />
    case 'ulang':
      return <ReviewPage />
    case 'kamus':
      return <DictionaryPage />
    case 'progres':
      return <ProgressPage />
    case 'pengaturan':
      return <SettingsPage />
    default:
      return <NotFoundPage />
  }
}

export function AppShell() {
  const t = useT()
  const route = useRoute()
  const { settings, update } = useSettings()
  const mainRef = useRef<HTMLElement>(null)
  const firstRender = useRef(true)

  const title = t('app.titleTemplate', { page: t(TITLE_KEYS[route.name]) })
  useEffect(() => {
    document.title = title
  }, [title])

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    mainRef.current?.focus()
  }, [route.name])

  const langs: Lang[] = ['id', 'en']

  return (
    <div className="shell">
      <a className="skip-link" href="#isi" onClick={(e) => {
        e.preventDefault()
        mainRef.current?.focus()
      }}>
        {t('app.skip')}
      </a>
      <nav className="sidebar" aria-label={t('nav.label')}>
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" lang="zh-Hans">
            学
          </span>
          <span className="brand-name">Xué Mandarin</span>
        </div>
        <ul className="menu">
          {MAIN_NAV.map((item) => (
            <li key={item.name}>
              <a
                className="nav-link"
                href={hrefFor(item.name)}
                aria-current={route.name === item.name ? 'page' : undefined}
              >
                {item.icon}
                <span>{t(item.key)}</span>
              </a>
            </li>
          ))}
        </ul>
        <div className="nav-foot">
          <div className="lang-switch">
            <span id="lang-label" className="lang-label">
              {t('lang.label')}
            </span>
            <div role="group" aria-labelledby="lang-label" className="lang-group">
              {langs.map((l) => (
                <button
                  key={l}
                  type="button"
                  className="lang-btn"
                  aria-pressed={settings.lang === l}
                  aria-label={t(`lang.name.${l}`)}
                  onClick={() => update({ lang: l })}
                >
                  {t(`lang.short.${l}`)}
                </button>
              ))}
            </div>
          </div>
          <a
            className="nav-link"
            href={hrefFor('pengaturan')}
            aria-current={route.name === 'pengaturan' ? 'page' : undefined}
          >
            <GearIcon />
            <span>{t('nav.settings')}</span>
          </a>
        </div>
      </nav>
      <main id="isi" ref={mainRef} tabIndex={-1} className="content">
        <div className="content-inner">
          <Page name={route.name} />
        </div>
      </main>
    </div>
  )
}
