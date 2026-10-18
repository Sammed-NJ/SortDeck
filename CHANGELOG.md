# Changelog

All notable changes to SortDeck are listed here.
Format follows [Keep a Changelog](https://keepachangelog.com); versions follow [Semantic Versioning](https://semver.org).

## [0.1.0-beta.4] - 2026-10-19

### Added
- **Check for updates** at the top of Settings. It asks GitHub Releases for a newer version (only when you click).
  **Download and install** fetches the installer from GitHub over HTTPS, runs it, and SortDeck reopens
  updated with your settings kept. **What's new** opens the release notes.
- **Uninstall...** shortcut at the top of Settings that jumps to the uninstall options.

## [0.1.0-beta.3] - 2026-10-19

### Added
- **Tutorial** in the sidebar, and on the welcome screen. It is a 7-step walk-through of folders, rules, rule
  order, preview and schedules. It ends with **Create starter rules**, which adds your Downloads folder
  (set to *Only when I click*) with one editable rule per file type plus "Everything else to Other".
- README download button.
- **Uninstall** from Settings, with a warning first. Choose to keep your data for a reinstall, or
  **uninstall and delete all data** (needs an extra confirmation). Your organized files are never touched.
- **Troubleshoot** in Settings. It checks the settings file, activity log, watched folders, start with Windows
  and the Start menu shortcut. **Repair** appears only when something is broken. If it finds a problem at
  startup, a banner appears on Overview.
- The settings file is backed up on every save. A damaged or deleted settings file is restored automatically
  from the backup, and the damaged copy is kept as `config.damaged.json`.

### Security
- The app code is packed and integrity-checked: a modified installation refuses to start, and a loose `app`
  folder is ignored. Running the app as Node, `NODE_OPTIONS` and `--inspect` are switched off.
  Developer tools are off in installed builds.

## [0.1.0-beta.2] - 2026-10-19

### Added
- **When to organize**, per folder: *Instantly* (as items arrive), *On a schedule* (every N minutes or
  hours, with the next check shown), *Only when I click*, or *Off*.
- **Organize now** on every folder: runs its rules once, optionally followed by sort by file type, with a
  preview first. Works on the folder or any subfolder.
- Add-folder dialog asks how to start: **Set up rules first** (default - nothing moves) or
  **Sort by file type right away**.

### Changed
- Adding a folder no longer moves anything unless you choose to.
- "Run rules now" is now "Organize now"; a single rule's **Run** button runs just that rule.
- The per-rule *Automatic / Manual only* option is hidden on folders that only run when you click.
- Overview and folder list show each folder's schedule.

## [0.1.0-beta.1] - 2026-10-18

First public beta.

### Added
- One-click Windows installer (per-user, no admin rights), Start Menu and Desktop shortcuts.
- Watch any number of folders; each has its own rules and settings.
- Outlook-style rules: conditions (name, extension, size, age, downloaded-from website, file/folder),
  actions (move, copy, Recycle Bin, keep, notify), exceptions, match all/any, stop processing,
  automatic or manual-only, reordering.
- Preview matches and "Run rules now" on a folder or any subfolder.
- Optional sort by file type per folder, with editable groups.
- Instant pickup of new items; safety re-check on an interval; files still being written are skipped.
- System tray, start with Windows, pause, quiet hours, grouped notifications.
- Overview with status, per-folder counts and recent activity.
- Light and dark theme following Windows.

[0.1.0-beta.4]: https://github.com/Sammed-NJ/SortDeck/releases/tag/v0.1.0-beta.4
[0.1.0-beta.3]: https://github.com/Sammed-NJ/SortDeck/releases/tag/v0.1.0-beta.3
[0.1.0-beta.2]: https://github.com/Sammed-NJ/SortDeck/releases/tag/v0.1.0-beta.2
[0.1.0-beta.1]: https://github.com/Sammed-NJ/SortDeck/releases/tag/v0.1.0-beta.1
