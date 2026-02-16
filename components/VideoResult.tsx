
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
  const [isConvertingGif, setIsConvertingGif] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleDownloadGif = async (frames: number) => {
    if (!videoUrl) return;
    
    setIsConvertingGif(true);
    
    try {
      const video = document.createElement('video');
      video.src = videoUrl;
      video.muted = true;
      video.playsInline = true;
      video.crossOrigin = "anonymous";

      await new Promise((resolve) => {
        if (video.readyState >= 1) {
          resolve(null);
        } else {
          video.onloadedmetadata = () => resolve(null);
        }
      });

      const duration = video.duration;
      const width = isPortrait ? 360 : 640;
      const height = isPortrait ? 640 : 360;
      const step = duration / frames;

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      const images: string[] = [];

      for (let i = 0; i < frames; i++) {
        const time = i * step;
        if (time > 0) {
          video.currentTime = time;
          await new Promise((resolve) => {
             const onSeeked = () => {
               video.removeEventListener('seeked', onSeeked);
               resolve(null);
             };
             video.addEventListener('seeked', onSeeked);
          });
        }
        if (ctx) {
          ctx.drawImage(video, 0, 0, width, height);
          images.push(canvas.toDataURL('image/jpeg', 0.8));
        }
      }

      gifshot.createGIF({
        images: images,
        interval: 0.1,
        gifWidth: width,
        gifHeight: height,
        numFrames: frames,
        sampleInterval: 10,
      }, (obj: any) => {
        if (!obj.error) {
          const link = document.createElement('a');
          link.href = obj.image;
          link.download = `tussiestudio-${(frames/10).toFixed(1)}s.gif`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
        setIsConvertingGif(false);
      });
    } catch (error) {
      console.error('Error preparing GIF:', error);
      setIsConvertingGif(false);
    }
  };

  const getDurationLabel = (divisor: number) => {
    if (!videoDuration) return divisor === 1 ? '8s' : divisor === 2 ? '4s' : '2s';
    return `${Math.round(videoDuration / divisor)}s`;
  };

  const getFrames = (divisor: number) => {
    const duration = videoDuration || 8;
    return Math.floor((duration / divisor) * 10);
  }

  return (
    <div className="w-full relative flex flex-col items-center gap-8 p-12 bg-gray-900/40 rounded-3xl border border-white/5 backdrop-blur-xl shadow-2xl overflow-visible">
      <button
        onClick={onNewVideo}
        className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold uppercase tracking-wider rounded-full border border-white/10 transition-all active:scale-95 z-10"
      >
        <PlusIcon className="w-3.5 h-3.5" />
        Ny Video
      </button>

      <div className="text-center">
        <h2 className="text-3xl font-light tracking-tight text-white/90">
          Resultat fullført
        </h2>
        <p className="text-[10px] text-indigo-400 uppercase tracking-[0.3em] mt-2 font-mono">
          Veo 3.1 Cinematic Engine
        </p>
      </div>

      <div 
        className={`relative group w-full ${
          isPortrait ? 'max-w-xs aspect-[9/16]' : 'max-w-2xl aspect-video'
        } rounded-2xl overflow-hidden bg-black shadow-[0_0_80px_rgba(99,102,241,0.15)] border border-white/10 transition-all duration-700`}
      >
        <video
          ref={videoRef}
          src={videoUrl}
          controls
          autoPlay
          loop
          className="w-full h-full object-contain"
          onLoadedMetadata={(e) => setVideoDuration(e.currentTarget.duration)}
        />
        
        {/* Magic "Continue" button in the upper right corner */}
        <button
          onClick={onContinue}
          className="absolute top-4 right-4 p-3 bg-indigo-600/90 hover:bg-indigo-500 text-white rounded-full shadow-2xl shadow-indigo-500/40 backdrop-blur-sm transform transition-all hover:scale-110 active:scale-90 flex items-center justify-center border border-white/20 group-hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
          title="Fortsett scenen fra siste bilde"
        >
          <SparklesIcon className="w-5 h-5 animate-pulse" />
        </button>
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
          download="tussiestudio-video.mp4"
          className="flex items-center gap-2 px-6 py-3 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-all active:scale-95"
        >
          <DownloadIcon className="w-5 h-5" />
          Last ned MP4
        </a>

        <div className="relative group">
          <button
            disabled={isConvertingGif}
            onClick={() => handleDownloadGif(getFrames(1))}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all active:scale-95 disabled:opacity-50"
          >
            {isConvertingGif ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <FileImageIcon className="w-5 h-5" />
            )}
            GIF
          </button>
          
          {!isConvertingGif && (
            <div className="absolute bottom-full left-0 mb-3 w-48 bg-gray-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden opacity-0 translate-y-4 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto transition-all duration-300 z-50">
              <div className="p-3 text-[9px] text-gray-500 uppercase tracking-widest border-b border-white/5 text-center font-bold">Hastighet</div>
              <button onClick={() => handleDownloadGif(getFrames(4))} className="w-full text-left px-4 py-3 text-xs text-gray-300 hover:bg-white/5 flex justify-between"><span>4x Speed</span><span className="text-indigo-400 font-mono">{getDurationLabel(4)}</span></button>
              <button onClick={() => handleDownloadGif(getFrames(2))} className="w-full text-left px-4 py-3 text-xs text-gray-300 hover:bg-white/5 flex justify-between"><span>2x Speed</span><span className="text-indigo-400 font-mono">{getDurationLabel(2)}</span></button>
              <button onClick={() => handleDownloadGif(getFrames(1))} className="w-full text-left px-4 py-3 text-xs text-gray-300 hover:bg-white/5 flex justify-between"><span>Normal</span><span className="text-indigo-400 font-mono">{getDurationLabel(1)}</span></button>
            </div>
          )}
        </div>

        {canExtend && (
          <button
            onClick={onExtend}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-950 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-900 hover:border-indigo-400 font-bold rounded-xl transition-all active:scale-95"
          >
            <SparklesIcon className="w-5 h-5" />
            Forleng (7s)
          </button>
        )}
      </div>
    </div>
  );
};

export default VideoResult;
