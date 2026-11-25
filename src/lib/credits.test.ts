import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { inlineText, parseCredits, parseInline, safeHref, type Block, type Inline } from './credits'

const REPO = 'https://github.com/Journeyhendry/chineseforeveryone/blob/main/'

describe('safeHref', () => {
  it('http, https, mailto apa adanya', () => {
    expect(safeHref('https://a.b/c?d=1')).toBe('https://a.b/c?d=1')
    expect(safeHref('http://a.b')).toBe('http://a.b')
    expect(safeHref('mailto:x@y.z')).toBe('mailto:x@y.z')
  })

  it('relatif -> GitHub', () => {
    expect(safeHref('LICENSE')).toBe(`${REPO}LICENSE`)
    expect(safeHref('./public/hanzi/ARPHICPL.TXT')).toBe(`${REPO}public/hanzi/ARPHICPL.TXT`)
    expect(safeHref('/data/a b.json')).toBeNull()
  })

  it.each(['javascript:alert(1)', 'JavaScript:alert(1)', ' java\tscript:alert(1)', 'data:text/html,x', 'vbscript:x', '//evil.com', '#x', '../x', 'a/../../b', '', 'ftp://x'])(
    'tidak aman: %j',
    (u) => expect(safeHref(u)).toBeNull(),
  )
})

const flat = (n: Inline[]): Inline[] => n.flatMap((x) => (x.type === 'bold' || x.type === 'link' ? [x, ...flat(x.children)] : [x]))

describe('parseInline', () => {
  it('tebal, kode, tautan', () => {
    const r = parseInline('a **b** `c` [d](https://x.y) e')
    expect(r).toEqual([
      { type: 'text', text: 'a ' },
      { type: 'bold', children: [{ type: 'text', text: 'b' }] },
      { type: 'text', text: ' ' },
      { type: 'code', text: 'c' },
      { type: 'text', text: ' ' },
      { type: 'link', href: 'https://x.y', children: [{ type: 'text', text: 'd' }] },
      { type: 'text', text: ' e' },
    ])
  })

  it('kode di dalam teks tautan', () => {
    const r = parseInline('[`cedict-json`](https://github.com/x/y)')
    expect(r).toEqual([{ type: 'link', href: 'https://github.com/x/y', children: [{ type: 'code', text: 'cedict-json' }] }])
  })

  it('tautan javascript: jadi teks biasa', () => {
    const r = parseInline('[klik](javascript:alert(1)) selesai')
    expect(flat(r).some((n) => n.type === 'link')).toBe(false)
    expect(inlineText(r)).toContain('klik')
    expect(inlineText(r)).toContain('selesai')
  })

  it('tautan relatif jadi GitHub', () => {
    const r = parseInline('[LICENSE](LICENSE)')
    expect(r[0]).toMatchObject({ type: 'link', href: `${REPO}LICENSE` })
  })

  it('HTML mentah dan penanda tak lengkap tampil apa adanya', () => {
    expect(parseInline('<b>x</b> **a `b [c')).toEqual([{ type: 'text', text: '<b>x</b> **a `b [c' }])
  })
})

describe('parseCredits', () => {
  const md = `# Judul

Paragraf satu
lanjut **tebal**.

## Bagian

- butir **satu**: [a](https://a.b)
  lanjutan baris
- butir dua
  - anak \`kode\`
- butir tiga

### Kecil

* bintang
`
  const blocks = parseCredits(md)
  const kinds = blocks.map((b) => b.type)

  it('judul dan urutan blok', () => {
    expect(kinds).toEqual(['heading', 'paragraph', 'heading', 'list', 'heading', 'list'])
    expect(blocks.filter((b): b is Extract<Block, { type: 'heading' }> => b.type === 'heading').map((b) => [b.level, inlineText(b.children)])).toEqual([
      [1, 'Judul'],
      [2, 'Bagian'],
      [3, 'Kecil'],
    ])
  })

  it('paragraf menggabung baris', () => {
    expect(inlineText((blocks[1] as Extract<Block, { type: 'paragraph' }>).children)).toBe('Paragraf satu lanjut tebal.')
  })

  it('daftar: butir, baris lanjutan, anak, tebal, tautan', () => {
    const list = blocks[3] as Extract<Block, { type: 'list' }>
    expect(list.items).toHaveLength(3)
    expect(inlineText(list.items[0].children)).toBe('butir satu: a lanjutan baris')
    expect(flat(list.items[0].children).map((n) => n.type)).toContain('bold')
    expect(flat(list.items[0].children).map((n) => n.type)).toContain('link')
    expect(list.items[1].sub).toHaveLength(1)
    expect(list.items[1].sub[0]).toEqual([{ type: 'text', text: 'anak ' }, { type: 'code', text: 'kode' }])
    expect(inlineText((blocks[5] as Extract<Block, { type: 'list' }>).items[0].children)).toBe('bintang')
  })
})

describe('CREDITS.md asli', () => {
  const md = readFileSync(new URL('../../CREDITS.md', import.meta.url), 'utf8')
  const blocks = parseCredits(md)

  it('semua judul ## terbaca', () => {
    const want = [...md.matchAll(/^#{1,3}\s+(.+)$/gm)].map((m) => m[1].trim())
    const got = blocks.filter((b) => b.type === 'heading').map((b) => inlineText(b.children))
    expect(got).toEqual(want)
  })

  it('semua tautan aman dan ada tautan', () => {
    const links: string[] = []
    const walk = (nodes: Inline[]) => {
      for (const n of nodes) {
        if (n.type === 'link') {
          links.push(n.href)
          walk(n.children)
        } else if (n.type === 'bold') walk(n.children)
      }
    }
    for (const b of blocks) {
      if (b.type === 'list') b.items.forEach((i) => [i.children, ...i.sub].forEach(walk))
      else walk(b.children)
    }
    expect(links.length).toBeGreaterThan(0)
    for (const l of links) expect(l).toMatch(/^(https?:|mailto:)/)
    expect(links.join(' ')).not.toMatch(/javascript:/i)
  })
})
