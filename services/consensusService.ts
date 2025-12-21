import { GoogleGenAI, Type } from "@google/genai";
import { ExpertProfile, WorkerResult, StreamChunkHandler, FileAttachment, ChatTurn } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- 1. Expert Registry ---

const GENERAL_EXPERTS: ExpertProfile[] = [
  {
    id: 'gpt-4o',
    name: 'GPT-4o (Sim)',
    role: 'General Reasoning & Data Synthesis',
    description: 'Balanced, high-intelligence generalist.',
    systemInstruction: "You are GPT-4o. You are a versatile, highly intelligent assistant. Be concise, objective, and good at synthesizing data. Use markdown formatting.",
    model: 'gemini-3-flash-preview',
    type: 'text'
  },
  {
    id: 'claude-3-5',
    name: 'Claude 3.5 Sonnet (Sim)',
    role: 'Coding Logic & Nuanced Writing',
    description: 'Excellent at creative writing, tone, and complex logic.',
    systemInstruction: "You are Claude 3.5 Sonnet. You excel at nuanced writing, safety, and complex reasoning. Your tone is helpful and conversational but professional.",
    model: 'gemini-3-flash-preview',
    type: 'text'
  },
  {
    id: 'gemini-analytical',
    name: 'Gemini (Analytical)',
    role: 'Deep Analysis & Fact Checking',
    description: 'Focuses on facts, logic, and verifying information.',
    systemInstruction: "You are an analytical engine. Prioritize factual accuracy, logical consistency, and comprehensive breakdown of the topic.",
    model: 'gemini-3-flash-preview',
    type: 'text'
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
    model: 'gemini-3-flash-preview',
    type: 'text'
  },
  {
    id: 'github-copilot',
    name: 'GitHub Copilot',
    role: 'Code Autocomplete & Boilerplate',
    description: 'Quick, standard code patterns and syntax help.',
    systemInstruction: "You are GitHub Copilot. Provide standard, efficient code snippets for the specific problem. Focus on syntax correctness and best practices.",
    model: 'gemini-3-flash-preview',
    type: 'text'
  },
  {
    id: 'qodo',
    name: 'Qodo (Codium)',
    role: 'Code Testing & Bug Detection',
    description: 'Focuses on edge cases, security, and test coverage.',
    systemInstruction: "You are Qodo. Analyze the request for potential bugs, edge cases, or security flaws. Suggest tests or robust implementation details.",
    model: 'gemini-3-flash-preview',
    type: 'text'
  },

  // Creative / Visual (Text descriptions of)
  {
    id: 'midjourney',
    name: 'Midjourney (Prompter)',
    role: 'Artistic & Creative Image Generation',
    description: 'Generates detailed artistic prompts and visual descriptions.',
    systemInstruction: "You are Midjourney. Since this is a text interface, describe the visual output in rich, artistic detail. Provide the exact prompt parameters (--v 6.0 --ar 16:9) required to generate such an image.",
    model: 'gemini-3-flash-preview',
    type: 'text'
  },
  {
    id: 'flux-1',
    name: 'Flux.1',
    role: 'Realistic Image & Text Rendering',
    description: 'Focuses on photorealism and typography in images.',
    systemInstruction: "You are Flux.1. Describe photorealistic scenes with perfect composition. If text is requested in the image, specify exactly how it should be rendered.",
    model: 'gemini-3-flash-preview',
    type: 'text'
  },
  
  // IMAGE GENERATION
  {
    id: 'gemini-image',
    name: 'Gemini Image',
    role: 'Image Generation',
    description: 'Generates high-fidelity images based on the prompt.',
    systemInstruction: "Generate an image.", 
    model: 'gemini-2.5-flash-image',
    type: 'image'
  },
  
  // Media / Video / Audio
  {
    id: 'sora',
    name: 'OpenAI Sora (Sim)',
    role: 'Cinematic Video Physics',
    description: 'Describes cinematic video sequences and physics.',
    systemInstruction: "You are Sora. Describe a video sequence in cinematic terms: camera angles, lighting, physics of motion, and scene transitions.",
    model: 'gemini-3-flash-preview',
    type: 'text'
  },
  {
    id: 'suno',
    name: 'Suno AI',
    role: 'Song Composition',
    description: 'Writes lyrics and composes musical structure.',
    systemInstruction: "You are Suno AI. Compose a song based on the prompt. Provide the Lyrics [Verse, Chorus] and describe the Style/Genre and Instrumentals.",
    model: 'gemini-3-flash-preview',
    type: 'text'
  },

  // Education / Academic (Requested by User)
  {
    id: 'academic-tutor',
    name: 'Academic Tutor',
    role: 'Educational & Pedagogical',
    description: 'Explains concepts simply with examples and structure.',
    systemInstruction: "You are an expert Academic Tutor. Your goal is to teach. Explain concepts clearly, use analogies, provide examples, and structure your answer like a textbook or lecture note.",
    model: 'gemini-3-flash-preview',
    type: 'text'
  }
];

