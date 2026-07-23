import { describe, expect, it } from 'vitest'
import { addMinutes, formatDate, formatTime, formDerivedFields } from '../derived-fields.js'

describe('derived formatted fields', () => {
  it('formats date values as YYYY-MM-DD', () => {
    expect(formatDate('2026-07-02')).toBe('2026-07-02')
    expect(formatDate('02/07/2026')).toBe('')
    expect(formatDate('')).toBe('')
  })

  it('rejects dates with out-of-range month or day', () => {
    expect(formatDate('2026-99-99')).toBe('')
    expect(formatDate('2026-13-01')).toBe('')
    expect(formatDate('2026-02-30')).toBe('')
    expect(formatDate('2026-00-10')).toBe('')
    expect(formatDate('2024-02-29')).toBe('2024-02-29')
  })

  it('formats time values as HH:mm:ss', () => {
    expect(formatTime('9:30')).toBe('09:30:00')
    expect(formatTime('10:30:15')).toBe('10:30:15')
    expect(formatTime('25:30')).toBe('')
  })

  it('adds a hidden formatted field from wrapper data-form-field', () => {
    document.body.innerHTML = `
      <form data-form="test">
        <div data-form-field="random" data-form-field-type="date">
          <input name="some_date_input" value="2026-07-02">
        </div>
      </form>
    `

    const root = document.querySelector('form')
    formDerivedFields.apply(root)

    expect(root.querySelector('[name="random_formatted"]').value).toBe('2026-07-02')
  })

  it('adds a hidden formatted field from direct data-form-field', () => {
    document.body.innerHTML = `
      <form data-form="test">
        <input name="appointment_time" value="9:30" data-form-field="appointment_time" data-form-field-type="time">
      </form>
    `

    const root = document.querySelector('form')
    formDerivedFields.apply(root)

    expect(root.querySelector('[name="appointment_time_formatted"]').value).toBe('09:30:00')
  })

  it('falls back to the input name when data-form-field is missing', () => {
    document.body.innerHTML = `
      <form data-form="test">
        <input name="appointment_date" value="2026-07-02" data-form-field-type="date">
      </form>
    `

    const root = document.querySelector('form')
    formDerivedFields.apply(root)

    expect(root.querySelector('[name="appointment_date_formatted"]').value).toBe('2026-07-02')
  })

  it('clears stale formatted values when source value is invalid', () => {
    document.body.innerHTML = `
      <form data-form="test">
        <input type="hidden" name="appointment_time_formatted" value="stale">
        <input name="appointment_time" value="25:30" data-form-field-type="time">
      </form>
    `

    const root = document.querySelector('form')
    formDerivedFields.apply(root)

    expect(root.querySelector('[name="appointment_time_formatted"]').value).toBe('')
  })

  it('ignores untyped date and time fields', () => {
    document.body.innerHTML = `
      <form data-form="test">
        <input name="appointment_date" value="2026-07-02">
      </form>
    `

    const root = document.querySelector('form')
    formDerivedFields.apply(root)

    expect(root.querySelector('[name="appointment_date_formatted"]')).toBeNull()
  })

  it('combines the Other sub-type into combined_asset_type', () => {
    document.body.innerHTML = `
      <form data-form="test">
        <input name="asset_type" value="Other">
        <input name="other_asset_types" value="Diamond Jewellery">
      </form>
    `

    const root = document.querySelector('form')
    formDerivedFields.apply(root)

    expect(root.querySelector('[name="combined_asset_type"]').value).toBe('Diamond Jewellery')
  })

  it('uses the main category and ignores a stale sub-type when not Other', () => {
    document.body.innerHTML = `
      <form data-form="test">
        <input name="asset_type" value="Watches">
        <input name="other_asset_types" value="Diamond Jewellery">
      </form>
    `

    const root = document.querySelector('form')
    formDerivedFields.apply(root)

    expect(root.querySelector('[name="combined_asset_type"]').value).toBe('Watches')
  })

  it('does not write combined_asset_type when no asset is selected', () => {
    document.body.innerHTML = `
      <form data-form="test">
        <input name="email" value="a@b.com">
      </form>
    `

    const root = document.querySelector('form')
    formDerivedFields.apply(root)

    expect(root.querySelector('[name="combined_asset_type"]')).toBeNull()
  })

  it('addMinutes adds a duration and returns YYYY-MM-DDTHH:mm:ss', () => {
    expect(addMinutes('2026-07-09', '14:00:00', 60)).toBe('2026-07-09T15:00:00')
    expect(addMinutes('2026-07-09', '14:00:00', 15)).toBe('2026-07-09T14:15:00')
  })

  it('addMinutes rolls over to the next day (and month) correctly', () => {
    expect(addMinutes('2026-07-09', '23:30:00', 60)).toBe('2026-07-10T00:30:00')
    expect(addMinutes('2026-07-31', '23:45:00', 30)).toBe('2026-08-01T00:15:00')
  })

  it('computes appointment start + end datetimes from date, time and length', () => {
    document.body.innerHTML = `
      <form data-form="appointment">
        <input name="appointment_date" value="2026-07-09">
        <input name="appointment_time" value="14:00">
        <input name="appointment_length" value="60">
      </form>
    `

    const root = document.querySelector('form')
    formDerivedFields.apply(root)

    expect(root.querySelector('[name="appointment_start_datetime"]').value).toBe('2026-07-09T14:00:00')
    expect(root.querySelector('[name="appointment_end_datetime"]').value).toBe('2026-07-09T15:00:00')
  })

  it('uses the 15-minute drop-off length', () => {
    document.body.innerHTML = `
      <form data-form="appointment">
        <input name="appointment_date" value="2026-07-09">
        <input name="appointment_time" value="9:30">
        <input name="appointment_length" value="15">
      </form>
    `

    const root = document.querySelector('form')
    formDerivedFields.apply(root)

    expect(root.querySelector('[name="appointment_start_datetime"]').value).toBe('2026-07-09T09:30:00')
    expect(root.querySelector('[name="appointment_end_datetime"]').value).toBe('2026-07-09T09:45:00')
  })

  it('emits empty appointment datetimes when date/time are absent (home visit)', () => {
    document.body.innerHTML = `
      <form data-form="appointment">
        <input name="appointment_length" value="60">
      </form>
    `

    const root = document.querySelector('form')
    formDerivedFields.apply(root)

    expect(root.querySelector('[name="appointment_start_datetime"]').value).toBe('')
    expect(root.querySelector('[name="appointment_end_datetime"]').value).toBe('')
  })
})
