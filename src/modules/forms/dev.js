import { formConfig } from "./config.js";
import { formDom, formFields, formValues, formApp, formLogger } from "./core.js";

// Dev mode is controlled solely by whether this module is imported: import
// ./dev.js for logging, dev table, and sessionStorage persistence; leave it
// out for zero overhead. No URL params or localStorage flags. Toggle via the
// commented-out import in loader.js; not reachable from index.js.

const SELECTORS = formConfig.selectors;

formLogger.log = (formOrRoot, message, data) => {
  console.log('[Suttons Dev]', message, data ?? '');
};
formLogger.warn = (formOrRoot, message, data) => {
  console.warn('[Suttons Dev]', message, data ?? '');
};
formLogger.error = (formOrRoot, message, data) => {
  console.error('[Suttons Dev]', message, data ?? '');
};

formLogger.log(null, 'dev.js loaded - extensive logging + dev table active');

function collectSubmissionData(form) {
  formLogger.log(form, 'collectSubmissionData: start');
  const data = {};
  const entries = Array.from(new FormData(form.root).entries());

  formLogger.log(form, 'collectSubmissionData: scanning FormData entries', { count: entries.length });

  entries.forEach(([name, value]) => {
    if (!name) return;
    const normalizedValue = value instanceof File ? value.name : value;

    if (Object.prototype.hasOwnProperty.call(data, name)) {
      data[name] = Array.isArray(data[name])
        ? [...data[name], normalizedValue]
        : [data[name], normalizedValue];
    } else {
      data[name] = normalizedValue;
    }

    formLogger.log(form, 'collectSubmissionData: collected', {
      name,
      valuePreview: String(normalizedValue).slice(0, 80),
    });
  });

  formLogger.log(form, 'collectSubmissionData: done', { entryCount: entries.length, total: Object.keys(data).length });
  console.table(data);
  return data;
}

function collectQaData(form, submittedData = {}) {
  formLogger.log(form, 'collectQaData: start');
  const qaData = {};
  const fields = formDom.getFields(form.root);
  const hasSubmittedField = (name) => Object.prototype.hasOwnProperty.call(submittedData, name);

  fields.forEach((wrapper) => {
    const field = formFields.getInputFromWrapper(wrapper);
    if (!field || field.type === "file") return;

    const name = formFields.getFieldKey(wrapper);
    if (hasSubmittedField(name)) return;

    const values = formValues.get(form.root, name);
    if (values.length) {
      qaData[name] = values.length === 1 ? values[0] : values;
    }
  });

  form.root.querySelectorAll("input[type=hidden]").forEach((hidden) => {
    if (hasSubmittedField(hidden.name)) return;
    if (hidden.name && !Object.prototype.hasOwnProperty.call(qaData, hidden.name)) {
      qaData[hidden.name] = hidden.value;
    }
  });

  formLogger.log(form, 'collectQaData: done', { total: Object.keys(qaData).length });
  return qaData;
}

function collectHiddenFields(form) {
  formLogger.log(form, 'collectHiddenFields: start');
  const hiddenFields = [];

  formDom.getFields(form.root).forEach((wrapper) => {
    const field = formFields.getInputFromWrapper(wrapper);
    if (!field || !field.disabled) return;

    const name = formFields.getFieldKey(wrapper);
    if (!name) return;

    const conditional = wrapper.closest(SELECTORS.conditional);
    const showIf = (conditional?.getAttribute('data-form-show-if') || '').trim();
    const showIfGroup = (conditional?.getAttribute('data-form-show-if-group') || '').trim();
    const showIfValue = (conditional?.getAttribute('data-form-show-if-value') || '').trim();
    const hideIf = (conditional?.getAttribute('data-form-hide-if') || '').trim();
    const hideIfGroup = (conditional?.getAttribute('data-form-hide-if-group') || '').trim();
    const hideIfValue = (conditional?.getAttribute('data-form-hide-if-value') || '').trim();
    const hideIfAny = (conditional?.getAttribute('data-form-hide-if-any') || '').trim();
    const hideIfAnyGroup = (conditional?.getAttribute('data-form-hide-if-any-group') || '').trim();
    const rule = conditional
      ? showIf
        ? `show-if: ${showIf}`
        : showIfGroup
          ? `show-if: ${showIfGroup}${showIfValue ? ' = ' + showIfValue : ''}`
          : hideIf
            ? `hide-if: ${hideIf}`
            : hideIfGroup
              ? `hide-if: ${hideIfGroup}${hideIfValue ? ' = ' + hideIfValue : ''}`
              : hideIfAny
                ? `hide-if-any: ${hideIfAny}`
                : hideIfAnyGroup
                  ? `hide-if-any: ${hideIfAnyGroup}`
                  : 'hidden'
      : 'disabled';

    hiddenFields.push({ name, rule });
    formLogger.log(form, 'collectHiddenFields: recorded disabled/conditional', { name, rule });
  });

  formLogger.log(form, 'collectHiddenFields: done', { count: hiddenFields.length });
  return hiddenFields;
}

