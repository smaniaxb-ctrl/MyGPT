
import React, { useState, useRef, useEffect } from 'react';
import { identifyExperts, runWorkerModels, streamJudgeConsensus, runCriticReview, detectFraming } from './services/consensusService';
import { ConsensusDisplay } from './components/ConsensusDisplay';
import { WorkerAccordion } from './components/WorkerAccordion';
import { ChatTurn, FileAttachment, UserPreferences, ChatSession, FramingProfile } from './types';

const STORAGE_KEY_PREFS = 'consensus_prefs';
const STORAGE_KEY_SESSIONS = 'consensus_sessions';

const App: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  // Lazy initialization ensures consistent ID generation
  const [activeSessionId, setActiveSessionId] = useState<string>(() => Date.now().toString());
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMemoryOpen, setIsMemoryOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(true);

  // Persistent Memory State
  const [preferences, setPreferences] = useState<UserPreferences>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_PREFS);
    return saved ? JSON.parse(saved) : {
      persona: 'Professional Consultant',
      style: 'Logical & Structured',
      technicalContext: 'General knowledge',
      memoryEnabled: true
    };
  });

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialization & Persistence
  useEffect(() => {
    const savedSessions = localStorage.getItem(STORAGE_KEY_SESSIONS);
    let historySessions: ChatSession[] = [];

    if (savedSessions) {
      try {
        historySessions = JSON.parse(savedSessions);
        // Filter out empty sessions from the past to keep history clean
        historySessions = historySessions.filter(s => s.turns.length > 0);
      } catch (e) {
        console.error("Failed to parse sessions", e);
      }
    }
    
    // Always start with a fresh session on app load
    const newSession: ChatSession = { 
        id: activeSessionId, 
        title: 'New Conversation', 
        turns: [], 
        updatedAt: Date.now() 
    };
    
    // Prepend new session to history, ensuring no duplicates from React Strict Mode
    setSessions(prev => {
        const exists = prev.some(s => s.id === activeSessionId);
        if (exists) return prev;
        return [newSession, ...historySessions];
    });

    const checkKey = async () => {
      const win = window as any;
      if (win.aistudio) setHasApiKey(await win.aistudio.hasSelectedApiKey());
    };
    checkKey();
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_PREFS, JSON.stringify(preferences));
  }, [preferences]);

  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(sessions));
    }
  }, [sessions]);

  useEffect(() => {
    if (isProcessing) window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
  }, [isProcessing]);

  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0];
  const turns = activeSession?.turns || [];

  const createNewSession = () => {
    const newId = Date.now().toString();
    const newSession: ChatSession = { id: newId, title: 'New Conversation', turns: [], updatedAt: Date.now() };
    setSessions([newSession, ...sessions]);
    setActiveSessionId(newId);
    setIsHistoryOpen(false);
  };

  const deleteSession = (id: string) => {
    const filtered = sessions.filter(s => s.id !== id);
    if (filtered.length === 0) {
        createNewSession();
    } else {
        setSessions(filtered);
        if (id === activeSessionId) setActiveSessionId(filtered[0].id);
    }
  };

  const clearAllHistory = () => {
    if (window.confirm('Are you sure you want to clear ALL history? This cannot be undone.')) {
        localStorage.removeItem(STORAGE_KEY_SESSIONS);
        // Reset to a single blank session
        const newId = Date.now().toString();
        const newSession: ChatSession = { id: newId, title: 'New Conversation', turns: [], updatedAt: Date.now() };
        setSessions([newSession]);
        setActiveSessionId(newId);
        setIsHistoryOpen(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles: FileAttachment[] = [];
      for (let i = 0; i < e.target.files.length; i++) {
        const file = e.target.files[i];
        const reader = new FileReader();
        await new Promise<void>(r => {
          reader.onload = (evt) => {
            newFiles.push({ name: file.name, mimeType: file.type, data: (evt.target?.result as string).split(',')[1] });
            r();
          };
          reader.readAsDataURL(file);
        });
      }
      setAttachments(prev => [...prev, ...newFiles]);
    }
  };

  const insertModeTrigger = (triggerText: string) => {
    setPrompt(prev => {
        // Avoid double insertion
        if (prev.startsWith(triggerText)) return prev;
        return triggerText + " " + prev;
    });
    textareaRef.current?.focus();
  };

  const handleSubmit = async () => {
    if (!prompt.trim() && attachments.length === 0) return;

    const currentPrompt = prompt;
    const currentAttachments = [...attachments];
    setPrompt(''); setAttachments([]); setIsProcessing(true);

    const newTurn: ChatTurn = {
      id: Date.now().toString(),
      userPrompt: currentPrompt,
      attachments: currentAttachments,
      step: 'framing',
      selectedExperts: [],
      workerResults: [],
      consensusContent: '',
      timestamp: Date.now(),
      totalTokens: 0,
      preferencesAtTime: { ...preferences }
    };

    const updateSession = (updatedTurn: Partial<ChatTurn>) => {
      setSessions(prev => prev.map(s => {
        if (s.id !== activeSessionId) return s;
        const turnsCopy = [...s.turns];
        const turnIndex = turnsCopy.findIndex(t => t.id === newTurn.id);
        if (turnIndex === -1) return s;
        
        turnsCopy[turnIndex] = { ...turnsCopy[turnIndex], ...updatedTurn };
        return { 
          ...s, 
          turns: turnsCopy, 
          title: s.turns.length === 1 && s.title === 'New Conversation' ? currentPrompt.substring(0, 30) + '...' : s.title,
          updatedAt: Date.now() 
        };
      }));
    };

    setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, turns: [...s.turns, newTurn] } : s));

    try {
      // 0. Framing Detection (Guardrails)
      const framingProfile = await detectFraming(currentPrompt);
      updateSession({ step: 'routing', framingProfile });

      // 1. Routing
      const experts = await identifyExperts(currentPrompt, currentAttachments, turns, preferences, framingProfile);
      updateSession({ step: 'gathering', selectedExperts: experts });

      // 2. Gathering
      const workers = await runWorkerModels(experts, currentPrompt, currentAttachments, turns, preferences, framingProfile, (res) => updateSession({ workerResults: res }));
      const workerTokens = workers.reduce((acc, w) => acc + (w.estimatedTokens || 0), 0);
      updateSession({ step: 'judging', workerResults: workers, totalTokens: workerTokens });

      // 3. Judging (Streaming)
      const judgeTokens = await streamJudgeConsensus(currentPrompt, workers, turns, preferences, framingProfile, (chunk) => {
        setSessions(p => p.map(s => {
            if (s.id !== activeSessionId) return s;
            const newTurns = [...s.turns];
            const turnIndex = newTurns.findIndex(t => t.id === newTurn.id);
            newTurns[turnIndex].consensusContent += chunk;
            return { ...s, turns: newTurns };
        }));
      });
      
      const currentConsensus = (sessions.find(s => s.id === activeSessionId)?.turns.find(t => t.id === newTurn.id)?.consensusContent) || "";
      updateSession({ step: 'criticizing', totalTokens: workerTokens + judgeTokens });

      // 4. Criticizing (Self-Correction)
      const criticResult = await runCriticReview(currentPrompt, workers, currentConsensus, framingProfile);
      updateSession({ 
        step: 'complete', 
        criticContent: criticResult.text, 
        totalTokens: workerTokens + judgeTokens + criticResult.tokens 
      });

    } catch (e) {
      updateSession({ step: 'error', error: "Critical process failure." });
    } finally { setIsProcessing(false); }
  };

  return (
    <div className="min-h-screen bg-dark-950 text-slate-300 font-sans selection:bg-brand-500/30">
      <header className="sticky top-0 z-50 bg-dark-950/80 backdrop-blur-lg border-b border-slate-800">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <button onClick={() => setIsHistoryOpen(true)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" /></svg>
                </button>
                <div className="hidden sm:block">
                    <h1 className="font-bold text-lg text-white tracking-tight">Firm of Experts</h1>
                    <p className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">The Consensus Engine</p>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <button onClick={() => setIsMemoryOpen(!isMemoryOpen)} className={`p-2 rounded-lg border transition-all flex items-center gap-2 text-xs font-bold ${isMemoryOpen ? 'bg-brand-600 border-brand-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'}`}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A10.003 10.003 0 0012 20m0 0c2.226 0 4.23-.89 5.707-2.333M12 7V3m0 0l3 3m-3-3l-3 3m0 0a10.003 10.003 0 0111.41 11.41M12 7c-3.517 0-6.799 1.009-9.571 2.753" /></svg>
                    Context
                </button>
            </div>
        </div>
      </header>

      {/* History Sidebar */}
      {isHistoryOpen && (
        <>
            <div className="fixed inset-0 bg-black/60 z-[60] backdrop-blur-sm animate-in fade-in" onClick={() => setIsHistoryOpen(false)} />
            <div className="fixed left-0 top-0 bottom-0 w-80 bg-slate-900 border-r border-slate-800 z-[70] p-6 shadow-2xl animate-in slide-in-from-left duration-300">
                <div className="flex items-center justify-between mb-8">
                    <h3 className="text-white font-bold flex items-center gap-2">
                        <svg className="w-5 h-5 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Session History
                    </h3>
                    <button onClick={createNewSession} className="p-2 bg-brand-600/20 text-brand-400 rounded-lg hover:bg-brand-600 hover:text-white transition-all">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    </button>
                </div>

                <button onClick={clearAllHistory} className="w-full mb-6 py-3 px-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs font-bold hover:bg-red-500/20 hover:text-red-300 transition-all flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    Clear All History
                </button>

                <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-200px)]">
                    {sessions.map(s => (
                        <div key={s.id} className="group relative">
                            <button 
                                onClick={() => { setActiveSessionId(s.id); setIsHistoryOpen(false); }}
                                className={`w-full text-left p-3 rounded-xl border transition-all ${s.id === activeSessionId ? 'bg-brand-600/10 border-brand-500/50 text-white' : 'bg-slate-800/40 border-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-200'}`}
                            >
                                <p className="text-sm font-medium truncate pr-6">{s.title || 'Untitled'}</p>
                                <p className="text-[10px] text-slate-500 mt-1">{new Date(s.updatedAt).toLocaleDateString()}</p>
                            </button>
                            <button 
                                onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-2 text-slate-500 hover:text-red-500 transition-all"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </>
      )}

      {/* Context Panel */}
      {isMemoryOpen && (
          <div className="max-w-5xl mx-auto px-6 mt-6 animate-in slide-in-from-top-4">
              <div className="bg-slate-900 border border-brand-500/30 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
                <h3 className="text-white font-bold mb-4 flex items-center gap-2"><svg className="w-5 h-5 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg> Global Settings</h3>
                <div className="grid md:grid-cols-3 gap-6">
                    <div><label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Your Persona</label>
                    <input value={preferences.persona} onChange={e => setPreferences({...preferences, persona: e.target.value})} className="w-full bg-dark-950 border border-slate-700 rounded-lg p-2 text-sm text-white focus:border-brand-500 outline-none" placeholder="e.g. Senior Architect" /></div>
                    <div><label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Style Bias</label>
                    <input value={preferences.style} onChange={e => setPreferences({...preferences, style: e.target.value})} className="w-full bg-dark-950 border border-slate-700 rounded-lg p-2 text-sm text-white focus:border-brand-500 outline-none" placeholder="e.g. Technical & Dense" /></div>
                    <div><label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Tech Context</label>
                    <input value={preferences.technicalContext} onChange={e => setPreferences({...preferences, technicalContext: e.target.value})} className="w-full bg-dark-950 border border-slate-700 rounded-lg p-2 text-sm text-white focus:border-brand-500 outline-none" placeholder="e.g. Node.js backend" /></div>
                </div>
              </div>
          </div>
      )}

      <main className="max-w-5xl mx-auto px-6 py-12 pb-72">
        {turns.length === 0 && (
           <div className="text-center mb-12 py-24">
              <h2 className="text-5xl md:text-6xl font-extrabold text-white mb-6 tracking-tight leading-none">Intelligence via <br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 via-indigo-400 to-purple-400">Consensus</span></h2>
              <p className="text-xl text-slate-400 max-w-2xl mx-auto font-medium italic">"Trust is built through diversity of opinion."</p>
           </div>
        )}

        <div className="space-y-24">
            {turns.map(turn => (
                <div key={turn.id} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex justify-end mb-10">
                        <div className="max-w-[85%] bg-slate-800 text-slate-100 px-8 py-5 rounded-3xl rounded-tr-none border border-slate-700 shadow-2xl">
                            <p className="whitespace-pre-wrap leading-relaxed">{turn.userPrompt}</p>
                            {turn.attachments.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{turn.attachments.map((f, i) => <div key={i} className="text-[9px] bg-dark-950/50 px-3 py-1.5 rounded-full border border-slate-600 text-brand-400 font-bold uppercase tracking-widest">{f.name}</div>)}</div>}
                        </div>
                    </div>
                    {turn.consensusContent || turn.step === 'judging' ? (
                      <ConsensusDisplay 
                        content={turn.consensusContent} 
                        isThinking={turn.step === 'judging' || turn.step === 'criticizing'} 
                        criticContent={turn.criticContent}
                        totalTokens={turn.totalTokens}
                      />
                    ) : null}
                    {turn.workerResults.length > 0 && <WorkerAccordion results={turn.workerResults} />}
                    {turn.error && <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-500 text-sm mt-4">{turn.error}</div>}
                </div>
            ))}
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-dark-950/95 backdrop-blur-2xl border-t border-slate-800 p-6 z-40">
        <div className="max-w-4xl mx-auto">
            
            {/* Added Helper Text */}
            <div className="flex items-center gap-2 mb-2 px-1">
                <span className="text-[10px] font-bold text-brand-500 uppercase tracking-wider flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse"></span>
                    Auto-Pilot Active
                </span>
                <span className="text-[10px] text-slate-500">
                    &mdash; The system will choose experts for you. Click below <strong>only</strong> to force a specific mode.
                </span>
            </div>

            {/* Engine Mode Selector */}
            <div className="flex gap-2 mb-3 overflow-x-auto pb-1 scrollbar-none">
                <button title="Force deep logic, math, and first-principles thinking." onClick={() => insertModeTrigger("Act as the Analyst:")} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all whitespace-nowrap">
                    <span>🧠</span> Analyst Mode
                </button>
                <button title="Force lateral thinking, metaphors, and novel ideas." onClick={() => insertModeTrigger("Act as the Creative:")} className="flex items-center gap-1.5 px-3 py-1.5 bg-fuchsia-500/10 hover:bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/30 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all whitespace-nowrap">
                    <span>🎨</span> Creative Mode
                </button>
                <button title="Force strict code, structure, and system architecture." onClick={() => insertModeTrigger("Act as the Engineer:")} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all whitespace-nowrap">
                    <span>🏗️</span> Engineer Mode
                </button>
                <button title="Force a critical audit to find flaws and risks." onClick={() => insertModeTrigger("Red team this idea:")} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all whitespace-nowrap">
                    <span>🛡️</span> Red Team
                </button>
            </div>

            <div className="flex gap-4 items-end">
                <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" multiple />
                <button onClick={() => fileInputRef.current?.click()} className="p-4 rounded-2xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-brand-400 transition-all flex-shrink-0 shadow-lg hover:shadow-brand-500/10"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg></button>
                <div className="relative flex-1">
                    {attachments.length > 0 && (
                        <div className="flex gap-2 mb-2">
                            {attachments.map((f, i) => (
                                <div key={i} className="group relative text-[9px] bg-brand-600/20 text-brand-400 px-3 py-1.5 rounded-full border border-brand-500/30 font-bold uppercase tracking-wider">
                                    {f.name}
                                    <button onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))} className="ml-2 hover:text-red-500 font-bold">×</button>
                                </div>
                            ))}
                        </div>
                    )}
                    <textarea 
                        ref={textareaRef} 
                        value={prompt} 
                        onChange={e => setPrompt(e.target.value)} 
                        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSubmit())} 
                        placeholder="Deliberate on a complex problem..." 
                        className="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-2xl py-5 pl-7 pr-40 focus:outline-none focus:ring-2 focus:ring-brand-500/50 shadow-2xl resize-none max-h-48" 
                        rows={1} 
                    />
                    <button 
                        onClick={handleSubmit} 
                        disabled={isProcessing || (!prompt.trim() && attachments.length === 0)} 
                        className="absolute right-3 bottom-3 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-xl px-6 py-3 transition-all flex items-center gap-2 shadow-lg shadow-brand-600/30 disabled:opacity-50 disabled:grayscale"
                    >
                        {isProcessing ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Processing...
                            </>
                        ) : 'Synthesize'}
                    </button>
                </div>
            </div>
            <p className="text-center text-[9px] text-slate-600 mt-4 uppercase tracking-[0.2em] font-bold">Orchestration Protocol v2.2 • Est. Token Monitor Enabled</p>
        </div>
      </div>
    </div>
  );
};

export default App;
