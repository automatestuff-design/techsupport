import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Brain, TrendingUp, Zap, CheckCircle, ChevronRight } from "lucide-react";
import { getKnowledgeEntries, getKnowledgeStats } from "../api/client";
import { formatDistanceToNow } from "date-fns";

function ConfidenceBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color =
    score >= 0.8 ? "bg-green-500" : score >= 0.5 ? "bg-yellow-400" : "bg-gray-300";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
        <div className={`${color} h-1.5 rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500 w-10 text-right">{pct}%</span>
    </div>
  );
}

export default function KnowledgePage() {
  const { data: entries, isLoading } = useQuery({
    queryKey: ["knowledgeEntries"],
    queryFn: getKnowledgeEntries,
  });

  const { data: stats } = useQuery({
    queryKey: ["knowledgeStats"],
    queryFn: getKnowledgeStats,
  });

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Brain size={24} className="text-purple-600" />
          Knowledge Base
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Solutions learned from past searches and user feedback.
        </p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="card p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{stats.total_entries}</div>
            <div className="text-xs text-gray-500 mt-0.5">Learned Solutions</div>
          </div>
          <div className="card p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{stats.high_confidence}</div>
            <div className="text-xs text-gray-500 mt-0.5">High Confidence</div>
          </div>
          <div className="card p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.total_uses}</div>
            <div className="text-xs text-gray-500 mt-0.5">Searches Served</div>
          </div>
          <div className="card p-4 text-center">
            <div className="text-2xl font-bold text-gray-700">
              {stats.total_entries > 0 ? Math.round(stats.avg_confidence * 100) : "—"}
              {stats.total_entries > 0 && <span className="text-base">%</span>}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">Avg Confidence</div>
          </div>
        </div>
      )}

      {/* How it works */}
      <div className="card p-5 bg-purple-50 border-purple-200">
        <h2 className="font-semibold text-purple-900 text-sm mb-3 flex items-center gap-2">
          <Zap size={14} />
          How the AI learns
        </h2>
        <ol className="space-y-1.5 text-xs text-purple-800">
          <li className="flex items-start gap-2">
            <span className="font-bold shrink-0">1.</span>
            A support agent searches for a problem — Claude reads the transcripts and synthesizes an answer.
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold shrink-0">2.</span>
            The agent rates the answer helpful or not. Each rating updates this knowledge base.
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold shrink-0">3.</span>
            Future similar queries are answered instantly from the knowledge base (shown in purple).
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold shrink-0">4.</span>
            Confidence rises with helpful votes and falls with unhelpful ones — so only reliable answers are reused.
          </li>
        </ol>
      </div>

      {/* Entries */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Loading knowledge base…</div>
      ) : entries && entries.length > 0 ? (
        <div className="space-y-4">
          <h2 className="font-semibold text-gray-700 flex items-center gap-2">
            <TrendingUp size={16} className="text-gray-400" />
            All Entries
            <span className="text-gray-400 font-normal text-sm">({entries.length})</span>
          </h2>
          <div className="space-y-3">
            {entries
              .sort((a, b) => b.confidence_score - a.confidence_score)
              .map((entry) => (
                <div key={entry.id} className="card p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {entry.confidence_score >= 0.8 && (
                          <CheckCircle size={14} className="text-green-500 shrink-0" />
                        )}
                        <h3 className="font-semibold text-gray-900 text-sm">
                          {entry.problem_pattern}
                        </h3>
                      </div>
                      <p className="text-sm text-gray-600 leading-relaxed">
                        {entry.solution_summary}
                      </p>
                    </div>
                  </div>

                  <ConfidenceBar score={entry.confidence_score} />

                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <div className="flex items-center gap-4">
                      <span>{entry.helpful_count} helpful / {entry.use_count} uses</span>
                      {entry.source_transcript_ids.length > 0 && (
                        <span className="flex items-center gap-1">
                          Sources:{" "}
                          {entry.source_transcript_ids.map((tid, i) => (
                            <span key={tid}>
                              <Link
                                to={`/transcripts/${tid}`}
                                className="text-blue-500 hover:underline"
                              >
                                #{tid}
                              </Link>
                              {i < entry.source_transcript_ids.length - 1 && ", "}
                            </span>
                          ))}
                        </span>
                      )}
                    </div>
                    <span>{formatDistanceToNow(new Date(entry.updated_at), { addSuffix: true })}</span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-16 text-gray-400 space-y-3">
          <Brain size={40} className="mx-auto opacity-30" />
          <p className="text-sm">No knowledge entries yet.</p>
          <p className="text-xs max-w-sm mx-auto">
            Search for a problem, get an AI answer, then rate it helpful — the system will learn from your feedback.
          </p>
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline">
            Go to Search <ChevronRight size={14} />
          </Link>
        </div>
      )}
    </div>
  );
}
