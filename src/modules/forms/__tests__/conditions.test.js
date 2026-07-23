import { describe, it, expect } from 'vitest'
import { formConditions } from '../core.js'

describe('formConditions.getRules', () => {
  it('returns empty array for null', () => {
    expect(formConditions.getRules(null)).toEqual([])
  })

  it('returns empty array for undefined', () => {
    expect(formConditions.getRules(undefined)).toEqual([])
  })

  it('returns empty array for empty string', () => {
    expect(formConditions.getRules('')).toEqual([])
  })

  it('returns empty array for whitespace-only string', () => {
    expect(formConditions.getRules('  ')).toEqual([])
  })

  it('parses a single equals rule', () => {
    expect(formConditions.getRules('asset_type = handbag')).toEqual(['asset_type = handbag'])
  })

  it('trims whitespace from rules', () => {
    expect(formConditions.getRules('  asset_type = handbag  ')).toEqual(['asset_type = handbag'])
  })

  it('parses a single not-equals rule', () => {
    expect(formConditions.getRules('country != UK')).toEqual(['country != UK'])
  })

  it('parses a single greater-than rule', () => {
    expect(formConditions.getRules('value > 5')).toEqual(['value > 5'])
  })

  it('parses a single greater-or-equal rule', () => {
    expect(formConditions.getRules('value >= 5')).toEqual(['value >= 5'])
  })

  it('parses a single less-than rule', () => {
    expect(formConditions.getRules('value < 5')).toEqual(['value < 5'])
  })

  it('parses a single less-or-equal rule', () => {
    expect(formConditions.getRules('value <= 5')).toEqual(['value <= 5'])
  })

  it('splits AND conditions on comma', () => {
    expect(formConditions.getRules('asset_type = handbag, country = US')).toEqual([
      'asset_type = handbag',
      'country = US',
    ])
  })

  it('keeps OR values within a single rule intact', () => {
    expect(formConditions.getRules('asset_type = handbag|watch')).toEqual([
      'asset_type = handbag|watch',
    ])
  })

  it('keeps OR with word separator intact', () => {
    expect(formConditions.getRules('asset_type = handbag OR watch')).toEqual([
      'asset_type = handbag OR watch',
    ])
  })

  it('splits on semicolons', () => {
    expect(formConditions.getRules('asset_type = handbag; country = US')).toEqual([
      'asset_type = handbag',
      'country = US',
    ])
  })

  it('handles mixed semicolons and commas', () => {
    expect(formConditions.getRules('asset_type = handbag, country = US; metal = gold')).toEqual([
      'asset_type = handbag',
      'country = US',
      'metal = gold',
    ])
  })

  it('handles negation', () => {
    expect(formConditions.getRules('!field_name')).toEqual(['!field_name'])
  })

  it('handles bare field name (presence check)', () => {
    expect(formConditions.getRules('field_name')).toEqual(['field_name'])
  })

  it('handles field names with underscores', () => {
    expect(formConditions.getRules('my_field = value')).toEqual(['my_field = value'])
  })

  it('handles field names with hyphens', () => {
    expect(formConditions.getRules('my-field = value')).toEqual(['my-field = value'])
  })

  it('does not split comma inside a value', () => {
    expect(formConditions.getRules('name = hello, world')).toEqual(['name = hello, world'])
  })

  it('does not split comma when next token is not a field', () => {
    expect(formConditions.getRules('category = a, b or c')).toEqual(['category = a, b or c'])
  })

  it('splits when comma is followed by a field=value pattern', () => {
    expect(formConditions.getRules('a = 1, b = 2, c = 3')).toEqual([
      'a = 1',
      'b = 2',
      'c = 3',
    ])
  })

  it('handles multiple OR values with pipe', () => {
    expect(formConditions.getRules('type = gold|silver|bronze')).toEqual([
      'type = gold|silver|bronze',
    ])
  })

  it('handles negated compound rule', () => {
    expect(formConditions.getRules('!skip_field')).toEqual(['!skip_field'])
  })

  it('handles number comparison with decimal', () => {
    expect(formConditions.getRules('price >= 10.50')).toEqual(['price >= 10.50'])
  })

  it('filters out empty segments from trailing semicolons', () => {
    expect(formConditions.getRules('a = 1; b = 2;')).toEqual(['a = 1', 'b = 2'])
  })

  it('splits a negation rule after a comma', () => {
    expect(formConditions.getRules('a = 1, !b')).toEqual(['a = 1', '!b'])
  })

  it('splits multiple negation rules after commas', () => {
    expect(formConditions.getRules('a = 1, !b, !c')).toEqual(['a = 1', '!b', '!c'])
  })

  it('still splits operator rules after a comma', () => {
    expect(formConditions.getRules('a = 1, b = 2')).toEqual(['a = 1', 'b = 2'])
  })

  it('does not split a value that contains a comma followed by prose', () => {
    expect(formConditions.getRules('label = Hello, world')).toEqual(['label = Hello, world'])
  })
})

describe('formConditions._synthesizeRule', () => {
  function el(attrs) {
    const node = { getAttribute: (name) => attrs[name] ?? null }
    return node
  }

  it('returns null when group attr is missing', () => {
    expect(formConditions._synthesizeRule(el({}), 'data-form-show-if-group', 'data-form-show-if-value')).toBeNull()
  })

  it('returns null when group attr is empty string', () => {
    expect(formConditions._synthesizeRule(el({ 'data-form-show-if-group': '  ' }), 'data-form-show-if-group', 'data-form-show-if-value')).toBeNull()
  })

  it('returns bare field name when value attr is missing', () => {
    expect(formConditions._synthesizeRule(el({ 'data-form-show-if-group': 'asset_type' }), 'data-form-show-if-group', 'data-form-show-if-value')).toBe('asset_type')
  })

  it('returns bare field name when value attr is empty', () => {
    expect(formConditions._synthesizeRule(el({ 'data-form-show-if-group': 'asset_type', 'data-form-show-if-value': '  ' }), 'data-form-show-if-group', 'data-form-show-if-value')).toBe('asset_type')
  })

  it('returns field = value when both attrs present', () => {
    expect(formConditions._synthesizeRule(el({ 'data-form-show-if-group': 'asset_type', 'data-form-show-if-value': 'watches' }), 'data-form-show-if-group', 'data-form-show-if-value')).toBe('asset_type = watches')
  })

  it('trims whitespace from group and value', () => {
    expect(formConditions._synthesizeRule(el({ 'data-form-show-if-group': '  asset_type  ', 'data-form-show-if-value': '  watches  ' }), 'data-form-show-if-group', 'data-form-show-if-value')).toBe('asset_type = watches')
  })

  it('preserves pipe-separated values', () => {
    expect(formConditions._synthesizeRule(el({ 'data-form-show-if-group': 'asset_type', 'data-form-show-if-value': 'watches|rings' }), 'data-form-show-if-group', 'data-form-show-if-value')).toBe('asset_type = watches|rings')
  })

  it('works with hide-if group/value attrs', () => {
    expect(formConditions._synthesizeRule(el({ 'data-form-hide-if-group': 'asset_type', 'data-form-hide-if-value': 'Other' }), 'data-form-hide-if-group', 'data-form-hide-if-value')).toBe('asset_type = Other')
  })

  it('works with hide-if-any group/value attrs', () => {
    expect(formConditions._synthesizeRule(el({ 'data-form-hide-if-any-group': 'status', 'data-form-hide-if-any-value': 'inactive' }), 'data-form-hide-if-any-group', 'data-form-hide-if-any-value')).toBe('status = inactive')
  })
})
