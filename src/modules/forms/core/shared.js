import { formConfig, fieldTypes, fieldFilters, fieldValidators, fieldRules, cleanPhoneInput, buildPhoneValue } from "../config.js";
import { isElement as isDomElement, escapeSelector, closestWithin as closestWithinRoot } from "../../../utils/dom.js";
import { parseNumber } from "../shared.js";

const SELECTORS = formConfig.selectors;

function isEnabledAttribute(element, name) {
  if (!element?.hasAttribute?.(name)) return false;
  const value = String(element.getAttribute(name) || '').trim().toLowerCase();
  return value === 'true';
}

function formatGroupValue(values) {
  return values.length === 1 ? values[0] : values.join(',');
}

export {
  formConfig,
  fieldTypes,
  fieldFilters,
  fieldValidators,
  fieldRules,
  cleanPhoneInput,
  buildPhoneValue,
  parseNumber,
  isDomElement,
  escapeSelector,
  closestWithinRoot,
  SELECTORS,
  isEnabledAttribute,
  formatGroupValue,
};
