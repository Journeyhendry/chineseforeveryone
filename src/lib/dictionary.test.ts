import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  buildDictionaryIndex,
  ISSUE_URL_MAX,
  issueUrl,
  normalizePinyin,
  searchDictionary,
  toneKey,
  type DictWord,
} from './dictionary'
import type { Tone } from './pinyin'
import type { UnitData } from './lesson-types'

describe('normalizePinyin', () => {
  it.each([
    ['nǐ', 'ni'],
    ['Nǐ Hǎo', 'nihao'],
    ['ni3 hao3', 'nihao'],
    ['xī\'ān', 'xian'],
    ['xi-an', 'xian'],
    ['lǜ', 'lü'],
    ['lv4', 'lü'],
    ['lu:4', 'lü'],
    ['nǚ', 'nü'],
    ['ǖ ǘ ǚ ǜ', 'üüüü'],
    ['ma', 'ma'],
    ['mā má mǎ mà', 'mamamama'],
    ['  ', ''],
  ])('%s -> %s', (a, b) => expect(normalizePinyin(a)).toBe(b))
})

describe('toneKey', () => {
  it.each([
    ['nǐhǎo', 'ni3hao3'],
    ['ni3 hao3', 'ni3hao3'],
    ['mā', 'ma1'],
    ['má', 'ma2'],
    ['mǎ', 'ma3'],
    ['mà', 'ma4'],
    ['xiè xie', 'xie4xie5'],
    ['ma', 'ma5'],
    ['ma5', 'ma5'],
    ['ne0', 'ne5'],
    ['nǚ', 'nü3'],
    ['nv3', 'nü3'],
    ['lu:4', 'lü4'],
    ["xī'ān", 'xi1an1'],
    ['xi1\'an1', 'xi1an1'],
    ['yìdiǎnr', 'yi4dian3r5'],
  ])('%s -> %s', (a, b) => expect(toneKey(a)).toBe(b))
})

let n = 0
function w(hanzi: string, pinyin: string, syllables: string[], tones: Tone[], en: string[], ind: string[], unitOrder = 1, indexInUnit = ++n): DictWord {
  return { id: `L1-${String(indexInUnit).padStart(4, '0')}${unitOrder}`, hanzi, pinyin, syllables, tones, en, ind, unitId: `u0${unitOrder}`, unitOrder, indexInUnit }
}

const WORDS: DictWord[] = [
  w('呢', 'ne', ['ne'], [5], ['modal particle'], ['partikel tanya'], 2, 1),
  w('你好', 'nǐhǎo', ['nǐ', 'hǎo'], [3, 3], ['hello; hi'], ['halo', 'hai (salam)'], 1, 2),
  w('你', 'nǐ', ['nǐ'], [3], ['you (informal, as opposed to courteous 您[nin2])'], ['kamu', 'engkau'], 1, 1),
  w('泥', 'ní', ['ní'], [2], ['mud'], ['lumpur'], 3, 1),
  w('老师', 'lǎoshī', ['lǎo', 'shī'], [3, 1], ['teacher'], ['guru'], 1, 3),
  w('谢谢', 'xièxie', ['xiè', 'xie'], [4, 5], ['to thank', 'thanks'], ['terima kasih'], 1, 4),
  w('西安', "xī'ān", ['xī', 'ān'], [1, 1], ['Xi\'an'], ['Xi\'an'], 2, 2),
  w('女', 'nǚ', ['nǚ'], [3], ['female'], ['perempuan'], 2, 3),
  w('绿', 'lǜ', ['lǜ'], [4], ['green'], ['hijau'], 2, 4),
  w('吗', 'ma', ['ma'], [5], ['question particle'], ['partikel tanya'], 2, 5),
  w('妈妈', 'māma', ['mā', 'ma'], [1, 5], ['mom'], ['ibu'], 2, 6),
]
const index = buildDictionaryIndex(WORDS)
const find = (q: string, lang: 'id' | 'en' = 'id', limit?: number) => searchDictionary(index, q, lang, limit)
const hanzis = (q: string, lang: 'id' | 'en' = 'id') => find(q, lang).map((r) => r.word.hanzi)

