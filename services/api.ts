
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { GoogleGenAI, Video } from '@google/genai';
import { GenerateParams, MediaType } from '../types';

export const generateMedia = async (params: GenerateParams): Promise<{blob: Blob, mediaType: MediaType, videoObject?: Video}> => {
  if (window.aistudio && !(await window.aistudio.hasSelectedApiKey())) {
    await window.aistudio.openSelectKey();
  }

  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("BILLETING_REQUIRED: API-nøkkel mangler.");
  }
  
  const ai = new GoogleGenAI({ apiKey });
  const { prompt, image, videoObject, isExtension } = params;

  try {
    // For ekte extension må vi bruke 'veo-3.1-generate-preview' (ikke fast) ifølge dokumentasjonen
    const modelName = isExtension ? 'veo-3.1-generate-preview' : 'veo-3.1-fast-generate-preview';
    
    const payload: any = {
      model: modelName,
      prompt: prompt || (isExtension ? "Continue the action naturally." : "Cinematic scene."),
      config: { 
        numberOfVideos: 1, 
        resolution: '720p', 
        aspectRatio: '16:9' 
      }
    };

    // Ekte extension: Bruk forrige video som referanse
    if (isExtension && videoObject) {
      payload.video = videoObject;
    } 
    // Image-to-video eller bilde-basert continuity
    else if (image) {
      payload.image = {
        imageBytes: image,
        mimeType: 'image/png'
      };
    }

    let operation = await ai.models.generateVideos(payload);

    while (!operation.done) {
      await new Promise(r => setTimeout(r, 8000));
      operation = await ai.operations.getVideosOperation({ operation });
    }

    const vid = operation.response?.generatedVideos?.[0]?.video;
    if (!vid?.uri) throw new Error("Generering fullført, men fant ingen video-data.");

    const res = await fetch(`${vid.uri}&key=${apiKey}`);
    if (!res.ok) throw new Error("Kunne ikke laste ned videofilen.");
    const blob = await res.blob();

    return { 
      blob, 
      mediaType: 'VIDEO',
      videoObject: vid // Returnerer objektet slik at neste klipp kan bruke det
    };

  } catch (error: any) {
    const errorMsg = error?.message || String(error);
    
    if (errorMsg.includes('Requested entity was not found.')) {
      if (window.aistudio) window.aistudio.openSelectKey();
      throw new Error("PROSJEKT_FEIL: API-nøkkelen er ugyldig. Velg på nytt.");
    }

    if (errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('RESOURCE_EXHAUSTED')) {
      throw new Error("BILLETING_REQUIRED: Denne funksjonen krever betalt Tier 1 API-tilgang.");
    }

    // Fallback til bilde hvis alt annet feiler (kun for start-scener)
    if (!isExtension) {
      try {
        const imgRes = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: { parts: [{ text: `Cinematic high-quality movie still: ${prompt}` }] },
          config: { imageConfig: { aspectRatio: '16:9' } }
        });
        const part = imgRes.candidates?.[0]?.content?.parts.find((p: any) => p.inlineData);
        if (part) {
          const binaryString = atob(part.inlineData.data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
          return { blob: new Blob([bytes], { type: 'image/png' }), mediaType: 'IMAGE' };
        }
      } catch (f) {}
    }

    throw error;
  }
};
