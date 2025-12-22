export interface ExpertProfile {
  id: string;
  name: string;
  role: string;
  description: string;
  systemInstruction: string;
  model: string;
  type: 'text' | 'image' | 'video';
  tools?: ('googleSearch')[];
}

export interface WorkerResult {
  expert: ExpertProfile;
  content: string;
  images?: string[]; // Array of base64 strings
  videoUri?: string; // Base64 data URI for video
  status: 'pending' | 'success' | 'error';
  executionTime?: number;
  groundingUrls?: { title: string; uri: string }[];
  requiresKeySelection?: boolean;
}

export interface FileAttachment {
  name: string;
  mimeType: string;
  data: string; // Base64 string without prefix
}

export interface ChatTurn {
  id: string;
  userPrompt: string;
  attachments: FileAttachment[];
  step: 'routing' | 'gathering' | 'judging' | 'complete' | 'error';
  selectedExperts: ExpertProfile[];
  workerResults: WorkerResult[];
  consensusContent: string;
  error?: string;
  timestamp: number;
}

export type StreamChunkHandler = (chunk: string) => void;