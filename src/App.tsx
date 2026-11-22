import { useCallback, useEffect, useRef, useState } from "react";
import { ChatWorkspace } from "./components/ChatWorkspace";
import { ChunkInspectorDrawer } from "./components/ChunkInspectorDrawer";
import { DocumentChunksModal } from "./components/DocumentChunksModal";
import { RepositoryManagerView } from "./components/RepositoryManagerView";
import { RepositorySidebar } from "./components/RepositorySidebar";
import { RetrievalSettingsView } from "./components/RetrievalSettingsView";
import { TopBar } from "./components/TopBar";
import type {
  ActiveInspection,
  ChatMessage,
  DocumentChunkPreview,
  RagDocument,
  RetrievalConfig,
  RetrievedSource,
  UploadProgressItem,
  WorkspaceView,
} from "./types/rag";

export default function App() {
  const [activeView, setActiveView] = useState<WorkspaceView>("assistant");
  const [documents, setDocuments] = useState<RagDocument[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [totalChunks, setTotalChunks] = useState(0);
  const [embeddedChunks, setEmbeddedChunks] = useState(0);
  const [embeddingModel, setEmbeddingModel] = useState("gemini-embedding-2");
  const [generationModel, setGenerationModel] = useState("gemini-4-hydrogen");
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const [uploadQueue, setUploadQueue] = useState<UploadProgressItem[]>([]);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeInspection, setActiveInspection] = useState<ActiveInspection | null>(
    null
  );
  const [retrievalConfig, setRetrievalConfig] = useState<RetrievalConfig>({
    topK: 5,
    minSimilarity: 0.32,
  });

  // Document chunk inspection modal state
  const [inspectedDoc, setInspectedDoc] = useState<RagDocument | null>(null);
  const [inspectedChunks, setInspectedChunks] = useState<DocumentChunkPreview[]>([]);
  const [loadingChunksModal, setLoadingChunksModal] = useState(false);
  const [chunksModalError, setChunksModalError] = useState<string | null>(null);

  const topUploadInputRef = useRef<HTMLInputElement | null>(null);

  const fetchDocuments = useCallback(async (preserveSelection = true) => {
    setLoadingDocs(true);
    try {
      const res = await fetch("/api/documents");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load repository documents.");
      }
      const docs = (data.documents ?? []) as RagDocument[];
      setDocuments(docs);
      setTotalChunks(Number(data.totalChunks ?? 0));
      setEmbeddedChunks(Number(data.embeddedChunks ?? 0));
      if (data.embeddingModel) {
        setEmbeddingModel(data.embeddingModel);
      }
      if (data.generationModel) {
        setGenerationModel(data.generationModel);
      }

      setSelectedDocIds((prev) => {
        if (!preserveSelection || prev.length === 0) {
          return docs.map((d) => d.id);
        }
        const validIds = new Set(docs.map((d) => d.id));
        const kept = prev.filter((id) => validIds.has(id));
        return kept.length > 0 ? kept : docs.map((d) => d.id);
      });
      setGlobalError(null);
    } catch (error) {
      setGlobalError(
        error instanceof Error ? error.message : "Failed to connect to repository."
      );
    } finally {
      setLoadingDocs(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments(false);
  }, [fetchDocuments]);

  const handleUploadFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) {
      return;
    }

    const queueItems: UploadProgressItem[] = files.map((file, idx) => ({
      id: `${Date.now()}-${idx}-${file.name}`,
      filename: file.name,
      status: "uploading",
    }));
    setUploadQueue(queueItems);

    const formData = new FormData();
    for (const file of files) {
      formData.append("files", file);
    }

    try {
      const res = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      const errorMap = new Map<string, string>();
      if (Array.isArray(data.errors)) {
        for (const errItem of data.errors) {
          errorMap.set(errItem.filename, errItem.error);
        }
      }

      const uploadedDocs = (data.uploaded ?? []) as RagDocument[];
      const uploadedNames = new Set(uploadedDocs.map((d) => d.filename));

      setUploadQueue((prev) =>
        prev.map((item) => {
          if (errorMap.has(item.filename)) {
            return {
              ...item,
              status: "error",
              error: errorMap.get(item.filename),
            };
          }
          if (uploadedNames.has(item.filename)) {
            return { ...item, status: "indexed" };
          }
          return res.ok
            ? { ...item, status: "indexed" }
            : {
                ...item,
                status: "error",
                error: data.error || "Upload failed.",
              };
        })
      );

      if (uploadedDocs.length > 0) {
        setDocuments((prev) => [...uploadedDocs, ...prev]);
        setSelectedDocIds((prev) => [
          ...uploadedDocs.map((d) => d.id),
          ...prev,
        ]);
        if (typeof data.totalChunks === "number") {
          setTotalChunks(data.totalChunks);
        }
        if (typeof data.embeddedChunks === "number") {
          setEmbeddedChunks(data.embeddedChunks);
        }
      }

      setTimeout(() => {
        setUploadQueue((prev) => prev.filter((item) => item.status === "error"));
      }, 3500);
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "Network error while uploading.";
      setUploadQueue((prev) =>
        prev.map((item) => ({ ...item, status: "error", error: msg }))
      );
    }
  };

  const handleToggleDocScope = (docId: string) => {
    setSelectedDocIds((prev) =>
      prev.includes(docId)
        ? prev.filter((id) => id !== docId)
        : [...prev, docId]
    );
  };

  const handleSelectAllScope = () => {
    setSelectedDocIds(documents.map((d) => d.id));
  };

  const handleClearScope = () => {
    setSelectedDocIds([]);
  };

  const handleDeleteDoc = async (docId: string) => {
    try {
      const res = await fetch(`/api/documents/${encodeURIComponent(docId)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete document.");
      }
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      setSelectedDocIds((prev) => prev.filter((id) => id !== docId));
      if (typeof data.totalChunks === "number") {
        setTotalChunks(data.totalChunks);
      }
      if (typeof data.embeddedChunks === "number") {
        setEmbeddedChunks(data.embeddedChunks);
      }
      if (inspectedDoc?.id === docId) {
        setInspectedDoc(null);
        setInspectedChunks([]);
      }
    } catch (error) {
      setGlobalError(
        error instanceof Error ? error.message : "Could not delete document."
      );
    }
  };

  const handleResetCurated = async () => {
    setLoadingDocs(true);
    try {
      const res = await fetch("/api/documents/reset", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to restore curated documents.");
      }
      const docs = (data.documents ?? []) as RagDocument[];
      setDocuments(docs);
      setSelectedDocIds(docs.map((d) => d.id));
      await fetchDocuments(false);
    } catch (error) {
      setGlobalError(
        error instanceof Error ? error.message : "Failed to reset repository."
      );
      setLoadingDocs(false);
    }
  };

  const handleInspectDocument = async (docId: string) => {
    const knownDoc = documents.find((d) => d.id === docId) ?? null;
    setInspectedDoc(knownDoc);
    setInspectedChunks([]);
    setChunksModalError(null);
    setLoadingChunksModal(true);

    try {
      const res = await fetch(`/api/documents/${encodeURIComponent(docId)}/chunks`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load document chunks.");
      }
      setInspectedDoc(data.document);
      setInspectedChunks(data.chunks ?? []);
    } catch (error) {
      setChunksModalError(
        error instanceof Error ? error.message : "Unable to load document chunks."
      );
    } finally {
      setLoadingChunksModal(false);
    }
  };

  const handleSendQuery = async (query: string) => {
    if (isStreaming || selectedDocIds.length === 0) {
      return;
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: query,
      sources: [],
      createdAt: new Date().toISOString(),
    };

    const assistantId = `assistant-${Date.now()}`;
    const assistantPlaceholder: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      sources: [],
      phase: "retrieving",
      createdAt: new Date().toISOString(),
    };

    const historyPayload = messages
      .filter((m) => m.phase !== "error" && m.content.trim().length > 0)
      .slice(-6)
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, userMessage, assistantPlaceholder]);
    setIsStreaming(true);
    setActiveInspection(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          history: historyPayload,
          documentIds: selectedDocIds,
          topK: retrievalConfig.topK,
          minSimilarity: retrievalConfig.minSimilarity,
        }),
      });

      if (!res.ok || !res.body) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(
          errBody.error || `Request failed with status ${res.status}.`
        );
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        buffer += decoder.decode(value, { stream: true });

        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";

        for (const block of blocks) {
          if (!block.trim()) {
            continue;
          }
          let eventName = "message";
          const dataLines: string[] = [];

          for (const line of block.split("\n")) {
            if (line.startsWith("event:")) {
              eventName = line.slice(6).trim();
            } else if (line.startsWith("data:")) {
              dataLines.push(line.slice(5).trim());
            }
          }

          if (dataLines.length === 0) {
            continue;
          }
          const payload = JSON.parse(dataLines.join("\n"));

          if (eventName === "sources") {
            const retrieved = (payload.sources ?? []) as RetrievedSource[];
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, sources: retrieved, phase: "generating" }
                  : m
              )
            );
          } else if (eventName === "chunk") {
            const delta = String(payload.text ?? "");
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: m.content + delta, phase: "generating" }
                  : m
              )
            );
          } else if (eventName === "done") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      phase: "complete",
                      latencyMs:
                        typeof payload.latencyMs === "number"
                          ? payload.latencyMs
                          : undefined,
                    }
                  : m
              )
            );
            // Refresh document stats in case lazy curated embedding just ran
            fetchDocuments(true);
          } else if (eventName === "error") {
            throw new Error(payload.error || "Upstream synthesis error.");
          }
        }
      }
    } catch (error) {
      const errMessage =
        error instanceof Error ? error.message : "Failed to query assistant.";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, phase: "error", error: errMessage }
            : m
        )
      );
    } finally {
      setIsStreaming(false);
    }
  };

  const inspectedMessage = activeInspection
    ? messages.find((m) => m.id === activeInspection.messageId) ?? null
    : null;

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-[#F8FAFC] text-slate-900">
      {/* Hidden input triggered by TopBar primary CTA */}
      <input
        ref={topUploadInputRef}
        type="file"
        multiple
        accept=".pdf,.md,.markdown,.txt"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleUploadFiles(e.target.files);
            e.target.value = "";
          }
        }}
      />

      <TopBar
        activeView={activeView}
        onChangeView={(view) => {
          setActiveView(view);
          if (view !== "assistant") {
            setActiveInspection(null);
          }
        }}
        onTriggerUpload={() => topUploadInputRef.current?.click()}
        onToggleMobileSidebar={() => setMobileSidebarOpen((v) => !v)}
      />

      {globalError && (
        <div className="px-6 py-2 bg-red-50 border-b border-red-200 flex items-center justify-between text-xs text-red-800">
          <span>{globalError}</span>
          <button
            type="button"
            onClick={() => setGlobalError(null)}
            className="font-medium underline hover:text-red-950"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Application Body */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {activeView === "assistant" && (
          <>
            <RepositorySidebar
              documents={documents}
              selectedDocIds={selectedDocIds}
              totalChunks={totalChunks}
              loadingDocs={loadingDocs}
              uploadQueue={uploadQueue}
              mobileOpen={mobileSidebarOpen}
              onCloseMobile={() => setMobileSidebarOpen(false)}
              onToggleDocScope={handleToggleDocScope}
              onSelectAllScope={handleSelectAllScope}
              onClearScope={handleClearScope}
              onUploadFiles={handleUploadFiles}
              onDeleteDoc={handleDeleteDoc}
              onInspectDoc={handleInspectDocument}
              onResetCurated={handleResetCurated}
            />

            <ChatWorkspace
              messages={messages}
              isStreaming={isStreaming}
              selectedDocCount={selectedDocIds.length}
              totalDocCount={documents.length}
              retrievalConfig={retrievalConfig}
              activeInspection={activeInspection}
              onSendQuery={handleSendQuery}
              onClearChat={() => {
                setMessages([]);
                setActiveInspection(null);
              }}
              onSelectCitation={(messageId, citationIndex) =>
                setActiveInspection({ messageId, citationIndex })
              }
              onOpenRetrievalSettings={() => setActiveView("retrieval")}
            />

            {/* Contextual Chunk Inspector Drawer */}
            {inspectedMessage &&
              inspectedMessage.sources.length > 0 &&
              activeInspection && (
                <>
                  {/* Desktop inline right pane */}
                  <div className="hidden md:block h-full shrink-0">
                    <ChunkInspectorDrawer
                      sources={inspectedMessage.sources}
                      activeCitationIndex={activeInspection.citationIndex}
                      onSelectCitation={(citationIndex) =>
                        setActiveInspection({
                          messageId: inspectedMessage.id,
                          citationIndex,
                        })
                      }
                      onClose={() => setActiveInspection(null)}
                      onInspectDocument={handleInspectDocument}
                    />
                  </div>

                  {/* Mobile slide-over drawer */}
                  <div className="fixed inset-0 z-40 md:hidden flex justify-end">
                    <div
                      className="fixed inset-0 bg-slate-900/30"
                      onClick={() => setActiveInspection(null)}
                      aria-hidden="true"
                    />
                    <div className="relative z-10 h-full w-full max-w-sm">
                      <ChunkInspectorDrawer
                        sources={inspectedMessage.sources}
                        activeCitationIndex={activeInspection.citationIndex}
                        onSelectCitation={(citationIndex) =>
                          setActiveInspection({
                            messageId: inspectedMessage.id,
                            citationIndex,
                          })
                        }
                        onClose={() => setActiveInspection(null)}
                        onInspectDocument={handleInspectDocument}
                      />
                    </div>
                  </div>
                </>
              )}
          </>
        )}

        {activeView === "repository" && (
          <RepositoryManagerView
            documents={documents}
            selectedDocIds={selectedDocIds}
            totalChunks={totalChunks}
            uploadQueue={uploadQueue}
            onToggleDocScope={handleToggleDocScope}
            onUploadFiles={handleUploadFiles}
            onDeleteDoc={handleDeleteDoc}
            onInspectDoc={handleInspectDocument}
            onResetCurated={handleResetCurated}
          />
        )}

        {activeView === "retrieval" && (
          <RetrievalSettingsView
            config={retrievalConfig}
            onChangeConfig={setRetrievalConfig}
            totalDocuments={documents.length}
            selectedDocuments={selectedDocIds.length}
            totalChunks={totalChunks}
            embeddedChunks={embeddedChunks}
            embeddingModel={embeddingModel}
            generationModel={generationModel}
          />
        )}
      </div>

      {/* Document Chunks Modal */}
      {(inspectedDoc || loadingChunksModal) && (
        <DocumentChunksModal
          document={inspectedDoc}
          chunks={inspectedChunks}
          loading={loadingChunksModal}
          error={chunksModalError}
          onClose={() => {
            setInspectedDoc(null);
            setInspectedChunks([]);
            setChunksModalError(null);
          }}
        />
      )}
    </div>
  );
}
