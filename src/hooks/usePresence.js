import { useEffect, useState } from "react";

/**
 * Keeps an element mounted long enough to play its exit transition.
 * `mounted` decides whether to render; `visible` drives the enter/exit
 * styles (set one frame after mount so the transition actually runs).
 */
export function usePresence(open, exitMs = 260) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      let raf2 = 0;
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setVisible(true));
      });
      return () => {
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
      };
    }
    setVisible(false);
    const t = setTimeout(() => setMounted(false), exitMs);
    return () => clearTimeout(t);
  }, [open, exitMs]);

  return { mounted, visible };
}
