import { describe, it, expect, beforeEach } from 'vitest'
import { formConditions, formValues, formDom } from '../core.js'

// ---------------------------------------------------------------------------
// Helper: build a minimal gold-form-like DOM with per-item radio groups
// and conditional elements that reference indexed field names.
// ---------------------------------------------------------------------------

function buildForm() {
  const form = document.createElement('form')
  form.setAttribute('data-form', 'gold')

  // Form-level enquiry_type radio group
  form.innerHTML = `
    <div data-form-field="enquiry_type">
      <input type="radio" name="enquiry_type" value="loan" checked>
      <input type="radio" name="enquiry_type" value="sell">
    </div>

    <div data-form-gold-item-list>
      <!-- ITEM 1 -->
      <div data-form-gold-item data-form-gold-item-index="1">
        <div data-form-field="item_type">
          <input type="radio" name="gold_item_type_1" value="jewellery" checked>
          <input type="radio" name="gold_item_type_1" value="coin">
          <input type="radio" name="gold_item_type_1" value="bar">
        </div>
        <!-- Conditional: show carat when item_type = jewellery -->
        <div data-form-field="metal_type" data-form-show-if="gold_item_type_1 = jewellery">
          <select name="metal_type_1"><option value="18">18ct</option></select>
        </div>
        <!-- Conditional: show coin type when item_type = coin -->
        <div data-form-field="coin_type" data-form-show-if="gold_item_type_1 = coin">
          <select name="coin_type_1"><option value="sovereign">Sovereign</option></select>
        </div>
        <!-- Conditional: show bar type when item_type = bar -->
        <div data-form-field="bar_type" data-form-show-if="gold_item_type_1 = bar">
          <select name="bar_type_1"><option value="1g_bar">1g Bar</option></select>
        </div>
      </div>

      <!-- ITEM 2 (simulates a clone with re-indexed rules) -->
      <div data-form-gold-item data-form-gold-item-index="2">
        <div data-form-field="item_type">
          <input type="radio" name="gold_item_type_2" value="jewellery">
          <input type="radio" name="gold_item_type_2" value="coin" checked>
          <input type="radio" name="gold_item_type_2" value="bar">
        </div>
        <div data-form-field="metal_type" data-form-show-if="gold_item_type_2 = jewellery">
          <select name="metal_type_2"><option value="18">18ct</option></select>
        </div>
        <div data-form-field="coin_type" data-form-show-if="gold_item_type_2 = coin">
          <select name="coin_type_2"><option value="sovereign">Sovereign</option></select>
        </div>
        <div data-form-field="bar_type" data-form-show-if="gold_item_type_2 = bar">
          <select name="bar_type_2"><option value="1g_bar">1g Bar</option></select>
        </div>
      </div>
    </div>

    <!-- Form-level conditional panel (enquiry_type driven) -->
    <div data-form-gold-output="loan_total" data-form-show-if="enquiry_type = loan">£0</div>
    <div data-form-gold-output="purchase_total" data-form-show-if="enquiry_type = sell OR unsure">£0</div>
  `

  return form
}

function isConditionHidden(el) {
  return el.getAttribute('data-form-state')?.includes('condition-hidden') || false
}

function isVisible(el) {
  return !isConditionHidden(el)
}

