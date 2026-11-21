import { describe, expect, it } from 'vitest'
import { normalizeNumbered, splitSyllables, stripTones, syllableTone, toNumbered, toNumberedString } from './pinyin.ts'

describe('splitSyllables', () => {
  it('splits two syllables', () => expect(splitSyllables('àihào')).toEqual(['ài', 'hào']))
  it('splits a single syllable', () => expect(splitSyllables('bā')).toEqual(['bā']))
  it('handles the apostrophe', () => expect(splitSyllables("xī'ān")).toEqual(['xī', 'ān']))
  it('handles ü with apostrophe and er', () => expect(splitSyllables("nǚ'ér")).toEqual(['nǚ', 'ér']))
  it('handles neutral tone', () => expect(splitSyllables('péngyou')).toEqual(['péng', 'you']))
  it('splits erhua r as its own syllable', () => expect(splitSyllables('yìdiǎnr')).toEqual(['yì', 'diǎn', 'r']))
  it('splits erhua after vowel', () => expect(splitSyllables('nǎr')).toEqual(['nǎ', 'r']))
  it('handles er as syllable before consonant', () => expect(splitSyllables('érzi')).toEqual(['ér', 'zi']))
  it('handles three+ syllables', () => expect(splitSyllables('túshūguǎn')).toEqual(['tú', 'shū', 'guǎn']))
  it('handles four syllables', () => expect(splitSyllables('diànshìjī')).toEqual(['diàn', 'shì', 'jī']))
  it('handles zh/ch/sh and ng', () => expect(splitSyllables('zhōngguó')).toEqual(['zhōng', 'guó']))
  it('handles ng followed by a g-syllable', () => expect(splitSyllables('dōnggāng')).toEqual(['dōng', 'gāng']))
  it('handles n before y/w', () => expect(splitSyllables('xīnyǒu')).toEqual(['xīn', 'yǒu']))
  it('keeps capital letters', () => expect(splitSyllables('Běijīng')).toEqual(['Běi', 'jīng']))
  it('treats spaces and hyphens as separators', () => expect(splitSyllables('dì-èr  bù dà')).toEqual(['dì', 'èr', 'bù', 'dà']))
  it('handles v as ü', () => expect(splitSyllables('nüren')).toEqual(['nü', 'ren']))
  it('returns [] for empty input', () => expect(splitSyllables('')).toEqual([]))
})

describe('syllableTone', () => {
  it.each([
    ['mā', 1],
    ['má', 2],
    ['mǎ', 3],
    ['mà', 4],
    ['ma', 5],
    ['nǚ', 3],
    ['lǜ', 4],
    ['r', 5],
    ['Běi', 3],
  ] as const)('%s -> %i', (s, t) => expect(syllableTone(s)).toBe(t))
})

describe('toNumbered', () => {
  it('converts marks to digits', () => expect(toNumbered('ài')).toBe('ai4'))
  it('writes ü as v', () => {
    expect(toNumbered('lǜ')).toBe('lv4')
    expect(toNumbered('nǚ')).toBe('nv3')
  })
  it('uses 5 for neutral tone', () => expect(toNumbered('ma')).toBe('ma5'))
  it('keeps case', () => expect(toNumbered('Běi')).toBe('Bei3'))
  it('handles the erhua r', () => expect(toNumbered('r')).toBe('r5'))
  it('converts a whole word', () => expect(toNumberedString("nǚ'ér")).toBe('nv3 er2'))
  it('converts a long word', () => expect(toNumberedString('yìdiǎnr')).toBe('yi4 dian3 r5'))
})

describe('stripTones', () => {
  it('removes tone marks', () => expect(stripTones('àihào')).toBe('aihao'))
  it('keeps ü', () => expect(stripTones('nǚ')).toBe('nü'))
  it('removes marks on ǘ', () => expect(stripTones('lǘ')).toBe('lü'))
})

describe('normalizeNumbered', () => {
  it('maps u: to v and lowercases', () => expect(normalizeNumbered('Nu:3 er2')).toBe('nv3 er2'))
})
