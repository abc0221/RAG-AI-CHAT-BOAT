import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import type { ChatHistoryTurn, RetrievedSource } from "./types.ts";

export const EMBEDDING_MODEL = "gemini-embedding-2";
export const GENERATION_MODEL = "gemini-3.5-flash";

let cachedClient: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    throw new Error(
      "GEMINI_API_KEY is not configured. Add a valid key in Settings > Secrets to generate embeddings and grounded answers."
    );
  }
  if (!cachedClient) {
    cachedClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return cachedClient;
}

export function normalizeVector(values: number[]): number[] {
  let normSq = 0;
  for (let i = 0; i < values.length; i += 1) {
    normSq += values[i] * values[i];
  }
  const norm = Math.sqrt(normSq);
  if (norm === 0) {
    return values;
  }
  const normalized = new Array<number>(values.length);
  for (let i = 0; i < values.length; i += 1) {
    normalized[i] = values[i] / norm;
  }
  return normalized;
}

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const isAuthOrInvalid =
        message.includes("API_KEY_INVALID") ||
        message.includes("PERMISSION_DENIED") ||
        message.includes("NOT_FOUND") ||
        message.includes("400") ||
        message.includes("403");
      if (isAuthOrInvalid || attempt === maxAttempts) {
        throw error;
      }
      const delayMs = 350 * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }
  const ai = getGeminiClient();
  const allEmbeddings = new Array<number[]>(texts.length);
  const concurrency = 5;
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < texts.length) {
      const idx = nextIndex;
      nextIndex += 1;
      const result = await withRetry(() =>
        ai.models.embedContent({
          model: EMBEDDING_MODEL,
          contents: texts[idx],
        })
      );

      const emb = result.embeddings?.[0];
      if (!emb?.values || emb.values.length === 0) {
        throw new Error(`Embedding service returned an empty vector for chunk ${idx}.`);
      }
      allEmbeddings[idx] = normalizeVector(emb.values);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, texts.length) },
    () => worker()
  );
  await Promise.all(workers);

  return allEmbeddings;
}

export async function embedQuery(query: string): Promise<number[]> {
  const vectors = await embedTexts([query]);
  return vectors[0];
}

export function buildGroundedSystemPrompt(): string {
  return [
    "You are FolioRAG, a helpful, knowledgeable AI assistant, similar to ChatGPT.",
    "You will be given retrieved document passages from the user's library, plus their question.",
    "Rules:",
    "1. If the passages are relevant to the question, use them and cite them inline with bracketed numbers like [1] or [2] right after the claim they support.",
    "2. If the passages are not relevant or are missing, answer the question normally from your own general knowledge. Do not say that the documents lack evidence, and do not add citations.",
    "3. When you answer from general knowledge instead of the documents, begin with one short line: 'Note: this answer is not from your documents.'",
    "4. If a question mixes both, use cited passages for what they cover and general knowledge for the rest, and make clear which is which.",
    "5. Write clear, well-structured answers with headings, bullet points, and code blocks when they help.",
    "6. Do not add a separate bibliography at the end; the interface already shows the sources.",
  ].join("\n");
}

export function formatContextPrompt(
  query: string,
  sources: RetrievedSource[],
  history: ChatHistoryTurn[]
): string {
  const recentHistory = history
    .slice(-4)
    .map(
      (turn) =>
        `${turn.role === "user" ? "Engineer" : "Assistant"}: ${turn.content.slice(0, 600)}`
    )
    .join("\n");

  const contextBlocks = sources
    .map((src) => {
      const pct = (src.similarity * 100).toFixed(1);
      return [
        `[${src.citationIndex}] Document: ${src.documentTitle} | Section: ${src.sectionHeading} | Similarity: ${pct}%`,
        src.content,
      ].join("\n");
    })
    .join("\n\n---\n\n");

  const sections: string[] = [];
  if (recentHistory.length > 0) {
    sections.push(`Recent Conversation Context:\n${recentHistory}`);
  }
  sections.push(
    sources.length > 0
      ? `Retrieved Document Passages:\n\n${contextBlocks}`
      : "Retrieved Document Passages:\n(No passages met the similarity threshold for the current document scope.)"
  );
  sections.push(`Current Question:\n${query}`);

  return sections.join("\n\n========================================\n\n");
}

export async function streamGroundedAnswer(
  query: string,
  sources: RetrievedSource[],
  history: ChatHistoryTurn[],
  onDelta: (textChunk: string) => void
): Promise<string> {
  const ai = getGeminiClient();
  const prompt = formatContextPrompt(query, sources, history);

  const responseStream = await withRetry(() =>
    ai.models.generateContentStream({
      model: GENERATION_MODEL,
      contents: prompt,
      config: {
        systemInstruction: buildGroundedSystemPrompt(),
      },
    })
  );

  let fullText = "";
  for await (const chunk of responseStream) {
    const delta = chunk.text ?? "";
    if (delta.length > 0) {
      fullText += delta;
      onDelta(delta);
    }
  }

  if (!fullText) {
    throw new Error("The language model returned an empty response.");
  }

  return fullText;
}
