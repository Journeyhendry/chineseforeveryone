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

/** Smallest balloon text the scenes may use, in cqw (percent of the scene width). */
export const MIN_BUBBLE_FONT = 3.2
/** Largest balloon text, so short words in big balloons stay calm. */
export const MAX_BUBBLE_FONT = 6.2
/** Share of the balloon width / height the text may fill, and the line height. */
const FILL_W = 0.86
const FILL_H = 0.72
const LINE_H = 1.18

const BREAK_AFTER = /[，。！？、；：…—]/u
const NO_LINE_START = /[，。！？、；：…—）」』”]/u

/** Where to split text into two lines: after punctuation near the middle, never inside `keep`. */
function breakPoint(chars: string[], keep: string): number {
  const n = chars.length
  const text = chars.join('')
  const inside = (i: number) => {
    if (!keep) return false
    for (let at = text.indexOf(keep); at >= 0; at = text.indexOf(keep, at + 1)) {
      const s = [...text.slice(0, at)].length
      if (i > s && i < s + [...keep].length) return true
    }
    return false
  }
  let best = -1
  let bestScore = Infinity
  for (let i = 1; i < n; i++) {
    if (NO_LINE_START.test(chars[i]) || inside(i)) continue
    const longest = Math.max(i, n - i)
    const punct = BREAK_AFTER.test(chars[i - 1])
    // a break after punctuation may make a line up to 2 characters longer than an even split
    const score = longest - (punct ? 2.1 : 0)
    if (score < bestScore) {
      bestScore = score
      best = i
    }
  }
  return best
}

export interface BubbleTextLayout {
  lines: string[]
  /** font size in cqw */
  font: number
}

/**
 * Lays out balloon text in a w x h box (percent of the scene width / height; the scene is 4:3): one
 * line, or two when that gives bigger letters. Line breaks never split `keep` (the learned word).
 */
export function layoutBubbleText(text: string, wPct: number, hPct: number, keep = ''): BubbleTextLayout {
  const chars = [...text]
  const n = Math.max(1, chars.length)
  const innerW = wPct * FILL_W
  const innerH = hPct * 0.75 * FILL_H
  const one = Math.min(innerH / LINE_H, innerW / n)
  let best: BubbleTextLayout = { lines: [text], font: one }
  if (chars.length >= 4) {
    const at = breakPoint(chars, keep)
    if (at > 0) {
      const lines = [chars.slice(0, at).join(''), chars.slice(at).join('')]
      const longest = Math.max(at, chars.length - at)
      const two = Math.min(innerH / (2 * LINE_H), innerW / longest)
      if (two > one * 1.04) best = { lines, font: two }
    }
  }
  return { lines: best.lines, font: Math.round(Math.min(MAX_BUBBLE_FONT, best.font) * 100) / 100 }
}
