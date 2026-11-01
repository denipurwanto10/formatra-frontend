// Real entry point for the PDF web worker. Workers have their own global
// scope, so the main-thread polyfill in src/lib/polyfills.js never reaches
// code running in here — this file re-applies the same fix before loading
// pdfjs's own worker bundle, which depends on Promise.withResolvers()
// (unsupported on Safari/iOS before 17.4, March 2024; this is what causes
// "undefined is not a function" errors on older phones while desktop is fine).
//
// The dynamic import below is required (not a static `import`): static
// imports are hoisted and would run before the polyfill is installed.
if (typeof Promise.withResolvers !== "function") {
  self.Promise.withResolvers = function withResolvers() {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

await import("pdfjs-dist/build/pdf.worker.mjs");
