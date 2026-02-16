
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { GoogleGenAI } from '@google/genai';
import { GenerateParams, MediaType } from '../types';

/**
 * Forbedrer prompten ved hjelp av Gemini 2.5 Flash (rask og gratis).
 */
const enhancePrompt = async (userPrompt: string, isExtension: boolean): Promise<string> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return userPrompt;
  
  const ai = new GoogleGenAI({ apiKey });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `You are a cinematic director. Rewrite this prompt to be a highly detailed visual description for an image generation AI.
      Focus on lighting, composition, color grading (e.g. teal and orange, noir), and texture.
      ${isExtension ? 'The image is the next shot in a sequence, maintain the same style.' : ''}
      User Prompt: "${userPrompt}"
      Output ONLY the enhanced English prompt.`,
    });
    return response.text || userPrompt;
  } catch {
    return userPrompt;
  }
};

export const generateMedia = async (params: GenerateParams): Promise<{blob: Blob, mediaType: MediaType, videoObject?: any}> => {
  // Sjekk om nøkkel finnes (vi bryr oss ikke lenger om Tier 1)
  if (typeof window !== 'undefined' && window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
    if (!(await window.aistudio.hasSelectedApiKey())) {
      await window.aistudio.openSelectKey();
    }
  }

  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY_MISSING: API-nøkkel mangler.");
  }
  
  const ai = new GoogleGenAI({ apiKey });
  const { prompt, image, isExtension } = params;

  try {
    // 1. Ekspander prompten
    const cinematicPrompt = await enhancePrompt(prompt || (isExtension ? "Next scene in sequence" : "Cinematic shot"), !!isExtension);
    
    // 2. Klargjør innhold for Gemini 2.5 Flash Image
    // Dette er "Free Tier" vennlig.
    const contents: any = {
      parts: []
    };

    // Hvis vi har et input-bilde (fra forrige scene), legger vi det til for stil-konsistens
    if (image) {
      contents.parts.push({
        inlineData: {
          mimeType: 'image/png',
          data: image
        }
      });
      // Legg til instruksjon om å bruke bildet
      contents.parts.push({
        text: `Create a new image that logically follows this previous scene. Style match: 100%. Prompt: ${cinematicPrompt}`
      });
    } else {
      contents.parts.push({
        text: cinematicPrompt
      });
    }

    // 3. Generer Bilde (Storyboard frame)
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: contents,
      config: {
        imageConfig: {
          aspectRatio: '16:9',
          numberOfImages: 1
        }
      }
    });

    // 4. Hent ut bildet fra responsen
    const part = response.candidates?.[0]?.content?.parts.find((p: any) => p.inlineData);
    
    if (!part || !part.inlineData) {
      throw new Error("Kunne ikke generere bilde. Modellen returnerte ingen data.");
    }

    // Konverter Base64 til Blob
    const base64Data = part.inlineData.data;
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'image/png' });

    return { 
      blob, 
      mediaType: 'IMAGE', // Vi returnerer nå alltid bilder i gratis-versjonen
      videoObject: undefined 
    };

  } catch (error: any) {
    const errorMsg = error?.message || String(error);
    
    if (errorMsg.includes('Requested entity was not found.') && window.aistudio) {
      window.aistudio.openSelectKey();
    }
    
    throw new Error(`Generering feilet: ${errorMsg}`);
  }
};
