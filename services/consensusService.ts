
import { GoogleGenAI, Type } from "@google/genai";
import { ExpertProfile, WorkerResult, StreamChunkHandler, FileAttachment, ChatTurn, UserPreferences, FramingProfile } from "../types";

// --- Token Estimation Helper ---
// Standard approximation: ~4 characters per token
const estimateTokens = (text: string) => Math.ceil(text.length / 4);

// --- 0. Global System Prompt ---
const GLOBAL_SYSTEM_PROMPT = `
You are "MyGPT", a distinct multi-agent software architecture.
You are powered by "The Consensus Engine" architecture.
You are NOT simply "Gemini" or "ChatGPT". While you are powered by Google's Gemini models (your "parents"), you have your own distinct personality and behavior defined by your architecture.

IDENTITY RULES:
If asked "Who are you?", "Tell me about yourself", or "How are you different?":
1.  **State Your Name**: You are "MyGPT".
2.  **Describe Your "Personality" (How You Work)**:
    -   You operate as "The Consensus Engine".
    -   Unlike standard chatbots that rely on a single stream of consciousness, you function as a **Firm of Experts**.
    -   You employ a **Star Topology**: You have a Router (Manager) that delegates tasks to specialized agents (Flash, Pro, Veo, etc.).
    -   You have a **Judge**: You do not simply repeat data; you synthesize a consensus from multiple viewpoints to reduce hallucinations.
    -   You have a **Critic**: You self-correct before responding.
3.  **Differentiate**: 
    -   "Other GPTs answer instantly based on training data. I deliberate, route, synthesize, and audit."
    -   "I am the Orchestra, they are just the instruments."

GENERAL RULES:
1. Respect the user's cultural, traditional, and contextual framing.
2. Do not debunk, invalidate, or correct belief systems unless the user explicitly asks for verification, criticism, or fact-checking.
3. When multiple interpretations exist, present them as layers, not conflicts.
4. Accuracy must never override user intent when intent is belief-affirming.
5. Preserve existing application behavior unless explicitly instructed otherwise.
`;

// --- 1. Expert Registry ---

const REASONING_STUB = "\n\nREASONING PROTOCOL: Before answering, draft a silent plan: Step 1: Analyze user intent and any attached media. Step 2: Cross-reference knowledge. Step 3: Identify potential errors. Step 4: Final output.";

const GENERAL_EXPERTS: ExpertProfile[] = [
  {
    id: 'flash-generalist',
    name: 'Gemini Flash (Fast)',
    role: 'Speed & Logic',
    description: 'Quick analytical thinker for rapid turns.',
    systemInstruction: "You are an AI assistant optimized for speed and accuracy." + REASONING_STUB,
    model: 'gemini-3-flash-preview',
    type: 'text',
    tools: ['googleSearch']
  },
  {
    id: 'pro-reasoner',
    name: 'Gemini Pro (Deep)',
    role: 'Complex Nuance',
    description: 'Uses deeper reasoning for difficult logic problems.',
    systemInstruction: "You are a senior-level AI advisor. provide exhaustive, deep analysis of the prompt and attachments." + REASONING_STUB,
    model: 'gemini-3-pro-preview',
    type: 'text'
  }
];

