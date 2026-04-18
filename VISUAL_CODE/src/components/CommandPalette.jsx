import { useCallback, useEffect, useMemo, useState } from 'react';
import { BUILTIN_COMMANDS, CATEGORY_META } from '@/lib/commandsCatalog.js';

const LS_CUSTOM = 'palette-custom-commands-v1';
const LS_WORKSPACE = 'palette-workspace-v1';

function loadCustom() {
  try {
    const raw = localStorage.getItem(LS_CUSTOM);
    if (!raw) return [];
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function saveCustom(rows) {
  localStorage.setItem(LS_CUSTOM, JSON.stringify(rows));
}

function loadWorkspace() {
  return localStorage.getItem(LS_WORKSPACE) || '';
}

function saveWorkspace(p) {
  if (p) localStorage.setItem(LS_WORKSPACE, p);
  else localStorage.removeItem(LS_WORKSPACE);
}

export default function CommandPalette() {
  const api = window.visualCode;
  const [workspace, setWorkspace] = useState('');
  const [ctx, setCtx] = useState({ hasGit: false, hasPackageJson: false, hasPython: false, ok: false });
  const [terminalApp, setTerminalApp] = useState('terminal');
  const [category, setCategory] = useState('files');
  const [sequence, setSequence] = useState([]);
  const [joiner, setJoiner] = useState(' && ');
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [custom, setCustom] = useState(() => loadCustom());
  const [newLabel, setNewLabel] = useState('');
  const [newCmd, setNewCmd] = useState('');
  const [argModal, setArgModal] = useState(null);
  const [argValue, setArgValue] = useState('');

  const refreshContext = useCallback(async () => {
    if (!api?.analyzeContext) return;
    const base = workspace || (await api.pathsHome());
    const r = await api.analyzeContext(base);
    setCtx({
      ok: r.ok,
      hasGit: !!r.hasGit,
      hasPackageJson: !!r.hasPackageJson,
      hasPython: !!r.hasPython,
    });
  }, [api, workspace]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!api?.pathsHome) return;
      const [home, settings] = await Promise.all([api.pathsHome(), api.settingsGet?.() ?? {}]);
      if (cancelled) return;
      const ws = loadWorkspace() || home;
      setWorkspace(ws);
      if (settings.terminalApp) setTerminalApp(settings.terminalApp);
    })();
    return () => {
      cancelled = true;
    };
  }, [api]);

  useEffect(() => {
    refreshContext();
  }, [refreshContext]);

  const persistTerminalApp = async (value) => {
    setTerminalApp(value);
    await api?.settingsSet?.({ terminalApp: value });
  };

  const pickWorkspace = async () => {
    const r = await api.pickDirectory();
    if (!r?.ok) return;
    setWorkspace(r.path);
    saveWorkspace(r.path);
    await refreshContext();
  };

  const sendRaw = async (text) => {
    if (!api?.sendToTerminal) return;
    setBusy(true);
    setStatus(null);
    try {
      const out = await api.sendToTerminal(text);
      if (out?.notice) setStatus({ kind: 'info', text: out.notice });
      else if (out?.mode === 'paste_only') {
        setStatus({ kind: 'info', text: 'Copied. Click your terminal, then paste (Cmd+V / Ctrl+V).' });
      } else if (out?.ok === false) {
        setStatus({ kind: 'error', text: out?.error || out?.notice || 'Send failed.' });
      } else {
        setStatus({ kind: 'ok', text: 'Sent to terminal.' });
      }
    } catch (e) {
      setStatus({ kind: 'error', text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  const openArgModal = (config) => {
    const { prefill = '', ...rest } = config;
    setArgValue(prefill);
    setArgModal(rest);
  };

  const onCommandClick = (def) => {
    if (def.prompt === 'path') {
      openArgModal({
        title: 'Change directory',
        placeholder: workspace || '~/Projects',
        prefill: workspace || '',
        action: (raw) => {
          const p = raw.trim();
          if (!p) return;
          void sendRaw(`cd ${JSON.stringify(p)}`);
        },
      });
      return;
    }
    if (def.prompt === 'name') {
      openArgModal({
        title: def.id === 'mkdir' ? 'New folder name' : 'File name',
        placeholder: 'my-folder',
        action: (raw) => {
          const n = raw.trim().replace(/["\\]/g, '');
          if (!n) return;
          const cmd = def.id === 'mkdir' ? `mkdir ${JSON.stringify(n)}` : `touch ${JSON.stringify(n)}`;
          void sendRaw(cmd);
        },
      });
      return;
    }
    if (def.prompt === 'message') {
      openArgModal({
        title: 'Commit message',
        placeholder: 'Describe your change',
        action: (raw) => {
          const m = raw.trim();
          if (!m) return;
          void sendRaw(`git commit -m ${JSON.stringify(m)}`);
        },
      });
      return;
    }
    void sendRaw(def.command);
  };

  const visibleBuiltins = useMemo(() => {
    return BUILTIN_COMMANDS.filter((c) => {
      if (c.needs === 'git' && !ctx.hasGit) return false;
      if (c.needs === 'npm' && !ctx.hasPackageJson) return false;
      if (c.needs === 'python' && !ctx.hasPython) return false;
      return c.category === category;
    });
  }, [category, ctx.hasGit, ctx.hasPackageJson, ctx.hasPython]);

  const addCustom = () => {
    const label = newLabel.trim();
    const command = newCmd.trim();
    if (!label || !command) return;
    const row = { id: `c-${Date.now()}`, label, command };
    const next = [...custom, row];
    setCustom(next);
    saveCustom(next);
    setNewLabel('');
    setNewCmd('');
  };

  const removeCustom = (id) => {
    const next = custom.filter((c) => c.id !== id);
    setCustom(next);
    saveCustom(next);
  };

  const onDragStart = (e, cmd) => {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('text/plain', cmd);
  };

  const onDropSeq = (e) => {
    e.preventDefault();
    const cmd = e.dataTransfer.getData('text/plain');
    if (cmd) setSequence((s) => [...s, cmd]);
  };

  const sendSequence = () => {
    if (!sequence.length) return;
    void sendRaw(sequence.join(joiner));
    setSequence([]);
  };

  if (!api) {
    return (
      <div className="rounded-xl bg-white/80 p-4 text-sm text-red-700 ring-1 ring-red-200">
        Run this UI inside the Electron app so it can talk to your terminal.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <header className="app-drag shrink-0 rounded-xl bg-white/55 px-3 py-2 ring-1 ring-black/10 backdrop-blur-md">
        <div className="app-no-drag flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h1 className="text-sm font-semibold text-ink">Terminal Palette</h1>
              <p className="text-[11px] text-ink-muted">Click to send · Drag into the stack to chain</p>
            </div>
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                onClick={() => refreshContext()}
                className="rounded-lg bg-white/80 px-2 py-1 text-[11px] font-semibold text-ink ring-1 ring-black/10"
              >
                Refresh
              </button>
              <button
                type="button"
                onClick={() => pickWorkspace()}
                className="rounded-lg bg-accent px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm"
              >
                Folder…
              </button>
            </div>
          </div>
          <p className="line-clamp-2 break-all text-[11px] text-ink-muted" title={workspace}>
            {workspace ? workspace : 'Choose a folder for smarter command hints.'}
          </p>
          <div className="flex flex-wrap gap-1.5 text-[10px]">
            {ctx.hasGit ? (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800">git</span>
            ) : null}
            {ctx.hasPackageJson ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-900">npm</span>
            ) : null}
            {ctx.hasPython ? (
              <span className="rounded-full bg-sky-100 px-2 py-0.5 font-medium text-sky-900">python</span>
            ) : null}
            {!ctx.ok && workspace ? (
              <span className="text-amber-800">This folder is not readable — pick another.</span>
            ) : null}
            {ctx.ok && !ctx.hasGit && !ctx.hasPackageJson && !ctx.hasPython ? (
              <span className="text-ink-muted">No project markers — git/npm/python buttons stay hidden until detected.</span>
            ) : null}
          </div>
          <label className="flex items-center gap-2 text-[11px] text-ink">
            <span className="shrink-0 text-ink-muted">Send via</span>
            <select
              value={terminalApp}
              onChange={(e) => persistTerminalApp(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-black/10 bg-white/80 px-2 py-1 text-[11px] outline-none focus:border-accent"
            >
              <option value="terminal">Terminal.app (paste + Enter)</option>
              <option value="iterm2">iTerm2</option>
              <option value="paste_only">Clipboard only</option>
            </select>
          </label>
        </div>
      </header>

      <div className="app-no-drag flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
        <div className="flex shrink-0 gap-1 overflow-x-auto pb-1">
          {CATEGORY_META.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              className={`whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-semibold ${
                category === c.id ? 'bg-ink text-white' : 'bg-white/60 text-ink ring-1 ring-black/10'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-auto rounded-xl bg-white/50 p-2 ring-1 ring-black/10">
          {category === 'custom' ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2 rounded-lg bg-white/70 p-2 ring-1 ring-black/5">
                <p className="text-[11px] font-medium text-ink">Add shortcut</p>
                <input
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="Label"
                  className="rounded-lg border border-black/10 px-2 py-1.5 text-xs outline-none focus:border-accent"
                />
                <input
                  value={newCmd}
                  onChange={(e) => setNewCmd(e.target.value)}
                  placeholder="Command"
                  className="rounded-lg border border-black/10 px-2 py-1.5 text-xs outline-none focus:border-accent"
                />
                <button
                  type="button"
                  onClick={addCustom}
                  className="rounded-lg bg-accent py-1.5 text-xs font-semibold text-white"
                >
                  Save shortcut
                </button>
              </div>
              <ul className="flex flex-col gap-1.5">
                {custom.map((c) => (
                  <li key={c.id} className="flex items-center gap-1">
                    <button
                      type="button"
                      draggable
                      onDragStart={(e) => onDragStart(e, c.command)}
                      onClick={() => sendRaw(c.command)}
                      className="flex-1 rounded-lg bg-white px-2 py-2 text-left text-xs font-medium text-ink ring-1 ring-black/10 hover:bg-accent-soft"
                    >
                      <span className="block">{c.label}</span>
                      <span className="mt-0.5 block font-mono text-[10px] text-ink-muted">{c.command}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeCustom(c.id)}
                      className="rounded-lg px-2 py-2 text-[11px] text-red-600 hover:bg-red-50"
                      title="Remove"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : visibleBuiltins.length === 0 ? (
            <p className="px-1 py-6 text-center text-[11px] leading-relaxed text-ink-muted">
              Nothing in this category for the current folder. Choose a project folder (git / npm / Python) or open the Files tab.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {visibleBuiltins.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  draggable={!c.prompt}
                  onDragStart={(e) => {
                    if (c.prompt) {
                      e.preventDefault();
                      return;
                    }
                    onDragStart(e, c.command);
                  }}
                  onClick={() => onCommandClick(c)}
                  disabled={busy}
                  className="rounded-xl bg-white px-2 py-2 text-left text-[11px] font-semibold text-ink shadow-sm ring-1 ring-black/10 hover:bg-accent-soft disabled:cursor-wait disabled:opacity-60"
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div
          className="shrink-0 rounded-xl bg-white/55 p-2 ring-1 ring-black/10 backdrop-blur-md"
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDropSeq}
        >
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold text-ink">Stack</p>
            <select
              value={joiner}
              onChange={(e) => setJoiner(e.target.value)}
              className="rounded-md border border-black/10 bg-white/80 px-2 py-0.5 text-[10px] outline-none"
            >
              <option value=" && ">join with &&</option>
              <option value=" ; ">join with ;</option>
            </select>
          </div>
          {sequence.length === 0 ? (
            <p className="rounded-lg border border-dashed border-black/15 px-2 py-4 text-center text-[11px] text-ink-muted">
              Drag commands here to build a chain
            </p>
          ) : (
            <ul className="mb-2 flex max-h-24 flex-wrap gap-1 overflow-auto">
              {sequence.map((s, i) => (
                <li
                  key={`${i}-${s}`}
                  className="flex items-center gap-1 rounded-full bg-ink px-2 py-0.5 text-[10px] text-white"
                >
                  <span className="max-w-[140px] truncate font-mono">{s}</span>
                  <button
                    type="button"
                    className="text-white/80 hover:text-white"
                    onClick={() => setSequence((x) => x.filter((_, j) => j !== i))}
                    aria-label="Remove from stack"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={sendSequence}
              disabled={busy || sequence.length === 0}
              className="flex-1 rounded-lg bg-accent py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Send stack
            </button>
            <button
              type="button"
              onClick={() => setSequence([])}
              className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-ink ring-1 ring-black/10"
            >
              Clear
            </button>
          </div>
        </div>

        {status ? (
          <p
            className={`shrink-0 rounded-lg px-2 py-1.5 text-[11px] ${
              status.kind === 'error'
                ? 'bg-red-50 text-red-800 ring-1 ring-red-100'
                : status.kind === 'ok'
                  ? 'bg-emerald-50 text-emerald-900 ring-1 ring-emerald-100'
                  : 'bg-sky-50 text-sky-900 ring-1 ring-sky-100'
            }`}
          >
            {status.text}
          </p>
        ) : null}
      </div>

      {argModal ? (
        <div className="app-no-drag fixed inset-0 z-50 flex items-end justify-center bg-black/25 p-3 sm:items-center">
          <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-2xl ring-1 ring-black/10">
            <h3 className="text-sm font-semibold text-ink">{argModal.title}</h3>
            <input
              autoFocus
              value={argValue}
              onChange={(e) => setArgValue(e.target.value)}
              className="mt-3 w-full rounded-xl border border-black/10 px-3 py-2 text-sm outline-none focus:border-accent"
              placeholder={argModal.placeholder}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setArgModal(null);
                if (e.key === 'Enter') {
                  argModal.action(argValue);
                  setArgModal(null);
                }
              }}
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-ink-muted hover:bg-black/5"
                onClick={() => setArgModal(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white"
                onClick={() => {
                  argModal.action(argValue);
                  setArgModal(null);
                }}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
