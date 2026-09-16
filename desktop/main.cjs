// Werket desktop shell (Electron, CommonJS).
//
// Serves the built React SPA over a privileged `app://werket` origin (so
// client-side routing works and the origin matches the API's CORS allowlist),
// adds a native menu, and bridges file open/save to the renderer.
const { app, BrowserWindow, Menu, dialog, ipcMain, protocol, net, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

const isDev = !app.isPackaged;
const WEB_ROOT = isDev
  ? path.resolve(__dirname, '..', 'staticfiles')
  : path.join(process.resourcesPath, 'web');

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true },
  },
]);

let mainWindow = null;
let pendingFile = null;

function resolveWebFile(pathname) {
  const clean = decodeURIComponent(pathname || '/');
  const relative = clean === '/' || clean === '' ? 'index.html' : clean.replace(/^\/+/, '');
  let filePath = path.join(WEB_ROOT, relative);
  if (!filePath.startsWith(WEB_ROOT)) return null;
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(WEB_ROOT, 'index.html'); // SPA fallback
  }
  return filePath;
}

function registerAppProtocol() {
  protocol.handle('app', (request) => {
    const url = new URL(request.url);
    const filePath = resolveWebFile(url.pathname);
    if (!filePath) return new Response('Forbidden', { status: 403 });
    return net.fetch(pathToFileURL(filePath).toString());
  });
}

function sendMenu(command, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('menu', command, payload);
  }
}

function readOpenable(filePath) {
  try {
    return { name: path.basename(filePath), text: fs.readFileSync(filePath, 'utf-8') };
  } catch {
    return null;
  }
}

function fileFilters() {
  return [
    { name: 'Werket project', extensions: ['wkt'] },
    { name: 'Text', extensions: ['md', 'txt'] },
  ];
}

function buildMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        { label: 'New Document', accelerator: 'CmdOrCtrl+N', click: () => sendMenu('new') },
        { label: 'Open Project…', accelerator: 'CmdOrCtrl+O', click: () => sendMenu('open-project') },
        { label: 'Import File…', accelerator: 'CmdOrCtrl+Shift+O', click: () => sendMenu('open-file') },
        { type: 'separator' },
        { label: 'Save Project…', accelerator: 'CmdOrCtrl+S', click: () => sendMenu('save-project') },
        { label: 'Export…', accelerator: 'CmdOrCtrl+E', click: () => sendMenu('export') },
        { label: 'Save as Markdown…', accelerator: 'CmdOrCtrl+Shift+S', click: () => sendMenu('save-markdown') },
        { type: 'separator' },
        { label: 'Print…', accelerator: 'CmdOrCtrl+P', click: () => sendMenu('print') },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
        { type: 'separator' },
        { label: 'Find', accelerator: 'CmdOrCtrl+F', click: () => sendMenu('find') },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { role: 'toggleDevTools' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        { label: 'Werket on GitHub', click: () => shell.openExternal('https://github.com/ZebraCodeX/Werket') },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function registerIpc() {
  ipcMain.handle('project:open', async () => {
    const result = await dialog.showOpenDialog(mainWindow, { properties: ['openFile'], filters: fileFilters() });
    if (result.canceled || !result.filePaths[0]) return null;
    return fs.readFileSync(result.filePaths[0], 'utf-8');
  });

  ipcMain.handle('project:save', async (_event, payload) => {
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: 'Werket-project.wkt',
      filters: [{ name: 'Werket project', extensions: ['wkt'] }],
    });
    if (result.canceled || !result.filePath) return false;
    fs.writeFileSync(result.filePath, payload, 'utf-8');
    return true;
  });

  ipcMain.handle('file:open', async () => {
    const result = await dialog.showOpenDialog(mainWindow, { properties: ['openFile'] });
    if (result.canceled || !result.filePaths[0]) return null;
    const filePath = result.filePaths[0];
    return { name: path.basename(filePath), text: fs.readFileSync(filePath, 'utf-8') };
  });

  ipcMain.handle('file:save', async (_event, { defaultName, text }) => {
    const result = await dialog.showSaveDialog(mainWindow, { defaultPath: defaultName || 'document.md' });
    if (result.canceled || !result.filePath) return false;
    fs.writeFileSync(result.filePath, text, 'utf-8');
    return true;
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 420,
    minHeight: 480,
    title: 'Werket',
    backgroundColor: '#111327',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.loadURL('app://werket/index.html');

  mainWindow.webContents.once('did-finish-load', () => {
    if (pendingFile) {
      const payload = readOpenable(pendingFile);
      if (payload) mainWindow.webContents.send('menu', 'open-file', payload);
      pendingFile = null;
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function fileFromArgv(argv) {
  const candidate = argv.slice(1).find((arg) => /\.(wkt|md|txt)$/i.test(arg) && fs.existsSync(arg));
  return candidate || null;
}

const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    pendingFile = fileFromArgv(argv);
    if (mainWindow) {
      const payload = pendingFile ? readOpenable(pendingFile) : null;
      if (payload) mainWindow.webContents.send('menu', 'open-file', payload);
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    pendingFile = fileFromArgv(process.argv);
    registerAppProtocol();
    registerIpc();
    buildMenu();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('open-file', (event, filePath) => {
    event.preventDefault();
    const payload = readOpenable(filePath);
    if (mainWindow && payload) mainWindow.webContents.send('menu', 'open-file', payload);
    else pendingFile = filePath;
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
