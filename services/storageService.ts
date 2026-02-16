
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { SavedVideo } from '../types';

const DB_NAME = 'TussieStudioDB';
const STORE_NAME = 'videos';

/**
 * Åpner eller oppretter IndexedDB-databasen.
 */
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2); // Versjon 2
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

/**
 * Lagrer en video til disk.
 */
export const saveVideoToDisk = async (video: SavedVideo): Promise<void> => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    
    // Vi fjerner den midlertidige URL-en før lagring da den ikke er gyldig på tvers av sesjoner
    const { url, ...dataToStore } = video;
    store.put(dataToStore);
    
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.error("Kunne ikke lagre video til disk:", error);
  }
};

/**
 * Henter alle lagrede videoer og genererer nye avspillings-URLer.
 */
export const loadVideosFromDisk = async (): Promise<SavedVideo[]> => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const videos = request.result.map((v: any) => ({
          ...v,
          // Gjenskap URL fra lagret Blob
          url: URL.createObjectURL(v.blob)
        }));
        // Sorter etter nyeste først
        resolve(videos.sort((a: any, b: any) => b.timestamp - a.timestamp));
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Kunne ikke laste bibliotek fra disk:", error);
    return [];
  }
};

/**
 * Sletter en video fra disk.
 */
export const deleteVideoFromDisk = async (id: string): Promise<void> => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);
    
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.error("Kunne ikke slette video fra disk:", error);
  }
};
