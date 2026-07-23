import { describe, it, expect } from 'vitest'
import { buildPhoneValue, cleanPhoneInput, fieldFilters } from '../config.js'

describe('fieldFilters.money', () => {
  it('adds thousands separators while typing', () => {
    expect(fieldFilters.money('1000')).toBe('1,000')
    expect(fieldFilters.money('1000000')).toBe('1,000,000')
  })

  it('preserves the active decimal input state', () => {
    expect(fieldFilters.money('1234.')).toBe('1,234.')
    expect(fieldFilters.money('1234.5')).toBe('1,234.5')
  })

  it('removes non-money characters', () => {
    expect(fieldFilters.money('£12,345abc')).toBe('12,345')
  })
})

describe('phone helpers', () => {
  it('keeps local leading zeroes in the visible phone input', () => {
    expect(cleanPhoneInput('07900 000000')).toBe('07900000000')
    expect(fieldFilters.phone('(07900) 000-000')).toBe('07900000000')
  })

  it('builds one international value from local and autofilled UK numbers', () => {
    expect(buildPhoneValue('07900 000000', '+44')).toBe('+447900000000')
    expect(buildPhoneValue('+44 7900 000000', '+44')).toBe('+447900000000')
    expect(buildPhoneValue('447900000000', '+44')).toBe('+447900000000')
    expect(buildPhoneValue('0044 7900 000000', '+44')).toBe('+447900000000')
  })

  it('collapses duplicated selected country prefixes', () => {
    expect(buildPhoneValue('+44 +44 7900 000000', '+44')).toBe('+447900000000')
    expect(buildPhoneValue('44447900000000', '+44')).toBe('+447900000000')
  })

  it('removes common extension suffixes instead of appending them to the phone number', () => {
    expect(cleanPhoneInput('07900 000000 ext 123')).toBe('07900000000')
    expect(cleanPhoneInput('07900 000000 x123')).toBe('07900000000')
    expect(cleanPhoneInput('07900 000000 #123')).toBe('07900000000')
    expect(buildPhoneValue('07900 000000 ext 123', '+44')).toBe('+447900000000')
  })

  it('trusts explicit international numbers over the selected country', () => {
    expect(buildPhoneValue('+33 6 12 34 56 78', '+44')).toBe('+33612345678')
  })
})
