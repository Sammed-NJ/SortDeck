# SortDeck - Product Requirements

**Status:** Beta (`0.1.0-beta.2`) · **Platform:** Windows 10 / 11 · **Owner:** Sammed NJ

## 1. Problem

Folders like Downloads, Desktop and project inboxes fill up with files nobody files away. Existing tools are
either scripts (hard to set up and change) or sorters that only group by file type. Nothing lets people
say simply "when X, do Y, except Z" for their own folders.

## 2. Goal

A desktop app you **download, double-click and use**. Point it at any folder, describe rules the
*when / do this / except if* way, preview them, then let it run automatically or only when you click.

## 3. Users

| User | Needs |
| --- | --- |
| Everyday PC user | Clean Downloads/Desktop with zero setup; sort by type in one click |
| Power user | Precise rules (name, size, age, source website), several folders, schedules |
| Cautious user | See exactly what will happen before anything moves; nothing deleted permanently |

## 4. Requirements

### 4.1 Install and run
- R1 One-click installer, per-user, **no admin rights**, Start Menu and Desktop shortcuts, opens after install.
- R2 Runs in the system tray; closing the window keeps it working. Optional start with Windows.
- R3 Correct app name and icon in taskbar, tray and Start Menu.
- R4 Fully offline: no account, cloud or telemetry.

### 4.2 Folders
- R5 Watch any number of folders, each with its **own** config: rules, file-type groups, ignored
  extensions, protected subfolders and schedule.
- R6 Adding a folder must **not move anything** unless the user picks "Sort by file type right away".
- R7 Per-folder **When to organize**: *Instantly* · *On a schedule* (every N minutes/hours, 1 min - 7 days) ·
  *Only when I click* · *Off*.

### 4.3 Rules
- R8 Conditions: file name (contains / starts / ends / equals / wildcard / regex), extension (in / not in),
  size (MB), age (minutes/hours/days), downloaded-from website, file vs folder. Match **all** or **any**.
- R9 Actions: move, copy, Recycle Bin, keep in place, notify. Several can be combined.
- R10 Exceptions use the same conditions.
- R11 Per rule: on/off, automatic or manual-only, stop processing more rules, reorder.
- R12 Rules are checked top to bottom. Items no rule handled can be sorted by file type (optional).

### 4.4 Running
- R13 **Preview** shows every planned action without touching files.
- R14 **Organize now** runs a folder's rules once, on the folder or a subfolder, optionally followed by sort by type.
- R15 Pause, and quiet hours, stop automatic runs. Manual runs still work.

### 4.5 Safety
- R16 Files still being written (partial downloads, recently modified) are skipped.
- R17 Files in use are retried, and the user is warned once.
- R18 Never overwrite: name clashes become `name (1).ext`.
- R19 "Delete" always means the Recycle Bin.
- R20 Config is saved atomically; a corrupt config is reset with a visible warning.

### 4.6 Feedback
- R21 Overview: on/paused state, folder status, count organized today, recent activity (click to show in Explorer).
- R22 Notifications are grouped and never sent one per file.

## 5. Non-goals (for now)
- macOS / Linux builds
- Content-based rules (reading inside files)
- Cloud sync, multi-device config
- Undo history (roadmap)

## 6. Success measures
- New user goes from install to first organized folder in **under 1 minute**.
- Zero data-loss reports. Every removal is recoverable from the Recycle Bin.
- Engine and config tests pass on every release.

## 7. Open questions
- Code signing: cost versus the SmartScreen warning.
- Auto-update channel for beta builds.
