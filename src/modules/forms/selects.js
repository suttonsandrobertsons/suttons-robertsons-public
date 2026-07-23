/**
 * Custom select dropdown builder.
 *
 * Usage:
 *   <div data-form-select>
 *     <button data-form-select-trigger type="button">
 *       <span data-form-select-value>Choose</span>
 *     </button>
 *     <div data-form-select-option="a">Option A</div>
 *     <div data-form-select-option="b">Option B</div>
 *     <select data-form-select-native name="field"></select>
 *   </div>
 *
 *   // Preferred: just call initForms() from the forms barrel.
 *   // initSelects is called automatically inside initForms().
 *   import { initForms } from "./modules/forms/index.js";
 *   initForms();
 */

import { isVisible } from "../../utils/dom.js";
import { formDom } from "./core.js";

const selectors = {
  component: "[data-form-select]",
  trigger: "[data-form-select-trigger]",
  value: "[data-form-select-value]",
  option: "[data-form-select-option]",
  native: "[data-form-select-native]",
  icon: "[data-form-select-icon]",
  optionIcon: "[data-form-select-option-icon]",
};

let isGlobalListenerRegistered = false;

// Use WeakSet instead of polluting elements with __selectBuilt
const initializedSelects = new WeakSet();

// Track all active select elements for closeAllSelects performance
const activeSelectElements = new Set();

// Track per-select MutationObservers so we can disconnect on destroy
const selectObservers = new WeakMap();

// Track per-select listener bindings so destroy can remove every listener it added
const selectListeners = new WeakMap();

function getSelectElements(selectEl) {
  return {
    trigger: selectEl.querySelector(selectors.trigger),
    valueEl: selectEl.querySelector(selectors.value),
    options: Array.from(selectEl.querySelectorAll(selectors.option)),
    nativeSelect: selectEl.querySelector(selectors.native),
  };
}

function setOpen(selectEl, trigger, isOpen) {
  formDom.setState(selectEl, "open", isOpen);
  if (trigger) trigger.setAttribute("aria-expanded", String(isOpen));
}

function setDisabled(selectEl, trigger, isDisabled) {
  formDom.setState(selectEl, "disabled", isDisabled);
  if (trigger) {
    if (isDisabled) {
      trigger.setAttribute("aria-disabled", "true");
      trigger.setAttribute("tabindex", "-1");
    } else {
      trigger.removeAttribute("aria-disabled");
      trigger.setAttribute("tabindex", "0");
    }
  }
}

function setSelected(optionEl, isSelected) {
  formDom.setState(optionEl, "selected", isSelected);
  optionEl.setAttribute("aria-selected", String(isSelected));
}

function resetNativeSelect(nativeSelect, shouldUseDefault = false) {
  if (!nativeSelect.options.length) return;

  if (shouldUseDefault) {
    // Pick the first real (non-placeholder) option. The placeholder is the
    // empty-value disabled option synthesized in init; selecting by value
    // rather than a hardcoded index stays correct even without one.
    const firstReal = Array.from(nativeSelect.options).find((opt) => opt.value !== "");
    if (firstReal) {
      nativeSelect.value = firstReal.value;
      nativeSelect.selectedIndex = firstReal.index;
      return;
    }
  }

  nativeSelect.selectedIndex = 0;
  nativeSelect.value = "";
}

function getInitialCustomValue(options) {
  const selectedOption = options.find((option) => {
    return option.getAttribute("aria-selected") === "true" || isState(option, "selected");
  });

  return selectedOption?.dataset.formSelectOption || "";
}

function syncIcon(selectEl, matchedOption) {
  const optionIcon = matchedOption?.querySelector(selectors.optionIcon);
  const iconEl = selectEl.querySelector(selectors.icon);
  if (!iconEl) return;
  if (optionIcon) {
    iconEl.src = optionIcon.src;
    iconEl.hidden = false;
  } else {
    iconEl.hidden = true;
  }
}

function syncCustomUI(selectEl) {
  const { valueEl, options, nativeSelect } = getSelectElements(selectEl);
  if (!nativeSelect || !valueEl) return;

  const value = nativeSelect.value;
  const matchedOption = options.find((opt) => opt.dataset.formSelectOption === value);

  if (matchedOption) {
    // User selected something or URL param matched
    valueEl.textContent = matchedOption.textContent.trim();
    options.forEach((opt) => setSelected(opt, opt === matchedOption));
    formDom.setState(selectEl, "placeholder", false);
    syncIcon(selectEl, matchedOption);
  } else if (!value) {
    // No value set - check if we have a default or should show placeholder
    const hasDefault = selectEl.hasAttribute("data-form-select-default");
    if (hasDefault) {
      // Auto-select first custom option
      const firstOption = options[0];
      if (firstOption) {
        nativeSelect.value = firstOption.dataset.formSelectOption;
        valueEl.textContent = firstOption.textContent.trim();
        options.forEach((opt) => setSelected(opt, opt === firstOption));
        formDom.setState(selectEl, "placeholder", false);
        syncIcon(selectEl, firstOption);
      }
    } else {
      // Show placeholder text from native placeholder option
      valueEl.textContent = nativeSelect.options[0]?.textContent || "Select option";
      options.forEach((opt) => setSelected(opt, false));
      formDom.setState(selectEl, "placeholder", true);
      syncIcon(selectEl, null);
    }
  } else {
    // Value set but no match (invalid) - treat as placeholder
    valueEl.textContent = nativeSelect.options[0]?.textContent || "Select option";
    options.forEach((opt) => setSelected(opt, false));
    formDom.setState(selectEl, "placeholder", true);
    syncIcon(selectEl, null);
  }
}

