export interface CuratedDocumentSeed {
  id: string;
  filename: string;
  title: string;
  content: string;
}

export const CURATED_ENGINEERING_DOCS: CuratedDocumentSeed[] = [
  {
    id: "curated-rag-retrieval-architecture",
    filename: "rag-chunking-hybrid-retrieval.md",
    title: "RAG Retrieval, Semantic Chunking & Hybrid Ranking",
    content: `# RAG Retrieval, Semantic Chunking & Hybrid Ranking

Retrieval-Augmented Generation systems succeed or fail on retrieval precision long before the synthesis LLM runs. Sending noisy or truncated fragments degrades answer faithfulness and wastes context window capacity.

## Heading-Aware Chunking and Overlap Strategy

Naive fixed-character splitting frequently severs function signatures, configuration tables, or architectural caveats across boundaries. Production pipelines should split along structural boundaries—Markdown headings, paragraph breaks, and fenced code blocks—before enforcing token or character caps.

For technical specifications and Architecture Decision Records (ADRs), a target chunk window of 600 to 900 characters (roughly 150 to 220 tokens) balances semantic focus with sufficient surrounding rationale. Applying a 15% to 20% sliding overlap (120 to 160 characters) within the same section ensures transitional clauses and pronouns retain their referent without duplicating across unrelated sections.

## Dense Embeddings vs. Lexical Sparse Retrieval

Dense vector embeddings capture semantic intent and synonyms—matching a user query about "fault isolation" to documentation covering "bulkhead pools". However, pure dense embeddings often underperform on exact error codes, RFC identifiers, environment variable names, and acronyms such as \`HTTP_429\` or \`NVMe-oF\`.

Combining dense cosine similarity with sparse BM25 lexical scoring via Reciprocal Rank Fusion (RRF) eliminates blind spots in both approaches:

\`\`\`
RRF_score(d) = sum( 1 / (k + rank_i(d)) )   where k = 60
\`\`\`

Using \`k = 60\` dampens extreme rank outliers so documents ranked consistently in the top 15 across both lexical and semantic retrievers rise to the top of the candidate pool.

## Grounding Thresholds and Citation Enforcement

To prevent hallucinated answers when a corpus lacks relevant coverage, retrieval engines should enforce a minimum cosine similarity threshold (typically 0.35 to 0.45 for normalized general-purpose embeddings). Passages scoring below the threshold must be excluded rather than padded into the prompt.

When synthesizing answers, number each retrieved passage sequentially (\`[1]\`, \`[2]\`, \`[3]\`) and instruct the model to attach inline citations immediately after every factual assertion. If zero chunks pass the similarity gate, the assistant should explicitly state that the repository lacks supporting evidence.`,
  },
  {
    id: "curated-distributed-resilience",
    filename: "distributed-resilience-patterns.md",
    title: "Distributed Systems Resilience & Fault Isolation",
    content: `# Distributed Systems Resilience & Fault Isolation

Modern microservice topologies amplify partial failures: a single slow downstream dependency can exhaust thread pools across upstream callers within seconds unless strict isolation and backpressure boundaries are enforced.

## Circuit Breakers and Half-Open Probing

A circuit breaker wraps remote calls in a finite state machine with three states: Closed, Open, and Half-Open. In the Closed state, requests flow normally while a rolling sliding window tracks error rates and slow-call percentages (calls exceeding the p99 latency SLA).

Once failures cross the trip threshold—for example, 50% error rate across a minimum of 20 requests in a 10-second window—the breaker transitions to Open and immediately fails fast without touching the network. After a cooldown period (typically 15 to 30 seconds), the breaker moves to Half-Open and permits a small fixed probe budget (e.g., 3 concurrent test requests). If all probes succeed, the circuit closes; any failure re-opens the timer.

## Exponential Backoff with Full Jitter

Retrying failed idempotent requests immediately causes synchronized retry storms ("thundering herds") that keep struggling services pinned at 100% saturation. Always combine exponential backoff with randomized jitter:

\`\`\`
sleep_ms = random_between(0, min(cap_ms, base_ms * 2 ^ attempt))
\`\`\`

Full jitter spreads retry arrivals uniformly across the interval, reducing peak downstream concurrency by more than 60% compared to deterministic exponential backoff. Never retry non-idempotent mutations unless the server verifies a client-supplied \`Idempotency-Key\` header backed by an atomic deduplication log.

## Bulkheads and Adaptive Concurrency Limits

Inspired by watertight ship compartments, bulkhead isolation partitions caller pools (threads, semaphores, or connection pools) per downstream dependency. A degraded analytics endpoint consuming its 8-connection bulkhead cannot starve the 32-connection checkout pool.

Static concurrency limits struggle when service capacity shifts during autoscaling or noisy-neighbor events. Adaptive concurrency limiters (such as Vegas or Gradient2 algorithms) continuously compare observed min-RTT against current RTT and dynamically tighten the in-flight request ceiling whenever queuing delay grows.`,
  },
  {
    id: "curated-api-gateway-rate-limiting",
    filename: "api-gateway-rate-limiting.md",
    title: "API Gateway & Rate Limiting Architecture",
    content: `# API Gateway & Rate Limiting Architecture

Edge API gateways enforce authentication, TLS termination, request routing, and multi-tenant traffic shaping before requests reach compute-heavy application tiers.

## Comparing Token Bucket, Leaky Bucket, and Sliding Window

Selecting a rate-limiting algorithm requires matching traffic burstiness to downstream capacity:

- **Token Bucket**: Tokens refill at a steady rate \`r\` up to bucket capacity \`b\`. Requests consume one token; if the bucket is empty, the request is rejected. Token Bucket is ideal for interactive APIs because it naturally absorbs brief legitimate client bursts up to \`b\` while capping sustained average throughput at \`r\`.
- **Leaky Bucket**: Requests enter a bounded FIFO queue drained at a strictly constant rate. It smooths traffic into perfectly uniform downstream intervals, making it optimal for protecting legacy databases or payment processors sensitive to micro-bursts, at the cost of added queuing latency.
- **Sliding Window Counter**: Approximates a true sliding window by weighting the previous fixed window's count by the overlap percentage plus the current window's count. It eliminates the boundary-spike flaw of Fixed Window Counters (where a client can send 2x quota across a minute boundary) while using only two integer keys per tenant.

## Distributed Atomic Counters and Fail-Open Trade-Offs

In multi-region or horizontally scaled gateway fleets, local in-memory counters diverge under round-robin load balancing. Centralize quota state in Redis using single-round-trip Lua scripts that atomically compute refill deltas, decrement tokens, and set key TTLs in one execution step.

Always define an explicit failure posture if the Redis quota cluster becomes unreachable: customer-facing read endpoints typically **fail open** (allowing traffic with local fallback rate caps and emitting a high-priority alert), whereas expensive LLM inference or billing endpoints **fail closed** or fall back to strict per-node static limits.

## Standard Backpressure Headers

Rejected requests must return \`HTTP 429 Too Many Requests\` along with standard \`RateLimit-Limit\`, \`RateLimit-Remaining\`, \`RateLimit-Reset\`, and \`Retry-After\` headers so compliant SDKs pause deterministically instead of spinning in tight retry loops.`,
  },
  {
    id: "curated-llm-inference-quantization",
    filename: "llm-inference-quantization.md",
    title: "LLM Inference Optimization, KV Caching & Quantization",
    content: `# LLM Inference Optimization, KV Caching & Quantization

Serving large language models in production requires balancing two competing latency metrics: Time To First Token (TTFT) and Inter-Token Latency (ITL), while maximizing GPU HBM memory bandwidth utilization.

## Prefill vs. Decode Phase Bottlenecks

Autoregressive transformer inference operates in two sharply distinct phases:
1. **Prefill Phase**: Processes all prompt tokens in parallel through matrix-matrix multiplications. Prefill is **compute-bound**, dominating TTFT—especially on long RAG prompts with thousands of context tokens.
2. **Decode Phase**: Generates one output token per forward step, reading all model weights and accumulated Key-Value (KV) cache tensors from GPU memory for each token. Decode is strictly **memory-bandwidth-bound**.

Because decode underutilizes tensor cores at batch size 1, serving engines use **continuous (iteration-level) batching**: completed sequences leave the batch immediately and newly arrived requests enter on the very next decode step rather than waiting for the slowest sequence in a static batch.

## PagedAttention and Prefix Caching

Contiguous pre-allocation of KV cache buffers wastes 60% to 80% of GPU VRAM due to internal fragmentation and unknown output lengths. **PagedAttention** partitions each sequence's KV cache into fixed-size non-contiguous blocks (typically 16 tokens per block) mapped via a lightweight block table, enabling near-zero waste and copy-on-write sharing across beam search or shared system prompts.

Automatic **prefix caching** hashes system instructions and static RAG document headers so repeated queries skip redundant prefill computation, cutting TTFT by up to 70% on repetitive agentic workflows.

## Quantization Trade-Offs (FP8, INT8, AWQ INT4)

Weight and activation quantization shrinks memory footprint and accelerates bandwidth-bound decoding:
- **FP8 (E4M3)**: Near-lossless perplexity on modern Hopper/Blackwell GPUs with native hardware acceleration, halving weight memory compared to BF16.
- **INT8 (W8A8 / SmoothQuant)**: Smooths activation outliers into weights, achieving ~1.7x throughput gains with under 0.5% accuracy drift on reasoning benchmarks.
- **INT4 (AWQ / GPTQ)**: Compresses weights 4x by protecting the top 1% salient weight channels in higher precision. Ideal for single-GPU deployments, though complex multi-hop coding tasks should validate perplexity carefully before shipping 4-bit weights.`,
  },
  {
    id: "curated-observability-slo-design",
    filename: "observability-slo-error-budgets.md",
    title: "Production Observability, OpenTelemetry & SLO Design",
    content: `# Production Observability, OpenTelemetry & SLO Design

Effective observability turns opaque production anomalies into deterministic root causes by correlating structured logs, high-resolution metrics, and distributed traces under a single W3C TraceContext correlation ID.

## OpenTelemetry Propagation and Tail-Based Sampling

Every ingress gateway must inject or preserve \`traceparent\` and \`tracestate\` headers across HTTP, gRPC, and async message queues (Kafka, Pub/Sub). Head-based sampling (deciding at ingress to keep 1% of traces) inevitably drops rare latency outliers or intermittent 5xx failures.

Deploy **tail-based sampling** in an OpenTelemetry Collector tier: buffer trace spans in memory for 15 to 30 seconds until the trace completes, then retain 100% of traces containing error status codes or p99 latency violations while downsampling healthy baseline traffic to 1%.

## Avoiding High-Cardinality Metric Explosions

Time-series metric backends index every unique combination of label key-value pairs as a distinct active series. Attaching unbounded identifiers—such as \`user_id\`, \`request_id\`, \`pod_ip\`, or raw URL paths with UUIDs—to Prometheus counters triggers cardinality explosions and OOM crashes in metric scrapers.

Keep metric labels strictly bounded (HTTP method, route template like \`/api/documents/:id\`, status class \`2xx/4xx/5xx\`, deployment region) and move high-cardinality debugging attributes exclusively into structured trace span attributes and indexed log events.

## Multi-Window Multi-Burn-Rate SLO Alerting

Static threshold alerts (e.g., "page if CPU > 80%") cause alert fatigue without measuring user impact. Define Service Level Objectives (SLOs) over rolling 28-day windows using availability and latency Service Level Indicators (SLIs)—for example, 99.9% of \`/api/chat\` requests complete within 2,500ms without 5xx errors (a 43.2-minute monthly error budget).

Use **multi-window, multi-burn-rate alerts**:
- **Page immediately** when a 14.4x burn rate consumes 2% of the 28-day error budget across both a 1-hour and a 5-minute confirmation window (preventing stale alerts after brief blips recover).
- **Create a ticket** when a slower 3x burn rate persists over 6 hours and 30 minutes, signaling gradual degradation before the error budget is exhausted.`,
  },
];
