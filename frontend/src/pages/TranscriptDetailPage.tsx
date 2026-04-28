import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  Edit,
  Trash2,
  User,
  Phone,
  Calendar,
  Tag,
  AlertCircle,
  FileText,
  ExternalLink,
} from "lucide-react";
import { getTranscript, deleteTranscript } from "../api/client";
import { format } from "date-fns";

export default function TranscriptDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: transcript, isLoading, isError } = useQuery({
    queryKey: ["transcript", id],
    queryFn: () => getTranscript(Number(id)),
    enabled: !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteTranscript(Number(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transcripts"] });
      navigate("/transcripts");
    },
  });

  const handleDelete = () => {
    if (window.confirm("Delete this transcript? This cannot be undone.")) {
      deleteMutation.mutate();
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto text-center py-16 text-gray-400 text-sm">
        Loading transcript…
      </div>
    );
  }

  if (isError || !transcript) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg p-4">
          <AlertCircle size={16} />
          Transcript not found or failed to load.
        </div>
        <Link to="/transcripts" className="mt-4 inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft size={14} /> Back to transcripts
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <Link
          to="/transcripts"
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft size={14} />
          Transcripts
        </Link>
        <div className="flex items-center gap-2">
          <Link
            to={`/transcripts/${transcript.id}/edit`}
            className="btn-secondary flex items-center gap-1.5 text-sm py-1.5"
          >
            <Edit size={14} />
            Edit
          </Link>
          <button
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            <Trash2 size={14} />
            {deleteMutation.isPending ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>

      {/* Header card */}
      <div className="card p-6 space-y-4">
        <h1 className="text-xl font-bold text-gray-900">{transcript.title}</h1>

        <div className="flex flex-wrap gap-4 text-sm text-gray-600">
          {transcript.caller_name && (
            <span className="flex items-center gap-1.5">
              <Phone size={13} className="text-gray-400" />
              <strong>Caller:</strong> {transcript.caller_name}
            </span>
          )}
          {transcript.agent_name && (
            <span className="flex items-center gap-1.5">
              <User size={13} className="text-gray-400" />
              <strong>Agent:</strong> {transcript.agent_name}
            </span>
          )}
          {transcript.call_date && (
            <span className="flex items-center gap-1.5">
              <Calendar size={13} className="text-gray-400" />
              {format(new Date(transcript.call_date), "PPP")}
            </span>
          )}
          {transcript.category && (
            <span className="flex items-center gap-1.5">
              <Tag size={13} className="text-gray-400" />
              <span className="badge bg-gray-100 text-gray-700">{transcript.category}</span>
            </span>
          )}
        </div>

        <p className="text-xs text-gray-400">
          Added {format(new Date(transcript.created_at), "PPP 'at' p")}
        </p>
      </div>

      {/* PDF viewer */}
      {transcript.source_file_url && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
              <FileText size={14} className="text-gray-400" />
              Original Document
            </h2>
            <a
              href={transcript.source_file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 transition-colors"
            >
              Open in new tab
              <ExternalLink size={11} />
            </a>
          </div>
          <iframe
            src={transcript.source_file_url}
            title="Original document"
            className="w-full rounded border border-gray-200"
            style={{ height: "700px" }}
          />
        </div>
      )}

      {/* Content */}
      <div className="card p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Transcript</h2>
        <pre className="whitespace-pre-wrap text-sm text-gray-800 leading-relaxed font-sans">
          {transcript.content}
        </pre>
      </div>
    </div>
  );
}
