# AGENTS.md

Guide for AI coding agents (Claude Code, Codex, Copilot, ...) working on SortDeck.

## What this is
SortDeck is a Windows Electron app that organizes any folder with rules you build. Read these first:

| Doc | Read it for |
| --- | --- |
| [PRD.md](docs/PRD.md) | What the product must do |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Processes, files, config shape, engine flow, IPC |
| [Design.md](docs/Design.md) | UI layout, flows, copy and visual rules |
| [DECISIONS.md](docs/DECISIONS.md) | Why things are the way they are |
| [Rules.md](docs/Rules.md) | Hard rules: safety, code, tests, git |
| [Phases.md](docs/Phases.md) | What's done and what's next |

## Commands
```bash
npm install
npm test          # engine + config tests, plain node (~2 s)
npm start         # run the app from source
npm run dist      # build dist/SortDeck-Setup-beta.N.exe or SortDeck-Setup-vX.Y.Z.exe (scripts/dist.js)
```
Unset `ELECTRON_RUN_AS_NODE` first. VS Code's terminal sets it, and Electron then runs as Node.
- bash: `env -u ELECTRON_RUN_AS_NODE npm start`
- PowerShell: `Remove-Item Env:ELECTRON_RUN_AS_NODE`

## Where to change what
| Task | File |
| --- | --- |
| New rule condition or action | `config.js` (`OPS` + `validateRule`) → `engine.js` (`testCondition` / `processItem`) → `renderer/rules.js` (editor) → test |
| New per-folder option | `config.js` (`newFolder`, `normalizeConfig`, `toForm`, `buildConfig`) → `renderer/folders.js` |
| New global setting | `config.js` settings → `index.html` Settings card → `app.js` `bindSetting` |
| New main-process capability | `main.js` `ipcMain.handle` → `preload.js` → renderer |
| Look and feel | `renderer/styles.css` tokens on `:root`; accents in `theme.css` |
| New icon | Copy its SVG from the `heroicons` package into `renderer/icons.js` (never a CDN) |
| New tour step | `TOUR` in `renderer/tutorial.js`; give the target a `data-tour` attribute |
| Release | Bump `package.json`, CHANGELOG, README badge → tag `vX.Y.Z[-beta.N]` → push (CI builds and publishes) |
| Installer size | `build` in `package.json` (`electronLanguages`, `compression`) and `UNUSED` in `scripts/dist.js` (afterPack) |

## Must-follow rules (full list in [docs/Rules.md](docs/Rules.md))
- Never delete permanently, never overwrite, never move files without user consent.
- Preview has no side effects.
- No Electron imports in `engine.js` / `config.js`.
- No `innerHTML` with data. Keep the CSP strict.
- Files stay under 500 lines. No new dependencies or frameworks without a docs/DECISIONS.md entry.
- Run `npm test` after changes. Add an engine assert for new behaviour.
- When testing the UI, use a scratch `--user-data-dir`. Never touch the real `%APPDATA%\SortDeck`.
- A test run of `dist/win-unpacked/SortDeck.exe` registers a real start-with-Windows entry (and notifications can
  create a Start-menu shortcut). Remove them afterwards if SortDeck isn't installed.
- Commits: conventional style, **no AI attribution / Co-Authored-By lines**.

## Always update together
Every change also updates, in the same pass: README, CHANGELOG, `docs/`, the owner's portfolio page
(`samnj.fyi` repo: `app/sortdeck/page.tsx`, `app/data/content.json`) and resume (`.docx` → PDF → portfolio
`public/sammednj.pdf` + `resume_text.txt`), whenever they mention the changed thing. Check the live site after deploy.

## Done means
1. `npm test` passes.
2. The app starts and the changed flow works (scratch profile).
3. CHANGELOG.md is updated under the next version. README is updated if user-facing.
4. A DECISIONS.md entry exists if you made a lasting design choice.
5. No 0-byte junk files left in the tree.