describe('searchDictionary (data kecil)', () => {
  it('query kosong -> []', () => {
    expect(find('')).toEqual([])
    expect(find('   ')).toEqual([])
  })

  it('hanzi: persis dulu, lalu awalan', () => {
    expect(hanzis('你')).toEqual(['你', '你好'])
    expect(find('你')[0].matchedBy).toBe('hanzi')
    expect(hanzis('你好')).toEqual(['你好'])
  })

  it('hanzi: tanpa cocok penuh -> kata yang termuat di query, lalu yang berbagi huruf', () => {
    expect(hanzis('你好吗')).toEqual(['你好', '你', '吗'])
    expect(hanzis('好')).toEqual(['你好'])
    expect(hanzis('师生')).toEqual(['老师'])
  })

  it('pinyin tanpa nada cocok semua nada', () => {
    const r = hanzis('ni')
    expect(r.slice(0, 3)).toEqual(['你', '泥', '你好'])
    expect(r).not.toContain('呢')
  })

  it('pinyin bernada: nǐ / ni3 hanya nada 3', () => {
    for (const q of ['nǐ', 'ni3', 'NI3']) {
      const r = hanzis(q)
      expect(r[0]).toBe('你')
      expect(r).toContain('你好')
      expect(r).not.toContain('呢')
      expect(r).not.toContain('泥')
    }
    expect(hanzis('ní')).toEqual(['泥'])
    expect(hanzis('ne')).toContain('呢')
  })

  it('nada ringan: 5 atau 0', () => {
    expect(hanzis('ma5')).toEqual(['吗', '妈妈'])
    expect(hanzis('ma0')).toEqual(['吗', '妈妈'])
    expect(hanzis('xie5')).toEqual(['谢谢'])
  })

  it('nihao / ni hao / ni3hao3 / nǐhǎo -> 你好', () => {
    for (const q of ['nihao', 'ni hao', 'ni3hao3', 'ni3 hao3', 'nǐhǎo', 'Nǐ Hǎo']) expect(hanzis(q)[0], q).toBe('你好')
    expect(hanzis('ni2hao3')).toEqual([])
  })

  it('nada campur: nǐ hao', () => {
    expect(hanzis('nǐ hao')[0]).toBe('你好')
    expect(hanzis('ní hao')).toEqual([])
  })

  it('apostrof, ü, v', () => {
    expect(hanzis("xi'an")[0]).toBe('西安')
    expect(hanzis('xian')[0]).toBe('西安')
    expect(hanzis('nv')[0]).toBe('女')
    expect(hanzis('lu:4')[0]).toBe('绿')
    expect(hanzis('lǜ')).toEqual(['绿'])
  })

  it('arti: EN dan ID, tidak peka huruf besar dan tanda baca', () => {
    expect(hanzis('teacher')[0]).toBe('老师')
    expect(hanzis('guru')[0]).toBe('老师')
    expect(hanzis('HALO')[0]).toBe('你好')
    expect(find('HALO')[0].matchedBy).toBe('meaning')
    expect(hanzis('salam')).toContain('你好')
    expect(hanzis('hello!')[0]).toBe('你好')
    expect(hanzis('terima  kasih')[0]).toBe('谢谢')
    expect(hanzis('thank')).toEqual(['谢谢'])
  })

  it('arti bahasa aktif lebih dulu bila skor sama', () => {
    // "partikel tanya" (ID) vs "question particle" (EN): hanya soal urutan, bukan hasil.
    const a = hanzis('particle', 'en')
    const b = searchDictionary(buildDictionaryIndex([w('甲', 'jiǎ', ['jiǎ'], [3], ['spot'], ['bintik'], 1, 90), w('乙', 'yǐ', ['yǐ'], [3], ['dot'], ['spot'], 1, 91)]), 'spot', 'en').map((r) => r.word.hanzi)
    const c = searchDictionary(buildDictionaryIndex([w('甲', 'jiǎ', ['jiǎ'], [3], ['spot'], ['bintik'], 1, 90), w('乙', 'yǐ', ['yǐ'], [3], ['dot'], ['spot'], 1, 91)]), 'spot', 'id').map((r) => r.word.hanzi)
    expect(a.length).toBeGreaterThan(0)
    expect(b).toEqual(['甲', '乙'])
    expect(c).toEqual(['乙', '甲'])
  })

  it('tidak ada hasil', () => {
    expect(find('zzzz')).toEqual([])
    expect(find('鼠')).toEqual([])
  })

  it('urutan stabil (unit lalu urutan kata) dan tanpa duplikat', () => {
    expect(hanzis('ni')).toEqual(hanzis('ni'))
    const shuffled = buildDictionaryIndex([...WORDS].reverse())
    expect(searchDictionary(shuffled, 'ma', 'id')).toEqual(find('ma'))
    for (const q of ['a', 'n', 'ni', 'particle', '你', 'e']) {
      const ids = find(q).map((r) => r.word.id)
      expect(new Set(ids).size, q).toBe(ids.length)
    }
  })

  it('limit', () => {
    expect(find('a', 'id', 2)).toHaveLength(2)
    expect(find('a', 'id', 0)).toEqual([])
  })
})

