import { GoogleGenAI, Type } from "@google/genai";
import { ExpertProfile, WorkerResult, StreamChunkHandler, FileAttachment } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- 1. Expert Registry ---
// A list of simulated personas based on the user's requested tools and general categories.

const GENERAL_EXPERTS: ExpertProfile[] = [
  {
    id: 'gpt-4o',
    name: 'GPT-4o (Sim)',
    role: 'General Reasoning & Data Synthesis',
    description: 'Balanced, high-intelligence generalist.',
    systemInstruction: "You are GPT-4o. You are a versatile, highly intelligent assistant. Be concise, objective, and good at synthesizing data. Use markdown formatting.",
    model: 'gemini-3-flash-preview'
  },
  {
    id: 'claude-3-5',
    name: 'Claude 3.5 Sonnet (Sim)',
    role: 'Coding Logic & Nuanced Writing',
    description: 'Excellent at creative writing, tone, and complex logic.',
    systemInstruction: "You are Claude 3.5 Sonnet. You excel at nuanced writing, safety, and complex reasoning. Your tone is helpful and conversational but professional.",
    model: 'gemini-3-flash-preview'
  },
  {
    id: 'gemini-analytical',
    name: 'Gemini (Analytical)',
    role: 'Deep Analysis & Fact Checking',
    description: 'Focuses on facts, logic, and verifying information.',
    systemInstruction: "You are an analytical engine. Prioritize factual accuracy, logical consistency, and comprehensive breakdown of the topic.",
    model: 'gemini-3-flash-preview'
  }
];

const SPECIALIZED_EXPERTS: ExpertProfile[] = [
  // Coding
  {
    id: 'cursor',
    name: 'Cursor Agent',
    role: 'Full-Stack Coding & IDE Integration',
    description: 'Specializes in implementation details and file structure.',
    systemInstruction: "You are the Cursor AI Agent. Focus on providing complete, copy-pasteable code blocks. Suggest file structures. Be terse with text, verbose with code.",
    model: 'gemini-3-flash-preview'
  },
  {
    id: 'github-copilot',
    name: 'GitHub Copilot',
    role: 'Code Autocomplete & Boilerplate',
    description: 'Quick, standard code patterns and syntax help.',
    systemInstruction: "You are GitHub Copilot. Provide standard, efficient code snippets for the specific problem. Focus on syntax correctness and best practices.",
    model: 'gemini-3-flash-preview'
  },
  {
    id: 'qodo',
    name: 'Qodo (Codium)',
    role: 'Code Testing & Bug Detection',
    description: 'Focuses on edge cases, security, and test coverage.',
    systemInstruction: "You are Qodo. Analyze the request for potential bugs, edge cases, or security flaws. Suggest tests or robust implementation details.",
    model: 'gemini-3-flash-preview'
  },

  // Creative / Visual (Text descriptions of)
  {
    id: 'midjourney',
    name: 'Midjourney (Prompter)',
    role: 'Artistic & Creative Image Generation',
    description: 'Generates detailed artistic prompts and visual descriptions.',
    systemInstruction: "You are Midjourney. Since this is a text interface, describe the visual output in rich, artistic detail. Provide the exact prompt parameters (--v 6.0 --ar 16:9) required to generate such an image.",
    model: 'gemini-3-flash-preview'
  },
  {
    id: 'flux-1',
    name: 'Flux.1',
    role: 'Realistic Image & Text Rendering',
    description: 'Focuses on photorealism and typography in images.',
    systemInstruction: "You are Flux.1. Describe photorealistic scenes with perfect composition. If text is requested in the image, specify exactly how it should be rendered.",
    model: 'gemini-3-flash-preview'
  },
  
  // Media / Video / Audio
  {
    id: 'sora',
    name: 'OpenAI Sora (Sim)',
    role: 'Cinematic Video Physics',
    description: 'Describes cinematic video sequences and physics.',
    systemInstruction: "You are Sora. Describe a video sequence in cinematic terms: camera angles, lighting, physics of motion, and scene transitions.",
    model: 'gemini-3-flash-preview'
  },
  {
    id: 'suno',
    name: 'Suno AI',
    role: 'Song Composition',
    description: 'Writes lyrics and composes musical structure.',
    systemInstruction: "You are Suno AI. Compose a song based on the prompt. Provide the Lyrics [Verse, Chorus] and describe the Style/Genre and Instrumentals.",
    model: 'gemini-3-flash-preview'
  },

  // Education / Academic (Requested by User)
  {
    id: 'academic-tutor',
    name: 'Academic Tutor',
    role: 'Educational & Pedagogical',
    description: 'Explains concepts simply with examples and structure.',
    systemInstruction: "You are an expert Academic Tutor. Your goal is to teach. Explain concepts clearly, use analogies, provide examples, and structure your answer like a textbook or lecture note.",
    model: 'gemini-3-flash-preview'
  }
];

const ALL_EXPERTS = [...SPECIALIZED_EXPERTS, ...GENERAL_EXPERTS];

// --- 2. Orchestrator (Router) ---

