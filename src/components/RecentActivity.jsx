import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { History, Trash2 } from "lucide-react";
import { getHistory, clearHistory, formatRelativeTime } from "../lib/history";
import { TOOLS } from "../lib/toolsMeta";

export default function RecentActivity() {
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    const load = () => setEntries(getHistory());
    load();
    window.addEventListener("formatra:history-changed", load);
    return () => window.removeEventListener("formatra:history-changed", load);
  }, []);

  if (entries.length === 0) return null;

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
          <History className="size-[15px] text-muted" />
          Aktivitas Terbaru
        </h2>
        <button
          onClick={clearHistory}
          className="flex items-center gap-1 text-[12px] text-muted hover:text-ink"
        >
          <Trash2 className="size-3.5" />
          Hapus riwayat
        </button>
      </div>
      <div className="flex flex-col divide-y divide-[var(--border)] rounded-2xl border-hair bg-surface">
        {entries.slice(0, 8).map((entry) => {
          const tool = TOOLS[entry.toolId];
          const Icon = tool?.icon;
          return (
            <Link
              key={entry.id}
              to={tool ? `/tools/${tool.id}` : "/app"}
              className="flex items-center gap-3 px-3.5 py-2.5 transition-colors hover:bg-surface-2/60"
            >
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                {Icon ? <Icon className="size-4" /> : <History className="size-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] text-ink">{entry.fileName || "(tanpa nama)"}</p>
                <p className="text-[11.5px] text-muted">{entry.toolName}</p>
              </div>
              <span className="shrink-0 text-[11px] text-muted">{formatRelativeTime(entry.timestamp)}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
