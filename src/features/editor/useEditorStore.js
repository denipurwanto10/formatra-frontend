import { create } from "zustand";
import { uid } from "../../utils/id";
import { clearPageTextCache } from "./pageTextCache";
import { saveAutosaveSnapshot } from "./autosaveDb";

const MAX_HISTORY = 40;

export const useEditorStore = create((set, get) => ({
  fileName: "",
  originalFile: null,
  pages: [], // { id, kind: 'source'|'blank', sourceIndex, rotation, widthPt, heightPt }
  activePageId: null,
  canvasJSON: {}, // pageId -> fabric JSON string
  historyByPage: {}, // pageId -> { past: [], future: [] }
  zoom: 1,
  // True until the user manually changes zoom (toolbar +/-/reset or a
  // keyboard shortcut). While true, the workspace is free to keep the page
  // fitted to the visible width — this is what makes a page open at a sane
  // size on a narrow phone screen instead of at a fixed 100% that overflows
  // sideways off the edge of the screen.
  zoomIsAuto: true,
  tool: "select",
  toolOptions: {
    color: "#2f6fed",
    strokeWidth: 3,
    fontSize: 20,
    fontFamily: "Inter, sans-serif",
    fill: "transparent",
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
    // "transparent" = no text highlight, same convention as shape `fill: "none"`.
    highlightColor: "transparent",
    lineHeight: 1.16,
    align: "left",
  },
  selectionTick: 0, // bumped whenever selection changes, to re-render PropertiesPanel
  autosaveStatus: "idle", // "idle" | "pending" | "saving" | "saved" | "error"
  autosaveAt: null,
  // Find & Replace's current-match highlight box, in the same page-point
  // space as everything else ({ pageId, left, top, width, height } | null)
  // — kept in the store (rather than local component state) purely so
  // PdfCanvas, which owns the page's DOM layout, can read it without
  // FindReplaceBar needing a ref into PdfCanvas's internals.
  searchHighlight: null,
  setSearchHighlight: (box) => set({ searchHighlight: box }),

  init: ({ file, pages }) => {
    const canvasJSON = {};
    const historyByPage = {};
    pages.forEach((p) => {
      canvasJSON[p.id] = null;
      historyByPage[p.id] = { past: [], future: [] };
    });
    set({
      originalFile: file,
      fileName: file.name,
      pages,
      activePageId: pages[0]?.id ?? null,
      canvasJSON,
      historyByPage,
      zoom: 1,
      zoomIsAuto: true,
      tool: "select",
      autosaveStatus: "idle",
      autosaveAt: null,
    });
  },

  // Like init(), but seeds canvasJSON from a recovered autosave snapshot
  // instead of blanking every page — undo/redo history is not part of the
  // snapshot (see autosaveDb.js), so it starts fresh, but every page's
  // actual edits/annotations come back exactly as they were.
  restoreSnapshot: ({ file, fileName, pages, canvasJSON }) => {
    const historyByPage = {};
    pages.forEach((p) => {
      historyByPage[p.id] = { past: [], future: [] };
    });
    set({
      originalFile: file,
      fileName: fileName || file.name,
      pages,
      activePageId: pages[0]?.id ?? null,
      canvasJSON: canvasJSON || {},
      historyByPage,
      zoom: 1,
      zoomIsAuto: true,
      tool: "select",
      autosaveStatus: "saved",
      autosaveAt: Date.now(),
    });
  },

  reset: () => {
    clearPageTextCache();
    set({
      originalFile: null,
      fileName: "",
      pages: [],
      activePageId: null,
      canvasJSON: {},
      historyByPage: {},
      zoom: 1,
      zoomIsAuto: true,
      tool: "select",
      autosaveStatus: "idle",
      autosaveAt: null,
    });
  },

  setActivePage: (id) => set({ activePageId: id, tool: "select" }),
  setActivePageByOffset: (offset) => {
    const { pages, activePageId } = get();
    const current = pages.findIndex((p) => p.id === activePageId);
    if (current < 0) return;
    const next = Math.min(pages.length - 1, Math.max(0, current + offset));
    if (next !== current) set({ activePageId: pages[next].id, tool: "select" });
  },
  setTool: (tool) => set({ tool }),
  setToolOptions: (partial) =>
    set((s) => ({ toolOptions: { ...s.toolOptions, ...partial } })),
  setZoom: (zoom) => set({ zoom: Math.min(3, Math.max(0.25, zoom)), zoomIsAuto: false }),
  // Used only by the fit-to-width effect — updates the zoom level without
  // marking it as a deliberate user choice, so auto-fit keeps working on
  // rotation/resize until the user actually touches the zoom controls.
  setAutoZoom: (zoom) => set({ zoom: Math.min(3, Math.max(0.25, zoom)) }),
  bumpSelection: () => set((s) => ({ selectionTick: s.selectionTick + 1 })),

  /** Commit a new canvas state snapshot for a page, pushing the previous one to history. */
  commitCanvasState: (pageId, json) => {
    const { canvasJSON, historyByPage } = get();
    const prev = canvasJSON[pageId];
    const hist = historyByPage[pageId] || { past: [], future: [] };
    // Always push `prev` onto the undo stack, even when it's `null` (the
    // page's blank starting state) — otherwise the very first edit made on
    // a page could never be undone, since there'd be nothing recorded to
    // undo back *to*. `undo()`/`applyHistoryJson()` already know that a
    // `null` history entry means "clear the canvas", so this is safe.
    const nextPast = [...hist.past, prev].slice(-MAX_HISTORY);
    set({
      canvasJSON: { ...canvasJSON, [pageId]: json },
      historyByPage: {
        ...historyByPage,
        [pageId]: { past: nextPast, future: [] },
      },
    });
  },

  undo: (pageId) => {
    const { canvasJSON, historyByPage } = get();
    const hist = historyByPage[pageId];
    if (!hist || hist.past.length === 0) return null;
    const previous = hist.past[hist.past.length - 1];
    const newPast = hist.past.slice(0, -1);
    const current = canvasJSON[pageId];
    set({
      canvasJSON: { ...canvasJSON, [pageId]: previous },
      historyByPage: {
        ...historyByPage,
        [pageId]: { past: newPast, future: [current, ...hist.future] },
      },
    });
    return previous;
  },

  redo: (pageId) => {
    const { canvasJSON, historyByPage } = get();
    const hist = historyByPage[pageId];
    if (!hist || hist.future.length === 0) return null;
    const next = hist.future[0];
    const newFuture = hist.future.slice(1);
    const current = canvasJSON[pageId];
    set({
      canvasJSON: { ...canvasJSON, [pageId]: next },
      historyByPage: {
        ...historyByPage,
        [pageId]: { past: [...hist.past, current], future: newFuture },
      },
    });
    return next;
  },

  addBlankPage: (afterPageId) => {
    const { pages } = get();
    const ref = pages.find((p) => p.id === afterPageId) || pages[pages.length - 1];
    const newPage = {
      id: uid("page"),
      kind: "blank",
      sourceIndex: null,
      rotation: 0,
      widthPt: ref?.widthPt || 595.28,
      heightPt: ref?.heightPt || 841.89,
    };
    const idx = ref ? pages.findIndex((p) => p.id === ref.id) : pages.length - 1;
    const nextPages = [...pages];
    nextPages.splice(idx + 1, 0, newPage);
    set((s) => ({
      pages: nextPages,
      canvasJSON: { ...s.canvasJSON, [newPage.id]: null },
      historyByPage: { ...s.historyByPage, [newPage.id]: { past: [], future: [] } },
      activePageId: newPage.id,
    }));
  },

  deletePage: (pageId) => {
    const { pages, activePageId } = get();
    if (pages.length <= 1) return;
    const idx = pages.findIndex((p) => p.id === pageId);
    const nextPages = pages.filter((p) => p.id !== pageId);
    set((s) => {
      const nextCanvasJSON = { ...s.canvasJSON };
      delete nextCanvasJSON[pageId];
      const nextHistory = { ...s.historyByPage };
      delete nextHistory[pageId];
      const nextActive =
        activePageId === pageId
          ? nextPages[Math.max(0, idx - 1)]?.id ?? null
          : activePageId;
      return {
        pages: nextPages,
        canvasJSON: nextCanvasJSON,
        historyByPage: nextHistory,
        activePageId: nextActive,
      };
    });
  },

  reorderPages: (newOrder) => set({ pages: newOrder }),

  /** Swap in a new underlying PDF File (e.g. after merging in inserted pages via pdf-lib) without touching the visual page list or any edits already made — see insertSourcePages below. */
  setOriginalFile: (file) => set({ originalFile: file, fileName: file.name }),

  /**
   * Insert a copy of an existing page right after it — same sourceIndex (or
   * blank-page dimensions), so it renders identically, plus a copy of its
   * current canvas overlay (annotations/edits) so the duplicate starts out
   * looking exactly like the page it was copied from. History is not
   * carried over: the duplicate begins its own fresh undo stack.
   */
  duplicatePage: (pageId) => {
    const { pages, canvasJSON } = get();
    const idx = pages.findIndex((p) => p.id === pageId);
    if (idx === -1) return;
    const newPage = { ...pages[idx], id: uid("page") };
    const nextPages = [...pages];
    nextPages.splice(idx + 1, 0, newPage);
    set((s) => ({
      pages: nextPages,
      canvasJSON: { ...s.canvasJSON, [newPage.id]: canvasJSON[pageId] ?? null },
      historyByPage: { ...s.historyByPage, [newPage.id]: { past: [], future: [] } },
      activePageId: newPage.id,
    }));
  },

  /**
   * Splice already-built page metas (see pdfPageOps.appendPdfPages — their
   * `sourceIndex` values must already point into the *current* originalFile,
   * so call setOriginalFile first) into the page list right after
   * `afterPageId`. Used by "Sisipkan PDF".
   */
  insertSourcePages: (afterPageId, newPages) => {
    if (!newPages || newPages.length === 0) return;
    const { pages } = get();
    const idx = pages.findIndex((p) => p.id === afterPageId);
    const insertAt = idx === -1 ? pages.length : idx + 1;
    const nextPages = [...pages];
    nextPages.splice(insertAt, 0, ...newPages);
    set((s) => {
      const canvasJSON = { ...s.canvasJSON };
      const historyByPage = { ...s.historyByPage };
      newPages.forEach((p) => {
        canvasJSON[p.id] = null;
        historyByPage[p.id] = { past: [], future: [] };
      });
      return { pages: nextPages, canvasJSON, historyByPage, activePageId: newPages[0].id };
    });
  },

  /** Bulk page delete for the thumbnail sidebar's multi-select mode. Never lets the document go empty. */
  removePages: (pageIds) => {
    const { pages, activePageId } = get();
    const idSet = new Set(pageIds);
    if (pages.length - idSet.size < 1) return;
    const nextPages = pages.filter((p) => !idSet.has(p.id));
    set((s) => {
      const canvasJSON = { ...s.canvasJSON };
      const historyByPage = { ...s.historyByPage };
      idSet.forEach((id) => {
        delete canvasJSON[id];
        delete historyByPage[id];
      });
      return {
        pages: nextPages,
        canvasJSON,
        historyByPage,
        activePageId: idSet.has(activePageId) ? nextPages[0]?.id ?? null : activePageId,
      };
    });
  },

  rotatePageMeta: (pageId, delta) => {
    set((s) => ({
      pages: s.pages.map((p) =>
        p.id === pageId ? { ...p, rotation: ((p.rotation + delta) % 360 + 360) % 360 } : p
      ),
    }));
  },
}));

