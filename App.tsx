
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
import {generateVideo} from './services/geminiService';
import {
  AppState,
  AspectRatio,
  GenerateVideoParams,
  GenerationMode,
  Resolution,
  VeoModel,
  VideoFile,
} from './types';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<VeoModel>(VeoModel.VEO_QWEN_HYBRID);
  const [lastConfig, setLastConfig] = useState<GenerateVideoParams | null>(
    null,
  );
  const [lastVideoObject, setLastVideoObject] = useState<Video | null>(null);
  const [lastVideoBlob, setLastVideoBlob] = useState<Blob | null>(null);
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);
  const [isApiKeyValidated, setIsApiKeyValidated] = useState(false);

  const [initialFormValues, setInitialFormValues] =
    useState<GenerateVideoParams | null>(null);

  useEffect(() => {
    const checkApiKeyStatus = async () => {
      // Sjekk om vi er i AI Studio miljøet (hvor nøkkelvalg er påkrevd for Veo)
      if (window.aistudio) {
        try {
          const hasKey = await window.aistudio.hasSelectedApiKey();
          if (!hasKey) {
            setShowApiKeyDialog(true);
          } else {
            setIsApiKeyValidated(true);
          }
        } catch (error) {
          console.error("Kunne ikke verifisere nøkkel via AI Studio:", error);
          setShowApiKeyDialog(true);
        }
      } else {
        // I en APK eller på eget domene antar vi at API_KEY er satt i miljøet
        setIsApiKeyValidated(true);
      }
    };
    checkApiKeyStatus();
  }, []);

  const handleGenerate = useCallback(async (params: GenerateVideoParams) => {
    // Tving VEO (Pro) ved forlengelse for best resultat
    const finalParams = {
      ...params,
      model: params.mode === GenerationMode.EXTEND_VIDEO ? VeoModel.VEO : selectedModel
    };

    // Sjekk på nytt hvis vi er i AI Studio
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
      setVideoUrl(objectUrl);
      setLastVideoBlob(blob);
      setLastVideoObject(video);
      setAppState(AppState.SUCCESS);
    } catch (error) {
      console.error('Video generation failed:', error);
      const msg = error instanceof Error ? error.message : 'En ukjent feil oppstod.';
      setErrorMessage(msg);
      setAppState(AppState.ERROR);
      
      // Hvis feilen er relatert til tilgang/betaling, vis nøkkel-dialogen igjen
      if (msg.includes('403') || msg.includes('401') || msg.includes('billing') || msg.includes('not found')) {
        setShowApiKeyDialog(true);
        setIsApiKeyValidated(false);
      }
    }
  }, [selectedModel]);

  const handleRetry = useCallback(() => {
    if (lastConfig) handleGenerate(lastConfig);
  }, [lastConfig, handleGenerate]);

  const handleApiKeyDialogContinue = async () => {
    setShowApiKeyDialog(false);
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      // Som per retningslinjer: anta suksess etter openSelectKey for å unngå race conditions
      setIsApiKeyValidated(true);
    } else {
      setIsApiKeyValidated(true);
    }
    
    // Hvis vi kom fra en feil, prøv på nytt
    if (appState === AppState.ERROR && lastConfig) {
      handleRetry();
    }
  };

  const handleNewVideo = useCallback(() => {
    setAppState(AppState.IDLE);
    setVideoUrl(null);
    setErrorMessage(null);
    setLastConfig(null);
    setLastVideoObject(null);
    setLastVideoBlob(null);
    setInitialFormValues(null);
  }, []);

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
      setErrorMessage(null);
    }
  }, [lastConfig, lastVideoBlob, lastVideoObject]);

  const canExtend = lastConfig?.resolution === Resolution.P720;

  const getModelDisplayName = (m: VeoModel) => {
    switch (m) {
      case VeoModel.VEO: return 'VEO 3.1 PRO';
      case VeoModel.VEO_FAST: return 'VEO 3.1 FAST';
      case VeoModel.VEO_QWEN_HYBRID: return 'QWEN-STYLE HYBRID';
    }
  };

  return (
    <div className="h-screen bg-black text-gray-200 flex flex-col font-sans overflow-hidden">
      {showApiKeyDialog && <ApiKeyDialog onContinue={handleApiKeyDialogContinue} />}

      {/* Modellvelger i hjørnet */}
      <div className="absolute top-6 right-8 flex flex-col items-end gap-2 z-20">
        <div className="relative group">
          <div className="border border-indigo-400/50 bg-black/60 backdrop-blur-md px-4 py-2 text-indigo-400 text-xs font-mono flex items-center gap-3 cursor-pointer hover:bg-indigo-400/10 transition-all rounded-sm shadow-lg shadow-indigo-500/10">
            <span className="opacity-60 uppercase tracking-widest">Aura Engine:</span>
            <span className="font-bold">{getModelDisplayName(selectedModel)}</span>
            <ChevronDownIcon className="w-3 h-3" />
          </div>
          <div className="absolute top-full right-0 mt-2 w-64 bg-[#121212] border border-indigo-400/20 shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all rounded-md overflow-hidden z-30">
            <button 
              onClick={() => setSelectedModel(VeoModel.VEO_QWEN_HYBRID)}
              className={`w-full text-left px-4 py-3 text-xs font-mono hover:bg-indigo-400/10 transition-colors ${selectedModel === VeoModel.VEO_QWEN_HYBRID ? 'text-white bg-indigo-400/5 border-l-2 border-indigo-400' : 'text-gray-400'}`}>
              <div className="font-bold flex items-center gap-2">
                QWEN-STYLE HYBRID 
                <span className="px-1 bg-indigo-500 text-[8px] rounded-sm text-white">DUAL</span>
              </div>
              <div className="text-[9px] opacity-50 mt-1">Semantic expansion + Veo 3.1</div>
            </button>
            <button 
              onClick={() => setSelectedModel(VeoModel.VEO)}
              className={`w-full text-left px-4 py-3 text-xs font-mono hover:bg-indigo-400/10 transition-colors ${selectedModel === VeoModel.VEO ? 'text-white bg-indigo-400/5 border-l-2 border-indigo-400' : 'text-gray-400'}`}>
              <div className="font-bold">VEO 3.1 PRO</div>
              <div className="text-[9px] opacity-50 mt-1">Direct cinematic control</div>
            </button>
            <button 
              onClick={() => setSelectedModel(VeoModel.VEO_FAST)}
              className={`w-full text-left px-4 py-3 text-xs font-mono hover:bg-indigo-400/10 transition-colors ${selectedModel === VeoModel.VEO_FAST ? 'text-white bg-indigo-400/5 border-l-2 border-indigo-400' : 'text-gray-400'}`}>
              <div className="font-bold">VEO 3.1 FAST</div>
              <div className="text-[9px] opacity-50 mt-1">Rapid iterative drafting</div>
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${isApiKeyValidated ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></div>
          <span className="text-[10px] font-mono text-gray-500 uppercase tracking-tighter">
            API Status: {isApiKeyValidated ? 'Ready' : 'Pending Selection'}
          </span>
        </div>
      </div>

      <header className="pt-12 pb-4 flex flex-col items-center justify-center px-8 relative z-10">
        <div className="w-64 h-12 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 mb-6 shadow-lg shadow-indigo-500/20 rounded-sm opacity-90"></div>
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tighter text-center bg-gradient-to-r from-indigo-200 via-white to-pink-200 bg-clip-text text-transparent">
          TussieStudio
        </h1>
        <div className="mt-2 flex items-center gap-3">
          <span className="text-[10px] text-gray-600 tracking-[0.3em] uppercase">Cinematic Intelligence</span>
          <span className="w-1 h-1 bg-gray-700 rounded-full"></span>
          <span className="text-[10px] text-indigo-400/80 tracking-widest font-mono">austenaa.eu</span>
        </div>
      </header>
      
      <main className="w-full max-w-4xl mx-auto flex-grow flex flex-col p-4 relative">
        {appState === AppState.IDLE ? (
          <>
            <div className="flex-grow flex items-center justify-center">
              <div className="relative text-center">
                <h2 className="text-3xl text-gray-700 font-light italic">Start your vision below</h2>
                <CurvedArrowDownIcon className="absolute top-full left-1/2 -translate-x-1/2 mt-6 w-16 h-16 text-gray-800 opacity-40" />
              </div>
            </div>
            <div className="pb-8">
              <PromptForm onGenerate={handleGenerate} initialValues={initialFormValues} />
            </div>
          </>
        ) : (
          <div className="flex-grow flex items-center justify-center">
            {appState === AppState.LOADING && <LoadingIndicator />}
            {appState === AppState.SUCCESS && videoUrl && (
              <VideoResult
                videoUrl={videoUrl}
                onRetry={handleRetry}
                onNewVideo={handleNewVideo}
                onExtend={handleExtend}
                canExtend={canExtend}
                aspectRatio={lastConfig?.aspectRatio || AspectRatio.LANDSCAPE}
              />
            )}
            {appState === AppState.ERROR && errorMessage && (
              <div className="text-center max-w-md bg-red-950/20 border border-red-900/50 p-10 rounded-2xl backdrop-blur-sm">
                <div className="w-12 h-12 bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-red-500 text-2xl">!</span>
                </div>
                <h2 className="text-xl font-bold text-red-400 mb-3">System Error</h2>
                <p className="text-red-300/70 text-sm leading-relaxed mb-8">{errorMessage}</p>
                <div className="flex flex-col gap-3">
                  <button onClick={handleNewVideo} className="w-full py-3 bg-red-900/40 hover:bg-red-900/60 text-red-200 rounded-lg transition-all font-medium">Reset Studio</button>
                  <button onClick={handleRetry} className="w-full py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-all">Try Last Attempt Again</button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="py-4 text-center border-t border-gray-900/50">
        <p className="text-[9px] text-gray-700 uppercase tracking-[0.4em]">
          Published at video.austenaa.eu & APK.austenå.no
        </p>
      </footer>
    </div>
  );
};

export default App;
