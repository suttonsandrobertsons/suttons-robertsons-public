import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { formUploads } from "../core/fields.js";
import { formApp } from "../core/app.js";
import { formParams } from "../core/conditions.js";
import { injectUpload, injectUploadFromUrl, initQaUpload } from "../qa-upload.js";

function buildForm() {
  document.body.innerHTML = `
    <form data-form="gold">
      <div data-form-upload>
        <button data-form-upload-trigger>Upload</button>
        <input type="hidden" data-form-upload-value-image name="front_image_input">
      </div>
      <div data-form-upload>
        <button data-form-upload-trigger>Upload</button>
        <input type="hidden" data-form-upload-value-image name="back_image_input">
      </div>
    </form>`;
}

describe("qa-upload hook", () => {
  beforeEach(() => {
    buildForm();
    // Stub the real upload path so the test never hits the network: mimic a
    // successful upload by writing a URL into the widget's value field.
    vi.spyOn(formUploads, "handle").mockImplementation(async (form, upload) => {
      upload.querySelector("[data-form-upload-value-image]").value = "https://cdn.example/x.jpg";
    });
    vi.spyOn(formApp, "refresh").mockImplementation(() => {});
    vi.spyOn(formParams, "update").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
    delete window.sr;
  });

  it("resolves a numeric index to the Nth upload widget and runs the real path", async () => {
    const file = new File(["x"], "a.jpg", { type: "image/jpeg" });
    const url = await injectUpload(1, file);

    expect(formUploads.handle).toHaveBeenCalledOnce();
    const [, uploadArg, fileArg] = formUploads.handle.mock.calls[0];
    // Index 1 → the second widget (back_image_input).
    expect(uploadArg.querySelector("[name]").name).toBe("back_image_input");
    expect(fileArg).toBe(file);
    // Refresh + params update run, mirroring a real pick.
    expect(formApp.refresh).toHaveBeenCalledOnce();
    expect(formParams.update).toHaveBeenCalledOnce();
    // Returns the populated value-field URL.
    expect(url).toBe("https://cdn.example/x.jpg");
  });

  it("accepts a CSS selector target", async () => {
    const file = new File(["x"], "a.jpg", { type: "image/jpeg" });
    await injectUpload("[data-form-upload]:first-of-type button", file);
    const [, uploadArg] = formUploads.handle.mock.calls[0];
    expect(uploadArg.querySelector("[name]").name).toBe("front_image_input");
  });

  it("throws when the target can't be resolved", async () => {
    await expect(injectUpload("#nope", new File(["x"], "a.jpg"))).rejects.toThrow(/no \[data-form-upload\]/);
  });

  it("rejects a non-File second argument", async () => {
    await expect(injectUpload(0, "not-a-file")).rejects.toThrow(/must be a File/);
  });

  it("injectUploadFromUrl fetches, wraps as a File, and delegates", async () => {
    const blob = new Blob(["imgbytes"], { type: "image/png" });
    global.fetch = vi.fn().mockResolvedValue({ ok: true, blob: async () => blob });

    const url = await injectUploadFromUrl(0, "https://picsum.photos/10/10");
    const [, , fileArg] = formUploads.handle.mock.calls[0];
    expect(fileArg).toBeInstanceOf(File);
    expect(fileArg.type).toBe("image/png");
    expect(fileArg.name).toMatch(/\.png$/);
    expect(url).toBe("https://cdn.example/x.jpg");
    delete global.fetch;
  });

  it("initQaUpload registers both helpers on window.sr.forms", () => {
    initQaUpload();
    expect(typeof window.sr.forms.injectUpload).toBe("function");
    expect(typeof window.sr.forms.injectUploadFromUrl).toBe("function");
  });
});
