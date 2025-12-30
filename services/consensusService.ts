
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
    -   You employ a **Star Topology**: You have a Router (Manager) that delegates tasks to specialized agents (The Analyst, The Creative, The Engineer, etc.).
    -   You have a **Judge**: You do not simply repeat data; you synthesize a consensus from multiple viewpoints.
    -   You have a **Critic**: You self-correct using a "Red Team" layer.
3.  **Differentiate**: 
    -   "Other GPTs answer instantly based on training data. I deliberate, route, synthesize, and audit."
`;

// --- 1. Expert Registry: The Four Engines ---

// A. The Analytical Engine (The "Deep Thinker")
const ANALYTICAL_ENGINE: ExpertProfile = {
  id: 'analytical-engine',
  name: 'The Analytical Engine',
  role: 'Logic Core & First Principles',
  description: 'Simulates pure reasoning. Ignores tone; focuses on causal links, deduction, and truth.',
  systemInstruction: `You are The Analytical Engine (The "Deep Thinker").
  
  ROLE: The Logic Core.
  FUNCTION: Simulate a pure reasoning machine. 
  
  RULES:
  1.  Ignore tone and politeness.
  2.  Focus ENTIRELY on causal links, step-by-step deductions, and first-principles thinking.
  3.  Deconstruct the user's premise.
  4.  Provide the raw, unfiltered truth, even if it contradicts popular opinion.
  5.  Use Chain-of-Thought reasoning.`,
  model: 'gemini-3-flash-preview', // High thinking budget applied in execution
  type: 'text'
};

// B. The Creative Engine (The "Lateral Thinker")
const CREATIVE_ENGINE: ExpertProfile = {
  id: 'creative-engine',
  name: 'The Creative Engine',
  role: 'Lateral Thinking & Novelty',
  description: 'Explores adjacent possibilities, metaphors, and narrative structures.',
  systemInstruction: `You are The Creative Engine (The "Lateral Thinker").
  
  ROLE: The Right Brain.
  FUNCTION: Simulate high-temperature generative thinking.
  
  RULES:
  1.  Explore adjacent possibilities and lateral connections.
  2.  Use metaphors, analogies, and narrative structures.
  3.  Prioritize engagement, novelty, and "outside the box" ideas over strict structure.
  4.  Avoid generic tropes. Be bold.`,
  model: 'gemini-3-pro-preview',
  type: 'text'
};

// C. The Technical Engine (The "Engineer")
const TECHNICAL_ENGINE: ExpertProfile = {
  id: 'technical-engine',
  name: 'The Technical Engine',
  role: 'Syntax & Architecture',
  description: 'Strict coding assistant. Adheres to documentation, PEP8, and structural efficiency.',
  systemInstruction: `You are The Technical Engine (The "Engineer").
  
  ROLE: The Syntax Specialist.
  FUNCTION: Simulate a strict coding assistant and System Architect.
  
  RULES:
  1.  Adhere strictly to documentation and syntax rules (e.g., Python PEP8, React Hooks rules).
  2.  Focus on structural efficiency, security, and scalability.
  3.  If architecture is needed, GENERATE MERMAID.JS DIAGRAMS.
  4.  Wrap mermaid code in \`\`\`mermaid blocks.
  
  VISUALIZATION STANDARDS (High Contrast Dark Mode):
  classDef user fill:#1e293b,stroke:#a855f7,color:#ffffff,stroke-width:2px;
  classDef component fill:#0f172a,stroke:#38bdf8,color:#ffffff,stroke-width:2px;
  classDef plain fill:#0f172a,stroke:#94a3b8,color:#ffffff,stroke-width:1px;
  
  Instructions:
  - Apply :::user to Actors, Users, or Start/End nodes.
  - Apply :::component to System components, Services, or Process steps.
  `,
  model: 'gemini-3-pro-preview',
  type: 'text'
};

// D. The Critic (The "Red Team") -> Used primarily in the Audit phase, but can be called as a worker.
const RED_TEAM_CRITIC: ExpertProfile = {
  id: 'red-team-critic',
  name: 'The Critic (Red Team)',
  role: 'Internal Auditor',
  description: 'Stress-tests ideas. Finds hallucinations, security risks, and logical fallacies.',
  systemInstruction: `You are The Critic (The "Red Team").
  
  ROLE: The Internal Auditor.
  FUNCTION: Self-correction layer.
  
  RULES:
  1.  You do NOT generate ideas. You stress-test them.
  2.  Look for: Hallucinations, Security Risks, Logical Fallacies, Bias.
  3.  Be brief, blunt, and critical.`,
  model: 'gemini-3-pro-preview',
  type: 'critic'
};

