// Optional high-fidelity conversion backend client.
//
// Formatra runs entirely client-side by default. If a conversion server
// (see /server) is deployed and reachable, PDF<->Word and PPT->PDF are routed
// through it for LibreOffice-grade fidelity. If it isn't configured, isn't
// reachable, or fails for a network reason, callers fall back to the
// original in-browser implementation automatically — no crash, no dead end.
//
// Set VITE_CONVERT_API_URL in .env to point at a deployed server, e.g.
//   VITE_CONVERT_API_URL=https://convert.example.com
// Leave it unset to use only the built-in browser converters.

/** Thrown for connection-level problems (server absent/down/timeout). Callers
 * should catch this specific error and fall back to the client-side path. */
export class BackendUnavailableError extends Error {}

function getBackendBaseUrl() {
  const raw = import.meta.env?.VITE_CONVERT_API_URL;
  if (!raw) return "";
  const url = raw.replace(/\/+$/, "");

  // Safety net: if the app itself isn't running on localhost but the
  // configured backend points at localhost/127.0.0.1, it's almost certainly
  // a stray dev default that leaked into a deployed build (this has bitten
  // this project before) rather than a real server the visitor's browser can
  // reach. Treat it as unconfigured instead of failing every conversion
  // attempt against an address nobody but the original developer can reach.
  try {
    const backendHost = new URL(url).hostname;
    const isLoopback = backendHost === "localhost" || backendHost === "127.0.0.1" || backendHost === "::1";
    const pageIsLoopback =
      typeof window !== "undefined" &&
      (window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1" ||
        window.location.hostname === "::1");
    if (isLoopback && !pageIsLoopback) return "";
  } catch {
    // Malformed URL — let convertViaBackend's own request handling surface it.
  }

  return url;
}

export function isBackendConfigured() {
  return Boolean(getBackendBaseUrl());
}

/**
 * Sends `file` to one of the server's /api/convert/* routes and resolves with
 * the resulting Blob. Reports 0-100 progress: 0-40% is upload, 40-90% is a
 * simulated "converting…" creep (the server does one shot of work and can't
 * report real progress over a plain HTTP response), 100% on completion.
 */
export function convertViaBackend({ file, route, onProgress, timeoutMs = 100_000 }) {
  const base = getBackendBaseUrl();
  if (!base) {
    return Promise.reject(new BackendUnavailableError("No conversion server configured"));
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${base}${route}`);
    xhr.responseType = "blob";
    xhr.timeout = timeoutMs;
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.setRequestHeader("X-Filename", encodeURIComponent(file.name));

    let waitProgress = 40;
    let waitTimer = null;

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress?.(Math.round((e.loaded / e.total) * 40));
      }
    };
    xhr.upload.onloadend = () => {
      waitTimer = setInterval(() => {
        waitProgress = Math.min(waitProgress + 3, 90);
        onProgress?.(waitProgress);
      }, 400);
    };

    const stopWaiting = () => {
      if (waitTimer) clearInterval(waitTimer);
    };

    xhr.onload = async () => {
      stopWaiting();
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve(xhr.response);
        return;
      }
      // 4xx/5xx means the server IS there but rejected/failed this specific
      // file (bad format, corrupt file, timeout) — that's a real error, not
      // "server absent", so it's surfaced rather than silently swallowed.
      let message = `Conversion server error (${xhr.status})`;
      try {
        const text = await xhr.response.text();
        const parsed = JSON.parse(text);
        if (parsed?.error) message = parsed.error;
      } catch {
        /* keep default message */
      }
      reject(new Error(message));
    };
    xhr.onerror = () => {
      stopWaiting();
      reject(new BackendUnavailableError("Could not reach conversion server"));
    };
    xhr.ontimeout = () => {
      stopWaiting();
      reject(new BackendUnavailableError("Conversion server timed out"));
    };

    xhr.send(file);
  });
}
