import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Search,
  ThumbsUp,
  ThumbsDown,
  Brain,
  Sparkles,
  AlertCircle,
  Clock,
  ChevronRight,
} from "lucide-react";
import { search, submitFeedback, getSearchHistory, getKnowledgeStats } from "../api/client";
import type { SearchResponse } from "../types";
import { formatDistanceToNow } from "date-fns";

function ConfidenceBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color =
    score >= 0.8
      ? "bg-green-100 text-green-800"
      : score >= 0.5
      ? "bg-yellow-100 text-yellow-800"
      : "bg-gray-100 text-gray-600";
  return (
    <span className={`badge ${color}`}>{pct}% confidence</span>
  );
}

function AIAnswerPanel({
  result,
  onFeedback,
  feedbackGiven,
}: {
  result: SearchResponse;
  onFeedback: (helpful: boolean) => void;
  feedbackGiven: boolean;
}) {
  return (
    <div
      className={`card p-5 border-2 ${
        result.from_knowledge_base
          ? "border-purple-200 bg-purple-50"
          : "border-blue-100 bg-blue-50"
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          {result.from_knowledge_base ? (
            <Brain size={18} className="text-purple-600 shrink-0" />
          ) : (
            <Sparkles size={18} className="text-blue-600 shrink-0" />
          )}
          <span className="font-semibold text-sm text-gray-700">
            {result.from_knowledge_base
              ? "Answer from Knowledge Base"
              : "AI-Generated Answer"}
          </span>
          {result.is_recurring && (
            <span className="badge bg-orange-100 text-orange-700">Recurring issue</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ConfidenceBadge score={result.confidence} />
        </div>
      </div>

      <p className="text-gray-800 leading-relaxed whitespace-pre-wrap text-sm">
        {result.ai_answer}
      </p>

      {result.source_transcript_ids.length > 0 && (
        <p className="mt-2 text-xs text-gray-500">
          Based on transcripts:{" "}
          {result.source_transcript_ids.map((id, i) => (
            <span key={id}>
              <Link to={`/transcripts/${id}`} className="text-blue-600 hover:underline">
                #{id}
              </Link>
              {i < result.source_transcript_ids.length - 1 && ", "}
            </span>
          ))}
        </p>
      )}

      {/* Feedback */}
      <div className="mt-4 pt-3 border-t border-current border-opacity-20 flex items-center gap-3">
        <span className="text-xs text-gray-500 mr-1">Was this helpful?</span>
        {feedbackGiven ? (
          <span className="text-xs text-gray-500 italic">Thanks for your feedback!</span>
        ) : (
          <>
            <button
              onClick={() => onFeedback(true)}
              className="flex items-center gap-1 text-xs px-3 py-1 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
            >
              <ThumbsUp size={13} /> Yes
            </button>
            <button
              onClick={() => onFeedback(false)}
              className="flex items-center gap-1 text-xs px-3 py-1 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
            >
              <ThumbsDown size={13} /> No
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [activeResult, setActiveResult] = useState<SearchResponse | null>(null);
  const [feedbackGiven, setFeedbackGiven] = useState(false);
  const queryClient = useQueryClient();

  const searchMutation = useMutation({
    mutationFn: (q: string) => search(q),
    onSuccess: (data) => {
      setActiveResult(data);
      setFeedbackGiven(false);
      queryClient.invalidateQueries({ queryKey: ["searchHistory"] });
    },
  });

  const feedbackMutation = useMutation({
    mutationFn: (helpful: boolean) =>
      submitFeedback({ query_id: activeResult!.query_id, was_helpful: helpful }),
    onSuccess: () => {
      setFeedbackGiven(true);
      queryClient.invalidateQueries({ queryKey: ["knowledgeStats"] });
    },
  });

  const { data: history } = useQuery({
    queryKey: ["searchHistory"],
    queryFn: () => getSearchHistory(8),
  });

  const { data: stats } = useQuery({
    queryKey: ["knowledgeStats"],
    queryFn: getKnowledgeStats,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) searchMutation.mutate(query.trim());
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">
          Support Transcript Search
        </h1>
        <p className="text-gray-500">
          Search across all support call transcripts. AI learns from your feedback to improve over time.
        </p>
      </div>

      {/* Stats bar */}
      {stats && stats.total_entries > 0 && (
        <div className="flex items-center justify-center gap-6 text-sm text-gray-600">
          <span className="flex items-center gap-1.5">
            <Brain size={14} className="text-purple-500" />
            <strong>{stats.total_entries}</strong> learned solutions
          </span>
          <span className="text-gray-300">|</span>
          <span>
            <strong>{stats.high_confidence}</strong> high-confidence
          </span>
          <span className="text-gray-300">|</span>
          <span>
            <strong>{stats.total_uses}</strong> searches served
          </span>
        </div>
      )}

      {/* Search form */}
      <form onSubmit={handleSearch} className="flex gap-3">
        <div className="flex-1 relative">
          <Search
            size={18}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Describe the problem or search for keywords..."
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={!query.trim() || searchMutation.isPending}
          className="btn-primary px-6"
        >
          {searchMutation.isPending ? "Searching..." : "Search"}
        </button>
      </form>

      {/* Error */}
      {searchMutation.isError && (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
          <AlertCircle size={16} />
          Search failed. Make sure the ANTHROPIC_API_KEY is set and the backend is running.
        </div>
      )}

      {/* Results */}
      {activeResult && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Found <strong>{activeResult.results.length}</strong> transcripts for "
            <em>{activeResult.query}</em>"
          </p>

          {/* AI Answer */}
          <AIAnswerPanel
            result={activeResult}
            onFeedback={(helpful) => feedbackMutation.mutate(helpful)}
            feedbackGiven={feedbackGiven}
          />

          {/* Transcript results */}
          {activeResult.results.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-700 text-sm">Relevant Transcripts</h3>
              {activeResult.results.map((r) => (
                <Link
                  key={r.transcript_id}
                  to={`/transcripts/${r.transcript_id}`}
                  className="card p-4 block hover:border-blue-300 transition-colors group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-gray-900 group-hover:text-blue-700 truncate">
                          {r.title}
                        </h4>
                        {activeResult.source_transcript_ids.includes(r.transcript_id) && (
                          <span className="badge bg-blue-100 text-blue-700 shrink-0">Used by AI</span>
                        )}
                        {r.category && (
                          <span className="badge bg-gray-100 text-gray-600 shrink-0">
                            {r.category}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2">{r.snippet}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 text-gray-400">
                      <span className="text-xs">score: {r.relevance_score}</span>
                      <ChevronRight size={16} className="group-hover:text-blue-500" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Recent searches (shown when no active result) */}
      {!activeResult && history && history.length > 0 && (
        <div className="space-y-3">
          <h3 className="flex items-center gap-2 font-semibold text-gray-700 text-sm">
            <Clock size={14} /> Recent Searches
          </h3>
          <div className="space-y-2">
            {history.map((h) => (
              <button
                key={h.id}
                onClick={() => {
                  setQuery(h.query_text);
                  searchMutation.mutate(h.query_text);
                }}
                className="w-full text-left px-4 py-3 card hover:border-blue-300 transition-colors flex items-center justify-between group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {h.knowledge_entry_used ? (
                    <Brain size={14} className="text-purple-500 shrink-0" />
                  ) : (
                    <Search size={14} className="text-gray-400 shrink-0" />
                  )}
                  <span className="text-sm text-gray-700 truncate">{h.query_text}</span>
                </div>
                <span className="text-xs text-gray-400 shrink-0 ml-3">
                  {formatDistanceToNow(new Date(h.created_at), { addSuffix: true })}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!activeResult && (!history || history.length === 0) && (
        <div className="text-center py-16 text-gray-400 space-y-2">
          <Search size={40} className="mx-auto opacity-30" />
          <p className="text-sm">Enter a query to search transcripts</p>
          <p className="text-xs">Try: "WiFi dropping" or "printer offline" or "authentication locked"</p>
        </div>
      )}
    </div>
  );
}
