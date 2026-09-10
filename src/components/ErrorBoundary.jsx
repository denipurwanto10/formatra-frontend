import { Component } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("Formatra render error:", error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-base px-5 text-ink">
        <div className="surface-elevated w-full max-w-md rounded-[var(--radius-lg)] p-7 text-center sm:p-8">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[var(--danger-bg)] text-[var(--danger)]">
            <AlertTriangle className="size-5" />
          </div>
          <h1 className="mt-5 font-display text-xl font-semibold">Terjadi kesalahan</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Halaman ini mengalami masalah. File yang sedang diproses tetap berada di perangkatmu.
          </p>
          <button
            type="button"
            onClick={this.handleReset}
            className="mt-6 inline-flex h-11 items-center gap-2 rounded-md bg-accent px-5 text-sm font-semibold text-accent-ink shadow-accent transition-colors hover:bg-[var(--accent-strong)]"
          >
            <RotateCcw className="size-4" />
            Coba lagi
          </button>
        </div>
      </div>
    );
  }
}
