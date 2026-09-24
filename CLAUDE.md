# TizoMD

**Status:** 🚧 Scaffold complete — full app written, tests + build + boot green
**Created:** 2026-09-23
**One-liner:** A markdown viewer and editor for desktop — installable, good-looking,
Tizo-branded — free for everyone to use, but the code is source-available under a
custom Tizo license.

## What This Is

A desktop app (Electron) for opening, reading and editing `.md` files, aimed at
sitting silently in the background: open a file, edit, see the preview, done. It
is a Tizo product — sibling to Video Downloader Tizo and Tizo Code — under the
EFM Network umbrella.

**Done looks like:** someone installs it, opens a folder of `.md` files, gets a
dark, polished, native-feeling editor with tabs and a live preview, edits,
exports to HTML or PDF, closes it — and opens it tomorrow to find everything
exactly where they left it.

**Vibe and scope:** *simple and good.* Not a Notepad copy, not an IDE. The
feature list is deliberately small (see below); feature ideas beyond it come
through GitHub suggestions from users.

## Current State

- **Works:** the whole app — window + menu, tabs, Typora-style editor
  (preview / split / raw), file open + folder tree, save with the
  changed-on-disk guard, session memory across restarts, HTML + PDF export,
  auto-update scaffolding, settings + theme
- **Verified:** `npm run typecheck` clean; `npm test` 29/29 green; `npm run
  build` green; live `npx electron .` boot with clean logs and a real
  `session.json` round-trip (2026-09-24)
- **2026-09-24:** UI restyled to the Typora-simple look — **black default**, no
  header, single bottom status bar (theme + update + view mode), no DevTools —
  `.md` file association added (`fileAssociations` + command-line open), and
  repo pushed **public** (`github.com/BKHornYT/tizomd`) — see Key Decisions
  and changes.md
- **2026-09-24:** **v0.1.0 released** — tag-driven CI built + published the
  Windows NSIS installer + zip and the Linux AppImage with both update feeds
  (`latest.yml`, `latest-linux.yml`); auto-update has a real target
- **2026-09-24:** **v0.1.1 released and auto-update PROVEN live** — update.ts
  hardened (file logger to `<logs>/update.log`, offline-safe check, later
  `disableDifferentialDownload`), a local 0.1.0 install was launched and its
  log shows found → downloaded → auto-installed on quit; installed exe now
  reports 0.1.1.0. This PC now runs the released build.
- **2026-09-24:** **v0.1.2 released** — frameless custom chrome (no OS frame;
  slim 34px TitleBar = drag region + M mark + custom min/max/close; native
  menu bar hidden, accelerators kept) and the split view fixed to a real
  side-by-side with a draggable divider. Installed app auto-updates to it.
- **In progress:** hands-on user testing on the installed v0.1.2 — the feel
  of the frameless window and the split divider; any rough edges the code
  pass cannot see; then the next rounds from GitHub suggestions.
- **Known broken / not started:** macOS unbuilt; unsigned Windows installers
  (SmartScreen warning); nothing user-tested beyond smoke boots

## Stack (implemented)

- **Electron + React + Tailwind** — same proven shape as Video Downloader Tizo
  (main process in Node 24)
- **electron-builder** — Windows: NSIS installer + zip. Linux: AppImage only
  (same decision as the downloader — AppImage is the only format
  electron-updater can self-update). No portable exe: one less code path,
  updater enabled everywhere
- **electron-updater** → GitHub Releases (`BKHornYT/tizomd`)
- **markdown-it** + **highlight.js** for rendering and code fences, with
  DOMPurify sanitizing the output — decided, not "at build time"
- **PDF export** via Electron's `webContents.printToPDF` — no extra dependency
- Hosted on GitHub Pages or plain GitHub release assets — no server anywhere

## How To Run

**Commands** (Node 24, Windows PowerShell — matches Video Downloader Tizo):

| Command | Does |
| --- | --- |
| `npm install` | Install deps (electron binary downloads on first install) |
| `npm run icon` | Draw build icons → `build/iconsrc/*.png` + `build/icon.ico` |
| `npm run dev` | electron-vite dev server + live Electron window (open DevTools) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | typecheck + the 3 unit suites (see scripts/) |
| `npm run build` | bundle to `out/` (electron-vite) |
| `npm run dist` | package Windows (NSIS + zip) — needs GitHub token for publish |
| `npm run dist:linux` | package Linux AppImage (on a Linux host / CI) |

