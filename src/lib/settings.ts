export type Lang = 'id' | 'en'
export type ThemeSetting = 'system' | 'light' | 'dark'

export interface Settings {
  version: 1
  lang: Lang
  showPinyin: boolean
  voiceSpeed: 0.75 | 1
  soundEffects: boolean
  theme: ThemeSetting
}

export const SETTINGS_KEY = 'xue.settings.v1'

export const DEFAULT_SETTINGS: Settings = {
  version: 1,
  lang: 'id',
  showPinyin: true,
  voiceSpeed: 1,
  soundEffects: true,
  theme: 'system',
}

/** Pulihkan data apa pun (string JSON, objek, null) menjadi Settings yang valid, per kolom. */
export function normalizeSettings(raw: unknown): Settings {
  let data: unknown = raw
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw)
    } catch {
      return { ...DEFAULT_SETTINGS }
    }
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return { ...DEFAULT_SETTINGS }
  }
  const o = data as Record<string, unknown>
  const d = DEFAULT_SETTINGS
  return {
    version: 1,
    lang: o.lang === 'id' || o.lang === 'en' ? o.lang : d.lang,
    showPinyin: typeof o.showPinyin === 'boolean' ? o.showPinyin : d.showPinyin,
    voiceSpeed: o.voiceSpeed === 0.75 || o.voiceSpeed === 1 ? o.voiceSpeed : d.voiceSpeed,
    soundEffects: typeof o.soundEffects === 'boolean' ? o.soundEffects : d.soundEffects,
    theme:
      o.theme === 'system' || o.theme === 'light' || o.theme === 'dark' ? o.theme : d.theme,
  }
}

export function loadSettings(): Settings {
  try {
    return normalizeSettings(window.localStorage.getItem(SETTINGS_KEY))
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(s: Settings): void {
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
  } catch {
    /* localStorage tidak tersedia: pengaturan hanya berlaku di sesi ini */
  }
}

export function resolveTheme(theme: ThemeSetting, systemDark: boolean): 'light' | 'dark' {
  if (theme === 'system') return systemDark ? 'dark' : 'light'
  return theme
}
