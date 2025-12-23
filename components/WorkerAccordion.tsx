
import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { WorkerResult } from '../types';

const WorkerCard: React.FC<{ result: WorkerResult }> = ({ result }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExecuted, setIsExecuted] = useState(false);

  const handleExecute = () => {
    if (!result.actionDraft) return;
    
    const { type, recipient, subject, body } = result.actionDraft;
    
    if (type === 'email') {
        const mailto = `mailto:${recipient || ''}?subject=${encodeURIComponent(subject || 'Draft from Consensus Engine')}&body=${encodeURIComponent(body)}`;
        window.open(mailto, '_blank');
    } else {
        navigator.clipboard.writeText(body);
        alert('Action content copied to clipboard.');
    }
    
    setIsExecuted(true);
  };

  return (
    <div className={`border rounded-lg mb-3 overflow-hidden transition-all duration-200 ${isOpen ? 'border-slate-600 bg-slate-800/50' : 'border-slate-800 bg-slate-900'}`}>
      <button onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-800 transition-colors">
        <div className="flex items-center gap-4">
           <div className={`w-2 h-2 rounded-full ${result.status === 'success' ? 'bg-green-500' : 'bg-blue-500'}`} />
           <span className="font-semibold text-slate-200">{result.expert.name}</span>
           <span className="text-[10px] text-brand-400 font-mono uppercase tracking-widest">{result.expert.role}</span>
        </div>
        <div className="flex items-center gap-3">
            {result.estimatedTokens && <span className="text-[10px] text-slate-500 font-mono">~{result.estimatedTokens} tokens</span>}
            {result.executionTime && <span className="text-[10px] text-slate-500 font-mono">{result.executionTime}ms</span>}
            <svg className={`w-4 h-4 text-slate-400 transform transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </div>
      </button>
      
      {isOpen && (
        <div className="p-4 border-t border-slate-700/50 bg-slate-950/30">
            {result.actionDraft && (
                <div className="mb-6 p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-2 text-[10px] font-bold text-indigo-400/50 uppercase tracking-tighter">Action Draft</div>
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-indigo-600 rounded-lg text-white">
                             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                        </div>
                        <div>
                            <h4 className="text-white font-bold text-sm">Drafted {result.actionDraft.type}</h4>
                            <p className="text-xs text-indigo-400">Target: {result.actionDraft.recipient || 'Local Browser/Mail'}</p>
                        </div>
                    </div>
                    <div className="bg-black/20 p-3 rounded-lg text-xs text-slate-300 mb-4 font-mono whitespace-pre-wrap italic border border-white/5">
                        "{result.actionDraft.body}"
                    </div>
                    <button 
                        onClick={handleExecute}
                        className={`w-full py-2 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 ${isExecuted ? 'bg-green-600 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'}`}
                    >
                        {isExecuted ? 'Executed ✓' : result.actionDraft.type === 'email' ? 'Open in Mail Client' : 'Copy to Clipboard'}
                    </button>
                </div>
            )}

            {result.images && result.images.map((img, i) => (
                <div key={i} className="mb-4 rounded-lg border border-slate-700 overflow-hidden shadow-xl"><img src={`data:image/jpeg;base64,${img}`} className="w-full" /></div>
            ))}
            
            {result.videoUri && (
                <div className="mb-4 rounded-lg border border-slate-700 overflow-hidden shadow-xl">
                    <video controls src={`${result.videoUri}&key=${process.env.API_KEY}`} className="w-full" />
                </div>
            )}
            
            <div className="prose prose-invert prose-sm max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                    {result.content}
                </ReactMarkdown>
            </div>
            
            {result.groundingUrls && result.groundingUrls.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-800">
                    <p className="text-[10px] text-slate-500 uppercase font-bold mb-2">Sources Found:</p>
                    <div className="flex flex-wrap gap-2">
                        {result.groundingUrls.map((g, i) => (
                            <a key={i} href={g.uri} target="_blank" rel="noreferrer" className="text-[10px] bg-slate-800 text-brand-400 px-2 py-1 rounded hover:bg-slate-700 transition-colors truncate max-w-[150px]">
                                {g.title || g.uri}
                            </a>
                        ))}
                    </div>
                </div>
            )}
        </div>
      )}
    </div>
  );
};

export const WorkerAccordion: React.FC<{ results: WorkerResult[] }> = ({ results }) => (
    <div className="mt-8 border-t border-slate-800 pt-8">
      <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
        Parallel Deliberation Streams
      </h3>
      {results.map(r => <WorkerCard key={r.expert.id} result={r} />)}
    </div>
);
