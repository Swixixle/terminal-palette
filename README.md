# command_call-

**Terminal Palette** — a floating desktop panel of command shortcuts for macOS. Click a command and it is sent to Terminal.app or iTerm2.

Built with Electron, React, Vite and Tailwind. The app lives in `VISUAL_CODE/`.

## Run it

```bash
cd VISUAL_CODE
npm install
npm run dev      # Vite + Electron, with reload
```

`npm start` runs Electron against an existing build; `npm run build` packages the app.

## Layout

- `VISUAL_CODE/electron/` — main process and preload
- `VISUAL_CODE/src/components/CommandPalette.jsx` — the palette UI
- `VISUAL_CODE/src/lib/commandsCatalog.js` — the list of commands shown
