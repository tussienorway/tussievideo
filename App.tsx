
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect, useRef } from 'react';
import { AppState, Project, Clip, MediaType } from './types';
import { generateMedia } from './services/api';
import { saveProject, getProjects, deleteProject } from './services/storage';
import { fileToBase64, captureLastFrame, createThumbnail, renderProjectToVideo } from './services/videoUtils';
import ApiKeyDialog from './components/ApiKeyDialog';
import LoadingIndicator from './components/LoadingIndicator';
import { 
  Plus, Clapperboard, Image as ImageIcon, Trash2, 
  KeyRound, Film, ChevronRight, AlertTriangle, ArrowLeft,
  Sparkles, Layers, StopCircle, Globe, Camera, Download, PlayCircle
} from 'lucide-react';

const App = () => {
  const [state, setState] = useState<AppState>(AppState.DASHBOARD);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [showKeyInfo, setShowKeyInfo] = useState(false);
  const [isAiStudio, setIsAiStudio] = useState(false);
  
  const [prompt, setPrompt] = useState('');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAutoChaining, setIsAutoChaining] = useState(false);
  const [isRendering, setIsRendering] = useState(false); // Ny state for rendering
  const [error, setError] = useState<{message: string} | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadProjects();
    const studio = typeof window !== 'undefined' && !!window.aistudio;
    setIsAiStudio(studio);
    
    if (studio && window.aistudio) {
      window.aistudio.hasSelectedApiKey().then(has => {
        if (!has) setShowKeyInfo(true);
      });
    }
  }, []);

  useEffect(() => {
    if (activeProject?.clips.length) {
      scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeProject?.clips.length]);

  const loadProjects = async () => {
    const loaded = await getProjects();
    setProjects(loaded);
  };

  const createNewProject = () => {
    const newProj: Project = {
      id: crypto.randomUUID(),
      name: `Animasjon ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`,
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
    if (!activeProject || (!prompt && !isContinuation && !chainPrompt)) return;

    setIsGenerating(true);
    setError(null);

    try {
      let imageInput = uploadedImage;

      // Hent forrige bilde for å bevare stilen i neste generasjon
      if (isContinuation && activeProject.clips.length > 0) {
        const lastClip = activeProject.clips[activeProject.clips.length - 1];
        if (lastClip.mediaType === 'VIDEO') {
          imageInput = await captureLastFrame(lastClip.blob);
        } else {
          if (lastClip.base64Thumbnail) {
             imageInput = lastClip.base64Thumbnail.split(',')[1];
          } else {
             const reader = new FileReader();
             imageInput = await new Promise((resolve) => {
                reader.onload = () => resolve((reader.result as string).split(',')[1]);
                reader.readAsDataURL(lastClip.blob);
             });
          }
        }
      }

      const currentPrompt = chainPrompt || prompt;
      const result = await generateMedia({
        prompt: currentPrompt,
        image: imageInput || undefined,
        isExtension: isContinuation
      });

      const thumbnail = await createThumbnail(result.blob, result.mediaType);
      const newClip: Clip = {
        id: crypto.randomUUID(),
        projectId: activeProject.id,
        timestamp: Date.now(),
        prompt: currentPrompt || (isContinuation ? "Neste scene" : "Start"),
        mediaType: result.mediaType,
        blob: result.blob,
        url: URL.createObjectURL(result.blob),
        base64Thumbnail: thumbnail,
        videoObject: undefined
      };

      const updatedProject = {
        ...activeProject,
        clips: [...activeProject.clips, newClip]
      };

      await saveProject(updatedProject);
      setActiveProject(updatedProject);
      await loadProjects();
      
      if (!isAutoChaining) {
        setPrompt('');
        setUploadedImage(null);
      }

      if (isAutoChaining) {
        // Raskere auto-chain for animasjon
        setTimeout(() => handleGenerate(true, currentPrompt), 500);
      }

    } catch (e: any) {
      setError({ message: e.message || "Generering feilet." });
      setIsAutoChaining(false);
    } finally {
      if (!isAutoChaining) setIsGenerating(false);
    }
  };

  const handleExportMovie = async () => {
    if (!activeProject || activeProject.clips.length === 0) return;
    setIsRendering(true);
    try {
      // 3000ms = 3 sekunder per bilde. Juster dette tallet for raskere/tregere animasjon.
      // For "animasjon" vil man kanskje ha 500ms (0.5 sek), for "slideshow" 3000ms.
      // Her bruker vi 3 sekunder som standard for "Animatic / Motion Comic" følelse.
      const videoBlob = await renderProjectToVideo(activeProject.clips.map(c => c.blob), 3000);
      
      const url = URL.createObjectURL(videoBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeProject.name.replace(/\s+/g, '_')}_full_movie.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e: any) {
      setError({ message: "Rendering feilet: " + e.message });
    } finally {
      setIsRendering(false);
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
      
      {showKeyInfo && isAiStudio && <ApiKeyDialog onSelectKey={openKeyDialog} />}

      <header className="border-b border-white/5 bg-black/60 backdrop-blur-2xl h-16 flex items-center justify-between px-6 sticky top-0 z-50">
        <div className="flex items-center gap-3 cursor-pointer group" onClick={() => { setState(AppState.DASHBOARD); setIsAutoChaining(false); }}>
          <div className="bg-indigo-600 w-9 h-9 rounded-xl flex items-center justify-center font-black text-white shadow-[0_0_20px_rgba(79,70,229,0.4)] group-hover:scale-105 transition-transform">A</div>
          <span className="font-bold tracking-[0.2em] uppercase text-[10px] text-white/90">Austenå Animation Studio</span>
        </div>
        
        {isAiStudio ? (
          <button onClick={openKeyDialog} className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest bg-white/5 px-4 py-2 rounded-full border border-white/10 hover:bg-white/10 transition-all hover:border-indigo-500/30">
            <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
            Endre Nøkkel
          </button>
        ) : (
          <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-indigo-400/60 bg-indigo-400/5 px-4 py-2 rounded-full border border-indigo-400/10">
            <Globe className="w-3 h-3" /> Free Tier Mode
          </div>
        )}
      </header>

      {state === AppState.DASHBOARD && (
        <main className="p-12 max-w-7xl mx-auto animate-in fade-in duration-700">
          <div className="flex items-end justify-between mb-16">
            <div>
              <h1 className="text-4xl font-light text-white tracking-tight italic">Mine Produksjoner</h1>
              <p className="text-[10px] text-gray-500 mt-3 uppercase tracking-[0.4em] font-black">Frame-by-Frame Generation (Free)</p>
            </div>
            <button onClick={createNewProject} className="flex items-center gap-3 px-10 py-5 bg-white text-black font-black uppercase tracking-widest text-xs rounded-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-[0_15px_40px_rgba(255,255,255,0.1)]">
              <Plus className="w-5 h-5" /> Ny Film
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
                      <span className="text-[10px] font-black uppercase tracking-widest">Tom</span>
                    </div>
                  )}
                  <div className="absolute top-4 right-4 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-full text-[9px] font-black border border-white/10 uppercase tracking-widest">
                    {/* Estimerer varighet basert på 3 sek per frame */}
                    {Math.floor((p.clips.length * 3) / 60)}:{(p.clips.length * 3) % 60 < 10 ? '0' : ''}{(p.clips.length * 3) % 60}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-white text-base group-hover:text-indigo-400 transition-colors">{p.name}</h3>
                    <p className="text-[10px] text-gray-600 font-mono mt-1 uppercase">{p.clips.length} Frames</p>
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
              <div className="flex items-center justify-between mb-8">
                <button 
                  onClick={() => { setState(AppState.DASHBOARD); setIsAutoChaining(false); }}
                  className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Galleri
                </button>

                {activeProject.clips.length > 0 && (
                  <button 
                    onClick={handleExportMovie}
                    disabled={isRendering || isGenerating}
                    className="flex items-center gap-3 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-[0_0_30px_rgba(79,70,229,0.3)] disabled:opacity-50"
                  >
                    {isRendering ? (
                      <span className="animate-pulse">Rendrer Film...</span>
                    ) : (
                      <>
                        <PlayCircle className="w-4 h-4" /> Eksporter Film ({Math.floor((activeProject.clips.length * 3) / 60)} min)
                      </>
                    )}
                  </button>
                )}
              </div>

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
                        <img src={clip.url} className="w-full h-full object-contain" />
                      </div>
                      <div className="p-8">
                        <p className="text-sm text-gray-400 font-light leading-relaxed italic text-center">"{clip.prompt}"</p>
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={scrollEndRef} />
              </div>
            </div>
          </div>

          <div className="bg-[#080808] border-t border-white/5 p-10 backdrop-blur-3xl sticky bottom-0 z-40">
            <div className="max-w-4xl mx-auto">
              {(isGenerating || isAutoChaining || isRendering) && (
                <div className="mb-6 animate-in fade-in zoom-in-95">
                  <div className="flex items-center justify-between mb-4 px-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 flex items-center gap-2">
                      <Sparkles className="w-3 h-3 animate-pulse" /> 
                      {isRendering ? "Setter sammen film..." : (isAutoChaining ? "Genererer sekvens..." : "Tegner frame...")}
                    </span>
                    {isAutoChaining && (
                      <button onClick={() => { setIsAutoChaining(false); setIsGenerating(false); }} className="flex items-center gap-2 px-4 py-2 bg-red-600/20 text-red-500 text-[9px] font-black uppercase tracking-widest rounded-full border border-red-500/20 hover:bg-red-600 hover:text-white transition-all">
                        <StopCircle className="w-3 h-3" /> Stopp
                      </button>
                    )}
                  </div>
                  <LoadingIndicator />
                </div>
              )}

              {!isGenerating && !isAutoChaining && !isRendering && (
                <>
                  {error && (
                    <div className="mb-8 p-6 bg-red-950/20 border border-red-500/20 rounded-3xl animate-in slide-in-from-top-4">
                      <div className="flex items-start gap-5">
                        <AlertTriangle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
                        <div className="flex-grow">
                          <p className="text-sm text-red-100 font-medium mb-4">{error.message}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {uploadedImage && (
                    <div className="mb-8 flex items-center gap-5 bg-white/5 p-3 pr-6 rounded-3xl border border-white/10 w-fit">
                      <img src={`data:image/png;base64,${uploadedImage}`} className="w-16 h-16 rounded-2xl object-cover" />
                      <button onClick={() => setUploadedImage(null)} className="text-[9px] text-red-500 font-bold uppercase">Fjern Referanse</button>
                    </div>
                  )}

                  <div className="flex gap-4">
                    <button 
                      onClick={() => fileInputRef.current?.click()} 
                      className="p-6 bg-[#111] rounded-[2rem] border border-white/5 hover:border-indigo-500/30 transition-all group"
                    >
                      <ImageIcon className="w-7 h-7 text-gray-600 group-hover:text-indigo-400" />
                      <input type="file" ref={fileInputRef} onChange={async (e) => { if(e.target.files?.[0]) setUploadedImage(await fileToBase64(e.target.files[0])); }} className="hidden" accept="image/*" />
                    </button>

                    <input 
                      value={prompt} 
                      onChange={e => setPrompt(e.target.value)} 
                      placeholder={activeProject.clips.length > 0 ? "Beskriv neste handling i filmen..." : "Beskriv filmens åpningsscene..."} 
                      className="flex-grow bg-black border border-white/10 rounded-[2rem] px-8 text-white focus:outline-none focus:border-indigo-500/50 text-sm font-light" 
                      onKeyDown={(e) => e.key === 'Enter' && prompt && handleGenerate(activeProject.clips.length > 0)}
                    />

                    <div className="flex flex-col gap-2">
                      <button 
                        onClick={() => handleGenerate(activeProject.clips.length > 0)} 
                        disabled={!prompt || isGenerating}
                        className="px-8 h-12 bg-white text-black font-black uppercase tracking-[0.2em] text-[10px] rounded-[1.5rem] hover:scale-[1.02] active:scale-95 disabled:opacity-10 transition-all flex items-center justify-center gap-3"
                      >
                        {activeProject.clips.length > 0 ? <><Camera className="w-4 h-4 text-indigo-600" /> Neste Frame</> : <><Clapperboard className="w-4 h-4" /> Start Film</>}
                      </button>
                      
                      {activeProject.clips.length > 0 && (
                        <button onClick={() => { setIsAutoChaining(true); handleGenerate(true); }} className="px-8 h-12 bg-indigo-600 text-white font-black uppercase tracking-[0.2em] text-[10px] rounded-[1.5rem] hover:bg-indigo-500 transition-all flex items-center justify-center gap-3">
                          <Layers className="w-4 h-4" /> Auto-Animer
                        </button>
                      )}
                    </div>
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