describe('per-item condition independence', () => {
  let form

  beforeEach(() => {
    form = buildForm()
  })

  it('initial state: item 1 jewellery fields visible, item 2 coin fields visible', () => {
    formConditions.render(form)

    // Item 1: jewellery selected → carat visible, coin/bar hidden
    const item1Carat = form.querySelector('[name="metal_type_1"]').closest('[data-form-show-if]')
    const item1Coin = form.querySelector('[name="coin_type_1"]').closest('[data-form-show-if]')
    const item1Bar = form.querySelector('[name="bar_type_1"]').closest('[data-form-show-if]')

    expect(isVisible(item1Carat)).toBe(true)
    expect(isVisible(item1Coin)).toBe(false)
    expect(isVisible(item1Bar)).toBe(false)

    // Item 2: coin selected → coin visible, jewellery/bar hidden
    const item2Carat = form.querySelector('[name="metal_type_2"]').closest('[data-form-show-if]')
    const item2Coin = form.querySelector('[name="coin_type_2"]').closest('[data-form-show-if]')
    const item2Bar = form.querySelector('[name="bar_type_2"]').closest('[data-form-show-if]')

    expect(isVisible(item2Carat)).toBe(false)
    expect(isVisible(item2Coin)).toBe(true)
    expect(isVisible(item2Bar)).toBe(false)
  })

  it('changing item 1 type does not affect item 2 visibility', () => {
    formConditions.render(form)

    // Switch item 1 from jewellery to bar
    const item1BarRadio = form.querySelector('[name="gold_item_type_1"][value="bar"]')
    item1BarRadio.checked = true
    form.querySelector('[name="gold_item_type_1"][value="jewellery"]').checked = false

    formConditions.render(form)

    // Item 1: bar selected → bar visible, jewellery/coin hidden
    const item1Carat = form.querySelector('[name="metal_type_1"]').closest('[data-form-show-if]')
    const item1Coin = form.querySelector('[name="coin_type_1"]').closest('[data-form-show-if]')
    const item1Bar = form.querySelector('[name="bar_type_1"]').closest('[data-form-show-if]')

    expect(isVisible(item1Carat)).toBe(false)
    expect(isVisible(item1Coin)).toBe(false)
    expect(isVisible(item1Bar)).toBe(true)

    // Item 2: still coin → unchanged
    const item2Carat = form.querySelector('[name="metal_type_2"]').closest('[data-form-show-if]')
    const item2Coin = form.querySelector('[name="coin_type_2"]').closest('[data-form-show-if]')
    const item2Bar = form.querySelector('[name="bar_type_2"]').closest('[data-form-show-if]')

    expect(isVisible(item2Carat)).toBe(false)
    expect(isVisible(item2Coin)).toBe(true)
    expect(isVisible(item2Bar)).toBe(false)
  })

  it('changing item 2 type does not affect item 1 visibility', () => {
    formConditions.render(form)

    // Switch item 2 from coin to jewellery
    const item2JewelleryRadio = form.querySelector('[name="gold_item_type_2"][value="jewellery"]')
    item2JewelleryRadio.checked = true
    form.querySelector('[name="gold_item_type_2"][value="coin"]').checked = false

    formConditions.render(form)

    // Item 1: still jewellery → unchanged
    const item1Carat = form.querySelector('[name="metal_type_1"]').closest('[data-form-show-if]')
    const item1Coin = form.querySelector('[name="coin_type_1"]').closest('[data-form-show-if]')
    const item1Bar = form.querySelector('[name="bar_type_1"]').closest('[data-form-show-if]')

    expect(isVisible(item1Carat)).toBe(true)
    expect(isVisible(item1Coin)).toBe(false)
    expect(isVisible(item1Bar)).toBe(false)

    // Item 2: jewellery → carat visible, coin/bar hidden
    const item2Carat = form.querySelector('[name="metal_type_2"]').closest('[data-form-show-if]')
    const item2Coin = form.querySelector('[name="coin_type_2"]').closest('[data-form-show-if]')
    const item2Bar = form.querySelector('[name="bar_type_2"]').closest('[data-form-show-if]')

    expect(isVisible(item2Carat)).toBe(true)
    expect(isVisible(item2Coin)).toBe(false)
    expect(isVisible(item2Bar)).toBe(false)
  })

  it('both items can have the same type selected independently', () => {
    formConditions.render(form)

    // Set both to jewellery
    form.querySelector('[name="gold_item_type_1"][value="jewellery"]').checked = true
    form.querySelector('[name="gold_item_type_1"][value="coin"]').checked = false

    form.querySelector('[name="gold_item_type_2"][value="jewellery"]').checked = true
    form.querySelector('[name="gold_item_type_2"][value="coin"]').checked = false

    formConditions.render(form)

    // Both items: jewellery → carat visible, coin/bar hidden
    const item1Carat = form.querySelector('[name="metal_type_1"]').closest('[data-form-show-if]')
    const item1Coin = form.querySelector('[name="coin_type_1"]').closest('[data-form-show-if]')
    const item2Carat = form.querySelector('[name="metal_type_2"]').closest('[data-form-show-if]')
    const item2Coin = form.querySelector('[name="coin_type_2"]').closest('[data-form-show-if]')

    expect(isVisible(item1Carat)).toBe(true)
    expect(isVisible(item1Coin)).toBe(false)
    expect(isVisible(item2Carat)).toBe(true)
    expect(isVisible(item2Coin)).toBe(false)
  })
})

