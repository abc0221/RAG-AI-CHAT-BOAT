import {
  AlertCircle,
  ArrowUp,
  BookOpen,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type {
  ActiveInspection,
  ChatMessage,
  RetrievalConfig,
} from "../types/rag";
import { MarkdownWithCitations } from "./MarkdownWithCitations";

interface ChatWorkspaceProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  selectedDocCount: number;
  totalDocCount: number;
  retrievalConfig: RetrievalConfig;
  activeInspection: ActiveInspection | null;
  onSendQuery: (query: string) => void;
  onClearChat: () => void;
  onSelectCitation: (messageId: string, citationIndex: number) => void;
  onOpenRetrievalSettings: () => void;
}

const STARTER_PROMPTS = [
  {
    title: "Hybrid Retrieval & RRF",
    prompt:
      "How does Reciprocal Rank Fusion combine dense embeddings with BM25 lexical search, and what similarity threshold prevents hallucinations?",
  },
  {
    title: "Circuit Breakers & Jitter",
    prompt:
      "Explain how half-open probing works in circuit breakers and why exponential backoff requires full jitter.",
  },
  {
    title: "Rate Limiting Algorithms",
    prompt:
      "Compare Token Bucket, Leaky Bucket, and Sliding Window Counter for API gateway rate limiting.",
  },
  {
    title: "LLM Inference & KV Cache",
    prompt:
      "Why is LLM decoding memory-bandwidth bound, and how do PagedAttention and FP8 quantization improve serving efficiency?",
  },
];

