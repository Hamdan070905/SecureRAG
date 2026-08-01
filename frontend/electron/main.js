import { app, BrowserWindow, ipcMain, dialog } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROTOCOL_PREFIX = "securerag";
let pyProc = null;
let mainWindow = null;
let pendingDeepLink = null;

if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(PROTOCOL_PREFIX, process.execPath, [
      path.resolve(process.argv[1]),
    ]);
  }
} else {
  app.setAsDefaultProtocolClient(PROTOCOL_PREFIX);
}

const initialDeepLink = process.argv.find(arg => arg.startsWith(`${PROTOCOL_PREFIX}://`));
if (initialDeepLink) {
  pendingDeepLink = initialDeepLink;
}

function handleDeepLink(url) {
  if (!url) return;
  console.log("Deep link triggered:", url);
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send("deep-link", url);
  } else {
    pendingDeepLink = url;
  }
}

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", (event, commandLine) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    const deepLinkUrl = commandLine.find(arg => arg.startsWith(`${PROTOCOL_PREFIX}://`));
    if (deepLinkUrl) {
      handleDeepLink(deepLinkUrl);
    }
  });
}

app.on("open-url", (event, url) => {
  event.preventDefault();
  handleDeepLink(url);
});

ipcMain.on("renderer-ready", () => {
  if (pendingDeepLink) {
    mainWindow.webContents.send("deep-link", pendingDeepLink);
    pendingDeepLink = null;
  }
});

function startPythonBackend() {
  const logFilePath = path.join(app.getPath("userData"), "backend_log.txt");
  const logStream = fs.createWriteStream(logFilePath, { flags: "a" });
  
  logStream.write(`\n--- Launching App: ${new Date().toISOString()} ---\n`);

  const getPythonExecutable = () => {
    const isWin = process.platform === "win32";
    return app.isPackaged
      ? path.join(process.resourcesPath, '.venv', isWin ? 'Scripts/python.exe' : 'bin/python3')
      : path.join(__dirname, '..', '..', '.venv', isWin ? 'Scripts/python.exe' : 'bin/python3');
  };

  const getBackendScript = () => {
    if (!app.isPackaged) {
      return path.join(__dirname, '..', '..', 'backend', 'main.py');
    }
    return path.join(process.resourcesPath, 'backend', 'main.py');
  };

  const pythonPath = getPythonExecutable();
  const scriptPath = getBackendScript();
  const backendCwd = app.isPackaged 
    ? path.join(process.resourcesPath, 'backend') 
    : path.join(__dirname, '..', '..', 'backend');

  logStream.write(`Python Path: ${pythonPath}\n`);
  logStream.write(`Script Path: ${scriptPath}\n`);
  logStream.write(`CWD: ${backendCwd}\n`);

  if (!fs.existsSync(pythonPath)) {
    const errorMsg = `Python binary not found at:\n${pythonPath}`;
    logStream.write(`[ERROR]: ${errorMsg}\n`);
    dialog.showErrorBox("Backend Initialization Failed", errorMsg);
    return;
  }

  if (!fs.existsSync(scriptPath)) {
    const errorMsg = `Backend main script not found at:\n${scriptPath}`;
    logStream.write(`[ERROR]: ${errorMsg}\n`);
    dialog.showErrorBox("Backend Initialization Failed", errorMsg);
    return;
  }

  pyProc = spawn(pythonPath, [scriptPath], {
    cwd: backendCwd,
    windowsHide: true,
    env: { ...process.env, PYTHONUNBUFFERED: "1" }
  });

  pyProc.on("error", (err) => {
    const msg = `Failed to spawn process: ${err.message}`;
    logStream.write(`[PROCESS ERROR]: ${msg}\n`);
    dialog.showErrorBox("Backend Spawn Error", msg);
  });

  if (pyProc.stdout) {
    pyProc.stdout.on("data", (data) => logStream.write(`[STDOUT]: ${data}`));
  }
  if (pyProc.stderr) {
    pyProc.stderr.on("data", (data) => logStream.write(`[STDERR]: ${data}`));
  }

  pyProc.on("close", (code) => {
    logStream.write(`[EXIT]: Backend process exited with code ${code}\n`);
    if (code !== 0 && code !== null) {
      dialog.showErrorBox(
        "Backend Crash Alert",
        `Python backend process terminated unexpectedly with exit code ${code}.\nCheck logs at:\n${logFilePath}`
      );
    }
  });
}

function stopPythonBackend() {
  if (pyProc !== null) {
    spawn("taskkill", ["/pid", pyProc.pid, "/f", "/t"], { windowsHide: true });
    pyProc = null;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: "SecureRAG Enterprise",
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'assets/logo.ico'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js")
    },
  });

  if (!app.isPackaged) {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

async function waitForBackend(retries = 40) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch("http://127.0.0.1:8000/health");
      if (res.ok) return true;
    } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  return false;
}

app.whenReady().then(async () => {
  const killCmd = process.platform === "win32"
    ? `for /f "tokens=5" %a in ('netstat -aon ^| find ":8000"') do taskkill /f /pid %a`
    : `lsof -ti:8000 | xargs kill -9`;

  await new Promise((resolve) => {
    const kill = spawn(process.platform === "win32" ? "cmd" : "sh",
      process.platform === "win32" ? ["/c", killCmd] : ["-c", killCmd],
      { windowsHide: true });
    kill.on("close", resolve);
  });
  await new Promise(r => setTimeout(r, 1500));
  startPythonBackend();
  const ready = await waitForBackend(240);
  if (!ready) {
    const logFilePath = path.join(app.getPath("userData"), "backend_log.txt");
    dialog.showErrorBox("Backend Failed to Start", `Python backend did not respond after 120 seconds.\nCheck logs at:\n${logFilePath}`);
  }
  createWindow();
});

app.on("window-all-closed", () => {
  stopPythonBackend();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("will-quit", () => {
  stopPythonBackend();
});