import axios from 'axios'

const BASE = 'http://127.0.0.1:8000'
const http = axios.create({ baseURL: BASE })

export const api = {
  health: () => http.get('/health').then(r => r.data),

  upload: async (files: File[], collection = 'General', onProgress?: (pct: number) => void, ocrQuality = 'medium') => {
    const fd = new FormData()
    files.forEach(f => fd.append('files', f))
    fd.append('collection', collection)
    fd.append('ocr_quality', ocrQuality)
    const res = await http.post('/upload', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => onProgress?.(Math.round((e.loaded * 100) / (e.total || 1)) / 2),
    }).then(r => r.data)

    if (res.job_id) {
      let job = res;
      while (job.status === 'processing') {
        await new Promise(r => setTimeout(r, 1000));
        job = await http.get(`/upload_status/${res.job_id}`).then(r => r.data);
        if (onProgress && job.progress !== undefined) {
          onProgress(50 + (job.progress / 2));
        }
      }
      return { results: job.results };
    }
    return res;
  },

  deleteDocument: (name: string) => http.delete(`/documents/${encodeURIComponent(name)}`).then(r => r.data),

  action: (action: string, doc_filter: string | string[] = 'All Documents', language = 'Spanish', signal?: AbortSignal) =>
    http.post('/action', { action, doc_filter, language }, { signal }).then(r => r.data),

  getDocuments: () => http.get('/documents').then(r => r.data),
  deleteDocuments: () => http.delete('/documents').then(r => r.data),

  query: (query: string, doc_filter: string | string[] = 'All Documents', answer_mode = 'detailed', signal?: AbortSignal) =>
    http.post('/query', { query, doc_filter, answer_mode }, { signal }).then(r => r.data),

  queryStream: async (query: string, doc_filter: string | string[], answer_mode: string, onToken: (t: string) => void, signal?: AbortSignal) => {
    const res = await fetch('http://127.0.0.1:8000/query/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, doc_filter, answer_mode }),
      signal,
    })
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      onToken(decoder.decode(value))
    }
  },

  transcribe: (blob: Blob) => {
    const fd = new FormData()
    fd.append('file', blob, 'audio.wav')
    return http.post('/transcribe', fd).then(r => r.data)
  },

  analytics: () => http.get('/analytics').then(r => r.data),
  logs: () => http.get('/logs').then(r => r.data),
  provider: () => http.get('/provider').then(r => r.data),
  updateProvider: (provider: string, model: string, apiKey?: string) =>
    http.post('/provider', { provider, model, apiKey }).then(r => r.data),
  graphBuild: (doc_filter?: string) => http.get('/graph/build', { params: { doc_filter } }).then(r => r.data),
  graphQuery: (entity: string) => http.get('/graph/query', { params: { entity } }).then(r => r.data),
}


