
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import {
  GoogleGenAI,
  Video,
} from '@google/genai';
import {GenerateVideoParams, GenerationMode, VeoModel, ResearchResult} from '../types';

const handleApiError = async (error: any) => {
  const errorMsg = error?.message || String(error);
  if (
    errorMsg.includes('429') || 
    errorMsg.includes('quota') || 
    errorMsg.includes('RESOURCE_EXHAUSTED') ||
    errorMsg.includes('Requested entity was not found')
  ) {
    if (window.aistudio) {
      window.aistudio.openSelectKey().catch(console.error);
    }
    throw new Error("BILLETING_REQUIRED: API-kvoten er nådd eller Tier 1 (Paid plan) kreves for denne operasjonen.");
  }
  throw error;
};

/**
 * Utfører et AI-søk (lignende Perplexity) for å hjelpe brukeren med research.
 */
export const conductResearch = async (query: string): Promise<ResearchResult> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey && window.aistudio) await window.aistudio.openSelectKey();
  
  const ai = new GoogleGenAI({apiKey: process.env.API_KEY || ''});
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Du er en filmeviter og visuell researcher. Svar på følgende spørsmål med fokus på kinematografi, lyssetting, kamerabevegelser og visuelle stiler som kan brukes i en AI-video-prompt: ${query}`,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });

    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
      ?.map((chunk: any) => ({
        title: chunk.web?.title || 'Kilde',
        uri: chunk.web?.uri
      }))
      .filter((s: any) => s.uri) || [];

    return {
      text: response.text || "Ingen svar fra søkemotoren.",
      sources: sources
    };
  } catch (error) {
    return handleApiError(error);
  }
};

const expandPromptWithQwenLogic = async (prompt: string): Promise<string> => {
  const ai = new GoogleGenAI({apiKey: process.env.API_KEY || ''});
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Transform this video prompt into a highly dense, cinematic, and descriptive scene description for a high-end video AI. Focus on lighting, textures, camera movement and atmospheric details. KEEP IT UNDER 80 WORDS. Original: ${prompt}. Output ONLY the expanded description.`,
      config: { thinkingConfig: { thinkingBudget: 2000 } }
    });
    return response.text?.trim() || prompt;
  } catch (error) {
    return prompt;
  }
};

const generateStoryboardFallback = async (params: GenerateVideoParams) => {
  const ai = new GoogleGenAI({apiKey: process.env.API_KEY || ''});
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [{ text: `Professional cinematic movie still, high budget, 8k, detailed textures: ${params.prompt}` }]
    },
    config: {
      imageConfig: {
        aspectRatio: params.aspectRatio === '16:9' ? '16:9' : '9:16'
      }
    }
  });

  const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
  if (!part?.inlineData) throw new Error("Kunne ikke generere bilde.");

  const base64 = part.inlineData.data;
  const byteArray = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  const blob = new Blob([byteArray], {type: 'image/png'});
  const objectUrl = URL.createObjectURL(blob);

  return { objectUrl, blob, uri: '', video: null, isStoryboard: true };
};

export const generateVideo = async (
  params: GenerateVideoParams,
): Promise<{objectUrl: string; blob: Blob; uri: string; video: Video | null; isStoryboard?: boolean}> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    if (window.aistudio) await window.aistudio.openSelectKey();
    throw new Error("BILLETING_REQUIRED: API-nøkkel mangler.");
  }

  const ai = new GoogleGenAI({apiKey: apiKey});

  if (params.model === VeoModel.FALLBACK_STORYBOARD) {
    return generateStoryboardFallback(params);
  }

  let finalPrompt = params.prompt;
  let targetModel = params.model === VeoModel.VEO_QWEN_HYBRID ? VeoModel.VEO : params.model;

  if (params.model === VeoModel.VEO_QWEN_HYBRID && params.prompt) {
    finalPrompt = await expandPromptWithQwenLogic(params.prompt);
  }

  const payload: any = {
    model: targetModel,
    config: {
      numberOfVideos: 1,
      resolution: params.resolution,
      aspectRatio: params.aspectRatio,
    },
  };

  if (finalPrompt) payload.prompt = finalPrompt.trim();

  if (params.mode === GenerationMode.EXTEND_VIDEO && params.inputVideoObject) {
    payload.video = params.inputVideoObject;
  } else if (params.mode === GenerationMode.FRAMES_TO_VIDEO && params.startFrame) {
    payload.image = { imageBytes: params.startFrame.base64, mimeType: 'image/png' };
    if (params.isLooping || params.endFrame) {
      payload.config.lastFrame = { 
        imageBytes: (params.isLooping ? params.startFrame : params.endFrame)!.base64, 
        mimeType: 'image/png' 
      };
    }
  }

  try {
    let operation = await ai.models.generateVideos(payload);
    while (!operation.done) {
      await new Promise((resolve) => setTimeout(resolve, 8000));
      operation = await ai.operations.getVideosOperation({operation: operation});
    }

    if (operation?.response?.generatedVideos?.[0]) {
      const videoObject = operation.response.generatedVideos[0].video;
      const res = await fetch(`${videoObject.uri}&key=${apiKey}`);
      if (!res.ok) throw new Error("Nedlasting feilet.");
      const videoBlob = await res.blob();
      return {objectUrl: URL.createObjectURL(videoBlob), blob: videoBlob, uri: videoObject.uri, video: videoObject};
    } else {
      throw new Error("API returnerte ingen video. Sjekk Tier status.");
    }
  } catch (err: any) {
    return handleApiError(err);
  }
};