**Release:** tag `v0.1.0` and push — GitHub Actions checks the tag matches
`package.json`, runs `npm test` + `build`, publishes Windows then Linux to the
GitHub release (never a draft). In dev, settings/session live in
`%APPDATA%\tizomd\` and auto-update reports "dev build".

## Feature Scope — decided

In scope for v1 ("simple and good"):

- Open a `.md` file, edit it — **Typora-style editing**: clean rendered preview
  by default; click a line/block and it falls back to the raw markdown for easy
  editing; whole-pane Preview ↔ Raw toggle, plus split view
- Multiple open files as tabs
- Folder open + file tree sidebar (a whole folder of markdown, browse + switch)
- Export to HTML and PDF
- **Registered as a .md file handler** on Windows + Linux (double-click a
  markdown file and it opens here; settable as the default app for markdown)
- Dark (black) default, light mode available
- **Session memory:** remembers open files, cursor position and unsaved content
  across restarts — but done *right*. Notepad-style data loss is the enemy: the
  app must never lose or overwrite what you typed (design note in Key Decisions)
- **File-changed-on-disk guard:** before every save, check whether the file
  changed on disk behind our back; if it did, reload it automatically and never
  silently overwrite the newer version — the user's unsaved edits live in the
  recovery buffer, so nothing is lost
- **Auto-update built in** (electron-updater, checked at launch + on a timer,
  same as the downloader) — so a fix we ship actually reaches users instead of
  them sitting on an old build forever. See Key Decisions and Gotchas.
- A real logo and a finished, official-app look — Typora-clean, not the
  downloader's navy chrome (see the 2026-09-24 visual decision)

Out of scope for v1 (deliberately):

- No web version, no cloud, no accounts, no telemetry
- No RTL/i18n at launch (English only)
- Everything else lives as GitHub suggestions from users and gets "built out
  later"

## Licensing — custom Tizo license

Free to use, but not steal. Source is public on GitHub for anyone to view, use
and host themselves, under a **custom source-available license**. What it
prohibits:

- Commercial redistribution or selling the app/code
- Rebranding and re-releasing as someone else's product (the Tizo/EFM identity
  stays attached)
- Redistributing modified forks publicly without permission

What it allows:

- Downloading and using the app for anything personal or internal
- Reading the source
- Self-hosting by you, the owner
- Opening issues/PRs (see Rules below)

The license text gets written as a `LICENSE` file at build time. It is
enforced by the terms, not by any technical lock.

## File Structure

```
TizoMD/
├─ src/
│  ├─ shared/            types.ts (every cross-process contract),
│  │                     markdown.ts (renderMarkdown html:false + hljs,
│  │                     splitBlocks/replaceLines Typora block model)
│  ├─ main/              index.ts (window, single-instance), ipc.ts (all
│  │                     channels), menu.ts, files.ts (disk guard + walkTree,
│  │                     pure node — unit-tested in plain Node), export.ts
│  │                     (html + pdf via hidden-window printToPDF), update.ts
│  │                     (electron-updater, 3h timer),
│  │  └─ store/          session.ts (session.json, debounce, clean flag),
│  │                     settings.ts (validated field-by-field)
│  ├─ preload/           index.ts (window.tizomd bridge — the whole renderer
│  │                     API surface, contextBridge)
│  └─ renderer/src/      App.tsx (tabs, session restore, save-guard wiring,
│                        recovery notices, update banners), strings.ts (ALL
│                        user-visible copy), components/ (Icon, FileTree,
│                        TabBar), views/SettingsView.tsx, editor/EditorPane.tsx
│                        (Typora block editing), index.css (theme vars, md-body,
│                        hljs colors), env.d.ts (window.tizomd typing)
├─ scripts/              build-icon.mjs (PNG-in-ICO mark generator, pure Node),
│  │                     electron-stub*.mjs (test-time `electron` fake keyed
│  │                     on TIZO_TEST_DATA_DIR), test-blocks.ts, test-session.ts,
│  │                     test-guard.ts (run the real src/ under plain Node)
├─ build/                iconsrc/icon-{16..256}.png (Linux icon), icon.ico (Windows)
├─ .github/workflows/    release.yml (tag-driven, windows→linux)
├─ electron-builder.yml  NSIS + zip (win), AppImage only (linux), publish github
└─ package.json, tsconfig.json, electron.vite.config.ts, .gitignore, LICENSE
```

## Key Decisions

Decisions worth not re-litigating, and why. Newest first.

- **2026-09-23 — Custom Tizo license, not MIT/GPL.** User decided "free to use
  but not steal." MIT lets anyone rebrand and sell it; GPL forces open-source
  reciprocity but the user wants the freedom to keep it closed if ever needed,
  without the "steal" option. Source-available + terms is the fit.
- **2026-09-23 — Electron + React + Tailwind, not Tauri, not a web app.** The
  user wants a real installable app with a logo. Electron matches the proven
  Video Downloader Tizo stack — reuse the pipeline, the update story
  (electron-updater), and every gotcha already learned. Tauri would mean Rust,
  which isn't installed.
- **2026-09-23 — Windows + Linux at v1, both shipped by GitHub Actions on a
  tag.** Same split as the downloader: NSIS + zip on Windows, AppImage on Linux.
  macOS unbuilt; nothing in the stack blocks it later.
- **2026-09-23 — Product name TizoMD, repo `BKHornYT/tizomd`.** Official name
  "TizoMD" (not "Tizo Markdown"), matching the "X Y" Tizo family style used by
  Video Downloader Tizo. The repo name is set before first release so the
  auto-update path never has to move.
- **2026-09-23 — Session memory is a first-class feature with a hard rule: never
  lose user content.** The Windows 11 Notepad rewrite is the anti-model — it
  crashed on unsaved edits and restored blank windows. Rules for TizoMD: restore
  open tabs + cursor per file + unsaved buffer state; on every edit, buffer
  changes persist as-you-type to a recovery file; a crash on reopen prompts to
  restore the recovery copy, never silently merges or drops. (Detailed design
  happens at build time — this is the contract.)
- **2026-09-23 — Auto-update is a core feature, not an afterthought.** Same as
  the downloader: electron-updater checks GitHub Releases at launch and on a
  timer (2–4 h), so a shipped fix reaches real installs. No portable exe exists,
  so the updater is on for every build — but the Linux AppImage must not
  pretend to be portable: `APPIMAGE` handling must match the downloader exactly,
  or self-update silently dies for that platform. Reason for the emphasis: a
  release pipeline whose latest.yml is missing, whose release is left as draft,
  or whose tag/version disagree produces an app that "works" and quietly never
  updates — the exact failure the downloader already hit and solved. See Gotchas.
- **2026-09-23 — Edits happen in the rendered view, Typora-style.** The default
  view is the clean, formatted document. Click a line or block and it falls back
  to the raw markdown for that part so you can type; a whole-pane Preview ↔ Raw
  toggle and a split view are always available. Formatted-by-default is the
  point, so the "raw" path starts on interaction, not as the resting state.
- **2026-09-23 — No portable exe.** One less code path and updater is enabled
  everywhere — nothing to be silently-one-behind because a build can't self-
  update. Windows ships installer + zip, Linux AppImage.
- **2026-09-23 — Before every save, re-check the file on disk.** If it changed
  behind our back, reload the newer disk version instead of overwriting it, and
  keep the user's unsaved edits in the recovery buffer so nothing is lost.
  Silently clobbering a file someone else edited is the same class of data loss
  as the Notepad crashes.
- **2026-09-23 — markdown-it + highlight.js + DOMPurify, locked.** `.md` files
  may contain raw HTML; render with `html:false` and run the output through
  DOMPurify before it reaches the DOM. A malicious readme is a real attack.
- **2026-09-24 — Visual language: Typora-simple, not downloader-chrome.** The
  user rejected the navy/purple "official Tizo app" look: "make it simple like
  typora or whatever." So the chrome disappears — **black default** (dark is
  true `#000000`, light is the opt-in paper mode), **no OS window frame at
  all** (`frame: false`; a slim 34px `TitleBar` owns the whole top row: drag
  region, M mark + wordmark, custom min/max/close — the native menu bar is
  hidden, its accelerators kept), no content header (wordmark, theme toggle,
  update check and view-mode switcher all live in the thin bottom status bar;
  file actions live in the native menu, including Settings… Ctrl+,), flat tab
  strip with an accent underline, centered 46-rem preview column. One Tizo
  touch left: the gradient M mark in the empty/About spots.
