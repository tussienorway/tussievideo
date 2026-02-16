
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { Project, Clip } from '../types';

const DB_NAME = 'TussieProDB';
const STORE_PROJECTS = 'projects';

const getDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 3);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
        db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
};

export const saveProject = async (project: Project) => {
  const db = await getDB();
  const tx = db.transaction(STORE_PROJECTS, 'readwrite');
  
  // Klargjør data for lagring (fjern midlertidige blob URLs)
  const projectToStore = {
    ...project,
    clips: project.clips.map(c => {
      const { url, ...rest } = c; // Fjern URL, behold Blob
      return rest;
    })
  };

  tx.objectStore(STORE_PROJECTS).put(projectToStore);
  return new Promise<void>((resolve) => (tx.oncomplete = () => resolve()));
};

export const getProjects = async (): Promise<Project[]> => {
  const db = await getDB();
  const tx = db.transaction(STORE_PROJECTS, 'readonly');
  const req = tx.objectStore(STORE_PROJECTS).getAll();
  return new Promise((resolve) => {
    req.onsuccess = () => {
      const projects = req.result.map((p: any) => ({
        ...p,
        clips: p.clips.map((c: any) => ({
          ...c,
          url: URL.createObjectURL(c.blob) // Regenerer URLer ved lasting
        }))
      }));
      resolve(projects.sort((a: any, b: any) => b.createdAt - a.createdAt));
    };
  });
};

export const deleteProject = async (id: string) => {
  const db = await getDB();
  const tx = db.transaction(STORE_PROJECTS, 'readwrite');
  tx.objectStore(STORE_PROJECTS).delete(id);
  return new Promise<void>((resolve) => (tx.oncomplete = () => resolve()));
};