describe('semua kata HSK 1 dapat ditemukan', () => {
  const dir = new URL('../../public/data/hsk1/units/', import.meta.url)
  const units = readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(new URL(f, dir), 'utf8')) as UnitData)
    .sort((a, b) => a.unit.order - b.unit.order)
  const all: DictWord[] = units.flatMap((u) =>
    u.words.map((x, i) => ({ ...x, unitId: u.unit.id, unitOrder: u.unit.order, indexInUnit: i + 1 })),
  )
  const idx = buildDictionaryIndex(all)

  it('data termuat', () => expect(all.length).toBeGreaterThan(0))

  it('lewat hanzi sendiri (persis di urutan pertama)', () => {
    for (const x of all) {
      const r = searchDictionary(idx, x.hanzi, 'id', 500)
      expect(r.some((y) => y.word.id === x.id), x.hanzi).toBe(true)
      expect(r[0].word.hanzi, x.hanzi).toBe(x.hanzi)
    }
  })

  it('lewat pinyin tanpa nada, dengan nada, dan angka nada', () => {
    for (const x of all) {
      for (const q of [normalizePinyin(x.pinyin), x.pinyin, toneKey(x.pinyin)]) {
        const r = searchDictionary(idx, q, 'id', 1000)
        expect(r.some((y) => y.word.id === x.id), `${x.hanzi} ${q}`).toBe(true)
      }
    }
  })

  it('nada tegas: toneKey tidak memuat kata dengan nada lain di posisi atas', () => {
    const q = searchDictionary(idx, 'ni3', 'id')
    expect(q.length).toBeGreaterThan(0)
    for (const r of q) expect(r.word.tones.includes(3) || r.word.syllables.some((s) => normalizePinyin(s).startsWith('ni')), r.word.hanzi).toBe(true)
    expect(q.find((r) => r.word.hanzi === '呢')).toBeUndefined()
  })
})

