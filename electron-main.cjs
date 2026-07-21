const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { fork, execSync } = require('child_process');

const PORT = 34567;
let serverProcess = null;
let mainWindow = null;

// Chỉ cho phép 1 tiến trình chạy tại 1 thời điểm — bấm mở lần 2 (vd. lúc tiến trình cũ
// chưa kịp giải phóng cổng 34567 sau khi đóng cửa sổ) sẽ tự thoát và focus cửa sổ cũ
// thay vì tạo xung đột cổng khiến cửa sổ mới không mở lên được.
const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  // App GUI (subsystem Windows) không in console.log ra được terminal cha một cách đáng tin
  // cậy — ghi log ra file cạnh thư mục dữ liệu người dùng để còn chẩn đoán được khi đóng gói .exe.
  const logDir = app.getPath('userData');
  const logPath = path.join(logDir, 'hpcons-erp.log');
  try { fs.mkdirSync(logDir, { recursive: true }); } catch (e) {}
  const log = (...args) => {
    const line = `[${new Date().toISOString()}] ${args.join(' ')}\n`;
    try { fs.appendFileSync(logPath, line); } catch (e) { console.error('log write failed:', e); }
    console.log(...args);
  };
  log('=== electron-main.cjs bắt đầu chạy ===');

  process.on('uncaughtException', (err) => log('Uncaught exception (main process):', err.stack || err.message));

  app.on('second-instance', () => {
    log('second-instance: đã có phiên đang chạy, focus cửa sổ cũ');
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

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

  // Diệt sạch tiến trình cũ còn treo trên cổng 34567 (vd. lần đóng trước chưa giải phóng
  // kịp) trước khi khởi động server mới — tránh EADDRINUSE khiến app không lên được.
  function killStaleServerOnPort() {
    if (process.platform !== 'win32') return;
    try {
      const out = execSync(`netstat -ano -p tcp | findstr :${PORT}`, { encoding: 'utf-8' });
      const pids = new Set();
      out.split('\n').forEach((line) => {
        const m = line.trim().match(/(\d+)$/);
        if (m) pids.add(m[1]);
      });
      pids.forEach((pid) => {
        if (pid === String(process.pid)) return;
        try {
          execSync(`taskkill /F /PID ${pid}`);
          log(`Đã dọn tiến trình cũ còn giữ cổng ${PORT}: PID ${pid}`);
        } catch (e) {}
      });
    } catch (e) {
      // findstr không tìm thấy dòng nào khớp -> không có gì phải dọn, bỏ qua lỗi này
    }
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
    killStaleServerOnPort();
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
      try { serverProcess.kill(); } catch (e) {}
      // fork() trên Windows đôi khi không giải phóng cổng ngay khi kill 1 tín hiệu —
      // dọn thẳng theo PID để lần mở lại kế tiếp không bị dính cổng cũ.
      if (process.platform === 'win32' && serverProcess.pid) {
        try { execSync(`taskkill /F /T /PID ${serverProcess.pid}`); } catch (e) {}
      }
    }
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('before-quit', () => log('before-quit'));
  app.on('will-quit', () => log('will-quit'));
  app.on('gpu-process-crashed', (_e, killed) => log('gpu-process-crashed, killed=', killed));
  app.on('child-process-gone', (_e, details) => log('child-process-gone:', JSON.stringify(details)));
}
