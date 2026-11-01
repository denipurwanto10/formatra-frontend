import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { usePdfPageImages } from "../../hooks/usePdfPageImages";

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const PAGE_GAP = 8;

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

/**
 * Renders a PDF as correctly-sized, pinch-zoomable/pannable page images.
 *
 * We deliberately don't use an <iframe src={pdfUrl}>: mobile browsers don't
 * render the native PDF plugin consistently inside an iframe (wrong scale,
 * blank frames, no usable pinch-zoom because the plugin has its own nested
 * scroll/zoom context). Rasterizing pages with pdf.js and handling zoom/pan
 * ourselves gives the same result on every device.
 */
export default function PdfPreview({ file, heightClass = "h-64 sm:h-80" }) {
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setContainerWidth(Math.round(el.clientWidth));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { pages, loading } = usePdfPageImages(file, containerWidth);

  return (
    <div ref={containerRef} className={`relative w-full overflow-hidden bg-white ${heightClass}`}>
      {pages.length > 0 ? (
        <ZoomPanCanvas pages={pages} contentWidth={containerWidth} />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[12px] text-muted">
          {loading ? "Memuat pratinjau…" : null}
        </div>
      )}
    </div>
  );
}

function ZoomPanCanvas({ pages, contentWidth }) {
  const wrapRef = useRef(null);
  const [viewSize, setViewSize] = useState({ w: 0, h: 0 });
  const [transform, setTransform] = useState({ scale: 1, tx: 0, ty: 0 });
  const stateRef = useRef({ scale: 1, tx: 0, ty: 0 });
  const pointers = useRef(new Map());
  const gestureRef = useRef(null);
  const [isGesturing, setIsGesturing] = useState(false);
  // Below MIN_SCALE+epsilon we're "not zoomed": let the browser scroll the
  // list of pages natively (touch-action: pan-y) instead of hijacking every
  // touch for manual panning. Manual pan/zoom only kicks in once the user
  // actually pinches or double-taps to zoom in. This is what makes swiping
  // through a multi-page (multi-slide) result feel like normal scrolling on
  // mobile instead of getting stuck.
  const isZoomed = transform.scale > MIN_SCALE + 0.001;

  const contentHeight = pages.reduce((sum, p) => sum + p.height, 0) + Math.max(0, pages.length - 1) * PAGE_GAP;

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setViewSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const applyClamp = useCallback(
    (next) => {
      const scale = clamp(next.scale, MIN_SCALE, MAX_SCALE);
      const scaledW = contentWidth * scale;
      const scaledH = contentHeight * scale;
      let tx = next.tx;
      let ty = next.ty;
      if (scaledW <= viewSize.w) tx = (viewSize.w - scaledW) / 2;
      else tx = clamp(tx, viewSize.w - scaledW, 0);
      if (scaledH <= viewSize.h) ty = (viewSize.h - scaledH) / 2;
      else ty = clamp(ty, viewSize.h - scaledH, 0);
      return { scale, tx, ty };
    },
    [contentWidth, contentHeight, viewSize.w, viewSize.h]
  );

  const setT = useCallback(
    (next) => {
      const clamped = applyClamp(next);
      stateRef.current = clamped;
      setTransform(clamped);
    },
    [applyClamp]
  );

  // Reset to fit whenever the underlying content changes size (new file,
  // rotation, or the container itself got resized).
  useEffect(() => {
    setT({ scale: 1, tx: 0, ty: 0 });
    if (wrapRef.current) wrapRef.current.scrollTop = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentWidth, contentHeight, viewSize.w, viewSize.h]);

  // While not zoomed, the browser owns vertical scrolling natively (see the
  // touch-action / overflow toggle on the wrapper below) and our own `ty`
  // isn't used for layout. The moment the user starts to zoom in — via
  // pinch, double-tap, or the toolbar buttons — we need a starting `ty`
  // baseline that matches whatever they were already scrolled to, so the
  // zoomed view picks up from the same spot instead of jumping to the top.
  const ensureZoomBaseline = useCallback(() => {
    if (!isZoomed && wrapRef.current) {
      stateRef.current = { scale: 1, tx: 0, ty: -wrapRef.current.scrollTop };
    }
  }, [isZoomed]);

  // Mirror image of the above: once the user zooms back out to 1x, hand
  // control back to native scrolling at the equivalent scroll position.
  const prevZoomedRef = useRef(isZoomed);
  useEffect(() => {
    if (prevZoomedRef.current && !isZoomed && wrapRef.current) {
      const maxScroll = Math.max(0, contentHeight - viewSize.h);
      wrapRef.current.scrollTop = clamp(-stateRef.current.ty, 0, maxScroll);
    }
    prevZoomedRef.current = isZoomed;
  }, [isZoomed, contentHeight, viewSize.h]);

  const zoomAt = useCallback(
    (factor, cx, cy) => {
      const cur = stateRef.current;
      const newScale = clamp(cur.scale * factor, MIN_SCALE, MAX_SCALE);
      const ratio = newScale / cur.scale;
      const tx = cx - (cx - cur.tx) * ratio;
      const ty = cy - (cy - cur.ty) * ratio;
      setT({ scale: newScale, tx, ty });
    },
    [setT]
  );

  const onPointerDown = (e) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 1) {
      // At 1x, a single finger/mouse drag is left to native scrolling
      // (touch-action: pan-y / overflow-y: auto below) so it feels exactly
      // like scrolling any other list — we only take over once actually
      // zoomed in, where native scroll no longer applies.
      if (!isZoomed) return;
      e.currentTarget.setPointerCapture?.(e.pointerId);
      setIsGesturing(true);
      gestureRef.current = {
        mode: "pan",
        startX: e.clientX,
        startY: e.clientY,
        tx0: stateRef.current.tx,
        ty0: stateRef.current.ty,
      };
    } else if (pointers.current.size === 2) {
      // A second finger always means "start pinch-zooming", regardless of
      // current zoom level.
      e.currentTarget.setPointerCapture?.(e.pointerId);
      ensureZoomBaseline();
      setIsGesturing(true);
      const pts = [...pointers.current.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      gestureRef.current = {
        mode: "pinch",
        startDist: dist || 1,
        startScale: stateRef.current.scale,
        midX: (pts[0].x + pts[1].x) / 2,
        midY: (pts[0].y + pts[1].y) / 2,
        tx0: stateRef.current.tx,
        ty0: stateRef.current.ty,
      };
    }
  };

  const onPointerMove = (e) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gestureRef.current;
    if (!g) return;
    if (g.mode === "pan" && pointers.current.size === 1) {
      setT({
        scale: stateRef.current.scale,
        tx: g.tx0 + (e.clientX - g.startX),
        ty: g.ty0 + (e.clientY - g.startY),
      });
    } else if (g.mode === "pinch" && pointers.current.size === 2) {
      const pts = [...pointers.current.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const rect = wrapRef.current.getBoundingClientRect();
      const newScale = clamp(g.startScale * (dist / g.startDist), MIN_SCALE, MAX_SCALE);
      const midX = g.midX - rect.left;
      const midY = g.midY - rect.top;
      const ratio = newScale / g.startScale;
      setT({ scale: newScale, tx: midX - (midX - g.tx0) * ratio, ty: midY - (midY - g.ty0) * ratio });
    }
  };

  const endPointer = (e) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) {
      gestureRef.current = null;
      setIsGesturing(false);
    } else if (pointers.current.size === 1 && isZoomed) {
      const [[, p]] = pointers.current;
      gestureRef.current = { mode: "pan", startX: p.x, startY: p.y, tx0: stateRef.current.tx, ty0: stateRef.current.ty };
    }
  };

  const onDoubleClick = (e) => {
    const rect = wrapRef.current.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    if (isZoomed) {
      setT({ scale: 1, tx: 0, ty: 0 });
    } else {
      ensureZoomBaseline();
      zoomAt(2.5, cx, cy);
    }
  };

  const onWheel = (e) => {
    if (e.ctrlKey || e.metaKey) {
      // Pinch-to-zoom on a trackpad, or ctrl/cmd+wheel: always zoom.
      e.preventDefault();
      ensureZoomBaseline();
      const rect = wrapRef.current.getBoundingClientRect();
      zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - rect.left, e.clientY - rect.top);
    } else if (isZoomed) {
      // Plain scrolling while zoomed pans the (now non-native-scrollable) view.
      e.preventDefault();
      setT({ scale: stateRef.current.scale, tx: stateRef.current.tx - e.deltaX, ty: stateRef.current.ty - e.deltaY });
    }
    // At 1x with no modifier key, let the wheel/trackpad scroll the
    // container natively — don't preventDefault or intercept it.
  };

  const zoomInButton = () => {
    ensureZoomBaseline();
    zoomAt(1.4, viewSize.w / 2, viewSize.h / 2);
  };

  return (
    <div
      ref={wrapRef}
      className={`relative h-full w-full select-none ${
        isZoomed ? "touch-none overflow-hidden" : "touch-pan-y overflow-y-auto overflow-x-hidden"
      }`}
      style={isZoomed ? undefined : { WebkitOverflowScrolling: "touch" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onPointerLeave={endPointer}
      onDoubleClick={onDoubleClick}
      onWheel={onWheel}
    >
      <div
        className="flex flex-col origin-top-left"
        style={{
          width: contentWidth,
          gap: PAGE_GAP,
          transform: isZoomed
            ? `translate3d(${transform.tx}px, ${transform.ty}px, 0) scale(${transform.scale})`
            : "none",
          transition: isGesturing ? "none" : "transform 150ms ease-out",
        }}
      >
        {pages.map((p, i) => (
          <img key={i} src={p.url} alt="" draggable={false} className="block w-full" style={{ height: p.height }} />
        ))}
      </div>

      <div className="absolute bottom-2 right-2 flex items-center gap-0.5 rounded-lg bg-black/55 p-1 backdrop-blur">
        <button
          type="button"
          className="flex size-7 items-center justify-center rounded-md text-white hover:bg-white/15"
          onClick={() => zoomAt(1 / 1.4, viewSize.w / 2, viewSize.h / 2)}
          aria-label="Perkecil"
        >
          <ZoomOut className="size-4" />
        </button>
        <button
          type="button"
          className="flex size-7 items-center justify-center rounded-md text-white hover:bg-white/15"
          onClick={() => setT({ scale: 1, tx: 0, ty: 0 })}
          aria-label="Atur ulang zoom"
        >
          <RotateCcw className="size-3.5" />
        </button>
        <button
          type="button"
          className="flex size-7 items-center justify-center rounded-md text-white hover:bg-white/15"
          onClick={zoomInButton}
          aria-label="Perbesar"
        >
          <ZoomIn className="size-4" />
        </button>
      </div>
    </div>
  );
}
