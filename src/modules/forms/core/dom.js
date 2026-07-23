import { SELECTORS, isDomElement, closestWithinRoot, escapeSelector, isEnabledAttribute } from './shared.js';

export const formLogger = {
  log(formOrRoot, message, data) {},
  warn(formOrRoot, message, data) {},
  error(formOrRoot, message, data) {},
};

// ============================================================================
// 1. CORE DOM UTILITIES
// ============================================================================
export const formDom = {
  hiddenDisplays: new WeakMap(),

  getControls(root) {
    return Array.from(root.querySelectorAll(SELECTORS.controls));
  },

  getFields(root) {
    return Array.from(root.querySelectorAll(SELECTORS.field));
  },

  getEventField(root, target) {
    if (!isDomElement(target)) return null;
    const wrapper = target.closest(SELECTORS.field);
    if (!wrapper || !root.contains(wrapper)) return null;
    return wrapper;
  },

  closestWithin(root, target, selector) {
    return closestWithinRoot(root, target, selector);
  },

  isElement(value) {
    return isDomElement(value);
  },

  isConditionHidden(element) {
    return Boolean(element.closest("[data-form-state~='condition-hidden']"));
  },

  skipsInlineConditionHide(element) {
    const form = element?.closest?.("[data-form]");
    return form?.getAttribute("data-form-condition-mode") === "inline-hide-off";
  },

  isStepHidden(element) {
    return Boolean(element.closest("[data-form-state~='step-hidden']"));
  },

  // A field hidden purely by CSS (a designer `display:none` class on it or any
  // ancestor) is not covered by our own condition/step state attributes, yet it
  // must not block submit with an error the user can never see. Treat it as
  // skip-if-hidden when it is genuinely not rendered.
  //
  // Computed `display`/`visibility` are the authority (they work with or without
  // layout, e.g. under jsdom). `offsetParent === null` is used only as a
  // fast-path when the environment actually performs layout — and never for
  // `position:fixed` elements, whose offsetParent is always null even when fully
  // visible. Walking ancestors' computed display catches `display:none` set on
  // an ancestor, which the element's own computed display does not reveal.
  isVisuallyHidden(element) {
    if (!isDomElement(element)) return false;
    if (typeof window === 'undefined' || !window.getComputedStyle) return false;

    const ownStyle = window.getComputedStyle(element);
    if (ownStyle.display === 'none' || ownStyle.visibility === 'hidden') return true;

    // Fast-path: only trust offsetParent when the environment does layout
    // (jsdom reports null for everything). Exclude position:fixed.
    if (element.offsetParent === null && ownStyle.position !== 'fixed' && this.hasLayoutEngine()) {
      return true;
    }

    // Authority for ancestor hiding: walk up checking computed display/visibility.
    let ancestor = element.parentElement;
    while (ancestor) {
      const style = window.getComputedStyle(ancestor);
      if (style.display === 'none' || style.visibility === 'hidden') return true;
      ancestor = ancestor.parentElement;
    }

    return false;
  },

  // Detects whether the environment performs layout (real browser) vs. jsdom,
  // where offsetParent is always null and cannot be used to infer visibility.
  hasLayoutEngine() {
    if (typeof document === 'undefined' || !document.body) return false;
    return document.body.offsetParent !== null || document.body.offsetHeight > 0;
  },

  setRendered(element, shouldShow) {
    if (!element) {
      throw new Error('Cannot render form visibility without an element.');
    }

    if (!shouldShow) {
      if (!this.hiddenDisplays.has(element)) {
        this.hiddenDisplays.set(element, {
          value: element.style.getPropertyValue('display'),
          priority: element.style.getPropertyPriority('display'),
        });
      }
      element.style.setProperty('display', 'none', 'important');
      return;
    }

    const originalDisplay = this.hiddenDisplays.get(element);
    if (!originalDisplay) return;

    if (originalDisplay.value) {
      element.style.setProperty('display', originalDisplay.value, originalDisplay.priority);
    } else {
      element.style.removeProperty('display');
    }
    this.hiddenDisplays.delete(element);
  },

  setState(element, state, shouldAdd) {
    if (!element) {
      throw new Error('Cannot set form state without an element.');
    }

    const applyState = (el) => {
      const states = new Set((el.getAttribute('data-form-state') || '').split(' ').filter(Boolean));

      if (shouldAdd) {
        states.add(state);
      } else {
        states.delete(state);
      }

      const value = Array.from(states).join(' ');

      if (value) {
        el.setAttribute('data-form-state', value);
      } else {
        el.removeAttribute('data-form-state');
      }
    };

    // Stamp the owning element AND every descendant. This is intentional and
    // load-bearing: our CSS styling selectors target `data-form-state` on
    // descendant nodes (not just the owning element), so styling breaks if the
    // attribute is only set on the owner. Do NOT reduce this to `applyState(element)`
    // alone — descendant stamping is required for the form styling system.
    applyState(element);
    element.querySelectorAll('*').forEach(applyState);
  },

  setText(root, selector, value) {
    root.querySelectorAll(selector).forEach((element) => {
      element.textContent = value;
    });
  },

  getNameSelector(name, tagName) {
    const prefix = tagName ? tagName : '';
    return prefix + "[name='" + this.escape(name) + "']";
  },

  escape(value) {
    return escapeSelector(value);
  },

  getDone(form) {
    if (!form.scope) return null;
    return form.scope.querySelector('.w-form-done');
  },

  getFail(form) {
    if (!form.scope) return null;
    return form.scope.querySelector('.w-form-fail');
  },

  showSuccess(form) {
    const done = this.getDone(form);
    if (done) done.style.display = 'block';
    if (form.root) form.root.style.display = 'none';
  },

  hideSuccess(form) {
    const done = this.getDone(form);
    if (done) done.style.display = 'none';
    if (form.root) form.root.style.display = '';
  },

  clearChoiceGroupError(input) {
    if (input.type !== 'checkbox' && input.type !== 'radio') return;
    const group = input.closest(SELECTORS.choiceGroup);
    if (!group) return;
    formDom.setState(group, 'invalid', false);
    const error = group.querySelector(SELECTORS.error);
    if (error) error.textContent = '';
  },
};

// ============================================================================
// 2. VALUES EXTRACTOR & GENERATOR
// ============================================================================
