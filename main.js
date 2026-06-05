const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow, splashWindow;

function createSplash() {
  splashWindow = new BrowserWindow({
    width: 420, height: 320,
    frame: false, transparent: true, alwaysOnTop: true,
    resizable: false, skipTaskbar: true,
    webPreferences: { contextIsolation: true }
  });
  splashWindow.loadFile(path.join(__dirname, 'app', 'splash.html'));
}

function createMain() {
  mainWindow = new BrowserWindow({
    width: 1440, height: 900,
    minWidth: 1024, minHeight: 600,
    show: false, frame: false,
    backgroundColor: '#0f172a',
    icon: path.join(__dirname, 'build', 'icon.ico'),
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });
  mainWindow.removeMenu();
  mainWindow.loadFile(path.join(__dirname, 'app', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    setTimeout(() => {
      if (splashWindow) { splashWindow.close(); splashWindow = null; }
      mainWindow.show();
    }, 1500);
  });

  mainWindow.on('maximize', () => mainWindow.webContents.send('window-state', true));
  mainWindow.on('unmaximize', () => mainWindow.webContents.send('window-state', false));
}

app.whenReady().then(() => {
  createSplash();
  createMain();
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

ipcMain.on('win-minimize', () => mainWindow?.minimize());
ipcMain.on('win-maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.on('win-close', () => mainWindow?.close());
