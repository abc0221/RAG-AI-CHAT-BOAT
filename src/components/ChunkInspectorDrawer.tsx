import { ChevronLeft, ChevronRight, ExternalLink, FileText, X } from "lucide-react";
import type { RetrievedSource } from "../types/rag";

interface ChunkInspectorDrawerProps {
  sources: RetrievedSource[];
  activeCitationIndex: number;
  onSelectCitation: (citationIndex: number) => void;
  onClose: () => void;
  onInspectDocument: (documentId: string) => void;
}

export function ChunkInspectorDrawer({
  sources,
  activeCitationIndex,
  onSelectCitation,
  onClose,
  onInspectDocument,
}: ChunkInspectorDrawerProps) {
  const currentIdx = sources.findIndex((s) => s.citationIndex === activeCitationIndex);
  const activeSource = currentIdx >= 0 ? sources[currentIdx] : sources[0];

  if (!activeSource) {
    return null;
  }

  const similarityPct = Math.max(0, Math.min(100, activeSource.similarity * 100));
  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx >= 0 && currentIdx < sources.length - 1;

  return (
    <aside
      aria-label="Chunk Inspector"
      className="w-full md:w-[380px] shrink-0 bg-white border-l border-slate-200 flex flex-col h-full"
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-slate-500 font-mono tabular-nums">
            <span className="font-semibold text-blue-700">Source [{activeSource.citationIndex}]</span>
            <span aria-hidden="true">/</span>
            <span>{sources.length} retrieved</span>
          </div>
          <h2 className="font-display text-sm font-semibold text-slate-900 truncate mt-0.5">
            Chunk Inspector
          </h2>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            disabled={!hasPrev}
            onClick={() => hasPrev && onSelectCitation(sources[currentIdx - 1].citationIndex)}
            aria-label="Previous retrieved source"
            className="p-1.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-35 disabled:pointer-events-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={!hasNext}
            onClick={() => hasNext && onSelectCitation(sources[currentIdx + 1].citationIndex)}
            aria-label="Next retrieved source"
            className="p-1.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-35 disabled:pointer-events-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Chunk Inspector"
            className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors ml-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Source switcher strip */}
      {sources.length > 1 && (
        <div className="px-5 py-2.5 border-b border-slate-200 bg-slate-50/70 flex items-center gap-1.5 overflow-x-auto">
          {sources.map((src) => {
            const selected = src.citationIndex === activeSource.citationIndex;
            return (
              <button
                key={src.chunkId}
                type="button"
                onClick={() => onSelectCitation(src.citationIndex)}
                className={`px-2.5 py-1 text-xs font-mono rounded-md transition-colors whitespace-nowrap shrink-0 tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                  selected
                    ? "bg-blue-600 text-white font-medium"
                    : "bg-white text-slate-600 border border-slate-200 hover:text-slate-900 hover:border-slate-300"
                }`}
              >
                [{src.citationIndex}] {(src.similarity * 100).toFixed(0)}%
              </button>
            );
          })}
        </div>
      )}

      {/* Content body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Document & Section Provenance */}
        <div className="space-y-2 pb-4 border-b border-slate-200">
          <div className="flex items-start gap-2.5">
            <FileText className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 leading-snug">
                {activeSource.documentTitle}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Section: <span className="text-slate-700 font-medium">{activeSource.sectionHeading}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 font-mono tabular-nums pt-1">
            <span>Chunk #{activeSource.chunkIndex + 1}</span>
            <span aria-hidden="true">·</span>
            <span>Chars {activeSource.charStart}–{activeSource.charEnd}</span>
          </div>
        </div>

        {/* Cosine Similarity Readout */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-slate-600">Cosine Similarity</span>
            <span className="font-mono font-semibold text-slate-900 tabular-nums">
              {similarityPct.toFixed(1)}%
            </span>
          </div>
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-200"
              style={{ width: `${similarityPct}%` }}
            />
          </div>
        </div>

        {/* Verbatim Retrieved Chunk */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600">Retrieved Passage</span>
            <span className="text-[11px] font-mono text-slate-400 tabular-nums">
              {activeSource.content.length} chars
            </span>
          </div>
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-[13.5px] leading-relaxed text-slate-800 whitespace-pre-wrap font-sans">
            {activeSource.content}
          </div>
        </div>
      </div>

      {/* Footer Action */}
      <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50/70">
        <button
          type="button"
          onClick={() => onInspectDocument(activeSource.documentId)}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:border-slate-300 hover:text-slate-900 rounded-lg transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Inspect Full Document Chunks</span>
        </button>
      </div>
    </aside>
  );
}
