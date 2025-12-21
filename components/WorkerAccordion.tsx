import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { WorkerResult } from '../types';

const WorkerCard: React.FC<{ result: WorkerResult }> = ({ result }) => {
  const [isOpen, setIsOpen] = useState(false);

  // Status colors
  const statusColor = 
    result.status === 'success' ? 'border-green-500/30 bg-green-900/10 text-green-400' :
    result.status === 'error' ? 'border-red-500/30 bg-red-900/10 text-red-400' :
    'border-blue-500/30 bg-blue-900/10 text-blue-400 animate-pulse';

  return (
    <div className={`border rounded-lg mb-3 overflow-hidden transition-all duration-200 ${isOpen ? 'border-slate-600 bg-slate-800/50' : 'border-slate-800 bg-slate-900'}`}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-800 transition-colors"
      >
        <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 overflow-hidden">
          <div className="flex items-center gap-3">
            <div className={`shrink-0 w-2 h-2 rounded-full ${result.status === 'success' ? 'bg-green-500' : result.status === 'error' ? 'bg-red-500' : 'bg-blue-500'}`} />
            <span className="font-semibold text-slate-200 text-sm md:text-base truncate">{result.expert.name}</span>
          </div>
          <span className="hidden md:inline text-slate-600">|</span>
          <span className="text-xs text-brand-400 font-mono uppercase tracking-wide truncate max-w-[200px] md:max-w-none">
            {result.expert.role}
          </span>
          {result.executionTime && (
            <span className="text-xs text-slate-500 font-mono ml-auto md:ml-2">
              {result.executionTime}ms
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 pl-2">
            <span className={`text-[10px] md:text-xs px-2 py-0.5 rounded border ${statusColor}`}>
                {result.status.toUpperCase()}
            </span>
            <svg className={`w-4 h-4 text-slate-400 transform transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
        </div>
      </button>
      
      {isOpen && (
        <div className="p-4 border-t border-slate-700/50 bg-slate-950/30">
            <div className="mb-4 text-xs text-slate-500 italic flex items-center gap-2">
                <span className="bg-slate-800 px-2 py-0.5 rounded text-slate-400">Persona</span>
                {result.expert.description}
            </div>
            <div className="text-slate-300 text-sm">
             {result.content ? (
                <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    className="prose prose-invert prose-sm max-w-none 
                        prose-pre:bg-black/50 prose-pre:border prose-pre:border-slate-800
                        prose-code:text-brand-200 prose-code:before:content-none prose-code:after:content-none
                        prose-a:text-brand-400"
                >
                    {result.content}
                </ReactMarkdown>
             ) : (
                 <span className="animate-pulse text-slate-500">Waiting for response...</span>
             )}
          </div>
        </div>
      )}
    </div>
  );
};

export const WorkerAccordion: React.FC<{ results: WorkerResult[] }> = ({ results }) => {
  return (
    <div className="mt-8 border-t border-slate-800 pt-8">
      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
        Expert Deliberation ({results.length})
      </h3>
      <div className="grid grid-cols-1 gap-2">
        {results.map((result) => (
          <WorkerCard key={result.expert.id} result={result} />
        ))}
      </div>
    </div>
  );
};