describe('form-level conditions with enquiry_type', () => {
  it('loan enquiry shows loan panel, hides purchase panel', () => {
    const form = buildForm()
    formConditions.render(form)

    const loanPanel = form.querySelector('[data-form-gold-output="loan_total"]').closest('[data-form-show-if]')
    const purchasePanel = form.querySelector('[data-form-gold-output="purchase_total"]').closest('[data-form-show-if]')

    expect(isVisible(loanPanel)).toBe(true)
    expect(isVisible(purchasePanel)).toBe(false)
  })

  it('sell enquiry shows purchase panel, hides loan panel', () => {
    const form = buildForm()
    form.querySelector('[name="enquiry_type"][value="sell"]').checked = true
    form.querySelector('[name="enquiry_type"][value="loan"]').checked = false

    formConditions.render(form)

    const loanPanel = form.querySelector('[data-form-gold-output="loan_total"]').closest('[data-form-show-if]')
    const purchasePanel = form.querySelector('[data-form-gold-output="purchase_total"]').closest('[data-form-show-if]')

    expect(isVisible(loanPanel)).toBe(false)
    expect(isVisible(purchasePanel)).toBe(true)
  })
})

describe('formConditions.render raw DOM safety net', () => {
  it('wraps raw DOM element when called directly', () => {
    const form = document.createElement('form')
    form.setAttribute('data-form', 'test')
    form.innerHTML = `
      <div data-form-field="color">
        <input type="radio" name="color" value="red" checked>
      </div>
      <p data-form-show-if="color = red">Red is selected</p>
      <p data-form-show-if="color = blue">Blue is selected</p>
    `

    // Call render directly with raw DOM (not wrapped in FormInstance)
    formConditions.render(form)

    const redEl = form.querySelector('[data-form-show-if="color = red"]')
    const blueEl = form.querySelector('[data-form-show-if="color = blue"]')

    expect(isVisible(redEl)).toBe(true)
    expect(isVisible(blueEl)).toBe(false)
  })

  it('handles raw DOM with no scope/root properties', () => {
    const form = document.createElement('form')
    form.innerHTML = `
      <div data-form-field="size">
        <input type="radio" name="size" value="large" checked>
      </div>
      <div data-form-show-if="size = large">Large</div>
      <div data-form-show-if="size = small">Small</div>
    `

    // Simulate what formApp.refresh does when getFormByRoot returns null
    const rawForm = { scope: form, root: form, steps: [] }
    formConditions.render(rawForm)

    const largeEl = form.querySelector('[data-form-show-if="size = large"]')
    const smallEl = form.querySelector('[data-form-show-if="size = small"]')

    expect(isVisible(largeEl)).toBe(true)
    expect(isVisible(smallEl)).toBe(false)
  })
})

describe('formValues.get scoping with indexed field names', () => {
  it('returns values only from matching radio group', () => {
    const form = buildForm()

    const values1 = formValues.get(form, 'gold_item_type_1')
    const values2 = formValues.get(form, 'gold_item_type_2')

    expect(values1).toEqual(['jewellery'])
    expect(values2).toEqual(['coin'])
  })

  it('returns empty array for non-existent field name', () => {
    const form = buildForm()
    const values = formValues.get(form, 'gold_item_type_99')
    expect(values).toEqual([])
  })

  it('reads form-level enquiry_type correctly', () => {
    const form = buildForm()
    const values = formValues.get(form, 'enquiry_type')
    expect(values).toEqual(['loan'])
  })
})

describe('condition-hidden fields are excluded from formValues.get', () => {
  it('skips fields inside condition-hidden containers', () => {
    const form = document.createElement('form')
    form.setAttribute('data-form', 'test')
    form.innerHTML = `
      <div data-form-field="color">
        <input type="radio" name="color" value="red" checked>
      </div>
      <div data-form-field="size" data-form-state="condition-hidden">
        <input type="radio" name="size" value="large" checked>
      </div>
    `

    const colorValues = formValues.get(form, 'color')
    const sizeValues = formValues.get(form, 'size')

    expect(colorValues).toEqual(['red'])
    expect(sizeValues).toEqual([]) // skipped because condition-hidden
  })
})

