import { describe, expect, it } from 'vitest'
import raw from '../../data/basics/basics.json'
import { BASICS_PARTS, type BasicsData } from './basics'
import { BASICS_QUIZ_LENGTH, buildBasicsQuiz, sandhiChoices, toneChoices, type BQuestion } from './basics-quiz'
import { syllableTone } from './pinyin'

const data = raw as unknown as BasicsData
const always = () => true
const never = () => false

function correctness(q: BQuestion) {
  const c = q.choices[q.answer]
  switch (q.kind) {
    case 'listen-pinyin':
    case 'read-pinyin':
      expect(c.type === 'pinyin' && c.text).toBe(q.reveal.pinyin)
      break
    case 'listen-tone':
    case 'read-tone':
      expect(c.type === 'tone' && c.tone).toBe(syllableTone(q.reveal.pinyin!))
      break
    case 'sandhi':
      expect(c.type === 'pinyin' && c.text).toBe(q.reveal.pinyin)
      break
    case 'stroke-name': {
      const s = data.strokes.basic.find((x) => x.example.char === q.prompt.stroke!.char && x.example.stroke === q.prompt.stroke!.index)!
      expect(c.type === 'stroke' && c.id).toBe(s.id)
      break
    }
    case 'stroke-first': {
      const e = data.strokes.rules.flatMap((r) => r.examples).find((x) => x.char === q.prompt.hanzi)!
      expect(c.type === 'stroke' && c.id).toBe(e.first)
      // pengecoh tidak boleh juga "benar"
      for (const o of q.choices) if (o !== c && o.type === 'stroke') expect(e.avoid ?? []).not.toContain(o.id)
      break
    }
    case 'radical-in': {
      const owner = data.radicals.items.find((r) => r.examples.some((e) => e.hanzi === q.prompt.hanzi))!
      const ex = owner.examples.find((e) => e.hanzi === q.prompt.hanzi)!
      expect(c.type === 'radical' && c.radical).toBe(owner.radical)
      for (const o of q.choices) if (o !== c && o.type === 'radical') expect([owner.radical, ...(ex.also ?? [])]).not.toContain(o.radical)
      break
    }
    case 'radical-meaning':
    case 'listen-meaning':
    case 'hanzi-meaning':
      expect(c.type === 'meaning' && c.meaning).toEqual(q.reveal.meaning)
      break
  }
}

describe('buildBasicsQuiz', () => {
  for (const part of BASICS_PARTS) {
    it(`${part}: ${BASICS_QUIZ_LENGTH} soal, 4 pilihan unik, tepat satu benar (banyak seed)`, () => {
      for (let seed = 1; seed <= 150; seed++) {
        for (const hasAudio of [always, never]) {
          const qs = buildBasicsQuiz(part, data, { seed, hasAudio })
          expect(qs).toHaveLength(BASICS_QUIZ_LENGTH)
          for (const q of qs) {
            expect(q.choices).toHaveLength(4)
            expect(new Set(q.choices.map((c) => c.key)).size).toBe(4)
            expect(q.answer).toBeGreaterThanOrEqual(0)
            expect(q.answer).toBeLessThan(4)
            correctness(q)
            if (hasAudio === never) expect(q.kind.startsWith('listen')).toBe(false)
            if (q.kind.startsWith('listen')) expect(q.audio).toBeDefined()
          }
        }
      }
    })
  }

  it('deterministik untuk seed yang sama', () => {
    for (const part of BASICS_PARTS) {
      expect(buildBasicsQuiz(part, data, { seed: 7, hasAudio: always })).toEqual(buildBasicsQuiz(part, data, { seed: 7, hasAudio: always }))
    }
  })

  it('perubahan nada memakai ketiga aturan', () => {
    const qs = buildBasicsQuiz('perubahan-nada', data, { seed: 3, hasAudio: always })
    const rules = new Set(qs.map((q) => data.sandhi.rules.find((r) => r.examples.some((e) => e.hanzi === q.prompt.hanzi))!.id))
    expect(rules).toEqual(new Set(['third', 'bu', 'yi']))
  })

  it('soal dengar tanpa suara diganti soal baca', () => {
    const kinds = new Set(BASICS_PARTS.flatMap((p) => buildBasicsQuiz(p, data, { seed: 1, hasAudio: never }).map((q) => q.kind)))
    expect([...kinds].filter((k) => k.startsWith('listen'))).toEqual([])
  })
})

describe('pilihan khusus', () => {
  it('nada: urut 1-4 dengan tanda di vokal yang benar', () => {
    expect(toneChoices('hǎo').map((c) => c.type === 'tone' && c.text)).toEqual(['hāo', 'háo', 'hǎo', 'hào'])
    expect(toneChoices('liù').map((c) => c.type === 'tone' && c.text)).toEqual(['liū', 'liú', 'liǔ', 'liù'])
  })

  it('perubahan nada: 4 cara baca, jawaban = yang diucapkan', () => {
    const ex = data.sandhi.rules[0].examples[0]
    const { choices, answer } = sandhiChoices(ex)
    expect(choices.map((c) => c.type === 'pinyin' && c.text)).toEqual(['nī hǎo', 'ní hǎo', 'nǐ hǎo', 'nì hǎo'])
    expect(answer).toBe(1)
  })
})
