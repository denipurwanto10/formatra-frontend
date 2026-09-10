import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import AppLayout from "./components/layout/AppLayout";
import Dashboard from "./pages/Dashboard";
import ToolPage from "./pages/ToolPage";
import Landing from "./pages/Landing";
import NotFound from "./pages/NotFound";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./context/ThemeContext";
import { ToastProvider } from "./context/ToastContext";
import ToastViewport from "./components/ui/ToastViewport";
import Spinner from "./components/ui/Spinner";

const Privacy = lazy(() => import("./pages/Privacy"));

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route
                path="/privacy"
                element={
                  <Suspense fallback={<div className="flex h-screen items-center justify-center"><Spinner /></div>}>
                    <Privacy />
                  </Suspense>
                }
              />
              <Route element={<AppLayout />}>
                <Route path="/app" element={<Dashboard />} />
                <Route path="/tools/:toolId" element={<ToolPage />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
          <ToastViewport />
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
