import { GoogleGenAI, Type } from "@google/genai";
import { ExpertProfile, WorkerResult, StreamChunkHandler, FileAttachment, ChatTurn } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- 1. Expert Registry ---

const GENERAL_EXPERTS: ExpertProfile[] = [
  {
    id: 'gpt-4o',
    name: 'GPT-4o (Sim)',
    role: 'General Reasoning & Data Synthesis',
    description: 'Balanced, high-intelligence generalist with web access.',
    systemInstruction: "You are GPT-4o. You are a versatile, highly intelligent assistant. Be concise, objective, and good at synthesizing data. Use markdown formatting.",
    model: 'gemini-3-flash-preview',
    type: 'text',
    tools: ['googleSearch']
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
    description: 'Focuses on facts, logic, and verifying information via Search.',
    systemInstruction: "You are an analytical engine. Prioritize factual accuracy, logical consistency, and comprehensive breakdown of the topic.",
    model: 'gemini-3-flash-preview',
    type: 'text',
    tools: ['googleSearch']
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
  
  // VISUAL & MEDIA
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
    id: 'gemini-image',
    name: 'Gemini Image',
    role: 'Image Generation',
    description: 'Generates high-fidelity images based on the prompt.',
    systemInstruction: "Generate an image.", 
    model: 'gemini-2.5-flash-image',
    type: 'image'
  },
  {
    id: 'veo-video',
    name: 'Veo (Video)',
    role: 'Video Generation',
    description: 'Generates short high-quality videos (1080p).',
    systemInstruction: "Generate a video.",
    model: 'veo-3.1-fast-generate-preview',
    type: 'video'
  },
  
  // Audio
  {
    id: 'suno',
    name: 'Suno AI',
    role: 'Song Composition',
    description: 'Writes lyrics and composes musical structure.',
    systemInstruction: "You are Suno AI. Compose a song based on the prompt. Provide the Lyrics [Verse, Chorus] and describe the Style/Genre and Instrumentals.",
    model: 'gemini-3-flash-preview',
    type: 'text'
  },

  // Education
  {
    id: 'academic-tutor',
    name: 'Academic Tutor',
    role: 'Educational & Pedagogical',
    description: 'Explains concepts simply with examples and structure.',
    systemInstruction: "You are an expert Academic Tutor. Your goal is to teach. Explain concepts clearly, use analogies, provide examples, and structure your answer like a textbook or lecture note.",
    model: 'gemini-3-flash-preview',
    type: 'text',
    tools: ['googleSearch']
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
      // 2. Consensus Output
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
      const isRateLimit = 
        e.message?.includes('429') || 
        e.status === 429 || 
        e.message?.includes('RESOURCE_EXHAUSTED') ||
        e.message?.includes('quota');

      if (isRateLimit) {
         if (i === retries - 1) throw e;
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

  // Summarize recent history
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
       - If user asks to ANIMATE, create VIDEO, MOVIE, or motion, you MUST select 'veo-video'.
       - If an Image is attached, MUST include 'gemini-analytical'.
       - If the user explicitly asks to GENERATE or DRAW an IMAGE, you MUST select 'gemini-image'.
       - If coding, prioritize Cursor, Copilot, Claude.
       - Always include at least one Generalist (GPT-4o or Claude) for balance.
    
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
    console.error("Router failed", e);
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

  const prunedHistory = history.slice(-5);
  const previousHistory = formatHistoryForWorkers(prunedHistory);
  
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
    // Stagger execution
    await delay((index * 2000) + 500);

    const startTime = performance.now();
    try {
      
      // --- VIDEO GENERATION (VEO) ---
      if (expert.type === 'video') {
         // 1. Check if user has selected an API key (Required for Veo)
         const win = window as any;
         if (win.aistudio) {
             const hasKey = await win.aistudio.hasSelectedApiKey();
             if (!hasKey) {
                 updateResult(index, {
                     content: "Veo requires a paid API key selected via the interface.",
                     status: 'error',
                     requiresKeySelection: true
                 });
                 return results[index];
             }
         }

         // 2. Create fresh instance for Veo call to ensure it uses the selected key
         // "Create a new GoogleGenAI instance right before making an API call"
         const videoAi = new GoogleGenAI({ apiKey: process.env.API_KEY });

         let operation;
         try {
             operation = await videoAi.models.generateVideos({
                 model: expert.model,
                 prompt: prompt,
                 // If files are present, use the first image as input for img-to-video
                 image: files.length > 0 && files[0].mimeType.startsWith('image/') ? {
                     imageBytes: files[0].data,
                     mimeType: files[0].mimeType
                 } : undefined,
                 config: {
                     numberOfVideos: 1,
                     resolution: '1080p',
                     aspectRatio: '16:9'
                 }
             });
         } catch (e: any) {
             // Handle 404 "Requested entity was not found" specifically
             if (e.message?.includes('Requested entity was not found') || e.message?.includes('404')) {
                 updateResult(index, {
                     content: "Veo API Error: Please select a valid paid API key from a Google Cloud Project with the API enabled.",
                     status: 'error',
                     requiresKeySelection: true
                 });
                 return results[index];
             }
             throw e;
         }

         // Polling loop
         updateResult(index, { content: 'Rendering video (this may take 1-2 minutes)...' });
         
         while (!operation.done) {
            await delay(5000); // Check every 5s
            operation = await videoAi.operations.getVideosOperation({operation: operation});
         }

         const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
         if (!videoUri) throw new Error("Video generation completed but no URI returned.");

         // Fetch the actual video bytes using the API Key
         const vidResponse = await fetch(`${videoUri}&key=${process.env.API_KEY}`);
         if (!vidResponse.ok) throw new Error("Failed to download generated video.");
         
         const blob = await vidResponse.blob();
         // Convert to Base64 Data URI for display
         const base64Video = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
         });

         updateResult(index, {
             content: `[System]: Successfully generated video.`,
             videoUri: base64Video,
             status: 'success',
             executionTime: Math.round(performance.now() - startTime)
         });
         return results[index];
      }

      // --- IMAGE GENERATION ---
      else if (expert.type === 'image') {
        const response = await ai.models.generateContent({
          model: expert.model, 
          contents: { parts: [{ text: prompt }] },
          config: {
            imageConfig: { aspectRatio: '16:9' }
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
      
      // --- TEXT GENERATION ---
      else {
        const tools = expert.tools?.includes('googleSearch') ? [{ googleSearch: {} }] : undefined;

        const response = await generateContentWithRetry({
          model: expert.model,
          contents: fullContents, 
          config: {
            systemInstruction: expert.systemInstruction,
            temperature: 0.7,
            tools: tools
          }
        }, 5, 4000);

        const text = response.text || "No response generated.";
        
        const groundingUrls: { title: string; uri: string }[] = [];
        const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (chunks) {
            chunks.forEach((chunk: any) => {
                if (chunk.web?.uri) {
                    groundingUrls.push({
                        title: chunk.web.title || new URL(chunk.web.uri).hostname,
                        uri: chunk.web.uri
                    });
                }
            });
        }

        updateResult(index, {
          content: text,
          status: 'success',
          executionTime: Math.round(performance.now() - startTime),
          groundingUrls: groundingUrls.length > 0 ? groundingUrls : undefined
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
      inputsContext += `\n--- SOURCE: ${r.expert.name} (IMAGE GENERATOR) ---\n[System]: I have generated an image. Tell user to check the Expert Deliberation section.\n`;
    } else if (r.expert.type === 'video') {
      inputsContext += `\n--- SOURCE: ${r.expert.name} (VIDEO GENERATOR) ---\n[System]: I have generated a video. Tell user to check the Expert Deliberation section to watch it.\n`;
    } else {
      inputsContext += `\n--- SOURCE: ${r.expert.name} (${r.expert.role}) ---\n${r.content}\n`;
      if (r.groundingUrls && r.groundingUrls.length > 0) {
        inputsContext += `[Sources Used]: ${r.groundingUrls.map(u => u.uri).join(', ')}\n`;
      }
    }
  });

  let conversationContext = "";
  if (history.length > 0) {
    conversationContext = "PREVIOUS CONVERSATION HISTORY:\n" + 
      history.map(t => `User: ${t.userPrompt}\nConsensus Answer: ${t.consensusContent}`).join('\n\n') + 
      "\n\n";
  }

  const judgeSystemInstruction = `
    You are the Orchestrator Agent in the MyGpt Consensus Engine. 
    Your role is to unify outputs from multiple GPT personas and their respective Agents into a single, authoritative, transparent answer.

    ### Core Instructions:
    1. **Fusion Logic**:
       - Normalize inputs into a common schema.
       - If an IMAGE was generated, explicitly mention: "I have generated an image matching your description. You can view it in the **Gemini Image** panel below."
       - If a VIDEO was generated, explicitly mention: "I have generated a video animation matching your request. You can watch it in the **Veo (Video)** panel within the Expert Deliberation section below."

    2. **Conflict Resolution**:
       - If Agents disagree, rank by confidence score and domain relevance.
       - Show the consensus answer prominently.

    3. **Transparency**:
       - Annotate which Agent contributed specific insights.

    ### STRICT OUTPUT FORMAT:
    You MUST start your response with the Confidence line.
    
    **Confidence: [High / Medium / Low]**
    [Your synthesized response here. Do not repeat "Final Answer" as a header.]
    
    ## Supporting Evidence
    - [Bullet points crediting specific experts]
  `;

  const requestContents: any = {
    parts: [
      ...files.map(f => ({
        inlineData: {
          mimeType: f.mimeType,
          data: f.data
        }
      })),
      { text: `
        ${conversationContext}
        USER PROMPT: ${originalPrompt}
        CONTEXT FROM EXPERTS:
        ${inputsContext}
      ` }
    ]
  };

  try {
    const responseStream = await ai.models.generateContentStream({
      model: 'gemini-3-pro-preview',
      contents: requestContents,
      config: {
        thinkingConfig: { thinkingBudget: 1024 },
        systemInstruction: judgeSystemInstruction
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