describe('per-item conditions after simulated clone + re-index', () => {
  it('cloned item with rewritten rules evaluates independently', () => {
    const form = document.createElement('form')
    form.setAttribute('data-form', 'gold')
    form.innerHTML = `
      <div data-form-gold-item-list>
        <!-- Item 1 (original) -->
        <div data-form-gold-item data-form-gold-item-index="1">
          <div data-form-field="item_type">
            <input type="radio" name="gold_item_type_1" value="jewellery" checked>
            <input type="radio" name="gold_item_type_1" value="coin">
          </div>
          <div data-form-field="weight" data-form-show-if="gold_item_type_1 = jewellery">
            <input type="number" name="weight_1" value="10">
          </div>
          <div data-form-field="coin_select" data-form-show-if="gold_item_type_1 = coin">
            <select name="coin_1"><option value="sovereign">Sovereign</option></select>
          </div>
        </div>

        <!-- Item 2 (simulated clone — rules rewritten from _1 to _2) -->
        <div data-form-gold-item data-form-gold-item-index="2">
          <div data-form-field="item_type">
            <input type="radio" name="gold_item_type_2" value="jewellery">
            <input type="radio" name="gold_item_type_2" value="coin" checked>
          </div>
          <div data-form-field="weight" data-form-show-if="gold_item_type_2 = jewellery">
            <input type="number" name="weight_2" value="5">
          </div>
          <div data-form-field="coin_select" data-form-show-if="gold_item_type_2 = coin">
            <select name="coin_2"><option value="sovereign">Sovereign</option></select>
          </div>
        </div>
      </div>
    `

    formConditions.render(form)

    // Item 1: jewellery → weight visible, coin_select hidden
    const item1Weight = form.querySelector('[name="weight_1"]').closest('[data-form-show-if]')
    const item1Coin = form.querySelector('[name="coin_1"]').closest('[data-form-show-if]')

    expect(isVisible(item1Weight)).toBe(true)
    expect(isVisible(item1Coin)).toBe(false)

    // Item 2: coin → weight hidden, coin_select visible
    const item2Weight = form.querySelector('[name="weight_2"]').closest('[data-form-show-if]')
    const item2Coin = form.querySelector('[name="coin_2"]').closest('[data-form-show-if]')

    expect(isVisible(item2Weight)).toBe(false)
    expect(isVisible(item2Coin)).toBe(true)

    // Now switch item 1 to coin — should not affect item 2
    form.querySelector('[name="gold_item_type_1"][value="coin"]').checked = true
    form.querySelector('[name="gold_item_type_1"][value="jewellery"]').checked = false

    formConditions.render(form)

    expect(isVisible(item1Weight)).toBe(false)
    expect(isVisible(item1Coin)).toBe(true)
    expect(isVisible(item2Weight)).toBe(false)
    expect(isVisible(item2Coin)).toBe(true)
  })
})

describe('hide-if conditions with OR values', () => {
  it('data-form-hide-if with OR hides when any value matches', () => {
    const form = document.createElement('form')
    form.setAttribute('data-form', 'test')
    form.innerHTML = `
      <div data-form-field="status">
        <input type="radio" name="status" value="active" checked>
        <input type="radio" name="status" value="inactive">
        <input type="radio" name="status" value="suspended">
      </div>
      <div data-form-hide-if="status = inactive OR suspended">Hidden block</div>
    `

    formConditions.render(form)
    const el = form.querySelector('[data-form-hide-if]')
    expect(isVisible(el)).toBe(true) // active ≠ inactive/suspended → visible

    form.querySelector('[name="status"][value="inactive"]').checked = true
    form.querySelector('[name="status"][value="active"]').checked = false

    formConditions.render(form)
    expect(isVisible(el)).toBe(false) // inactive matches → hidden
  })
})

describe('complex multi-field AND conditions per item', () => {
  it('AND conditions require all rules to match', () => {
    const form = document.createElement('form')
    form.setAttribute('data-form', 'test')
    form.innerHTML = `
      <div data-form-field="type">
        <input type="radio" name="type" value="jewellery" checked>
      </div>
      <div data-form-field="carat">
        <input type="radio" name="carat" value="18" checked>
      </div>
      <div data-form-show-if="type = jewellery, carat = 18">Both match</div>
      <div data-form-show-if="type = jewellery, carat = 24">Only type matches</div>
    `

    formConditions.render(form)

    const bothEl = form.querySelector('[data-form-show-if="type = jewellery, carat = 18"]')
    const onlyTypeEl = form.querySelector('[data-form-show-if="type = jewellery, carat = 24"]')

    expect(isVisible(bothEl)).toBe(true)
    expect(isVisible(onlyTypeEl)).toBe(false)
  })
})
