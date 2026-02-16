
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { VideoHistoryItem, Resolution } from '../types';
import { SparklesIcon, DownloadIcon, FilmIcon, PlusIcon } from './icons';

interface VideoGalleryProps {
  items: VideoHistoryItem[];
  onExtend: (item: VideoHistoryItem) => void;
}

const VideoGallery: React.FC<VideoGalleryProps> = ({ items, onExtend }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-8">
      {items.map((item) => {
        const canExtend = item.params.resolution === Resolution.P720;
        
        return (
          <div key={item.id} className="group relative bg-gray-900/40 rounded-2xl overflow-hidden border border-gray-800 hover:border-indigo-500/50 transition-all duration-500 shadow-2xl flex flex-col">
            {/* Forhåndsvisning */}
            <div className="aspect-video bg-black flex items-center justify-center overflow-hidden relative">
              <video 
                src={item.objectUrl} 
                className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-700" 
                muted
                onMouseEnter={(e) => e.currentTarget.play()}
                onMouseLeave={(e) => {
                  e.currentTarget.pause();
                  e.currentTarget.currentTime = 0;
                }}
              />
              
              {/* Forleng-knapp i hjørnet */}
              {canExtend && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onExtend(item);
                  }}
                  className="absolute top-3 right-3 bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-xl flex items-center gap-2 shadow-2xl transform scale-90 group-hover:scale-100 transition-all z-10 font-bold text-[10px] uppercase tracking-tighter"
                  title="Fortsett historien fra denne videoen"
                >
                  <div className="relative">
                    <FilmIcon className="w-4 h-4" />
                    <PlusIcon className="w-2 h-2 absolute -top-0.5 -right-0.5 bg-indigo-400 rounded-full" />
                  </div>
                  Forleng
                </button>
              )}
              
              {/* Tid og Oppløsning Badge */}
              <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-md text-[9px] text-gray-300 px-2 py-1 rounded-lg border border-white/5 font-mono flex gap-2">
                <span>{item.params.resolution}</span>
                <span className="opacity-50">|</span>
                <span>{new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
              </div>
            </div>

            {/* Handlinger under videoen */}
            <div className="p-4 bg-gray-900/60 backdrop-blur-sm border-t border-gray-800 flex items-center justify-between">
               <p className="text-[10px] text-gray-500 truncate italic pr-4">
                 "{item.params.prompt || 'Uten beskrivelse'}"
               </p>
               
               <a 
                  href={item.objectUrl} 
                  download={`tussie-video-${item.id}.mp4`}
                  className="p-2 text-gray-400 hover:text-white hover:bg-indigo-600/20 rounded-xl transition-all"
                  title="Last ned til maskinen"
                >
                  <DownloadIcon className="w-5 h-5" />
                </a>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default VideoGallery;
