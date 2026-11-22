# FolioRAG — Engineering & AI Architecture Document Assistant

An intelligent Retrieval-Augmented Generation (RAG) workspace that indexes curated and user-uploaded engineering documents into a persistent local vector database and synthesizes grounded, inline-cited answers with an expandable chunk inspector.

## User Review & Critical Decisions

> [!IMPORTANT]
> All core product, aesthetic, and architectural choices below were confirmed during discovery and govern the implementation.

- **Confirmed Decision 1 — Curated Knowledge Domain**: Pre-loaded with a curated **Engineering & AI Architecture** repository (distributed systems resilience, LLM inference & quantization, RAG retrieval & chunking patterns, API gateway & rate-limiting architecture, and observability/SLO design).
- **Confirmed Decision 2 — Visual Aesthetic**: **Crisp Light Editorial Research Studio** featuring high-contrast ink typography on a clean neutral canvas, strict single-elevation hairline surfaces, and focused sapphire-cobalt accents.
- **Confirmed Decision 3 — Persistence & File Formats**: **Local Persistent Vector Store** supporting multi-file upload and ingestion for **PDF, TXT, and Markdown (MD)** documents, stored persistently on disk so indexed chunks and embeddings survive reloads.
- **Confirmed Decision 4 — Citation Transparency**: **Inline Numbered Citations (`[1]`, `[2]`)** embedded directly in generated answers, paired with an **Expandable Chunk Inspector** drawer revealing the exact retrieved passage, cosine similarity score, document origin, and chunk index.

---

## 1. Overview & Core Concept

- **What It Does**: FolioRAG ingests technical documents (PDF, Markdown, plain text), splits them into context-preserving overlapping chunks, generates dense vector embeddings, persists them in a local vector repository, retrieves the most semantically relevant passages for any user query, and generates concise, verifiable answers strictly grounded in the retrieved context.
- **Target Audience / Persona**: Software engineers, systems architects, technical leads, and researchers who need fast, verifiable answers across technical specifications, architecture decision records (ADRs), and design manuals without hallucination.
- **Key Value**: Eliminates manual Ctrl+F hunting across disparate specs while guaranteeing auditability—every claim in an answer links directly to the exact source chunk and similarity score that backed it.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Zero-State & Curated Studio Entry**:
   - The user lands directly in the full-width research workspace (no marketing splash screen).
   - The left repository sidebar displays the pre-indexed curated Engineering & AI Architecture documents with unboxed metadata (format, chunk count, indexing status).
   - The main canvas displays an editorial prompt header and curated starter questions (e.g., *"How should chunk overlap and hybrid retrieval be configured for long technical RFCs?"* or *"Compare token bucket and sliding window rate limiting under burst traffic."*).
2. **Multi-Document Upload & Ingestion**:
   - Clicking **Upload Documents** (or dragging files into the repository dropzone) accepts multiple `.pdf`, `.txt`, and `.md` files simultaneously.
   - Each file transitions visibly through ingestion stages (*Extracting text → Chunking → Embedding → Indexed*) and persists to the local vector repository immediately.
   - Users can click any document in the sidebar to inspect its extracted chunks in a clean document-preview modal/view, toggle whether it is included in the active retrieval scope, or delete it.
3. **Grounded Q&A with Inline Citations**:
   - Submitting a question triggers query embedding, cosine-similarity ranking across the active document scope, and grounded LLM generation.
   - Answers render in clean editorial prose (with syntax-clean Markdown formatting, lists, and code blocks) containing interactive inline citation markers like `[1]` and `[2]`, followed by a compact, scannable source reference strip.
4. **Expandable Chunk Inspector**:
   - Clicking any inline citation `[1]` or source item slides open the **Chunk Inspector** panel on the right without losing scroll position in the chat.
   - The inspector displays the exact retrieved text passage, cosine similarity percentage (in tabular numerals), document title, section heading (when available), chunk sequence number, and character span, plus quick stepping between all retrieved chunks (`#1` through `#K`) for that turn.

### Visual Identity & Theme

- **Aesthetic Direction**: Crisp Light Editorial Research Studio—calm, precise, and distraction-free, inspired by modern technical monographs and research notebooks.
- **Color Palette & Mood** (60-30-10 discipline):
  - *60% Neutral Canvas*: Crisp studio white (`--background: #FFFFFF`) and cool alabaster canvas (`--canvas: #F8FAFC`).
  - *30% Structural Surfaces*: Cool mist sidebars/drawers (`#F1F5F9`), 1px hairline borders (`#E2E8F0`), primary slate ink (`#0F172A`), and muted slate metadata (`#475569` / `#64748B`).
  - *10% High-Intent Accent*: Sapphire cobalt (`--primary: #2563EB`) reserved strictly for primary CTAs, active citation markers, focus rings, and active scope indicators. Semantic states (indexed green `#16A34A`, warning amber `#D97706`, error crimson `#DC2626`) are always paired with explicit text labels.
