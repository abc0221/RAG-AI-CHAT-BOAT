import path from "path";
import { extractText } from "unpdf";
import type { DocumentFormat, StoredChunk } from "./types.ts";

export interface ExtractedDocumentText {
  title: string;
  format: DocumentFormat;
  text: string;
  summary: string;
}

export interface RawChunk {
  chunkIndex: number;
  sectionHeading: string;
  content: string;
  charStart: number;
  charEnd: number;
}

const TARGET_CHUNK_CHARS = 760;
const OVERLAP_CHARS = 140;
const HARD_MAX_CHARS = 980;

export function inferFormat(filename: string, mimeType?: string): DocumentFormat {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".pdf" || mimeType === "application/pdf") {
    return "pdf";
  }
  if (ext === ".md" || ext === ".markdown" || mimeType === "text/markdown") {
    return "md";
  }
  if (ext === ".txt" || mimeType === "text/plain") {
    return "txt";
  }
  throw new Error(
    `Unsupported file format for "${filename}". Please upload PDF, Markdown (.md), or plain text (.txt) files.`
  );
}

export function deriveTitleFromFilename(filename: string): string {
  const base = path.basename(filename, path.extname(filename));
  return base
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function deriveSummary(text: string): string {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#") && !line.startsWith("```"));

  const firstParagraph = lines.slice(0, 3).join(" ").replace(/\s+/g, " ").trim();
  if (!firstParagraph) {
    return "Indexed technical document.";
  }
  if (firstParagraph.length <= 165) {
    return firstParagraph;
  }
  return `${firstParagraph.slice(0, 162).trimEnd()}...`;
}

export async function extractTextFromFile(
  buffer: Buffer,
  filename: string,
  mimeType?: string
): Promise<ExtractedDocumentText> {
  const format = inferFormat(filename, mimeType);
  let rawText = "";

  if (format === "pdf") {
    const data = new Uint8Array(buffer);
    const extracted = await extractText(data, { mergePages: false });
    const pages = Array.isArray(extracted.text) ? extracted.text : [String(extracted.text ?? "")];
    rawText = pages
      .map((pageText, idx) => {
        const cleaned = pageText.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
        return cleaned ? `## Page ${idx + 1}\n\n${cleaned}` : "";
      })
      .filter(Boolean)
      .join("\n\n");
  } else {
    rawText = buffer.toString("utf-8").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  }

  const normalized = rawText.replace(/\n{3,}/g, "\n\n").trim();
  if (normalized.length < 20) {
    throw new Error(
      `No readable text could be extracted from "${filename}". Ensure the file is not empty or image-only.`
    );
  }

  // Prefer top-level Markdown heading as title if present
  const h1Match = normalized.match(/^#\s+(.+)$/m);
  const title = h1Match ? h1Match[1].trim() : deriveTitleFromFilename(filename);

  return {
    title,
    format,
    text: normalized,
    summary: deriveSummary(normalized),
  };
}

interface TextSegment {
  sectionHeading: string;
  text: string;
  charStart: number;
  charEnd: number;
}

function splitIntoParagraphSegments(text: string, defaultHeading: string): TextSegment[] {
  const lines = text.split("\n");
  const segments: TextSegment[] = [];

  let currentHeading = defaultHeading;
  let bufferLines: string[] = [];
  let bufferStart = 0;
  let cursor = 0;
  let inCodeBlock = false;

  const flushBuffer = () => {
    const joined = bufferLines.join("\n").trim();
    if (joined.length > 0) {
      const charEnd = cursor;
      segments.push({
        sectionHeading: currentHeading,
        text: joined,
        charStart: bufferStart,
        charEnd,
      });
    }
    bufferLines = [];
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const lineLenWithNewline = line.length + (i < lines.length - 1 ? 1 : 0);
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      inCodeBlock = !inCodeBlock;
    }

    const headingMatch = !inCodeBlock ? trimmed.match(/^#{1,4}\s+(.+)$/) : null;
    if (headingMatch) {
      flushBuffer();
      currentHeading = headingMatch[1].trim();
      bufferStart = cursor;
      cursor += lineLenWithNewline;
      continue;
    }

    if (!inCodeBlock && trimmed === "") {
      flushBuffer();
      cursor += lineLenWithNewline;
      bufferStart = cursor;
      continue;
    }

    if (bufferLines.length === 0) {
      bufferStart = cursor;
    }
    bufferLines.push(line);
    cursor += lineLenWithNewline;
  }

  flushBuffer();
  return segments;
}

function splitOversizedSegment(segment: TextSegment): TextSegment[] {
  if (segment.text.length <= HARD_MAX_CHARS) {
    return [segment];
  }

  const pieces: TextSegment[] = [];
  let offset = 0;
  while (offset < segment.text.length) {
    let end = Math.min(offset + TARGET_CHUNK_CHARS, segment.text.length);
    if (end < segment.text.length) {
      const windowSlice = segment.text.slice(offset, end);
      const lastSentenceBreak = Math.max(
        windowSlice.lastIndexOf(". "),
        windowSlice.lastIndexOf("\n")
      );
      if (lastSentenceBreak > TARGET_CHUNK_CHARS * 0.45) {
        end = offset + lastSentenceBreak + 1;
      }
    }

    const pieceText = segment.text.slice(offset, end).trim();
    if (pieceText.length > 0) {
      pieces.push({
        sectionHeading: segment.sectionHeading,
        text: pieceText,
        charStart: segment.charStart + offset,
        charEnd: segment.charStart + end,
      });
    }

    if (end >= segment.text.length) {
      break;
    }
    offset = Math.max(end - OVERLAP_CHARS, offset + 1);
  }

  return pieces;
}

export function chunkDocumentText(text: string, docTitle: string): RawChunk[] {
  const rawSegments = splitIntoParagraphSegments(text, docTitle);
  const segments = rawSegments.flatMap(splitOversizedSegment);

  const chunks: RawChunk[] = [];
  let activeContent = "";
  let activeHeading = docTitle;
  let activeStart = 0;
  let activeEnd = 0;

  const commitActive = () => {
    const trimmed = activeContent.trim();
    if (trimmed.length > 0) {
      chunks.push({
        chunkIndex: chunks.length,
        sectionHeading: activeHeading,
        content: trimmed,
        charStart: activeStart,
        charEnd: activeEnd,
      });
    }
  };

  for (const seg of segments) {
    if (activeContent.length === 0) {
      activeContent = seg.text;
      activeHeading = seg.sectionHeading;
      activeStart = seg.charStart;
      activeEnd = seg.charEnd;
      continue;
    }

    const sameHeading = seg.sectionHeading === activeHeading;
    const candidate = `${activeContent}\n\n${seg.text}`;

    if (sameHeading && candidate.length <= TARGET_CHUNK_CHARS) {
      activeContent = candidate;
      activeEnd = seg.charEnd;
    } else if (!sameHeading && candidate.length <= TARGET_CHUNK_CHARS * 0.72) {
      activeContent = candidate;
      activeHeading = seg.sectionHeading;
      activeEnd = seg.charEnd;
    } else {
      commitActive();

      // Carry a clean tail overlap if staying within the same section
      if (sameHeading && activeContent.length > OVERLAP_CHARS) {
        const tailStart = activeContent.length - OVERLAP_CHARS;
        const wordBoundary = activeContent.indexOf(" ", tailStart);
        const overlapSlice =
          wordBoundary > 0 ? activeContent.slice(wordBoundary + 1).trim() : "";

        if (overlapSlice.length > 20 && overlapSlice.length + seg.text.length + 2 <= HARD_MAX_CHARS) {
          activeContent = `${overlapSlice}\n\n${seg.text}`;
          activeStart = Math.max(0, activeEnd - overlapSlice.length);
          activeEnd = seg.charEnd;
          continue;
        }
      }

      activeContent = seg.text;
      activeHeading = seg.sectionHeading;
      activeStart = seg.charStart;
      activeEnd = seg.charEnd;
    }
  }

  commitActive();
  return chunks;
}

export function attachEmbeddingsToChunks(
  rawChunks: RawChunk[],
  embeddings: number[][],
  documentId: string,
  documentTitle: string
): StoredChunk[] {
  return rawChunks.map((chunk, idx) => ({
    id: `${documentId}_chunk_${idx}`,
    documentId,
    documentTitle,
    chunkIndex: chunk.chunkIndex,
    sectionHeading: chunk.sectionHeading,
    content: chunk.content,
    charStart: chunk.charStart,
    charEnd: chunk.charEnd,
    embedding: embeddings[idx] ?? [],
  }));
}