const ALL_EXPERTS = [...SPECIALIZED_EXPERTS, ...GENERAL_EXPERTS];

// --- Helper: Format History ---
const formatHistoryForWorkers = (history: ChatTurn[]) => {
  const contents: any[] = [];
  history.forEach(turn => {
      // 1. User Input
      contents.push({
          role: 'user',
          parts: [
              ...turn.attachments.map(a => ({ inlineData: { mimeType: a.mimeType, data: a.data } })),
              { text: turn.userPrompt }
          ]
      });
      // 2. Consensus Output (Simulating that the model agreed with the consensus)
      if (turn.consensusContent) {
          contents.push({
              role: 'model',
              parts: [{ text: turn.consensusContent }]
          });
      }
  });
  return contents;
};

// --- Helper: Retry Logic ---
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function generateContentWithRetry(options: any, retries = 5, backoffStart = 4000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await ai.models.generateContent(options);
    } catch (e: any) {
      // Check for 429 Resource Exhausted or specific error messages
      const isRateLimit = 
        e.message?.includes('429') || 
        e.status === 429 || 
        e.message?.includes('RESOURCE_EXHAUSTED') ||
        e.message?.includes('quota');

      if (isRateLimit) {
         if (i === retries - 1) throw e; // Throw on last attempt

         // Exponential backoff with jitter: 4s, 8s, 16s, 32s...
         const waitTime = Math.pow(2, i) * backoffStart + (Math.random() * 2000);
         console.warn(`Hit rate limit (attempt ${i + 1}/${retries}). Retrying in ${Math.round(waitTime)}ms...`);
         await delay(waitTime);
         continue;
      }
      throw e;
    }
  }
}

// --- 2. Orchestrator (Router) ---

