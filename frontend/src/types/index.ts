export interface Transcript {
  id: number;
  title: string;
  content: string;
  caller_name: string | null;
  agent_name: string | null;
  call_date: string | null;
  category: string | null;
  created_at: string;
}

export interface TranscriptCreate {
  title: string;
  content: string;
  caller_name?: string;
  agent_name?: string;
  call_date?: string;
  category?: string;
}

export interface SearchResult {
  transcript_id: number;
  title: string;
  snippet: string;
  category: string | null;
  call_date: string | null;
  relevance_score: number;
}

export interface SearchResponse {
  query_id: number;
  query: string;
  results: SearchResult[];
  ai_answer: string;
  confidence: number;
  from_knowledge_base: boolean;
  knowledge_entry_id: number | null;
  is_recurring: boolean;
  source_transcript_ids: number[];
}

export interface KnowledgeEntry {
  id: number;
  problem_pattern: string;
  solution_summary: string;
  confidence_score: number;
  use_count: number;
  helpful_count: number;
  source_transcript_ids: number[];
  created_at: string;
  updated_at: string;
}

export interface KnowledgeStats {
  total_entries: number;
  high_confidence: number;
  total_uses: number;
  avg_confidence: number;
}

export interface SearchHistoryItem {
  id: number;
  query_text: string;
  result_count: number;
  knowledge_entry_used: boolean;
  created_at: string;
}