function syncDisabledState(selectEl, nativeSelect, trigger) {
  setDisabled(selectEl, trigger, nativeSelect.disabled);
}

function closeAllSelects(exceptSelect = null) {
  activeSelectElements.forEach((selectEl) => {
    if (selectEl === exceptSelect) return;
    const { trigger } = getSelectElements(selectEl);
    setOpen(selectEl, trigger, false);
  });
}

function isState(selectEl, state) {
  return (selectEl.getAttribute("data-form-state") || "").split(/\s+/).includes(state);
}

export function initSelects(scope = document) {
  const selects = [
    ...(scope.matches?.(selectors.component) ? [scope] : []),
    ...Array.from(scope.querySelectorAll(selectors.component)),
  ];

  selects.forEach((selectEl) => {
    if (initializedSelects.has(selectEl)) return;
    initializedSelects.add(selectEl);

    const { trigger, valueEl, options, nativeSelect } = getSelectElements(selectEl);

    if (!trigger || !valueEl || !nativeSelect || !options.length) {
      return;
    }

    activeSelectElements.add(selectEl);

    // Set accessibility attributes
    trigger.setAttribute("type", "button");
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");

    // Parent wrapper of options gets role="listbox"
    const optionsParent = options[0].parentElement;
    if (optionsParent) {
      optionsParent.setAttribute("role", "listbox");
    }

    // Populate native select from custom options
    nativeSelect.innerHTML = "";

    const placeholderText = valueEl.textContent.trim() || "Select option";
    const placeholderOption = document.createElement("option");

    placeholderOption.value = "";
    placeholderOption.textContent = placeholderText;
    placeholderOption.disabled = true;
    placeholderOption.selected = true;

    nativeSelect.appendChild(placeholderOption);

    options.forEach((option) => {
      const label = option.textContent.trim();
      const value = option.dataset.formSelectOption || label.toLowerCase().replace(/\s+/g, "-");
      // Persist the resolved value back onto the custom option so the click
      // handler (and syncCustomUI matching) uses the same value init wrote to
      // the native option, even when the source markup omitted the attribute.
      option.dataset.formSelectOption = value;
      option.setAttribute("role", "option");
      option.setAttribute("tabindex", "-1");

      const nativeOption = document.createElement("option");
      nativeOption.value = value;
      nativeOption.textContent = label;

      nativeSelect.appendChild(nativeOption);
    });

    const initialCustomValue = getInitialCustomValue(options);
    if (initialCustomValue) {
      nativeSelect.value = initialCustomValue;
    } else {
      resetNativeSelect(nativeSelect, selectEl.hasAttribute("data-form-select-default"));
    }

    // Sync UI initially
    syncCustomUI(selectEl);
    syncDisabledState(selectEl, nativeSelect, trigger);

    // Watch for programmatic changes on native select (value + disabled from form conditions)
    const onNativeChange = () => {
      syncCustomUI(selectEl);
      syncDisabledState(selectEl, nativeSelect, trigger);
    };
    nativeSelect.addEventListener("change", onNativeChange);

    // React to disabled attribute changes driven by the form engine (condition-hidden, etc.)
    const mo = new MutationObserver(() => {
      syncDisabledState(selectEl, nativeSelect, trigger);
    });
    mo.observe(nativeSelect, { attributes: true, attributeFilter: ["disabled"] });
    selectObservers.set(selectEl, mo);

    // Watch for form reset
    const parentForm = nativeSelect.closest("form");
    const onFormReset = () => {
      setTimeout(() => {
        resetNativeSelect(nativeSelect, selectEl.hasAttribute("data-form-select-default"));
        syncCustomUI(selectEl);
        syncDisabledState(selectEl, nativeSelect, trigger);
      }, 0);
    };
    if (parentForm) {
      parentForm.addEventListener("reset", onFormReset);
    }

    // Trigger click handler
    const onTriggerClick = (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (!isVisible(selectEl) || nativeSelect.disabled) return;

      const isOpen = isState(selectEl, "open");

      closeAllSelects(selectEl);
      setOpen(selectEl, trigger, !isOpen);
    };
    trigger.addEventListener("click", onTriggerClick);

    // Event delegation on selectEl container for option clicks
    const onSelectClick = (event) => {
      const clickedTrigger = event.target.closest(selectors.trigger);
      if (!clickedTrigger && !event.target.closest(selectors.option) && !event.target.closest(selectors.native)) {
        event.preventDefault();
        trigger.click();
        return;
      }

      const option = event.target.closest(selectors.option);
      if (!option || !selectEl.contains(option)) return;

      event.preventDefault();
      event.stopPropagation();

      if (!isVisible(selectEl) || nativeSelect.disabled) return;

      const value = option.dataset.formSelectOption;

      nativeSelect.value = value;
      syncCustomUI(selectEl);
      setOpen(selectEl, trigger, false);

      nativeSelect.dispatchEvent(new Event("change", { bubbles: true }));
    };
    selectEl.addEventListener("click", onSelectClick);

    // Keyboard navigation
    const onSelectKeydown = (event) => {
      if (!isVisible(selectEl) || nativeSelect.disabled) return;

      const isOpen = isState(selectEl, "open");

      switch (event.key) {
        case "Enter":
        case " ":
          event.preventDefault();
          if (!isOpen) {
            setOpen(selectEl, trigger, true);
          } else {
            const activeOption = selectEl.querySelector(`${selectors.option}:focus`);
            if (activeOption) {
              activeOption.click();
            } else {
              setOpen(selectEl, trigger, false);
            }
            trigger.focus();
          }
          break;

        case "Escape":
          if (isOpen) {
            event.preventDefault();
            setOpen(selectEl, trigger, false);
            trigger.focus();
          }
          break;

        case "ArrowDown":
          event.preventDefault();
          if (!isOpen) {
            setOpen(selectEl, trigger, true);
          } else {
            const focused = document.activeElement;
            const currentIndex = options.indexOf(focused);
            const nextIndex = (currentIndex + 1) % options.length;
            options[nextIndex].focus();
          }
          break;

        case "ArrowUp":
          event.preventDefault();
          if (!isOpen) {
            setOpen(selectEl, trigger, true);
          } else {
            const focused = document.activeElement;
            const currentIndex = options.indexOf(focused);
            const prevIndex = (currentIndex - 1 + options.length) % options.length;
            options[prevIndex].focus();
          }
          break;
      }
    };
    selectEl.addEventListener("keydown", onSelectKeydown);

    // Record bindings so destroySelects can remove every listener it added
    selectListeners.set(selectEl, {
      nativeSelect,
      trigger,
      parentForm,
      onNativeChange,
      onFormReset,
      onTriggerClick,
      onSelectClick,
      onSelectKeydown,
    });
  });

  // Global click outside to close handler (only added once globally)
  if (!isGlobalListenerRegistered) {
    isGlobalListenerRegistered = true;
    document.addEventListener("click", (event) => {
      const clickedInsideSelect = event.target.closest(selectors.component);
      if (!clickedInsideSelect) {
        closeAllSelects();
      }
    });
  }
}

