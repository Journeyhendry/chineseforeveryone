import { useEffect, useSyncExternalStore } from 'react'

export const ROUTES = ['belajar', 'ulang', 'kamus', 'progres', 'pengaturan', 'sumber'] as const
export type RouteName = (typeof ROUTES)[number] | 'notfound'

export interface Route {
  name: RouteName
  /** Parameter dari query string, mis. `#/kamus?q=ni` -> { q: 'ni' } */
  params: Record<string, string>
  /** Segmen setelah nama rute, mis. `#/belajar/unit/3` -> ['unit', '3'] */
  segments: string[]
}

export const DEFAULT_ROUTE: RouteName = 'belajar'

export function isRouteName(s: string): s is (typeof ROUTES)[number] {
  return (ROUTES as readonly string[]).includes(s)
}

export function parseHash(hash: string): Route {
  let h = hash.startsWith('#') ? hash.slice(1) : hash
  let query = ''
  const q = h.indexOf('?')
  if (q >= 0) {
    query = h.slice(q + 1)
    h = h.slice(0, q)
  }
  const parts = h
    .split('/')
    .filter(Boolean)
    .map((p) => {
      try {
        return decodeURIComponent(p)
      } catch {
        return p
      }
    })
  const params: Record<string, string> = {}
  for (const [k, v] of new URLSearchParams(query)) params[k] = v
  if (parts.length === 0) return { name: DEFAULT_ROUTE, params, segments: [] }
  const first = parts[0].toLowerCase()
  if (isRouteName(first)) return { name: first, params, segments: parts.slice(1) }
  return { name: 'notfound', params, segments: parts }
}

export function hrefFor(name: (typeof ROUTES)[number]): string {
  return `#/${name}`
}

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}

const getHash = () => window.location.hash
const getServerHash = () => ''

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, getHash, getServerHash)
  const emptyHash = hash === '' || hash === '#' || hash === '#/'
  useEffect(() => {
    if (emptyHash) {
      window.location.replace(
        `${window.location.pathname}${window.location.search}#/${DEFAULT_ROUTE}`,
      )
    }
  }, [emptyHash])
  return parseHash(hash)
}

// ---------- sub-rute Belajar ----------

export type LearnRoute =
  | { screen: 'map' }
  | { screen: 'unit'; unitId: string }
  | { screen: 'word'; unitId: string; index: number }
  | { screen: 'practice'; unitId: string }
  | { screen: 'skip'; unitId: string }
  | { screen: 'notfound' }

const UNIT_SEGMENT = /^[a-z0-9-]{1,32}$/

/** Segmen setelah `#/belajar`: [], unit/<id>, unit/<id>/kata/<n> (mulai 1), unit/<id>/latihan, loncat/<id>. */
export function parseLearnRoute(segments: string[]): LearnRoute {
  const s = segments.map((x) => x.toLowerCase())
  if (s.length === 0) return { screen: 'map' }
  const id = s[1]
  if (id === undefined || !UNIT_SEGMENT.test(id)) return { screen: 'notfound' }
  if (s[0] === 'unit') {
    if (s.length === 2) return { screen: 'unit', unitId: id }
    if (s.length === 3 && s[2] === 'latihan') return { screen: 'practice', unitId: id }
    if (s.length === 4 && s[2] === 'kata' && /^[1-9]\d{0,2}$/.test(s[3])) {
      return { screen: 'word', unitId: id, index: Number(s[3]) }
    }
  }
  if (s[0] === 'loncat' && s.length === 2) return { screen: 'skip', unitId: id }
  return { screen: 'notfound' }
}

export function learnHref(route: LearnRoute): string {
  switch (route.screen) {
    case 'map':
    case 'notfound':
      return '#/belajar'
    case 'unit':
      return `#/belajar/unit/${route.unitId}`
    case 'word':
      return `#/belajar/unit/${route.unitId}/kata/${route.index}`
    case 'practice':
      return `#/belajar/unit/${route.unitId}/latihan`
    case 'skip':
      return `#/belajar/loncat/${route.unitId}`
  }
}

// ---------- sub-rute Ulang ----------

export type ReviewRoute = { screen: 'home' } | { screen: 'session' } | { screen: 'notfound' }

/** Segmen setelah `#/ulang`: [] = beranda ulangan, ['sesi'] = sesi berjalan. */
export function parseReviewRoute(segments: string[]): ReviewRoute {
  if (segments.length === 0) return { screen: 'home' }
  if (segments.length === 1 && segments[0].toLowerCase() === 'sesi') return { screen: 'session' }
  return { screen: 'notfound' }
}

export const REVIEW_HOME = '#/ulang'
export const REVIEW_SESSION = '#/ulang/sesi'

// ---------- sub-rute Kamus ----------

export type DictionaryRoute =
  | { screen: 'search'; q: string }
  | { screen: 'word'; wordId: string; q: string }
  | { screen: 'notfound' }

const WORD_ID = /^L1-[A-Za-z0-9]{1,16}$/i

/**
 * Segmen setelah `#/kamus` (+ parameter query): [] = pencarian (`?q=...`), [<wordId>] = detail kata
 * (`?q=...` dipertahankan supaya tautan kembali ke hasil pencarian).
 */
export function parseDictionaryRoute(segments: string[], params: Record<string, string> = {}): DictionaryRoute {
  const q = params.q ?? ''
  if (segments.length === 0) return { screen: 'search', q }
  if (segments.length === 1 && WORD_ID.test(segments[0])) return { screen: 'word', wordId: segments[0].toUpperCase(), q }
  return { screen: 'notfound' }
}

export function dictionaryHref(route: DictionaryRoute): string {
  switch (route.screen) {
    case 'search':
      return route.q ? `#/kamus?q=${encodeURIComponent(route.q)}` : '#/kamus'
    case 'word':
      return `#/kamus/${route.wordId}${route.q ? `?q=${encodeURIComponent(route.q)}` : ''}`
    case 'notfound':
      return '#/kamus'
  }
}
