
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Trekker ut siste frame fra en videoblob.
 */
export const captureLastFrame = async (videoBlob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(videoBlob);
    
    video.src = url;
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = "anonymous";
    video.preload = "auto"; 

    video.onloadedmetadata = () => {
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
 * Lager thumbnail fra Blob
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

/**
 * NY FUNKSJON: Syr sammen alle bildene i et prosjekt til en videofil.
 * @param clips Liste med blobs (bilder)
 * @param frameDurationMs Hvor lenge hvert bilde skal vises (i millisekunder)
 */
export const renderProjectToVideo = async (clips: Blob[], frameDurationMs: number = 3000): Promise<Blob> => {
  if (clips.length === 0) throw new Error("Ingen klipp å rendre.");

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  // Sett oppløsning (HD 720p)
  canvas.width = 1280;
  canvas.height = 720;

  if (!ctx) throw new Error("Kunne ikke opprette canvas context.");

  // Fyll bakgrunn
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const stream = canvas.captureStream(30); // 30 FPS
  const recorder = new MediaRecorder(stream, {
    mimeType: 'video/webm;codecs=vp9'
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const recordingPromise = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      resolve(blob);
    };
    recorder.onerror = (e) => reject(e);
  });

  recorder.start();

  // Last inn alle bildene først for å unngå hakking
  const images: HTMLImageElement[] = await Promise.all(clips.map(blob => {
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(blob);
    });
  }));

  // Tegn hvert bilde til canvas og hold det der i 'frameDurationMs'
  for (const img of images) {
    // Tegn bilde ("Fit to canvas" logikk)
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
    const x = (canvas.width / 2) - (img.width / 2) * scale;
    const y = (canvas.height / 2) - (img.height / 2) * scale;
    
    ctx.drawImage(img, x, y, img.width * scale, img.height * scale);

    // Vent mens opptakeren tar opp dette bildet
    await new Promise(r => setTimeout(r, frameDurationMs));
  }

  recorder.stop();
  return recordingPromise;
};
