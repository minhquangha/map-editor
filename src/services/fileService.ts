import type { MapEditorProject } from '@/models/types';
import { parseProject, serializeProject } from './projectService';
import { serializeExportGraph } from './exportService';

/**
 * Abstraction over Electron IPC file dialogs.
 * Falls back to browser File API when not running under Electron.
 */

export interface OpenedImage {
  path: string;
  name: string;
  dataUrl: string;
  width: number;
  height: number;
}

function loadImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('Failed to decode image.'));
    img.src = dataUrl;
  });
}

export async function openFloorImage(): Promise<OpenedImage | null> {
  if (window.electronAPI) {
    const result = await window.electronAPI.openImageDialog();
    if (!result) return null;
    const dims = await loadImageDimensions(result.dataUrl);
    return {
      path: result.path,
      name: result.name,
      dataUrl: result.dataUrl,
      width: dims.width,
      height: dims.height,
    };
  }

  // Browser fallback
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/jpg,image/webp,image/bmp';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = String(reader.result);
        try {
          const dims = await loadImageDimensions(dataUrl);
          resolve({
            path: file.name,
            name: file.name,
            dataUrl,
            width: dims.width,
            height: dims.height,
          });
        } catch {
          resolve(null);
        }
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    };
    input.click();
  });
}

export async function openProjectFile(): Promise<{
  path: string;
  project: MapEditorProject;
} | null> {
  if (window.electronAPI) {
    const result = await window.electronAPI.openProjectDialog();
    if (!result) return null;
    const project = parseProject(result.content);
    return { path: result.path, project };
  }

  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.mapeditor,application/json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      try {
        const content = await file.text();
        const project = parseProject(content);
        resolve({ path: file.name, project });
      } catch (err) {
        console.error(err);
        resolve(null);
      }
    };
    input.click();
  });
}

export async function saveProjectFile(
  project: MapEditorProject,
  existingPath: string | null
): Promise<string | null> {
  const content = serializeProject(project);

  if (window.electronAPI) {
    if (existingPath) {
      await window.electronAPI.writeFile({ path: existingPath, content });
      return existingPath;
    }
    return window.electronAPI.saveProjectDialog({
      defaultPath: `${project.name || 'project'}.mapeditor`,
      content,
    });
  }

  // Browser: trigger download
  downloadBlob(content, `${project.name || 'project'}.mapeditor`, 'application/json');
  return existingPath || `${project.name || 'project'}.mapeditor`;
}

export async function saveProjectAs(
  project: MapEditorProject
): Promise<string | null> {
  const content = serializeProject(project);

  if (window.electronAPI) {
    return window.electronAPI.saveProjectDialog({
      defaultPath: `${project.name || 'project'}.mapeditor`,
      content,
    });
  }

  downloadBlob(content, `${project.name || 'project'}.mapeditor`, 'application/json');
  return `${project.name || 'project'}.mapeditor`;
}

export async function exportGraphJson(
  project: MapEditorProject
): Promise<string | null> {
  const content = serializeExportGraph(project);

  if (window.electronAPI) {
    return window.electronAPI.exportJsonDialog({
      defaultPath: `${project.name || 'graph'}.json`,
      content,
    });
  }

  downloadBlob(content, `${project.name || 'graph'}.json`, 'application/json');
  return `${project.name || 'graph'}.json`;
}

function downloadBlob(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
