
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import {Video} from '@google/genai';
import React, {useCallback, useEffect, useState} from 'react';
import ApiKeyDialog from './components/ApiKeyDialog';
import {CurvedArrowDownIcon, ChevronDownIcon} from './components/icons';
import LoadingIndicator from './components/LoadingIndicator';
import PromptForm from './components/PromptForm';
import VideoResult from './components/VideoResult';
import VideoLibrary from './components/VideoLibrary';
import {generateVideo} from './services/geminiService';
import {
  AppState,
  AspectRatio,
  GenerateVideoParams,
  GenerationMode,
  Resolution,
  VeoModel,
  VideoFile,
  SavedVideo,
  ImageFile,
} from './types';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<VeoModel>(VeoModel.VEO_QWEN_HYBRID);
  const [lastConfig, setLastConfig] = useState<GenerateVideoParams | null>(null);
  const [lastVideoObject, setLastVideoObject] = useState<Video | null>(null);
  const [lastVideoBlob, setLastVideoBlob] = useState<Blob | null>(null);
  const [library, setLibrary] = useState<SavedVideo[]>([]);
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);
  const [isApiKeyValidated, setIsApiKeyValidated] = useState(false);

  const [initialFormValues, setInitialFormValues] =
    useState<GenerateVideoParams | null>(null);

  useEffect(() => {
    const checkApiKeyStatus = async () => {
      if (window.aistudio) {
        try {
          const hasKey = await window.aistudio.hasSelectedApiKey();
          if (!hasKey) {
            setIsApiKeyValidated(false);
            setShowApiKeyDialog(true);
          } else {
            setIsApiKeyValidated(true);
          }
        } catch (error) {
          setIsApiKeyValidated(false);
          setShowApiKeyDialog(true);
        }
      } else {
        // Fallback for lokal utvikling uten AI Studio wrapper
        setIsApiKeyValidated(true);
      }
    };
    checkApiKeyStatus();
  }, []);

  const handleGenerate = useCallback(async (params: GenerateVideoParams) => {
    if (!params.prompt.trim() && params.mode !== GenerationMode.FRAMES_TO_VIDEO) {
      params.prompt = "A high quality cinematic scene continuation.";
    }

    const finalParams = {
      ...params,
      model: params.mode === GenerationMode.EXTEND_VIDEO ? VeoModel.VEO : selectedModel
    };

    if (window.aistudio) {
      try {
        if (!(await window.aistudio.hasSelectedApiKey())) {
          setShowApiKeyDialog(true);
          return;
        }
      } catch (error) {
        setShowApiKeyDialog(true);
        return;
      }
    }

    setAppState(AppState.LOADING);
    setErrorMessage(null);
    setLastConfig(finalParams);
    setInitialFormValues(null);

    try {
      const {objectUrl, blob, video} = await generateVideo(finalParams);
      
      const newSavedVideo: SavedVideo = {
        id: crypto.randomUUID(),
        url: objectUrl,
        blob: blob,
        videoObject: video,
        timestamp: Date.now(),
        params: finalParams
      };

      setVideoUrl(objectUrl);
      setLastVideoBlob(blob);
      setLastVideoObject(video);
      setLibrary(prev => [newSavedVideo, ...prev]);
      setAppState(AppState.SUCCESS);
    } catch (error: any) {
      console.error('Video generation failed:', error);
      let msg = 'En uventet feil oppstod. Sjekk tilkoblingen din.';
      
      const errorStr = error.toString() || "";
      if (errorStr.includes('400')) {
        msg = "Ugyldig forespørsel (400). Dette skyldes ofte innholdsfiltere eller at fakturering ikke er aktiv på prosjektet.";
      } else if (errorStr.includes('403') || errorStr.includes('401') || errorStr.includes('not found')) {
        msg = "Nøkkel-feil (403). Prosjektet mangler tilgang til Veo-modellene. Sjekk fakturering på Google Cloud.";
        setIsApiKeyValidated(false);
        setShowApiKeyDialog(true);
      }
      
      setErrorMessage(msg);
      setAppState(AppState.ERROR);
    }
  }, [selectedModel]);

  const handleContinueFromVideo = useCallback(async (savedVideo: SavedVideo) => {
    setAppState(AppState.LOADING);
    
    const extractLastFrame = async (url: string): Promise<ImageFile> => {
      return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.src = url;
        video.crossOrigin = "anonymous";
        video.muted = true;
        video.playsInline = true;
        
        const timeout = setTimeout(() => reject(new Error("Timeout under bildeuttrekk")), 15000);

        video.onloadedmetadata = () => {
          video.currentTime = Math.max(0, video.duration - 0.1);
        };

        video.onseeked = () => {
          clearTimeout(timeout);
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0);
            const dataUrl = canvas.toDataURL('image/png');
            const base64 = dataUrl.split(',')[1];
            fetch(dataUrl).then(res => res.blob()).then(blob => {
              const file = new File([blob], "last_frame.png", { type: "image/png" });
              resolve({ file, base64 });
            }).catch(reject);
          } else {
            reject(new Error("Canvas feilet"));
          }
        };
        video.onerror = () => {
          clearTimeout(timeout);
          reject(new Error("Video kunne ikke lastes i WebView"));
        };
      });
    };

    try {
      const lastFrame = await extractLastFrame(savedVideo.url);
      setInitialFormValues({
        ...savedVideo.params,
        mode: GenerationMode.FRAMES_TO_VIDEO,
        prompt: '',
        startFrame: lastFrame,
        endFrame: null,
        isLooping: false,
        inputVideo: null,
        inputVideoObject: null
      });
      setAppState(AppState.IDLE);
      setVideoUrl(null);
    } catch (e) {
      setErrorMessage("Automatisk kobling feilet i denne nettleseren. Prøv forlengelse manuelt.");
      setAppState(AppState.ERROR);
    }
  }, []);

  const handleRetry = () => lastConfig && handleGenerate(lastConfig);
  
  const handleNewVideo = () => {
    setAppState(AppState.IDLE);
    setVideoUrl(null);
    setInitialFormValues(null);
    setLastVideoBlob(null);
    setLastVideoObject(null);
    setErrorMessage(null);
  };

  const handleExtend = useCallback(async () => {
    if (lastConfig && lastVideoBlob && lastVideoObject) {
      const file = new File([lastVideoBlob], 'last_video.mp4', { type: lastVideoBlob.type });
      const videoFile: VideoFile = {file, base64: ''};

      setInitialFormValues({
        ...lastConfig,
        mode: GenerationMode.EXTEND_VIDEO,
        model: VeoModel.VEO,
        prompt: '', 
        inputVideo: videoFile, 
        inputVideoObject: lastVideoObject, 
        resolution: Resolution.P720, 
        startFrame: null,
        endFrame: null,
        referenceImages: [],
        styleImage: null,
        isLooping: false,
      });

      setAppState(AppState.IDLE);
      setVideoUrl(null);
    }
  }, [lastConfig, lastVideoBlob, lastVideoObject]);

  const handleApiKeyDialogContinue = async () => {
    setShowApiKeyDialog(false);
    if (window.aistudio) {
      try {
        await window.aistudio.openSelectKey();
        setIsApiKeyValidated(true);
      } catch (e) {
        console.error("Nøkkel-valg avbrutt", e);
      }
    } else {
      setIsApiKeyValidated(true);
    }
  };

  const getModelDisplayName = (m: VeoModel) => {
    switch (m) {
      case VeoModel.VEO: return 'VEO 3.1 PRO';
      case VeoModel.VEO_FAST: return 'VEO 3.1 FAST';
      case VeoModel.VEO_QWEN_HYBRID: return 'QWEN HYBRID';
    }
  };

  return (
    <div className="h-screen bg-black text-gray-200 flex flex-col font-sans overflow-hidden">
      {showApiKeyDialog && <ApiKeyDialog onContinue={handleApiKeyDialogContinue} />}

      {/* Header med Motor og Nøkkelstatus */}
      <div className="absolute top-6 right-8 flex flex-col items-end gap-2 z-20">
        <div className="relative group">
          <div className="flex items-center gap-2 mb-1 pr-2">
            <span className="text-[8px] font-bold text-white/30 tracking-widest uppercase">API STATUS:</span>
            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border ${isApiKeyValidated ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30 animate-pulse'}`}>
              <div className={`w-1 h-1 rounded-full ${isApiKeyValidated ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
              <span className={`text-[7px] font-black tracking-tighter ${isApiKeyValidated ? 'text-emerald-400' : 'text-amber-400'}`}>
                {isApiKeyValidated ? 'AKTIV' : 'KREVER NØKKEL'}
              </span>
            </div>
          </div>
          
          <div className="border border-white/5 bg-black/80 backdrop-blur-2xl px-5 py-2.5 text-indigo-400 text-[10px] font-black tracking-widest flex items-center gap-4 cursor-pointer hover:bg-white/5 transition-all rounded-2xl shadow-2xl">
            <span className="opacity-40 uppercase">MOTOR:</span>
            <span>{getModelDisplayName(selectedModel)}</span>
            <ChevronDownIcon className="w-4 h-4 opacity-50" />
          </div>
          
          <div className="absolute top-full right-0 mt-3 w-64 bg-gray-950 border border-white/10 shadow-[0_30px_60px_rgba(0,0,0,0.8)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all rounded-2xl overflow-hidden z-30 backdrop-blur-3xl">
            <button 
              onClick={() => setSelectedModel(VeoModel.VEO_QWEN_HYBRID)}
              className={`w-full text-left px-5 py-4 text-[10px] font-bold hover:bg-white/5 transition-colors border-b border-white/5 ${selectedModel === VeoModel.VEO_QWEN_HYBRID ? 'text-indigo-400 bg-indigo-400/5' : 'text-gray-500'}`}>
              QWEN HYBRID <span className="text-[7px] bg-indigo-500 text-white px-1 ml-1 rounded">SMART</span>
              <div className="text-[9px] font-normal opacity-40 mt-1">Beste forståelse + Kinematisk Veo</div>
            </button>
            <button 
              onClick={() => setSelectedModel(VeoModel.VEO)}
              className={`w-full text-left px-5 py-4 text-[10px] font-bold hover:bg-white/5 transition-colors border-b border-white/5 ${selectedModel === VeoModel.VEO ? 'text-indigo-400 bg-indigo-400/5' : 'text-gray-500'}`}>
              VEO 3.1 PRO
              <div className="text-[9px] font-normal opacity-40 mt-1">Maksimal bildekvalitet</div>
            </button>
            <button 
              onClick={() => setSelectedModel(VeoModel.VEO_FAST)}
              className={`w-full text-left px-5 py-4 text-[10px] font-bold hover:bg-white/5 transition-colors ${selectedModel === VeoModel.VEO_FAST ? 'text-indigo-400 bg-indigo-400/5' : 'text-gray-500'}`}>
              VEO 3.1 FAST
              <div className="text-[9px] font-normal opacity-40 mt-1">Rask generering</div>
            </button>
          </div>
        </div>
      </div>

      <header className="pt-16 pb-6 flex flex-col items-center justify-center px-8 relative z-10">
        <h1 className="text-5xl sm:text-6xl font-black tracking-tighter text-center bg-gradient-to-b from-white to-white/40 bg-clip-text text-transparent italic">
          TussieStudio
        </h1>
        <div className="mt-4">
          <span className="text-[9px] text-indigo-400 font-black tracking-[0.5em] uppercase opacity-80">Cinematic Visionary</span>
        </div>
      </header>
      
      <main className="w-full max-w-5xl mx-auto flex-grow flex flex-col p-6 relative overflow-y-auto no-scrollbar">
        {appState === AppState.IDLE ? (
          <>
            <div className="flex-grow flex flex-col items-center justify-center py-12">
              <div className="relative text-center mb-16">
                <h2 className="text-4xl text-white/20 font-light tracking-tight">Visualize your imagination</h2>
                <CurvedArrowDownIcon className="absolute top-full left-1/2 -translate-x-1/2 mt-8 w-12 h-12 text-indigo-500/30 animate-bounce" />
              </div>
              
              <VideoLibrary 
                videos={library} 
                onSelect={(v) => { setVideoUrl(v.url); setAppState(AppState.SUCCESS); setLastConfig(v.params); setLastVideoObject(v.videoObject); setLastVideoBlob(v.blob); }}
                onRemove={(id) => setLibrary(prev => prev.filter(v => v.id !== id))}
                onContinue={handleContinueFromVideo}
              />
            </div>
            <div className="pb-12 shrink-0">
              <PromptForm onGenerate={handleGenerate} initialValues={initialFormValues} />
            </div>
          </>
        ) : (
          <div className="flex-grow flex items-center justify-center py-8">
            {appState === AppState.LOADING && <LoadingIndicator />}
            {appState === AppState.SUCCESS && videoUrl && (
              <VideoResult
                videoUrl={videoUrl}
                onRetry={handleRetry}
                onNewVideo={handleNewVideo}
                onExtend={handleExtend}
                onContinue={() => {
                  if (library.length > 0) handleContinueFromVideo(library[0]);
                }}
                canExtend={lastConfig?.resolution === Resolution.P720}
                aspectRatio={lastConfig?.aspectRatio || AspectRatio.LANDSCAPE}
              />
            )}
            {appState === AppState.ERROR && errorMessage && (
              <div className="text-center max-w-lg bg-red-950/10 border border-red-500/20 p-12 rounded-[2rem] backdrop-blur-3xl shadow-2xl">
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-8 border border-red-500/20">
                  <span className="text-red-500 text-3xl font-black">!</span>
                </div>
                <h2 className="text-2xl font-black text-white mb-4 uppercase tracking-tight">Systemfeil</h2>
                <p className="text-red-200/50 text-xs leading-relaxed mb-10 font-mono">{errorMessage}</p>
                <div className="flex flex-col gap-4">
                  <button onClick={handleNewVideo} className="w-full py-4 bg-white text-black font-black uppercase tracking-widest rounded-2xl hover:bg-gray-200 transition-all">Gå tilbake</button>
                  <button onClick={handleRetry} className="w-full py-4 bg-transparent text-white/50 hover:text-white transition-all text-[10px] uppercase font-bold tracking-widest">Prøv på nytt</button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="py-6 text-center border-t border-white/5 bg-black/40 backdrop-blur-md">
        <p className="text-[8px] text-white/20 font-black uppercase tracking-[0.8em]">
          Video.Austenaa.eu — Cinematic Visionary
        </p>
      </footer>
    </div>
  );
};

export default App;
