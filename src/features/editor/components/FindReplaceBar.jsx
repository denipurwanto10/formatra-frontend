import { useEffect, useRef, useState } from "react";
import { Search, X, ChevronUp, ChevronDown, Replace as ReplaceIcon } from "lucide-react";
import { useEditorStore } from "../useEditorStore";
import { useCanvasHandle } from "../CanvasContext";
import { pageTextCache, ensurePageTextCached } from "../pageTextCache";
import { useToast } from "../../../context/ToastContext";

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** One shared regex builder for both the match-scanning pass and the
 * actual replace, so "what counts as a match" can never drift between the
 * two (e.g. Ganti Semua replacing something the search list didn't count,
 * or vice versa). */
function buildQueryRegex(query, { caseSensitive, wholeWord }, global) {
  const body = wholeWord ? `\\b${escapeRegExp(query)}\\b` : escapeRegExp(query);
  const flags = (global ? "g" : "") + (caseSensitive ? "" : "i");
  return new RegExp(body, flags);
}

/**
 * What a line's text *actually* reads right now, accounting for any edit
 * already made on it in this session — not the original PDF text, which is
 * all `pageTextCache` knows about on its own. Returns `null` if the line was
 * edited down to nothing (deleted), so callers can skip it.
 */
function effectiveLineText(canvasJSON, pageId, lineIndex, originalText) {
  const json = canvasJSON[pageId];
  if (!json) return originalText;
  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch {
    return originalText;
  }
  const objects = parsed.objects || [];
  const textObj = objects.find(
    (o) => o.isTextEdit && o.lineIndex === lineIndex && (o.type === "IText" || o.type === "Textbox")
  );
  if (textObj) return textObj.text ?? "";
  const hasMask = objects.some((o) => o.isTextEdit && o.lineIndex === lineIndex && o.type === "Rect");
  if (hasMask) return null; // edited down to empty = deleted
  return originalText;
}

/** Poll briefly for the canvas of a just-switched-to page to be ready. */
async function waitForPage(handle, pageId, timeoutMs = 2500) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (handle.current.canvas && handle.current.canvasPageId === pageId) return true;
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 40));
  }
  return false;
}

