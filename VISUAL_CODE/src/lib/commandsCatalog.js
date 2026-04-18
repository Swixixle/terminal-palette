/** @typedef {{ id: string, label: string, command: string, category: string, needs?: 'git'|'npm'|'python'|null, prompt?: 'path'|'name'|'message', danger?: boolean }} PaletteCommand */

/** @type {PaletteCommand[]} */
export const BUILTIN_COMMANDS = [
  { id: 'ls', label: 'ls', command: 'ls', category: 'files', needs: null },
  { id: 'lla', label: 'ls -la', command: 'ls -la', category: 'files', needs: null },
  { id: 'pwd', label: 'pwd', command: 'pwd', category: 'files', needs: null },
  { id: 'cd', label: 'cd …', command: '', category: 'files', needs: null, prompt: 'path' },
  { id: 'mkdir', label: 'mkdir …', command: '', category: 'files', needs: null, prompt: 'name' },
  { id: 'touch', label: 'touch …', command: '', category: 'files', needs: null, prompt: 'name' },
  { id: 'gst', label: 'git status', command: 'git status', category: 'git', needs: 'git' },
  { id: 'gdf', label: 'git diff', command: 'git diff', category: 'git', needs: 'git' },
  { id: 'glog', label: 'git log --oneline', command: 'git log --oneline -n 20', category: 'git', needs: 'git' },
  { id: 'gbr', label: 'git branch', command: 'git branch -vv', category: 'git', needs: 'git' },
  { id: 'ga', label: 'git add .', command: 'git add .', category: 'git', needs: 'git' },
  { id: 'gc', label: 'git commit …', command: '', category: 'git', needs: 'git', prompt: 'message' },
  { id: 'gp', label: 'git push', command: 'git push', category: 'git', needs: 'git' },
  { id: 'gpu', label: 'git pull', command: 'git pull', category: 'git', needs: 'git' },
  { id: 'ni', label: 'npm install', command: 'npm install', category: 'npm', needs: 'npm' },
  { id: 'ns', label: 'npm start', command: 'npm start', category: 'npm', needs: 'npm' },
  { id: 'nt', label: 'npm test', command: 'npm test', category: 'npm', needs: 'npm' },
  { id: 'nb', label: 'npm run build', command: 'npm run build', category: 'npm', needs: 'npm' },
  { id: 'nd', label: 'npm run dev', command: 'npm run dev', category: 'npm', needs: 'npm' },
  { id: 'pipy', label: 'pip install -r requirements.txt', command: 'pip install -r requirements.txt', category: 'python', needs: 'python' },
  { id: 'pyv', label: 'python --version', command: 'python3 --version', category: 'python', needs: null },
];

export const CATEGORY_META = [
  { id: 'files', label: 'Files' },
  { id: 'git', label: 'Git' },
  { id: 'npm', label: 'npm' },
  { id: 'python', label: 'Python' },
  { id: 'custom', label: 'My shortcuts' },
];
