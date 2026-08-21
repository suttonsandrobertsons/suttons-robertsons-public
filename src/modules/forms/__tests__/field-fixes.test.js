import { beforeEach, describe, expect, it } from 'vitest'
import { formApp, formChoices, formDom, formFields } from '../core.js'

function bootForm(root) {
  const form = { root, steps: [], scope: root, syncedFieldKeys: new Set() }
  formChoices.configure(form)
  formApp.refresh(form)
  return form
}

function formPayload(form) {
  return Array.from(new FormData(form.root).entries())
}

describe('field defect fixes', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  // Fix 1: clearNamedChoiceError radio branch must only clear radios sharing the name.
  it('clears invalid state only from radios in the named group, not every radio in the form', () => {
    document.body.innerHTML = `
      <form data-form="quote">
        <label data-form-choice><input type="radio" name="contact_method" value="Email"></label>
        <label data-form-choice><input type="radio" name="contact_method" value="Phone"></label>
        <label data-form-choice><input type="radio" name="other_group" value="A"></label>
      </form>
    `
    const form = bootForm(document.querySelector('form'))
    const radios = Array.from(document.querySelectorAll('input[type="radio"]'))
    radios.forEach((radio) => {
      radio.setAttribute('aria-invalid', 'true')
      formDom.setState(radio.closest('[data-form-choice]'), 'invalid', true)
    })

    formChoices.clearNamedChoiceError(form.root, radios[0])

    expect(radios[0].hasAttribute('aria-invalid')).toBe(false)
    expect(radios[1].hasAttribute('aria-invalid')).toBe(false)
    expect(radios[2].hasAttribute('aria-invalid')).toBe(true)
  })

  // Fix 3: radio choice-group errors clear live on change like checkbox groups.
  it('clears a radio choice-group error when a radio is selected', () => {
    document.body.innerHTML = `
      <form data-form="quote">
        <div data-form-choice-group data-form-field-required="true">
          <label data-form-choice><input type="radio" name="contact_method" value="Email"></label>
          <label data-form-choice><input type="radio" name="contact_method" value="Phone"></label>
          <div data-form-error></div>
        </div>
      </form>
    `
    bootForm(document.querySelector('form'))
    const group = document.querySelector('[data-form-choice-group]')
    formDom.setState(group, 'invalid', true)
    group.querySelector('[data-form-error]').textContent = 'Please select an option.'

    const radio = document.querySelector('input[type="radio"]')
    radio.checked = true
    formDom.clearChoiceGroupError(radio)

    expect(group.getAttribute('data-form-state') || '').not.toContain('invalid')
    expect(group.querySelector('[data-form-error]').textContent).toBe('')
  })

  // Fix 4: deliberately-empty aggregate hidden fields must not be re-enabled at submit.
  it('keeps an empty checkbox-group aggregate hidden field disabled through submit prep', () => {
    document.body.innerHTML = `
      <form data-form="quote">
        <div data-form-choice-group="interests">
          <label data-form-choice><input type="checkbox" data-form-name="interests" value="Gold"></label>
          <label data-form-choice><input type="checkbox" data-form-name="interests" value="Silver"></label>
        </div>
      </form>
    `
    const form = bootForm(document.querySelector('form'))
    formFields.prepareControlsForSubmit(form)

    const names = formPayload(form).map(([name]) => name)
    expect(names).not.toContain('interests')
  })

  it('submits the aggregate hidden field once a checkbox is selected', () => {
    document.body.innerHTML = `
      <form data-form="quote">
        <div data-form-choice-group="interests">
          <label data-form-choice><input type="checkbox" data-form-name="interests" value="Gold"></label>
          <label data-form-choice><input type="checkbox" data-form-name="interests" value="Silver"></label>
        </div>
      </form>
    `
    const form = bootForm(document.querySelector('form'))
    document.querySelector('input[value="Gold"]').checked = true
    formApp.refresh(form)
    formFields.prepareControlsForSubmit(form)

    const payload = formPayload(form)
    expect(payload).toContainEqual(['interests', 'Gold'])
  })
})
