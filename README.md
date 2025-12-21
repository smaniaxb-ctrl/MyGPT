# MyGpt: The Consensus Engine

MyGpt is a multi-agent orchestration app that uses the wisdom of crowds to deliver trusted AI answers.

## Why It Matters
Instead of relying on one model, MyGpt queries multiple expert personas in parallel and synthesizes their outputs into a superior consensus answer.

## Current Status
This repository contains the app’s design, workflow, and vision. Code implementation is open for contributors.

## How You Can Help
- **Developers**: Help turn this vision into a working React app.
- **Supporters**: Fund hosting and API costs to launch MyGpt publicly.
- **Collaborators**: Share ideas, improve personas, or design UI.

## Contact
Created by Jayaprakash. Reach out me at smaniaxb@gmail.com if you’d like to collaborate!

---

## 🧠 How It Works

MyGpt operates on a multi-stage architecture designed to mimic a panel of human experts solving a problem.

### 1. Intelligent Routing ( The Manager )
When you submit a prompt or attach a file, the system doesn't just answer immediately. An **AI Router** analyzes your intent and context to select the best "team" for the job.
*   *Need code?* It recruits the **Cursor Agent** and **GitHub Copilot** simulators.
*   *Need an image?* It recruits the **Gemini Image** generator.
*   *Need creative writing?* It recruits the **Claude 3.5 Sonnet** simulator.

### 2. Expert Deliberation ( The Workers )
The selected experts run in **parallel**, each generating a response based on their specific system instructions and role.
*   **Text Experts** provide reasoning, code, or analysis.
*   **Visual Experts** generate high-fidelity images using `gemini-2.5-flash-image`.
*   This parallel execution ensures diverse perspectives and prevents "tunnel vision."

### 3. Judicial Synthesis ( The Judge )
Once the experts have finished, a powerful **Consensus Judge** (`gemini-3-pro-preview`) reads the user's original prompt and *all* the expert responses.
*   It resolves conflicts between experts.
*   It merges the best code snippets into a single solution.
*   It filters out hallucinations (facts stated by one model but contradicted by others).
*   It formats the final answer into a clean, authoritative response.

---

## 🚀 Key Features

*   **Multi-Model Orchestration**: dynamically routes queries to simulated versions of GPT-4o, Claude 3.5, and specialized coding agents.
*   **Visual Intelligence**: Integrated image generation that works alongside text reasoning.
*   **File Context**: Support for analyzing attached files with specialized analytical models.
*   **Streaming Consensus**: Watch the final verdict being written in real-time.
*   **Robust Error Handling**: Advanced exponential backoff strategies to handle API rate limits gracefully.
*   **Transparent Process**: You can expand the "Expert Deliberation" accordion to see exactly what every individual AI model proposed before the final answer was formed.

---

## 🌟 How It Differs from Traditional Chatbots

Most AI apps (like ChatGPT or standard Gemini) rely on a **Linear Interaction**: You ask one model, and it gives one answer. MyGpt offers several distinct advantages:

### 1. Accuracy via Consensus
Single models often "hallucinate" or make up facts. By querying 3-4 models simultaneously, MyGpt acts as a self-correcting system. If two experts say "X" and one says "Y", the Judge model can evaluate the evidence and provide the correct answer, significantly reducing error rates.

### 2. Specialized over Generalized
A general chatbot tries to be good at everything but often masters nothing. MyGpt dynamically swaps its "brain." If you ask for Python code, it uses a coding-specific prompt structure. If you ask for a poem, it uses a creative writing structure. You get the specialist, not the generalist.

### 3. The "Manager-Worker" Workflow
In complex tasks (like coding a full feature), a single model often forgets requirements halfway through generation. MyGpt splits the load: specific workers handle the implementation details, while the Judge ensures the high-level requirements are met in the final output.

### 4. Visual + Textual Integration
Unlike apps that force you to choose between a "text mode" or an "image mode," MyGpt handles both simultaneously. The router can decide to generate an image *and* provide a textual explanation in the same turn if the context demands it.

---

## 🛠 Tech Stack

*   **Frontend**: React 19, TypeScript, Tailwind CSS
*   **AI orchestration**: Google GenAI SDK (Gemini 3 Flash, Gemini 3 Pro, Gemini 2.5 Image)
*   **Markdown Rendering**: `react-markdown` with GFM support
*   **Architecture**: Client-side logic for maximum privacy and speed.

---

## Getting Started

1.  Clone the repository.
2.  Install dependencies: `npm install`
3.  Run the app: `npm run dev`
