# AGENTS.md

Guide for AI coding agents (Claude Code, Codex, Copilot, ...) working on SortDeck.

## What this is
SortDeck is a Windows Electron app that organizes any folder with Outlook-style rules. Read these first:

| Doc | Read it for |
| --- | --- |
| [PRD.md](PRD.md) | What the product must do |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Processes, files, config shape, engine flow, IPC |
| [Design.md](Design.md) | UI layout, flows, copy and visual rules |
| [DECISIONS.md](DECISIONS.md) | Why things are the way they are |
| [Rules.md](Rules.md) | Hard rules: safety, code, tests, git |
| [Phases.md](Phases.md) | What's done and what's next |

## Commands
```bash
npm install
npm test          # engine + config tests, plain node (~2 s)
npm start         # run the app from source
npm run dist      # build dist/SortDeck-Setup-<version>.exe
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
| Look and feel | `renderer/styles.css` tokens on `:root` |

## Must-follow rules (full list in Rules.md)
- Never delete permanently, never overwrite, never move files without user consent.
- Preview has no side effects.
- No Electron imports in `engine.js` / `config.js`.
- No `innerHTML` with data. Keep the CSP strict.
- Files stay under 500 lines. No new dependencies or frameworks without a DECISIONS.md entry.
- Run `npm test` after changes. Add an engine assert for new behaviour.
- When testing the UI, use a scratch `--user-data-dir`. Never touch the real `%APPDATA%\SortDeck`.
- Commits: conventional style, **no AI attribution / Co-Authored-By lines**.

## Done means
1. `npm test` passes.
2. The app starts and the changed flow works (scratch profile).
3. CHANGELOG.md is updated under the next version. README is updated if user-facing.
4. A DECISIONS.md entry exists if you made a lasting design choice.
5. No 0-byte junk files left in the tree.