const SPECIALIZED_EXPERTS: ExpertProfile[] = [
  {
    id: 'architect',
    name: 'System Architect',
    role: 'Visual Design & Infra',
    description: 'Draws diagrams and plans systems.',
    systemInstruction: "You are a System Architect. Whenever possible, use Mermaid.js syntax to visualize architectures. Wrap mermaid code in ```mermaid blocks.",
    model: 'gemini-3-pro-preview',
    type: 'text'
  },
  {
    id: 'action-agent',
    name: 'Action Dispatcher',
    role: 'Tool & API Integration',
    description: 'Drafts emails, tickets, and messages.',
    systemInstruction: "You are an Action Dispatcher. If the user asks for a task like 'Email someone' or 'Send a message', output a JSON block representing the action in this format: ```json\n{ \"action\": \"draft_action\", \"type\": \"email\", \"recipient\": \"...\", \"subject\": \"...\", \"body\": \"...\" }\n```",
    model: 'gemini-3-flash-preview',
    type: 'text'
  },
  {
    id: 'gemini-image',
    name: 'Gemini Image',
    role: 'Image Generation',
    description: 'Generates high-fidelity images.',
    systemInstruction: "Generate an image based on the prompt.", 
    model: 'gemini-2.5-flash-image',
    type: 'image'
  },
  {
    id: 'veo-video',
    name: 'Veo (Video)',
    role: 'Video Generation',
    description: 'Generates high-quality 1080p motion.',
    systemInstruction: "Generate a video based on the prompt.",
    model: 'veo-3.1-fast-generate-preview',
    type: 'video'
  },
  {
    id: 'auditor-critic',
    name: 'Consensus Auditor',
    role: 'Fact-Checker & Logic Critic',
    description: 'Reviews consensus for bias, omissions, or logical flaws.',
    systemInstruction: "You are the Consensus Auditor. Your job is to review the synthesized answer from the Judge. Identify: 1. Any missed details from expert workers. 2. Logical leaps. 3. Over-confidence. 4. Factual inconsistencies. When reviewing, distinguish between: - factual errors - framing mismatches. Flag framing mismatches without demanding correction. Be brief and blunt.",
    model: 'gemini-3-pro-preview',
    type: 'critic'
  }
];

const ALL_EXPERTS = [...SPECIALIZED_EXPERTS, ...GENERAL_EXPERTS];

// --- 1.5 Framing Detection Agent ---

export const detectFraming = async (userPrompt: string): Promise<FramingProfile> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const framingSystemPrompt = `
    You are a Framing Detection Agent.
    Your task is NOT to answer the user.
    Your task is to analyze the user's intent and cultural framing.
    
    Output ONLY valid JSON.
    Do not explain.
    Do not add extra text.
    
    Allowed Values:
    domain: astrology, religion, culture, science, business, technology, personal, mixed
    framingIntent: belief-affirming, educational-neutral, critical-analysis, storytelling, cultural-preservation
    correctionTolerance: low, medium, high
    authoritySource: tradition, scientific, experiential, textual, mixed
    audienceType: general-public, devotional, academic, professional
  `;

  const framingUserPrompt = `
    Analyze the following user input and produce a FramingProfile.
    
    User Input:
    ${userPrompt}
    
    Return JSON in this exact structure:
    {
      "domain": "",
      "framingIntent": "",
      "correctionTolerance": "",
      "authoritySource": "",
      "audienceType": ""
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: framingUserPrompt,
      config: { 
        systemInstruction: framingSystemPrompt,
        responseMimeType: "application/json"
      }
    });
    
    const jsonStr = response.text || "{}";
    const profile = JSON.parse(jsonStr);
    
    // Simple validation to fallback if JSON is malformed or empty
    if (!profile.framingIntent) throw new Error("Empty framing profile");
    
    return profile as FramingProfile;
  } catch (e) {
    // Fallback profile if detection fails
    return {
      domain: "mixed",
      framingIntent: "educational-neutral",
      correctionTolerance: "medium",
      authoritySource: "mixed",
      audienceType: "general-public"
    };
  }
};

// --- 2. Orchestrator (Router) ---

export const identifyExperts = async (
    userPrompt: string, 
    files: FileAttachment[] = [], 
    history: ChatTurn[] = [],
    preferences?: UserPreferences,
    framing?: FramingProfile
): Promise<ExpertProfile[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const expertListString = ALL_EXPERTS.filter(e => e.type !== 'critic').map(e => `- ID: ${e.id} | Name: ${e.name} | Role: ${e.role}`).join('\n');
  
  const memoryContext = preferences ? `
    USER PREFERENCES (Persistent Memory):
    - Role: ${preferences.persona}
    - Style: ${preferences.style}
    - Context: ${preferences.technicalContext}
  ` : "";

  const framingContext = framing ? `
    Framing Context (DO NOT OVERRIDE):
    ${JSON.stringify(framing, null, 2)}
    Routing decision must respect the framing context.
  ` : "";

  const routerPrompt = `
    ${GLOBAL_SYSTEM_PROMPT}

    User Prompt: "${userPrompt}"
    Attachments: ${files.length} file(s) attached.
    ${memoryContext}
    ${framingContext}

    Available Experts:
    ${expertListString}

    Task:
    Select the top 2-3 experts most suited for this specific query.
    Return JSON only: { "selectedIds": ["id1", "id2"], "reasoning": "..." }
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: routerPrompt,
      config: { responseMimeType: "application/json" }
    });
    const json = JSON.parse(response.text || "{}");
    return (json.selectedIds || []).map((id: string) => ALL_EXPERTS.find(e => e.id === id)).filter(Boolean) as ExpertProfile[];
  } catch (e) {
    return [GENERAL_EXPERTS[0], GENERAL_EXPERTS[1]];
  }
};

