
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { KeyIcon } from './icons';

interface ApiKeyDialogProps {
  onSelectKey: () => void;
}

const ApiKeyDialog: React.FC<ApiKeyDialogProps> = ({ onSelectKey }) => {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-md">
      <div className="bg-gray-900 border border-white/10 rounded-[2.5rem] shadow-[0_0_100px_rgba(99,102,241,0.2)] max-w-lg w-full p-10 text-center flex flex-col items-center border-t-indigo-500/50">
        <div className="bg-indigo-600/20 p-5 rounded-full mb-8 border border-indigo-500/20">
          <KeyIcon className="w-12 h-12 text-indigo-400" />
        </div>
        <h2 className="text-3xl font-black text-white mb-4 uppercase tracking-tight">API Nøkkel</h2>
        <p className="text-gray-400 mb-6 text-sm leading-relaxed">
          For å bruke Austenå Storyboard Studio trenger du en Google API-nøkkel.
          <br/>
          Denne versjonen bruker <span className="text-indigo-400 font-bold">Gratis-modeller</span> (Gemini 2.5 Flash), så du trenger ikke betalingskonto.
        </p>
        
        <button
          onClick={onSelectKey}
          className="w-full px-6 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-[0.2em] rounded-2xl transition-all shadow-lg shadow-indigo-600/20 active:scale-[0.98]"
        >
          Velg API-nøkkel
        </button>
        
        <p className="mt-6 text-[9px] text-gray-500 uppercase tracking-widest font-mono">
          Austenå AI — Free Tier Edition
        </p>
      </div>
    </div>
  );
};

export default ApiKeyDialog;
