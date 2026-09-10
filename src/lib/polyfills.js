// Polyfills for JS features used by dependencies (notably pdfjs-dist) that
// aren't yet available on all browsers — especially older mobile Safari/iOS
// (Promise.withResolvers landed in Safari 17.4, March 2024). Without this,
// PDF-related tools throw "undefined is not a function" on devices that
// haven't updated past that version, even though desktop browsers are fine.
if (typeof Promise.withResolvers !== "function") {
  Promise.withResolvers = function withResolvers() {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}
