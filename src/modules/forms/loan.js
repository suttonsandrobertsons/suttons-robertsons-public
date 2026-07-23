import { formConfig } from "./config.js";
import { formLogger, formApp } from "./core.js";
import { roundMoney, formatMoney, formatNumber, parseNumber, getRateBand, debounce } from "./shared.js";
import { initRangeSliders } from "./range-slider.js";

const SELECTORS = {
  form: "[data-form-loan]",
  amountInput: "[data-form-loan-amount]",
  durationRadio: "[name='loan_duration']",
  output: "[data-form-loan-output]",
};

function init(form) {
  if (form.hasAttribute("data-form-loan-initialised")) return;
  form.setAttribute("data-form-loan-initialised", "true");

  const input = form.querySelector(SELECTORS.amountInput);
  const radios = form.querySelectorAll(SELECTORS.durationRadio);

  if (!input) return;

  const refresh = debounce(() => {
    try { doRefresh(form); const ctrl = formApp.getFormByRoot?.(form); if (ctrl) formApp.refresh(ctrl); } catch (error) { formLogger.error(form, "loan refresh failed", error); }
  }, 120);

  initRangeSliders(form);

  input.addEventListener("input", refresh);
  radios.forEach((r) => r.addEventListener("change", refresh));
  refresh();
}

function doRefresh(form) {
  const amount = getAmount(form);
  const months = getDuration(form);

  const setField = (name, value) => {
    let field = form.querySelector(`[name="${name}"]`);
    if (!field) {
      field = document.createElement("input");
      field.type = "hidden";
      field.name = name;
      form.appendChild(field);
    }
    field.value = String(value);
    field.disabled = false;
  };

  if (!Number.isFinite(amount) || amount <= 0) {
    form.removeAttribute("data-form-loan-enquiry");
    form.removeAttribute("data-form-loan-saving");
    setOutput(form, "loan_amount", "");
    setOutput(form, "months", "");
    setOutput(form, "interest_rate", "");
    setOutput(form, "monthly_interest", "");
    setOutput(form, "total_interest", "");
    setOutput(form, "total_redeem", "");
    setHelp(form, "");
    setField("requested_amount", "");
    setField("loan_duration_months", "");
    setField("loan_interest_rate", "");
    setField("loan_is_enquiry", "");
    setField("loan_savings", "");
    return;
  }

  const summary = calculateLoanSummary(amount, months);
  const { isEnquiry, rate, monthlyInterest, totalInterest, totalRedeem, savings, hasSaving } = summary;
  const helpValue = formatLoanHelpMessage(summary);

  form.setAttribute("data-form-loan-enquiry", String(isEnquiry));
  form.setAttribute("data-form-loan-saving", String(hasSaving));

  setOutput(form, "loan_amount", formatMoney(amount));
  setOutput(form, "months", String(months));
  // Show up to 1 decimal so banded rates like 6.5% aren't rounded to 7%
  // (whole rates still render clean, e.g. 6%). The submitted loan_interest_rate
  // field below stays the raw numeric value.
  setOutput(form, "interest_rate", isEnquiry ? "" : `${formatNumber(rate, 1)}%`);
  setOutput(form, "monthly_interest", isEnquiry ? "" : formatMoney(monthlyInterest));
  setOutput(form, "total_interest", isEnquiry ? "" : formatMoney(totalInterest));
  setOutput(form, "total_redeem", isEnquiry ? "" : formatMoney(totalRedeem));
  setHelp(form, helpValue);

  setField("requested_amount", amount);
  setField("loan_duration_months", months);
  setField("loan_interest_rate", isEnquiry ? "" : rate);
  setField("loan_is_enquiry", isEnquiry);
  setField("loan_savings", savings);
}

