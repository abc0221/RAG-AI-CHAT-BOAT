import fs from "fs/promises";
import path from "path";
import {
  attachEmbeddingsToChunks,
  chunkDocumentText,
  deriveSummary,
} from "./chunker.ts";
import { CURATED_ENGINEERING_DOCS } from "./curatedDocs.ts";
import { EMBEDDING_MODEL, embedTexts } from "./gemini.ts";
import type {
  DocumentCategory,
  DocumentFormat,
  RetrievedSource,
  StoredChunk,
  StoredDocument,
  VectorStoreData,
} from "./types.ts";

const DATA_DIR = path.resolve(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "vector-store.json");

let store: VectorStoreData = {
  version: 1,
  embeddingModel: EMBEDDING_MODEL,
  documents: [],
  chunks: [],
};

let initPromise: Promise<void> | null = null;
let writeQueue: Promise<void> = Promise.resolve();

function dotProduct(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let sum = 0;
  for (let i = 0; i < len; i += 1) {
    sum += a[i] * b[i];
  }
  return sum;
}

async function persistStore(): Promise<void> {
  const payload = JSON.stringify(store);
  writeQueue = writeQueue.then(async () => {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const tempPath = `${STORE_PATH}.tmp`;
    await fs.writeFile(tempPath, payload, "utf-8");
    await fs.rename(tempPath, STORE_PATH);
  });
  return writeQueue;
}

async function seedCuratedDocuments(): Promise<void> {
  const newDocs: StoredDocument[] = [];
  const allRawChunks: {
    docId: string;
    docTitle: string;
    chunkIndex: number;
    sectionHeading: string;
    content: string;
    charStart: number;
    charEnd: number;
  }[] = [];

  for (const seed of CURATED_ENGINEERING_DOCS) {
    const rawChunks = chunkDocumentText(seed.content, seed.title);
    newDocs.push({
      id: seed.id,
      title: seed.title,
      filename: seed.filename,
      format: "md",
      category: "curated",
      byteSize: Buffer.byteLength(seed.content, "utf-8"),
      chunkCount: rawChunks.length,
      createdAt: new Date().toISOString(),
      summary: deriveSummary(seed.content),
    });

    for (const chunk of rawChunks) {
      allRawChunks.push({
        docId: seed.id,
        docTitle: seed.title,
        ...chunk,
      });
    }
  }

  let embeddings: number[][] = [];
  try {
    embeddings = await embedTexts(allRawChunks.map((c) => c.content));
  } catch (error) {
    console.warn(
      "[VectorStore] Deferred curated embeddings until GEMINI_API_KEY is available:",
      error instanceof Error ? error.message : String(error)
    );
  }

  const storedChunks: StoredChunk[] = allRawChunks.map((chunk, idx) => ({
    id: `${chunk.docId}_chunk_${chunk.chunkIndex}`,
    documentId: chunk.docId,
    documentTitle: chunk.docTitle,
    chunkIndex: chunk.chunkIndex,
    sectionHeading: chunk.sectionHeading,
    content: chunk.content,
    charStart: chunk.charStart,
    charEnd: chunk.charEnd,
    embedding: embeddings[idx] ?? [],
  }));

  store = {
    version: 1,
    embeddingModel: EMBEDDING_MODEL,
    documents: newDocs,
    chunks: storedChunks,
  };

  await persistStore();
}

export async function initializeVectorStore(): Promise<void> {
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      const raw = await fs.readFile(STORE_PATH, "utf-8");
      const parsed = JSON.parse(raw) as VectorStoreData;
      if (
        parsed &&
        Array.isArray(parsed.documents) &&
        Array.isArray(parsed.chunks) &&
        parsed.documents.length > 0
      ) {
        store = parsed;
        return;
      }
    } catch {
      // File missing or invalid; seed curated baseline
    }

    await seedCuratedDocuments();
  })();

  return initPromise;
}

export async function ensureAllChunksEmbedded(): Promise<void> {
  await initializeVectorStore();
  const missing = store.chunks.filter((chunk) => !chunk.embedding || chunk.embedding.length === 0);
  if (missing.length === 0) {
    return;
  }

  const embeddings = await embedTexts(missing.map((chunk) => chunk.content));
  for (let i = 0; i < missing.length; i += 1) {
    missing[i].embedding = embeddings[i];
  }
  await persistStore();
}

