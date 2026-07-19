const { app, BrowserWindow } = require('electron');
const path = require('path');
const { fork } = require('child_process');

let serverProcess = null;
let mainWindow = null;

function startBackend() {
  const serverPath = path.join(__dirname, 'dist', 'server.cjs');
  console.log('Starting backend server at:', serverPath);
  
  // Start Express server on local port 34567
  serverProcess = fork(serverPath, [], {
    env: {
      ...process.env,
      PORT: '34567',
      NODE_ENV: 'production'
    },
    silent: false
  });

  serverProcess.on('error', (err) => {
    console.error('Backend server error:', err);
  });

  serverProcess.on('exit', (code, signal) => {
    console.log(`Backend server exited with code ${code} and signal ${signal}`);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "HP-CONS ERP - Phòng Đấu Thầu",
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  // Load local Express server
  mainWindow.loadURL('http://localhost:34567');

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  startBackend();
  
  // Wait a short duration to ensure server binds to port
  setTimeout(() => {
    createWindow();
  }, 1200);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
