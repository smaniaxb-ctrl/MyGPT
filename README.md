
# Firm of Experts: The Consensus Engine

Firm of Experts is a sophisticated multi-agent orchestration platform that leverages parallel processing and "Wisdom of the Crowds" logic to deliver high-fidelity, hallucination-resistant, and culturally aware AI responses.

## 🚀 Overview

Unlike traditional chatbots that rely on a single model's stream of consciousness, Firm of Experts employs a **Star Topology Architecture**:
1.  **Detects** your worldview and intent (Framing).
2.  **Routes** the query to specialized expert agents (Text, Image, Video, Actions).
3.  **Synthesizes** a consensus verdict using a "Judge" model.
4.  **Audits** the result with a "Critic" model before presenting it.

## 🧠 Core Architecture

The system operates in five distinct phases for every user prompt:

### 1. Framing Detection (The Guardrail)
Before answering, a specialized **Framing Agent** analyzes the user's intent to build a `FramingProfile`.
*   **Cultural Preservation**: Identifies if the user is asking from a traditional, religious, or cultural standpoint.
*   **Intent Analysis**: Distinguishes between "Belief-Affirming" queries and "Critical Analysis" requests.
*   *Outcome*: Ensures the AI respects the user's worldview instead of dismissively "correcting" them.

### 2. Intelligent Routing (The Manager)
The **Router Agent** assesses the task requirements and recruits 2-3 specific experts from the registry:
*   **Flash Generalist**: Speed and broad logic.
*   **Pro Reasoner**: Deep, nuanced analysis for complex problems.
*   **System Architect**: Generates visual diagrams using Mermaid.js.
*   **Action Dispatcher**: Drafts JSON payloads for emails, tickets, or messages.
*   **Gemini Image**: Generates high-fidelity static imagery.
*   **Veo (Video)**: Generates 1080p motion video content.

### 3. Parallel Execution (The Workers)
Selected experts run simultaneously. They are unaware of each other, ensuring diverse, independent perspectives.
*   **Tool Use**: Text experts can perform **Google Grounding** searches to verify facts in real-time.
*   **Multi-Modal**: The system can generate text, images, and videos in a single turn if the query demands it.

### 4. Judge Synthesis (The Verdict)
The **Judge Agent** (`gemini-3-pro-preview`) reviews all expert outputs and synthesizes a final answer.
*   **Layered Explanation**: If technical facts conflict with user framing, it presents a "Primary Explanation" (aligned with user intent) and an "Optional Context" layer (scientific nuance).
*   **Conflict Resolution**: Weighted logic determines which expert is most reliable for the specific domain.

### 5. Critic Audit (The Self-Correction)
Finally, an **Auditor Agent** reviews the Judge's synthesis.
*   **Framing Mismatch**: It checks if the tone matches the audience.
*   **Fact Checking**: It flags logical leaps or missed details.
*   **UI Integration**: These notes appear as a collapsible "Self-Correction" panel in the UI.

---

## ✨ Key Features

*   **Worldview-Aware AI**: Capable of discussing Traditional Medicine, Folklore, or Religion without unwarranted "debunking," while maintaining scientific accuracy in optional context layers.
*   **Multi-Modal Generation**: Supports Text, Images (Gemini 2.5), and Video (Veo) in a unified chat interface.
*   **Actionable Outputs**: The **Action Agent** detects requests like "Draft an email" and provides executable JSON blocks and UI buttons to copy/open mail clients.
*   **Visual Architecture**: Automatically renders complex system designs using **Mermaid.js**.
*   **Transparent Confidence**: Every answer includes a confidence score (High/Medium/Low) based on expert consensus.
*   **Persistent Memory**: Remembers user persona (e.g., "Senior Engineer"), style ("Brief"), and technical context across sessions.
*   **Streamed Deliberation**: Users can watch the Judge "think" and synthesize the answer in real-time.

---

## 🛠 Tech Stack

*   **Frontend**: React 19, TypeScript, Tailwind CSS
*   **Orchestration**: Google GenAI SDK (Gemini 1.5/2.5/3.0 Series)
*   **Video**: Veo 3.1
*   **Grounding**: Google Search Tool
*   **Rendering**: `react-markdown`, `mermaid`, `katex` (Math)

## 🔮 Future Roadmap

*   **Voice Interactivity**: Integration with Gemini Live API for real-time debate.
*   **RAG Integration**: Uploading large PDF knowledge bases for the experts to reference.
*   **Custom Expert Creation**: UI for users to define their own expert personas.

## Contact
Created by Jayaprakash. Reach out at smaniaxb@gmail.com for collaboration!
