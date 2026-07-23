import { beforeEach, describe, expect, it, vi } from 'vitest'
import { scheduleAfterDomUpdate } from '../core/webflow.js'

describe('scheduleAfterDomUpdate', () => {
  it('runs the callback after two animation frames', async () => {
    const fn = vi.fn()
    scheduleAfterDomUpdate(fn)
    expect(fn).not.toHaveBeenCalled()
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    await Promise.resolve()
    expect(fn).toHaveBeenCalledTimes(1)
  })
})

describe('fs-inject hook', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    vi.resetModules()
    delete window.FinsweetAttributes
  })

  it('registers a deferred inject handler on the Finsweet queue when Finsweet is not loaded yet', async () => {
    await import('../index.js')

    expect(window.FinsweetAttributes).toEqual([
      ['inject', expect.any(Function)],
    ])
  })

  it('registers a deferred inject handler on FinsweetAttributes', async () => {
    window.FinsweetAttributes = {
      modules: { inject: { loading: Promise.resolve() } },
      push(...entries) {
        entries.forEach(([name, fn]) => {
          if (name === 'inject') this.modules.inject.loading.then(fn)
        })
      },
    }

    const push = vi.spyOn(window.FinsweetAttributes, 'push')
    await import('../index.js')
    expect(push).toHaveBeenCalledWith(['inject', expect.any(Function)])
  })

  it('does not boot forms on detached inject fragments', async () => {
    const detached = document.createElement('div')
    detached.innerHTML = `
      <form data-form="resources-form" id="resources-form" data-form-mode="sync" data-form-sync-form="footer-form">
        <input type="email" name="email">
      </form>
    `

    const { initForms } = await import('../index.js')
    initForms(detached)

    expect(detached.querySelector('form').dataset.formState).toBeUndefined()
  })

  it('allows a disconnected injected form to be replaced with the same key', async () => {
    const { initForms, formApp } = await import('../index.js')
    const host = document.createElement('div')
    document.body.appendChild(host)
    const shadow = host.attachShadow({ mode: 'open' })

    shadow.innerHTML = `
      <form data-form="resources-form" id="resources-form">
        <input type="email" name="email">
      </form>
    `

    const first = shadow.querySelector('form')
    initForms(document)
    expect(first.dataset.formState).toContain('loaded')

    shadow.innerHTML = `
      <form data-form="resources-form" id="resources-form">
        <input type="email" name="email">
      </form>
    `

    const second = shadow.querySelector('form')
    expect(() => initForms(document)).not.toThrow()
    expect(second.dataset.formState).toContain('loaded')
    expect(formApp.getFormByRoot(first)).toBeNull()
    expect(formApp.getFormByRoot(second)).toBeTruthy()
  })
})
