
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
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  const { confidence, cleanContent } = useMemo(() => {
    if (!content) return { confidence: null, cleanContent: '' };
    const match = content.match(/(\*\*|)?Confidence:(\*\*|)?\s*(High|Medium|Low)/i);
    let confidence = match ? match[3].toUpperCase() : null;
    let cleaned = content.replace(/(\*\*|)?Confidence:(\*\*|)?\s*(High|Medium|Low)/i, '').trim();
    return { confidence, cleanContent: cleaned };
  }, [content]);

  // Close share menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.share-menu-container')) {
        setShowShareMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDownload = () => {
    const htmlTemplate = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Firm of Experts Consensus Verdict</title>
        <script src="https://cdn.tailwindcss.com?plugins=typography"></script>
        <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
        <script type="module">
          import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
          mermaid.initialize({ 
            startOnLoad: false, 
            theme: 'base',
            themeVariables: {
              darkMode: true,
              background: '#0f172a',
              primaryColor: '#1e293b',
              primaryTextColor: '#ffffff',
              primaryBorderColor: '#38bdf8',
              lineColor: '#94a3b8',
              secondaryColor: '#0f172a',
              tertiaryColor: '#1e293b'
            },
            securityLevel: 'loose',
            fontFamily: 'ui-sans-serif, system-ui, sans-serif'
          });
          window.mermaid = mermaid;
        </script>
        <style>
          body { background-color: #0f172a; color: #e2e8f0; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
          .container { max-width: 800px; margin: 0 auto; padding: 2rem; }
          .prose { max-width: 100%; }
          .mermaid { display: flex; justify-content: center; background: #0f172a; padding: 1rem; border-radius: 0.5rem; border: 1px solid #334155; margin: 1rem 0; overflow-x: auto; }
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
                 <span>Generated via Firm of Experts</span>
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
          // Configure marked to process mermaid blocks
          const renderer = new marked.Renderer();
          renderer.code = function(code, language) {
            if (language === 'mermaid') {
              return '<div class="mermaid">' + code + '</div>';
            }
            return '<pre><code class="language-' + language + '">' + code + '</code></pre>';
          };

          // Inject content and render markdown
          const markdownContent = ${JSON.stringify(cleanContent)};
          document.getElementById('content').innerHTML = marked.parse(markdownContent, { renderer: renderer });

          // Run Mermaid after DOM update
          setTimeout(async () => {
            if (window.mermaid) {
              await window.mermaid.run({
                querySelector: '.mermaid'
              });
            }
          }, 500);
        </script>
      </body>
      </html>
    `;

    const blob = new Blob([htmlTemplate], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FirmOfExperts-Verdict-${new Date().toISOString().slice(0,10)}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSocialShare = (platform: 'x' | 'facebook' | 'whatsapp' | 'instagram' | 'copy') => {
    const textToShare = `Firm of Experts Consensus Verdict:\n\n${cleanContent.substring(0, 200)}...`;
    const fullText = `Firm of Experts Consensus Verdict:\n\n${cleanContent}`;
    const url = window.location.href; // In a real app this would be a permalink
    
    // For URL encoding
    const encodedText = encodeURIComponent(textToShare);
    const encodedUrl = encodeURIComponent(url);

    switch (platform) {
        case 'x':
            window.open(`https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`, '_blank');
            break;
        case 'whatsapp':
            window.open(`https://wa.me/?text=${encodeURIComponent(textToShare + " " + url)}`, '_blank');
            break;
        case 'facebook':
             // Facebook mainly shares URLs, often ignores text params, but we try 'quote'
            window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedText}`, '_blank');
            break;
        case 'instagram':
        case 'copy':
             // Instagram does not have a web URL scheme for sharing text.
             // Best practice is to copy to clipboard.
             navigator.clipboard.writeText(fullText).then(() => {
                setShareFeedback(platform === 'instagram' ? 'Copied! Open Instagram to paste.' : 'Copied to clipboard!');
                setTimeout(() => setShareFeedback(null), 3000);
             });
             break;
    }
    setShowShareMenu(false);
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

                    <div className="relative share-menu-container">
                        <button 
                            onClick={() => setShowShareMenu(!showShareMenu)}
                            className={`p-2 rounded-lg border transition-all duration-300 flex items-center gap-2 text-xs font-bold ${
                                showShareMenu || shareFeedback
                                ? 'bg-brand-500/10 border-brand-500/30 text-brand-400'
                                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:border-brand-500/50' 
                            }`}
                            title="Share Answer"
                        >
                            {shareFeedback ? (
                                <span className="flex items-center gap-1 animate-in fade-in"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> {shareFeedback}</span>
                            ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                            )}
                        </button>
                        
                        {/* Social Share Dropdown */}
                        {showShareMenu && (
                            <div className="absolute right-0 top-full mt-2 w-48 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-20 animate-in fade-in zoom-in-95 duration-200">
                                <div className="p-1">
                                    <button onClick={() => handleSocialShare('x')} className="w-full flex items-center gap-3 p-2 hover:bg-slate-800 rounded-lg text-slate-300 text-xs font-bold transition-colors text-left">
                                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                                        Share on X
                                    </button>
                                    <button onClick={() => handleSocialShare('whatsapp')} className="w-full flex items-center gap-3 p-2 hover:bg-slate-800 rounded-lg text-slate-300 text-xs font-bold transition-colors text-left">
                                        <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                                        Share on WhatsApp
                                    </button>
                                    <button onClick={() => handleSocialShare('facebook')} className="w-full flex items-center gap-3 p-2 hover:bg-slate-800 rounded-lg text-slate-300 text-xs font-bold transition-colors text-left">
                                        <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                                        Share on Facebook
                                    </button>
                                    <button onClick={() => handleSocialShare('instagram')} className="w-full flex items-center gap-3 p-2 hover:bg-slate-800 rounded-lg text-slate-300 text-xs font-bold transition-colors text-left">
                                        <svg className="w-4 h-4 text-pink-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                                        Share on Instagram
                                    </button>
                                    <div className="border-t border-slate-700 my-1"></div>
                                    <button onClick={() => handleSocialShare('copy')} className="w-full flex items-center gap-3 p-2 hover:bg-slate-800 rounded-lg text-slate-400 text-xs font-bold transition-colors text-left">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                                        Copy Text
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
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
