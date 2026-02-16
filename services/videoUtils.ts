
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Trekker ut siste frame fra en videoblob.
 * Dette er kritisk for "Fortsett video"-funksjonen.
 */
export const captureLastFrame = async (videoBlob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(videoBlob);
    
    video.src = url;
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = "anonymous";
    video.preload = "auto"; // Tving lasting av metadata

    video.onloadedmetadata = () => {
      // Gå til helt på slutten, men trekk fra bittelitt for å unngå svart skjerm
      video.currentTime = Math.max(0, video.duration - 0.1); 
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/png');
          URL.revokeObjectURL(url);
          // Returner Base64 uten prefix for APIet
          resolve(dataUrl.split(',')[1]); 
        } else {
          reject(new Error("Kunne ikke tegne videobilde til canvas."));
        }
      } catch (err) {
        reject(err);
      }
    };

    video.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };

    // Start lasting
    video.load();
  });
};

/**
 * Konverterer en opplastet fil til Base64.
 */
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result as string;
      resolve(res.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Lager thumbnail fra Blob (bilde eller video)
 */
export const createThumbnail = async (blob: Blob, type: 'VIDEO' | 'IMAGE'): Promise<string> => {
  if (type === 'IMAGE') {
    const reader = new FileReader();
    return new Promise(resolve => {
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } else {
    return captureLastFrame(blob); 
  }
};