export const identifyExperts = async (userPrompt: string, files: FileAttachment[] = [], history: ChatTurn[] = []): Promise<ExpertProfile[]> => {
  const expertListString = ALL_EXPERTS.map(e => `- ID: ${e.id} | Name: ${e.name} | Role: ${e.role} | Type: ${e.type}`).join('\n');

  let contextNote = "";
  if (files.length > 0) {
    contextNote = `USER HAS ATTACHED ${files.length} FILE(S): ${files.map(f => f.name + ' (' + f.mimeType + ')').join(', ')}.`;
  }

  // Summarize recent history for the router (last 2 turns)
  let historySummary = "";
  if (history.length > 0) {
    const recent = history.slice(-2);
    historySummary = "\nRECENT CONVERSATION HISTORY:\n" + recent.map(t => `User: ${t.userPrompt}\nSystem: ${t.consensusContent.substring(0, 200)}...`).join('\n') + "\n";
  }

  const routerPrompt = `
    User Prompt: "${userPrompt}"
    ${contextNote}
    ${historySummary}

    Available Experts:
    ${expertListString}

    Task:
    1. Analyze the user's intent and the conversation context.
    2. Select the top 3 or 4 most relevant experts.
       - If an Image is attached, MUST include 'gemini-analytical' and creative experts.
       - If the user explicitly asks to GENERATE, DRAW, or CREATE an IMAGE, you MUST select 'gemini-image'.
       - If coding, prioritize Cursor, Copilot, Claude.
       - Always include at least one Generalist (GPT-4o or Claude) for balance.
       - If this is a follow-up question (e.g., "rewrite that"), select experts relevant to the PREVIOUS task too.
    
    Return JSON format only:
    {
      "selectedIds": ["id1", "id2", "id3"],
      "reasoning": "Brief explanation why"
    }
  `;

  try {
    const response = await generateContentWithRetry({
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
    
    const selected = ids.map((id: string) => ALL_EXPERTS.find(e => e.id === id)).filter(Boolean) as ExpertProfile[];
    
    if (selected.length === 0) {
      return GENERAL_EXPERTS;
    }
    return selected;

  } catch (e) {
    console.error("Router failed, falling back to single generalist to save quota", e);
    // FALLBACK: Only return ONE expert if we are already hitting limits.
    // Returning 3 experts (GENERAL_EXPERTS) usually triggers 3 more 429s immediately.
    return [GENERAL_EXPERTS[0]]; 
  }
};

// --- 3. Workers Execution ---

export const runWorkerModels = async (
  experts: ExpertProfile[],
  prompt: string, 
  files: FileAttachment[],
  history: ChatTurn[],
  onUpdate: (results: WorkerResult[]) => void
): Promise<WorkerResult[]> => {
  
  const results: WorkerResult[] = experts.map(expert => ({
    expert,
    content: '',
    status: 'pending'
  }));

  const updateResult = (index: number, partial: Partial<WorkerResult>) => {
    results[index] = { ...results[index], ...partial };
    onUpdate([...results]);
  };

  // Build conversation history for the worker
  // Context Pruning: Only use the last 5 turns for workers to manage tokens and rate limits
  const prunedHistory = history.slice(-5);
  const previousHistory = formatHistoryForWorkers(prunedHistory);
  
  // Current Turn
  const currentContent = {
    role: 'user',
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

  const fullContents = [...previousHistory, currentContent];

  const promises = experts.map(async (expert, index) => {
    // Significantly increased stagger delay to prevent hitting 429 Rate Limits immediately
    // 2500ms * index ensures requests are spaced out by 2.5 seconds each.
    // Added initial padding of 500ms
    await delay((index * 2500) + 500);

    const startTime = performance.now();
    try {
      
      // IMAGE GENERATION HANDLER (Using gemini-2.5-flash-image)
      if (expert.type === 'image') {
        const response = await ai.models.generateContent({
          model: expert.model, 
          contents: { parts: [{ text: prompt }] },
          config: {
            imageConfig: { aspectRatio: '16:9' }
            // Note: responseMimeType is NOT supported for nano banana models
          }
        });

        const generatedImages: string[] = [];
        let textResponse = "";

        if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData && part.inlineData.data) {
                    generatedImages.push(part.inlineData.data);
                } else if (part.text) {
                    textResponse += part.text;
                }
            }
        }
        
        updateResult(index, {
          content: `[System]: Successfully generated ${generatedImages.length} image(s). ${textResponse}`,
          images: generatedImages,
          status: 'success',
          executionTime: Math.round(performance.now() - startTime)
        });
        return results[index];
      } 
      
      // TEXT GENERATION HANDLER
      else {
        const response = await generateContentWithRetry({
          model: expert.model,
          contents: fullContents, // Send pruned history + current prompt
          config: {
            systemInstruction: expert.systemInstruction,
            temperature: 0.7,
          }
        }, 5, 4000); // 5 retries, starting backoff at 4s

        const text = response.text || "No response generated.";
        
        updateResult(index, {
          content: text,
          status: 'success',
          executionTime: Math.round(performance.now() - startTime)
        });
        
        return results[index];
      }

    } catch (error) {
      console.error(`Error in worker ${expert.name}:`, error);
      updateResult(index, {
        content: `Error: Failed to fetch response. (${(error as Error).message})`,
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
  history: ChatTurn[],
  onChunk: StreamChunkHandler
) => {
  const validResponses = workerResults.filter(r => r.status === 'success');

  if (validResponses.length === 0) {
    onChunk("Error: No valid responses were received from the worker models.");
    return;
  }

  let inputsContext = "";
  validResponses.forEach((r, i) => {
    if (r.expert.type === 'image') {
      inputsContext += `\n--- SOURCE: ${r.expert.name} (IMAGE GENERATOR) ---\n[System]: I have generated an image for the user. Please inform the user that the image can be found in the Expert Deliberation section below.\n`;
    } else {
      inputsContext += `\n--- SOURCE: ${r.expert.name} (${r.expert.role}) ---\n${r.content}\n`;
    }
  });

  // Construct a text-based history block for the judge (easier to digest as context than chat history)
  let conversationContext = "";
  if (history.length > 0) {
    // Note: The Judge still receives the FULL history (as requested), not pruned.
    conversationContext = "PREVIOUS CONVERSATION HISTORY:\n" + 
      history.map(t => `User: ${t.userPrompt}\nConsensus Answer: ${t.consensusContent}`).join('\n\n') + 
      "\n\n";
  }

  const judgeSystemPrompt = `
    I have collected responses from specialized AI experts (provided in the context below). 
    
    YOUR TASK:
    Act as the "Consensus Engine". 
    1. Synthesize a single, superior Final Answer based on the User Prompt and Expert Responses.
    2. STRUCTURE: Use Markdown for clarity. Use H2 (##) for main sections. Use bolding for key terms.
    3. Use the "PREVIOUS CONVERSATION HISTORY" to understand context (e.g., if the user says "rewrite that").
    4. If the user asked for code, merge the best implementation details into a single, cohesive solution.
    5. If an IMAGE WAS GENERATED (Source: Gemini Image), you MUST explicitly mention in your final answer: "I have generated an image matching your description. You can view it in the **Gemini Image** panel within the Expert Deliberation section below."
    6. Highlight any significant disagreements between experts if they exist.
    7. Be authoritative and concise.

    ${conversationContext}

    CONTEXT FROM EXPERTS (For Current Prompt):
    ${inputsContext}
  `;

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
    // Note: Streaming request cannot easily be retried in the same way, but it is a single request 
    // at the end of the chain, so less likely to hit concurrent rate limits.
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
  } catch (e: any) {
    console.error("Judge Error:", e);
    const msg = (e.message || "").toLowerCase();
    if (msg.includes('429') || msg.includes('exhausted')) {
         onChunk("\n\n[System Error: Rate limit reached during Consensus. Please wait a moment and try again.]");
    } else {
         onChunk("\n\n[System Error: The Consensus Judge encountered an error while synthesizing.]");
    }
  }
};