- **2026-09-24 — No DevTools surfaces.** The detached auto-open in dev and the
  View-menu `toggleDevTools` role are removed — a user shortcut must never pop
  the inspector. (Re-enable locally if ever needed; it is a one-line diff.)
- **2026-09-24 — `.md` is a registered file association.** `fileAssociations`
  (ext md, Editor role) makes TizoMD a "default app" choice for markdown on
  Windows and Linux. Launch-argv files are queued by main and pulled by the
  renderer on mount (`files:takeOpenPaths`); a double-click while already
  running lands through the single-instance handler as a `file:open-paths`
  push. `.markdown` opens too, but only `.md` is registered.
- **2026-09-24 — Repo `BKHornYT/tizomd` pushed public, before v1.** The name
  and URL were locked early so the auto-update path never moves; the user then
  chose "just make it public" (and electron-updater needs a public feed anyway),
  so the repo went public with the first push. The source-available LICENSE
  ships with the code; nothing else about the release plan changes.
- **2026-09-23 — No server, no telemetry, no web build.** The app is a pure
  local tool. GitHub is only where the code lives and releases are published.
  Anything needing a backend is a feature GitHub users can suggest later.
- **2026-09-23 — Simple and good > featureful.** v1 is deliberately small and
  the polish budget goes into absence of bugs and the Notepad-level finish, not
  into features. Extra ideas are gathered as GitHub issues.

