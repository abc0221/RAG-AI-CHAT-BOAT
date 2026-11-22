export type DocumentFormat = "pdf" | "md" | "txt";
export type DocumentCategory = "curated" | "uploaded";
export type WorkspaceView = "assistant" | "repository" | "retrieval";

export interface RagDocument {
  id: string;
  title: string;
  filename: string;
  format: DocumentFormat;
  category: DocumentCategory;
  byteSize: number;
  chunkCount: number;
  createdAt: string;
  summary: string;
}

export interface DocumentChunkPreview {
  id: string;
  documentId: string;
  documentTitle: string;
  chunkIndex: number;
  sectionHeading: string;
  content: string;
  charStart: number;
  charEnd: number;
}

export interface RetrievedSource {
  citationIndex: number;
  chunkId: string;
  documentId: string;
  documentTitle: string;
  sectionHeading: string;
  content: string;
  similarity: number;
  chunkIndex: number;
  charStart: number;
  charEnd: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources: RetrievedSource[];
  phase?: "retrieving" | "generating" | "complete" | "error";
  latencyMs?: number;
  error?: string;
  createdAt: string;
}

export interface RetrievalConfig {
  topK: number;
  minSimilarity: number;
}

export interface UploadProgressItem {
  id: string;
  filename: string;
  status: "uploading" | "indexed" | "error";
  error?: string;
}

export interface ActiveInspection {
  messageId: string;
  citationIndex: number;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }
  return `${(kb / 1024).toFixed(2)} MB`;
}
