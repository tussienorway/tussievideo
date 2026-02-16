
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import {Video} from '@google/genai';
import React, {useCallback, useEffect, useState, useRef} from 'react';
import ApiKeyDialog from './components/ApiKeyDialog';
// Fix: Removed non-existent RefreshCwIcon from import
import {CurvedArrowDownIcon, ChevronDownIcon, RectangleStackIcon, ArrowPathIcon} from './components/icons';
import LoadingIndicator from './components/LoadingIndicator';
import PromptForm from './components/PromptForm';
import VideoResult from './components/VideoResult';
import VideoGallery from './components/VideoGallery';
import {generateVideo, VideoGenerationError} from './services/geminiService';
import {
  AppState,
  AspectRatio,
  GenerateVideoParams,
  GenerationMode,
  Resolution,
  VeoModel,
  VideoHistoryItem,
} from './types';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<{message: string, suggestion?: string} | null>(null);
  const [selectedModel, setSelectedModel] = useState<VeoModel>(VeoModel.VEO_FAST);
  const [videoHistory, setVideoHistory] = useState<VideoHistoryItem[]>([]);
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);
  const [initialFormValues, setInitialFormValues] = useState<GenerateVideoParams | null>(null);

  const galleryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkApiKey = async () => {
      if (window.aistudio) {
        try {
          if (!(await window.aistudio.hasSelectedApiKey())) {
            setShowApiKeyDialog(true);
          }
        } catch (error) {
          setShowApiKeyDialog(true);
        }
      }
    };
    checkApiKey();
  }, []);

  const handleGenerate = useCallback(async (params: GenerateVideoParams) => {
    setAppState(AppState.LOADING);
    setErrorDetails(null);

    try {
      const result = await generateVideo(params);
      setVideoUrl(result.objectUrl);
      
      const newItem: VideoHistoryItem = {
        id: Math.random().toString(36).substr(2, 9),
        objectUrl: result.objectUrl,
        blob: result.blob,
        videoObject: result.video,
        params: params,
        timestamp: Date.now(),
      };
      setVideoHistory(prev => [newItem, ...prev]);
      setAppState(AppState.SUCCESS);
    } catch (error) {
      if (error instanceof VideoGenerationError) {
        setErrorDetails({ message: error.message, suggestion: error.suggestion });
        if (error.code === 'AUTH_ERROR') setShowApiKeyDialog(true);
      } else {
        setErrorDetails({ message: 'En uventet feil oppstod.', suggestion: 'Vennligst prøv igjen om litt.' });
      }
      setAppState(AppState.ERROR);
    }
  }, []);

  const handleNewVideo = useCallback(() => {
    setAppState(AppState.IDLE);
    setVideoUrl(null);
    setErrorDetails(null);
    setInitialFormValues(null);
  }, []);

  const handleExtendFromItem = useCallback((item: VideoHistoryItem) => {
    setInitialFormValues({
      ...item.params,
      mode: GenerationMode.EXTEND_VIDEO,
      model: VeoModel.VEO,
      prompt: 'Hva skjer videre i denne scenen?', 
      inputVideoObject: item.videoObject, 
      resolution: Resolution.P720, 
    });
    setAppState(AppState.IDLE);
    setVideoUrl(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const getModelLabel = (m: VeoModel) => {
    if (m === VeoModel.VEO) return 'VEO 3.1 PRO (Beste kvalitet)';
    if (m === VeoModel.VEO_FAST) return 'VEO 3.1 FAST (Raskere)';
    if (m === VeoModel.COGVIDEO) return 'COGVIDEOX (Eksperimentell)';
    return 'STANDARD MODELL';
  };

  return (
    <div className="min-h-screen bg-black text-gray-200 flex flex-col font-sans custom-scrollbar">
      {showApiKeyDialog && <ApiKeyDialog onContinue={async () => {
        setShowApiKeyDialog(false);
        if (window.aistudio) await window.aistudio.openSelectKey();
      }} />}

      <div className="absolute top-6 left-8 right-8 flex justify-between items-start z-20">
        <button 
          onClick={() => galleryRef.current?.scrollIntoView({ behavior: 'smooth' })}
          className="flex items-center gap-2 bg-gray-900/80 hover:bg-gray-800 border border-gray-700 px-4 py-2 rounded-full text-xs font-bold text-indigo-400 transition-all shadow-lg"
        >
          <RectangleStackIcon className="w-4 h-4" />
          BIBLIOTEK ({videoHistory.length})
        </button>

        <div className="relative group">
          <div className="border border-indigo-400/50 bg-black/60 px-4 py-2 text-indigo-300 text-xs font-mono flex items-center gap-3 cursor-pointer hover:bg-indigo-400/10 transition-all rounded-sm backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            {getModelLabel(selectedModel)}
            <ChevronDownIcon className="w-3 h-3 opacity-60" />
          </div>
          <div className="absolute top-full right-0 mt-2 w-64 bg-gray-900 border border-indigo-500/30 shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 rounded-lg overflow-hidden backdrop-blur-xl">
             <div className="px-4 py-2 bg-indigo-500/10 border-b border-indigo-500/20 text-[10px] text-indigo-400 font-bold uppercase">Google Veo</div>
             {[VeoModel.VEO, VeoModel.VEO_FAST].map(m => (
               <button key={m} onClick={() => setSelectedModel(m)} className={`w-full text-left px-4 py-3 text-xs font-mono hover:bg-indigo-500/20 ${selectedModel === m ? 'text-white bg-indigo-500/10' : 'text-gray-400'}`}>
                 {getModelLabel(m)}
               </button>
             ))}
             <div className="px-4 py-2 bg-emerald-500/10 border-y border-emerald-500/20 text-[10px] text-emerald-400 font-bold uppercase">Åpen Kildekode</div>
             <button onClick={() => setSelectedModel(VeoModel.COGVIDEO)} className={`w-full text-left px-4 py-3 text-xs font-mono hover:bg-emerald-500/20 ${selectedModel === VeoModel.COGVIDEO ? 'text-white bg-emerald-500/10' : 'text-gray-400'}`}>
               COGVIDEOX 5B
             </button>
          </div>
        </div>
      </div>

      <header className="pt-24 pb-6 flex flex-col items-center justify-center px-8 relative z-10">
        <div className="relative mb-4">
          <svg width="100" height="80" viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-[0_0_20px_rgba(255,100,0,0.4)] animate-bounce-slow">
            <path d="M20 60C20 45 30 35 50 35C70 35 80 45 80 60V75H20V60Z" fill="white"/>
            <path d="M25 65C25 55 32 45 50 45C68 45 75 55 75 65V75H25V65Z" fill="#ef4444"/>
            <path d="M40 35C40 35 45 32 50 32C55 32 60 35 60 35V40H40V35Z" fill="#ef4444"/>
            <path d="M35 35L22 10L45 30L35 35Z" fill="#ef4444"/>
            <path d="M65 35L78 10L55 30L65 35Z" fill="#ef4444"/>
            <circle cx="40" cy="55" r="3" fill="black"/>
            <circle cx="60" cy="55" r="3" fill="black"/>
            <path d="M48 62C48 62 50 64 52 62" stroke="black" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M50 58L50 60" stroke="#ef4444" strokeWidth="2" strokeLinecap="round"/>
            <path d="M80 65C85 65 95 60 92 45" stroke="white" strokeWidth="6" strokeLinecap="round"/>
            <path d="M92 45C92 45 93 40 95 45" stroke="#ef4444" strokeWidth="6" strokeLinecap="round"/>
          </svg>
          <div className="absolute -top-4 -right-6 bg-white text-red-600 text-[10px] font-bold px-2 py-1 rounded-full shadow-2xl border border-red-100">Mjau! 🐾</div>
        </div>

        <h1 className="text-4xl sm:text-5xl font-semibold tracking-wide text-center bg-gradient-to-r from-indigo-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
          TussieStudio
        </h1>
        <p className="text-gray-500 mt-2 text-sm uppercase tracking-tighter">AI-drevet filmmagi</p>
      </header>
      
      <main className="w-full max-w-4xl mx-auto flex-grow flex flex-col p-4 min-h-[500px]">
        {appState === AppState.IDLE ? (
          <div className="flex-grow flex flex-col justify-center">
            <div className="text-center mb-12">
              <h2 className="text-3xl text-gray-500 font-light italic">Beskriv din scene, ta en selfie, eller last opp et bilde...</h2>
            </div>
            <PromptForm onGenerate={handleGenerate} initialValues={initialFormValues} selectedModel={selectedModel} />
          </div>
        ) : (
          <div className="flex-grow flex items-center justify-center">
            {appState === AppState.LOADING && <LoadingIndicator />}
            {appState === AppState.SUCCESS && videoUrl && (
              <VideoResult
                videoUrl={videoUrl}
                onRetry={() => handleGenerate(videoHistory[0].params)}
                onNewVideo={handleNewVideo}
                onExtend={() => handleExtendFromItem(videoHistory[0])}
                canExtend={videoHistory[0].params.resolution === Resolution.P720}
                aspectRatio={videoHistory[0].params.aspectRatio || AspectRatio.LANDSCAPE}
              />
            )}
            {appState === AppState.ERROR && errorDetails && (
              <div className="text-center bg-red-950/30 border border-red-500/50 p-8 sm:p-12 rounded-[2.5rem] max-w-xl shadow-[0_0_100px_rgba(239,68,68,0.15)] backdrop-blur-xl animate-in fade-in zoom-in-95 duration-500">
                <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-8 border border-red-500/30">
                  <span className="text-red-500 text-5xl">!</span>
                </div>
                <h2 className="text-2xl font-bold text-red-400 mb-4">{errorDetails.message}</h2>
                <div className="bg-black/40 rounded-2xl p-6 mb-8 border border-white/5">
                  <h3 className="text-indigo-400 text-xs font-bold uppercase tracking-widest mb-3 text-left">Hvordan fikse dette:</h3>
                  <p className="text-gray-300 text-sm leading-relaxed text-left font-medium">
                    {errorDetails.suggestion}
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                   <button 
                     onClick={handleNewVideo} 
                     className="px-10 py-4 bg-gray-800 hover:bg-gray-700 text-white rounded-2xl font-bold transition-all flex items-center justify-center gap-2"
                   >
                     Gå tilbake
                   </button>
                   <button 
                     onClick={() => videoHistory.length > 0 && handleGenerate(videoHistory[0].params)} 
                     className="px-10 py-4 bg-red-600 hover:bg-red-500 text-white rounded-2xl font-bold transition-all shadow-xl shadow-red-900/20 flex items-center justify-center gap-2"
                   >
                     <ArrowPathIcon className="w-5 h-5" />
                     Prøv igjen nå
                   </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <section ref={galleryRef} className="w-full max-w-6xl mx-auto mt-24 mb-32 px-4">
        <div className="flex items-center justify-between mb-8 border-b border-gray-800 pb-6">
          <h3 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
            <RectangleStackIcon className="w-6 h-6 text-indigo-400" />
            Min Mappe
          </h3>
          <span className="bg-gray-800 text-indigo-400 text-xs font-bold px-4 py-1.5 rounded-full border border-gray-700 uppercase">
            {videoHistory.length} Videoer
          </span>
        </div>
        {videoHistory.length > 0 ? (
          <VideoGallery items={videoHistory} onExtend={handleExtendFromItem} />
        ) : (
          <div className="text-center py-20 bg-gray-900/20 rounded-3xl border-2 border-dashed border-gray-800">
            <p className="text-gray-600">Her vil dine videoer dukke opp etter hvert.</p>
          </div>
        )}
      </section>

      <footer className="py-12 px-8 flex flex-col items-center border-t border-gray-900 text-[10px] text-gray-500 font-mono tracking-widest uppercase bg-black/80 backdrop-blur-md">
        <div className="bg-gray-900/80 px-8 py-4 rounded-2xl border border-white/5 shadow-2xl mb-4 flex flex-col items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-indigo-500 animate-pulse"></div>
          <span className="text-gray-200 text-sm font-bold tracking-normal">Utviklet og designet av Thomas S.E. Austenaa</span>
          <span className="text-gray-500 text-[9px] tracking-widest mt-1">AUSTENÅ.NO • 2025</span>
        </div>
        <div className="flex gap-6">
          <a href="https://austenaa.eu" target="_blank" rel="noopener" className="text-indigo-400 hover:text-indigo-300 transition-colors">Portefølje</a>
          <span className="opacity-30">|</span>
          <span className="opacity-50">&copy; TUSSIESTUDIO</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
