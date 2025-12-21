export interface ExpertProfile {
  id: string;
  name: string;
  role: string;
  description: string;
  systemInstruction: string;
  model: string;
}

export interface WorkerResult {
  expert: ExpertProfile;
  content: string;
  status: 'pending' | 'success' | 'error';
  executionTime?: number;
}

export interface FileAttachment {
  name: string;
  mimeType: string;
  data: string; // Base64 string without prefix
}

export interface ConsensusState {
  isProcessing: boolean;
  step: 'idle' | 'routing' | 'gathering' | 'judging' | 'complete';
  userPrompt: string;
  selectedExperts: ExpertProfile[];
  workerResults: WorkerResult[];
  consensusContent: string;
  error?: string;
}

export type StreamChunkHandler = (chunk: string) => void;