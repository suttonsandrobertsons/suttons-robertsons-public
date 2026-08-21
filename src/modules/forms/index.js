export { formConfig, TRACKING_FIELDS } from "./config.js";
export {
  formDom,
  formValues,
  formUploads,
  formFields,
  formChoices,
  formConditions,
  formSteps,
  formRedirect,
  formAttribution,
  formSuccessPage,
  formParams,
  formEvents,
  formApp,
  formLogger,
  formSync,
} from "./core.js";

import { formApp } from "./core.js";
import { initSelects, destroySelects } from "./selects.js";
import { initGoldForms } from "./gold.js";
import { initLoanForms } from "./loan.js";
import { initAddressForms } from "./address.js";
import { scheduleAfterDomUpdate } from "./core/webflow.js";
import { formSync, SYNC_FORM_SELECTOR } from "./core/sync.js";
import { initSyncSubmitGuard } from "./core/events.js";

/**
 * Initialise all form subsystems within `scope` (default: full document).
 * Safe to call again after DOM is injected later (e.g. Finsweet fs-inject):
 * each sub-module guards with a one-time flag (readyRoots,
 * data-form-address-initialised, per-form WeakSet, etc.).
 */
export function initForms(scope = document) {
  getFormScopes(scope).forEach((domScope) => {
    primeSyncForms(domScope);
    initSelects(domScope);
    initGoldForms(domScope);
    initLoanForms(domScope);
    initAddressForms(domScope);
    formApp.boot(domScope);
  });
}

function primeSyncForms(scope = document) {
  const roots = [
    ...(scope.matches?.(SYNC_FORM_SELECTOR) ? [scope] : []),
    ...Array.from(scope.querySelectorAll?.(SYNC_FORM_SELECTOR) || []),
  ];

  roots.forEach((root) => formSync.primeRoot(root));
}

function isShadowRoot(value) {
  return typeof ShadowRoot !== 'undefined' && value instanceof ShadowRoot;
}

function isConnectedScope(scope) {
  if (scope === document) return true;
  if (isShadowRoot(scope)) return Boolean(scope.host?.isConnected);
  return Boolean(scope?.isConnected);
}

function getFormScopes(scope = document) {
  const scopes = [];
  const seen = new Set();

  const visit = (root) => {
    if (!root || seen.has(root)) return;
    seen.add(root);

    if (!isConnectedScope(root)) return;

    scopes.push(root);

    const elements = [
      ...(root instanceof Element ? [root] : []),
      ...Array.from(root.querySelectorAll?.('*') || []),
    ];

    elements.forEach((element) => {
      if (element.shadowRoot) {
        visit(element.shadowRoot);
      }
    });
  };

  visit(scope);
  return scopes;
}

export { destroySelects };

function registerInjectHook(initFormsFn) {
  if (typeof window === 'undefined') return;

  const onInject = () => scheduleAfterDomUpdate(() => initFormsFn(document));
  window.FinsweetAttributes ||= [];
  window.FinsweetAttributes.push(['inject', onInject]);

  onInject();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onInject);
  }
  window.addEventListener('load', onInject);
}

function registerSyncFormObserver(initFormsFn) {
  if (typeof MutationObserver === 'undefined' || typeof document === 'undefined') return;

  const observer = new MutationObserver((mutations) => {
    const hasSyncForm = mutations.some((mutation) => {
      return [...mutation.addedNodes].some((node) => {
        return nodeHasSyncForm(node);
      });
    });

    if (!hasSyncForm) return;
    scheduleAfterDomUpdate(() => initFormsFn(document));
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
}

function nodeHasSyncForm(node) {
  if (!(node instanceof Element)) return false;
  if (node.matches?.(SYNC_FORM_SELECTOR)) return true;
  if (node.querySelector?.(SYNC_FORM_SELECTOR)) return true;

  const scopes = getFormScopes(node);
  return scopes.some((scope) => {
    if (scope === node) return false;
    return Boolean(scope.querySelector?.(SYNC_FORM_SELECTOR));
  });
}

registerInjectHook(initForms);
registerSyncFormObserver(initForms);
initSyncSubmitGuard();
