const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { fork } = require('child_process');

const PORT = 34567;
let serverProcess = null;
let mainWindow = null;

// App GUI (subsystem Windows) không in console.log ra được terminal cha một cách đáng tin cậy —
// ghi log ra file cạnh thư mục dữ liệu người dùng để còn chẩn đoán được khi đóng gói .exe.
const logDir = app.getPath('userData');
const logPath = path.join(logDir, 'hpcons-erp.log');
try { fs.mkdirSync(logDir, { recursive: true }); } catch (e) {}
function log(...args) {
  const line = `[${new Date().toISOString()}] ${args.join(' ')}\n`;
  try { fs.appendFileSync(logPath, line); } catch (e) { console.error('log write failed:', e); }
  console.log(...args);
}
log('=== electron-main.cjs bắt đầu chạy ===');

process.on('uncaughtException', (err) => log('Uncaught exception (main process):', err.stack || err.message));

function startBackend() {
  const standaloneDir = path.join(__dirname, '.next', 'standalone');
  const serverPath = path.join(standaloneDir, 'server.js');
  log('Starting backend server at:', serverPath);

  // Start Next.js standalone server on local port 34567.
  // cwd PHẢI là thư mục standalone — server.js của Next tự phân giải manifest theo đường dẫn tương đối.
  // silent: true để tự bắt stdout/stderr của tiến trình con (không phụ thuộc console cha, vốn
  // không đáng tin cậy với ứng dụng GUI trên Windows) và ghi vào cùng file log.
  serverProcess = fork(serverPath, [], {
    cwd: standaloneDir,
    env: {
      ...process.env,
      PORT: String(PORT),
      HOSTNAME: '127.0.0.1',
      NODE_ENV: 'production'
    },
    silent: true
  });

  serverProcess.stdout?.on('data', (d) => log('[server]', d.toString().trim()));
  serverProcess.stderr?.on('data', (d) => log('[server:err]', d.toString().trim()));
  serverProcess.on('error', (err) => log('Backend server error:', err.stack || err.message));
  serverProcess.on('exit', (code, signal) => log(`Backend server exited with code ${code} and signal ${signal}`));
}

// Chờ server nội bộ thật sự nhận request thay vì đoán bằng setTimeout cố định —
// tránh mở cửa sổ quá sớm (server chưa kịp bind cổng) hoặc chờ dư thừa.
function waitForServer(timeoutMs = 15000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    (function check() {
      const req = http.get({ host: '127.0.0.1', port: PORT, path: '/', timeout: 1000 }, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() - start > timeoutMs) return reject(new Error('Server không sẵn sàng sau thời gian chờ.'));
        setTimeout(check, 300);
      });
      req.on('timeout', () => req.destroy());
    })();
  });
}

function createWindow() {
  log('createWindow() bắt đầu');
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
  log('createWindow() đã tạo BrowserWindow, id=', mainWindow.id);

  mainWindow.webContents.on('render-process-gone', (_e, details) => log('render-process-gone:', JSON.stringify(details)));
  mainWindow.webContents.on('did-fail-load', (_e, code, desc) => log('did-fail-load:', code, desc));
  mainWindow.webContents.on('did-finish-load', () => log('did-finish-load OK'));

  mainWindow.loadURL(`http://127.0.0.1:${PORT}`).catch((err) => log('loadURL lỗi:', err.message));

  mainWindow.on('closed', () => {
    log('window closed');
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  log('app.whenReady() đã fire');
  startBackend();

  waitForServer()
    .then(() => { log('Server sẵn sàng — mở cửa sổ.'); createWindow(); })
    .catch((err) => { log('Lỗi chờ server:', err.message); createWindow(); });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
}).catch((err) => log('app.whenReady() reject:', err.stack || err.message));

app.on('window-all-closed', () => {
  log('window-all-closed');
  if (serverProcess) {
    serverProcess.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => log('before-quit'));
app.on('will-quit', () => log('will-quit'));
app.on('gpu-process-crashed', (_e, killed) => log('gpu-process-crashed, killed=', killed));
app.on('child-process-gone', (_e, details) => log('child-process-gone:', JSON.stringify(details)));