function createTable(headers, rows, cellStyles) {
  formLogger.log(null, 'createTable: building', { headers, rowCount: rows.length });
  const table = document.createElement("table");
  Object.assign(table.style, { borderCollapse: "collapse", width: "100%" });

  const headerRow = table.insertRow();
  headers.forEach((text) => {
    const th = document.createElement("th");
    th.textContent = text;
    Object.assign(th.style, cellStyles.header);
    headerRow.appendChild(th);
  });

  rows.forEach((items) => {
    const row = table.insertRow();
    items.forEach((item, i) => {
      const cell = row.insertCell();
      cell.textContent = item;
      Object.assign(cell.style, i === 0 ? cellStyles.bold : cellStyles.normal);
    });
  });

  formLogger.log(null, 'createTable: done');
  return table;
}

function isVisible(element) {
  if (!element) return false;
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
}

function buildDevTable(form, data, hiddenFields, appendTo, qaData = {}) {
  formLogger.log(form, 'buildDevTable: start', {
    dataKeys: Object.keys(data).length,
    qaKeys: Object.keys(qaData).length,
    hiddenCount: hiddenFields.length,
  });

  const cellStyle = { border: "1px solid #ddd", padding: "8px" };
  const styles = {
    header: { ...cellStyle, backgroundColor: "#f5f5f5", textAlign: "left" },
    bold: { ...cellStyle, fontWeight: "bold" },
    normal: cellStyle,
  };

  const container = document.createElement("div");
  Object.assign(container.style, {
    width: "100vw",
    minWidth: "0px",
    margin: "16px 0",
    padding: "12px",
    background: "#fafafa",
    border: "1px solid #ddd",
    fontSize: "12px",
    fontFamily: "monospace",
  });

  const title = document.createElement("h3");
  title.textContent = "Raw FormData Submitted";
  title.style.margin = "0 0 12px 0";

  const submissionTable = createTable(
    ["Field", "Value"],
    Object.entries(data).map(([key, value]) => [key, typeof value === "string" ? value : JSON.stringify(value)]),
    styles,
  );

  container.appendChild(title);
  container.appendChild(submissionTable);

  if (Object.keys(qaData).length) {
    const qaTitle = document.createElement("h3");
    qaTitle.textContent = "QA / Demo Field Data";
    qaTitle.style.margin = "24px 0 12px 0";

    const qaTable = createTable(
      ["Field", "Value"],
      Object.entries(qaData).map(([key, value]) => [key, typeof value === "string" ? value : JSON.stringify(value)]),
      styles,
    );

    container.appendChild(qaTitle);
    container.appendChild(qaTable);
  }

  if (hiddenFields.length) {
    formLogger.log(form, 'buildDevTable: adding hidden fields section', { count: hiddenFields.length });
    const hiddenTitle = document.createElement("h3");
    hiddenTitle.textContent = "Hidden / Disabled Fields";
    hiddenTitle.style.margin = "24px 0 12px 0";

    const hiddenTable = createTable(
      ["Field", "Rule / Reason"],
      hiddenFields.map((item) => [item.name, item.rule]),
      styles,
    );

    container.appendChild(hiddenTitle);
    container.appendChild(hiddenTable);
  }

  const scope = form.scope || form.root || document;
  const priorCount = scope.querySelectorAll('[data-form-dev-table]').length;
  scope.querySelectorAll('[data-form-dev-table]').forEach((el) => el.remove());
  if (priorCount) {
    formLogger.log(form, 'buildDevTable: removed prior dev tables', { count: priorCount });
  }

  container.setAttribute('data-form-dev-table', '');

  if (appendTo) {
    formLogger.log(form, 'buildDevTable: using explicit appendTo target');
    appendTo.appendChild(container);
    return container;
  }

  const done = formDom.getDone(form);
  const fail = formDom.getFail(form);
  const target = isVisible(done)
    ? done
    : isVisible(fail)
      ? fail
      : form.scope || form.root || document.body;
  formLogger.log(form, 'buildDevTable: resolved target for injection', {
    target: target === document.body ? 'body' : (target.tagName || 'unknown'),
    isDone: target === done,
    isFail: target === fail,
  });
  target.appendChild(container);
  formLogger.log(form, 'buildDevTable: container appended to target');
}

