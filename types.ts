
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { Video } from '@google/genai';

// Utvid Window interface for å støtte AI Studio injects
declare global {
  interface AIStudio {
    openSelectKey: () => Promise<void>;
    hasSelectedApiKey: () => Promise<boolean>;
  }

  interface Window {
    aistudio?: AIStudio;
  }
}

export type MediaType = 'VIDEO' | 'IMAGE';

export interface Clip {
  id: string;
  projectId: string;
  timestamp: number;
  prompt: string;
  mediaType: MediaType;
  url: string;      // Blob URL for avspilling
  blob: Blob;       // Fysisk data
  base64Thumbnail?: string; // For rask visning i tidslinje
  videoObject?: Video; // Rå-objektet fra Veo API for ekte extension support
}

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  clips: Clip[]; 
}

export interface GenerateParams {
  prompt: string;
  image?: string; 
  videoObject?: Video; // For ekte 7s extension
  isExtension?: boolean; 
}

export enum AppState {
  DASHBOARD,
  PROJECT_VIEW,
  GENERATING,
  ERROR
}

export enum AspectRatio {
  LANDSCAPE = '16:9',
  PORTRAIT = '9:16',
}

export enum Resolution {
  P720 = '720p',
  P1080 = '1080p',
}

// Missing types below added to fix reported errors

export enum GenerationMode {
  TEXT_TO_VIDEO = 'Text to Video',
  FRAMES_TO_VIDEO = 'Image to Video',
  REFERENCES_TO_VIDEO = 'Reference based Video',
  EXTEND_VIDEO = 'Extend Video',
}

export enum VeoModel {
  VEO_QWEN_HYBRID = 'veo-3.1-hybrid',
  VEO = 'veo-3.1-generate-preview',
  VEO_FAST = 'veo-3.1-fast-generate-preview',
  FALLBACK_STORYBOARD = 'fallback-storyboard',
}

export interface ImageFile {
  file: File;
  base64: string;
}

export interface VideoFile {
  file: File;
  base64: string;
}

export interface ResearchResult {
  text: string;
  sources: { title: string; uri: string }[];
}

export interface GenerateVideoParams {
  prompt: string;
  model: VeoModel;
  aspectRatio: AspectRatio;
  resolution: Resolution;
  mode: GenerationMode;
  startFrame: ImageFile | null;
  endFrame: ImageFile | null;
  referenceImages: ImageFile[];
  styleImage: ImageFile | null;
  inputVideo: VideoFile | null;
  inputVideoObject: Video | null;
  isLooping: boolean;
}

export interface SavedVideo {
  id: string;
  timestamp: number;
  url: string;
  blob: Blob;
  params: GenerateVideoParams;
}
