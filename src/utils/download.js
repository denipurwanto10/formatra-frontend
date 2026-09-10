import { saveAs } from "file-saver";

export function downloadBlob(blob, filename) {
  saveAs(blob, filename);
}

export function replaceExtension(filename, newExt) {
  const base = filename.replace(/\.[^/.]+$/, "");
  return `${base}.${newExt}`;
}

export function withSuffix(filename, suffix) {
  const dot = filename.lastIndexOf(".");
  if (dot === -1) return `${filename}-${suffix}`;
  return `${filename.slice(0, dot)}-${suffix}${filename.slice(dot)}`;
}
