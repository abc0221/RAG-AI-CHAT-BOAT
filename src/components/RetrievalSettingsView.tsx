import type { RetrievalConfig } from "../types/rag";

interface RetrievalSettingsViewProps {
  config: RetrievalConfig;
  onChangeConfig: (next: RetrievalConfig) => void;
  totalDocuments: number;
  selectedDocuments: number;
  totalChunks: number;
  embeddedChunks: number;
  embeddingModel: string;
  generationModel: string;
}

export function RetrievalSettingsView({
  config,
  onChangeConfig,
  totalDocuments,
  selectedDocuments,
  totalChunks,
  embeddedChunks,
  embeddingModel,
  generationModel,
}: RetrievalSettingsViewProps) {
  return (
    <div className="flex-1 overflow-y-auto bg-[#F8FAFC] px-6 lg:px-10 py-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-900">
            Retrieval &amp; Vector Store Settings
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Configure similarity ranking parameters and inspect the active persistent vector index.
          </p>
        </div>

        {/* Ranking Parameters */}
        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
          <div className="pb-4 border-b border-slate-100">
            <h2 className="font-display text-base font-semibold text-slate-900">
              Query Retrieval Parameters
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Changes apply immediately to subsequent questions in the Assistant workspace.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="topk-slider" className="text-sm font-medium text-slate-800">
                Top-K Retrieved Chunks
              </label>
              <span className="font-mono text-sm font-semibold text-blue-700 tabular-nums">
                {config.topK} chunks
              </span>
            </div>
            <input
              id="topk-slider"
              type="range"
              min={2}
              max={10}
              step={1}
              value={config.topK}
              onChange={(e) =>
                onChangeConfig({ ...config, topK: Number(e.target.value) })
              }
              className="w-full accent-blue-600"
            />
            <p className="text-xs text-slate-500">
              Controls how many highest-scoring passages are passed to the synthesis model per turn.
            </p>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <label htmlFor="sim-slider" className="text-sm font-medium text-slate-800">
                Minimum Cosine Similarity Gate
              </label>
              <span className="font-mono text-sm font-semibold text-blue-700 tabular-nums">
                {(config.minSimilarity * 100).toFixed(0)}%
              </span>
            </div>
            <input
              id="sim-slider"
              type="range"
              min={0.15}
              max={0.75}
              step={0.05}
              value={config.minSimilarity}
              onChange={(e) =>
                onChangeConfig({ ...config, minSimilarity: Number(e.target.value) })
              }
              className="w-full accent-blue-600"
            />
            <p className="text-xs text-slate-500">
              Passages scoring below this threshold are filtered out to prevent off-topic grounding.
            </p>
          </div>
        </section>

        {/* Vector Index Diagnostics */}
        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="pb-3 border-b border-slate-100">
            <h2 className="font-display text-base font-semibold text-slate-900">
              Persistent Vector Index Summary
            </h2>
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="py-2 border-b border-slate-100">
              <dt className="text-xs text-slate-500">Indexed Documents</dt>
              <dd className="font-mono font-medium text-slate-900 mt-1 tabular-nums">
                {totalDocuments} total ({selectedDocuments} active in scope)
              </dd>
            </div>
            <div className="py-2 border-b border-slate-100">
              <dt className="text-xs text-slate-500">Vector Chunk Coverage</dt>
              <dd className="font-mono font-medium text-slate-900 mt-1 tabular-nums">
                {embeddedChunks} / {totalChunks} chunks embedded
              </dd>
            </div>
            <div className="py-2 border-b border-slate-100 sm:border-b-0">
              <dt className="text-xs text-slate-500">Embedding Model</dt>
              <dd className="font-mono text-xs text-slate-800 mt-1">
                {embeddingModel}
              </dd>
            </div>
            <div className="py-2">
              <dt className="text-xs text-slate-500">Synthesis Model</dt>
              <dd className="font-mono text-xs text-slate-800 mt-1">
                {generationModel}
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}
