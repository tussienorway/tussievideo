
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import {Video} from '@google/genai';

export enum AppState {
  IDLE,
  LOADING,
  SUCCESS,
  ERROR,
}

export enum VeoModel {
  VEO_FAST = 'veo-3.1-fast-generate-preview',
  VEO = 'veo-3.1-generate-preview',
  COGVIDEO = 'cogvideox-5b-open',
}

export enum AspectRatio {
  LANDSCAPE = '16:9',
  PORTRAIT = '9:16',
}

export enum Resolution {
  P720 = '720p',
  P1080 = '1080p',
}

export enum GenerationMode {
  TEXT_TO_VIDEO = 'Tekst til Video',
  FRAMES_TO_VIDEO = 'Bilde til Video',
  REFERENCES_TO_VIDEO = 'Referansebilder',
  EXTEND_VIDEO = 'Forlengelse',
}

export interface ImageFile {
  file: File;
  base64: string;
}

export interface VideoFile {
  file: File;
  base64: string;
}

export interface VideoHistoryItem {
  id: string;
  objectUrl: string;
  blob: Blob;
  videoObject: Video;
  params: GenerateVideoParams;
  timestamp: number;
}

export interface GenerateVideoParams {
  prompt: string;
  model: VeoModel;
  aspectRatio: AspectRatio;
  resolution: Resolution;
  mode: GenerationMode;
  startFrame?: ImageFile | null;
  endFrame?: ImageFile | null;
  referenceImages?: ImageFile[];
  styleImage?: ImageFile | null;
  inputVideo?: VideoFile | null;
  inputVideoObject?: Video | null;
  isLooping?: boolean;
}
