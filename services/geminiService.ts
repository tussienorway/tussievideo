
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import {
  GoogleGenAI,
  Video,
  VideoGenerationReferenceImage,
  VideoGenerationReferenceType,
} from '@google/genai';
import {GenerateVideoParams, GenerationMode, VeoModel} from '../types';

/**
 * Utvider en enkel bruker-prompt til en detaljert kinematisk beskrivelse.
 */
const expandPromptWithQwenLogic = async (ai: GoogleGenAI, prompt: string): Promise<string> => {
  if (!prompt || prompt.trim().length === 0) return "A cinematic masterpiece.";
  
  console.log('TussieStudio: Utvider prompt...');
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Transform this video prompt into a highly dense, cinematic, and descriptive scene description. 
      Focus on lighting, camera movement, textures, and atmospheric details. 
      KEEP THE FINAL DESCRIPTION UNDER 100 WORDS.
      
      Original Prompt: ${prompt}
      
      Output ONLY the expanded description.`,
    });
    return response.text?.trim() || prompt;
  } catch (error) {
    console.error('Prompt expansion failed:', error);
    return prompt;
  }
};

export const generateVideo = async (
  params: GenerateVideoParams,
): Promise<{objectUrl: string; blob: Blob; uri: string; video: Video}> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API-nøkkel mangler. Vennligst velg en betalt nøkkel.");

  const ai = new GoogleGenAI({apiKey: apiKey});
  let finalPrompt = params.prompt;
  let targetModel = params.model === VeoModel.VEO_QWEN_HYBRID ? VeoModel.VEO : params.model;

  if (params.model === VeoModel.VEO_QWEN_HYBRID && params.prompt) {
    finalPrompt = await expandPromptWithQwenLogic(ai, params.prompt);
  }

  // Definer payload i henhold til Gemini SDK spesifikasjoner
  const config: any = {
    numberOfVideos: 1,
    resolution: params.resolution,
    aspectRatio: params.aspectRatio,
  };

  const payload: any = {
    model: targetModel,
    config: config,
  };

  // Legg til prompt kun hvis den ikke er tom
  if (finalPrompt && finalPrompt.trim()) {
    payload.prompt = finalPrompt.trim();
  }

  // Håndter spesifikke moduser
  if (params.mode === GenerationMode.EXTEND_VIDEO) {
    if (params.inputVideoObject) {
      payload.video = params.inputVideoObject;
      // Forlengelse krever ofte en prompt for å styre retningen
      if (!payload.prompt) payload.prompt = "Seamless cinematic continuation of the previous scene.";
    } else {
      throw new Error('Systemfeil: Kildevideo mangler for forlengelse.');
    }
  } else if (params.mode === GenerationMode.FRAMES_TO_VIDEO) {
    if (params.startFrame) {
      payload.image = {
        imageBytes: params.startFrame.base64,
        mimeType: params.startFrame.file.type || 'image/png',
      };
    }
    const finalEndFrame = params.isLooping ? params.startFrame : params.endFrame;
    if (finalEndFrame) {
      payload.config.lastFrame = {
        imageBytes: finalEndFrame.base64,
        mimeType: finalEndFrame.file.type || 'image/png',
      };
    }
  } else if (params.mode === GenerationMode.REFERENCES_TO_VIDEO) {
    const referenceImagesPayload: VideoGenerationReferenceImage[] = [];
    if (params.referenceImages) {
      for (const img of params.referenceImages) {
        referenceImagesPayload.push({
          image: { 
            imageBytes: img.base64, 
            mimeType: img.file.type || 'image/png' 
          },
          referenceType: VideoGenerationReferenceType.ASSET,
        });
      }
    }
    if (referenceImagesPayload.length > 0) {
      payload.config.referenceImages = referenceImagesPayload;
    }
    if (!payload.prompt) throw new Error("Prompt er påkrevd for referanse-modus.");
  }

  try {
    let operation = await ai.models.generateVideos(payload);
    
    while (!operation.done) {
      await new Promise((resolve) => setTimeout(resolve, 8000));
      operation = await ai.operations.getVideosOperation({operation: operation});
    }

    if (operation?.response?.generatedVideos?.[0]) {
      const videoObject = operation.response.generatedVideos[0].video;
      const downloadLink = videoObject.uri;
      
      const res = await fetch(`${downloadLink}&key=${apiKey}`);
      if (!res.ok) throw new Error(`Nedlasting feilet: ${res.statusText}`);
      
      const videoBlob = await res.blob();
      const objectUrl = URL.createObjectURL(videoBlob);
      
      return {objectUrl, blob: videoBlob, uri: downloadLink, video: videoObject};
    } else {
      throw new Error('API returnerte ingen video. Sjekk for innholdsfiltere.');
    }
  } catch (err: any) {
    console.error('API Error:', err);
    throw err;
  }
};
