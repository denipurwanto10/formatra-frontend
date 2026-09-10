import { PDFDocument } from "@cantoo/pdf-lib";

/**
 * Reads the fillable form fields of a PDF (AcroForm).
 * @param {File} file
 * @returns {Promise<{fields: Array<object>}>}
 */
export async function inspectPdfForm(file) {
  const bytes = await file.arrayBuffer();
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const form = doc.getForm();
  const rawFields = form.getFields();

  const fields = rawFields.map((field) => {
    const name = field.getName();
    const type = field.constructor?.name || "PDFField";

    if (type === "PDFCheckBox") {
      return { name, type: "checkbox", value: field.isChecked() };
    }
    if (type === "PDFRadioGroup") {
      return { name, type: "radio", options: field.getOptions(), value: field.getSelected() || "" };
    }
    if (type === "PDFDropdown") {
      return {
        name,
        type: "dropdown",
        options: field.getOptions(),
        value: field.getSelected()?.[0] || "",
      };
    }
    if (type === "PDFOptionList") {
      return { name, type: "dropdown", options: field.getOptions(), value: field.getSelected()?.[0] || "" };
    }
    // Text field, and anything else we don't specially handle
    let value = "";
    try {
      value = field.getText?.() || "";
    } catch {
      value = "";
    }
    return { name, type: "text", value };
  });

  return { fields };
}

/**
 * Fills a PDF's form fields with the given values and (optionally) flattens
 * the form so it can no longer be edited.
 * @param {File} file
 * @param {Record<string, string|boolean>} values keyed by field name
 * @param {{flatten?: boolean}} opts
 */
export async function fillPdfForm(file, values, { flatten = true } = {}, onProgress) {
  const bytes = await file.arrayBuffer();
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const form = doc.getForm();
  const entries = Object.entries(values);

  entries.forEach(([name, value], i) => {
    try {
      const field = form.getField(name);
      const type = field.constructor?.name;
      if (type === "PDFCheckBox") {
        if (value) field.check();
        else field.uncheck();
      } else if (type === "PDFRadioGroup" || type === "PDFDropdown" || type === "PDFOptionList") {
        if (value) field.select(value);
      } else if (field.setText) {
        field.setText(value ? String(value) : "");
      }
    } catch {
      // Skip fields that can't be resolved/set rather than aborting the whole export.
    }
    onProgress?.(Math.round(((i + 1) / Math.max(entries.length, 1)) * 70));
  });

  if (flatten) form.flatten();

  const outBytes = await doc.save();
  onProgress?.(100);
  return new Blob([outBytes], { type: "application/pdf" });
}
