import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { SettingsContext } from '../lib/settings-context'
import {
  loadSettings,
  normalizeSettings,
  resolveTheme,
  saveSettings,
  type Settings,
} from '../lib/settings'

const DARK_QUERY = '(prefers-color-scheme: dark)'

function applyTheme(theme: Settings['theme'], systemDark: boolean) {
  const resolved = resolveTheme(theme, systemDark)
  document.documentElement.setAttribute('data-theme', resolved)
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(loadSettings)

  const update = useCallback((patch: Partial<Omit<Settings, 'version'>>) => {
    setSettings((prev) => {
      const next = normalizeSettings({ ...prev, ...patch })
      saveSettings(next)
      return next
    })
  }, [])

  useEffect(() => {
    const mq = window.matchMedia(DARK_QUERY)
    applyTheme(settings.theme, mq.matches)
    if (settings.theme !== 'system') return
    const onChange = (e: MediaQueryListEvent) => applyTheme('system', e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [settings.theme])

  const value = useMemo(() => ({ settings, update }), [settings, update])
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}
