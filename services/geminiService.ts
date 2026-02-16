
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
 * Utvider en enkel bruker-prompt til en detaljert kinematisk beskrivelse
 * inspirert av høykvalitetsmodeller som Qwen/Yi.
 */
const expandPromptWithQwenLogic = async (ai: GoogleGenAI, prompt: string): Promise<string> => {
  console.log('TussieStudio: Utvider prompt med Qwen-logikk...');
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Transform this video prompt into a highly dense, cinematic, and descriptive scene description. 
    Focus on lighting, camera movement, textures, and atmospheric details. 
    Emulate the semantic depth of high-end open-source models like Qwen-2.5 or Yi-Lightning.
    
    Original Prompt: ${prompt}
    
    Output ONLY the expanded cinematic description.`,
  });
  return response.text || prompt;
};

export const generateVideo = async (
  params: GenerateVideoParams,
): Promise<{objectUrl: string; blob: Blob; uri: string; video: Video}> => {
  const apiKey = process.env.API_KEY;
  
  if (!apiKey) {
    throw new Error("Systemfeil: API-nøkkel mangler. Vennligst sjekk konfigurasjonen på APK.austenå.no.");
  }

  console.log('TussieStudio: Starter generering...', params.mode);
  const ai = new GoogleGenAI({apiKey: apiKey});

  let finalPrompt = params.prompt;
  let targetModel = params.model === VeoModel.VEO_QWEN_HYBRID ? VeoModel.VEO : params.model;

  // Hvis Hybrid-modus er valgt, kjører vi prompten gjennom Gemini 3 Pro først
  if (params.model === VeoModel.VEO_QWEN_HYBRID && params.prompt) {
    try {
      finalPrompt = await expandPromptWithQwenLogic(ai, params.prompt);
      console.log('Ekspandert prompt:', finalPrompt);
    } catch (e) {
      console.warn('Prompt ekspansjon feilet, bruker original prompt.', e);
    }
  }

  const config: any = {
    numberOfVideos: 1,
    resolution: params.resolution,
    aspectRatio: params.aspectRatio,
  };

  const generateVideoPayload: any = {
    model: targetModel,
    config: config,
  };

  // Spesiallogikk for Extend Video: Sikrer visuell kontinuitet
  if (params.mode === GenerationMode.EXTEND_VIDEO) {
    const continuityGuard = `CRITICAL CONTINUITY TASK: This is a frame-perfect continuation of the provided video. 
    1. ANALYZE every detail in the last frame. 
    2. KEEP characters, lighting, color grading, and objects identical.
    3. OBJECT INTEGRITY: Maintain object consistency strictly.
    4. PHYSICS: Maintain the same momentum and direction of movement.`;
    
    finalPrompt = `${continuityGuard}\n\nSCENE ACTION: ${finalPrompt}`;
    
    if (params.inputVideoObject) {
      generateVideoPayload.video = params.inputVideoObject;
    } else {
      throw new Error('Systemfeil: Kildevideo mangler for forlengelse.');
    }
  }

  if (finalPrompt) {
    generateVideoPayload.prompt = finalPrompt;
  }

  // Andre moduser
  if (params.mode === GenerationMode.FRAMES_TO_VIDEO) {
    if (params.startFrame) {
      generateVideoPayload.image = {
        imageBytes: params.startFrame.base64,
        mimeType: params.startFrame.file.type,
      };
    }
    const finalEndFrame = params.isLooping ? params.startFrame : params.endFrame;
    if (finalEndFrame) {
      generateVideoPayload.config.lastFrame = {
        imageBytes: finalEndFrame.base64,
        mimeType: finalEndFrame.file.type,
      };
    }
  } else if (params.mode === GenerationMode.REFERENCES_TO_VIDEO) {
    const referenceImagesPayload: VideoGenerationReferenceImage[] = [];
    if (params.referenceImages) {
      for (const img of params.referenceImages) {
        referenceImagesPayload.push({
          image: { imageBytes: img.base64, mimeType: img.file.type },
          referenceType: VideoGenerationReferenceType.ASSET,
        });
      }
    }
    if (referenceImagesPayload.length > 0) {
      generateVideoPayload.config.referenceImages = referenceImagesPayload;
    }
  }

  console.log(`TussieStudio: Sender forespørsel til ${targetModel}...`);
  let operation = await ai.models.generateVideos(generateVideoPayload);
  
  while (!operation.done) {
    await new Promise((resolve) => setTimeout(resolve, 10000));
    operation = await ai.operations.getVideosOperation({operation: operation});
  }

  if (operation?.response?.generatedVideos?.[0]) {
    const videoObject = operation.response.generatedVideos[0].video;
    const downloadLink = videoObject.uri;
    
    const res = await fetch(`${downloadLink}&key=${apiKey}`);
    if (!res.ok) throw new Error(`Nedlasting feilet (${res.status}). Sjekk API-kvoter.`);
    
    const videoBlob = await res.blob();
    const objectUrl = URL.createObjectURL(videoBlob);
    
    return {objectUrl, blob: videoBlob, uri: downloadLink, video: videoObject};
  } else {
    throw new Error('AI-modellen klarte ikke å generere videoen. Vennligst sjekk prompten.');
  }
};
