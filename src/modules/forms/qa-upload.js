/**
 * QA upload hook — programmatic file uploads for browser automation.
 *
 * Browser automation can't drive the native file picker or set
 * `<input type="file">`.files. This hook injects a `File` into the form's
 * real upload path instead, so a test exercises the same client validation,
 * Worker POST, and value-field population as a real pick.
 *
 * Inert for real visitors (nothing invokes it without a script-supplied
 * File) and grants no extra capability — same Worker, same public client
 * header. Registered on `window.sr.forms` by initQaUpload() (loader).
 *
 *   await sr.forms.injectUploadFromUrl(0)        // 1st widget ← a real picsum JPEG
 *   await sr.forms.injectUploadFromUrl(1, "https://picsum.photos/1600/1200")
 *   await sr.forms.injectUpload("[data-form-upload]:nth-of-type(2)", fileObj)
 */

import { formUploads } from "./core/fields.js";
import { formApp } from "./core/app.js";
import { formParams } from "./core/conditions.js";

const DEFAULT_IMAGE_URL = "https://picsum.photos/1200/900";
const EXT_BY_MIME = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

// Resolves `target` (a widget element, a CSS selector, or a 0-based index
// into the page's upload widgets) to its enclosing [data-form-upload] element.
function resolveUpload(target) {
  let el = target;
  if (typeof target === "number") {
    el = document.querySelectorAll("[data-form-upload]")[target];
  } else if (typeof target === "string") {
    el = document.querySelector(target);
  }
  const upload = el && el.closest ? el.closest("[data-form-upload]") || el : el;
  if (!upload) {
    throw new Error(`injectUpload: no [data-form-upload] found for target ${JSON.stringify(target)}`);
  }
  return upload;
}

/** Inject a File into an upload widget via the form's real upload path. */
export async function injectUpload(target, file) {
  if (!(file instanceof File) && !(file instanceof Blob)) {
    throw new Error("injectUpload: second argument must be a File/Blob");
  }
  const upload = resolveUpload(target);
  const root = upload.closest("[data-form]");
  const form = formApp.getFormByRoot(root) || { root, scope: root };

  // The same two-step the widget runs on a real pick (see fields.js
  // handleTempInputChange): upload, then refresh form state + tracked params.
  await formUploads.handle(form, upload, file);
  formApp.refresh(form);
  formParams.update(form);

  const valueField = upload.querySelector("[data-form-upload-value-image], [data-form-upload-value]");
  return valueField ? valueField.value || null : null;
}

/** Fetch a real file (default: a picsum JPEG) and inject it into a widget. */
export async function injectUploadFromUrl(target, url = DEFAULT_IMAGE_URL, name) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(`injectUploadFromUrl: fetch ${url} → HTTP ${res.status}`);
  }
  const blob = await res.blob();
  const type = blob.type || "image/jpeg";
  const file = new File([blob], name || `qa-upload${EXT_BY_MIME[type] || ".jpg"}`, { type });
  return injectUpload(target, file);
}

/** Register the hook on window.sr.forms. Safe to call more than once. */
export function initQaUpload() {
  if (typeof window === "undefined") return;
  const sr = (window.sr = window.sr || {});
  sr.forms = sr.forms || {};
  sr.forms.injectUpload = injectUpload;
  sr.forms.injectUploadFromUrl = injectUploadFromUrl;
}
