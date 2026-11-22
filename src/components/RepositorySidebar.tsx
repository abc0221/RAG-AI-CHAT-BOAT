import {
  CheckSquare,
  Eye,
  FileText,
  RotateCcw,
  Search,
  Square,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { useRef, useState, type DragEvent } from "react";
import {
  formatBytes,
  type RagDocument,
  type UploadProgressItem,
} from "../types/rag";

interface RepositorySidebarProps {
  documents: RagDocument[];
  selectedDocIds: string[];
  totalChunks: number;
  loadingDocs: boolean;
  uploadQueue: UploadProgressItem[];
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onToggleDocScope: (docId: string) => void;
  onSelectAllScope: () => void;
  onClearScope: () => void;
  onUploadFiles: (files: FileList | File[]) => void;
  onDeleteDoc: (docId: string) => void;
  onInspectDoc: (docId: string) => void;
  onResetCurated: () => void;
}

export function RepositorySidebar({
  documents,
  selectedDocIds,
  totalChunks,
  loadingDocs,
  uploadQueue,
  mobileOpen,
  onCloseMobile,
  onToggleDocScope,
  onSelectAllScope,
  onClearScope,
  onUploadFiles,
  onDeleteDoc,
  onInspectDoc,
  onResetCurated,
}: RepositorySidebarProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const selectedSet = new Set(selectedDocIds);
  const normalizedQuery = searchTerm.trim().toLowerCase();
  const filteredDocs = normalizedQuery
    ? documents.filter(
        (doc) =>
          doc.title.toLowerCase().includes(normalizedQuery) ||
          doc.filename.toLowerCase().includes(normalizedQuery) ||
          doc.summary.toLowerCase().includes(normalizedQuery)
      )
    : documents;

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onUploadFiles(e.dataTransfer.files);
    }
  };

  const sidebarContent = (
    <div className="w-[280px] h-full bg-white border-r border-slate-200 flex flex-col">
      {/* Sidebar Header */}
      <div className="px-4 py-3.5 border-b border-slate-200 flex items-center justify-between">
        <div>
          <h2 className="font-display text-sm font-semibold text-slate-900">
            Document Repository
          </h2>
          <p className="text-xs text-slate-500 tabular-nums mt-0.5">
            {documents.length} docs · {totalChunks} chunks
          </p>
        </div>
        <button
          type="button"
          onClick={onCloseMobile}
          className="lg:hidden p-1.5 text-slate-500 hover:text-slate-900 rounded-md"
          aria-label="Close repository sidebar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Multi-file Dropzone */}
      <div className="p-3 border-b border-slate-200">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          className={`rounded-lg border border-dashed px-3 py-3 text-center cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
            isDragging
              ? "border-blue-600 bg-blue-50/70"
              : "border-slate-300 bg-slate-50/60 hover:border-slate-400 hover:bg-slate-50"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.md,.markdown,.txt"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                onUploadFiles(e.target.files);
                e.target.value = "";
              }
            }}
          />
          <UploadCloud className="w-4 h-4 text-slate-500 mx-auto mb-1" aria-hidden="true" />
          <p className="text-xs font-medium text-slate-700">
            Drop PDF, MD, or TXT files
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Multi-file batch indexing
          </p>
        </div>

        {/* Upload progress items */}
        {uploadQueue.length > 0 && (
          <div className="mt-2.5 space-y-1.5">
            {uploadQueue.map((item) => (
              <div
                key={item.id}
                className="px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium text-slate-800">
                    {item.filename}
                  </span>
                  <span
                    className={`shrink-0 text-[11px] font-mono ${
                      item.status === "uploading"
                        ? "text-blue-600"
                        : item.status === "indexed"
                        ? "text-emerald-700"
                        : "text-red-600"
                    }`}
                  >
                    {item.status === "uploading"
                      ? "Indexing..."
                      : item.status === "indexed"
                      ? "Indexed"
                      : "Failed"}
                  </span>
                </div>
                {item.error && (
                  <p className="text-[11px] text-red-600 mt-0.5 leading-snug">
                    {item.error}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filter & Scope Controls */}
      <div className="px-3 py-2.5 border-b border-slate-200 space-y-2">
        <div className="relative">
          <Search
            className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter documents..."
            aria-label="Filter documents"
            className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              aria-label="Clear filter"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-500 tabular-nums">
            Scope: {selectedDocIds.length}/{documents.length} active
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onSelectAllScope}
              className="text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap focus-visible:outline-none focus-visible:underline"
            >
              All
            </button>
            <span className="text-slate-300" aria-hidden="true">
              /
            </span>
            <button
              type="button"
              onClick={onClearScope}
              className="text-slate-500 hover:text-slate-800 font-medium whitespace-nowrap focus-visible:outline-none focus-visible:underline"
            >
              None
            </button>
          </div>
        </div>
      </div>

      {/* Document List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
        {loadingDocs ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4].map((row) => (
              <div key={row} className="space-y-1.5">
                <div className="h-3.5 w-4/5 bg-slate-100 rounded" />
                <div className="h-2.5 w-1/2 bg-slate-100 rounded" />
              </div>
            ))}
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="p-6 text-center space-y-2">
            <FileText className="w-5 h-5 text-slate-300 mx-auto" aria-hidden="true" />
            <p className="text-xs font-medium text-slate-700">
              {documents.length === 0
                ? "Repository is empty"
                : "No matching documents"}
            </p>
            <p className="text-[11px] text-slate-500">
              {documents.length === 0
                ? "Upload PDF, MD, or TXT files or restore the curated baseline."
                : "Try adjusting your search query."}
            </p>
          </div>
        ) : (
          filteredDocs.map((doc) => {
            const isSelected = selectedSet.has(doc.id);
            return (
              <div
                key={doc.id}
                className={`group px-3.5 py-3 transition-colors ${
                  isSelected ? "bg-white hover:bg-slate-50/80" : "bg-slate-50/40 opacity-75 hover:opacity-100"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <button
                    type="button"
                    onClick={() => onToggleDocScope(doc.id)}
                    aria-label={`${isSelected ? "Exclude" : "Include"} ${doc.title} in search scope`}
                    className="mt-0.5 text-slate-400 hover:text-blue-600 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
                  >
                    {isSelected ? (
                      <CheckSquare className="w-4 h-4 text-blue-600" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-300" />
                    )}
                  </button>

                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => onInspectDoc(doc.id)}
                      className="text-left text-[13px] font-medium text-slate-900 hover:text-blue-700 leading-snug line-clamp-2 transition-colors focus-visible:outline-none focus-visible:underline"
                    >
                      {doc.title}
                    </button>

                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-1 font-mono tabular-nums">
                      <span className="uppercase">{doc.format}</span>
                      <span aria-hidden="true">·</span>
                      <span>{doc.chunkCount} chunks</span>
                      <span aria-hidden="true">·</span>
                      <span>{formatBytes(doc.byteSize)}</span>
                    </div>

                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[11px] text-slate-400">
                        {doc.category === "curated" ? "Curated" : "Uploaded"}
                      </span>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => onInspectDoc(doc.id)}
                          title="Inspect document chunks"
                          aria-label={`Inspect chunks for ${doc.title}`}
                          className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteDoc(doc.id)}
                          title="Delete document"
                          aria-label={`Delete ${doc.title}`}
                          className="p-1 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Actions */}
      <div className="px-4 py-3 border-t border-slate-200 bg-slate-50/70 flex items-center justify-between">
        <button
          type="button"
          onClick={onResetCurated}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded px-1 py-0.5"
        >
          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Restore Curated Baseline</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop rail */}
      <aside aria-label="Document repository" className="hidden lg:block shrink-0 h-full">
        {sidebarContent}
      </aside>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/30"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full">{sidebarContent}</div>
        </div>
      )}
    </>
  );
}