describe('issueUrl', () => {
  const word = { id: 'L1-0517', hanzi: '你好', pinyin: 'nǐhǎo', en: ['hello; hi'], ind: ['halo', 'hai (salam)'], unitId: 'u01', unitOrder: 1 }
  const make = (over = {}) => issueUrl({ word, context: 'Kamus', pageUrl: 'https://example.org/chineseforeveryone/#/kamus/L1-0517', lang: 'id', ...over })

  it('domain dan path benar, tanpa label', () => {
    const u = new URL(make())
    expect(u.origin).toBe('https://github.com')
    expect(u.pathname).toBe('/Journeyhendry/chineseforeveryone/issues/new')
    expect(u.searchParams.has('labels')).toBe(false)
  })

  it('judul berisi hanzi dan pinyin; body berisi id kata dan bagian "Apa yang salah?"', () => {
    const u = new URL(make())
    expect(u.searchParams.get('title')).toBe('Lapor salah: 你好 (nǐhǎo)')
    const body = u.searchParams.get('body') ?? ''
    expect(body).toContain('L1-0517')
    expect(body).toContain('halo; hai (salam)')
    expect(body).toContain('hello; hi')
    expect(body).toContain('Kamus')
    expect(body).toContain('#/kamus/L1-0517')
    expect(body).toContain('Apa yang salah?')
    expect(body).toContain('u01')
  })

  it('bahasa Inggris', () => {
    const u = new URL(make({ lang: 'en' }))
    expect(u.searchParams.get('title')).toBe('Report a mistake: 你好 (nǐhǎo)')
    expect(u.searchParams.get('body')).toContain('What is wrong?')
  })

  it('ter-encode: tidak ada spasi, baris baru, atau hanzi mentah', () => {
    const s = make()
    expect(s).not.toMatch(/[\s\n你好]/)
    expect(s).toContain('%E4%BD%A0')
  })

  it('tanpa kata: judul dari konteks', () => {
    const u = new URL(issueUrl({ context: 'Sumber', pageUrl: 'https://x.y/#/sumber', lang: 'id' }))
    expect(u.searchParams.get('title')).toBe('Lapor salah: Sumber')
  })

  it('panjang dibatasi', () => {
    const long = 'x'.repeat(3000)
    const s = make({ word: { ...word, en: [long], ind: [long] }, pageUrl: `https://example.org/#/kamus/${'a'.repeat(2000)}` })
    expect(s.length).toBeLessThan(ISSUE_URL_MAX)
    expect(new URL(s).searchParams.get('body')).toContain('L1-0517')
    const huge = make({ pageUrl: 'https://example.org/' + 'a'.repeat(20000) })
    expect(huge.length).toBeLessThan(ISSUE_URL_MAX)
    expect(new URL(huge).searchParams.get('body')).toContain('L1-0517')
  })
})

describe('arti utama lebih dulu', () => {
  it('seri skor: arti pertama mengalahkan urutan unit', () => {
    const idx = buildDictionaryIndex([
      w('甲', 'jiǎ', ['jiǎ'], [3], ['mister', 'teacher'], ['tuan'], 1, 70),
      w('乙', 'yǐ', ['yǐ'], [3], ['teacher'], ['guru'], 2, 71),
    ])
    expect(searchDictionary(idx, 'teacher', 'en').map((r) => r.word.hanzi)).toEqual(['乙', '甲'])
  })
})

describe('seri skor: kata dengan sedikit arti lebih dulu', () => {
  it('老师 (1 arti) sebelum 先生 (banyak arti) untuk "teacher"', () => {
    const idx = buildDictionaryIndex([
      w('先生', 'xiānsheng', ['xiān', 'sheng'], [1, 5], ['teacher', 'mister', 'husband'], ['tuan'], 1, 80),
      w('老师', 'lǎoshī', ['lǎo', 'shī'], [3, 1], ['teacher'], ['guru'], 1, 81),
    ])
    expect(searchDictionary(idx, 'teacher', 'id').map((r) => r.word.hanzi)).toEqual(['老师', '先生'])
  })
})

describe('query dengan ü hanya dicari sebagai pinyin', () => {
  const idx = buildDictionaryIndex([
    w('绿', 'lǜ', ['lǜ'], [4], ['green'], ['hijau'], 1, 60),
    w('外', 'wài', ['wài'], [4], ['outside'], ['luar'], 1, 61),
    w('女', 'nǚ', ['nǚ'], [3], ['female'], ['perempuan'], 1, 62),
  ])
  const h = (q: string) => searchDictionary(idx, q, 'id').map((r) => r.word.hanzi)
  it.each(['lü', 'lu:', 'LÜ'])('%s tidak cocok arti "luar"', (q) => {
    expect(h(q)).toEqual(['绿'])
  })
  it('nv tetap menemukan 女', () => expect(h('nv')).toContain('女'))
})
