import { describe, expect, it } from 'vitest'
import { sanitizeSvg, splitHighlight } from './scene-svg'

describe('sanitizeSvg', () => {
  it('keeps a plain SVG unchanged', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><g class="char"><path d="M0 0L5 5"/></g></svg>'
    expect(sanitizeSvg(svg)).toBe(svg)
  })

  it('removes scripts, foreignObject, style and event handlers', () => {
    const svg =
      '<svg viewBox="0 0 1 1" onload="alert(1)"><script>alert(2)</script><script src="x.js"/><foreignObject><div>x</div></foreignObject><style>*{}</style><g onclick=\'evil()\' class="a"><rect onmouseover=evil width="1"/></g></svg>'
    const out = sanitizeSvg(svg) as string
    expect(out).not.toMatch(/script|foreignObject|style|onload|onclick|onmouseover|alert|evil/i)
    expect(out).toContain('<g class="a">')
    expect(out).toContain('<rect width="1"/>')
  })

  it('drops external links and images but keeps fragment links', () => {
    const out = sanitizeSvg('<svg><image href="http://x/y.png"/><a href="javascript:alert(1)"><use href="#body"/></a><use href="http://x#y"/></svg>') as string
    expect(out).not.toMatch(/image|http|javascript/)
    expect(out).toContain('<use href="#body"/>')
  })

  it('rejects anything that is not an SVG document', () => {
    expect(sanitizeSvg('<html><body>hi</body></html>')).toBeNull()
    expect(sanitizeSvg('<!doctype html><svg></svg>')).toBeNull()
    expect(sanitizeSvg('not found')).toBeNull()
    expect(sanitizeSvg('<svg viewBox="0 0 1 1">')).toBeNull()
    expect(sanitizeSvg('')).toBeNull()
  })
})

describe('splitHighlight', () => {
  it('marks every occurrence of the word', () => {
    expect(splitHighlight('你好，你们好', '你')).toEqual([
      { text: '你', hl: true },
      { text: '好，', hl: false },
      { text: '你', hl: true },
      { text: '们好', hl: false },
    ])
  })
  it('returns the plain text when the word is absent', () => {
    expect(splitHighlight('好！', '我')).toEqual([{ text: '好！', hl: false }])
  })
})