export function injectDevTable(form) {
  formLogger.log(form, 'injectDevTable: start');

  let data, hiddenFields, qaData;
  const hadSnapshot = !!form._devSubmissionData;
  if (hadSnapshot) {
    ({ data, hiddenFields, qaData } = form._devSubmissionData);
    delete form._devSubmissionData;
    formLogger.log(form, 'injectDevTable: consumed snapshot', {
      fieldCount: Object.keys(data).length,
      qaFieldCount: Object.keys(qaData || {}).length,
    });
  } else {
    formLogger.log(form, 'injectDevTable: no snapshot, performing fresh collection');
    data = collectSubmissionData(form);
    qaData = collectQaData(form, data);
    hiddenFields = collectHiddenFields(form);
  }

  formLogger.log(form, 'injectDevTable: data ready', {
    submittedFields: Object.keys(data).length,
    qaFields: Object.keys(qaData || {}).length,
    hiddenFields: hiddenFields.length,
    usedSnapshot: hadSnapshot,
  });

  buildDevTable(form, data, hiddenFields, undefined, qaData || {});
  formLogger.log(form, 'injectDevTable: build complete');
}

let devObserver = null;
let failureObserver = null;

function setupSuccessObserver() {
  if (devObserver) {
    formLogger.log(null, 'setupSuccessObserver: observer already active');
    return;
  }
  formLogger.log(null, 'setupSuccessObserver: creating new MutationObserver for .w-form-done');
  devObserver = new MutationObserver((mutations) => {
    formLogger.log(null, 'observer: mutation batch', { mutationCount: mutations.length });
    for (const mutation of mutations) {
      if (mutation.addedNodes && mutation.addedNodes.length) {
        formLogger.log(null, 'observer: childList added', { count: mutation.addedNodes.length });
      }
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== 1) continue;
        const dones = node.matches?.('.w-form-done') ? [node] : (node.querySelectorAll?.('.w-form-done') || []);
        if (dones.length) {
          formLogger.log(null, 'observer: found .w-form-done via addedNodes', { count: dones.length });
        }
        for (const done of dones) {
          tryInjectIntoOutcome(done);
        }
      }
      if (mutation.type === 'attributes' && mutation.target.matches?.('.w-form-done')) {
        const done = mutation.target;
        formLogger.log(null, 'observer: attribute mutation on .w-form-done', { type: mutation.attributeName });
        if (isVisible(done) && !done.hasAttribute('hidden')) {
          formLogger.log(null, 'observer: .w-form-done now visible via attr change');
          tryInjectIntoOutcome(done);
        }
      }
    }
  });
  devObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style', 'class', 'hidden']
  });
  formLogger.log(null, 'setupSuccessObserver: observer now watching document');
}

