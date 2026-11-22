import { Menu, Upload } from "lucide-react";
import type { WorkspaceView } from "../types/rag";

interface TopBarProps {
  activeView: WorkspaceView;
  onChangeView: (view: WorkspaceView) => void;
  onTriggerUpload: () => void;
  onToggleMobileSidebar: () => void;
}

const NAV_ITEMS: { id: WorkspaceView; label: string }[] = [
  { id: "assistant", label: "Assistant" },
  { id: "repository", label: "Repository" },
  { id: "retrieval", label: "Retrieval" },
];

export function TopBar({
  activeView,
  onChangeView,
  onTriggerUpload,
  onToggleMobileSidebar,
}: TopBarProps) {
  return (
    <header className="h-14 shrink-0 bg-white border-b border-slate-200 px-4 lg:px-6 flex items-center justify-between gap-8 z-30">
      {/* Zone 1: Single text element wordmark */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={onToggleMobileSidebar}
          className="lg:hidden p-2 -ml-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          aria-label="Toggle document repository"
        >
          <Menu className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => onChangeView("assistant")}
          className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
        >
          FolioRAG
        </button>
      </div>

      {/* Zone 2: Concise single-line navigation links */}
      <nav aria-label="Workspace navigation" className="flex items-center gap-6">
        {NAV_ITEMS.map((item) => {
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChangeView(item.id)}
              className={`relative py-4 text-sm font-medium whitespace-nowrap shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded ${
                isActive ? "text-slate-900" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              {item.label}
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 bottom-0 h-0.5 bg-blue-600"
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Zone 3: Single primary action */}
      <div className="shrink-0">
        <button
          type="button"
          onClick={onTriggerUpload}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        >
          <Upload className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Upload Docs</span>
        </button>
      </div>
    </header>
  );
}
