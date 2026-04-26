import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { FileText, Plus, ChevronRight, Filter, Upload, Download, CheckCircle, AlertCircle, X } from "lucide-react";
import { getTranscripts, getCategories, uploadTranscriptsCsv } from "../api/client";
import { formatDistanceToNow } from "date-fns";

const CSV_TEMPLATE_HEADERS = "title,content,caller_name,agent_name,call_date,category";
const CSV_TEMPLATE_EXAMPLE =
  `"WiFi dropping issue","Agent: Thank you for calling...\nCaller: My WiFi keeps dropping","Jane Smith","Tom Lee","2024-11-01","Connectivity"`;

function downloadTemplate() {
  const blob = new Blob([CSV_TEMPLATE_HEADERS + "\n" + CSV_TEMPLATE_EXAMPLE], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "transcripts_template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function TranscriptsPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [uploadResult, setUploadResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: uploadTranscriptsCsv,
    onSuccess: (data) => {
      setUploadResult(data);
      queryClient.invalidateQueries({ queryKey: ["transcripts"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });

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
        <div className="flex items-center gap-2">
          <button
            onClick={downloadTemplate}
            className="btn-secondary flex items-center gap-2 text-sm py-1.5"
          >
            <Download size={15} />
            CSV Template
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadMutation.isPending}
            className="btn-secondary flex items-center gap-2 text-sm py-1.5"
          >
            <Upload size={15} />
            {uploadMutation.isPending ? "Uploading…" : "Upload CSV"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                setUploadResult(null);
                uploadMutation.mutate(f);
              }
              e.target.value = "";
            }}
          />
          <Link to="/transcripts/new" className="btn-primary flex items-center gap-2 text-sm py-1.5">
            <Plus size={16} />
            Add Transcript
          </Link>
        </div>
      </div>

      {/* Upload result */}
      {uploadResult && (
        <div className={`flex items-start gap-3 p-4 rounded-xl border text-sm ${
          uploadMutation.isError
            ? "bg-red-50 border-red-200 text-red-700"
            : "bg-green-50 border-green-200 text-green-800"
        }`}>
          <CheckCircle size={16} className="mt-0.5 shrink-0" />
          <div className="flex-1">
            <span className="font-medium">{uploadResult.created} transcript{uploadResult.created !== 1 ? "s" : ""} imported</span>
            {uploadResult.skipped > 0 && <span className="text-gray-500 ml-2">({uploadResult.skipped} skipped)</span>}
            {uploadResult.errors.length > 0 && (
              <ul className="mt-1 text-xs text-gray-500 space-y-0.5">
                {uploadResult.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            )}
          </div>
          <button onClick={() => setUploadResult(null)}><X size={14} /></button>
        </div>
      )}

      {uploadMutation.isError && !uploadResult && (
        <div className="flex items-center gap-2 p-3 rounded-xl border bg-red-50 border-red-200 text-red-700 text-sm">
          <AlertCircle size={15} />
          Upload failed — check that the file is a valid CSV with title and content columns.
        </div>
      )}

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
