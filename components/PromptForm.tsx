
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import {Video} from '@google/genai';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  AspectRatio,
  GenerateVideoParams,
  GenerationMode,
  ImageFile,
  Resolution,
  VeoModel,
} from '../types';
import {
  ChevronDownIcon,
  FilmIcon,
  FramesModeIcon,
  PlusIcon,
  ReferencesModeIcon,
  TextModeIcon,
  XMarkIcon,
  CameraIcon,
  SparklesIcon,
  TvIcon,
} from './icons';

const modeIcons: Record<GenerationMode, React.ReactNode> = {
  [GenerationMode.TEXT_TO_VIDEO]: <TextModeIcon className="w-5 h-5" />,
  [GenerationMode.FRAMES_TO_VIDEO]: <FramesModeIcon className="w-5 h-5" />,
  [GenerationMode.REFERENCES_TO_VIDEO]: <ReferencesModeIcon className="w-5 h-5" />,
  [GenerationMode.EXTEND_VIDEO]: <FilmIcon className="w-5 h-5" />,
};

const fileToBase64 = (file: File): Promise<ImageFile> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve({file, base64});
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const CustomSelect: React.FC<{
  label: string;
  value: string;
  onChange: (val: any) => void;
  icon: React.ReactNode;
  options: {value: string, label: string}[];
  disabled?: boolean;
}> = ({label, value, onChange, icon, options, disabled}) => (
  <div className="flex-1 min-w-[140px]">
    <label className="text-[10px] uppercase font-bold text-gray-500 mb-1.5 block px-1">{label}</label>
    <div className="relative group">
      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-500 group-hover:text-indigo-400 transition-colors">
        {icon}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full bg-[#0a0a0a] border border-gray-800 rounded-xl pl-10 pr-8 py-3 text-sm appearance-none focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all disabled:opacity-50"
      >
        {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
      <ChevronDownIcon className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" />
    </div>
  </div>
);

const CameraCapture: React.FC<{ onCapture: (img: ImageFile) => void; onClose: () => void }> = ({onCapture, onClose}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      .then(setStream)
      .catch(() => alert('Kamera-tilgang nektet.'));
    return () => stream?.getTracks().forEach(t => t.stop());
  }, []);

  useEffect(() => { if (videoRef.current && stream) videoRef.current.srcObject = stream; }, [stream]);

  const capture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx?.translate(canvas.width, 0); ctx?.scale(-1, 1);
    ctx?.drawImage(videoRef.current, 0, 0);
    canvas.toBlob(async (b) => {
      if (b) {
        const file = new File([b], "selfie.jpg", {type: "image/jpeg"});
        onCapture(await fileToBase64(file));
      }
    }, 'image/jpeg');
  };

  return (
    <div className="fixed inset-0 bg-black/95 z-[100] flex flex-col items-center justify-center p-4 backdrop-blur-md">
      <div className="relative w-full max-w-lg aspect-video rounded-3xl overflow-hidden border-4 border-white/10 shadow-2xl">
        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover scale-x-[-1]" />
        <button onClick={onClose} className="absolute top-4 right-4 bg-black/60 p-2 rounded-full"><XMarkIcon className="w-6 h-6" /></button>
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="w-1/2 h-2/3 border-2 border-white/20 rounded-[50%] border-dashed"></div>
        </div>
      </div>
      <button onClick={capture} className="mt-10 w-20 h-20 bg-indigo-600 hover:bg-indigo-500 rounded-full flex items-center justify-center text-white shadow-2xl active:scale-90 transition-all border-4 border-white/10">
        <CameraIcon className="w-10 h-10" />
      </button>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

interface PromptFormProps {
  onGenerate: (params: GenerateVideoParams) => void;
  initialValues?: GenerateVideoParams | null;
  selectedModel: VeoModel;
}

const PromptForm: React.FC<PromptFormProps> = ({ onGenerate, initialValues, selectedModel }) => {
  const [prompt, setPrompt] = useState(initialValues?.prompt ?? '');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(initialValues?.aspectRatio ?? AspectRatio.LANDSCAPE);
  const [resolution, setResolution] = useState<Resolution>(initialValues?.resolution ?? Resolution.P720);
  const [mode, setMode] = useState<GenerationMode>(initialValues?.mode ?? GenerationMode.TEXT_TO_VIDEO);
  const [startFrame, setStartFrame] = useState<ImageFile | null>(initialValues?.startFrame ?? null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isModeOpen, setIsModeOpen] = useState(false);

  useEffect(() => {
    if (initialValues) {
      setPrompt(initialValues.prompt ?? '');
      setMode(initialValues.mode ?? GenerationMode.TEXT_TO_VIDEO);
      setStartFrame(initialValues.startFrame ?? null);
    }
  }, [initialValues]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onGenerate({
      prompt,
      model: selectedModel,
      aspectRatio,
      resolution,
      mode,
      startFrame,
      inputVideoObject: initialValues?.inputVideoObject
    });
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setStartFrame(await fileToBase64(f));
      setMode(GenerationMode.FRAMES_TO_VIDEO);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto relative">
      {isCameraOpen && <CameraCapture onClose={() => setIsCameraOpen(false)} onCapture={(img) => { setStartFrame(img); setMode(GenerationMode.FRAMES_TO_VIDEO); setIsCameraOpen(false); }} />}
      
      <form onSubmit={handleSubmit} className="bg-[#0f0f0f] border border-white/5 p-8 rounded-[2.5rem] shadow-[0_30px_60px_rgba(0,0,0,0.8)]">
        
        <div className="flex gap-3 mb-6 overflow-x-auto pb-2 custom-scrollbar">
           <button type="button" onClick={() => setIsModeOpen(!isModeOpen)} className="flex items-center gap-2 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 px-5 py-3 rounded-2xl border border-indigo-500/20 transition-all text-xs font-bold whitespace-nowrap">
             {modeIcons[mode]}
             {mode}
             <ChevronDownIcon className="w-3 h-3" />
           </button>
           <button type="button" onClick={() => setIsCameraOpen(true)} className="flex items-center gap-2 bg-pink-600/10 hover:bg-pink-600/20 text-pink-400 px-5 py-3 rounded-2xl border border-pink-500/20 transition-all text-xs font-bold whitespace-nowrap animate-pulse">
             <CameraIcon className="w-4 h-4" />
             TA SELFIE & SNAKK
           </button>
           <label className="flex items-center gap-2 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 px-5 py-3 rounded-2xl border border-emerald-500/20 transition-all text-xs font-bold cursor-pointer whitespace-nowrap">
             <PlusIcon className="w-4 h-4" />
             FRA GALLERI
             <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
           </label>
        </div>

        {startFrame && (
          <div className="mb-6 flex flex-col gap-2 animate-in fade-in slide-in-from-top-4 duration-500">
             <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest pl-1">Startpunkt:</span>
             <div className="relative w-40 h-28 group rounded-2xl overflow-hidden border border-white/10 shadow-xl">
               <img src={URL.createObjectURL(startFrame.file)} className="w-full h-full object-cover" />
               <button onClick={() => setStartFrame(null)} className="absolute top-2 right-2 bg-black/60 p-1.5 rounded-full hover:bg-red-500/80 transition-colors">
                 <XMarkIcon className="w-3 h-3 text-white" />
               </button>
             </div>
          </div>
        )}

        <div className="relative group mb-8">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={startFrame ? "Hva skal skje med bildet? (f.eks: 'Endre fargen på huset til blått og legg til en stor terrasse')" : "Beskriv din cinematiske visjon..."}
            className="w-full bg-black/60 border border-white/5 rounded-3xl p-6 pr-16 text-xl text-white placeholder-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all min-h-[140px] leading-relaxed shadow-inner"
          />
          <button
            type="submit"
            disabled={!prompt && !startFrame}
            className="absolute bottom-6 right-6 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-800 text-white p-4 rounded-2xl shadow-2xl transition-all hover:scale-110 active:scale-95 disabled:opacity-30"
          >
            <SparklesIcon className="w-7 h-7" />
          </button>
        </div>

        <div className="flex flex-wrap gap-6">
          <CustomSelect 
            label="Bildeformat" 
            value={aspectRatio} 
            onChange={setAspectRatio} 
            icon={<TvIcon className="w-4 h-4" />}
            options={[{value: AspectRatio.LANDSCAPE, label: 'Kino (16:9)'}, {value: AspectRatio.PORTRAIT, label: 'Mobil (9:16)'}]}
          />
          <CustomSelect 
            label="Kvalitet" 
            value={resolution} 
            onChange={setResolution} 
            icon={<SparklesIcon className="w-4 h-4" />}
            disabled={mode === GenerationMode.EXTEND_VIDEO}
            options={[{value: Resolution.P720, label: 'Standard (720p)'}, {value: Resolution.P1080, label: 'Ultra (1080p)'}]}
          />
        </div>

        {isModeOpen && (
          <div className="absolute top-24 left-8 bg-[#151515] border border-white/10 rounded-2xl shadow-2xl z-50 p-2 w-64 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200">
            {Object.values(GenerationMode).map(m => (
              <button key={m} onClick={() => { setMode(m); setIsModeOpen(false); }} className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition-all flex items-center gap-3 ${mode === m ? 'text-indigo-400 bg-white/5' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}>
                {modeIcons[m]} {m}
              </button>
            ))}
          </div>
        )}
      </form>
    </div>
  );
};

export default PromptForm;
