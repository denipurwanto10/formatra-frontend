import { useCallback, useRef, useState } from "react";
import { addHistoryEntry } from "../lib/history";

function makeItem(file, seed) {
  return {
    id: `${file.name}-${file.size}-${seed}-${Math.random().toString(36).slice(2, 8)}`,
    file,
    status: "pending", // pending | processing | done | error
    progress: 0,
    result: null,
    error: null,
  };
}

/**
 * Drives batch processing of multiple files through the same single-file
 * `processFn`. Each file gets its own status/progress/error/result so the UI
 * can show per-file rows plus an overall summary, and failed files can be
 * retried individually without re-running the whole batch.
 *
 * Keeps a ref mirror of `items` alongside the state so `runAll`/`runOne`
 * always act on the latest list, even when called from stale closures.
 *
 * @param {(file: File, onProgress: (p:number) => void) => Promise<Blob>} processFn
 * @param {{id:string, name:string}} [toolMeta] when provided, each successfully
 *   processed file is recorded in local history (metadata only).
 */
export function useBatchProcess(processFn, toolMeta) {
  const [items, setItems] = useState([]);
  const itemsRef = useRef([]);
  const runningRef = useRef(false);

  const update = useCallback((next) => {
    itemsRef.current = next;
    setItems(next);
  }, []);

  const patchItem = useCallback(
    (id, patch) => {
      update(itemsRef.current.map((it) => (it.id === id ? { ...it, ...patch } : it)));
    },
    [update]
  );

  const setFiles = useCallback(
    (files) => update(files.map((f, i) => makeItem(f, i))),
    [update]
  );

  const addFiles = useCallback(
    (files) => update([...itemsRef.current, ...files.map((f, i) => makeItem(f, itemsRef.current.length + i))]),
    [update]
  );

  const removeItem = useCallback(
    (id) => update(itemsRef.current.filter((it) => it.id !== id)),
    [update]
  );

  const runOne = useCallback(
    async (id) => {
      const target = itemsRef.current.find((it) => it.id === id);
      if (!target) return null;
      patchItem(id, { status: "processing", progress: 0, error: null });
      try {
        const result = await processFn(target.file, (p) => patchItem(id, { progress: p }));
        patchItem(id, { status: "done", progress: 100, result });
        if (toolMeta) {
          addHistoryEntry({ toolId: toolMeta.id, toolName: toolMeta.name, fileName: target.file.name });
        }
        return result;
      } catch (err) {
        console.error(err);
        patchItem(id, { status: "error", error: err?.message || "Gagal memproses file." });
        return null;
      }
    },
    [processFn, patchItem, toolMeta]
  );

  const runAll = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    const pendingIds = itemsRef.current.filter((it) => it.status !== "done").map((it) => it.id);
    for (const id of pendingIds) {
      // eslint-disable-next-line no-await-in-loop
      await runOne(id);
    }
    runningRef.current = false;
  }, [runOne]);

  const reset = useCallback(() => update([]), [update]);

  const doneCount = items.filter((it) => it.status === "done").length;
  const errorCount = items.filter((it) => it.status === "error").length;
  const isProcessing = items.some((it) => it.status === "processing");
  const overallProgress = items.length
    ? Math.round(items.reduce((sum, it) => sum + (it.status === "done" ? 100 : it.progress), 0) / items.length)
    : 0;

  return {
    items,
    setFiles,
    addFiles,
    removeItem,
    runOne,
    runAll,
    reset,
    doneCount,
    errorCount,
    isProcessing,
    overallProgress,
    allDone: items.length > 0 && doneCount === items.length,
  };
}
