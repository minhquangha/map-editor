import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  shell,
  Menu,
} from 'electron';
import path from 'path';
import fs from 'fs';

const isDev = !app.isPackaged;

function getPreloadPath(): string {
  return path.join(__dirname, 'preload.js');
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: '#121212',
    show: false,
    title: 'Map Editor',
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
    },
  });

  win.once('ready-to-show', () => {
    win.show();
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else if (isDev) {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  return win;
}

function buildAppMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Project',
          accelerator: 'CmdOrCtrl+N',
          click: (_item, win) => win?.webContents.send('menu:new-project'),
        },
        {
          label: 'Open Project…',
          accelerator: 'CmdOrCtrl+O',
          click: (_item, win) => win?.webContents.send('menu:open-project'),
        },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: (_item, win) => win?.webContents.send('menu:save-project'),
        },
        {
          label: 'Save As…',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: (_item, win) => win?.webContents.send('menu:save-project-as'),
        },
        { type: 'separator' },
        {
          label: 'Open Floor Image…',
          accelerator: 'CmdOrCtrl+I',
          click: (_item, win) => win?.webContents.send('menu:open-image'),
        },
        {
          label: 'Export Graph JSON…',
          accelerator: 'CmdOrCtrl+E',
          click: (_item, win) => win?.webContents.send('menu:export-json'),
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        {
          label: 'Undo',
          accelerator: 'CmdOrCtrl+Z',
          click: (_item, win) => win?.webContents.send('menu:undo'),
        },
        {
          label: 'Redo',
          accelerator: 'CmdOrCtrl+Y',
          click: (_item, win) => win?.webContents.send('menu:redo'),
        },
        { type: 'separator' },
        {
          label: 'Delete',
          accelerator: 'Delete',
          click: (_item, win) => win?.webContents.send('menu:delete'),
        },
        {
          label: 'Select All',
          accelerator: 'CmdOrCtrl+A',
          click: (_item, win) => win?.webContents.send('menu:select-all'),
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Fit to Screen',
          accelerator: 'CmdOrCtrl+0',
          click: (_item, win) => win?.webContents.send('menu:fit-screen'),
        },
        {
          label: 'Zoom In',
          accelerator: 'CmdOrCtrl+=',
          click: (_item, win) => win?.webContents.send('menu:zoom-in'),
        },
        {
          label: 'Zoom Out',
          accelerator: 'CmdOrCtrl+-',
          click: (_item, win) => win?.webContents.send('menu:zoom-out'),
        },
        { type: 'separator' },
        { role: 'toggleDevTools' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About Map Editor',
          click: () => {
            void dialog.showMessageBox({
              type: 'info',
              title: 'About Map Editor',
              message: 'Map Editor',
              detail:
                'Hospital floor plan digitizer.\nConvert floor plan images into graph data for pathfinding systems.\n\nVersion 1.0.0',
            });
          },
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── File system IPC ──────────────────────────────────────────────────────────

ipcMain.handle('dialog:open-image', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Open Floor Plan Image',
    filters: [
      { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp'] },
      { name: 'All Files', extensions: ['*'] },
    ],
    properties: ['openFile'],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const filePath = result.filePaths[0];
  const buffer = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase().replace('.', '');
  const mime =
    ext === 'jpg' || ext === 'jpeg'
      ? 'image/jpeg'
      : ext === 'png'
        ? 'image/png'
        : ext === 'webp'
          ? 'image/webp'
          : ext === 'bmp'
            ? 'image/bmp'
            : 'application/octet-stream';

  return {
    path: filePath,
    name: path.basename(filePath),
    dataUrl: `data:${mime};base64,${buffer.toString('base64')}`,
  };
});

ipcMain.handle('dialog:open-project', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Open Map Editor Project',
    filters: [
      { name: 'Map Editor Project', extensions: ['mapeditor'] },
      { name: 'All Files', extensions: ['*'] },
    ],
    properties: ['openFile'],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const filePath = result.filePaths[0];
  const content = fs.readFileSync(filePath, 'utf-8');
  return { path: filePath, content };
});

ipcMain.handle(
  'dialog:save-project',
  async (_event, payload: { defaultPath?: string; content: string }) => {
    const result = await dialog.showSaveDialog({
      title: 'Save Map Editor Project',
      defaultPath: payload.defaultPath || 'project.mapeditor',
      filters: [
        { name: 'Map Editor Project', extensions: ['mapeditor'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (result.canceled || !result.filePath) {
      return null;
    }

    fs.writeFileSync(result.filePath, payload.content, 'utf-8');
    return result.filePath;
  }
);

ipcMain.handle(
  'fs:write-file',
  async (_event, payload: { path: string; content: string }) => {
    fs.writeFileSync(payload.path, payload.content, 'utf-8');
    return true;
  }
);

ipcMain.handle(
  'dialog:export-json',
  async (_event, payload: { defaultPath?: string; content: string }) => {
    const result = await dialog.showSaveDialog({
      title: 'Export Graph JSON',
      defaultPath: payload.defaultPath || 'graph.json',
      filters: [
        { name: 'JSON', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (result.canceled || !result.filePath) {
      return null;
    }

    fs.writeFileSync(result.filePath, payload.content, 'utf-8');
    return result.filePath;
  }
);

ipcMain.handle('app:get-path', async (_event, name: string) => {
  return app.getPath(name as Parameters<typeof app.getPath>[0]);
});

// ── Lifecycle ────────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  buildAppMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