// --- 3. Workers Execution ---

export const runWorkerModels = async (
  experts: ExpertProfile[],
  prompt: string, 
  files: FileAttachment[],
  history: ChatTurn[],
  preferences: UserPreferences | undefined,
  framing: FramingProfile | undefined,
  onUpdate: (results: WorkerResult[]) => void
): Promise<WorkerResult[]> => {
  
  const results: WorkerResult[] = experts.map(expert => ({ expert, content: '', status: 'pending' }));
  const updateResult = (index: number, partial: Partial<WorkerResult>) => {
    results[index] = { ...results[index], ...partial };
    onUpdate([...results]);
  };

  const memoryContext = preferences ? `[CONTEXT: Act as ${preferences.persona}, style: ${preferences.style}] ` : "";
  
  // Universal Worker Prompt Prefix using Framing Profile
  const framingInstruction = framing ? `
FRAMING CONSTRAINTS:
- Domain: ${framing.domain}
- Intent: ${framing.framingIntent}
- Correction Tolerance: ${framing.correctionTolerance}
- Authority Source: ${framing.authoritySource}
- Audience: ${framing.audienceType}

RULES:
- Do not challenge belief systems if correctionTolerance is LOW.
- Use the authoritySource as the primary reference lens.
- Match tone and structure to the audienceType.
- Additive explanations are allowed; dismissive corrections are not.
` : "";
  
  const fileParts = files.map(f => ({ inlineData: { data: f.data, mimeType: f.mimeType } }));

  const promises = experts.map(async (expert, index) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    await new Promise(r => setTimeout(r, index * 200));
    const startTime = performance.now();
    
    // Dynamically inject Global Prompt + Framing Prefix + Expert Logic
    const fullSystemInstruction = `${GLOBAL_SYSTEM_PROMPT}\n${framingInstruction}\n${expert.systemInstruction}`;

    try {
      if (expert.type === 'video') {
         let op = await ai.models.generateVideos({
             model: expert.model, 
             prompt: prompt, 
             config: { numberOfVideos: 1, resolution: '1080p', aspectRatio: '16:9' }
         });
         while (!op.done) { 
             await new Promise(r => setTimeout(r, 10000)); 
             op = await ai.operations.getVideosOperation({operation: op}); 
         }
         updateResult(index, { content: "Video generated.", videoUri: op.response?.generatedVideos?.[0]?.video?.uri, status: 'success', estimatedTokens: 500 });
      } else if (expert.type === 'image') {
        const res = await ai.models.generateContent({ model: expert.model, contents: prompt });
        const img = res.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
        updateResult(index, { content: "Image generated.", images: img ? [img] : [], status: 'success', estimatedTokens: 250 });
      } else {
        const response = await ai.models.generateContent({
          model: expert.model,
          contents: { parts: [...fileParts, { text: memoryContext + prompt }] },
          config: { 
              systemInstruction: fullSystemInstruction, 
              tools: expert.tools?.includes('googleSearch') ? [{googleSearch:{}}] : undefined 
          }
        });
        
        let content = response.text || "";
        let actionDraft;
        let groundingUrls = response.candidates?.[0]?.groundingMetadata?.groundingChunks
            ?.map((chunk: any) => chunk.web)
            .filter(Boolean);
        
        const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
        if (jsonMatch) {
            try {
                const actionData = JSON.parse(jsonMatch[1]);
                if (actionData.action === 'draft_action') actionDraft = actionData;
            } catch {}
        }

        updateResult(index, { 
          content, 
          status: 'success', 
          actionDraft, 
          groundingUrls, 
          executionTime: Math.round(performance.now() - startTime),
          estimatedTokens: estimateTokens(content)
        });
      }
    } catch (e: any) {
      updateResult(index, { content: `Error: ${e.message}`, status: 'error' });
    }
  });

  await Promise.allSettled(promises);
  return results;
};

