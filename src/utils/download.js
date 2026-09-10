/** True on every iOS browser (Safari, Chrome-iOS, etc. — they're all WebKit
 * under the hood). iPadOS disguises itself as "MacIntel" in the UA string,
 * so touch support is used to tell it apart from a real Mac. */
export function isIOS() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /iP(hone|od|ad)/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/**
 * Saves `blob` to the user's device as `filename`.
 *
 * iOS WebKit ignores the `download` attribute on blob: links — clicking the
 * link just opens/renders the file in the tab instead of saving it, which is
 * why downloads on iPhone/iPad "hanya menampilkan" (only display). The Web
 * Share sheet's "Save to Files" action is the one reliable way to actually
 * save a generated file there, so that's used first on iOS. Desktop and
 * Android keep the classic anchor-click download, which works everywhere.
 */
export async function downloadBlob(blob, filename) {
  if (isIOS() && typeof navigator !== "undefined" && typeof navigator.canShare === "function") {
    try {
      const file = new File([blob], filename, { type: blob.type || "application/octet-stream" });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] });
        return;
      }
    } catch (err) {
      // AbortError = the user closed the share sheet themselves — that's a
      // normal cancel, not a failure, so don't also pop open a new tab.
      if (err?.name === "AbortError") return;
      // Any other error (share unsupported for this file, etc.) — fall
      // through to the tab-open fallback below.
    }
  }

  if (isIOS()) {
    // No Web Share support: open the real file in a new tab. The user can
    // then use Safari's own share/save icon to keep it — not as smooth as a
    // direct download, but it shows the actual file instead of failing
    // silently the way the plain <a download> click does on iOS.
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return;
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
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
