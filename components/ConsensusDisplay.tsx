
import React, { useMemo, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

// Mermaid Rendering Component
const Mermaid: React.FC<{ chart: string }> = ({ chart }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [isMermaidReady, setIsMermaidReady] = useState(false);

  useEffect(() => {
    // Poll for mermaid availability in case script is still loading
    const checkMermaid = () => {
      if ((window as any).mermaid) {
        setIsMermaidReady(true);
      } else {
        setTimeout(checkMermaid, 250);
      }
    };
    checkMermaid();
  }, []);

  useEffect(() => {
    if (!isMermaidReady) return;

    let mounted = true;
    const renderMermaid = async () => {
      const win = window as any;
      if (ref.current && win.mermaid) {
        try {
          // Clear previous content/attributes that mermaid adds
          ref.current.removeAttribute('data-processed');
          ref.current.innerHTML = chart;
          
          await win.mermaid.run({
            nodes: [ref.current]
          });
        } catch (e) {
          // If syntax is invalid (e.g. incomplete streaming), it throws.
          if (mounted && ref.current) {
             // Instead of showing a red error immediately, show a loading state
             // because streaming markdown often leaves mermaid blocks incomplete temporarily.
             ref.current.innerHTML = `
                <div class="flex items-center justify-center gap-2 p-4 bg-brand-900/10 border border-brand-500/20 rounded-xl">
                   <div class="w-2 h-2 bg-brand-400 rounded-full animate-pulse"></div>
                   <div class="w-2 h-2 bg-brand-400 rounded-full animate-pulse delay-75"></div>
                   <div class="w-2 h-2 bg-brand-400 rounded-full animate-pulse delay-150"></div>
                   <span class="text-xs font-mono text-brand-400 uppercase tracking-widest ml-2">Visualizing Architecture...</span>
                </div>
                <pre class="hidden">${chart}</pre>
             `;
          }
        }
      }
    };

    renderMermaid();

    return () => {
      mounted = false;
    };
  }, [chart, isMermaidReady]);

  return (
    <div className="my-6 overflow-hidden">
       <div 
         key={chart} 
         ref={ref} 
         className="mermaid bg-slate-900/50 p-6 rounded-xl border border-slate-700 flex justify-center overflow-x-auto min-h-[60px]"
       />
    </div>
  );
};

interface Props {
  content: string;
  isThinking: boolean;
  criticContent?: string;
  totalTokens?: number;
}

export const ConsensusDisplay: React.FC<Props> = ({ content, isThinking, criticContent, totalTokens }) => {
  const [showCritic, setShowCritic] = useState(true);
  const [shareState, setShareState] = useState<'idle' | 'copied' | 'shared'>('idle');

  const { confidence, cleanContent } = useMemo(() => {
    if (!content) return { confidence: null, cleanContent: '' };
    const match = content.match(/(\*\*|)?Confidence:(\*\*|)?\s*(High|Medium|Low)/i);
    let confidence = match ? match[3].toUpperCase() : null;
    let cleaned = content.replace(/(\*\*|)?Confidence:(\*\*|)?\s*(High|Medium|Low)/i, '').trim();
    return { confidence, cleanContent: cleaned };
  }, [content]);

  const handleDownload = () => {
    const htmlTemplate = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>MyGPT Consensus Verdict</title>
        <script src="https://cdn.tailwindcss.com?plugins=typography"></script>
        <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
        <style>
          body { background-color: #0f172a; color: #e2e8f0; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
          .container { max-width: 800px; margin: 0 auto; padding: 2rem; }
          .prose { max-width: 100%; }
          /* Custom Scrollbar */
          ::-webkit-scrollbar { width: 8px; }
          ::-webkit-scrollbar-track { background: #1e293b; }
          ::-webkit-scrollbar-thumb { background: #475569; border-radius: 4px; }
        </style>
      </head>
      <body class="min-h-screen">
        <div class="container">
          <header class="mb-8 border-b border-slate-700 pb-6">
             <div class="flex items-center gap-3 mb-4">
                 <div class="p-2 bg-sky-900/30 rounded-lg border border-sky-500/30 text-sky-500 inline-block">
                    <!-- Simple Logo Icon -->
                    <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                 </div>
                 <h1 class="text-3xl font-bold text-white tracking-tight">Consensus Verdict</h1>
             </div>
             <div class="flex items-center gap-4 text-xs text-slate-400 font-mono uppercase tracking-wider">
                 <span>Generated via MyGPT</span>
                 <span>•</span>
                 <span>${new Date().toLocaleString()}</span>
             </div>
          </header>
          
          <main id="content" class="prose prose-invert prose-lg"></main>
          
          <footer class="mt-12 pt-8 border-t border-slate-800 text-center text-slate-600 text-xs">
            <p>Generated by The Consensus Engine Architecture</p>
          </footer>
        </div>
        <script>
          // Inject content and render markdown
          const markdownContent = ${JSON.stringify(cleanContent)};
          document.getElementById('content').innerHTML = marked.parse(markdownContent);
        </script>
      </body>
      </html>
    `;

    const blob = new Blob([htmlTemplate], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MyGPT-Verdict-${new Date().toISOString().slice(0,10)}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleShare = async () => {
    const textToShare = `MyGPT Consensus Verdict:\n\n${cleanContent}`;
    
    if (navigator.share) {
        try {
            await navigator.share({
                title: 'MyGPT Consensus Verdict',
                text: textToShare,
            });
            setShareState('shared');
            setTimeout(() => setShareState('idle'), 2000);
            return;
        } catch (err) {
            // Fall through
        }
    }

    try {
        await navigator.clipboard.writeText(textToShare);
        setShareState('copied');
        setTimeout(() => setShareState('idle'), 2000);
    } catch (err) {
        console.error('Failed to copy', err);
    }
  };

  const components = {
    code({ node, inline, className, children, ...props }: any) {
      const match = /language-(\w+)/.exec(className || '');
      if (!inline && match && match[1] === 'mermaid') {
        return <Mermaid chart={String(children).replace(/\n$/, '')} />;
      }
      return <code className={className} {...props}>{children}</code>;
    }
  };

  return (
    <div className="relative group">
      <div className="absolute -inset-1 bg-gradient-to-r from-brand-600 to-indigo-600 rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
      <div className="relative bg-dark-900 border border-slate-700 rounded-xl p-8 shadow-2xl">
        <div className="flex items-center justify-between mb-6 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-brand-900/30 rounded-lg border border-brand-500/30 text-brand-500">
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
             </div>
             <div>
                <h2 className="text-xl font-bold text-white tracking-tight">Synthesized Verdict</h2>
                <div className="flex gap-2 items-center">
                    <span className="text-[10px] uppercase font-bold text-slate-500">Judge: Gemini 3 Pro</span>
                    {confidence && <span className="text-[10px] px-2 py-0.5 bg-brand-500/10 text-brand-400 rounded-full border border-brand-500/20">{confidence} CONFIDENCE</span>}
                    {totalTokens !== undefined && totalTokens > 0 && <span className="text-[10px] px-2 py-0.5 bg-slate-800 text-slate-400 rounded-full border border-slate-700">~{totalTokens} Tokens</span>}
                </div>
             </div>
          </div>
          
          <div className="flex items-center gap-2">
              {!isThinking && (
                  <>
                    <button 
                        onClick={handleDownload}
                        className="p-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-400 hover:text-white hover:border-brand-500/50 hover:bg-slate-700 transition-all flex items-center gap-2 text-xs font-bold"
                        title="Download as Webpage"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        <span className="hidden sm:inline">Download</span>
                    </button>

                    <button 
                        onClick={handleShare}
                        className={`p-2 rounded-lg border transition-all duration-300 flex items-center gap-2 text-xs font-bold ${
                            shareState === 'idle' 
                            ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:border-brand-500/50' 
                            : 'bg-green-500/10 border-green-500/30 text-green-400'
                        }`}
                        title="Share Answer"
                    >
                        {shareState === 'idle' && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>}
                        {shareState === 'copied' && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
                        {shareState === 'shared' && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>}
                    </button>
                  </>
              )}
              {isThinking && <div className="flex space-x-1 px-4"><div className="w-2 h-2 bg-brand-500 rounded-full animate-bounce"></div><div className="w-2 h-2 bg-brand-500 rounded-full animate-bounce delay-150"></div><div className="w-2 h-2 bg-brand-500 rounded-full animate-bounce delay-300"></div></div>}
          </div>
        </div>

        <div className="prose prose-invert prose-lg max-w-none prose-pre:p-0 prose-pre:bg-transparent">
          <ReactMarkdown 
            remarkPlugins={[remarkGfm, remarkMath]} 
            rehypePlugins={[rehypeKatex]}
            components={components}
          >
            {cleanContent}
          </ReactMarkdown>
        </div>

        {criticContent && (
            <div className="mt-8 pt-6 border-t border-slate-800 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <button 
                  onClick={() => setShowCritic(!showCritic)}
                  className="flex items-center gap-2 mb-4 text-[10px] uppercase font-bold text-amber-500/80 hover:text-amber-400 transition-colors"
                >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    Consensus Auditor Review (Self-Correction)
                    <svg className={`w-3 h-3 transform transition-transform ${showCritic ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                {showCritic && (
                    <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-5 text-sm leading-relaxed text-amber-200/70 italic relative">
                         <div className="absolute top-2 right-3 text-[8px] uppercase font-bold opacity-30">Gemini 3 Pro Critic</div>
                         <ReactMarkdown remarkPlugins={[remarkGfm]}>{criticContent}</ReactMarkdown>
                    </div>
                )}
            </div>
        )}
      </div>
    </div>
  );
};