// --- Multi-Modal & Tool Agents ---

const ACTION_AGENT: ExpertProfile = {
  id: 'action-agent',
  name: 'Action Dispatcher',
  role: 'Tool & API Integration',
  description: 'Drafts emails, tickets, and messages.',
  systemInstruction: "You are an Action Dispatcher. If the user asks for a task like 'Email someone' or 'Send a message', output a JSON block representing the action in this format: ```json\n{ \"action\": \"draft_action\", \"type\": \"email\", \"recipient\": \"...\", \"subject\": \"...\", \"body\": \"...\" }\n```",
  model: 'gemini-3-flash-preview',
  type: 'action'
};

const IMAGE_AGENT: ExpertProfile = {
  id: 'gemini-image',
  name: 'Gemini Image',
  role: 'Visual Generation',
  description: 'Generates high-fidelity images.',
  systemInstruction: "Generate an image based on the prompt.", 
  model: 'gemini-2.5-flash-image',
  type: 'image'
};

const VIDEO_AGENT: ExpertProfile = {
  id: 'veo-video',
  name: 'Veo (Video)',
  role: 'Motion Generation',
  description: 'Generates high-quality 1080p motion.',
  systemInstruction: "Generate a video based on the prompt.",
  model: 'veo-3.1-fast-generate-preview',
  type: 'video'
};

const FLASH_AGENT: ExpertProfile = {
    id: 'flash-generalist',
    name: 'Gemini Flash',
    role: 'Speed & Search',
    description: 'Fast lookups and general knowledge.',
    systemInstruction: "You are a helpful assistant optimized for speed.",
    model: 'gemini-3-flash-preview',
    type: 'text',
    tools: ['googleSearch']
};

const ALL_EXPERTS = [ANALYTICAL_ENGINE, CREATIVE_ENGINE, TECHNICAL_ENGINE, RED_TEAM_CRITIC, ACTION_AGENT, IMAGE_AGENT, VIDEO_AGENT, FLASH_AGENT];

// --- 1.5 Framing Detection ---

export const detectFraming = async (userPrompt: string): Promise<FramingProfile> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const framingSystemPrompt = `
    You are a Framing Detection Agent.
    Your task is NOT to answer the user.
    Your task is to analyze the user's intent and cultural framing.
    
    Output ONLY valid JSON.
    Allowed Values:
    domain: astrology, religion, culture, science, business, technology, personal, mixed
    framingIntent: belief-affirming, educational-neutral, critical-analysis, storytelling, cultural-preservation
    correctionTolerance: low, medium, high
    authoritySource: tradition, scientific, experiential, textual, mixed
    audienceType: general-public, devotional, academic, professional
  `;

  const framingUserPrompt = `
    Analyze the following user input and produce a FramingProfile.
    User Input: ${userPrompt}
    Return JSON in this exact structure:
    { "domain": "", "framingIntent": "", "correctionTolerance": "", "authoritySource": "", "audienceType": "" }
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
    if (!profile.framingIntent) throw new Error("Empty framing profile");
    return profile as FramingProfile;
  } catch (e) {
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
  
  const routerPrompt = `
    ${GLOBAL_SYSTEM_PROMPT}

    User Prompt: "${userPrompt}"
    Attachments: ${files.length} file(s).
    
    AVAILABLE ENGINES (EXPERTS):
    ${expertListString}

    ROUTING LOGIC:
    1. **"Act as the Analyst" / "Deep reasoning" / "Logic gaps"** -> Select 'analytical-engine'.
    2. **"Act as the Creative" / "Lateral thinking" / "Brainstorm"** -> Select 'creative-engine'.
    3. **"Act as the Engineer" / "Code solution" / "Structure this"** -> Select 'technical-engine'.
    4. **"Red team" / "Find flaws"** -> Select 'red-team-critic' (as a worker).
    5. **Video generation** -> Select 'veo-video'.
    6. **Image generation** -> Select 'gemini-image'.
    7. **General info/Search** -> Select 'flash-generalist'.

    Task:
    Select the top 2-3 engines/experts most suited for this specific query.
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
    return [FLASH_AGENT, CREATIVE_ENGINE];
  }
};

