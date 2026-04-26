import axios from "axios";
import { supabase } from "../lib/supabase";
import type {
  KnowledgeEntry,
  KnowledgeStats,
  SearchHistoryItem,
  SearchResponse,
  Transcript,
  TranscriptCreate,
} from "../types";

const baseURL = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : "/api";

const api = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use(async (config) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Transcripts
export const getTranscripts = async (params?: { category?: string; skip?: number; limit?: number }) =>
  api.get<Transcript[]>("/transcripts/", { params }).then((r) => r.data);

export const getTranscript = async (id: number) =>
  api.get<Transcript>(`/transcripts/${id}`).then((r) => r.data);

export const createTranscript = async (data: TranscriptCreate) =>
  api.post<Transcript>("/transcripts/", data).then((r) => r.data);

export const updateTranscript = async (id: number, data: TranscriptCreate) =>
  api.put<Transcript>(`/transcripts/${id}`, data).then((r) => r.data);

export const deleteTranscript = async (id: number) =>
  api.delete(`/transcripts/${id}`);

export const getCategories = async () =>
  api.get<string[]>("/transcripts/categories/list").then((r) => r.data);

// Search
export const search = async (query: string, limit = 10) =>
  api.post<SearchResponse>("/search/", { query, limit }).then((r) => r.data);

export const getSearchHistory = async (limit = 20) =>
  api.get<SearchHistoryItem[]>("/search/history", { params: { limit } }).then((r) => r.data);

export const getKnowledgeStats = async () =>
  api.get<KnowledgeStats>("/search/knowledge/stats").then((r) => r.data);

export const getKnowledgeEntries = async () =>
  api.get<KnowledgeEntry[]>("/search/knowledge/entries").then((r) => r.data);

export const uploadTranscriptsCsv = async (file: File) => {
  const form = new FormData();
  form.append("file", file);
  return api.post<{ created: number; skipped: number; errors: string[] }>(
    "/transcripts/upload-csv",
    form,
    { headers: { "Content-Type": "multipart/form-data" } }
  ).then((r) => r.data);
};

// Feedback
export const submitFeedback = async (params: {
  query_id: number;
  was_helpful: boolean;
  transcript_id?: number;
}) => api.post("/feedback/", params).then((r) => r.data);
