import { useEffect, useState } from "react";
import { loadPdfDocument, renderPageToCanvas } from "../lib/pdfjs";

export function usePdfThumbnails(file, scale = 0.25) {
  const [thumbs, setThumbs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pageCount, setPageCount] = useState(0);

  useEffect(() => {
    if (!file) {
      setThumbs([]);
      setPageCount(0);
      return;
    }
    let cancelled = false;
    setLoading(true);

    (async () => {
      const doc = await loadPdfDocument(file);
      if (cancelled) return;
      setPageCount(doc.numPages);
      const urls = [];
      for (let i = 1; i <= doc.numPages; i += 1) {
        const { canvas } = await renderPageToCanvas(doc, i, scale);
        urls.push(canvas.toDataURL("image/png"));
        if (cancelled) return;
        setThumbs([...urls]);
      }
      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [file, scale]);

  return { thumbs, loading, pageCount };
}
