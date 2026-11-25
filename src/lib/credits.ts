// Pengurai Markdown sangat kecil untuk CREDITS.md. Hasilnya struktur data (bukan HTML), supaya
// halaman Sumber bisa dirender sebagai elemen React tanpa dangerouslySetInnerHTML.
import { REPO_URL } from './dictionary.ts'

export type Inline =
  | { type: 'text'; text: string }
  | { type: 'bold'; children: Inline[] }
  | { type: 'code'; text: string }
  | { type: 'link'; href: string; children: Inline[] }

export interface ListItem {
  children: Inline[]
  /** Daftar bersarang satu tingkat (baris yang menjorok). */
  sub: Inline[][]
}

export type Block =
  | { type: 'heading'; level: 1 | 2 | 3; children: Inline[] }
  | { type: 'paragraph'; children: Inline[] }
  | { type: 'list'; items: ListItem[] }

/**
 * Alamat tautan yang aman: http(s) dan mailto dipakai apa adanya; alamat relatif (file di repo)
 * diubah menjadi tautan GitHub; selain itu (javascript:, data:, //host, #anchor, ...) null.
 */
export function safeHref(url: string): string | null {
  const u = url.trim()
  // eslint-disable-next-line no-control-regex
  if (!u || /[\s\u0000-\u001f\\]/.test(u)) return null
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(u)
  if (scheme) return ['http', 'https', 'mailto'].includes(scheme[1].toLowerCase()) ? u : null
  if (u.startsWith('//') || u.startsWith('#') || u.startsWith('?')) return null
  const path = u.replace(/^(\.\/)+/, '').replace(/^\/+/, '')
  if (!path || path.split('/').some((seg) => seg === '..')) return null
  return `${REPO_URL}/blob/main/${encodeURI(path)}`
}

const text = (t: string): Inline => ({ type: 'text', text: t })

function pushText(out: Inline[], t: string) {
  if (!t) return
  const last = out[out.length - 1]
  if (last?.type === 'text') last.text += t
  else out.push(text(t))
}

/** **tebal**, `kode`, [teks](url). Yang tidak dikenal tetap menjadi teks biasa. */
export function parseInline(src: string, allowLink = true): Inline[] {
  const out: Inline[] = []
  let i = 0
  while (i < src.length) {
    const c = src[i]
    if (c === '`') {
      const end = src.indexOf('`', i + 1)
      if (end > i + 1) {
        out.push({ type: 'code', text: src.slice(i + 1, end) })
        i = end + 1
        continue
      }
    } else if (c === '*' && src.startsWith('**', i)) {
      const end = src.indexOf('**', i + 2)
      if (end > i + 2) {
        out.push({ type: 'bold', children: parseInline(src.slice(i + 2, end), allowLink) })
        i = end + 2
        continue
      }
    } else if (c === '[' && allowLink) {
      // Penutup "]" yang seimbang, lalu "(url)".
      let depth = 0
      let close = -1
      for (let j = i; j < src.length; j++) {
        if (src[j] === '`') {
          const e = src.indexOf('`', j + 1)
          if (e > j) j = e
        } else if (src[j] === '[') depth++
        else if (src[j] === ']' && --depth === 0) {
          close = j
          break
        }
      }
      if (close > 0 && src[close + 1] === '(') {
        const end = src.indexOf(')', close + 2)
        if (end > 0) {
          const label = parseInline(src.slice(i + 1, close), false)
          const href = safeHref(src.slice(close + 2, end))
          if (href) out.push({ type: 'link', href, children: label })
          else {
            for (const n of label) {
              if (n.type === 'text') pushText(out, n.text)
              else out.push(n)
            }
          }
          i = end + 1
          continue
        }
      }
    }
    pushText(out, c)
    i++
  }
  return out
}

const HEADING = /^(#{1,3})\s+(.+?)\s*#*\s*$/
const BULLET = /^(\s*)[-*]\s+(.*)$/

/** Markdown kecil -> blok. Mendukung judul #/##/###, paragraf, daftar -/* (satu tingkat bersarang, baris lanjutan). */
export function parseCredits(md: string): Block[] {
  const blocks: Block[] = []
  let para: string[] = []
  // Butir daftar yang sedang dibaca; teks mentahnya di-parse setelah baris lanjutan digabung.
  let items: { main: string[]; subs: string[][] }[] = []
  let current: string[] | null = null

  const flushPara = () => {
    if (para.length) blocks.push({ type: 'paragraph', children: parseInline(para.join(' ')) })
    para = []
  }
  const flushList = () => {
    if (items.length) {
      blocks.push({
        type: 'list',
        items: items.map((r) => ({ children: parseInline(r.main.join(' ')), sub: r.subs.map((s) => parseInline(s.join(' '))) })),
      })
    }
    items = []
    current = null
  }

  for (const line of md.replace(/\r\n?/g, '\n').split('\n')) {
    if (!line.trim()) {
      flushPara()
      flushList()
      continue
    }
    const h = HEADING.exec(line)
    if (h) {
      flushPara()
      flushList()
      blocks.push({ type: 'heading', level: h[1].length as 1 | 2 | 3, children: parseInline(h[2]) })
      continue
    }
    const b = BULLET.exec(line)
    if (b) {
      flushPara()
      if (b[1].length >= 2 && items.length > 0) {
        current = [b[2]]
        items[items.length - 1].subs.push(current)
      } else {
        current = [b[2]]
        items.push({ main: current, subs: [] })
      }
      continue
    }
    if (current && /^\s+/.test(line)) {
      current.push(line.trim())
      continue
    }
    flushList()
    para.push(line.trim())
  }
  flushPara()
  flushList()
  return blocks
}

/** Teks polos dari inline (untuk tes dan label). */
export function inlineText(nodes: Inline[]): string {
  return nodes.map((n) => (n.type === 'text' || n.type === 'code' ? n.text : inlineText(n.children))).join('')
}
