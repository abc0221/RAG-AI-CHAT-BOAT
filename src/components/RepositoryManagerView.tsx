import {
  CheckSquare,
  Eye,
  RotateCcw,
  Search,
  Square,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { useRef, useState } from "react";
import {
  formatBytes,
  type RagDocument,
  type UploadProgressItem,
} from "../types/rag";

interface RepositoryManagerViewProps {
  documents: RagDocument[];
  selectedDocIds: string[];
  totalChunks: number;
  uploadQueue: UploadProgressItem[];
  onToggleDocScope: (docId: string) => void;
  onUploadFiles: (files: FileList | File[]) => void;
  onDeleteDoc: (docId: string) => void;
  onInspectDoc: (docId: string) => void;
  onResetCurated: () => void;
}

export function RepositoryManagerView({
  documents,
  selectedDocIds,
  totalChunks,
  uploadQueue,
  onToggleDocScope,
  onUploadFiles,
  onDeleteDoc,
  onInspectDoc,
  onResetCurated,
}: RepositoryManagerViewProps) {
  const [filterText, setFilterText] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"all" | "curated" | "uploaded">("all");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const selectedSet = new Set(selectedDocIds);
  const filtered = documents.filter((doc) => {
    if (categoryFilter !== "all" && doc.category !== categoryFilter) {
      return false;
    }
    if (!filterText.trim()) {
      return true;
    }
    const q = filterText.toLowerCase();
    return (
      doc.title.toLowerCase().includes(q) ||
      doc.filename.toLowerCase().includes(q) ||
      doc.summary.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex-1 overflow-y-auto bg-[#F8FAFC] px-6 lg:px-10 py-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header & Upload CTA */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold text-slate-900">
              Vector Document Repository
            </h1>
            <p className="text-sm text-slate-600 mt-1 tabular-nums">
              {documents.length} documents indexed into {totalChunks} persistent vector chunks.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onResetCurated}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:border-slate-300 rounded-lg transition-colors whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Restore Curated</span>
            </button>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap"
            >
              <UploadCloud className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Add Documents</span>
            </button>
            <input
              ref={inputRef}
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
          </div>
        </div>

        {/* Upload progress strip if active */}
        {uploadQueue.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {uploadQueue.map((item) => (
              <div
                key={item.id}
                className="px-3.5 py-2.5 rounded-lg bg-white border border-slate-200 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-slate-900 truncate">
                    {item.filename}
                  </span>
                  <span
                    className={`font-mono shrink-0 ${
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
                  <p className="text-red-600 mt-1 text-[11px]">{item.error}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Filter Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
            {(["all", "curated", "uploaded"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setCategoryFilter(tab)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap capitalize ${
                  categoryFilter === tab
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {tab === "all" ? "All Documents" : tab}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <Search
              className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Search repository..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
            />
          </div>
        </div>

        {/* High-Density Data Table */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold text-slate-500">
                  <th className="py-2.5 pl-4 pr-2 w-10">Scope</th>
                  <th className="py-2.5 px-3">Document</th>
                  <th className="py-2.5 px-3">Format</th>
                  <th className="py-2.5 px-3">Source</th>
                  <th className="py-2.5 px-3 text-right">Chunks</th>
                  <th className="py-2.5 px-3 text-right">Size</th>
                  <th className="py-2.5 pl-3 pr-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-500">
                      No documents match the current filter.
                    </td>
                  </tr>
                ) : (
                  filtered.map((doc) => {
                    const isSelected = selectedSet.has(doc.id);
                    return (
                      <tr
                        key={doc.id}
                        className="hover:bg-slate-50/80 transition-colors"
                      >
                        <td className="py-3 pl-4 pr-2 align-top">
                          <button
                            type="button"
                            onClick={() => onToggleDocScope(doc.id)}
                            aria-label={`Toggle ${doc.title} in search scope`}
                            className="mt-0.5 text-slate-400 hover:text-blue-600"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-blue-600" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-300" />
                            )}
                          </button>
                        </td>
                        <td className="py-3 px-3 max-w-md">
                          <button
                            type="button"
                            onClick={() => onInspectDoc(doc.id)}
                            className="font-semibold text-slate-900 hover:text-blue-700 text-left transition-colors"
                          >
                            {doc.title}
                          </button>
                          <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                            {doc.summary}
                          </p>
                        </td>
                        <td className="py-3 px-3 font-mono uppercase text-slate-600 align-top">
                          {doc.format}
                        </td>
                        <td className="py-3 px-3 text-slate-600 capitalize align-top">
                          {doc.category}
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-800 align-top">
                          {doc.chunkCount}
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-600 align-top">
                          {formatBytes(doc.byteSize)}
                        </td>
                        <td className="py-3 pl-3 pr-4 text-right align-top">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => onInspectDoc(doc.id)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors whitespace-nowrap"
                            >
                              <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>Chunks</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteDoc(doc.id)}
                              aria-label={`Delete ${doc.title}`}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
