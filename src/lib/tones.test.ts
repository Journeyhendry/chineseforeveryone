import { describe, expect, it } from 'vitest'
import { charTones, syllableColors, toneBadge } from './tones'

describe('charTones', () => {
  it('妈妈: huruf ke-i = suku kata ke-i', () => {
    expect(charTones('妈妈', ['mā', 'ma'])).toEqual([1, 5])
  })
  it('一块儿: 儿 memakai nada sebelumnya', () => {
    expect(charTones('一块儿', ['yī', 'kuài', 'r'])).toEqual([1, 4, 4])
  })
  it('好玩儿', () => {
    expect(charTones('好玩儿', ['hǎo', 'wán', 'r'])).toEqual([3, 2, 2])
  })
  it('一下儿 (juga bila r menempel di suku kata)', () => {
    expect(charTones('一下儿', ['yī', 'xià', 'r'])).toEqual([1, 4, 4])
    expect(charTones('一下儿', ['yí', 'xiàr'])).toEqual([2, 4, 4])
  })
  it('jumlah tidak cocok -> tidak diwarnai', () => {
    expect(charTones('你好吗', ['nǐ', 'hǎo'])).toEqual([null, null, null])
    expect(charTones('儿', ['ér'])).toEqual([2])
  })
})

describe('syllableColors', () => {
  it('r erhua ikut nada sebelumnya', () => {
    expect(syllableColors(['yī', 'kuài', 'r'])).toEqual([1, 4, 4])
    expect(syllableColors(['mā', 'ma'])).toEqual([1, 5])
  })
})

describe('toneBadge', () => {
  it('menyembunyikan pinyin bila showPinyin mati', () => {
    expect(toneBadge('wǒ', true)).toEqual({ pinyin: 'wǒ', tone: 3 })
    expect(toneBadge('wǒ', false)).toEqual({ pinyin: null, tone: 3 })
    expect(toneBadge('ma', false)).toEqual({ pinyin: null, tone: 5 })
  })
})
