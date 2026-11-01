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
    <section className="reveal" aria-labelledby="recent-heading">
      <div className="mb-4 flex items-center justify-between">
        <h2 id="recent-heading" className="text-[15px] font-medium tracking-[-0.015em] text-ink">
          Aktivitas terbaru
        </h2>
        <button
          onClick={clearHistory}
          className="tap-target -mr-2 flex items-center gap-1.5 rounded-lg px-2 text-[12.5px] text-muted transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <Trash2 className="size-3.5" />
          Hapus riwayat
        </button>
      </div>
      <div className="flex flex-col divide-y divide-[var(--border)] overflow-hidden rounded-[14px] border-hair bg-surface">
        {entries.slice(0, 8).map((entry) => {
          const tool = TOOLS[entry.toolId];
          const Icon = tool?.icon;
          return (
            <Link
              key={entry.id}
              to={tool ? `/tools/${tool.id}` : "/app"}
              className="flex items-center gap-3 px-3.5 py-3 transition-colors duration-200 hover:bg-surface-2/70"
            >
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-muted">
                {Icon ? <Icon className="size-4" strokeWidth={1.7} /> : <History className="size-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] text-ink">{entry.fileName || "(tanpa nama)"}</p>
                <p className="truncate text-[12px] text-muted">{entry.toolName}</p>
              </div>
              <span className="shrink-0 font-mono text-[11.5px] text-muted">{formatRelativeTime(entry.timestamp)}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
