import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Props {
  content: string;
  isThinking: boolean;
}

export const ConsensusDisplay: React.FC<Props> = ({ content, isThinking }) => {
  
  const handleDownload = () => {
    if (!content) return;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'consensus-output.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="relative group">
      <div className="absolute -inset-1 bg-gradient-to-r from-brand-600 to-purple-600 rounded-xl blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
      <div className="relative bg-dark-900 border border-slate-700 rounded-xl p-6 md:p-8 shadow-2xl">
        
        <div className="flex items-center justify-between mb-6 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-900/30 rounded-lg border border-brand-500/30">
              <svg className="w-6 h-6 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">MyGpt</h2>
              <p className="text-xs text-brand-400 font-medium uppercase tracking-widest">
                {isThinking ? 'Synthesizing Intelligence...' : 'Final Verdict'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
              {content && !isThinking && (
                  <button 
                    onClick={handleDownload}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-400 border border-slate-700 rounded-lg hover:text-white hover:bg-slate-800 transition-colors bg-slate-900/50"
                    title="Download result"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    <span className="hidden sm:inline">Save</span>
                  </button>
              )}

              {isThinking && (
                 <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-brand-500 rounded-full animate-bounce delay-0"></div>
                    <div className="w-2 h-2 bg-brand-500 rounded-full animate-bounce delay-150"></div>
                    <div className="w-2 h-2 bg-brand-500 rounded-full animate-bounce delay-300"></div>
                 </div>
              )}
          </div>
        </div>

        <div className="min-h-[200px] text-slate-200 leading-7">
          {content ? (
             <ReactMarkdown 
               remarkPlugins={[remarkGfm]}
               className="prose prose-invert prose-lg max-w-none 
                 prose-headings:text-brand-50 prose-headings:font-bold prose-headings:tracking-tight
                 prose-p:text-slate-300 prose-p:leading-relaxed
                 prose-a:text-brand-400 prose-a:no-underline hover:prose-a:text-brand-300 hover:prose-a:underline
                 prose-strong:text-white prose-strong:font-semibold
                 prose-ul:marker:text-slate-500
                 prose-code:text-brand-200 prose-code:bg-slate-950/50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:font-mono prose-code:before:content-none prose-code:after:content-none
                 prose-pre:bg-slate-950/80 prose-pre:border prose-pre:border-slate-800 prose-pre:rounded-xl prose-pre:p-4
                 prose-blockquote:border-l-brand-500 prose-blockquote:bg-slate-800/20 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:rounded-r-lg prose-blockquote:not-italic
                 prose-hr:border-slate-800
                 prose-table:text-sm
                 prose-th:bg-slate-800/50 prose-th:p-2 prose-th:text-slate-200
                 prose-td:p-2 prose-td:border-b prose-td:border-slate-800"
             >
               {content}
             </ReactMarkdown>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-slate-600">
               <svg className="w-12 h-12 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
               </svg>
               <p>Enter a query to begin the multi-model consensus process.</p>
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
};