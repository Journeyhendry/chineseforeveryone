import { describe, expect, it } from 'vitest'
import type { Example } from '../../lib/lessons'
import { otherExamples } from './text'

const ex = (tatoebaId: number, cmn: string) => ({ tatoebaId, cmn }) as Example

describe('otherExamples (task 6c: "More examples")', () => {
  it('leaves out the main sentence and the dialog lines, ignoring punctuation', () => {
    const examples = [ex(1, '你好！'), ex(2, '你好。'), ex(3, '你好吗？'), ex(4, '请进')]
    const sentence = { hanzi: '你好！请进！' } as never
    expect(otherExamples({ examples, sentence, dialog: null }).map((e) => e.tatoebaId)).toEqual([1, 2, 3, 4])
    const dialog = { reason: { id: '', en: '' }, lines: [{ hanzi: '你好！' }, { hanzi: '你好！请进！' }] } as never
    expect(otherExamples({ examples, sentence, dialog }).map((e) => e.tatoebaId)).toEqual([3, 4])
  })
})
