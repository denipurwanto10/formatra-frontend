import { useEffect, useRef } from "react";
import {
  Canvas as FabricCanvas,
  Textbox,
  ActiveSelection,
  Group,
  Rect,
  Circle,
  Line,
  PencilBrush,
  FabricImage,
  FabricObject,
} from "fabric";
import { useEditorStore } from "../useEditorStore";
import { useCanvasHandle } from "../CanvasContext";
import { renderPageToCanvas } from "../../../lib/pdfjs";
import { pageTextCache, ensurePageTextCached } from "../pageTextCache";

// Bigger touch hit-area on every object's resize/rotate handles. The
// *visual* handle (cornerSize) stays the same so the editor doesn't look
// different on desktop, but a finger gets a much more forgiving ~30px
// target to grab instead of fabric's 24px touch default — the difference
// between reliably resizing a small textbox on a phone and repeatedly
// missing the handle.
FabricObject.ownDefaults.touchCornerSize = 30;
FabricObject.ownDefaults.cornerStyle = "circle";
FabricObject.ownDefaults.transparentCorners = false;
FabricObject.ownDefaults.cornerColor = "#2f6fed";
FabricObject.ownDefaults.cornerStrokeColor = "#ffffff";
FabricObject.ownDefaults.borderColor = "#2f6fed";

/**
 * Map a PDF's *actual* embedded font name (e.g. "ArialMT", "Calibri-Bold",
 * "TimesNewRomanPSMT", "Verdana", subset tags like "ABCDEF+Georgia") to the
 * closest real, on-screen CSS font stack — so the live editor shows text in
 * something much closer to the original than the export-only
 * helvetica/times/courier bucket (`guessStandardFont`) would give. All of
 * these are fonts already shipped with Windows/macOS, so nothing needs to
 * be downloaded for the on-screen preview to look right.
 *
 * `fallbackFamily` is the reduced export bucket ("helvetica"/"times"/
 * "courier") to fall back to when the raw name doesn't match anything more
 * specific, or when there's no raw name at all (annotations added fresh in
 * the editor, not tied to any original PDF font).
 */
function guessCssFontFamily(rawFontName, bucketFamily, cssFallback) {
  const name = (rawFontName || "").replace(/^[A-Z]{6}\+/, "").toLowerCase();
  const has = (...needles) => needles.some((n) => name.includes(n));

  if (has("arial", "helvetica", "liberationsans", "arimo")) return "Arial, Helvetica, sans-serif";
  if (has("calibri", "carlito")) return "Calibri, Carlito, Candara, sans-serif";
  if (has("verdana")) return "Verdana, Geneva, sans-serif";
  if (has("tahoma")) return "Tahoma, Geneva, sans-serif";
  if (has("segoe")) return '"Segoe UI", Tahoma, sans-serif';
  if (has("trebuchet")) return '"Trebuchet MS", sans-serif';
  if (has("century gothic", "centurygothic")) return '"Century Gothic", sans-serif';
  if (has("franklin gothic")) return '"Franklin Gothic Medium", Arial, sans-serif';
  if (has("gillsans", "gill sans")) return '"Gill Sans", "Gill Sans MT", sans-serif';
  if (has("futura")) return "Futura, sans-serif";
  if (has("optima")) return "Optima, sans-serif";
  if (has("lucida sans", "lucidasans")) return '"Lucida Sans", "Lucida Grande", sans-serif';

  if (has("times new roman", "timesnewroman", "tinos")) return '"Times New Roman", Times, serif';
  if (has("times")) return "Times, serif";
  if (has("georgia")) return "Georgia, serif";
  if (has("garamond")) return "Garamond, serif";
  if (has("cambria", "caladea")) return "Cambria, Georgia, serif";
  if (has("book antiqua", "bookantiqua", "palatino")) return '"Book Antiqua", Palatino, serif';
  if (has("minion")) return '"Minion Pro", Georgia, serif';
  if (has("baskerville")) return "Baskerville, serif";
  if (has("didot")) return "Didot, Georgia, serif";
  if (has("constantia")) return "Constantia, Georgia, serif";
  if (has("rockwell")) return "Rockwell, serif";

  if (has("courier new", "couriernew", "cousine")) return '"Courier New", Courier, monospace';
  if (has("courier")) return "Courier, monospace";
  if (has("consolas")) return "Consolas, monospace";
  if (has("menlo")) return "Menlo, monospace";
  if (has("monaco")) return "Monaco, monospace";

  if (has("comic sans", "comicsans", "comic neue")) return '"Comic Sans MS", "Comic Neue", cursive';
  if (has("impact")) return "Impact, sans-serif";
  if (has("papyrus")) return "Papyrus, fantasy";

  return cssFontFamily(bucketFamily, cssFallback);
}

/** family key from pdfLineStyles/pdfTextRedact's `guessStandardFont` -> a real, on-screen CSS font stack (export-safe bucket, used as a last-resort fallback). */
function cssFontFamily(family, fallback) {
  if (family === "times") return '"Times New Roman", Times, serif';
  if (family === "courier") return '"Courier New", Courier, monospace';
  if (family === "helvetica") return "Helvetica, Arial, sans-serif";
  return fallback || "Helvetica, Arial, sans-serif";
}

