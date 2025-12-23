
export interface ExpertProfile {
  id: string;
  name: string;
  role: string;
  description: string;
  systemInstruction: string;
  model: string;
  type: 'text' | 'image' | 'video' | 'action' | 'critic';
  tools?: ('googleSearch')[];
}

export interface UserPreferences {
  persona: string; // e.g. "Senior Engineer"
  style: string; // e.g. "Brief and code-heavy"
  technicalContext: string; // e.g. "Using AWS and Node.js"
  memoryEnabled: boolean;
}

export interface FramingProfile {
  domain: string;
  framingIntent: string;
  correctionTolerance: 'low' | 'medium' | 'high';
  authoritySource: string;
  audienceType: string;
}

export interface ActionDraft {
  type: 'email' | 'ticket' | 'message' | 'calendar';
  recipient?: string;
  subject?: string;
  body: string;
  platform?: string;
}

export interface WorkerResult {
  expert: ExpertProfile;
  content: string;
  images?: string[]; 
  videoUri?: string;
  status: 'pending' | 'success' | 'error';
  executionTime?: number;
  estimatedTokens?: number;
  groundingUrls?: { title: string; uri: string }[];
  requiresKeySelection?: boolean;
  actionDraft?: ActionDraft;
}

export interface FileAttachment {
  name: string;
  mimeType: string;
  data: string;
}

export interface ChatTurn {
  id: string;
  userPrompt: string;
  attachments: FileAttachment[];
  step: 'framing' | 'routing' | 'gathering' | 'judging' | 'criticizing' | 'complete' | 'error';
  framingProfile?: FramingProfile;
  selectedExperts: ExpertProfile[];
  workerResults: WorkerResult[];
  consensusContent: string;
  criticContent?: string;
  totalTokens?: number;
  error?: string;
  timestamp: number;
  preferencesAtTime?: UserPreferences;
}

export interface ChatSession {
  id: string;
  title: string;
  turns: ChatTurn[];
  updatedAt: number;
}

export type StreamChunkHandler = (chunk: string) => void;
