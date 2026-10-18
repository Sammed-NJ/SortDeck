# Decisions

Architecture decision log. New decisions go at the bottom: number, date, status, then *context → decision →
consequences*. Never rewrite an accepted entry; supersede it with a new one.

---

### D1 - Electron instead of a PowerShell UI · 2026-10-18 · Accepted
- **Context:** The original tool was a PowerShell script, and the user wanted a real Windows app
  ("like VS Code") that installs with a click.
- **Decision:** Electron, with plain HTML/CSS/JS and no framework or bundler.
- **Consequences:**
  - Familiar modern UI, tray and notifications.
  - About 80 MB installer.
  - No build step for the UI.

### D2 - Engine and config free of Electron · 2026-10-18 · Accepted
- **Context:** Rule logic must be testable fast and without launching an app.
- **Decision:** `engine.js` and `config.js` import only Node built-ins. Trash and notify are injected.
- **Consequences:** `npm test` runs under plain `node` against real temp folders. Never `require('electron')` there.

### D3 - Outlook rule model · 2026-10-18 · Accepted
- **Context:** Users already know mail rules.
- **Decision:** Rules have conditions (all/any), actions and exceptions, are checked top to bottom, and
  support stop processing.
  - copy/notify are non-terminal.
  - move/recycle/keep are terminal: the item is done.
- **Consequences:** Predictable order. Sort by type is a fallback, not a rule.

### D4 - Per-folder config · 2026-10-18 · Accepted
- **Context:** The app must not be Downloads-specific.
- **Decision:** Each folder owns its rules, categories, ignore list, protected subfolders and schedule.
  Global settings are app-wide only (notifications, login, quiet hours, safety interval).

### D5 - fs.watch + debounce + settle + safety interval · 2026-10-18 · Accepted
- **Context:**
  - Downloads arrive as partial files.
  - `fs.watch` can miss events.
  - Files get locked.
- **Decision:**
  - 1.5 s debounce on watcher events.
  - Skip items modified less than 3 s ago.
  - Re-sweep on a configurable safety interval.
  - Retry busy files and warn once.
- **Consequences:** Small delay before items move. No dependency on chokidar.

### D6 - Recycle Bin only; never overwrite · 2026-10-18 · Accepted
- **Decision:**
  - Removal uses `shell.trashItem`.
  - Collisions become `name (n).ext`.
  - Cross-drive moves use copy then remove.
- **Consequences:** No data-loss path exists in the engine.

### D7 - "Downloaded from" via Zone.Identifier · 2026-10-18 · Accepted
- **Decision:** Read the `HostUrl` / `ReferrerUrl` lines from the NTFS `Zone.Identifier` alternate data stream.
- **Consequences:** Windows/NTFS only. Empty for files not saved by a browser.

### D8 - One-click per-user NSIS installer · 2026-10-18 · Accepted
- **Decision:** electron-builder NSIS with `oneClick`, `perMachine: false`, `runAfterFinish`, shortcuts.
- **Consequences:**
  - No admin prompt.
  - SmartScreen warning until the build is code-signed.
  - `appId` must equal the AppUserModelId (see D9).

### D9 - AppUserModelId = appId; separate dev id · 2026-10-18 · Accepted
- **Context:** The taskbar showed the Electron icon because a stale dev shortcut used the same id.
- **Decision:** Packaged builds use `com.sortdeck.app`. `npm start` uses `com.sortdeck.app.dev`.

### D10 - Name: SortDeck · 2026-10-18 · Accepted
- Chosen by the owner from a "fun but corporate" shortlist. Config dir `%APPDATA%\SortDeck`.

### D11 - Beta semver and tags · 2026-10-18 · Accepted
- **Decision:**
  - Versions are `0.y.z-beta.n`.
  - Every release gets a git tag `v<version>` and a CHANGELOG entry (Keep a Changelog format).
  - Commits never mention AI tools.

### D12 - Set up first; per-folder schedule · 2026-10-19 · Accepted
- **Context:** "Start organizing" moved files immediately, and rules ran as soon as they were saved.
  The user wanted to set rules first, then choose auto or manual and the interval.
- **Decision:**
  - New folders default to `trigger: 'manual'` with sort off.
  - Triggers are `instant | interval | manual`; Off is `enabled: false`.
  - Interval folders get their own timer (1 min - 7 days).
  - Organize now always offers Preview.
- **Consequences:** Nothing moves until the user opts in. Tests cover a manual folder being ignored by
  sweeps and interval scheduling.

### D13 - In-app uninstall via the NSIS uninstaller · 2026-10-19 · Accepted
- **Context:** Users want to uninstall from Settings, optionally removing all data.
- **Decision:**
  - Main confirms with a native warning dialog.
  - "Delete all data" also requires a ticked checkbox.
  - Main then spawns `Uninstall SortDeck.exe`, passing `--delete-app-data` (built into electron-builder's
    uninstaller) for the full wipe, and quits.
  - `deleteAppDataOnUninstall` stays `false`, so uninstalling from Windows Settings keeps data.
- **Consequences:**
  - Only works in the installed app; dev runs disable the buttons.
  - User files in watched folders are never touched.

### D14 - Tamper protection with Electron fuses · 2026-10-19 · Accepted
- **Context:** People shouldn't be able to run or edit the app's code after installing.
- **Decision:**
  - Enable asar plus embedded integrity validation and `onlyLoadAppFromAsar`.
  - Disable `runAsNode`, `NODE_OPTIONS` and `--inspect`.
  - Turn DevTools off in packaged builds.
- **Consequences:**
  - A modified install refuses to start, and re-running the installer repairs it.
  - This is not DRM: the asar can still be read. It stops casual editing and code injection, not reverse engineering.

### D15 - Troubleshoot and config backup · 2026-10-19 · Accepted
- **Decision:**
  - `doctor.js` checks the data dir, config, activity log, folders, Start menu shortcut and login item.
  - Repair is offered only when a check fails.
  - The config is backed up on every save and auto-restored when damaged or deleted.
- **Consequences:** Folder problems are reported but never auto-"fixed", because they need the user.

### D16 - Manual update check via GitHub Releases · 2026-10-19 · Accepted
- **Context:** Users need a way to get new versions. The app promises to be offline and private.
- **Decision:**
  - The check runs only when the user clicks **Check for updates**, against the GitHub Releases API.
  - Install downloads the `SortDeck-Setup-*.exe` asset (only https github.com URLs for this repo, taken from
    main's own check, never from the page) and runs it. The one-click installer updates in place.
  - No electron-updater dependency.
- **Consequences:**
  - Needs a published GitHub release with the installer attached.
  - Unsigned builds still show SmartScreen.
  - Background checks are deferred.
