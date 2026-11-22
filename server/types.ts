export type DocumentFormat = "pdf" | "md" | "txt";
export type DocumentCategory = "curated" | "uploaded";

export interface StoredDocument {
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

export interface StoredChunk {
  id: string;
  documentId: string;
  documentTitle: string;
  chunkIndex: number;
  sectionHeading: string;
  content: string;
  charStart: number;
  charEnd: number;
  embedding: number[];
}

export interface VectorStoreData {
  version: number;
  embeddingModel: string;
  documents: StoredDocument[];
  chunks: StoredChunk[];
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

export interface ChatHistoryTurn {
  role: "user" | "assistant";
  content: string;
}
