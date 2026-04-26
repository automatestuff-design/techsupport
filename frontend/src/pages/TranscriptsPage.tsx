import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { FileText, Plus, ChevronRight, Filter } from "lucide-react";
import { getTranscripts, getCategories } from "../api/client";
import { formatDistanceToNow } from "date-fns";

export default function TranscriptsPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>("");

  const { data: transcripts, isLoading } = useQuery({
    queryKey: ["transcripts", selectedCategory],
    queryFn: () => getTranscripts({ category: selectedCategory || undefined, limit: 100 }),
  });

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: getCategories,
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Transcripts</h1>
          <p className="text-sm text-gray-500 mt-1">
            {transcripts ? `${transcripts.length} transcript${transcripts.length !== 1 ? "s" : ""}` : "Loading…"}
            {selectedCategory && ` in "${selectedCategory}"`}
          </p>
        </div>
        <Link to="/transcripts/new" className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={16} />
          Add Transcript
        </Link>
      </div>

      {/* Category filter */}
      {categories && categories.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={14} className="text-gray-400" />
          <button
            onClick={() => setSelectedCategory("")}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              !selectedCategory
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat === selectedCategory ? "" : cat)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                selectedCategory === cat
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Loading transcripts…</div>
      ) : transcripts && transcripts.length > 0 ? (
        <div className="space-y-3">
          {transcripts.map((t) => (
            <Link
              key={t.id}
              to={`/transcripts/${t.id}`}
              className="card p-4 block hover:border-blue-300 transition-colors group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <FileText size={16} className="text-gray-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <h3 className="font-medium text-gray-900 group-hover:text-blue-700 truncate">
                      {t.title}
                    </h3>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                      {t.caller_name && <span>Caller: {t.caller_name}</span>}
                      {t.agent_name && <span>Agent: {t.agent_name}</span>}
                      {t.call_date && <span>{new Date(t.call_date).toLocaleDateString()}</span>}
                      <span>{formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}</span>
                    </div>
                    <p className="mt-1.5 text-sm text-gray-600 line-clamp-2">
                      {t.content.slice(0, 200)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {t.category && (
                    <span className="badge bg-gray-100 text-gray-600">{t.category}</span>
                  )}
                  <ChevronRight size={16} className="text-gray-400 group-hover:text-blue-500" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-gray-400 space-y-3">
          <FileText size={40} className="mx-auto opacity-30" />
          <p className="text-sm">No transcripts yet.</p>
          <Link to="/transcripts/new" className="btn-primary inline-flex items-center gap-2 text-sm">
            <Plus size={16} />
            Add the first transcript
          </Link>
        </div>
      )}
    </div>
  );
}