export default function PdfCanvas({ pdfDoc }) {
  const wrapperRef = useRef(null);
  const bgCanvasRef = useRef(null);
  const fabricElRef = useRef(null);
  const fabricRef = useRef(null);
  const isLoadingRef = useRef(false);
  const drawingShapeRef = useRef(null);
  const clipboardRef = useRef(null);
  const cropStateRef = useRef(null);
  // Tracks whether the on-screen canvas has changes not yet written into
  // canvasJSON/history. Word-like editors never lose a keystroke, so every
  // path that can navigate away from the page (switch page, reorder,
  // delete, export, close tab) flushes this first via flushPendingEdits().
  const dirtyRef = useRef(false);
  const handle = useCanvasHandle();

  const pages = useEditorStore((s) => s.pages);
  const activePageId = useEditorStore((s) => s.activePageId);
  const zoom = useEditorStore((s) => s.zoom);
  const tool = useEditorStore((s) => s.tool);
  const toolOptions = useEditorStore((s) => s.toolOptions);
  const canvasJSON = useEditorStore((s) => s.canvasJSON);
  const commitCanvasState = useEditorStore((s) => s.commitCanvasState);
  const setTool = useEditorStore((s) => s.setTool);
  const bumpSelection = useEditorStore((s) => s.bumpSelection);
  const originalFile = useEditorStore((s) => s.originalFile);

  const activePage = pages.find((p) => p.id === activePageId);

  const commit = () => {
    const canvas = fabricRef.current;
    if (!canvas || isLoadingRef.current || !activePageId) return;
    // `isTextEdit`/`lineIndex` are our own tags marking objects that replace
    // *original* PDF text (as opposed to annotations the user drew) — they
    // need to survive serialization so export can tell the two apart.
    // `origLeft`/`origTop` are the exact left/top the replacement text box
    // was *created* at (== the original PDF line's position) — export uses
    // the delta between that and the object's *current* left/top to place
    // the replacement exactly where the user left it on screen, including
    // after it's been dragged or resized, instead of always snapping back
    // to the original line's position (see pdfExport.js's applyTextEdits).
    commitCanvasState(
      activePageId,
      JSON.stringify(canvas.toJSON(["isTextEdit", "lineIndex", "origLeft", "origTop"]))
    );
    dirtyRef.current = false;
  };
  const markDirty = () => {
    dirtyRef.current = true;
  };

  // Initialize fabric canvas once per active page (dimensions depend on the page).
  useEffect(() => {
    if (!activePage) return;
    let disposed = false;

    const widthPx = Math.round(activePage.widthPt * zoom);
    const heightPx = Math.round(activePage.heightPt * zoom);

    const canvas = new FabricCanvas(fabricElRef.current, {
      width: widthPx,
      height: heightPx,
      backgroundColor: "transparent",
      preserveObjectStacking: true,
    });
    canvas.setZoom(zoom);
    fabricRef.current = canvas;

    const savedJSON = canvasJSON[activePage.id];
    isLoadingRef.current = true;
    const afterLoad = () => {
      if (disposed) return; // page was switched away before the saved JSON finished loading
      isLoadingRef.current = false;
      canvas.renderAll();
    };
    if (savedJSON) {
      canvas.loadFromJSON(JSON.parse(savedJSON)).then(afterLoad).catch(afterLoad);
    } else {
      afterLoad();
    }

    const onModified = () => commit();
    const onAdded = () => {
      if (!isLoadingRef.current) commit();
    };
    const onRemoved = () => {
      if (!isLoadingRef.current) commit();
    };
    const onSelection = () => bumpSelection();

    // Fires on every keystroke inside an IText/Textbox that's mid-edit.
    // We don't commit synchronously on each keystroke (that would spam the
    // undo stack and JSON-stringify the whole page on every character) —
    // instead mark dirty immediately (so flushPendingEdits always has a
    // truthful answer) and commit on a short debounce, so a long typing
    // session still gets saved periodically instead of only at the very end.
    let typingDebounce = null;
    const onTextChanged = () => {
      if (isLoadingRef.current) return;
      markDirty();
      if (typingDebounce) clearTimeout(typingDebounce);
      typingDebounce = setTimeout(() => commit(), 600);
    };

    canvas.on("object:modified", onModified);
    canvas.on("object:added", onAdded);
    canvas.on("object:removed", onRemoved);
    canvas.on("selection:created", onSelection);
    canvas.on("selection:updated", onSelection);
    canvas.on("selection:cleared", onSelection);
    canvas.on("path:created", () => commit());
    canvas.on("text:changed", onTextChanged);
    canvas.on("object:moving", markDirty);
    canvas.on("object:scaling", markDirty);
    canvas.on("object:rotating", markDirty);

    // Shape drawing tools (rect/circle/line) via manual drag handlers
    /**
     * Shared by both the "Tambah Teks" and "Edit Teks Asli" tools: if
     * `pointer` lands on text that's already on the page — either an
     * original PDF line (from `pageTextCache`) or one already edited this
     * session — open it for editing in place and return true. Both tools
     * call this *first*, so which tool happens to be selected no longer
     * matters for the one behaviour that should never change: clicking
     * existing text edits it, exactly like iLovePDF, instead of ever
     * stacking a new "Teks baru" box on top of it.
     */
    const tryEditExistingTextAt = (pointer, rawEvent) => {
      // A couple of page-space points of tolerance around each line's tight
      // bounding box — clicking a hair above/below/beside the exact glyph
      // box (very easy to do, especially on short lines or at typical zoom
      // levels) would otherwise silently miss and fall through to creating
      // a brand-new text box right on top of the original, i.e. a visual
      // "duplicate" instead of editing what's already there.
      const PAD = 2.5;
      // Live objects (already edited this session, possibly grown/moved
      // past their original PDF geometry) take priority — re-clicking text
      // you've already edited must always reopen that same object, never
      // spawn a second, overlapping one.
      const editedObjects = canvas
        .getObjects()
        .filter((o) => o.isTextEdit && (o.type === "IText" || o.type === "Textbox"));
      const liveHit = editedObjects.find((o) => {
        const r = o.getBoundingRect();
        return (
          pointer.x >= r.left - PAD &&
          pointer.x <= r.left + r.width + PAD &&
          pointer.y >= r.top - PAD &&
          pointer.y <= r.top + r.height + PAD
        );
      });
      if (liveHit) {
        canvas.setActiveObject(liveHit);
        liveHit.enterEditing();
        // Place the caret exactly where the user clicked instead of
        // selecting the whole line — editing an existing line should feel
        // like fixing a word in place, not wiping the line and retyping it.
        // (Ctrl+A still selects everything if that's what's wanted.)
        if (rawEvent) liveHit.setCursorByClick(rawEvent);
        else liveHit.selectAll();
        return true;
      }

      const cache = pageTextCache.get(activePage.id);
      const lines = cache?.lines || [];
      const lineIndex = lines.findIndex(
        (l) =>
          pointer.x >= l.left - PAD &&
          pointer.x <= l.left + l.width + PAD &&
          pointer.y >= l.top - PAD &&
          pointer.y <= l.top + l.height + PAD
      );
      if (lineIndex === -1) return false;

      // Belt-and-suspenders duplicate of the liveHit check above, for a
      // line that's been edited but hasn't moved (so its lineIndex still
      // resolves against the original geometry too).
      const existing = canvas
        .getObjects()
        .find((o) => o.isTextEdit && o.lineIndex === lineIndex && (o.type === "IText" || o.type === "Textbox"));
      if (existing) {
        canvas.setActiveObject(existing);
        existing.enterEditing();
        if (rawEvent) existing.setCursorByClick(rawEvent);
        else existing.selectAll();
        return true;
      }

      const hit = lines[lineIndex];
      const style = cache?.styles?.get(lineIndex);
      const { textObj } = createLineEditObjects({
        canvas,
        hit,
        lineIndex,
        bgCanvasEl: bgCanvasRef.current,
        zoom,
        style,
        defaultFontFamily: useEditorStore.getState().toolOptions.fontFamily,
        text: hit.text,
        maxWidth: activePage.widthPt - hit.left - 4,
      });
      canvas.setActiveObject(textObj);
      textObj.enterEditing();
      if (rawEvent) textObj.setCursorByClick(rawEvent);
      else textObj.selectAll();

      const onExit = () => {
        if (!textObj.text || textObj.text.trim() === "") {
          canvas.remove(textObj); // empty = a real deletion, patch stays
        }
        textObj.off("editing:exited", onExit);
        commit();
      };
      textObj.on("editing:exited", onExit);
      return true;
    };

    const onMouseDown = (opt) => {
      const currentTool = useEditorStore.getState().tool;
      const opts = useEditorStore.getState().toolOptions;
      const pointer = canvas.getScenePoint(opt.e);

      // "Pilih & Pindah" (select) is purely for selecting/moving objects —
      // it must never open text editing on its own. Only "Tambah Teks" (as
      // a courtesy redirect, see below) and "Edit Teks Asli" ever call
      // tryEditExistingTextAt.

      if (currentTool === "text") {
        // Clicking existing text (original PDF text, or something already
        // edited this session) with "Tambah Teks" active edits it in place
        // — the same as "Edit Teks Asli" would — instead of dropping a new
        // blank "Teks baru" box on top of it. Only truly empty space falls
        // through to actually adding a new text box below.
        if (tryEditExistingTextAt(pointer, opt.e)) {
          setTool("select");
          return;
        }

        // Textbox (not IText) so long lines wrap inside the box instead of
        // running off-page — the closest fabric gets to Word's word wrap.
        const textObj = new Textbox("Teks baru", {
          left: pointer.x,
          top: pointer.y,
          width: Math.max(120, opts.fontSize * 8),
          fontSize: opts.fontSize,
          fontFamily: opts.fontFamily,
          fill: opts.color,
          fontWeight: opts.bold ? "bold" : "normal",
          fontStyle: opts.italic ? "italic" : "normal",
          underline: !!opts.underline,
          linethrough: !!opts.strikethrough,
          textBackgroundColor: opts.highlightColor && opts.highlightColor !== "transparent" ? opts.highlightColor : "",
          lineHeight: opts.lineHeight || 1.16,
          textAlign: opts.align || "left",
          splitByGrapheme: false,
        });
        canvas.add(textObj);
        canvas.setActiveObject(textObj);
        textObj.enterEditing();
        textObj.selectAll();
        // Without this, text typed and then abandoned by clicking a page
        // thumbnail / switching tools (rather than clicking elsewhere on
        // the *same* canvas) never got committed — the whole block would
        // silently vanish. Mirrors the commit-on-exit used by "editText".
        const onNewTextExit = () => {
          if (!textObj.text || textObj.text.trim() === "") {
            canvas.remove(textObj);
          }
          textObj.off("editing:exited", onNewTextExit);
          commit();
        };
        textObj.on("editing:exited", onNewTextExit);
        setTool("select");
        return;
      }

      if (currentTool === "editText") {
        if (tryEditExistingTextAt(pointer, opt.e)) return; // stay in "editText" for the next click
        // Clicked blank space, not any known text — that's the one way to
        // step back out of Edit Text mode without using the toolbar.
        setTool("select");
        return;
      }

      if (["rect", "circle", "line"].includes(currentTool)) {
        let shape;
        if (currentTool === "rect") {
          shape = new Rect({
            left: pointer.x,
            top: pointer.y,
            width: 1,
            height: 1,
            fill: "transparent",
            stroke: opts.color,
            strokeWidth: opts.strokeWidth,
          });
        } else if (currentTool === "circle") {
          shape = new Circle({
            left: pointer.x,
            top: pointer.y,
            radius: 1,
            fill: "transparent",
            stroke: opts.color,
            strokeWidth: opts.strokeWidth,
          });
        } else {
          shape = new Line([pointer.x, pointer.y, pointer.x, pointer.y], {
            stroke: opts.color,
            strokeWidth: opts.strokeWidth,
          });
        }
        canvas.add(shape);
        drawingShapeRef.current = { shape, origin: pointer, type: currentTool };
      }
    };

    const onMouseMove = (opt) => {
      const drawing = drawingShapeRef.current;
      if (!drawing) return;
      const pointer = canvas.getScenePoint(opt.e);
      const { shape, origin, type } = drawing;

      if (type === "rect") {
        shape.set({
          left: Math.min(origin.x, pointer.x),
          top: Math.min(origin.y, pointer.y),
          width: Math.abs(pointer.x - origin.x),
          height: Math.abs(pointer.y - origin.y),
        });
      } else if (type === "circle") {
        const r = Math.hypot(pointer.x - origin.x, pointer.y - origin.y) / 2;
        shape.set({
          radius: r,
          left: Math.min(origin.x, pointer.x),
          top: Math.min(origin.y, pointer.y),
        });
      } else if (type === "line") {
        shape.set({ x2: pointer.x, y2: pointer.y });
      }
      canvas.requestRenderAll();
    };

    const onMouseUp = () => {
      if (!drawingShapeRef.current) return;
      const { shape } = drawingShapeRef.current;
      shape.setCoords();
      drawingShapeRef.current = null;
      canvas.setActiveObject(shape);
      setTool("select");
      commit();
    };

    canvas.on("mouse:down", onMouseDown);
    canvas.on("mouse:move", onMouseMove);
    canvas.on("mouse:up", onMouseUp);

    // Expose imperative API to toolbar / properties panel / Find & Replace
    handle.current.canvas = canvas;
    handle.current.canvasPageId = activePage.id;
    handle.current.getActive = () => canvas.getActiveObject();
    // Apply an edit to an already-known line without any click/UI interaction —
    // used by FindReplaceBar's "Replace"/"Replace All", including on pages
    // that aren't the one currently on screen (the caller switches to them
    // first). Updates an existing edit for that line in place if there is
    // one, otherwise creates a new mask+text pair exactly like clicking it
    // with the "Edit Teks Asli" tool would.
    handle.current.applyLineEdit = (lineIndex, newText) => {
      const cache = pageTextCache.get(activePage.id);
      const hit = cache?.lines?.[lineIndex];
      if (!hit) return false;
      const existing = canvas
        .getObjects()
        .find((o) => o.isTextEdit && o.lineIndex === lineIndex && (o.type === "IText" || o.type === "Textbox"));
      if (existing) {
        if (newText.trim() === "") canvas.remove(existing); // empty = deletion, mask stays
        else existing.set("text", newText);
      } else {
        // No prior edit on this line yet: always lay the mask down (so the
        // original glyphs stop showing through), and only add live text on
        // top when there's actually something to show.
        createLineEditObjects({
          canvas,
          hit,
          lineIndex,
          bgCanvasEl: bgCanvasRef.current,
          zoom,
          style: cache?.styles?.get(lineIndex),
          defaultFontFamily: useEditorStore.getState().toolOptions.fontFamily,
          text: newText,
          skipText: newText.trim() === "",
          maxWidth: activePage.widthPt - hit.left - 4,
        });
      }
      canvas.requestRenderAll();
      commit();
      return true;
    };
    handle.current.deleteActive = () => {
      const objs = canvas.getActiveObjects();
      if (objs.length === 0) return;
      objs.forEach((o) => canvas.remove(o));
      canvas.discardActiveObject();
      canvas.requestRenderAll();
      commit();
      bumpSelection();
    };
    handle.current.applyToActive = (props) => {
      const obj = canvas.getActiveObject();
      if (!obj) return;
      obj.set(props);
      canvas.requestRenderAll();
      commit();
      bumpSelection();
    };
    // Word-style rich formatting: bold/italic/underline. If the object is
    // mid-edit with an actual text selection, style only that selection
    // (fabric's per-character styling) — otherwise toggle the whole object,
    // same as clicking B/I/U with nothing selected in Word.
    handle.current.toggleTextStyle = (kind) => {
      const obj = canvas.getActiveObject();
      if (!obj || !["IText", "Textbox"].includes(obj.type)) return;
      const propMap = {
        bold: { prop: "fontWeight", on: "bold", off: "normal" },
        italic: { prop: "fontStyle", on: "italic", off: "normal" },
        underline: { prop: "underline", on: true, off: false },
        strikethrough: { prop: "linethrough", on: true, off: false },
      };
      const cfg = propMap[kind];
      if (!cfg) return;

      const hasSelection =
        obj.isEditing && typeof obj.selectionStart === "number" && obj.selectionEnd > obj.selectionStart;

      if (hasSelection) {
        const styles = obj.getSelectionStyles(obj.selectionStart, obj.selectionEnd, true);
        const currentlyOn = styles.some((s) => s[cfg.prop] === cfg.on);
        obj.setSelectionStyles({ [cfg.prop]: currentlyOn ? cfg.off : cfg.on }, obj.selectionStart, obj.selectionEnd);
        obj.dirty = true;
      } else {
        const currentlyOn = obj[cfg.prop] === cfg.on;
        obj.set({ [cfg.prop]: currentlyOn ? cfg.off : cfg.on });
      }
      canvas.requestRenderAll();
      commit();
      bumpSelection();
    };
    handle.current.setTextAlign = (align) => {
      const obj = canvas.getActiveObject();
      if (!obj || !["IText", "Textbox"].includes(obj.type)) return;
      obj.set({ textAlign: align });
      canvas.requestRenderAll();
      commit();
      bumpSelection();
    };
    // Ctrl/Cmd+A while not mid-edit selects every object on the page, mirroring
    // Word's "select all" — text-level select-all is handled natively by
    // fabric's IText/Textbox while actually editing.
    handle.current.selectAllObjects = () => {
      const objs = canvas.getObjects().filter((o) => o.selectable !== false);
      if (objs.length === 0) return;
      canvas.discardActiveObject();
      if (objs.length === 1) {
        canvas.setActiveObject(objs[0]);
      } else {
        const sel = new ActiveSelection(objs, { canvas });
        canvas.setActiveObject(sel);
      }
      canvas.requestRenderAll();
      bumpSelection();
    };
    handle.current.addImageFromDataUrl = async (dataUrl) => {
      const img = await FabricImage.fromURL(dataUrl);
      if (disposed) return; // canvas/page changed while the image was decoding
      const maxDim = Math.min(activePage.widthPt, activePage.heightPt) * 0.5;
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      img.set({
        left: (activePage.widthPt - img.width * scale) / 2,
        top: (activePage.heightPt - img.height * scale) / 2,
        scaleX: scale,
        scaleY: scale,
      });
      canvas.add(img);
      canvas.setActiveObject(img);
      canvas.requestRenderAll();
      commit();
    };

    // Word-style z-order control: front / forward one step / backward one
    // step / all the way to back.
    handle.current.reorderLayer = (direction) => {
      const obj = canvas.getActiveObject();
      if (!obj) return;
      if (direction === "front") canvas.bringObjectToFront(obj);
      else if (direction === "back") canvas.sendObjectToBack(obj);
      else if (direction === "forward") canvas.bringObjectForward(obj);
      else if (direction === "backward") canvas.sendObjectBackwards(obj);
      canvas.requestRenderAll();
      commit();
      bumpSelection();
    };

    // Group multiple selected objects into one movable/resizable unit —
    // fabric v6+ dropped ActiveSelection#toGroup(), so this rebuilds it by
    // hand: pull the objects out (preserving their canvas z-order) and hand
    // them to `new Group()`, which itself computes the group's bounding box
    // and each child's group-relative position from their current absolute
    // coordinates.
    handle.current.groupSelection = () => {
      const active = canvas.getActiveObject();
      if (!active || active.type !== "ActiveSelection") return;
      const members = new Set(active.getObjects());
      const ordered = canvas.getObjects().filter((o) => members.has(o));
      if (ordered.length < 2) return;
      canvas.discardActiveObject();
      ordered.forEach((o) => canvas.remove(o));
      const group = new Group(ordered);
      canvas.add(group);
      canvas.setActiveObject(group);
      canvas.requestRenderAll();
      commit();
      bumpSelection();
    };

    // Ungroup: `Group#removeAll()` hands back the children with their
    // group transform re-applied (so they land exactly where they visually
    // were), then we re-select them all as a plain multi-selection.
    handle.current.ungroupSelection = () => {
      const active = canvas.getActiveObject();
      if (!active || active.type !== "Group") return;
      const objects = active.removeAll();
      canvas.remove(active);
      objects.forEach((o) => {
        o.setCoords();
        canvas.add(o);
      });
      canvas.setActiveObject(new ActiveSelection(objects, { canvas }));
      canvas.requestRenderAll();
      commit();
      bumpSelection();
    };

    // Align the active object (or group/selection) to the page edges or
    // center — the same "Align" menu Word/PowerPoint give you for objects.
    handle.current.alignActive = (mode) => {
      const obj = canvas.getActiveObject();
      if (!obj || !activePage) return;
      const box = obj.getBoundingRect();
      const pw = activePage.widthPt;
      const ph = activePage.heightPt;
      let dx = 0;
      let dy = 0;
      if (mode === "left") dx = -box.left;
      else if (mode === "center-h") dx = (pw - box.width) / 2 - box.left;
      else if (mode === "right") dx = pw - box.width - box.left;
      else if (mode === "top") dy = -box.top;
      else if (mode === "middle-v") dy = (ph - box.height) / 2 - box.top;
      else if (mode === "bottom") dy = ph - box.height - box.top;
      obj.set({ left: (obj.left || 0) + dx, top: (obj.top || 0) + dy });
      obj.setCoords();
      canvas.requestRenderAll();
      commit();
      bumpSelection();
    };

    // Ctrl+D-style duplicate, offset slightly so the copy is visible and
    // grabbable right away instead of sitting exactly on top of the original.
    handle.current.duplicateActive = () => {
      const obj = canvas.getActiveObject();
      if (!obj || obj.type === "ActiveSelection") return;
      obj.clone().then((cloned) => {
        if (disposed) return;
        canvas.discardActiveObject();
        cloned.set({
          left: (cloned.left || 0) + 16,
          top: (cloned.top || 0) + 16,
          isTextEdit: false,
          lineIndex: undefined,
        });
        canvas.add(cloned);
        canvas.setActiveObject(cloned);
        canvas.requestRenderAll();
        commit();
        bumpSelection();
      });
    };

    // --- Image crop -------------------------------------------------
    // A crop "window" rectangle is overlaid on top of the image; the user
    // resizes/moves *that*, and Apply bakes the result into the image's own
    // cropX/cropY/width/height (fabric's native crop props) so the framing
    // survives export like any other image edit. Kept to axis-aligned
    // (unrotated) images so the math stays exact instead of approximate.
    handle.current.isCropping = () => !!cropStateRef.current;
    handle.current.startCrop = () => {
      const obj = canvas.getActiveObject();
      if (!obj || obj.type !== "Image") return;
      const angle = ((obj.angle || 0) % 360 + 360) % 360;
      if (angle > 0.5 && angle < 359.5) return; // rotated images: skip, see above
      const dispW = (obj.width || 0) * (obj.scaleX || 1);
      const dispH = (obj.height || 0) * (obj.scaleY || 1);
      const rectangle = new Rect({
        left: obj.left,
        top: obj.top,
        width: dispW,
        height: dispH,
        fill: "rgba(47,111,237,0.12)",
        stroke: "#2f6fed",
        strokeWidth: 1.5 / zoom,
        strokeUniform: true,
        cornerColor: "#2f6fed",
        cornerStyle: "circle",
        transparentCorners: false,
        lockRotation: true,
      });
      rectangle.setControlsVisibility({ mtr: false });
      obj.selectable = false;
      obj.evented = false;
      canvas.add(rectangle);
      canvas.setActiveObject(rectangle);
      canvas.requestRenderAll();
      cropStateRef.current = {
        target: obj,
        rectangle,
        origin: { left: obj.left, top: obj.top, width: dispW, height: dispH },
      };
      bumpSelection();
    };
    handle.current.applyCrop = () => {
      const state = cropStateRef.current;
      if (!state) return;
      const { target, rectangle, origin } = state;
      const scaleX = target.scaleX || 1;
      const scaleY = target.scaleY || 1;
      const rectW = rectangle.width * (rectangle.scaleX || 1);
      const rectH = rectangle.height * (rectangle.scaleY || 1);
      // Clamp the crop window to the image's own bounds — the handles can
      // be dragged, but the result should never crop outside the source.
      const left = Math.min(Math.max(rectangle.left, origin.left), origin.left + origin.width - 4);
      const top = Math.min(Math.max(rectangle.top, origin.top), origin.top + origin.height - 4);
      const width = Math.min(Math.max(rectW, 4), origin.left + origin.width - left);
      const height = Math.min(Math.max(rectH, 4), origin.top + origin.height - top);

      const newCropX = (target.cropX || 0) + (left - target.left) / scaleX;
      const newCropY = (target.cropY || 0) + (top - target.top) / scaleY;
      target.set({
        cropX: newCropX,
        cropY: newCropY,
        width: width / scaleX,
        height: height / scaleY,
        left,
        top,
      });
      target.setCoords();
      canvas.remove(rectangle);
      target.selectable = true;
      target.evented = true;
      canvas.setActiveObject(target);
      cropStateRef.current = null;
      canvas.requestRenderAll();
      commit();
      bumpSelection();
    };
    handle.current.cancelCrop = () => {
      const state = cropStateRef.current;
      if (!state) return;
      canvas.remove(state.rectangle);
      state.target.selectable = true;
      state.target.evented = true;
      canvas.setActiveObject(state.target);
      cropStateRef.current = null;
      canvas.requestRenderAll();
      bumpSelection();
    };

    // Save any not-yet-committed edit (a mid-typing textbox that never blurred,
    // a drag that didn't fire object:modified yet, ...). Called before every
    // action that could otherwise discard work: switching page, reordering /
    // deleting pages, exporting, and on unmount.
    const flushPendingEdits = () => {
      if (typingDebounce) {
        clearTimeout(typingDebounce);
        typingDebounce = null;
      }
      const active = canvas.getActiveObject();
      if (active && active.isEditing && typeof active.exitEditing === "function") {
        active.exitEditing();
      }
      if (cropStateRef.current) handle.current.cancelCrop();
      if (dirtyRef.current) commit();
    };
    handle.current.flushPendingEdits = flushPendingEdits;

    return () => {
      disposed = true;
      flushPendingEdits();
      canvas.dispose();
      if (handle.current.canvas === canvas) {
        handle.current.canvas = null;
        handle.current.canvasPageId = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePageId]);

  // Adjust zoom on the existing canvas instance without a full reload.
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || !activePage) return;
    canvas.setDimensions({
      width: Math.round(activePage.widthPt * zoom),
      height: Math.round(activePage.heightPt * zoom),
    });
    canvas.setZoom(zoom);
    canvas.requestRenderAll();
  }, [zoom, activePage?.widthPt, activePage?.heightPt]);

  // Render pdf background whenever page/zoom changes
  useEffect(() => {
    if (!activePage || activePage.kind !== "source" || !pdfDoc) return;
    let cancelled = false;
    renderPageToCanvas(pdfDoc, activePage.sourceIndex + 1, zoom).then(({ canvas: rendered }) => {
      if (cancelled || !bgCanvasRef.current) return;
      bgCanvasRef.current.width = rendered.width;
      bgCanvasRef.current.height = rendered.height;
      const ctx = bgCanvasRef.current.getContext("2d");
      ctx.clearRect(0, 0, rendered.width, rendered.height);
      ctx.drawImage(rendered, 0, 0);
    });
    return () => {
      cancelled = true;
    };
  }, [activePage?.id, activePage?.kind, activePage?.sourceIndex, zoom, pdfDoc]);

  // Extract the original text runs' bounding boxes (and, best-effort, their
  // real font/colour) once per source page, so the "Edit Teks Asli" tool can
  // find the exact line under a click, and so it starts from the PDF's own
  // styling instead of a pixel-sampled guess. Shared across the whole editor
  // (see pageTextCache.js) so Find & Replace reuses the same data instead of
  // re-parsing pages on its own.
  useEffect(() => {
    if (!activePage || activePage.kind !== "source" || !pdfDoc) return;
    ensurePageTextCached(pdfDoc, activePage, originalFile);
  }, [activePage?.id, activePage?.kind, activePage?.sourceIndex, pdfDoc, originalFile]);

  // Canvas-level keyboard shortcuts: undo/redo, copy/cut/paste, delete.
  // Deliberately steps aside for real text-input targets (typing inside an
  // IText, or any actual <input>/<textarea> such as the Find & Replace bar)
  // so native editing keys keep working exactly as the browser expects.
  useEffect(() => {
    const isEditableTarget = (el) => {
      if (!el) return false;
      const tag = el.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
    };

    const loadJson = (canvas, json) => {
      if (!json) {
        canvas.clear();
        canvas.requestRenderAll();
        return;
      }
      canvas.loadFromJSON(JSON.parse(json)).then(() => canvas.requestRenderAll());
    };

    // `commit`/`bumpSelection` above close over the render this effect was
    // created in ([] deps means that's only ever the *first* render), so
    // they'd keep targeting whatever page was active back then. Read fresh
    // state straight from the store on every keypress instead.
    const commitFresh = () => {
      const canvas = fabricRef.current;
      const store = useEditorStore.getState();
      if (!canvas || isLoadingRef.current || !store.activePageId) return;
      store.commitCanvasState(store.activePageId, JSON.stringify(canvas.toJSON(["isTextEdit", "lineIndex"])));
    };

    const onKeyDown = (e) => {
      const canvas = fabricRef.current;
      if (!canvas) return;
      const activeObj = canvas.getActiveObject();
      if ((activeObj && activeObj.isEditing) || isEditableTarget(document.activeElement)) return;

      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (mod && key === "z") {
        e.preventDefault();
        const store = useEditorStore.getState();
        const pageId = store.activePageId;
        const json = e.shiftKey ? store.redo(pageId) : store.undo(pageId);
        if (json !== null) loadJson(canvas, json);
        return;
      }
      if (mod && key === "y") {
        e.preventDefault();
        const store = useEditorStore.getState();
        const json = store.redo(store.activePageId);
        if (json !== null) loadJson(canvas, json);
        return;
      }
      if (mod && key === "a") {
        e.preventDefault();
        handle.current.selectAllObjects?.();
        return;
      }
      if (mod && key === "d") {
        e.preventDefault();
        handle.current.duplicateActive?.();
        return;
      }
      if (key === "escape") {
        if (handle.current.isCropping?.()) {
          e.preventDefault();
          handle.current.cancelCrop?.();
        } else {
          canvas.discardActiveObject();
          canvas.requestRenderAll();
          useEditorStore.getState().bumpSelection();
        }
        return;
      }
      if (mod && key === "c") {
        const obj = canvas.getActiveObject();
        if (!obj) return;
        e.preventDefault();
        obj.clone().then((cloned) => {
          clipboardRef.current = cloned;
        });
        return;
      }
      if (mod && key === "x") {
        const obj = canvas.getActiveObject();
        if (!obj) return;
        e.preventDefault();
        obj.clone().then((cloned) => {
          clipboardRef.current = cloned;
        });
        canvas.remove(obj);
        canvas.discardActiveObject();
        canvas.requestRenderAll();
        commitFresh();
        useEditorStore.getState().bumpSelection();
        return;
      }
      if (mod && key === "v") {
        if (!clipboardRef.current) return;
        e.preventDefault();
        clipboardRef.current.clone().then((cloned) => {
          canvas.discardActiveObject();
          cloned.set({
            left: (cloned.left || 0) + 16,
            top: (cloned.top || 0) + 16,
            isTextEdit: false, // a pasted copy is a new annotation, not a stand-in for original PDF text
            lineIndex: undefined,
          });
          canvas.add(cloned);
          canvas.setActiveObject(cloned);
          canvas.requestRenderAll();
          commitFresh();
          useEditorStore.getState().bumpSelection();
        });
        return;
      }
      if (key === "delete" || key === "backspace") {
        const objs = canvas.getActiveObjects();
        if (objs.length === 0) return;
        e.preventDefault();
        objs.forEach((o) => canvas.remove(o));
        canvas.discardActiveObject();
        canvas.requestRenderAll();
        commitFresh();
        useEditorStore.getState().bumpSelection();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // React to tool changes: toggle drawing mode / brush config
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    if (tool === "draw" || tool === "highlight") {
      canvas.isDrawingMode = true;
      const brush = new PencilBrush(canvas);
      if (tool === "highlight") {
        brush.color = hexToRgba(toolOptions.color, 0.35);
        brush.width = Math.max(14, toolOptions.strokeWidth * 5);
      } else {
        brush.color = toolOptions.color;
        brush.width = toolOptions.strokeWidth;
      }
      canvas.freeDrawingBrush = brush;
    } else {
      canvas.isDrawingMode = false;
    }
    canvas.selection = tool === "select";
    canvas.forEachObject((o) => {
      o.selectable = tool === "select";
      o.evented = tool === "select";
    });
    canvas.requestRenderAll();
  }, [tool, toolOptions.color, toolOptions.strokeWidth]);

  if (!activePage) return null;

  const widthPx = Math.round(activePage.widthPt * zoom);
  const heightPx = Math.round(activePage.heightPt * zoom);

  return (
    <div
      ref={wrapperRef}
      className="relative bg-white shadow-md"
      style={{ width: widthPx, height: heightPx, touchAction: "none" }}
    >
      <canvas
        ref={bgCanvasRef}
        className="pointer-events-none absolute left-0 top-0"
        width={widthPx}
        height={heightPx}
      />
      <canvas ref={fabricElRef} className="absolute left-0 top-0" style={{ touchAction: "none" }} />
    </div>
  );
}

/**
 * Lay down the mask+IText pair that stands in for one edited original PDF
 * line. Shared by the direct "click a line" flow and Find/Replace's
 * programmatic edits, so both stay in exact sync (position, sizing, tags).
 * `style` (from pdfLineStyles.js, real content-stream data) takes priority
 * over the pixel-sampled colour; sampling only fills in what `style` couldn't
 * determine (e.g. no /ToUnicode map, or a page pdfTextRedact.js can't parse).
 */
function createLineEditObjects({
  canvas,
  hit,
  lineIndex,
  bgCanvasEl,
  zoom,
  style,
  defaultFontFamily,
  text,
  skipText = false,
  maxWidth,
}) {
  const bgColor = sampleBackgroundColor(bgCanvasEl, hit, zoom);
  const inkColor = style?.color || sampleInkColor(bgCanvasEl, hit, zoom);
  const italic = style?.italic ?? hit.italic;

  const mask = new Rect({
    left: hit.left - 1,
    top: hit.top - 1,
    width: hit.width + 2,
    height: hit.height + 2,
    fill: bgColor,
    selectable: false,
    evented: false,
    isTextEdit: true,
    lineIndex,
  });
  canvas.add(mask);

  let textObj = null;
  if (!skipText) {
    // Textbox (not IText) so a replacement longer than the original line
    // wraps within the page instead of running off the edge — closest
    // fabric gets to Word's word wrap for an in-place edit. Width is the
    // wider of the original line and a few characters' worth of room, but
    // never wider than what's actually left on the page.
    const boxWidth = Math.max(hit.width, hit.fontSize * 3, 40);
    const width = Math.max(20, Math.min(boxWidth, maxWidth || boxWidth));
    const startLeft = hit.left;
    const startTop = hit.top + hit.height * 0.1;
    textObj = new Textbox(text, {
      left: startLeft,
      top: startTop,
      width,
      fontSize: hit.fontSize,
      fontFamily: guessCssFontFamily(style?.rawFontName, style?.family, defaultFontFamily),
      fontWeight: style?.bold ? "bold" : "normal",
      fontStyle: italic ? "italic" : "normal",
      fill: inkColor,
      splitByGrapheme: false,
      isTextEdit: true,
      lineIndex,
      // See the `commit()` comment in the component above — remembers where
      // this box started so export can detect and honor any later move/resize.
      origLeft: startLeft,
      origTop: startTop,
    });
    canvas.add(textObj);

    // As the user types past the original line's width, the Textbox wraps
    // onto extra lines and grows taller — keep the mask in sync so it
    // always fully covers the (possibly now multi-line) replacement,
    // instead of leaving old glyphs peeking out below new ones.
    const syncMaskHeight = () => {
      const h = Math.max(hit.height, textObj.height || 0) + 2;
      if (mask.height !== h) {
        mask.set({ height: h });
        mask.setCoords();
      }
    };
    textObj.on("changed", syncMaskHeight);
    syncMaskHeight();
  }

  return { mask, textObj };
}

function hexToRgba(hex, alpha) {
  const clean = hex.replace("#", "");
  const num = parseInt(clean, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function rgbToHex(r, g, b) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/**
 * Sample the row just above a text line — almost always blank page/cell
 * background, whatever colour it is — so the live-editing patch blends in
 * instead of always being flat white.
 */
function sampleBackgroundColor(bgCanvas, line, zoom) {
  if (!bgCanvas) return "#ffffff";
  try {
    const ctx = bgCanvas.getContext("2d");
    const x = Math.max(0, Math.round(line.left * zoom));
    const y = Math.max(0, Math.round((line.top - 2) * zoom));
    const w = Math.min(Math.max(1, Math.round(line.width * zoom)), bgCanvas.width - x);
    if (w <= 0 || y >= bgCanvas.height) return "#ffffff";
    const { data } = ctx.getImageData(x, y, w, 1);
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < data.length; i += 4) {
      r += data[i]; g += data[i + 1]; b += data[i + 2]; n += 1;
    }
    if (n === 0) return "#ffffff";
    return rgbToHex(r / n, g / n, b / n);
  } catch {
    return "#ffffff";
  }
}

/** Darkest pixel within the original line's box, as a rough ink-colour guess. */
function sampleInkColor(bgCanvas, line, zoom) {
  if (!bgCanvas) return "#111111";
  try {
    const ctx = bgCanvas.getContext("2d");
    const x = Math.max(0, Math.round(line.left * zoom));
    const y = Math.max(0, Math.round(line.top * zoom));
    const w = Math.min(Math.max(1, Math.round(line.width * zoom)), bgCanvas.width - x);
    const h = Math.min(Math.max(1, Math.round(line.height * zoom)), bgCanvas.height - y);
    if (w <= 0 || h <= 0) return "#111111";
    const { data } = ctx.getImageData(x, y, w, h);
    let best = null;
    let bestLum = Infinity;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue;
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      if (lum < bestLum) {
        bestLum = lum;
        best = [data[i], data[i + 1], data[i + 2]];
      }
    }
    return best ? rgbToHex(...best) : "#111111";
  } catch {
    return "#111111";
  }
}
