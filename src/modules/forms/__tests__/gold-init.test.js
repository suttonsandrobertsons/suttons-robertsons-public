import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { initGoldForms } from '../gold.js'

// A gold form needs at least one CMS pricing row or createInstance() throws.
// This suite guards the init latch: a form whose setup throws (e.g. because
// Webflow injected the pricing rows late) must be retried on a later
// initGoldForms() pass instead of being permanently marked initialised.

function buildForm() {
  document.body.innerHTML = `
    <form data-form-gold data-form-state="">
      <div data-form-gold-pricing></div>
    </form>
  `
  return document.querySelector('form[data-form-gold]')
}

function addPricingRow(form) {
  const container = form.querySelector('[data-form-gold-pricing]')
  container.innerHTML = `
    <div data-form-gold-pricing-row>
      <span data-form-gold-pricing-field="assetType">gold</span>
      <span data-form-gold-pricing-field="itemType">jewellery</span>
      <span data-form-gold-pricing-field="label">9ct Gold</span>
      <span data-form-gold-pricing-field="weightGrams">1</span>
      <span data-form-gold-pricing-field="purityCarats">9</span>
    </div>
  `
}

describe('gold init latch', () => {
  beforeEach(() => {
    // Keep the async spot-price request pending so createInstance() completes
    // without surfacing network errors. A fetch call is our proof that
    // createInstance() actually ran (it is not called when a form is latched).
    global.fetch = vi.fn(() => new Promise(() => {}))
  })

  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('retries a form whose first init failed once pricing rows arrive', () => {
    const form = buildForm()

    // First pass: no pricing rows -> createInstance throws -> form marked error.
    initGoldForms(document)
    expect(form.getAttribute('data-form-state')).toContain('error')
    expect(global.fetch).not.toHaveBeenCalled()

    // Rows injected late; a second pass must re-run createInstance (not latched).
    addPricingRow(form)
    initGoldForms(document)
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('does not re-init a form that already initialised successfully', () => {
    const form = buildForm()
    addPricingRow(form)

    initGoldForms(document)
    expect(global.fetch).toHaveBeenCalledTimes(1)

    // Second pass must be a no-op: the form is genuinely initialised.
    initGoldForms(document)
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })
})
