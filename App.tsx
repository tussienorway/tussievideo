
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect, useRef } from 'react';
import { AppState, Project, Clip, MediaType } from './types';
import { generateMedia } from './services/api';
import { saveProject, getProjects, deleteProject } from './services/storage';
import { fileToBase64, captureLastFrame, createThumbnail } from './services/videoUtils';
import ApiKeyDialog from './components/ApiKeyDialog';
import LoadingIndicator from './components/LoadingIndicator';
import { 
  Plus, Clapperboard, Image as ImageIcon, Trash2, 
  KeyRound, Film, ChevronRight, AlertTriangle, ExternalLink, ArrowLeft,
  Sparkles, Layers, StopCircle
} from 'lucide-react';

const App = () => {
  const [state, setState] = useState<AppState>(AppState.DASHBOARD);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [showKeyInfo, setShowKeyInfo] = useState(false);
  
  // Input State
  const [prompt, setPrompt] = useState('');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAutoChaining, setIsAutoChaining] = useState(false); // Ny flagg for automatisk fortsettelse
  const [error, setError] = useState<{message: string, isBilling: boolean} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadProjects();
    checkApiKey();
  }, []);

  useEffect(() => {
    if (activeProject?.clips.length) {
      scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeProject?.clips.length]);

  const checkApiKey = async () => {
    if (window.aistudio) {
      const hasKey = await window.aistudio.hasSelectedApiKey();
      if (!hasKey) setShowKeyInfo(true);
    }
  };

  const loadProjects = async () => {
    const loaded = await getProjects();
    setProjects(loaded);
  };

  const createNewProject = () => {
    const newProj: Project = {
      id: crypto.randomUUID(),
      name: `Produksjon ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`,
      createdAt: Date.now(),
      clips: []
    };
    setActiveProject(newProj);
    setUploadedImage(null);
    setPrompt('');
    setError(null);
    setState(AppState.PROJECT_VIEW);
  };

  const handleGenerate = async (isContinuation: boolean = false, chainPrompt?: string) => {
    if (!activeProject) return;
    if (!prompt && !isContinuation && !chainPrompt) return;

    setIsGenerating(true);
    setError(null);

    try {
      let imageInput = uploadedImage;
      let videoRef = undefined;

      // Hent kontekst fra forrige klipp hvis det er en extension
      if (isContinuation && activeProject.clips.length > 0) {
        const lastClip = activeProject.clips[activeProject.clips.length - 1];
        if (lastClip.videoObject) {
          videoRef = lastClip.videoObject;
        } else if (lastClip.mediaType === 'VIDEO') {
          imageInput = await captureLastFrame(lastClip.blob);
        } else {
          imageInput = lastClip.base64Thumbnail?.split(',')[1] || null;
        }
      }

      const currentPrompt = chainPrompt || prompt;

      const result = await generateMedia({
        prompt: currentPrompt || "Cinematic flow.",
        image: imageInput || undefined,
        videoObject: videoRef,
        isExtension: isContinuation
      });

      const thumbnail = await createThumbnail(result.blob, result.mediaType);

      const newClip: Clip = {
        id: crypto.randomUUID(),
        projectId: activeProject.id,
        timestamp: Date.now(),
        prompt: currentPrompt || (isContinuation ? "Fortsettelse" : "Start"),
        mediaType: result.mediaType,
        blob: result.blob,
        url: URL.createObjectURL(result.blob),
        base64Thumbnail: thumbnail,
        videoObject: result.videoObject
      };

      const updatedProject = {
        ...activeProject,
        clips: [...activeProject.clips, newClip]
      };

      await saveProject(updatedProject);
      setActiveProject(updatedProject);
      await loadProjects();
      
      // Hvis vi ikke er i en automatisk kjede, tøm prompten
      if (!isAutoChaining) {
        setPrompt('');
        setUploadedImage(null);
      }

      // AUTOMATISK KJEDING: Hvis flagget er på, start neste 7 sekunder umiddelbart
      if (isAutoChaining) {
        // Vi gir AI-en beskjed om å fortsette handlingen
        setTimeout(() => {
          handleGenerate(true, currentPrompt);
        }, 1000);
      }

    } catch (e: any) {
      const isBilling = e.message?.includes('BILLETING_REQUIRED');
      setError({ message: e.message || "Generering feilet.", isBilling });
      setIsAutoChaining(false); // Stopp kjeden ved feil
      if (isBilling) setShowKeyInfo(true);
    } finally {
      if (!isAutoChaining) setIsGenerating(false);
    }
  };

  const openKeyDialog = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setError(null);
      setShowKeyInfo(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-gray-200 font-sans selection:bg-indigo-500/30">
      
      {showKeyInfo && <ApiKeyDialog onSelectKey={openKeyDialog} />}

      <header className="border-b border-white/5 bg-black/60 backdrop-blur-2xl h-16 flex items-center justify-between px-6 sticky top-0 z-50">
        <div className="flex items-center gap-3 cursor-pointer group" onClick={() => { setState(AppState.DASHBOARD); setIsAutoChaining(false); }}>
          <div className="bg-indigo-600 w-9 h-9 rounded-xl flex items-center justify-center font-black text-white shadow-[0_0_20px_rgba(79,70,229,0.4)] group-hover:scale-105 transition-transform">T</div>
          <span className="font-bold tracking-[0.2em] uppercase text-[10px] text-white/90">TussieStudio Pro</span>
        </div>
        <button onClick={openKeyDialog} className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest bg-white/5 px-4 py-2 rounded-full border border-white/10 hover:bg-white/10 transition-all hover:border-indigo-500/30">
          <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
          Bytt Plan
        </button>
      </header>

      {state === AppState.DASHBOARD && (
        <main className="p-12 max-w-7xl mx-auto animate-in fade-in duration-700">
          <div className="flex items-end justify-between mb-16">
            <div>
              <h1 className="text-4xl font-light text-white tracking-tight">Dine Produksjoner</h1>
              <p className="text-[10px] text-gray-500 mt-3 uppercase tracking-[0.4em] font-black">Powered by Veo 3.1 & Austenå AI</p>
            </div>
            <button onClick={createNewProject} className="flex items-center gap-3 px-10 py-5 bg-white text-black font-black uppercase tracking-widest text-xs rounded-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-[0_15px_40px_rgba(255,255,255,0.1)]">
              <Plus className="w-5 h-5" /> Start Ny Film
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {projects.map(p => (
              <div 
                key={p.id} 
                onClick={() => { setActiveProject(p); setState(AppState.PROJECT_VIEW); setError(null); }} 
                className="group bg-[#0a0a0a] border border-white/5 rounded-[2.5rem] p-6 cursor-pointer hover:border-indigo-500/40 transition-all hover:bg-[#0f0f0f] shadow-2xl"
              >
                <div className="aspect-video bg-black rounded-3xl mb-6 overflow-hidden relative shadow-inner">
                  {p.clips.length > 0 ? (
                    <img src={p.clips[p.clips.length-1].url} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-all duration-1000 group-hover:scale-110" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center opacity-10 gap-2">
                      <Film className="w-10 h-10" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Ingen opptak</span>
                    </div>
                  )}
                  <div className="absolute top-4 right-4 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-full text-[9px] font-black border border-white/10 uppercase tracking-widest">
                    {p.clips.length * 7}s Totalt
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-white text-base group-hover:text-indigo-400 transition-colors">{p.name}</h3>
                    <p className="text-[10px] text-gray-600 font-mono mt-1 uppercase">{new Date(p.createdAt).toLocaleDateString('no-NO')}</p>
                  </div>
                  <div className="w-10 h-10 rounded-full border border-white/5 flex items-center justify-center group-hover:border-indigo-500/30 transition-colors">
                    <ChevronRight className="w-5 h-5 text-gray-700 group-hover:text-indigo-400" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </main>
      )}

      {state === AppState.PROJECT_VIEW && activeProject && (
        <main className="h-[calc(100vh-64px)] flex flex-col animate-in slide-in-from-bottom-4 duration-500">
          
          <div className="flex-grow overflow-y-auto p-12 space-y-16">
            <div className="max-w-5xl mx-auto">
              <button 
                onClick={() => { setState(AppState.DASHBOARD); setIsAutoChaining(false); }}
                className="mb-8 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Tilbake til arkiv
              </button>

              {activeProject.clips.length === 0 ? (
                <div className="py-32 flex flex-col items-center justify-center text-center opacity-30">
                  <Clapperboard className="w-16 h-16 mb-6" />
                  <h2 className="text-xl font-light text-white mb-2">Prosjektet er tomt</h2>
                  <p className="text-sm">Bruk tidslinjen nedenfor for å skape din første scene.</p>
                </div>
              ) : (
                <div className="space-y-32 pb-40">
                  {activeProject.clips.map((clip, idx) => (
                    <div key={clip.id} className="relative group">
                      <div className="absolute -left-16 top-0 bottom-0 flex flex-col items-center">
                        <div className="w-10 h-10 rounded-full bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-[10px] font-black text-indigo-400 shadow-xl">
                          {idx + 1}
                        </div>
                        {idx < activeProject.clips.length - 1 && <div className="w-px flex-grow bg-gradient-to-b from-indigo-500/30 to-transparent my-4"></div>}
                      </div>

                      <div className="bg-[#0a0a0a] rounded-[3rem] p-4 border border-white/5 shadow-2xl group-hover:border-indigo-500/20 transition-all">
                        <div className="aspect-video bg-black rounded-[2rem] overflow-hidden relative border border-white/5">
                          {clip.mediaType === 'VIDEO' ? (
                            <video src={clip.url} controls loop className="w-full h-full object-contain" />
                          ) : (
                            <img src={clip.url} className="w-full h-full object-contain" />
                          )}
                          <div className="absolute top-6 left-6 flex gap-2">
                             <span className="px-3 py-1.5 bg-indigo-600/80 backdrop-blur-md text-white text-[9px] font-black uppercase tracking-widest rounded-full border border-white/10 shadow-xl">
                              {clip.mediaType}
                            </span>
                             <span className="px-3 py-1.5 bg-black/60 backdrop-blur-md text-gray-400 text-[9px] font-black uppercase tracking-widest rounded-full border border-white/5 shadow-xl">
                              +7s
                            </span>
                          </div>
                        </div>
                        <div className="p-8">
                          <p className="text-sm text-gray-400 font-light leading-relaxed italic text-center">"{clip.prompt}"</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={scrollEndRef} />
                </div>
              )}
            </div>
          </div>

          {/* CREATION FOOTER */}
          <div className="bg-[#080808] border-t border-white/5 p-10 backdrop-blur-3xl sticky bottom-0 z-40">
            <div className="max-w-4xl mx-auto">
              
              {(isGenerating || isAutoChaining) && (
                <div className="mb-6 animate-in fade-in zoom-in-95">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 flex items-center gap-2">
                      <Sparkles className="w-3 h-3 animate-pulse" /> 
                      {isAutoChaining ? "Automatisk kjedegenerering aktiv..." : "Skaper scene..."}
                    </span>
                    {isAutoChaining && (
                      <button 
                        onClick={() => { setIsAutoChaining(false); setIsGenerating(false); }}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600/20 text-red-500 text-[9px] font-black uppercase tracking-widest rounded-full border border-red-500/20 hover:bg-red-600 hover:text-white transition-all"
                      >
                        <StopCircle className="w-3 h-3" /> Stopp kjede
                      </button>
                    )}
                  </div>
                  <LoadingIndicator />
                </div>
              )}

              {!isGenerating && !isAutoChaining && (
                <>
                  {error && (
                    <div className="mb-8 p-6 bg-red-950/20 border border-red-500/20 rounded-3xl flex items-start gap-5 animate-in slide-in-from-top-4">
                      <AlertTriangle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
                      <div className="flex-grow">
                        <p className="text-sm text-red-100 font-medium mb-4">{error.message}</p>
                        {error.isBilling && (
                          <div className="flex gap-4">
                            <button onClick={openKeyDialog} className="text-[10px] font-black uppercase text-white bg-red-600 px-4 py-2 rounded-xl hover:bg-red-500 transition-colors">Bytt til Pro-nøkkel</button>
                            <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="text-[10px] font-black uppercase text-red-400 flex items-center gap-2 hover:underline">Billing Docs <ExternalLink className="w-3.5 h-3.5"/></a>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {uploadedImage && (
                    <div className="mb-8 flex items-center gap-5 bg-white/5 p-3 pr-6 rounded-3xl border border-white/10 w-fit animate-in fade-in zoom-in-95">
                      <img src={`data:image/png;base64,${uploadedImage}`} className="w-16 h-16 rounded-2xl object-cover shadow-2xl" />
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Start-bilde valgt</span>
                        <button onClick={() => setUploadedImage(null)} className="text-[9px] text-red-500 hover:text-red-400 font-bold uppercase flex items-center gap-1.5 transition-colors">
                          <Trash2 className="w-3 h-3"/> Fjern kilde
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-4">
                    <button 
                      onClick={() => fileInputRef.current?.click()} 
                      className="p-6 bg-[#111] rounded-[2rem] border border-white/5 hover:bg-[#151515] hover:border-indigo-500/30 transition-all group active:scale-95"
                      title="Last opp bilde som kilde"
                    >
                      <ImageIcon className="w-7 h-7 text-gray-600 group-hover:text-indigo-400 transition-colors" />
                      <input type="file" ref={fileInputRef} onChange={async (e) => { if(e.target.files?.[0]) setUploadedImage(await fileToBase64(e.target.files[0])); }} className="hidden" accept="image/*" />
                    </button>

                    <div className="flex-grow relative group">
                      <input 
                        value={prompt} 
                        onChange={e => setPrompt(e.target.value)} 
                        placeholder={activeProject.clips.length > 0 ? "Beskriv neste handling..." : "Beskriv åpningsscenen..."} 
                        className="w-full h-full bg-black border border-white/10 rounded-[2rem] px-8 text-white placeholder:text-gray-700 focus:outline-none focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5 transition-all text-sm font-light" 
                        onKeyDown={(e) => e.key === 'Enter' && prompt && handleGenerate(activeProject.clips.length > 0)}
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <button 
                        onClick={() => handleGenerate(activeProject.clips.length > 0)} 
                        disabled={!prompt || isGenerating}
                        className="px-8 h-12 bg-white text-black font-black uppercase tracking-[0.2em] text-[10px] rounded-[1.5rem] hover:scale-[1.02] active:scale-95 disabled:opacity-10 transition-all flex items-center justify-center gap-3 shadow-[0_10px_30px_rgba(255,255,255,0.1)] group"
                      >
                        {activeProject.clips.length > 0 ? (
                          <><Sparkles className="w-4 h-4 text-indigo-600" /> +7s</>
                        ) : (
                          <><Clapperboard className="w-4 h-4" /> Start</>
                        )}
                      </button>
                      
                      {activeProject.clips.length > 0 && (
                        <button 
                          onClick={() => { setIsAutoChaining(true); handleGenerate(true); }}
                          className="px-8 h-12 bg-indigo-600 text-white font-black uppercase tracking-[0.2em] text-[10px] rounded-[1.5rem] hover:bg-indigo-500 transition-all flex items-center justify-center gap-3 shadow-xl shadow-indigo-600/20"
                        >
                          <Layers className="w-4 h-4" /> Autokjede
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className="mt-8 flex justify-between items-center px-4">
                    <p className="text-[9px] text-gray-700 uppercase tracking-widest font-mono">Status: Cinematic Chaining Enabled</p>
                    <button 
                      onClick={async () => { if(confirm("Slett hele prosjektet?")) { await deleteProject(activeProject.id); setState(AppState.DASHBOARD); loadProjects(); }}} 
                      className="text-[9px] text-red-900/40 hover:text-red-600 font-black uppercase tracking-widest transition-colors"
                    >
                      Destruer Prosjekt
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </main>
      )}
    </div>
  );
};

export default App;