- **Typography & Hierarchy**:
  - *Display & Section Headings*: `Bricolage Grotesque` (weights 600–700) with `text-wrap: balance` to prevent orphan trailing words.
  - *Body & Chat Prose*: `Plus Jakarta Sans` (weights 400–600, 15px–16px, 1.6 line-height, 65–72ch optimal reading measure).
  - *Telemetry & Citations*: `JetBrains Mono` with `tabular-nums` strictly for similarity percentages, chunk indices, byte sizes, and code snippets.
- **Component Styling & Layout**:
  - Single-row, three-zone top navigation bar: Brand wordmark (`FolioRAG`) on the left, concise workspace view links (`Assistant`, `Repository`, `Retrieval Settings`) in the center, and one primary action (`Upload Docs`) on the right.
  - Full-width 1440px desktop layout: Left Repository Sidebar (`280px`) + Fluid Center Chat & Research Viewport + Contextual Right Chunk Inspector Drawer (`380px`, collapsible).
  - Strict zero-pill metadata discipline (unboxed text separated by `·`), single-elevation flat surfaces with 1px hairline borders, and no decorative pulsing dots or thick left accent bars.

### Interactive Feedback & Motion

- **Routine Transitions**: Drawer open/close, citation focus highlights, and filter switches settle within `150ms–200ms` using compositor-only `transform` and `opacity` transitions.
- **Loading & Empty States**: Structured skeleton lines during retrieval/generation with explicit phase feedback (*Retrieving passages… → Synthesizing grounded answer…*); clear empty states when a repository search filter matches zero documents or when all documents are deselected from scope.
- **Error Boundaries**: Upstream API or file-parsing errors (e.g., encrypted/empty PDF or missing API key) surface inline with actionable retry or upload guidance—never silent failures.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1 — Local Persistent Disk-Backed Vector Store**
  - *Chosen Approach*: Persist documents, extracted chunks, and normalized float vectors in an atomic server-side disk store paired with an in-memory cosine-similarity search index hydrated on startup.
  - *Why*: Guarantees zero-setup persistence across page refreshes and server restarts, eliminates native C++ build friction, and keeps vector math sub-millisecond for thousands of engineering chunks.
  - *Alternatives Considered*: Session-only in-memory arrays (loses uploads on reload) or external cloud vector databases (adds unnecessary network latency and external provisioning).

- **Decision 2 — Heading- & Paragraph-Aware Overlapping Chunker**
  - *Chosen Approach*: Split extracted text along Markdown/document section headings and paragraph boundaries first, packing into ~700-character chunks with ~140-character overlap while recording the nearest section heading and character offset.
  - *Why*: Preserves semantic coherence in technical specs (avoiding mid-sentence or mid-code-block cuts) so retrieved passages make complete sense in the Chunk Inspector.
  - *Alternatives Considered*: Naive fixed character slicing (breaks technical definitions and code snippets across chunk boundaries).

- **Decision 3 — Server-Side Gemini Embedding & Grounded Synthesis**
  - *Chosen Approach*: Use Gemini's embedding model (`gemini-embedding-2`) for both document chunk indexing and user query vectorization, and `gemini-4-hydrogen` with strict grounding system instructions to generate answers citing `[1]`, `[2]`, etc. exclusively from retrieved chunks.
  - *Why*: Keeps API credentials strictly server-side, aligns semantic vector space between queries and documents, and enforces honest "not found in repository" responses when the corpus lacks supporting evidence.
  - *Alternatives Considered*: Keyword-only TF-IDF/BM25 search (misses semantic synonyms like "circuit breaker" vs. "fault isolation") or ungrounded LLM chat.

