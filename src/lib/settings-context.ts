import { createContext, useContext } from 'react'
import { DEFAULT_SETTINGS, type Settings } from './settings'

export interface SettingsContextValue {
  settings: Settings
  update: (patch: Partial<Omit<Settings, 'version'>>) => void
  /** Ganti seluruh pengaturan (pemulihan cadangan). */
  replace: (next: Settings) => void
}

export const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  update: () => {},
  replace: () => {},
})

export function useSettings(): SettingsContextValue {
  return useContext(SettingsContext)
}