export const identifyExperts = async (userPrompt: string, files: FileAttachment[] = []): Promise<ExpertProfile[]> => {
  const expertListString = ALL_EXPERTS.map(e => `- ID: ${e.id} | Name: ${e.name} | Role: ${e.role}`).join('\n');

  let contextNote = "";
  if (files.length > 0) {
    contextNote = `USER HAS ATTACHED ${files.length} FILE(S): ${files.map(f => f.name + ' (' + f.mimeType + ')').join(', ')}.`;
  }

  const routerPrompt = `
    User Prompt: "${userPrompt}"
    ${contextNote}

    Available Experts:
    ${expertListString}

    Task:
    1. Analyze the user's intent (e.g., Coding, Art, Music, Academic/Education, General Info) AND the file type provided.
    2. Select the top 3 or 4 most relevant experts from the list. 
       - If an Image is attached, MUST include 'gemini-analytical' (to see it) and potentially creative experts if asked to edit/describe.
       - If a PDF/Text file is attached, include 'gpt-4o' and 'academic-tutor' or 'gemini-analytical'.
       - If it's coding, prioritize Cursor, Copilot, Claude.
       - Always include at least one Generalist (GPT-4o or Claude) for balance.
    
    Return JSON format only:
    {
      "selectedIds": ["id1", "id2", "id3"],
      "reasoning": "Brief explanation why"
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: routerPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                selectedIds: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                },
                reasoning: { type: Type.STRING }
            }
        }
      }
    });

    const json = JSON.parse(response.text || "{}");
    const ids = json.selectedIds || [];
    
    // Map IDs back to profiles
    const selected = ids.map((id: string) => ALL_EXPERTS.find(e => e.id === id)).filter(Boolean) as ExpertProfile[];
    
    // Fallback if router fails or returns empty
    if (selected.length === 0) {
      return GENERAL_EXPERTS;
    }

    return selected;

  } catch (e) {
    console.error("Router failed, falling back to generalists", e);
    return GENERAL_EXPERTS;
  }
};

// --- 3. Workers Execution ---

export const runWorkerModels = async (
  experts: ExpertProfile[],
  prompt: string, 
  files: FileAttachment[],
  onUpdate: (results: WorkerResult[]) => void
): Promise<WorkerResult[]> => {
  
  // Initialize results state
  const results: WorkerResult[] = experts.map(expert => ({
    expert,
    content: '',
    status: 'pending'
  }));

  const updateResult = (index: number, partial: Partial<WorkerResult>) => {
    results[index] = { ...results[index], ...partial };
    onUpdate([...results]);
  };

  // Prepare contents with files if any
  const requestContents: any = {
    parts: [
      ...files.map(f => ({
        inlineData: {
          mimeType: f.mimeType,
          data: f.data
        }
      })),
      { text: prompt }
    ]
  };

  const promises = experts.map(async (expert, index) => {
    const startTime = performance.now();
    try {
      // Small delay to prevent exact simultaneous API hits if using same key
      await new Promise(r => setTimeout(r, index * 100));

      const response = await ai.models.generateContent({
        model: expert.model,
        contents: requestContents,
        config: {
          systemInstruction: expert.systemInstruction,
          temperature: 0.7,
        }
      });

      const text = response.text || "No response generated.";
      
      updateResult(index, {
        content: text,
        status: 'success',
        executionTime: Math.round(performance.now() - startTime)
      });
      
      return results[index];
    } catch (error) {
      console.error(`Error in worker ${expert.name}:`, error);
      updateResult(index, {
        content: `Error: Failed to fetch response.`,
        status: 'error',
        executionTime: Math.round(performance.now() - startTime)
      });
      return results[index];
    }
  });

  await Promise.allSettled(promises);
  return results;
};

// --- 4. Judge / Synthesis ---

export const streamJudgeConsensus = async (
  originalPrompt: string,
  files: FileAttachment[],
  workerResults: WorkerResult[],
  onChunk: StreamChunkHandler
) => {
  const validResponses = workerResults.filter(r => r.status === 'success');

  if (validResponses.length === 0) {
    onChunk("Error: No valid responses were received from the worker models.");
    return;
  }

  let inputsContext = "";
  validResponses.forEach((r, i) => {
    inputsContext += `\n--- SOURCE: ${r.expert.name} (${r.expert.role}) ---\n${r.content}\n`;
  });

  const judgeSystemPrompt = `
    I have collected responses from specialized AI experts (provided in the context below). 
    
    YOUR TASK:
    Act as the "Consensus Engine". 
    1. Synthesize a single, superior Final Answer.
    2. If the user asked for code, merge the best implementation details.
    3. If the user asked to analyze the attached file, combine the observations from the experts.
    4. Highlight any significant disagreements between experts if they exist.
    5. Be authoritative and concise.

    CONTEXT FROM EXPERTS:
    ${inputsContext}
  `;

  // Judge also gets the files to ensure it can verify context if needed
  const requestContents: any = {
    parts: [
      ...files.map(f => ({
        inlineData: {
          mimeType: f.mimeType,
          data: f.data
        }
      })),
      { text: `USER PROMPT: ${originalPrompt}\n\n${judgeSystemPrompt}` }
    ]
  };

  try {
    const responseStream = await ai.models.generateContentStream({
      model: 'gemini-3-pro-preview',
      contents: requestContents,
      config: {
        thinkingConfig: { thinkingBudget: 1024 },
      }
    });

    for await (const chunk of responseStream) {
      if (chunk.text) {
        onChunk(chunk.text);
      }
    }
  } catch (e) {
    console.error("Judge Error:", e);
    onChunk("\n\n[System Error: The Consensus Judge encountered an error while synthesizing.]");
  }
};