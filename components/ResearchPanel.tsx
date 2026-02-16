
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { ResearchResult } from '../types';
import { XMarkIcon, SearchIcon, ArrowRightIcon } from './icons';

interface ResearchPanelProps {
  data: ResearchResult;
  onClose: () => void;
}

const ResearchPanel: React.FC<ResearchPanelProps> = ({ data, onClose }) => {
  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-xl bg-[#0a0a0a] border-l border-white/10 z-[100] shadow-[0_0_100px_rgba(0,0,0,0.9)] p-8 overflow-y-auto animate-in slide-in-from-right duration-500 backdrop-blur-3xl">
      <div className="flex items-center justify-between mb-10">
        <div className="flex items-center gap-3">
          <SearchIcon className="w-5 h-5 text-indigo-500" />
          <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-white">Cinematic Research</h3>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors">
          <XMarkIcon className="w-6 h-6 text-gray-500" />
        </button>
      </div>

      <div className="prose prose-invert max-w-none mb-12">
        <div className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap font-sans">
          {data.text}
        </div>
      </div>

      {data.sources.length > 0 && (
        <div className="border-t border-white/5 pt-8">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-500 mb-6">Referanser og Kilder</h4>
          <div className="grid grid-cols-1 gap-3">
            {data.sources.map((source, i) => (
              <a 
                key={i} 
                href={source.uri} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5 hover:border-indigo-500/30 transition-all group"
              >
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-500 font-mono uppercase truncate max-w-[200px]">{new URL(source.uri).hostname}</span>
                  <span className="text-xs text-white font-bold group-hover:text-indigo-400 transition-colors">{source.title}</span>
                </div>
                <ArrowRightIcon className="w-4 h-4 text-gray-600 group-hover:text-indigo-500 transition-all" />
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="mt-12 p-6 bg-indigo-500/5 rounded-2xl border border-indigo-500/10">
        <p className="text-[10px] text-gray-500 mb-4 font-mono uppercase tracking-widest">Tips:</p>
        <p className="text-xs text-gray-400 italic leading-relaxed">
          Kopier deler av teksten over inn i prompten din for å gi videoen en mer spesifikk estetisk retning (f.eks. "Anamorphic lens flares" eller "Kodak Portra color grading").
        </p>
      </div>
    </div>
  );
};

export default ResearchPanel;
