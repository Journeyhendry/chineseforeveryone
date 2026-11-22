import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, normalizeSettings, resolveTheme } from './settings'

describe('normalizeSettings', () => {
  it('null / undefined / bukan objek -> bawaan', () => {
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS)
    expect(normalizeSettings(42)).toEqual(DEFAULT_SETTINGS)
    expect(normalizeSettings([])).toEqual(DEFAULT_SETTINGS)
  })

  it('JSON rusak -> bawaan', () => {
    expect(normalizeSettings('{rusak')).toEqual(DEFAULT_SETTINGS)
    expect(normalizeSettings('null')).toEqual(DEFAULT_SETTINGS)
  })

  it('kolom kurang dipulihkan per kolom', () => {
    expect(normalizeSettings({ lang: 'en' })).toEqual({ ...DEFAULT_SETTINGS, lang: 'en' })
  })

  it('nilai salah tipe / tak dikenal -> bawaan per kolom', () => {
    expect(
      normalizeSettings({
        lang: 'fr',
        showPinyin: 'ya',
        voiceSpeed: 0.5,
        soundEffects: 1,
        theme: 'biru',
        dailyGoal: 15,
      }),
    ).toEqual(DEFAULT_SETTINGS)
    expect(normalizeSettings({ lang: 'en', voiceSpeed: '1' })).toEqual({
      ...DEFAULT_SETTINGS,
      lang: 'en',
    })
  })

  it('nilai benar dipertahankan (objek dan string JSON)', () => {
    const v = {
      version: 1,
      lang: 'en',
      showPinyin: false,
      voiceSpeed: 0.75,
      soundEffects: false,
      theme: 'dark',
      dailyGoal: 30,
    }
    expect(normalizeSettings(v)).toEqual(v)
    expect(normalizeSettings(JSON.stringify(v))).toEqual(v)
  })

  it('dailyGoal: bawaan 20, data lama tanpa kolom valid, hanya 10/20/30', () => {
    expect(DEFAULT_SETTINGS.dailyGoal).toBe(20)
    expect(normalizeSettings({ lang: 'en', theme: 'dark' }).dailyGoal).toBe(20)
    for (const g of [10, 20, 30]) expect(normalizeSettings({ dailyGoal: g }).dailyGoal).toBe(g)
    for (const g of ['10', 15, 0, null, -10]) expect(normalizeSettings({ dailyGoal: g }).dailyGoal).toBe(20)
  })

  it('kolom asing dibuang', () => {
    expect(normalizeSettings({ foo: 1 })).toEqual(DEFAULT_SETTINGS)
  })
})

describe('resolveTheme', () => {
  it('system mengikuti perangkat', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })
})
