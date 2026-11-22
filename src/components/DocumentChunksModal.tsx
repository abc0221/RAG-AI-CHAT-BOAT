import { FileText, X } from "lucide-react";
import {
  formatBytes,
  type DocumentChunkPreview,
  type RagDocument,
} from "../types/rag";

interface DocumentChunksModalProps {
  document: RagDocument | null;
  chunks: DocumentChunkPreview[];
  loading: boolean;
  error: string | null;
  onClose: () => void;
}

export function DocumentChunksModal({
  document,
  chunks,
  loading,
  error,
  onClose,
}: DocumentChunksModalProps) {
  if (!document && !loading) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/35"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Document Chunks Preview"
    >
      <div
        className="w-full max-w-3xl max-h-[85vh] bg-white border border-slate-200 rounded-xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <FileText className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="min-w-0">
              <h2 className="font-display text-base font-semibold text-slate-900 truncate">
                {document ? document.title : "Loading document..."}
              </h2>
              {document && (
                <p className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
                  {document.filename} · {document.chunkCount} chunks ·{" "}
                  {formatBytes(document.byteSize)}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close document preview"
            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Chunks Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#F8FAFC]">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-lg bg-white border border-slate-200 space-y-2"
                >
                  <div className="h-3.5 w-1/3 bg-slate-100 rounded" />
                  <div className="h-3 w-full bg-slate-100 rounded" />
                  <div className="h-3 w-5/6 bg-slate-100 rounded" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
              {error}
            </div>
          ) : (
            chunks.map((chunk) => (
              <div
                key={chunk.id}
                className="p-4 rounded-lg bg-white border border-slate-200 space-y-2"
              >
                <div className="flex items-center justify-between gap-3 text-xs border-b border-slate-100 pb-2">
                  <span className="font-medium text-slate-900 truncate">
                    {chunk.sectionHeading}
                  </span>
                  <span className="font-mono text-slate-500 shrink-0 tabular-nums">
                    Chunk #{chunk.chunkIndex + 1} · chars {chunk.charStart}–{chunk.charEnd}
                  </span>
                </div>
                <p className="text-[13.5px] leading-relaxed text-slate-700 whitespace-pre-wrap">
                  {chunk.content}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
