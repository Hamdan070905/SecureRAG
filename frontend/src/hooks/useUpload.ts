import { useState } from "react";
import { api } from "../services/api";

export interface UploadResult {
  name: string;
  status: "ok" | "error";
  chunks?: number;
  words?: number;
  message?: string;
  duplicate_of?: string;
  warning?: string;
  summary?: string;
  suggested_questions?: string[];
}

export function useUpload(onUploaded?: () => void) {
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<UploadResult[]>([]);
  const [progress, setProgress] = useState(0);

  const uploadFiles = async (files: File[], collection = "General", ocrQuality = "medium") => {
    if (!files.length) return;

    setUploading(true);
    setProgress(0);

    try {
      const { results: newResults } = await api.upload(files, collection, (pct) => setProgress(pct), ocrQuality);
      setResults(prev => [...prev, ...newResults]);

      if (onUploaded) {
        onUploaded();
      }
    } catch (e: any) {
      setResults([
        {
          name: "Upload",
          status: "error",
          message: e.message,
        },
      ]);
    } finally {
      setUploading(false);
    }
  };

  return {
    uploading,
    results,
    uploadFiles,
    progress,
  };
}