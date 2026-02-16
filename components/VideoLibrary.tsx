
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { SavedVideo, AspectRatio } from '../types';
import { SparklesIcon, XMarkIcon, FilmIcon } from './icons';

interface VideoLibraryProps {
  videos: SavedVideo[];
  onSelect: (video: SavedVideo) => void;
  onRemove: (id: string) => void;
  onContinue: (video: SavedVideo) => void;
}

const VideoLibrary: React.FC<VideoLibraryProps> = ({ videos, onSelect, onRemove, onContinue }) => {
  if (videos.length === 0) return null;

  return (
    <div className="mt-12 w-full max-w-5xl">
      <div className="flex items-center justify-between mb-6 px-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/10 rounded-lg">
            <FilmIcon className="w-4 h-4 text-indigo-400" />
          </div>
          <h3 className="text-[11px] font-bold uppercase tracking-[0.4em] text-white/50">Prosjektmappe</h3>
        </div>
        <div className="h-px flex-grow mx-6 bg-gradient-to-r from-white/5 to-transparent"></div>
        <span className="text-[10px] text-indigo-400 font-mono bg-indigo-400/5 px-3 py-1 rounded-full border border-indigo-400/10">
          {videos.length} FILER
        </span>
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6 px-2 pb-12">
        {videos.map((v) => (
          <div key={v.id} className="relative group flex flex-col gap-3">
            <div 
              className={`relative overflow-hidden rounded-2xl border border-white/5 bg-gray-950 shadow-2xl transition-all duration-500 group-hover:border-indigo-500/50 group-hover:-translate-y-1 w-full ${v.params.aspectRatio === AspectRatio.PORTRAIT ? 'aspect-[9/16]' : 'aspect-video'}`}
            >
              <video 
                src={v.url} 
                className="w-full h-full object-cover opacity-40 group-hover:opacity-100 transition-all duration-700 scale-105 group-hover:scale-100"
                onMouseOver={(e) => e.currentTarget.play()}
                onMouseOut={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
                muted
                loop
              />
              
              <div 
                onClick={() => onSelect(v)}
                className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-end p-4 cursor-pointer"
              >
                <div className="text-[9px] text-white/70 font-mono mb-3 line-clamp-2 uppercase tracking-tight">
                  {v.params.prompt || "Navnløs sekvens"}
                </div>
                
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onContinue(v);
                  }}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[9px] font-black uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 transition-all transform translate-y-2 group-hover:translate-y-0 shadow-lg shadow-indigo-600/20"
                >
                  <SparklesIcon className="w-3.5 h-3.5" />
                  Koble neste scene
                </button>
              </div>
            </div>
            
            <button 
              onClick={() => onRemove(v.id)}
              className="absolute -top-2 -right-2 w-7 h-7 bg-red-950/90 border border-red-500/30 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-red-600 z-20 shadow-xl"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
            
            <div className="px-1">
              <div className="text-[9px] text-gray-500 font-mono truncate uppercase tracking-tighter opacity-0 group-hover:opacity-100 transition-opacity">
                {new Date(v.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} • VEO 3.1
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default VideoLibrary;