function setupFailureObserver() {
  if (failureObserver) {
    formLogger.log(null, 'setupFailureObserver: observer already active');
    return;
  }
  formLogger.log(null, 'setupFailureObserver: creating new MutationObserver for .w-form-fail');
  failureObserver = new MutationObserver((mutations) => {
    formLogger.log(null, 'failure observer: mutation batch', { mutationCount: mutations.length });
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes || []) {
        if (node.nodeType !== 1) continue;
        const fails = node.matches?.('.w-form-fail') ? [node] : (node.querySelectorAll?.('.w-form-fail') || []);
        for (const fail of fails) {
          tryInjectIntoOutcome(fail);
        }
      }
      if (mutation.type === 'attributes' && mutation.target.matches?.('.w-form-fail')) {
        const fail = mutation.target;
        formLogger.log(null, 'failure observer: attribute mutation on .w-form-fail', { type: mutation.attributeName });
        if (isVisible(fail) && !fail.hasAttribute('hidden')) {
          formLogger.log(null, 'failure observer: .w-form-fail now visible via attr change');
          tryInjectIntoOutcome(fail);
        }
      }
    }
  });
  failureObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style', 'class', 'hidden']
  });
  formLogger.log(null, 'setupFailureObserver: observer now watching document');
}

function resolveFormRoot(target) {
  if (!target) return document.querySelector(SELECTORS.root);
  if (target.matches?.(SELECTORS.root)) return target;
  if (target.root instanceof HTMLFormElement) return target.root;
  const nested = target.querySelector?.(SELECTORS.root);
  if (nested) return nested;
  return null;
}

function describeFieldVisibility(control) {
  if (control.type === "hidden") return "hidden";
  if (formDom.isConditionHidden(control)) return "condition-hidden";
  if (formDom.isStepHidden(control)) return "step-hidden";
  if (control.hidden) return "hidden";
  const style = window.getComputedStyle(control);
  if (style.display === "none" || style.visibility === "hidden") return "css-hidden";
  return "visible";
}

function previewValue(control) {
  if (formValues.isChoiceField(control)) {
    return control.checked ? control.value : "";
  }
  if (control.tagName === "SELECT" && control.multiple) {
    return Array.from(control.selectedOptions).map((option) => option.value).join(", ");
  }
  if (control.type === "file") {
    return control.files?.length ? Array.from(control.files).map((file) => file.name).join(", ") : "";
  }
  return String(control.value ?? "");
}

function scanFormFields(target, options = {}) {
  const root = resolveFormRoot(target);
  if (!root) {
    formLogger.warn(null, "scanFields: no [data-form] root found", { target });
    return [];
  }

  const form = formApp.getFormByRoot?.(root);
  const reportedNames = new Set();
  const rows = [];

  formDom.getControls(root).forEach((control) => {
    const name = control.name || control.id;
    if (!name) return;
    if (formValues.isChoiceField(control)) {
      if (reportedNames.has(name)) return;
      reportedNames.add(name);
    } else if (reportedNames.has(name)) {
      return;
    } else {
      reportedNames.add(name);
    }

    const value = formValues.isChoiceField(control)
      ? formValues.get(root, name).join(", ")
      : previewValue(control);
    const visibility = describeFieldVisibility(control);
    const omitted = formValues.shouldOmitControl(control);
    const submits = !omitted
      && !control.disabled
      && control.tagName !== "BUTTON"
      && control.type !== "submit"
      && control.type !== "reset";

    rows.push({
      name,
      type: control.type || control.tagName.toLowerCase(),
      value: value.length > 80 ? `${value.slice(0, 77)}...` : value,
      required: formFields.isRequired(control),
      visibility,
      disabled: control.disabled,
      submits,
      fieldKey: formFields.getFieldKey(control) || name,
    });
  });

  const label = options.label || root.getAttribute("data-form") || root.id || "form";
  formLogger.log(form || root, `scanFields: ${rows.length} controls`, { label, submits: rows.filter((row) => row.submits).length });
  console.groupCollapsed(`[Suttons Dev] scanFields — ${label}`);
  console.table(rows);
  console.groupEnd();
  return rows;
}

