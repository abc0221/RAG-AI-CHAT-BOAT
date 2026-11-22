import "dotenv/config";
import crypto from "crypto";
import express from "express";
import fs from "fs";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { extractTextFromFile } from "./server/chunker.ts";
import {
  EMBEDDING_MODEL,
  GENERATION_MODEL,
  embedQuery,
  streamGroundedAnswer,
} from "./server/gemini.ts";
import type { ChatHistoryTurn } from "./server/types.ts";
import {
  ensureAllChunksEmbedded,
  getDocumentChunks,
  ingestDocument,
  initializeVectorStore,
  listDocuments,
  removeDocument,
  resetRepositoryToCurated,
  searchVectorStore,
} from "./server/vectorStore.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const app = express();

app.use(express.json({ limit: "2mb" }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024, // 15 MB per file
    files: 10,
  },
});

app.get("/api/health", async (_req, res) => {
  try {
    const summary = await listDocuments();
    res.json({
      ok: true,
      embeddingModel: EMBEDDING_MODEL,
      generationModel: GENERATION_MODEL,
      documents: summary.documents.length,
      totalChunks: summary.totalChunks,
      embeddedChunks: summary.embeddedChunks,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Failed to inspect vector store",
    });
  }
});

app.get("/api/documents", async (_req, res) => {
  try {
    const data = await listDocuments();
    res.json({
      ...data,
      generationModel: GENERATION_MODEL,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to load documents",
    });
  }
});

app.get("/api/documents/:id/chunks", async (req, res) => {
  try {
    const { document, chunks } = await getDocumentChunks(req.params.id);
    if (!document) {
      res.status(404).json({ error: "Document not found." });
      return;
    }
    res.json({ document, chunks });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to load document chunks",
    });
  }
});

app.post("/api/documents/upload", upload.array("files", 10), async (req, res) => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (files.length === 0) {
    res.status(400).json({ error: "Please attach at least one PDF, Markdown, or TXT file." });
    return;
  }

  const uploaded = [];
  const errors: { filename: string; error: string }[] = [];

  for (const file of files) {
    try {
      const extracted = await extractTextFromFile(
        file.buffer,
        file.originalname,
        file.mimetype
      );
      const docId = `doc_${crypto.randomBytes(6).toString("hex")}`;
      const created = await ingestDocument({
        id: docId,
        title: extracted.title,
        filename: file.originalname,
        format: extracted.format,
        category: "uploaded",
        byteSize: file.size,
        text: extracted.text,
        summary: extracted.summary,
      });
      uploaded.push(created);
    } catch (error) {
      errors.push({
        filename: file.originalname,
        error: error instanceof Error ? error.message : "Failed to process file.",
      });
    }
  }

  if (uploaded.length === 0 && errors.length > 0) {
    res.status(400).json({
      error: errors.map((e) => `${e.filename}: ${e.error}`).join(" "),
      errors,
      uploaded: [],
    });
    return;
  }

  const summary = await listDocuments();
  res.status(201).json({
    uploaded,
    errors,
    totalChunks: summary.totalChunks,
    embeddedChunks: summary.embeddedChunks,
  });
});

app.delete("/api/documents/:id", async (req, res) => {
  try {
    const deleted = await removeDocument(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: "Document not found." });
      return;
    }
    const summary = await listDocuments();
    res.json({
      deletedId: req.params.id,
      totalChunks: summary.totalChunks,
      embeddedChunks: summary.embeddedChunks,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to delete document",
    });
  }
});

app.post("/api/documents/reset", async (_req, res) => {
  try {
    const result = await resetRepositoryToCurated();
    res.json({
      documents: result.documents,
      totalChunks: result.totalChunks,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to reset curated repository",
    });
  }
});

app.post("/api/chat", async (req, res) => {
  const startedAt = Date.now();
  const body = req.body as {
    query?: string;
    history?: ChatHistoryTurn[];
    documentIds?: string[];
    topK?: number;
    minSimilarity?: number;
  };

  const query = typeof body.query === "string" ? body.query.trim() : "";
  if (!query) {
    res.status(400).json({ error: "Query cannot be empty." });
    return;
  }

  const documentIds = Array.isArray(body.documentIds) ? body.documentIds : undefined;
  if (documentIds && documentIds.length === 0) {
    res.status(400).json({
      error: "No documents are selected in the retrieval scope. Select at least one document in the repository sidebar.",
    });
    return;
  }

  const rawTopK = Number(body.topK ?? 5);
  const topK = Math.min(Math.max(Number.isFinite(rawTopK) ? rawTopK : 5, 1), 10);
  const rawMinSim = Number(body.minSimilarity ?? 0.32);
  const minSimilarity = Math.min(
    Math.max(Number.isFinite(rawMinSim) ? rawMinSim : 0.32, 0),
    0.95
  );
  const history = Array.isArray(body.history) ? body.history : [];

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const sendEvent = (event: string, data: unknown) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    await ensureAllChunksEmbedded();
    const queryVector = await embedQuery(query);
    const sources = await searchVectorStore(queryVector, {
      documentIds,
      topK,
      minSimilarity,
    });

    sendEvent("sources", { sources });

    await streamGroundedAnswer(query, sources, history, (delta) => {
      sendEvent("chunk", { text: delta });
    });

    sendEvent("done", {
      latencyMs: Date.now() - startedAt,
    });
    res.end();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate grounded response.";
    sendEvent("error", { error: message });
    res.end();
  }
});

// Error handler for Multer upload limits
app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    if (err instanceof multer.MulterError) {
      res.status(400).json({ error: `Upload error: ${err.message}` });
      return;
    }
    if (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "Internal server error",
      });
      return;
    }
    next();
  }
);

async function startServer() {
  await initializeVectorStore();

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, "dist");
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get("/{*path}", (_req, res) => {
        res.sendFile(path.join(distDir, "index.html"));
      });
    }
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`FolioRAG server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start FolioRAG server:", error);
  process.exit(1);
});