/**
 * Destroy custom selects inside the given scope.
 * - Disconnects MutationObservers
 * - Removes from initialized set (allows re-initialization if elements are re-added)
 * - Clears visual states
 *
 * Note: Does not remove the global outside-click listener (shared + harmless).
 */
export function destroySelects(scope = document) {
  const selects = [
    ...(scope.matches?.(selectors.component) ? [scope] : []),
    ...Array.from(scope.querySelectorAll(selectors.component)),
  ];

  selects.forEach((selectEl) => {
    // Disconnect observer if present
    const mo = selectObservers.get(selectEl);
    if (mo) {
      mo.disconnect();
      selectObservers.delete(selectEl);
    }

    // Remove every listener init attached so re-init does not double-bind
    const bindings = selectListeners.get(selectEl);
    if (bindings) {
      bindings.nativeSelect.removeEventListener("change", bindings.onNativeChange);
      bindings.parentForm?.removeEventListener("reset", bindings.onFormReset);
      bindings.trigger.removeEventListener("click", bindings.onTriggerClick);
      selectEl.removeEventListener("click", bindings.onSelectClick);
      selectEl.removeEventListener("keydown", bindings.onSelectKeydown);
      selectListeners.delete(selectEl);
    }

    // Allow re-init in the future
    initializedSelects.delete(selectEl);
    activeSelectElements.delete(selectEl);

    // Clean up our visual/ARIA state we added
    formDom.setState(selectEl, "open", false);
    formDom.setState(selectEl, "disabled", false);
    formDom.setState(selectEl, "placeholder", false);

    const trigger = selectEl.querySelector(selectors.trigger);
    if (trigger) {
      trigger.removeAttribute("aria-expanded");
      trigger.removeAttribute("aria-disabled");
      trigger.removeAttribute("tabindex");
    }
  });
}