export default function FindReplaceBar({ open, mode, pdfDoc, onClose }) {
  const pages = useEditorStore((s) => s.pages);
  const activePageId = useEditorStore((s) => s.activePageId);
  const setActivePage = useEditorStore((s) => s.setActivePage);
  const originalFile = useEditorStore((s) => s.originalFile);
  const canvasJSON = useEditorStore((s) => s.canvasJSON);
  const handle = useCanvasHandle();
  const toast = useToast();

  const [query, setQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  const [matches, setMatches] = useState([]);
  const [activeMatch, setActiveMatch] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showReplace, setShowReplace] = useState(mode === "replace");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const setSearchHighlight = useEditorStore((s) => s.setSearchHighlight);
  const inputRef = useRef(null);

  // `mode` only sets the *initial* state when the bar opens (e.g. via
  // Ctrl+H) — after that the person can toggle it themselves without the
  // bar snapping back.
  useEffect(() => {
    if (open) setShowReplace(mode === "replace");
  }, [open, mode]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!query.trim() || !pdfDoc) {
      setMatches([]);
      setActiveMatch(0);
      return;
    }
    let cancelled = false;
    setScanning(true);
    const re = buildQueryRegex(query, { caseSensitive, wholeWord }, false);

    (async () => {
      const found = [];
      for (const page of pages) {
        if (cancelled) break;
        if (page.kind !== "source") continue;
        // eslint-disable-next-line no-await-in-loop
        const entry = await ensurePageTextCached(pdfDoc, page, originalFile);
        if (!entry || cancelled) continue;
        entry.lines.forEach((line, lineIndex) => {
          const text = effectiveLineText(useEditorStore.getState().canvasJSON, page.id, lineIndex, line.text);
          if (text && re.test(text)) {
            found.push({ pageId: page.id, lineIndex, preview: text.slice(0, 80) });
          }
        });
      }
      if (!cancelled) {
        setMatches(found);
        setActiveMatch(0);
        setScanning(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // Re-scan on every commit too (`canvasJSON`), so a match that was just
    // edited elsewhere drops out of the list instead of going stale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pdfDoc, query, pages, originalFile, canvasJSON, caseSensitive, wholeWord]);

  const current = matches[activeMatch];

  // Keep the on-page highlight (rendered by PdfCanvas, see searchHighlight
  // in the store) in sync with whichever match is currently selected —
  // and clear it whenever the bar closes or there's nothing to point at,
  // so a stale highlight never lingers on the page.
  useEffect(() => {
    if (!open || !current) {
      setSearchHighlight(null);
      return;
    }
    const entry = pageTextCache.get(current.pageId);
    const line = entry?.lines?.[current.lineIndex];
    setSearchHighlight(
      line ? { pageId: current.pageId, left: line.left, top: line.top, width: line.width, height: line.height } : null
    );
  }, [open, current, setSearchHighlight]);

  // Belt-and-braces: also clear the highlight if this component ever
  // actually unmounts (e.g. the whole page/tool is torn down), not just
  // when `open` flips to false.
  useEffect(() => () => setSearchHighlight(null), [setSearchHighlight]);

  const goTo = (index) => {
    if (matches.length === 0) return;
    const wrapped = ((index % matches.length) + matches.length) % matches.length;
    const m = matches[wrapped];
    setActiveMatch(wrapped);
    if (m && activePageId !== m.pageId) setActivePage(m.pageId);
  };

  const replaceOne = async (match) => {
    const entry = pageTextCache.get(match.pageId);
    const line = entry?.lines?.[match.lineIndex];
    if (!line) return false;
    const currentText = effectiveLineText(useEditorStore.getState().canvasJSON, match.pageId, match.lineIndex, line.text);
    if (currentText == null) return false; // already deleted
    const re = buildQueryRegex(query, { caseSensitive, wholeWord }, true);
    const newText = currentText.replace(re, replacement);

    if (useEditorStore.getState().activePageId !== match.pageId) setActivePage(match.pageId);
    const ready = await waitForPage(handle, match.pageId);
    if (!ready) return false;
    return handle.current.applyLineEdit?.(match.lineIndex, newText) ?? false;
  };

  const handleReplace = async () => {
    if (!current || busy) return;
    setBusy(true);
    const ok = await replaceOne(current);
    setBusy(false);
    if (ok) {
      setMatches((prev) => prev.filter((_, i) => i !== activeMatch));
      setActiveMatch((i) => Math.min(i, Math.max(0, matches.length - 2)));
    } else {
      toast.error("Gagal mengganti", "Tidak bisa menerapkan perubahan pada baris ini.");
    }
  };

  const handleReplaceAll = async () => {
    if (matches.length === 0 || busy) return;
    setBusy(true);
    const queue = [...matches];
    let done = 0;
    for (const m of queue) {
      // eslint-disable-next-line no-await-in-loop
      const ok = await replaceOne(m);
      if (ok) done += 1;
    }
    setBusy(false);
    setMatches([]);
    setActiveMatch(0);
    if (done > 0) toast.success("Selesai", `${done} dari ${queue.length} kecocokan diganti.`);
    else toast.warning("Tidak ada yang diganti", "Tidak ada baris yang bisa diubah dengan aman.");
  };

  if (!open) return null;

  return (
    <div
      className="absolute right-3 top-3 z-20 flex flex-col gap-2 rounded-lg border border-hair bg-surface p-2.5 shadow-lg"
      style={{ width: 360, maxWidth: "calc(100vw - 24px)" }}
    >
      <div className="flex items-center gap-1.5">
        <Search className="size-4 shrink-0 text-muted" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari teks di PDF..."
          className="min-w-0 flex-1 border-none bg-transparent text-[13px] text-ink outline-none"
          onKeyDown={(e) => {
            if (e.key === "Enter") goTo(activeMatch + (e.shiftKey ? -1 : 1));
            if (e.key === "Escape") onClose();
          }}
        />
        <span className="shrink-0 text-[11px] text-muted">
          {scanning ? "..." : matches.length ? `${activeMatch + 1}/${matches.length}` : query ? "0/0" : ""}
        </span>
        <button
          title="Peka huruf besar/kecil (Case sensitive)"
          onClick={() => setCaseSensitive((v) => !v)}
          className={`rounded px-1 py-0.5 text-[11px] font-bold hover:bg-surface-2 ${
            caseSensitive ? "bg-surface-2 text-accent" : "text-muted"
          }`}
        >
          Aa
        </button>
        <button
          title="Kata utuh saja (Whole word)"
          onClick={() => setWholeWord((v) => !v)}
          className={`rounded px-1 py-0.5 text-[11px] font-bold underline decoration-2 underline-offset-2 hover:bg-surface-2 ${
            wholeWord ? "bg-surface-2 text-accent" : "text-muted"
          }`}
        >
          ab
        </button>
        <button title="Sebelumnya" onClick={() => goTo(activeMatch - 1)} disabled={!matches.length} className="rounded p-1 text-muted hover:bg-surface-2 disabled:opacity-30">
          <ChevronUp className="size-4" />
        </button>
        <button title="Berikutnya" onClick={() => goTo(activeMatch + 1)} disabled={!matches.length} className="rounded p-1 text-muted hover:bg-surface-2 disabled:opacity-30">
          <ChevronDown className="size-4" />
        </button>
        <button
          title="Ganti"
          onClick={() => setShowReplace((v) => !v)}
          className={`rounded p-1 hover:bg-surface-2 ${showReplace ? "text-accent" : "text-muted"}`}
        >
          <ReplaceIcon className="size-4" />
        </button>
        <button title="Tutup (Esc)" onClick={onClose} className="rounded p-1 text-muted hover:bg-surface-2">
          <X className="size-4" />
        </button>
      </div>

      {current && (
        <p className="truncate text-[11px] text-muted" title={current.preview}>
          "{current.preview}"
        </p>
      )}

      {showReplace && (
        <div className="flex items-center gap-1.5 border-t border-hair pt-2">
          <input
            value={replacement}
            onChange={(e) => setReplacement(e.target.value)}
            placeholder="Ganti dengan..."
            className="min-w-0 flex-1 border-none bg-transparent text-[13px] text-ink outline-none"
          />
          <button
            onClick={handleReplace}
            disabled={!current || busy}
            className="shrink-0 rounded-md bg-surface-2 px-2 py-1 text-[12px] font-medium text-ink hover:bg-hair disabled:opacity-40"
          >
            Ganti
          </button>
          <button
            onClick={handleReplaceAll}
            disabled={!matches.length || busy}
            className="shrink-0 rounded-md bg-accent px-2 py-1 text-[12px] font-medium text-accent-ink disabled:opacity-40"
          >
            Ganti Semua
          </button>
        </div>
      )}
    </div>
  );
}
