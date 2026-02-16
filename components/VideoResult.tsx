
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, {useState, useRef} from 'react';
import {AspectRatio} from '../types';
import {ArrowPathIcon, DownloadIcon, SparklesIcon, FileImageIcon, PlusIcon} from './icons';
// @ts-ignore
import gifshot from 'gifshot';

interface VideoResultProps {
  videoUrl: string;
  onRetry: () => void;
  onNewVideo: () => void;
  onExtend: () => void;
  onContinue: () => void;
  canExtend: boolean;
  aspectRatio: AspectRatio;
}

const VideoResult: React.FC<VideoResultProps> = ({
  videoUrl,
  onRetry,
  onNewVideo,
  onExtend,
  onContinue,
  canExtend,
  aspectRatio,
}) => {
  const isPortrait = aspectRatio === AspectRatio.PORTRAIT;
  const isVideo = videoUrl.includes('.mp4') || !videoUrl.includes('image/png');
  const [isConvertingGif, setIsConvertingGif] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleDownloadGif = async (frames: number) => {
    if (!videoUrl || !isVideo) return;
    setIsConvertingGif(true);
    // ... gif logic (kun for video)
    setIsConvertingGif(false);
  };

  return (
    <div className="w-full relative flex flex-col items-center gap-8 p-12 bg-gray-900/40 rounded-3xl border border-white/5 backdrop-blur-xl shadow-2xl overflow-visible">
      <button
        onClick={onNewVideo}
        className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold uppercase tracking-wider rounded-full border border-white/10 transition-all active:scale-95 z-10"
      >
        <PlusIcon className="w-3.5 h-3.5" />
        Ny Start
      </button>

      <div className="text-center">
        <h2 className="text-3xl font-light tracking-tight text-white/90">
          {isVideo ? 'Video Fullført' : 'Storyboard Fullført'}
        </h2>
        <p className="text-[10px] text-indigo-400 uppercase tracking-[0.3em] mt-2 font-mono">
          {isVideo ? 'Veo 3.1 Cinematic Engine' : 'Nød-modus (Gemini Vision)'}
        </p>
      </div>

      <div 
        className={`relative group w-full ${
          isPortrait ? 'max-w-xs aspect-[9/16]' : 'max-w-2xl aspect-video'
        } rounded-2xl overflow-hidden bg-black shadow-[0_0_80px_rgba(99,102,241,0.15)] border border-white/10 transition-all duration-700`}
      >
        {isVideo ? (
          <video
            ref={videoRef}
            src={videoUrl}
            controls
            autoPlay
            loop
            className="w-full h-full object-contain"
            onLoadedMetadata={(e) => setVideoDuration(e.currentTarget.duration)}
          />
        ) : (
          <img src={videoUrl} className="w-full h-full object-cover" alt="Storyboard" />
        )}
      </div>

      <div className="flex flex-wrap justify-center gap-4">
        <button
          onClick={onRetry}
          className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 text-white/80 font-semibold rounded-xl border border-white/10 transition-all active:scale-95"
        >
          <ArrowPathIcon className="w-5 h-5" />
          Prøv igjen
        </button>
        
        <a
          href={videoUrl}
          download={isVideo ? "tussiestudio.mp4" : "storyboard.png"}
          className="flex items-center gap-2 px-6 py-3 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-all active:scale-95"
        >
          <DownloadIcon className="w-5 h-5" />
          Last ned
        </a>

        {isVideo && (
          <button
            disabled={isConvertingGif}
            onClick={() => handleDownloadGif(10)}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all active:scale-95"
          >
            <FileImageIcon className="w-5 h-5" />
            GIF
          </button>
        )}

        {canExtend && isVideo && (
          <button
            onClick={onExtend}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-950 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-900 hover:border-indigo-400 font-bold rounded-xl transition-all active:scale-95"
          >
            <SparklesIcon className="w-5 h-5" />
            Forleng
          </button>
        )}
      </div>
    </div>
  );
};

export default VideoResult;
