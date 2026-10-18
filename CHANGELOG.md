# Changelog

All notable changes to SortDeck are listed here.
Format follows [Keep a Changelog](https://keepachangelog.com); versions follow [Semantic Versioning](https://semver.org).

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

[0.1.0-beta.2]: https://github.com/Sammed-NJ/SortDeck/releases/tag/v0.1.0-beta.2
[0.1.0-beta.1]: https://github.com/Sammed-NJ/SortDeck/releases/tag/v0.1.0-beta.1