- **Decision 4 — Inline Citations with Slide-Over Chunk Inspector**
  - *Chosen Approach*: Render numbered citation buttons inline at the exact sentence they support, opening a focused inspector drawer showing the verbatim chunk, similarity score, and adjacent chunk context.
  - *Why*: Keeps the primary reading canvas clean and scannable while letting engineers immediately verify technical claims against raw source text.
  - *Alternatives Considered*: Dumping full raw chunks inline below every answer (clutters the chat history and obscures narrative clarity).

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### Architecture & Component Diagram

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        Browser Workspace (React UI)                        │
│                                                                            │
│  ┌──────────────────┐   ┌───────────────────────────┐   ┌───────────────┐  │
│  │ Repository Rail  │   │  Research Chat Canvas     │   │Chunk Inspector│  │
│  │ • Multi-upload   │   │  • Starter prompts        │   │• Verbatim text│  │
│  │ • Scope toggles  │   │  • Grounded Q&A stream    │   │• Cosine score │  │
│  │ • Search & inspect│  │  • Inline [1][2] citations│   │• Doc metadata │  │
│  └────────┬─────────┘   └─────────────┬─────────────┘   └───────▲───────┘  │
└───────────┼───────────────────────────┼─────────────────────────┼──────────┘
            │ POST /api/documents       │ POST /api/chat          │
            ▼                           ▼                         │
┌────────────────────────────────────────────────────────────────────────────┐
│                       Express Server (Node.js API)                         │
│                                                                            │
│  ┌──────────────────────┐        ┌──────────────────────────────────────┐  │
│  │ Ingestion Pipeline   │        │ Retrieval & Grounded Answer Engine   │  │
│  │ • PDF / MD / TXT     │        │ • Embed user query                   │  │
│  │   text extraction    │        │ • Filter by active document scope    │  │
│  │ • Heading-aware      │        │ • Cosine similarity top-K ranking    │  │
│  │   overlapping chunker│        │ • Grounded prompt + citation parser  │  │
│  └──────────┬───────────┘        └──────────────────┬───────────────────┘  │
│             │                                       │                      │
│             ▼                                       ▼                      │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │              Persistent Vector Store (Disk + Memory Index)           │  │
│  │  • Curated Engineering & AI Docs (auto-seeded & embedded on boot)    │  │
│  │  • Uploaded Docs, Chunks, Metadata, Normalized Embedding Vectors     │  │
│  └──────────────────────────────────┬───────────────────────────────────┘  │
└─────────────────────────────────────┼──────────────────────────────────────┘
                                      │ Server-only API calls
                                      ▼
                       ┌──────────────────────────────┐
                       │         Gemini API           │
                       │ • gemini-embedding-2         │
                       │ • gemini-4-hydrogen          │
                       └──────────────────────────────┘
```

### Data Model & State

- **Document**: `id`, `title`, `filename`, `format` (`pdf` | `md` | `txt`), `category` (`curated` | `uploaded`), `byteSize`, `chunkCount`, `createdAt`, `summary`.
- **DocumentChunk**: `id`, `documentId`, `documentTitle`, `chunkIndex`, `sectionHeading`, `content`, `charStart`, `charEnd`, `embedding` (`number[]`).
- **RetrievedSource**: `citationIndex` (`1..K`), `chunkId`, `documentId`, `documentTitle`, `sectionHeading`, `content`, `similarity` (`0..1`), `chunkIndex`.
- **ChatMessage**: `id`, `role` (`user` | `assistant`), `content` (Markdown with `[n]` markers), `sources` (`RetrievedSource[]`), `latencyMs`, `createdAt`, `error?`.
- **WorkspaceState**: `documents`, `selectedScopeIds` (which docs are active for RAG search), `topK` (default `5`, adjustable `3–8`), `minSimilarity` (threshold slider), `activeInspection` (`{ messageId, citationIndex }` or `null`).

### Interactive Component & State Mapping

- **Multi-File Upload & Dropzone**: Validates `.pdf`, `.txt`, `.md` extensions and size limits client-side; posts `multipart/form-data` to `/api/documents/upload`; displays per-file progress and updates the repository list + vector index count upon completion.
- **Repository Filtering & Scope Selection**: Search box filters the sidebar document list instantly; checkboxes toggle individual documents or "All Documents" in the active retrieval scope sent with every query; clicking a document's inspect action opens a clean modal/panel listing all of its indexed chunks.
- **Document Deletion & Repository Reset**: Delete button removes a document and cascades deletion of its chunks/vectors from the persistent store; a secondary reset action restores the curated Engineering & AI Architecture baseline if desired.
- **Grounded Chat & Citation Linking**: Submitting a question disables duplicate submission, shows retrieval phase state, appends the assistant response with parsed `[n]` interactive citation buttons, and smoothly scrolls to the newest message. Clicking `[n]` sets `activeInspection`, opening the right-hand Chunk Inspector focused on source `n` with Next/Previous controls to cycle through all retrieved chunks for that answer.
