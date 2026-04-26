import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { getTranscript, createTranscript, updateTranscript, getCategories } from "../api/client";
import type { TranscriptCreate } from "../types";

const EMPTY: TranscriptCreate = {
  title: "",
  content: "",
  caller_name: "",
  agent_name: "",
  call_date: "",
  category: "",
};

export default function TranscriptFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = !!id;

  const [form, setForm] = useState<TranscriptCreate>(EMPTY);
  const [customCategory, setCustomCategory] = useState("");
  const [useCustom, setUseCustom] = useState(false);

  const { data: existing } = useQuery({
    queryKey: ["transcript", id],
    queryFn: () => getTranscript(Number(id)),
    enabled: isEdit,
  });

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: getCategories,
  });

  useEffect(() => {
    if (existing) {
      setForm({
        title: existing.title,
        content: existing.content,
        caller_name: existing.caller_name ?? "",
        agent_name: existing.agent_name ?? "",
        call_date: existing.call_date ? existing.call_date.slice(0, 10) : "",
        category: existing.category ?? "",
      });
    }
  }, [existing]);

  const saveMutation = useMutation({
    mutationFn: (data: TranscriptCreate) =>
      isEdit ? updateTranscript(Number(id), data) : createTranscript(data),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["transcripts"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      if (isEdit) queryClient.invalidateQueries({ queryKey: ["transcript", id] });
      navigate(`/transcripts/${saved.id}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const category = useCustom ? customCategory : form.category;
    saveMutation.mutate({ ...form, category: category || undefined });
  };

  const field = (key: keyof TranscriptCreate) => (
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }))
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to={isEdit ? `/transcripts/${id}` : "/transcripts"}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft size={14} />
          {isEdit ? "Transcript" : "Transcripts"}
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm font-medium text-gray-700">
          {isEdit ? "Edit" : "Add Transcript"}
        </span>
      </div>

      <div className="card p-6">
        <h1 className="text-xl font-bold text-gray-900 mb-6">
          {isEdit ? "Edit Transcript" : "Add New Transcript"}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.title}
              onChange={field("title")}
              required
              placeholder="e.g. WiFi connectivity issue — dropped calls"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
            />
          </div>

          {/* Metadata row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Caller Name</label>
              <input
                type="text"
                value={form.caller_name}
                onChange={field("caller_name")}
                placeholder="John Doe"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Agent Name</label>
              <input
                type="text"
                value={form.agent_name}
                onChange={field("agent_name")}
                placeholder="Support Agent"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Call Date</label>
              <input
                type="date"
                value={form.call_date}
                onChange={field("call_date")}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              {useCustom ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    placeholder="New category"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => { setUseCustom(false); setCustomCategory(""); }}
                    className="text-xs text-gray-500 hover:text-gray-800 px-2"
                  >
                    ↩
                  </button>
                </div>
              ) : (
                <select
                  value={form.category}
                  onChange={(e) => {
                    if (e.target.value === "__new__") {
                      setUseCustom(true);
                      setForm((f) => ({ ...f, category: "" }));
                    } else {
                      field("category")(e);
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm bg-white"
                >
                  <option value="">No category</option>
                  {categories?.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                  <option value="__new__">+ New category…</option>
                </select>
              )}
            </div>
          </div>

          {/* Content */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Transcript Content <span className="text-red-500">*</span>
            </label>
            <textarea
              value={form.content}
              onChange={field("content")}
              required
              rows={16}
              placeholder={"Agent: Thank you for calling tech support, how can I help?\nCaller: My WiFi keeps dropping every few minutes…"}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm font-mono resize-y"
            />
          </div>

          {/* Error */}
          {saveMutation.isError && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
              <AlertCircle size={15} />
              Failed to save transcript. Please try again.
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Link
              to={isEdit ? `/transcripts/${id}` : "/transcripts"}
              className="btn-secondary text-sm"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saveMutation.isPending || !form.title.trim() || !form.content.trim()}
              className="btn-primary text-sm"
            >
              {saveMutation.isPending
                ? isEdit ? "Saving…" : "Adding…"
                : isEdit ? "Save Changes" : "Add Transcript"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