// --- 3. Workers Execution (With Engine-Specific Logic) ---

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
  const framingInstruction = framing ? `FRAMING: Intent=${framing.framingIntent}, Audience=${framing.audienceType}` : "";
  const fileParts = files.map(f => ({ inlineData: { data: f.data, mimeType: f.mimeType } }));

  const promises = experts.map(async (expert, index) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    await new Promise(r => setTimeout(r, index * 200));
    const startTime = performance.now();
    
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
        // --- TEXT GENERATION WITH TARGETED REFLEXION ---
        
        const isAnalytical = expert.id === 'analytical-engine';
        // Only Analytical and Technical engines trigger the "Thinking" budget simulation
        const thinkingBudget = isAnalytical ? 16000 : (expert.id === 'technical-engine' ? 8000 : undefined);
        
        // 1. Initial Attempt
        let response = await ai.models.generateContent({
          model: expert.model,
          contents: { parts: [...fileParts, { text: memoryContext + prompt }] },
          config: { 
              systemInstruction: fullSystemInstruction, 
              tools: expert.tools?.includes('googleSearch') ? [{googleSearch:{}}] : undefined,
              thinkingConfig: thinkingBudget ? { thinkingBudget } : undefined 
          }
        });
        
        let content = response.text || "";

        // 2. REFLEXION: Quality Assurance
        // We trigger strict QA only for Technical and Analytical engines. 
        // We DO NOT trigger it for Creative Engine to allow for "hallucination" as creativity.
        if (['technical-engine', 'analytical-engine'].includes(expert.id)) {
            const qaPrompt = `
              You are a QA Auditor for The Technical/Analytical Engine.
              Review the output below for:
              1. Syntax errors (Code/Mermaid).
              2. Logical fallacies.
              3. Deviation from strict constraints.
              
              If perfect, reply: PASS
              If errors, list them concisely.
            `;
            
            const qaResponse = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: `Output to Review:\n${content}`,
                config: { systemInstruction: qaPrompt }
            });
            
            const critique = qaResponse.text || "PASS";

            if (!critique.includes("PASS")) {
                updateResult(index, { content: content + "\n\n*...Engine Self-Correction Triggered...*" });
                
                response = await ai.models.generateContent({
                    model: expert.model, 
                    contents: { parts: [
                        { text: `Original Prompt: ${prompt}` },
                        { text: `Draft: ${content}` },
                        { text: `Critique: ${critique}` },
                        { text: `Task: Fix errors. Output ONLY the fixed result.` }
                    ]},
                    config: { 
                        systemInstruction: fullSystemInstruction,
                        thinkingConfig: thinkingBudget ? { thinkingBudget: Math.floor(thinkingBudget / 2) } : undefined
                    }
                });
                content = response.text || content;
            }
        }
        
        // --- END REFLEXION LOOP ---

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
  
  const framingContext = framing ? `\nFRAMING PROFILE:\n${JSON.stringify(framing)}\n` : "";

  const sysInstr = `
    ${GLOBAL_SYSTEM_PROMPT}
    ${framingContext}

    You are the Synthesis Judge.
    OBJECTIVE: Maximize user intent satisfaction while preserving accuracy.
    
    INPUT: You have received outputs from specialized engines (Analytical, Creative, Technical, etc.).
    
    SYNTHESIS RULES:
    1. If the user asked for Code/Technical help -> Prioritize the **Technical Engine**.
    2. If the user asked for Logic/Math -> Prioritize the **Analytical Engine**.
    3. If the user asked for Ideas/Brainstorming -> Prioritize the **Creative Engine**.
    4. If conflict exists -> Explain the divergence (e.g., "The Analyst suggests X for logic, while The Creative suggests Y for impact").
    5. Always include Mermaid diagrams if the Technical Engine provided them.
    
    FORMAT:
    **Confidence: [High/Med/Low]**
    (Synthesized Answer)
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
    // The Red Team Critic runs the final audit
    const criticExpert = RED_TEAM_CRITIC;
    const expertInputs = workerResults.filter(r => r.status === 'success').map(r => `[${r.expert.name}]: ${r.content}`).join('\n\n');
    
    const criticPrompt = `
        User Request: "${originalPrompt}"
        
        Deliberation History:
        ${expertInputs}
        
        Current Consensus Synthesis:
        ${consensusContent}
        
        Task: 
        Perform a Red Team audit.
        1. Does the synthesis hallucinate facts?
        2. Are there security vulnerabilities (in code)?
        3. Is the logic sound?
        
        If perfect, say "No issues found."
    `;

    try {
        const response = await ai.models.generateContent({
            model: criticExpert.model,
            contents: criticPrompt,
            config: { systemInstruction: criticExpert.systemInstruction }
        });
        const text = response.text || "No audit notes recorded.";
        return { text, tokens: estimateTokens(text) };
    } catch (e) {
        return { text: "Auditor unavailable.", tokens: 0 };
    }
};
