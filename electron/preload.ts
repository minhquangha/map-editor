import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

export interface OpenImageResult {
  path: string;
  name: string;
  dataUrl: string;
}

export interface OpenProjectResult {
  path: string;
  content: string;
}

export type MenuEvent =
  | 'menu:new-project'
  | 'menu:open-project'
  | 'menu:save-project'
  | 'menu:save-project-as'
  | 'menu:open-image'
  | 'menu:export-json'
  | 'menu:undo'
  | 'menu:redo'
  | 'menu:delete'
  | 'menu:select-all'
  | 'menu:fit-screen'
  | 'menu:zoom-in'
  | 'menu:zoom-out';

const api = {
  openImageDialog: (): Promise<OpenImageResult | null> =>
    ipcRenderer.invoke('dialog:open-image'),

  openProjectDialog: (): Promise<OpenProjectResult | null> =>
    ipcRenderer.invoke('dialog:open-project'),

  saveProjectDialog: (payload: {
    defaultPath?: string;
    content: string;
  }): Promise<string | null> => ipcRenderer.invoke('dialog:save-project', payload),

  writeFile: (payload: { path: string; content: string }): Promise<boolean> =>
    ipcRenderer.invoke('fs:write-file', payload),

  exportJsonDialog: (payload: {
    defaultPath?: string;
    content: string;
  }): Promise<string | null> => ipcRenderer.invoke('dialog:export-json', payload),

  getPath: (name: string): Promise<string> =>
    ipcRenderer.invoke('app:get-path', name),

  onMenuEvent: (channel: MenuEvent, callback: () => void): (() => void) => {
    const handler = (_event: IpcRendererEvent) => callback();
    ipcRenderer.on(channel, handler);
    return () => {
      ipcRenderer.removeListener(channel, handler);
    };
  },

  platform: process.platform,
  isElectron: true,
};

contextBridge.exposeInMainWorld('electronAPI', api);

export type ElectronAPI = typeof api;
