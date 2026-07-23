import { SELECTORS, formConfig, escapeSelector, formatGroupValue } from './shared.js';
import { formDom } from './dom.js';

function shouldReadCheckbox(checkbox) {
  return checkbox.checked && !checkbox.disabled && !formDom.isConditionHidden(checkbox);
}

// ============================================================================
export const formChoices = {
  configure(form) {
    form.root.querySelectorAll(SELECTORS.choice).forEach((choice) => {
      const input = this.getInput(choice);

      if (!input) {
        throw new Error('[data-form-choice] must contain a radio or checkbox input.');
      }

      choice.setAttribute('role', input.type === 'radio' ? 'radio' : 'checkbox');
      choice.setAttribute('tabindex', '0');
      choice.addEventListener('keydown', (event) => {
        this.handleKeydown(event, input);
      });
    });

    this.registerCheckboxFields(form);
  },

  registerCheckboxFields(form) {
    const groups = new Map();
    const nativeNameCounts = this.getNativeNameCounts(form.root);

    form.root.querySelectorAll("input[type='checkbox']").forEach((checkbox) => {
      const fieldName = this.getCheckboxFieldName(checkbox);
      const groupName = this.getCheckboxGroupName(checkbox);
      if (!fieldName && !groupName) return;

      if (fieldName && !checkbox.getAttribute('data-form-name')) {
        checkbox.setAttribute('data-form-name', fieldName);
      }
      if (groupName) {
        checkbox.setAttribute('data-form-group-name', groupName);
      }

      if (fieldName && (!checkbox.name || nativeNameCounts.get(fieldName) > 1)) {
        this.addCheckboxGroup(groups, fieldName, checkbox, Boolean(checkbox.name));
      }
      this.addCheckboxGroup(groups, groupName, checkbox, true);
    });

    groups.forEach((group, fieldName) => {
      const hidden = this.ensureCheckboxHidden(form.root, fieldName, group.asList);
      this.setNativeCollisionFlag(hidden, this.groupCollidesWithNativeName(fieldName, group));
    });
  },

  getCheckboxFieldName(checkbox) {
    return checkbox.getAttribute('data-form-name') || checkbox.name || this.getCheckboxGroupName(checkbox);
  },

  getCheckboxGroupName(checkbox) {
    const group = checkbox.closest(SELECTORS.choiceGroup);
    if (!group) return '';

    const choiceGroupName = (group.getAttribute('data-form-choice-group') || '').trim();
    if (choiceGroupName && choiceGroupName !== 'true' && choiceGroupName !== 'false') {
      return choiceGroupName;
    }

    return (group.getAttribute('data-form-field') || '').trim();
  },

  addCheckboxGroup(groups, fieldName, checkbox, asList) {
    if (!fieldName) return;

    if (!groups.has(fieldName)) {
      groups.set(fieldName, { checkboxes: [], asList: false });
    }

    const group = groups.get(fieldName);
    if (!group.checkboxes.includes(checkbox)) {
      group.checkboxes.push(checkbox);
    }
    group.asList = group.asList || asList;
  },

  ensureCheckboxHidden(root, fieldName, asList = false) {
    let hidden = root.querySelector(`input[type='hidden'][data-form-name='${formDom.escape(fieldName)}']`);
    if (!hidden) {
      hidden = root.querySelector(`input[type='hidden'][name='${formDom.escape(fieldName)}']`);
    }
    if (!hidden) {
      hidden = document.createElement('input');
      hidden.type = 'hidden';
      hidden.name = fieldName;
      root.appendChild(hidden);
    }

    hidden.setAttribute('data-form-name', fieldName);
    if (asList) hidden.setAttribute('data-form-checkbox-list', 'true');
    return hidden;
  },

  handleKeydown(event, input) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (!input || input.disabled) return;
    const choice = input.closest(SELECTORS.choice);
    if (choice && this.shouldLetNestedControlHandleClick(event, choice, input)) return;
    event.preventDefault();
    this.emitChangeWhenChanged(input);
  },

  handleClick(event, choice) {
    const input = this.getInput(choice);
    if (!input || input.disabled) return false;
    if (event.target === input) return false;
    if (this.shouldLetNestedControlHandleClick(event, choice, input)) return false;

    event.preventDefault();
    return this.emitChangeWhenChanged(input);
  },

  shouldLetNestedControlHandleClick(event, choice, input) {
    const target = event.target;
    if (!target?.closest) return false;

    const nestedControl = target.closest('a[href], button, [role="link"]');
    return Boolean(nestedControl && choice.contains(nestedControl) && nestedControl !== input);
  },

  emitChangeWhenChanged(input) {
    if (!this.toggleInput(input)) return false;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  },

  render(form) {
    this.syncCheckboxFields(form);

    form.root.querySelectorAll(SELECTORS.choice).forEach((choice) => {
      const input = this.getInput(choice);
      const isSelected = Boolean(input && input.checked);

      formDom.setState(choice, 'selected', isSelected);
      choice.setAttribute('aria-checked', isSelected ? 'true' : 'false');
    });
  },

  syncCheckboxFields(form) {
    const groups = new Map();
    const nativeNameCounts = this.getNativeNameCounts(form.root);

    form.root.querySelectorAll("input[type='checkbox']").forEach((checkbox) => {
      const fieldName = this.getCheckboxFieldName(checkbox);
      const groupName = this.getCheckboxGroupName(checkbox);

      if (fieldName && (!checkbox.name || nativeNameCounts.get(fieldName) > 1)) {
        this.addCheckboxGroup(groups, fieldName, checkbox, Boolean(checkbox.name));
      }
      this.addCheckboxGroup(groups, groupName, checkbox, true);
    });

    groups.forEach((group, fieldName) => {
      const hidden = this.ensureCheckboxHidden(form.root, fieldName, group.asList);
      const collidesWithNativeName = this.groupCollidesWithNativeName(fieldName, group);
      this.setNativeCollisionFlag(hidden, collidesWithNativeName);

      const checked = group.checkboxes.filter((checkbox) => {
        return shouldReadCheckbox(checkbox);
      });

      if (!checked.length) {
        hidden.value = '';
        hidden.disabled = true;
        return;
      }

      const values = checked.map((checkbox) => checkbox.value || 'on');
      hidden.value = formatGroupValue(values);
      hidden.disabled = collidesWithNativeName;
    });
  },

  prepareFieldsForSubmit(form) {
    const root = form?.root;
    if (!root) return;

    const groups = new Map();
    const nativeNameCounts = this.getNativeNameCounts(root);
    root.querySelectorAll("input[type='checkbox']").forEach((checkbox) => {
      const fieldName = this.getCheckboxFieldName(checkbox);
      if (fieldName && checkbox.name && nativeNameCounts.get(fieldName) > 1) {
        this.addCheckboxGroup(groups, fieldName, checkbox, true);
      }
      this.addCheckboxGroup(groups, this.getCheckboxGroupName(checkbox), checkbox, true);
    });

    groups.forEach((group, fieldName) => {
      if (!this.groupCollidesWithNativeName(fieldName, group)) return;

      const hidden = this.ensureCheckboxHidden(root, fieldName, true);
      this.setNativeCollisionFlag(hidden, true);

      const checked = group.checkboxes.filter((checkbox) => {
        return shouldReadCheckbox(checkbox);
      });

      if (!checked.length) {
        hidden.value = '';
        hidden.disabled = true;
      } else {
        hidden.value = formatGroupValue(checked.map((checkbox) => checkbox.value || 'on'));
        hidden.disabled = false;
      }

      // Disable the native checkboxes so only the aggregated hidden field is
      // submitted under the colliding name. Re-enable is not done here: the next
      // render pass (formFields.render -> shouldDisableControlDuringRender) clears
      // disabled on all non-file controls, so a failed/non-navigating submit
      // recovers on the next refresh.
      group.checkboxes.forEach((checkbox) => {
        checkbox.disabled = true;
      });
    });
  },

  groupCollidesWithNativeName(fieldName, group) {
    if (!group?.asList) return false;
    return group.checkboxes.some((checkbox) => checkbox.name === fieldName);
  },

  setNativeCollisionFlag(hidden, collides) {
    if (!hidden) return;
    if (collides) {
      hidden.setAttribute('data-form-checkbox-native-collision', 'true');
    } else {
      hidden.removeAttribute('data-form-checkbox-native-collision');
    }
  },

  getNativeNameCounts(root) {
    const counts = new Map();
    root.querySelectorAll("input[type='checkbox'][name]").forEach((checkbox) => {
      counts.set(checkbox.name, (counts.get(checkbox.name) || 0) + 1);
    });
    return counts;
  },

  getInput(choice) {
    return choice.querySelector(SELECTORS.choiceInput);
  },

  clearNamedChoiceError(root, input) {
    if (!root || !input) return;

    const fieldName = input.getAttribute('data-form-name') || input.name;
    if (!fieldName) return;

    const selector = input.type === 'checkbox'
      ? `input[type='checkbox'][data-form-name='${formDom.escape(fieldName)}']`
      : `input[type='radio'][name="${escapeSelector(fieldName)}"]`;

    root.querySelectorAll(selector).forEach((field) => {
      field.removeAttribute('aria-invalid');
      const choice = field.closest(SELECTORS.choice);
      if (choice) formDom.setState(choice, 'invalid', false);
    });
  },

  toggleInput(input) {
    const wasChecked = input.checked;

    if (input.type === 'radio') {
      if (wasChecked) return false;
      input.checked = true;
      return true;
    }

    // A checkbox toggle always flips state, so this is always a change.
    input.checked = !wasChecked;
    return true;
  },
};

// ============================================================================
