import React, { useState, useRef, useEffect } from 'react';
import { identifyExperts, runWorkerModels, streamJudgeConsensus } from './services/consensusService';
import { ConsensusDisplay } from './components/ConsensusDisplay';
import { WorkerAccordion } from './components/WorkerAccordion';
import { ConsensusState, FileAttachment } from './types';

const App: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [state, setState] = useState<ConsensusState>({
    isProcessing: false,
    step: 'idle',
    userPrompt: '',
    selectedExperts: [],
    workerResults: [],
    consensusContent: '',
  });

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll logic for content
  // We scroll to the bottom of the document, relying on the main container's bottom padding
  // to ensure content sits above the fixed footer.
  useEffect(() => {
    if (state.isProcessing) {
        window.scrollTo({ 
            top: document.documentElement.scrollHeight, 
            behavior: 'smooth' 
        });
    }
  }, [state.consensusContent, state.step, state.workerResults]);

  // Auto-expand textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollHeight, 200)}px`;
    }
  }, [prompt]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newAttachments: FileAttachment[] = [];
      
      for (let i = 0; i < e.target.files.length; i++) {
        const file = e.target.files[i];
        
        // Convert to base64
        const reader = new FileReader();
        await new Promise<void>((resolve) => {
            reader.onload = (evt) => {
                const result = evt.target?.result as string;
                // Strip the data url prefix to get just the base64
                const base64Data = result.split(',')[1];
                
                newAttachments.push({
                    name: file.name,
                    mimeType: file.type,
                    data: base64Data
                });
                resolve();
            };
            reader.readAsDataURL(file);
        });
      }
      
      setAttachments(prev => [...prev, ...newAttachments]);
    }
    // Reset input so same file can be selected again if needed
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!prompt.trim() && attachments.length === 0) || state.isProcessing) return;

    // Reset State
    setState({
      isProcessing: true,
      step: 'routing',
      userPrompt: prompt,
      selectedExperts: [],
      workerResults: [],
      consensusContent: '',
    });

    try {
      // Step 1: Routing / Orchestration
      // Pass the attachment info so router knows we have files
      const experts = await identifyExperts(prompt, attachments);
      
      setState(prev => ({ 
        ...prev, 
        step: 'gathering', 
        selectedExperts: experts,
        workerResults: experts.map(e => ({ expert: e, content: '', status: 'pending' }))
      }));

      // Step 2: Parallel Execution
      const workers = await runWorkerModels(experts, prompt, attachments, (currentResults) => {
        setState(prev => ({ ...prev, workerResults: currentResults }));
      });

      // Step 3: Judging
      setState(prev => ({ ...prev, step: 'judging', workerResults: workers }));

      await streamJudgeConsensus(prompt, attachments, workers, (chunk) => {
        setState(prev => ({ 
          ...prev, 
          consensusContent: prev.consensusContent + chunk 
        }));
      });

      // Done
      setState(prev => ({ ...prev, isProcessing: false, step: 'complete' }));

    } catch (error) {
      console.error("Workflow failed", error);
      setState(prev => ({ 
        ...prev, 
        isProcessing: false, 
        step: 'idle', 
        error: "An unexpected error occurred during the consensus process." 
      }));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleClear = () => {
    setPrompt('');
    setAttachments([]);
    setState({
      isProcessing: false,
      step: 'idle',
      userPrompt: '',
      selectedExperts: [],
      workerResults: [],
      consensusContent: '',
    });
    if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
    }
  };

  return (
    <div className="min-h-screen bg-dark-950 font-sans text-slate-300 selection:bg-brand-500/30">
      
      {/* Header */}
      <header className="sticky top-0 z-50 bg-dark-950/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-tr from-brand-500 to-purple-500 rounded-lg flex items-center justify-center text-white font-bold text-lg">C</div>
                <h1 className="font-bold text-xl text-slate-100 tracking-tight">Consensus Engine</h1>
            </div>
            <div className="hidden md:flex gap-4 text-xs text-slate-500">
                <span>Multi-Agent System</span>
                <span>•</span>
                <span>Dynamic Routing</span>
            </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-12 pb-72">
        
        {/* Intro / Empty State */}
        {state.step === 'idle' && !state.consensusContent && (
           <div className="text-center mb-12 py-12">
              <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-6 tracking-tight">
                The <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-purple-400">Wisdom of Crowds</span><br/> for AI.
              </h2>
              <p className="text-lg text-slate-400 max-w-2xl mx-auto">
                Ask anything. We dynamically route your query to specialized AI experts (Cursor, Midjourney, Academic Tutors, etc.) and synthesize a consensus answer.
              </p>
           </div>
        )}

        {/* Results Area */}
        <div className="space-y-8">
            
            {/* Status Bar for Routing Phase */}
            {state.step === 'routing' && (
                <div className="flex items-center justify-center space-x-3 p-8">
                     <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
                     <span className="text-brand-400 font-mono text-sm">Analyzing intent and selecting experts...</span>
                </div>
            )}

            {/* Selected Experts Banner */}
            {state.selectedExperts.length > 0 && (
                <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Selected Experts for this task</div>
                    <div className="flex flex-wrap gap-2">
                        {state.selectedExperts.map(exp => (
                            <span key={exp.id} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-900/20 border border-brand-500/20 text-brand-300 text-xs font-medium">
                                <span>{exp.name}</span>
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Main Content */}
            {(state.step === 'gathering' || state.step === 'judging' || state.step === 'complete') && (
                <>
                    <ConsensusDisplay 
                        content={state.consensusContent} 
                        isThinking={state.step === 'judging' || state.step === 'gathering'} 
                    />
                    
                    {state.step === 'gathering' && (
                        <div className="text-center text-sm text-slate-500 animate-pulse">
                             Waiting for expert responses...
                        </div>
                    )}

                    <WorkerAccordion results={state.workerResults} />
                </>
            )}
        </div>

      </main>

      {/* Input Area */}
      <div className="fixed bottom-0 left-0 right-0 bg-dark-950/90 backdrop-blur-lg border-t border-slate-800 p-4 md:p-6 z-40">
        <div className="max-w-3xl mx-auto flex gap-3 items-end">
            
            {/* Hidden File Input */}
            <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileSelect} 
                className="hidden" 
                multiple 
            />

            {/* Clear Button */}
            {(prompt || state.consensusContent || attachments.length > 0) && (
                <button
                    onClick={handleClear}
                    type="button"
                    disabled={state.isProcessing}
                    className="mb-1 p-3.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700 transition-all disabled:opacity-50 flex-shrink-0"
                    title="Clear input and output"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
            )}

            {/* File Button */}
             <button
                onClick={() => fileInputRef.current?.click()}
                type="button"
                disabled={state.isProcessing}
                className="mb-1 p-3.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-brand-400 hover:border-brand-500/50 hover:bg-slate-700 transition-all disabled:opacity-50 flex-shrink-0"
                title="Attach Files"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
            </button>

            <div className="relative flex-1">
                {/* File Preview Chips */}
                {attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2 p-1">
                        {attachments.map((file, idx) => (
                            <div key={idx} className="flex items-center gap-2 bg-slate-800 text-slate-200 text-xs px-3 py-1.5 rounded-full border border-slate-700">
                                <span className="truncate max-w-[150px]">{file.name}</span>
                                <button onClick={() => removeAttachment(idx)} className="text-slate-500 hover:text-red-400">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <textarea
                    ref={textareaRef}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={state.isProcessing}
                    rows={1}
                    placeholder={attachments.length > 0 ? "Ask about these files..." : "Ask a question..."}
                    className="w-full bg-slate-900 border border-slate-700 text-slate-200 placeholder-slate-500 rounded-xl py-4 pl-6 pr-40 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed resize-none overflow-hidden min-h-[56px] max-h-[200px]"
                />
                <button
                    onClick={() => handleSubmit()}
                    disabled={(!prompt.trim() && attachments.length === 0) || state.isProcessing}
                    className="absolute right-2 bottom-2 bg-brand-600 hover:bg-brand-500 text-white font-medium rounded-lg px-4 py-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    {state.isProcessing ? (
                        <>
                            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span className="hidden sm:inline">Processing</span>
                        </>
                    ) : (
                        <>
                            <span>Synthesize</span>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        </>
                    )}
                </button>
            </div>
        </div>
      </div>

    </div>
  );
};

export default App;