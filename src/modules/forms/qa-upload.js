/**
 * QA upload hook — programmatic file uploads for browser automation.
 *
 * Browser automation (Chrome, headless) can't drive the native OS file picker
 * and can't fill an `<input type="file">` by setting `.files`. That blocks any
 * automated test of an upload widget. This hook injects a `File` supplied from
 * code into the form's REAL upload path, so a test behaves exactly like a user
 * picking a file — same client validation, same worker POST, same value-field
 * population and routing — only the file's source differs (code, not a dialog).
 *
 * It is inert for real visitors: nothing invokes it unless a script passes a
 * File, and it grants no capability a visitor lacks (the widget already uploads
 * to the same worker with the same public client header). Registered on
 * `window.sr.forms` by initQaUpload() (called from the loader).
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

// Resolve `target` (a widget element, a CSS selector, or a 0-based index into
// the page's upload widgets) to its enclosing [data-form-upload] element.
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
