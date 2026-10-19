# Project rules

Rules for anyone changing SortDeck - people and AI agents alike. Break one only with a new entry in
[DECISIONS.md](DECISIONS.md).

## Safety (non-negotiable)
1. **Never permanently delete user files.** Removal goes through the injected `trash` (`shell.trashItem`).
2. **Never overwrite.** Destinations go through `freePath` (`name (1).ext`).
3. **Never move without consent.** Adding a folder or saving a rule must not move files unless the user chose
   an automatic trigger or clicked Organize now.
4. **Preview has no side effects.** Not even notify. `preview: true` paths must stay pure.
5. **Skip unfinished files.** Keep the settle window and the default ignore list (`crdownload`, `part`, ...).
6. **Never run the packaged `dist/win-unpacked/SortDeck.exe` with a normal config.** It writes the real
   start-with-Windows entry (same app id as the installed app). Test UI in dev mode; test fuses with a tampered copy.
7. **Testing must not touch real data.** Use temp dirs, and pass `--user-data-dir` to a scratch dir when
   driving the UI. Never edit `%APPDATA%\SortDeck` during development.

## Code
8. `src/main/engine.js` and `src/main/config.js` must **not** import Electron.
9. All renderer input is re-validated in main (`buildConfig`, `validateRule`, `isAllowedPath`).
10. Renderer DOM is built with `h()` and text nodes. **No `innerHTML` with data.**
11. Keep the CSP strict: no inline scripts, no remote resources. Icons come from Heroicons, copied into
    `src/renderer/icons.js`, never from a CDN.
12. No framework, no bundler, no new runtime dependencies without a decision entry.
13. Keep files under **500 lines**. Split by feature (as with `folders.js` / `rules.js`), not by layer.
14. Match the surrounding style:
    - 2-space indent, single quotes, semicolons.
    - Short comments that say *why*.
    - Mark deliberate shortcuts with `// ponytail:`.
15. Every `setTimeout` / `setInterval` in the engine is `.unref()`'d and cleared in `stop()`.
15a. Stay light: the app draws in software and ships without GPU/WebGPU/Vulkan DLLs (D19). No WebGL, WebGPU or
    heavy canvas work, and nothing that keeps a window alive in the background.

## Tests
16. Run `npm test` after every code change. It must pass before a commit.
17. New engine behaviour gets an assert in `tests/engine.test.js` (plain node, real temp folders).
    Backdate mtimes with `utimes` so the settle window doesn't skip test files.

## Docs
- **Always update together.** Every code change also updates, in the same pass: README, CHANGELOG, `docs/`
  (and diagrams/screenshots if the UI changed), the portfolio SortDeck page and project card, and the resume
  (`.docx` → Word PDF → portfolio `public/sammednj.pdf` + `resume_text.txt`). Remove dead code before committing.
  Check the live site after deploy.
- Diagrams are **SVG images** in `docs/images/` (same dark style as `how-it-works.svg`). No ASCII/box-drawing diagrams.

## Environment gotchas
- VS Code's terminal sets `ELECTRON_RUN_AS_NODE=1`. Unset it before `npm start` / `npm run dist`.
- Use forward slashes in paths passed through test harnesses. Some strip backslashes.
- `appId` in `package.json` must equal the packaged AppUserModelId in `main.js`.
- Running `dist/win-unpacked/SortDeck.exe` writes a real start-with-Windows entry (`HKCU\...\Run\com.sortdeck.app`),
  and a notification from a dev or unpacked run can create a Start-menu shortcut (`SortDeck.lnk` / `Electron.lnk`).
  Remove them after testing if SortDeck isn't installed.

## Git and releases
18. Branch `master`, remote `https://github.com/Sammed-NJ/SortDeck.git`.
19. Conventional commits: `feat:`, `fix:`, `docs:`, `chore:`, `test:`.
20. **No AI attribution** in commits or PRs (no `Co-Authored-By` for tools).
21. To release:
    1. Bump `package.json` to `0.y.z-beta.n`.
    2. Update CHANGELOG.md and the README version badge.
    3. Run `npm test`, then `npm run dist`.
       This makes `dist/SortDeck-Setup-beta.N.exe` (betas) or `dist/SortDeck-Setup-vX.Y.Z.exe` (official).
    3b. Pushing the tag runs `.github/workflows/release.yml`:
        - a beta tag replaces the file on the single **SortDeck Beta** release (tag `beta`)
        - an official tag (`v1.0.0`) creates its own release
        Never create releases by hand.
    4. Commit, tag `v<version>`, then push the branch and the tag.
22. Never commit `node_modules/`, `dist/`, secrets or 0-byte junk files.
