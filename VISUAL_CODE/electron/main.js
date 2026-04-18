import { app, BrowserWindow, ipcMain, dialog, clipboard } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;
const VITE_URL = 'http://127.0.0.1:5173';

function settingsPath() {
  return path.join(app.getPath('userData'), 'palette-settings.json');
}

function readSettings() {
  try {
    const raw = fsSync.readFileSync(settingsPath(), 'utf8');
    return { terminalApp: 'terminal', ...JSON.parse(raw) };
  } catch {
    return { terminalApp: 'terminal' };
  }
}

function writeSettings(partial) {
  const next = { ...readSettings(), ...partial };
  fsSync.mkdirSync(path.dirname(settingsPath()), { recursive: true });
  fsSync.writeFileSync(settingsPath(), JSON.stringify(next, null, 2), 'utf8');
  return next;
}

function normalizePath(input) {
  const expanded = input.startsWith('~') ? path.join(os.homedir(), input.slice(1)) : input;
  return path.normalize(expanded);
}

function toAppleBase64Pipe(text) {
  const b64 = Buffer.from(text, 'utf8').toString('base64');
  return `do shell script "printf '%s' " & quoted form of "${b64}" & " | base64 -D"`;
}

async function runOsascript(source) {
  await execFileAsync('osascript', ['-e', source], { timeout: 25_000 });
}

async function sendToTerminal(text, terminalApp) {
  const payload = String(text ?? '')
    .replace(/\r\n/g, '\n')
    .trimEnd();
  clipboard.writeText(payload);

  if (terminalApp === 'paste_only') {
    return { ok: true, mode: 'paste_only' };
  }

  if (process.platform !== 'darwin') {
    return { ok: true, mode: 'clipboard', notice: 'Command copied. Paste into your terminal (Ctrl+V / Cmd+V).' };
  }

  if (terminalApp === 'iterm2') {
    const script = `
tell application "iTerm"
  activate
  tell current session of current window
    set cmdText to ${toAppleBase64Pipe(payload)}
    write text cmdText
  end tell
end tell`;
    await runOsascript(script);
    return { ok: true, mode: 'iterm2' };
  }

  const script = `
tell application "Terminal" to activate
delay 0.18
tell application "System Events"
  keystroke "v" using command down
  delay 0.06
  key code 36
end tell`;
  await runOsascript(script);
  return { ok: true, mode: 'terminal' };
}

function createWindow() {
  const win = new BrowserWindow({
    width: 400,
    height: 640,
    minWidth: 320,
    minHeight: 440,
    alwaysOnTop: true,
    title: 'Terminal Palette',
    vibrancy: process.platform === 'darwin' ? 'under-window' : undefined,
    visualEffectState: process.platform === 'darwin' ? 'active' : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (isDev) {
    win.loadURL(VITE_URL);
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('debug:ping', () => ({ ok: true, t: Date.now() }));

ipcMain.handle('paths:home', () => os.homedir());

ipcMain.handle('os:platform', () => process.platform);

ipcMain.handle('settings:get', () => readSettings());

ipcMain.handle('settings:set', (_e, partial) => writeSettings(partial));

ipcMain.handle('dialog:pickDirectory', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const r = await dialog.showOpenDialog(win ?? undefined, {
    properties: ['openDirectory', 'createDirectory'],
 });
  if (r.canceled || !r.filePaths[0]) return { ok: false };
  return { ok: true, path: r.filePaths[0] };
});

ipcMain.handle('context:analyze', async (_e, dirPath) => {
  const abs = normalizePath(dirPath || '');
  try {
    await fs.access(abs);
  } catch {
    return { ok: false, path: abs, hasGit: false, hasPackageJson: false, hasPython: false };
  }
  const gitMeta = path.join(abs, '.git');
  const pkg = path.join(abs, 'package.json');
  const py = path.join(abs, 'pyproject.toml');
  const req = path.join(abs, 'requirements.txt');
  let hasGit = false;
  try {
    const st = await fs.stat(gitMeta);
    hasGit = st.isDirectory() || st.isFile();
  } catch {
    hasGit = false;
  }
  const hasPackageJson = await fs.access(pkg).then(() => true).catch(() => false);
  const hasPython =
    (await fs.access(py).then(() => true).catch(() => false)) ||
    (await fs.access(req).then(() => true).catch(() => false));
  return { ok: true, path: abs, hasGit, hasPackageJson, hasPython };
});

ipcMain.handle('terminal:send', async (_e, text) => {
  const { terminalApp } = readSettings();
  try {
    return await sendToTerminal(String(text ?? ''), terminalApp);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      mode: 'failed',
      notice:
        'Could not automate the terminal. Grant Accessibility permission to this app (macOS), or switch to “Clipboard only” in settings and paste manually.',
    };
  }
});

ipcMain.handle('clipboard:write', (_e, text) => {
  clipboard.writeText(String(text ?? ''));
  return { ok: true };
});
