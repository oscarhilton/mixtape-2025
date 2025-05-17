const { app, BrowserWindow } = require('electron');
const path = require('path');

const isDev = process.env.NODE_ENV !== 'production';

function createWindow () {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      // preload: path.join(__dirname, 'preload.js'), // We'll re-evaluate preload later if needed for Electron-specific APIs
      contextIsolation: true,
      nodeIntegration: false, // Keep this false for security, especially when loading remote content
      // webviewTag: false, // Recommended to disable if not used
    }
  });

  if (isDev) {
    // In development, load the Next.js dev server
    mainWindow.loadURL('http://localhost:3000'); // Assuming your Next.js app runs on 3002
    mainWindow.webContents.openDevTools(); // Open DevTools automatically in dev
  } else {
    // In production, load the built index.html file
    // This would typically be from a static export of your Next.js app
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html')); // Placeholder for production build path
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
}); 