import { createContext, useContext, useRef } from "react";

const CanvasCtx = createContext(null);

export function CanvasProvider({ children }) {
  const ref = useRef({
    canvas: null,
    canvasPageId: null,
    addImageFromDataUrl: () => {},
    deleteActive: () => {},
    applyToActive: () => {},
    applyLineEdit: () => false,
    getActive: () => null,
    toggleTextStyle: () => {},
    setTextAlign: () => {},
    selectAllObjects: () => {},
    flushPendingEdits: () => {},
    reorderLayer: () => {},
    groupSelection: () => {},
    ungroupSelection: () => {},
    alignActive: () => {},
    duplicateActive: () => {},
    startCrop: () => {},
    applyCrop: () => {},
    cancelCrop: () => {},
    isCropping: () => false,
    getLayerObjects: () => [],
    reorderLayerObject: () => {},
    toggleObjectVisible: () => {},
    toggleObjectLocked: () => {},
    renameObject: () => {},
    selectObject: () => {},
    toggleCheckbox: () => {},
    refreshDateField: () => {},
  });
  return <CanvasCtx.Provider value={ref}>{children}</CanvasCtx.Provider>;
}

export function useCanvasHandle() {
  const ctx = useContext(CanvasCtx);
  if (!ctx) throw new Error("useCanvasHandle must be used within CanvasProvider");
  return ctx;
}
