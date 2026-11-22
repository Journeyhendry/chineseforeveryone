/** Minimal well-formedness check for generated SVG: balanced tags, quoted attributes, one root.
 * Used by the art tests (characters and scenes). Returns an error message or null. */
export function checkXml(src: string): string | null {
  const stack: string[] = []
  const re = /<(\/?)([A-Za-z][\w:-]*)((?:\s+[\w:-]+="[^"<]*")*)\s*(\/?)>/g
  let pos = 0
  let roots = 0
  for (let m = re.exec(src); m; m = re.exec(src)) {
    if (src.slice(pos, m.index).includes('<')) return `stray "<" before offset ${m.index}`
    pos = re.lastIndex
    const [, close, name, , self] = m
    if (close) {
      if (stack.pop() !== name) return `unexpected </${name}>`
    } else if (!self) {
      if (stack.length === 0) roots++
      stack.push(name)
    } else if (stack.length === 0) roots++
  }
  if (src.slice(pos).trim() !== '') return 'trailing content'
  if (stack.length) return `unclosed <${stack.at(-1)}>`
  return roots === 1 ? null : `${roots} root elements`
}
