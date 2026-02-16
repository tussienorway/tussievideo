
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