// --- Auto-save & Recovery -------------------------------------------------
// A single debounced subscriber, rather than threading a save call through
// every action that touches document content, so no individual action (page
// ops, canvas commits, rename, lock, ...) needs to know autosave exists.
let autosaveTimer = null;
const AUTOSAVE_DEBOUNCE_MS = 1200;

useEditorStore.subscribe((state, prev) => {
  if (!state.originalFile) return;
  // Only pages/canvasJSON/originalFile changes are worth persisting — skip
  // everything else (selection, zoom, active tool, ...) so picking a color
  // or switching pages doesn't restart the debounce timer.
  if (
    state.pages === prev.pages &&
    state.canvasJSON === prev.canvasJSON &&
    state.originalFile === prev.originalFile
  ) {
    return;
  }
  clearTimeout(autosaveTimer);
  useEditorStore.setState({ autosaveStatus: "pending" });
  autosaveTimer = setTimeout(() => {
    const s = useEditorStore.getState();
    if (!s.originalFile) return;
    useEditorStore.setState({ autosaveStatus: "saving" });
    saveAutosaveSnapshot({
      fileName: s.fileName,
      originalFile: s.originalFile,
      pages: s.pages,
      canvasJSON: s.canvasJSON,
      savedAt: Date.now(),
    })
      .then(() => {
        // The document may have changed (or been closed) while the write
        // was in flight — only report success if we're still on the same one.
        if (useEditorStore.getState().originalFile === s.originalFile) {
          useEditorStore.setState({ autosaveStatus: "saved", autosaveAt: Date.now() });
        }
      })
      .catch((err) => {
        console.error("Autosave gagal:", err);
        useEditorStore.setState({ autosaveStatus: "error" });
      });
  }, AUTOSAVE_DEBOUNCE_MS);
});