export function ChatWorkspace({
  messages,
  isStreaming,
  selectedDocCount,
  totalDocCount,
  retrievalConfig,
  activeInspection,
  onSendQuery,
  onClearChat,
  onSelectCitation,
  onOpenRetrievalSettings,
}: ChatWorkspaceProps) {
  const [inputValue, setInputValue] = useState("");
  const scrollEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, messages[messages.length - 1]?.content]);

  const submitQuery = () => {
    const trimmed = inputValue.trim();
    if (!trimmed || isStreaming) {
      return;
    }
    setInputValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    onSendQuery(trimmed);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    submitQuery();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitQuery();
    }
  };

  const handleInputResize = (value: string) => {
    setInputValue(value);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  };

  const scopeDisabled = selectedDocCount === 0;

  return (
    <div className="flex-1 min-w-0 h-full flex flex-col bg-[#F8FAFC]">
      {/* Scrollable conversation viewport */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 lg:px-12 py-8">
        <div className="max-w-3xl mx-auto">
          {messages.length === 0 ? (
            <div className="py-8 sm:py-12 space-y-10">
              {/* Editorial Zero-State Intro */}
              <div className="space-y-3">
                <p className="text-xs font-medium text-blue-700">
                  Grounded Document Assistant
                </p>
                <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900">
                  Query your engineering &amp; AI architecture corpus
                </h1>
                <p className="text-[15px] leading-relaxed text-slate-600 max-w-2xl">
                  Every question embeds against your persistent local vector repository, retrieves
                  the highest-similarity passages, and synthesizes an answer with inline citations
                  linked directly to the raw source chunks.
                </p>
              </div>

              {/* Starter Prompts Grid */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">
                    Suggested Engineering Queries
                  </span>
                  <span className="text-xs text-slate-500 tabular-nums">
                    {selectedDocCount} of {totalDocCount} documents in scope
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {STARTER_PROMPTS.map((item) => (
                    <button
                      key={item.title}
                      type="button"
                      disabled={scopeDisabled || isStreaming}
                      onClick={() => onSendQuery(item.prompt)}
                      className="text-left p-4 rounded-xl bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50/20 transition-colors disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                    >
                      <p className="text-sm font-semibold text-slate-900">
                        {item.title}
                      </p>
                      <p className="text-xs text-slate-600 leading-relaxed mt-1.5 line-clamp-2">
                        {item.prompt}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-8 pb-6">
              {messages.map((msg) => {
                if (msg.role === "user") {
                  return (
                    <div key={msg.id} className="pt-2">
                      <div className="text-xs font-medium text-slate-500 mb-1.5">
                        Question
                      </div>
                      <h2 className="font-display text-xl font-semibold text-slate-900 leading-snug">
                        {msg.content}
                      </h2>
                    </div>
                  );
                }

                const isInspectingThisMsg = activeInspection?.messageId === msg.id;

                return (
                  <article
                    key={msg.id}
                    className="bg-white border border-slate-200 rounded-xl p-6 space-y-5"
                  >
                    {/* Assistant Header */}
                    <div className="flex items-center justify-between gap-4 pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
                        <BookOpen className="w-3.5 h-3.5 text-blue-600" aria-hidden="true" />
                        <span>Grounded Synthesis</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 font-mono tabular-nums">
                        {msg.sources.length > 0 && (
                          <span>{msg.sources.length} sources retrieved</span>
                        )}
                        {typeof msg.latencyMs === "number" && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{(msg.latencyMs / 1000).toFixed(2)}s</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Error state */}
                    {msg.phase === "error" && msg.error ? (
                      <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
                        <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
                        <div className="space-y-1">
                          <p className="font-medium text-red-900">Unable to complete grounded answer</p>
                          <p className="text-xs text-red-700 leading-relaxed">{msg.error}</p>
                        </div>
                      </div>
                    ) : msg.phase === "retrieving" && !msg.content ? (
                      <div className="space-y-3 py-1">
                        <p className="text-xs font-medium text-blue-700">
                          Embedding query and searching vector repository...
                        </p>
                        <div className="space-y-2">
                          <div className="h-3.5 w-full bg-slate-100 rounded" />
                          <div className="h-3.5 w-11/12 bg-slate-100 rounded" />
                          <div className="h-3.5 w-3/4 bg-slate-100 rounded" />
                        </div>
                      </div>
                    ) : msg.phase === "generating" && !msg.content ? (
                      <div className="space-y-3 py-1">
                        <p className="text-xs font-medium text-blue-700">
                          Found {msg.sources.length} relevant passages. Synthesizing answer...
                        </p>
                        <div className="space-y-2">
                          <div className="h-3.5 w-full bg-slate-100 rounded" />
                          <div className="h-3.5 w-5/6 bg-slate-100 rounded" />
                        </div>
                      </div>
                    ) : (
                      <MarkdownWithCitations
                        content={msg.content}
                        sources={msg.sources}
                        activeCitationIndex={
                          isInspectingThisMsg ? activeInspection.citationIndex : null
                        }
                        onSelectCitation={(citationIdx) =>
                          onSelectCitation(msg.id, citationIdx)
                        }
                      />
                    )}

                    {/* Supporting References Strip */}
                    {msg.sources.length > 0 && msg.phase !== "error" && (
                      <div className="pt-4 border-t border-slate-100 space-y-2">
                        <div className="text-xs font-medium text-slate-500">
                          Supporting References (click any source to inspect raw chunk)
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {msg.sources.map((src) => {
                            const selected =
                              isInspectingThisMsg &&
                              activeInspection.citationIndex === src.citationIndex;
                            return (
                              <button
                                key={src.chunkId}
                                type="button"
                                onClick={() =>
                                  onSelectCitation(msg.id, src.citationIndex)
                                }
                                className={`text-left px-3 py-2 rounded-lg border transition-colors flex items-start justify-between gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                                  selected
                                    ? "bg-blue-50/70 border-blue-300"
                                    : "bg-slate-50/60 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                                }`}
                              >
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 text-xs font-medium text-slate-900 truncate">
                                    <span className="font-mono text-blue-700 shrink-0 tabular-nums">
                                      [{src.citationIndex}]
                                    </span>
                                    <span className="truncate">{src.documentTitle}</span>
                                  </div>
                                  <p className="text-[11px] text-slate-500 truncate mt-0.5">
                                    {src.sectionHeading}
                                  </p>
                                </div>
                                <span className="font-mono text-[11px] text-slate-600 shrink-0 tabular-nums mt-0.5">
                                  {(src.similarity * 100).toFixed(0)}%
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
              <div ref={scrollEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* Bottom Composer */}
      <div className="shrink-0 bg-white border-t border-slate-200 px-4 sm:px-8 lg:px-12 py-3.5">
        <div className="max-w-3xl mx-auto">
          {scopeDisabled && (
            <div className="mb-2.5 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
              No documents are selected in your search scope. Select at least one document in the
              Repository sidebar to ask questions.
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="rounded-xl border border-slate-200 bg-white focus-within:border-blue-600 focus-within:ring-1 focus-within:ring-blue-600 transition-shadow"
          >
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputValue}
              onChange={(e) => handleInputResize(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={scopeDisabled}
              placeholder={
                scopeDisabled
                  ? "Select documents in the repository sidebar to query..."
                  : "Ask a technical question across your indexed documents..."
              }
              aria-label="Ask a question"
              className="w-full px-4 pt-3 pb-2 text-[15px] text-slate-900 placeholder:text-slate-400 bg-transparent resize-none focus:outline-none disabled:opacity-50"
            />
            <div className="px-3 pb-2.5 pt-1 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 text-xs text-slate-500 tabular-nums">
                <span>
                  Scope: {selectedDocCount}/{totalDocCount} docs
                </span>
                <span aria-hidden="true" className="text-slate-300">
                  ·
                </span>
                <button
                  type="button"
                  onClick={onOpenRetrievalSettings}
                  className="inline-flex items-center gap-1 hover:text-slate-900 transition-colors focus-visible:outline-none focus-visible:underline"
                >
                  <SlidersHorizontal className="w-3 h-3" aria-hidden="true" />
                  <span>
                    Top {retrievalConfig.topK} · Min{" "}
                    {(retrievalConfig.minSimilarity * 100).toFixed(0)}%
                  </span>
                </button>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {messages.length > 0 && (
                  <button
                    type="button"
                    onClick={onClearChat}
                    disabled={isStreaming}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md disabled:opacity-40 transition-colors whitespace-nowrap"
                  >
                    <RotateCcw className="w-3 h-3" aria-hidden="true" />
                    <span>New Chat</span>
                  </button>
                )}
                <button
                  type="submit"
                  disabled={scopeDisabled || isStreaming || !inputValue.trim()}
                  aria-label="Send question"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 rounded-lg transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                >
                  <span>{isStreaming ? "Thinking..." : "Ask"}</span>
                  <ArrowUp className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
