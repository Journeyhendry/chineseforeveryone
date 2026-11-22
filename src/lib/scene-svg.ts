// Word illustrations are SVG files from this repo (public/art/scenes/). They are inlined into the
// page so CSS can animate their parts; as a safety net, anything that could run code is removed
// and anything that is not a single <svg> document is rejected.

/** Returns a cleaned SVG string, or null when the input is not an SVG document. */
export function sanitizeSvg(src: string): string | null {
  const text = src.trim()
  if (!/^<svg[\s>]/i.test(text) || !/<\/svg>$/i.test(text)) return null
  let out = text
  // elements that can run code or pull in other documents
  out = out.replace(/<(script|foreignObject|iframe|object|embed|style)\b[\s\S]*?<\/\1\s*>/gi, '')
  out = out.replace(/<(script|foreignObject|iframe|object|embed|style|image|use)\b[^>]*\/?>/gi, (m, tag: string) =>
    tag.toLowerCase() === 'use' && /\shref="#[^"]*"/.test(m) && !/\son/i.test(m) ? m : '',
  )
  // event handler attributes (onload, onclick, ...)
  out = out.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
  // links to anything other than a fragment in the same document
  out = out.replace(/\s+(?:xlink:)?href\s*=\s*("(?!#)[^"]*"|'(?!#)[^']*')/gi, '')
  out = out.replace(/javascript:/gi, '')
  if (!/^<svg[\s>]/i.test(out)) return null
  return out
}

/** Splits balloon text around the learned word so it can be highlighted. */
export function splitHighlight(text: string, word: string): { text: string; hl: boolean }[] {
  if (!word || !text.includes(word)) return [{ text, hl: false }]
  const parts: { text: string; hl: boolean }[] = []
  let rest = text
  while (rest.length) {
    const i = rest.indexOf(word)
    if (i < 0) {
      parts.push({ text: rest, hl: false })
      break
    }
    if (i > 0) parts.push({ text: rest.slice(0, i), hl: false })
    parts.push({ text: word, hl: true })
    rest = rest.slice(i + word.length)
  }
  return parts
}
