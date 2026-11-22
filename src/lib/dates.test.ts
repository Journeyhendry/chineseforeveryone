import { describe, expect, it } from 'vitest'
import { addDays, daysBetween, formatDay, isDay, localDay } from './dates'

describe('localDay', () => {
  it('memakai jam perangkat, dengan nol di depan', () => {
    expect(localDay(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
    expect(localDay(new Date(2026, 11, 31, 0, 0))).toBe('2026-12-31')
  })
})

describe('addDays', () => {
  it('pergantian bulan dan tahun', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })
  it('tahun kabisat', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2028-02-29', 1)).toBe('2028-03-01')
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01')
    expect(addDays('2100-02-28', 1)).toBe('2100-03-01')
  })
  it('n besar dan nol', () => {
    expect(addDays('2026-11-22', 0)).toBe('2026-11-22')
    expect(addDays('2026-01-01', 365)).toBe('2027-01-01')
    expect(addDays('2028-01-01', 366)).toBe('2029-01-01')
  })
})

describe('daysBetween', () => {
  it('positif, negatif, nol', () => {
    expect(daysBetween('2026-11-22', '2026-11-23')).toBe(1)
    expect(daysBetween('2026-11-23', '2026-11-22')).toBe(-1)
    expect(daysBetween('2026-11-22', '2026-11-22')).toBe(0)
  })
  it('lintas bulan, tahun, kabisat', () => {
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1)
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2)
    expect(daysBetween('2027-02-28', '2027-03-01')).toBe(1)
    expect(daysBetween('2026-01-01', '2027-01-01')).toBe(365)
  })
  it('aman dari pergantian jam musim panas (UTC dari string)', () => {
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2)
    expect(daysBetween('2026-10-31', '2026-11-02')).toBe(2)
  })
})

describe('isDay', () => {
  it('hanya tanggal yang benar-benar ada', () => {
    expect(isDay('2026-02-28')).toBe(true)
    expect(isDay('2028-02-29')).toBe(true)
    expect(isDay('2026-02-29')).toBe(false)
    expect(isDay('2026-13-01')).toBe(false)
    expect(isDay('2026-1-1')).toBe(false)
    expect(isDay('kemarin')).toBe(false)
    expect(isDay(20260101)).toBe(false)
    expect(isDay(null)).toBe(false)
  })
})

describe('formatDay', () => {
  it('mengikuti bahasa', () => {
    expect(formatDay('2026-11-25', 'id')).toMatch(/Rabu/)
    expect(formatDay('2026-11-25', 'en')).toMatch(/Wednesday/)
  })
})