export function calculateLoanSummary(amount, months, config = formConfig.loan) {
  const band = getRateBand(amount, config.rateBands);
  const competitorBand = getRateBand(amount, config.competitorRates);
  // The loan slider caps at config.loan.max (the "£15,000+" position), which represents
  // "£15,000 or more". At or above the cap the loan calculator is an enquiry so the
  // Webflow "Interest rates on loans above £14,999 vary…" banner shows and no rate is
  // submitted. This is a LOAN-CALCULATOR-level override only; getRateBand / rateBands are
  // unchanged, so gold-derived loans of exactly £15,000 remain quotable at 6%.
  const isEnquiry = !band || amount >= config.max;

  const rate = band ? band.interestRate : 0;
  const monthlyInterest = isEnquiry ? 0 : roundMoney(amount * (rate / 100));
  const totalInterest = isEnquiry ? 0 : roundMoney(monthlyInterest * months);
  const totalRedeem = isEnquiry ? 0 : roundMoney(amount + totalInterest);

  const competitorRate = competitorBand ? competitorBand.rate : 0;
  // Competitor rates in `config.loan.competitorRates` are MONTHLY, matching Suttons'
  // monthly `interestRate`, so both totals use the same `rate% * months` basis. Do not
  // divide by 12: a monthly basis is intended and correct.
  const competitorTotal = competitorBand ? roundMoney(amount * (competitorRate / 100) * months) : 0;
  const competitorRedeem = competitorBand ? roundMoney(amount + competitorTotal) : 0;
  const savings = competitorBand && !isEnquiry ? roundMoney(competitorRedeem - totalRedeem) : 0;

  return {
    isEnquiry,
    rate,
    monthlyInterest,
    totalInterest,
    totalRedeem,
    competitorRate,
    competitorTotal,
    competitorRedeem,
    savings,
    hasSaving: savings > 0,
    hasCompetitorRate: Boolean(competitorBand),
  };
}

export function formatLoanSavingsMessage(summary, config = formConfig.loan) {
  if (!summary) {
    return "";
  }

  if (summary?.isEnquiry) {
    return "";
  }

  if (!summary?.hasCompetitorRate) {
    return "";
  }

  if (summary?.hasSaving) {
    return `Save ${formatMoney(summary.savings)} compared to ${config.competitorLabel}`;
  }

  return config.noSavingMessage;
}

export function formatLoanHelpMessage(summary, config = formConfig.loan) {
  return formatLoanSavingsMessage(summary, config);
}

export const loanCalculationTestHooks = {
  doRefresh,
};

function getAmount(form) {
  const input = form.querySelector(SELECTORS.amountInput);
  const text = (input?.textContent || input?.value || "").replace(/[^0-9.]/g, "");
  return parseNumber(text);
}

function getDuration(form) {
  const checked = form.querySelector(`${SELECTORS.durationRadio}:checked`);
  const value = parseNumber(checked?.value);
  return Number.isFinite(value) && value > 0 ? value : formConfig.loan.defaultDuration;
}

function setOutput(form, key, value) {
  const str = String(value ?? "");
  form.querySelectorAll(`${SELECTORS.output}[data-form-loan-output="${key}"]`).forEach((el) => {
    setTextWithEmptyState(el, str);
  });
}

function setHelp(form, value) {
  const str = String(value ?? "");
  const helpTargets = form.querySelectorAll(`${SELECTORS.output}[data-form-loan-output="help"]`);
  if (!helpTargets.length) {
    setOutput(form, "savings", str);
    return;
  }

  helpTargets.forEach((el) => {
    setTextWithEmptyState(el, str);
  });
}

function setTextWithEmptyState(el, value) {
  el.textContent = value;
  const states = new Set((el.getAttribute('data-form-state') || '').split(' ').filter(Boolean));
  if (!value) {
    states.add('empty');
  } else {
    states.delete('empty');
  }
  const next = Array.from(states).join(' ');
  if (next) el.setAttribute('data-form-state', next);
  else el.removeAttribute('data-form-state');
}

export function initLoanForms(scope = document) {
  const forms = [
    ...(scope.matches?.(SELECTORS.form) ? [scope] : []),
    ...scope.querySelectorAll(SELECTORS.form),
  ];
  forms.forEach(init);
}