function setupDevHelpers() {
  const sr = (window.sr = window.sr || {});
  sr.dev = sr.dev || {};

  sr.dev.forms = () => {
    const all = document.querySelectorAll(SELECTORS.root);
    const report = [];
    all.forEach((form) => {
      const type = form.getAttribute("data-form") || "unknown";
      const steps = form.querySelectorAll("[data-form-step]").length;
      const fields = form.querySelectorAll("[data-form-field]").length;
      const goldItems = form.querySelectorAll("[data-form-gold-item]").length;
      const loanActive = !!form.querySelector("[data-form-loan-amount]");
      report.push({ type, steps, fields, goldItems, loanActive, element: form });
    });
    console.table(report.map((row) => ({
      ...row,
      element: row.element.tagName + (row.element.id ? `#${row.element.id}` : ""),
    })));
    return report;
  };

  sr.dev.scanFields = (target) => scanFormFields(target);
  sr.dev.scanAll = () => {
    const roots = [...document.querySelectorAll(SELECTORS.root)];
    return roots.map((root) => scanFormFields(root));
  };

  sr.dev.gold = () => {
    const forms = document.querySelectorAll("form[data-form-gold]");
    const report = [];
    forms.forEach((form) => {
      const rows = form.querySelectorAll("[data-form-gold-pricing-row]").length;
      const items = form.querySelectorAll("[data-form-gold-item]").length;
      const spot = form.querySelector('[data-form-gold-output="spot_price_gbp_gram"]')?.textContent || "N/A";
      const purchase = form.querySelector('[data-form-gold-output="purchase_total"]')?.textContent || "N/A";
      const loan = form.querySelector('[data-form-gold-output="loan_total"]')?.textContent || "N/A";
      const interest = form.querySelector('[data-form-gold-output="interest_rate"]')?.textContent || "N/A";
      const status = form.getAttribute("data-form-state") || "N/A";
      report.push({ rows, items, spot, purchase, loan, interest, status });
    });
    console.table(report);
    return report;
  };

  sr.dev.loan = () => {
    const forms = document.querySelectorAll("form[data-form-loan]");
    const report = [];
    forms.forEach((form) => {
      const amount = form.querySelector("[data-form-loan-amount]")?.textContent || "N/A";
      const months = form.querySelector('[name="loan_duration"]:checked')?.value || "N/A";
      const rate = form.querySelector('[data-form-loan-output="interest_rate"]')?.textContent || "N/A";
      const total = form.querySelector('[data-form-loan-output="total_redeem"]')?.textContent || "N/A";
      const savings = form.querySelector('[data-form-loan-output="help"]')?.textContent
        || form.querySelector('[data-form-loan-output="savings"]')?.textContent
        || "N/A";
      report.push({ amount, months, rate, total, savings });
    });
    console.table(report);
    return report;
  };

  sr.dev.config = () => {
    import("./config.js").then(({ formConfig: config }) => {
      console.log("formConfig.gold:", config.gold);
      console.log("formConfig.loan:", config.loan);
      console.log("formConfig.uploads:", config.uploads);
      console.log("formConfig.address:", config.address);
    });
  };

  sr.dev.pricingRows = () => {
    const rows = document.querySelectorAll("[data-form-gold-pricing-row]");
    const data = Array.from(rows).map((row) => {
      const fields = {};
      row.querySelectorAll("[data-form-gold-pricing-field]").forEach((field) => {
        fields[field.getAttribute("data-form-gold-pricing-field")] = field.textContent.trim();
      });
      return fields;
    });
    console.table(data.slice(0, 50));
    console.log(`Total: ${data.length} rows (showing first 50)`);
    return data;
  };

  console.log(
    "%c[Suttons Dev] Helpers ready. Try: sr.dev.scanAll(), sr.dev.scanFields(form), sr.dev.gold(), sr.dev.loan()",
    "color: #b8860b;",
  );
}

