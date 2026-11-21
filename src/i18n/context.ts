import { createContext, useContext } from 'react'
import id from './id.json'
import en from './en.json'
import type { Lang } from '../lib/settings'

export type MessageKey = keyof typeof id
export type Vars = Record<string, string | number>
export type TFunction = (key: MessageKey, vars?: Vars) => string

export const dictionaries: Record<Lang, Record<string, string>> = { id, en }

export function translate(lang: Lang, key: string, vars?: Vars): string {
  const msg = dictionaries[lang][key]
  if (msg === undefined) {
    if (import.meta.env.DEV) console.warn(`[i18n] kunci hilang (${lang}): ${key}`)
    return key
  }
  if (!vars) return msg
  return msg.replace(/\{(\w+)\}/g, (m, name: string) =>
    name in vars ? String(vars[name]) : m,
  )
}

export const I18nContext = createContext<TFunction>((key, vars) => translate('id', key, vars))

export function useT(): TFunction {
  return useContext(I18nContext)
}
