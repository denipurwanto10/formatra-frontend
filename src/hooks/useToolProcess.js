import { useCallback, useRef, useState } from "react";
import { addHistoryEntry } from "../lib/history";

/**
 * Generic state machine for a tool's run lifecycle.
 * status: "idle" | "processing" | "done" | "error"
 *
 * @param {{id:string, name:string}} [toolMeta] when provided, a successful
 *   run is recorded in local history (metadata only — no file contents).
 */
export function useToolProcess(toolMeta) {
  const [status, setStatus] = useState("idle");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  // Tracks a user-initiated cancel so a task's eventual resolution/rejection
  // (conversion functions have no real abort hook) is silently ignored
  // instead of clobbering the UI the user already walked away from.
  const cancelledRef = useRef(false);

  const run = useCallback(
    async (task, fileName) => {
      cancelledRef.current = false;
      setStatus("processing");
      setProgress(0);
      setError(null);
      setResult(null);
      try {
        const output = await task((p) => {
          if (!cancelledRef.current) setProgress(p);
        });
        if (cancelledRef.current) return output;
        setResult(output);
        setStatus("done");
        if (toolMeta) {
          addHistoryEntry({ toolId: toolMeta.id, toolName: toolMeta.name, fileName: fileName || "" });
        }
        return output;
      } catch (err) {
        if (cancelledRef.current) return undefined;
        console.error(err);
        setError(err?.message || "Gagal memproses file. Silakan coba lagi.");
        setStatus("error");
        throw err;
      }
    },
    [toolMeta]
  );

  const reset = useCallback(() => {
    cancelledRef.current = false;
    setStatus("idle");
    setProgress(0);
    setResult(null);
    setError(null);
  }, []);

  /** User-initiated cancel: returns to idle immediately. */
  const cancel = useCallback(() => {
    cancelledRef.current = true;
    setStatus("idle");
    setProgress(0);
    setError(null);
  }, []);

  return { status, progress, result, error, run, reset, cancel, setStatus };
}
