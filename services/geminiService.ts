
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import {
  GoogleGenAI,
  Video,
  VideoGenerationReferenceType,
} from '@google/genai';
import {GenerateVideoParams, GenerationMode, VeoModel} from '../types';

export class VideoGenerationError extends Error {
  constructor(public message: string, public code?: string, public suggestion?: string) {
    super(message);
    this.name = 'VideoGenerationError';
  }
}

export const generateVideo = async (
  params: GenerateVideoParams,
): Promise<{objectUrl: string; blob: Blob; uri: string; video: Video}> => {
  const ai = new GoogleGenAI({apiKey: process.env.API_KEY});

  // Bruk VEO FAST som standard for åpen kildekode placeholder i demoen
  const actualModel = params.model === VeoModel.COGVIDEO ? VeoModel.VEO_FAST : params.model;

  const config: any = {
    numberOfVideos: 1,
    resolution: params.resolution,
    aspectRatio: params.aspectRatio,
  };

  const payload: any = {
    model: actualModel,
    config: config,
  };

  let promptPrefix = '';
  
  if (params.mode === GenerationMode.EXTEND_VIDEO) {
    if (!params.inputVideoObject) {
      throw new VideoGenerationError(
        'Mangler kildevideo for forlengelse.',
        'MISSING_SOURCE',
        'Velg en video fra biblioteket og trykk "Forleng" for å fortsette historien.'
      );
    }
    payload.video = params.inputVideoObject;
    promptPrefix = "RESUME ACTION SEAMLESSLY: Follow the exact movements, colors, and items from the previous clip. Maintain perfect visual continuity. ";
  }

  payload.prompt = promptPrefix + (params.prompt || "A cinematic scene continuing the story.");

  if (params.mode === GenerationMode.FRAMES_TO_VIDEO) {
    if (params.startFrame) {
      payload.image = {
        imageBytes: params.startFrame.base64,
        mimeType: params.startFrame.file.type,
      };
    } else if (params.mode === GenerationMode.FRAMES_TO_VIDEO) {
       throw new VideoGenerationError(
         'Mangler bilde for bilde-til-video.',
         'MISSING_IMAGE',
         'Vennligst last opp et bilde eller ta en selfie for å bruke denne modusen.'
       );
    }
    const endFrame = params.isLooping ? params.startFrame : params.endFrame;
    if (endFrame) {
      payload.config.lastFrame = {
        imageBytes: endFrame.base64,
        mimeType: endFrame.file.type,
      };
    }
  } else if (params.mode === GenerationMode.REFERENCES_TO_VIDEO && params.referenceImages) {
    payload.config.referenceImages = params.referenceImages.map(img => ({
      image: { imageBytes: img.base64, mimeType: img.file.type },
      referenceType: VideoGenerationReferenceType.ASSET,
    }));
  }

  try {
    let operation = await ai.models.generateVideos(payload);
    
    while (!operation.done) {
      await new Promise((resolve) => setTimeout(resolve, 8000));
      operation = await ai.operations.getVideosOperation({operation: operation});
    }

    if (operation?.response?.generatedVideos?.[0]) {
      const videoObject = operation.response.generatedVideos[0].video;
      const url = decodeURIComponent(videoObject.uri);
      const res = await fetch(`${url}&key=${process.env.API_KEY}`);
      if (!res.ok) {
        throw new VideoGenerationError(
          `Nedlasting av video feilet (Status: ${res.status}).`,
          'DOWNLOAD_FAILED',
          'Tilkoblingen ble avbrutt under nedlasting. Vennligst sjekk internettforbindelsen og prøv igjen.'
        );
      }
      const blob = await res.blob();
      return {objectUrl: URL.createObjectURL(blob), blob, uri: url, video: videoObject};
    } else {
      throw new VideoGenerationError(
        'Modellen returnerte ingen video.',
        'EMPTY_RESPONSE',
        'Dette kan skyldes sikkerhetsfiltre eller komplekse forespørsler. Prøv å forenkle beskrivelsen din.'
      );
    }
  } catch (error: any) {
    if (error instanceof VideoGenerationError) throw error;

    const msg = error?.message || '';
    if (msg.includes('429')) {
      throw new VideoGenerationError(
        'For mange forespørsler (Rate Limit).',
        'RATE_LIMIT',
        'Du har nådd grensen for antall videoer du kan lage akkurat nå. Vent 1-2 minutter før du prøver igjen.'
      );
    }
    if (msg.includes('403') || msg.includes('API_KEY')) {
      throw new VideoGenerationError(
        'API-nøkkelen er ugyldig eller mangler rettigheter.',
        'AUTH_ERROR',
        'Vennligst sjekk at du har valgt en gyldig API-nøkkel med fakturering aktivert.'
      );
    }
    if (msg.includes('safety') || msg.includes('blocked')) {
      throw new VideoGenerationError(
        'Innholdet ble blokkert av sikkerhetsfilteret.',
        'SAFETY_BLOCKED',
        'Beskrivelsen din kan inneholde ord som bryter med retningslinjene for AI-innhold. Prøv en annen formulering.'
      );
    }
    
    throw new VideoGenerationError(
      'En ukjent feil oppstod under generering.',
      'UNKNOWN',
      `Feilmelding: ${msg}. Prøv å laste siden på nytt eller endre modellen.`
    );
  }
};