setupDevHelpers();

function tryInjectIntoOutcome(outcomeEl) {
  formLogger.log(null, 'tryInjectIntoOutcome: called');
  const wform = outcomeEl.closest('.w-form');
  if (!wform) {
    formLogger.log(null, 'tryInjectIntoOutcome: no ancestor .w-form, skipping');
    return;
  }
  const root = wform.querySelector('[data-form]');
  if (!root) {
    formLogger.log(null, 'tryInjectIntoOutcome: .w-form has no [data-form] root, skipping');
    return;
  }
  const form = formApp.getFormByRoot ? formApp.getFormByRoot(root) : null;
  const hasSnapshot = !!(form && form._devSubmissionData);
  formLogger.log(null, 'tryInjectIntoOutcome: resolved', {
    hasWform: !!wform,
    hasRoot: !!root,
    hasForm: !!form,
    hasSnapshot
  });
  if (form && form._devSubmissionData) {
    formLogger.log(form, 'tryInjectIntoOutcome: snapshot present, triggering injectDevTable');
    injectDevTable(form);
  } else if (form) {
    formLogger.log(form, 'tryInjectIntoOutcome: form instance found but no snapshot yet (may be race)');
  }
}

document.addEventListener('suttons:form-submit', (e) => {
  console.groupCollapsed('[Suttons Dev] suttons:form-submit');
  formLogger.log(null, 'event received', { hasDetail: !!e.detail });
  const { form } = e.detail || {};
  if (!form) {
    formLogger.log(null, 'no form in detail, abort');
    console.groupEnd();
    return;
  }

  formLogger.log(form, 'submit event for dev table, snapshotting data now');

  const data = collectSubmissionData(form);
  const qaData = collectQaData(form, data);
  const hiddenFields = collectHiddenFields(form);
  form._devSubmissionData = { data, qaData, hiddenFields };

  try {
    sessionStorage.setItem('sr_form_dev_data', JSON.stringify(form._devSubmissionData));
  } catch (storageError) {}

  formLogger.log(form, 'snapshot stored', {
    fieldCount: Object.keys(data).length,
    qaFieldCount: Object.keys(qaData).length,
    hiddenCount: hiddenFields.length,
  });

  formLogger.log(form, 'ensuring success observer is active');
  setupSuccessObserver();
  setupFailureObserver();

  const done = formDom.getDone(form);
  const fail = formDom.getFail(form);
  if (done) {
    formLogger.log(form, 'immediate done check', { hasDone: true, visible: isVisible(done) });
  }
  if (fail) {
    formLogger.log(form, 'immediate fail check', { hasFail: true, visible: isVisible(fail) });
  }
  if (isVisible(done) || isVisible(fail)) {
    formLogger.log(form, 'outcome already visible, injecting table immediately');
    injectDevTable(form);
  } else if (!done && !fail) {
    formLogger.log(form, 'no outcome containers yet, observers will watch for them');
  } else {
    formLogger.log(form, 'outcome hidden, observers will wait for visibility changes');
  }
  console.groupEnd();
});

try {
  const stored = sessionStorage.getItem('sr_form_dev_data');
  if (stored) {
    sessionStorage.removeItem('sr_form_dev_data');
    const { data, qaData, hiddenFields } = JSON.parse(stored);
    formLogger.log(null, 'rendering persisted dev table from sessionStorage', {
      fieldCount: Object.keys(data).length,
      qaFieldCount: Object.keys(qaData || {}).length,
      hiddenCount: hiddenFields?.length,
    });
    const footer = document.querySelector('footer');
    if (footer) {
      const wrap = document.createElement('div');
      wrap.style.margin = '24px 0';
      footer.parentNode.insertBefore(wrap, footer);
      buildDevTable({}, data, hiddenFields || [], wrap, qaData || {});
    } else {
      buildDevTable({}, data, hiddenFields || [], undefined, qaData || {});
    }
  }
} catch (e) {}
