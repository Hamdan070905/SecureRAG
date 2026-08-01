export interface EvidencePage {
  doc: string
  page: number
  preview: string   // relative image path served via /api/images/
  file_path?: string
}

export interface ImageChunkEvidence {
  doc: string
  page: number
  image_path: string
  caption: string
  confidence: number
  file_path?: string
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  confidence?: number
  sources?: string[]
  sourceChunks?: SourceChunk[]
  images?: string[]
  evidencePages?: EvidencePage[]
  imageChunks?: ImageChunkEvidence[]
  blocked?: boolean
  timestamp: Date
  citations?: { n: number; doc: string; page: number }[]
  low_confidence?: boolean
}

export interface ChatSession {
  id: string
  title: string
  messages: Message[]
}

export interface SourceChunk {
  doc: string
  chunk: number
  page?: number
  relevance: number
}

export interface Document {
  name: string
  chunks: number
  words: number
  chars: number
  collection?: string
  summary?: string | null
  suggested_questions?: string[]
  duplicate_of?: string | null
}

export interface AnalyticsData {
  total: number
  safe: number
  blocked: number
  avg_confidence: number
  avg_response_ms?: number
  documents?: number
  chunks?: number
  words?: number
  hourly_activity?: { hour: string; queries: number }[]
}

export interface LogEntry {
  timestamp: string
  query: string
  security_passed: boolean
  security_message: string
  document?: string
  confidence: number
  answer_preview?: string
  blocked: boolean
  response_time_ms?: number
}

export interface InsightsData {
  entities: { name: string; mentions: number }[]
  timeline: { date: string; doc_name: string; page: number; context: string }[]
  knowledge_graph: {
    nodes: { id: string; weight: number }[]
    edges: { source: string; target: string; weight: number }[]
  }
}

export type Page = 'dashboard' | 'chat' | 'knowledge' | 'analytics' | 'security' | 'architecture' | 'settings'
