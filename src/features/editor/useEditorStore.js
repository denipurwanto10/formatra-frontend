import { create } from "zustand";
import { uid } from "../../utils/id";
import { clearPageTextCache } from "./pageTextCache";

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

  rotatePageMeta: (pageId, delta) => {
    set((s) => ({
      pages: s.pages.map((p) =>
        p.id === pageId ? { ...p, rotation: ((p.rotation + delta) % 360 + 360) % 360 } : p
      ),
    }));
  },
}));
