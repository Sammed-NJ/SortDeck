# Phases

Delivery plan. ✅ done · 🔄 in progress · ⬜ planned.

## Phase 0 - PowerShell prototype ✅
- Script that sorted Downloads by file type, with Install/Uninstall batch files.
- Proved the idea. Replaced by Phase 1.

## Phase 1 - Desktop app foundation ✅ `0.1.0-beta.1`
- [x] Electron shell: custom titlebar, tray, single instance, start with Windows
- [x] Engine: watcher + debounce + settle + safety interval, busy-file retry
- [x] Any number of folders, each with its own config
- [x] Rules: conditions, actions, exceptions, all/any, stop, reorder, auto/manual
- [x] Optional sort by file type with editable groups
- [x] Overview dashboard, activity log, grouped notifications, quiet hours, pause
- [x] One-click per-user installer. Correct icon and AppUserModelId
- [x] Plain-node tests for engine and config
- [x] README, CHANGELOG, git repo and tag

## Phase 2 - Control and trust ✅ `0.1.0-beta.2`
- [x] "Set up rules first" is the default. Adding a folder moves nothing
- [x] Per-folder **When to organize**: instant / schedule / click only / off
- [x] **Organize now** with Preview and optional sort-the-rest
- [x] How-it-works diagram in README

## Phase 3 - Polish and distribution 🔄 `0.1.0-beta.3+`
- [x] Uninstall from Settings (keep data, or delete all data)
- [x] Troubleshoot + Repair, config backup and auto-restore
- [x] Tamper protection: asar integrity + Electron fuses
- [x] Tutorial with starter rules for Downloads
- [x] README download link
- [x] Check for updates + download and install (manual)
- [x] Themes: System / Light / Dark + accent colors
- [x] Docs diagrams as images
- [x] Automatic release builds (tag push -> installer attached to the GitHub release)
- [ ] GitHub Release with the installer attached
- [ ] License file
- [ ] Undo for recent moves (from the activity log)
- [ ] Rule templates gallery (Invoices, Screenshots, Old installers, ...)
- [ ] Import / export a folder's rules

## Phase 4 - Release candidate ⬜ `0.9.x`
- [ ] Code-signed installer (no SmartScreen warning)
- [ ] Automatic background update checks (manual check done in beta.4)
- [ ] Crash and error log file the user can attach to an issue
- [ ] UI test pass on Windows 10 and 11, light and dark, at small window sizes

## Phase 5 - 1.0 ⬜
- [ ] Conditions on dates in file names and on file contents
- [ ] Performance check on folders with 10k+ items
- [ ] Stable config schema with a migration path

## Later ⬜
- macOS build
- Network and removable drive handling (reconnect, offline detection)

---
For each phase: update CHANGELOG.md, bump the version, tag, and tick the boxes here.