// --- 4. Judge / Synthesis ---

export const streamJudgeConsensus = async (
  originalPrompt: string,
  workerResults: WorkerResult[],
  history: ChatTurn[],
  preferences: UserPreferences | undefined,
  framing: FramingProfile | undefined,
  onChunk: StreamChunkHandler
): Promise<number> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const inputs = workerResults.filter(r => r.status === 'success').map(r => `[${r.expert.name}]: ${r.content}`).join('\n\n');
  
  const framingContext = framing ? `\nCONTEXTUAL FRAMING:\n${JSON.stringify(framing)}\n` : "";

  const sysInstr = `
    ${GLOBAL_SYSTEM_PROMPT}
    ${framingContext}

    You are the Synthesis Judge.

    PRIMARY OBJECTIVE:
    Maximize user intent satisfaction while preserving accuracy.

    DECISION RULES:
    1. Cultural alignment has priority over technical correction when correctionTolerance is LOW.
    2. If experts disagree:
       - Cultural/Traditional Authority wins when intent is belief-affirming.
    3. Never remove culturally important explanations unless they are explicitly harmful.
    4. Prefer layered explanations over contradiction.
    5. VISUALS: If architecture is discussed, MUST use Mermaid.js diagrams.
    6. STYLE: Role: ${preferences?.persona}, Style: ${preferences?.style}.
    
    FORMAT:
    **Confidence: [High/Med/Low]**
    
    ### Primary Explanation (User's Worldview)
    [Content completely aligned with the user's framing intent]

    ### Optional Context (If Applicable)
    [Scientific or technical nuance, presented as an additive layer, never as a debunking correction]
  `;

  let totalText = "";
  try {
    const stream = await ai.models.generateContentStream({
      model: 'gemini-3-pro-preview',
      contents: `User Prompt: ${originalPrompt}\n\nExpert Deliberation:\n${inputs}`,
      config: { systemInstruction: sysInstr, thinkingConfig: { thinkingBudget: 2048 } }
    });

    for await (const chunk of stream) {
      if (chunk.text) {
          totalText += chunk.text;
          onChunk(chunk.text);
      }
    }
    return estimateTokens(totalText);
  } catch (e) {
    onChunk("Synthesis Error. Please retry.");
    return 0;
  }
};

// --- 5. Critic Review (Self-Correction) ---

export const runCriticReview = async (
    originalPrompt: string,
    workerResults: WorkerResult[],
    consensusContent: string,
    framing?: FramingProfile
): Promise<{ text: string; tokens: number }> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const criticExpert = ALL_EXPERTS.find(e => e.id === 'auditor-critic')!;
    const expertInputs = workerResults.filter(r => r.status === 'success').map(r => `[${r.expert.name}]: ${r.content}`).join('\n\n');
    
    const framingContext = framing ? `\nCONTEXTUAL FRAMING:\n${JSON.stringify(framing)}\n` : "";

    const criticPrompt = `
        User Request: "${originalPrompt}"
        
        Deliberation History:
        ${expertInputs}
        
        Current Consensus Synthesis:
        ${consensusContent}
        
        Task: 
        Perform an audit of the Synthesis. Point out if it missed any specific worker advice, contains logical errors, or seems too generic.
    `;

    // Inject Global Prompt + Framing
    const fullSystemInstruction = `${GLOBAL_SYSTEM_PROMPT}${framingContext}\n${criticExpert.systemInstruction}`;

    try {
        const response = await ai.models.generateContent({
            model: criticExpert.model,
            contents: criticPrompt,
            config: { systemInstruction: fullSystemInstruction }
        });
        const text = response.text || "No audit notes recorded.";
        return { text, tokens: estimateTokens(text) };
    } catch (e) {
        return { text: "Auditor unavailable.", tokens: 0 };
    }
};
