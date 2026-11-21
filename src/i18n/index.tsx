import { useCallback, useEffect, type ReactNode } from 'react'
import { useSettings } from '../lib/settings-context'
import { I18nContext, translate, type MessageKey, type Vars } from './context'

export function I18nProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings()
  const lang = settings.lang

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const t = useCallback((key: MessageKey, vars?: Vars) => translate(lang, key, vars), [lang])
  return <I18nContext.Provider value={t}>{children}</I18nContext.Provider>
}
