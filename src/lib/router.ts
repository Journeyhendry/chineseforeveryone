import { useEffect, useSyncExternalStore } from 'react'

export const ROUTES = ['belajar', 'ulang', 'kamus', 'progres', 'pengaturan'] as const
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
