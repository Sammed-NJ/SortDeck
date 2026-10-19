# Design

How SortDeck looks and behaves. The goal is that it feels like a native Windows 11 utility, explains
itself, and never surprises the user by moving files.

## Principles
1. **Nothing moves by surprise.** New folders start in "Set up rules first". Preview comes before every manual run.
2. **One rule language.** The UI uses *When / Do this / Except if*, "Stop processing more rules", top-to-bottom order.
3. **Plain words.** The UI says "Only when I click", not `trigger: manual`, and "Recycle Bin", not "delete".
4. **One save model.** All edits are collected in a form. The save bar shows *Unsaved changes* with Revert / Save (Ctrl+S).
5. **Quiet by default.** Notifications are grouped, there is a single tray hint, and a busy file is warned about once.
6. **Show the work.** Anything that runs shows a spinner and a moving bar for at least a moment, then results tick in
   one by one with an icon. Details that are fine stay folded away. Reduced-motion settings turn the animation off.

## Layout

<p align="center"><img src="images/design-layout.svg" alt="Window layout: custom titlebar with logo and BETA badge, sidebar with Overview, Folders and rules, Settings, Send feedback and a status line with an icon, a ? tour button in the titlebar, and the main view showing the status hero, three stats, Folders and Recent activity cards, with a toast at the bottom." width="100%"></p>

**Folder detail, top to bottom:**
- header: name, path, Open, Remove, **Organize now...**
- **When to organize** card
- **Rules** list
- **Sort by file type** toggle and category rows
- **Folder options**: ignored extensions, protected subfolders

## Key flows

**Add folder**
1. Pick a suggestion or browse.
2. Choose a card: **Set up rules first** (default) or **Sort by file type right away**.
3. The folder is added. Nothing moves in setup mode.

**Create a rule**
1. Click *New rule* to open a dialog with Name, When (conditions + all/any), Do this (actions), Except if, Options.
2. Use *Preview matches* to list affected items.
3. Save.

**Guided tour** (starts by itself on first launch; replay with the **?** button in the title bar)
1. A welcome card offers **Start tour**, **Maybe later** (asks again next launch) or **Skip** (never auto-starts again).
2. Each step switches to the right page, dims the app and spotlights one element with a callout (Back / Next /
   Skip tour, "3 of 12"). The app can't be clicked while touring. Esc means "later"; the arrow keys move between steps.
3. Steps only appear when their element exists (folder steps need a folder).
4. The last step offers **Add starter rules**: Downloads is added in click-only mode with one rule per file type
   plus "Everything else to Other". Re-running it never duplicates rules.

**Organize now**
1. Open the dialog. It shows the rule list scope and an optional *Then sort the rest by file type* box.
2. Click **Preview**. A result list shows each item → action → destination.
3. Click **Organize now**. A moving bar shows for at least a second, then each item ticks in with a check
   (or a warning icon if it failed, e.g. the file was in use).

**Troubleshoot** (Settings)
1. The results are folded away; only a one-line summary shows ("No problems found" / "2 problems found").
2. **Run check** spins, opens the list and ticks off each check. If everything passed, the list folds closed again.
3. Problems keep the list open with a **Repair** button, and the Overview shows a banner.

## Visual language
- **Tokens** live on `:root` in `styles.css`. Light and dark themes follow Windows (`prefers-color-scheme`).
- **Themes:** Settings → Appearance sets System / Light / Dark (`nativeTheme.themeSource`, so the title bar follows) and
  one of six accents (`<html data-accent>`, colors in `theme.css`).
- **Brand color:** teal, `#0e7490` family. The icon is a teal folder with sorted lines.
- **Category colors:** each name hashes into `PALETTE` (no red, which reads as an error). *Other* and
  *Folders* are slate.
- **Components:**
  - cards
  - pill tags (Automatic / Manual, BETA)
  - switches
  - chip inputs for extensions (Enter / comma / space commits, Backspace removes)
  - radio "choice" cards
  - icon buttons with `title` and `aria-label`
- **Icons:** [Heroicons](https://heroicons.com) v2.2.0, 24px outline, stored locally in `src/renderer/icons.js` (MIT,
  Tailwind Labs). Never load icons from a CDN. To add one, copy its SVG from the `heroicons` package into `ICONS`.
- **Status** (sidebar icon + text, Overview title) says what is really happening:

  | State | Sidebar | When |
  | --- | --- | --- |
  | Organizing | play icon, green | at least one folder is *Instantly* or *On a schedule* |
  | Only when you click | cursor icon, accent | folders are on, but all wait for **Organize now** (Pause is hidden) |
  | Paused | pause icon, red | the user paused organizing |
  | All folders off | power icon, grey | every folder is set to *Off* |
  | No folders yet | folder-plus icon, grey | nothing added |

## Copy rules
- Sentence case. Verbs on buttons ("Organize now", "Add folder").
- Errors say what to do: "Folder not found", "File in use - will retry".
- Never use the words "delete" or "permanently". Say "Send to Recycle Bin".

## Accessibility
- Every icon-only button has `aria-label` and `title`.
- Native `<dialog>`, `<select>` and `<input>` elements give keyboard and screen-reader behaviour for free.
- Contrast follows the theme tokens. Focus outlines are not removed.
- Layout works down to the minimum window width without horizontal scroll.