## Gotchas

Learnings carried over from Video Downloader Tizo that apply here:

- `electron-builder` does not bundle — it only packages `out/`; a `npm run build`
  must happen first
- electron-builder publishes a DRAFT release by default, invisible to the
  updater — the `GH_TOKEN` release flow must flip it
- A release without `latest.yml` breaks auto-update silently (and `latest-linux.yml`
  for Linux)
- The tag and `package.json` version must agree
- An AppImage must not be treated as portable — `isPortable()` is what disables
  the updater; adding `APPIMAGE` to it silently turns self-update off for Linux
- Unsigned Windows builds show a SmartScreen warning until a certificate exists —
  accepted for the downloader, same acceptance here
- Single-instance lock is worth doing from the start (the downloader does it)
- `.md` files can contain raw HTML — render with `html:false` and DOMPurify the
  output, or a malicious readme runs script in the app

Full list grows in a `docs/gotchas.md` once coding starts.

## Deploy / Where It Lives

- GitHub repo `BKHornYT/tizomd` — **public since 2026-09-24** (electron-updater
  needs a public release feed; user chose "just make it public")
- Releases carry the Windows NSIS installer, zip, and the Linux AppImage
- GitHub Actions builds on `windows-latest` + `ubuntu-latest` and publishes on
  tag push (template on the downloader's `release.yml`)
- No server, no domain, no deploy target today.

## Rules

**Keep the docs current — always.**
- Update this `CLAUDE.md` whenever purpose, stack, structure, or a key decision
  changes. A future session should be able to resume from this file alone.
- Update `task.md` while working — what's active, what's next, what's blocked.
- Update `changes.md` after every change — what changed and why. Not at the end
  of the session; right after the change.

**Keep this file under 50 KB.**
It is loaded into context at the start of every session, so a bloated
`CLAUDE.md` costs something on every single run. When it starts getting long,
don't trim detail out of existence — move it. Split the deep material into its
own `.md` file and leave a one-line pointer here.

**Organize freely.**
You are always free to create extra `.md` files and to sort files into folders
when it makes the project easier to work in — `docs/`, `notes/`, `src/`,
`scripts/`, whatever fits. Do it as soon as the flat layout starts hurting,
not after. Just record the new layout in the File Structure section above so the
map stays true.

**GitHub suggestions are a real channel.** Users propose features as issues; the
v1 scope is fixed, everything else builds out from there.