export async function listDocuments(): Promise<{
  documents: StoredDocument[];
  totalChunks: number;
  embeddedChunks: number;
  embeddingModel: string;
}> {
  await initializeVectorStore();
  const embeddedChunks = store.chunks.filter(
    (c) => Array.isArray(c.embedding) && c.embedding.length > 0
  ).length;
  return {
    documents: store.documents,
    totalChunks: store.chunks.length,
    embeddedChunks,
    embeddingModel: store.embeddingModel,
  };
}

export async function getDocumentChunks(documentId: string): Promise<{
  document: StoredDocument | null;
  chunks: Omit<StoredChunk, "embedding">[];
}> {
  await initializeVectorStore();
  const document = store.documents.find((d) => d.id === documentId) ?? null;
  if (!document) {
    return { document: null, chunks: [] };
  }
  const chunks = store.chunks
    .filter((c) => c.documentId === documentId)
    .sort((a, b) => a.chunkIndex - b.chunkIndex)
    .map(({ embedding: _embedding, ...rest }) => rest);
  return { document, chunks };
}

export async function ingestDocument(params: {
  id: string;
  title: string;
  filename: string;
  format: DocumentFormat;
  category: DocumentCategory;
  byteSize: number;
  text: string;
  summary: string;
}): Promise<StoredDocument> {
  await initializeVectorStore();
  const rawChunks = chunkDocumentText(params.text, params.title);
  if (rawChunks.length === 0) {
    throw new Error(`Document "${params.filename}" yielded 0 indexable text chunks.`);
  }

  const embeddings = await embedTexts(rawChunks.map((c) => c.content));
  const storedChunks = attachEmbeddingsToChunks(
    rawChunks,
    embeddings,
    params.id,
    params.title
  );

  const doc: StoredDocument = {
    id: params.id,
    title: params.title,
    filename: params.filename,
    format: params.format,
    category: params.category,
    byteSize: params.byteSize,
    chunkCount: storedChunks.length,
    createdAt: new Date().toISOString(),
    summary: params.summary,
  };

  store.documents = [doc, ...store.documents];
  store.chunks = [...storedChunks, ...store.chunks];
  await persistStore();
  return doc;
}

export async function removeDocument(documentId: string): Promise<boolean> {
  await initializeVectorStore();
  const existing = store.documents.some((d) => d.id === documentId);
  if (!existing) {
    return false;
  }
  store.documents = store.documents.filter((d) => d.id !== documentId);
  store.chunks = store.chunks.filter((c) => c.documentId !== documentId);
  await persistStore();
  return true;
}

export async function resetRepositoryToCurated(): Promise<{
  documents: StoredDocument[];
  totalChunks: number;
}> {
  await seedCuratedDocuments();
  return {
    documents: store.documents,
    totalChunks: store.chunks.length,
  };
}

export async function searchVectorStore(
  queryEmbedding: number[],
  options: {
    documentIds?: string[];
    topK: number;
    minSimilarity: number;
  }
): Promise<RetrievedSource[]> {
  await ensureAllChunksEmbedded();

  const scopeSet =
    options.documentIds && options.documentIds.length > 0
      ? new Set(options.documentIds)
      : null;

  const candidates: { chunk: StoredChunk; similarity: number }[] = [];

  for (const chunk of store.chunks) {
    if (scopeSet && !scopeSet.has(chunk.documentId)) {
      continue;
    }
    if (!chunk.embedding || chunk.embedding.length === 0) {
      continue;
    }
    const similarity = dotProduct(queryEmbedding, chunk.embedding);
    if (similarity >= options.minSimilarity) {
      candidates.push({ chunk, similarity });
    }
  }

  candidates.sort((a, b) => b.similarity - a.similarity);

  return candidates.slice(0, options.topK).map((entry, idx) => ({
    citationIndex: idx + 1,
    chunkId: entry.chunk.id,
    documentId: entry.chunk.documentId,
    documentTitle: entry.chunk.documentTitle,
    sectionHeading: entry.chunk.sectionHeading,
    content: entry.chunk.content,
    similarity: Number(entry.similarity.toFixed(4)),
    chunkIndex: entry.chunk.chunkIndex,
    charStart: entry.chunk.charStart,
    charEnd: entry.chunk.charEnd,
  }));
}
