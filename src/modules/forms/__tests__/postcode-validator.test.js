import { describe, expect, it } from 'vitest'
import { fieldValidators } from '../config.js'

describe('postcode validator', () => {
  it('accepts standard UK postcodes', () => {
    expect(fieldValidators.postcode('SW1A 1AA')).toBe(true)
    expect(fieldValidators.postcode('m1 5bd')).toBe(true)
  })

  it('accepts the GIR 0AA special case with or without internal whitespace', () => {
    expect(fieldValidators.postcode('GIR 0AA')).toBe(true)
    expect(fieldValidators.postcode('gir 0aa')).toBe(true)
    expect(fieldValidators.postcode('gir0aa')).toBe(true)
    expect(fieldValidators.postcode('  GIR   0AA  ')).toBe(true)
  })

  it('accepts postcodes with collapsed double/irregular whitespace', () => {
    expect(fieldValidators.postcode('SW1A  1AA')).toBe(true)
    expect(fieldValidators.postcode('  M1   5BD  ')).toBe(true)
  })

  it('rejects invalid postcodes', () => {
    expect(fieldValidators.postcode('not a postcode')).toBe(false)
    expect(fieldValidators.postcode('GIR 1AA')).toBe(false)
  })
})
