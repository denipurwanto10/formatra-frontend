import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const counter = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    ({ title, description, variant = "info", duration = 4200 }) => {
      counter.current += 1;
      const id = counter.current;
      setToasts((prev) => [...prev, { id, title, description, variant }]);
      if (duration) {
        setTimeout(() => dismiss(id), duration);
      }
      return id;
    },
    [dismiss]
  );

  const toast = useMemo(
    () => ({
      success: (title, description) => push({ title, description, variant: "success" }),
      error: (title, description) => push({ title, description, variant: "error" }),
      info: (title, description) => push({ title, description, variant: "info" }),
      warning: (title, description) => push({ title, description, variant: "warning" }),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx.toast;
}

export function useToastList() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToastList must be used within ToastProvider");
  return ctx;
}
