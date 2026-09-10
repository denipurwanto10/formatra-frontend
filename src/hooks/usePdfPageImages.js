import { useEffect, useState } from "react";
import { loadPdfDocument, renderPageToCanvas } from "../lib/pdfjs";

/**
 * Renders every page of a PDF file/blob to raster images sized to fit a
 * given CSS display width. Re-rendering at the *actual* target width (times
 * devicePixelRatio) keeps the page crisp on phone screens instead of relying
 * on the browser's native <iframe> PDF plugin, which mobile browsers render
 * inconsistently (wrong scale, no pinch-zoom, clipped pages).
 */
export function usePdfPageImages(file, targetWidth) {
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!file || !targetWidth) {
      setPages([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPages([]);

    (async () => {
      try {
        const doc = await loadPdfDocument(file);
        if (cancelled) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
        const results = [];
        for (let i = 1; i <= doc.numPages; i += 1) {
          const page = await doc.getPage(i);
          const base = page.getViewport({ scale: 1 });
          const scale = (targetWidth / base.width) * dpr;
          const { canvas, viewport } = await renderPageToCanvas(doc, i, scale);
          if (cancelled) return;
          results.push({
            url: canvas.toDataURL("image/png"),
            width: viewport.width / dpr,
            height: viewport.height / dpr,
          });
          setPages([...results]);
        }
        if (!cancelled) setLoading(false);
      } catch (e) {
        if (!cancelled) {
          setError(e);
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // targetWidth is rounded by the caller so tiny resize jitters don't
    // trigger a full re-render loop.
  }, [file, targetWidth]);

  return { pages, loading, error };
}
