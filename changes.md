# Changes — TizoMD

Newest first. One entry per change, using this format:

```
## YYYY-MM-DD — Short title
**What:** what actually changed
**Why:** the reason it changed
**Files:** the files touched
```

---

## 2026-09-24 — v0.1.6: editor polish round — find, divider memory, local images (OpenCode · big-pickle)
**What:** three editor improvements, shipped as v0.1.6.
(1) **Find in preview/split (Ctrl+F).** A slim search bar (top-right of the
pane) with case-insensitive highlight marks written into the preview DOM,
Enter/Shift+Enter (or arrows) to jump forward/back with the active match
scrolled to centre, an `n/m` counter, and Esc/× to close (which unwraps the
marks and leaves the document exactly as it was). Marks are re-applied on
every deferred preview rebuild and skip an in-progress block editor, so find
coexists with Typora-style editing; opening the bar commits any open block the
same way clicking away does. Ctrl+F is a menu accelerator (`edit:find`), so it
works from anywhere and can't double-fire against a DOM listener; in raw mode
it just focuses the source editor (no preview to mark). Real limitations: a
match split across an element boundary (`**bold**` around the needle) is not
found — same behaviour as find-in-page, and the source stays the ground truth.
(2) **Split divider position is remembered per tab.** The ratio only existed
in-memory and reset to 50% on reopen; now the drag end reports into the tab
and the session (`buffer.splitPercent`, additive — old sessions default to
50), so `preview`↔`split` toggles and restarts restore the layout you left.
(3) **Local images now render.** `.md` files point at sibling images with
relative paths and the preview had no idea what folder the document was in, so
`![alt](img/x.png)` gave a broken image. `absolutizeImageSrc` (pure, in
shared/markdown.ts) roots relative/absolute file paths against the document's
folder into a `file://` URL (Windows drive letters + posix, `..` climbing,
`.`/empty segments, space/hash/`?` escaping) and passes `http(s)`/`data`/
`file`/`blob`/protocol-relative through untouched; anything else
(`javascript:`…) is dropped. Documented limitation: images render under the
packaged app but typically show broken in `electron-vite dev` (dev-server
origin blocks `file:` subresources by web security).
**Why:** the queued next round after the owner approved the block-editing
feel — find was the most-used missing piece, and the other two are "everything
where you left it" promises plus a real rendering gap.
**Files:** `src/shared/markdown.ts`, `src/renderer/src/editor/EditorPane.tsx`,
`src/renderer/src/App.tsx`, `src/shared/types.ts`, `src/main/menu.ts`,
`src/renderer/src/strings.ts`, `src/renderer/src/index.css`, new
`scripts/test-editor.ts` (27 tests for find ranges + image resolution),
`package.json`
**Verified:** typecheck clean, 56/56 tests green (17 blocks + 27 editor + 5
session + 7 guard), build green. Released as v0.1.6 from the Zima (git + gh);
CI publishes and the installed app self-updates.

## 2026-09-24 — v0.1.5: block editor always returns to format (OpenCode · big-pickle)
**What:** the v0.1.4 hop looked right but had two real holes from the deferred
render design, both found by the owner's feel check ("you did not really fix
it"):
(1) **Clicking off without typing left the original block stuck as a bare
textarea.** The blur commits, but a commit that changes nothing triggers no
re-render, so nothing cleared the overlay — only a *typed* commit was reset by
the deferred preview rebuild. Now each block's formatted HTML is captured when
its editor opens (`savedBlockHtmlRef`) and **always** restored on exit
(`restoreBlock`): unchanged commits and Escape replace the node with the saved
markup; commits that DID change the text restore a fresh render of the new text
(`renderBlockHtml`) so no stale copy flashes before the preview catches up. The
"original line goes back to format" contract is now unconditional.
(2) **The block you hop to gets wiped a beat later.** The deferred preview
rebuild replaces `innerHTML` wholesale ~one beat after the last commit's text
lands, destroying the freshly opened editor. `renderPreview` now re-attaches
the active overlay against the fresh nodes (`applyOverlayRef`) after rebuilding,
so an editor survives its own re-render with its value preserved (`editingValue`).
Also: overlay listeners now go through refs (`commitBlockRef`/`cancelBlockRef`)
so a long-lived textarea never acts on a stale commit/cancel closure, and Escape
nulls the textarea ref before the outerHTML restore so removing the focused
textarea can't re-fire a blur-commit and turn Cancel into Commit.
**Why:** the owner's direct report; the v0.1.4 hop half-worked and this makes the
commit+format+hop contract actually hold in every path.
**Files:** `src/renderer/src/editor/EditorPane.tsx`
**Verified:** typecheck clean, 29/29 tests green, build green. Released as
**v0.1.5** (bump + tag via the Zima's own `gh` login), CI publishes, installed
app self-updates.

## 2026-09-24 — v0.1.4 released (OpenCode · big-pickle)
**What:** released the block-hopping round (below) as **v0.1.4**. Version
bumped `0.1.3 → 0.1.4` in `package.json` + `package-lock.json`; tag `v0.1.4`
pushed from the PC (Zima copy has no GitHub creds) — CI publishes the Windows
NSIS + zip and the Linux AppImage with both update feeds; the installed app
self-updates to it.
**Why:** owner approved the smoother block-to-block editing and asked to publish
through the PC.
**Files:** `package.json`, `package-lock.json`, `CLAUDE.md`, `changes.md`,
`task.md` (code itself is the round below)

## 2026-09-24 — Block-to-block editing hops in one click (OpenCode · big-pickle)
**What:** Clicking another line while a block editor is open now commits the
current line *and* opens the clicked line in the same click — the edit doesn't
just stop, it moves. Previously the hop only worked when the textarea's blur
happened to commit and re-render before the click (React re-renders between
the two events), otherwise the click landed with `editingIndex` still set and
only committed/closed. `handlePreviewClick` now commits first (a guarded no-op
if blur already did, so the double-commit corruption fix stays intact) and then
`openBlock(clickedIndex)` — the open effect resolves the index against the
freshest blocks on the next render, so a commit that shifted block counts still
lands on a real block. Clicking whitespace still just commits and stops.
**Why:** owner feel-report — "if i click out of the line to another line, the
original line should go back to format. so it is more smooth." The commit +
format part already worked; the missing smoothness was the second click needed
to start editing the next block.
**Files:** `src/renderer/src/editor/EditorPane.tsx`
**Verified:** typecheck clean; 29/29 unit tests green (run via `npx -y
node@24` — this Zima's system Node 22 is a build without TS type-stripping, so
`npm test`'s `--experimental-strip-types` can't run here); `npm run build`
green.

## 2026-09-24 — v0.1.3 released (OpenCode · big-pickle)
**What:** released the fixes + smoothness round above as **v0.1.3** (code
already in `491a839`; this commit is the bump + docs). Tag pushed; CI
publishes; the installed app updates to it in-app.
**Why:** owner approval after feeling the round.
**Files:** `package.json`, `package-lock.json`, `CLAUDE.md`, `changes.md`,
`task.md`

## 2026-09-24 — Preview re-render fix + click-to-edit stop + smoothness pass (OpenCode · big-pickle)
**What:** (1) **Preview no longer comes back blank** after switching to
raw/split and back. Root cause: the preview div unmounts on every mode switch
(it lives at different tree positions in preview vs split) and remounts blank,
but the render effect only depended on `[renderPreview, tab.scroll]` — no dep
changed on return, so the fresh empty node was never filled. It now renders
when the node is fresh (`childElementCount === 0`) or the text changed, and
restores scroll on a fresh mount only. (2) **Reading no longer rebuilds the
document**: `tab.scroll` was an effect dep, so every wheel tick re-ran
`innerHTML` — wasted work while reading, and an in-progress block edit was
destroyed by a scroll. (3) **Click-to-edit fixed + smoothed**: committing was
not idempotent — a blur *and* the click handler each ran `commitBlock()` with
the same index, so clicking off could replace a *second* block with the edit
content (the "clicked a line, it did something weird" report). commit is now
guarded (clears its ref on entry). Clicking off a line — another block,
whitespace, anywhere — now commits and stops editing (blur already commits;
the handler is the guarded no-op / same-block caret move). The editing
textarea is measured to the block's rendered height and auto-grows on input,
so entering/leaving edit mode doesn't jump the layout. (4) **Perf**: preview
text renders via `useDeferredValue` (split-mode typing stays 60 fps, markdown
renders in idle time); scroll → parent is throttled to one rAF per frame with
a flush on unmount; the renderer debounces the session `save` IPC (250 ms) on
top of the main-side write debounce, so scroll/cursor events no longer send a
serialized document across IPC per tick; `splitBlocks` is gated to preview/split
(raw mode was splitting the doc on every keystroke for nothing).
**Why:** user report: "normal view breaks after being on the other views and
going back. and optimize the app as much as possible. we need it to be a
smooth experience" — plus "if i click off the line it should stop editing that
line" from live feel on the block editor.
**Files:** `src/renderer/src/editor/EditorPane.tsx`, `src/renderer/src/App.tsx`
**Verified:** typecheck, 29/29 tests, build, dev boot with `tizomd-smoke.md`
(opens, becomes active, session round-trips `clean:true`).
**Note (not a regression):** during verification the dev instance
(`electron .` from `out/`) intermittently closed its window gracefully after
~10–32 s on this box — reproduced with *both* the v0.1.2 code and this round
via a git-stash A/B. No coded path closes the window in dev (updater is
`isPackaged`-gated, no `app.quit` outside single-instance/window-all-closed),
`clean:true` means a normal close. Most plausibly collisions on this live
launcher box; watched but not chased further.

## 2026-09-24 — v0.1.2 released: frameless chrome + real split (OpenCode · big-pickle)
**What:** Released the framed-next round as **v0.1.2** — no code changes
beyond the bump (`0.1.1 → 0.1.2`); the release carries the work already
logged below (frameless window + custom titlebar, native menu bar hidden,
split view fixed to real side-by-side with a draggable divider). Tag
`v0.1.2` pushed; CI builds + publishes Windows NSIS + zip and the Linux
AppImage with both update feeds. The installed v0.1.1 on this PC updates to
it in-app (the updater is proven — it does the found → download → installed
loop and logs it to `%APPDATA%\tizomd\logs\update.log`). Also carries the
`disableDifferentialDownload` flag from the v0.1.1 round, so this fetch is a
clean full download.
**Why:** "published?" — the owner verified the chrome direction on main and
said "sure make sure to update md files"; docs kept in step (this file, plus
CLAUDE.md and task.md).
**Files:** `package.json`, `package-lock.json`, `CLAUDE.md`, `changes.md`,
`task.md` (code itself unchanged since 43822f2)

## 2026-09-24 — Frameless custom chrome + fixed split view (OpenCode · big-pickle)
**What:** (1) **Electron vibe removed.** The window is now `frame: false` — no
OS title bar / frame; a new `TitleBar` component draws the whole top row: drag
region, gradient M mark + TizoMD wordmark, and custom window controls
(minimize / maximize-restore toggle / close with the Win11 red hover). The
native menu bar is hidden (`setMenuBarVisibility`) but the menu stays alive —
its accelerators (Ctrl+S/O etc.) and Edit roles still work. New IPC
(`window:minimize|toggle-maximize|close|is-maximized` + `window:maximized`
state pushes) powers the titlebar; `windowControls` on the preload bridge;
`.app-drag` / `.app-no-drag` CSS utilities; `minus`/`square`/`restore` icons.
Main pushes the maximized state to the renderer on load and on change so the
button swaps icon. (2) **Split view actually splits.** It was `preview` with
`w-full max-w-[46rem] mx-auto` as a flex sibling — its 100% basis crushed the
raw pane, so it was never really side-by-side. Now each pane is a sized flex
item (`raw` at a percentage width, `preview` filling the rest at its own
width) and a **draggable divider** between them (pointer-capture based,
20–80% clamp, col-resize cursor, highlight on hover/drag). Verified:
typecheck, 29/29 tests, build, and a dev boot with a `.md` arg — clean stderr,
session shows the file was opened.
**Why:** "remove the electron vibe. idk it makes it feel less worthy" +
"the split view is not split, but also should be movable" — confirmed the
directions with the owner first (full custom chrome, slim titlebar, draggable
divider).
**Files:** `src/main/index.ts`, `src/main/ipc.ts`, `src/preload/index.ts`,
`src/renderer/src/components/{Icon,TitleBar}.tsx`,
`src/renderer/src/editor/EditorPane.tsx`, `src/renderer/src/App.tsx`,
`src/renderer/src/index.css`

## 2026-09-24 — v0.1.1: updater hardened + released (OpenCode · big-pickle)
**What:** Pre-release auto-update audit found two real defects in
`src/main/update.ts` and fixed both, then released as v0.1.1. (1)
`autoUpdater.logger = null` meant any future update failure was invisible and
undiagnosable — replaced with a real file logger writing to
`<logs>/update.log` (packaged builds only), so a silent failure on a user's
machine is readable rather than a mystery. (2) The bare `void
autoUpdater.checkForUpdates()` promise could reject (feed unreachable, e.g.
app launched offline) and Node's default turns an unhandled rejection into a
process crash — now `.catch()`ed, network cold starts are safe. Lifecycle
lines are logged too (available → downloading → downloaded → ready), so an
update's whole path leaves a trace. Also verified the feed end-to-end before
publishing: the packaged NSIS build embeds a correct `app-update.yml`
(provider github, owner BKHornYT, repo tizomd; note a `dir` target never
produces that file — only real release targets do), and the v0.1.0 release's
`latest.yml` is well-formed (version, sha512, size, path, releaseDate).
Results: 29/29 tests + build green, version bumped 0.1.0 → 0.1.1, tag
`v0.1.1` pushed, CI publishes Windows NSIS + zip and Linux AppImage. **Proof
completed live:** a local 0.1.0 install (with the new logging) was silently
installed to this PC, launched, and its `update.log` shows the full flow —
updater ready v0.1.0 → Found version 0.1.1 → downloading → downloaded to
`%LOCALAPPDATA%\tizomd-updater\pending` → ready → on close it ran
`tizomd-0.1.1-setup.exe --updated,/S` and the installed exe now reports
**0.1.1.0**. One flake recorded: the differential pull (1.5 MB) sha-mismatched
and electron-updater fell back to the full download gracefully, so
`disableDifferentialDownload = true` is set — updates always take the full
installer now. The installed app also gained `.md` association and the black
default from the code round.
**Why:** "make a new release but first MAKE SURE AUTO UPDATE WORKS" — nothing
had ever prompted an update because no release build was installed; the
mechanism had to be proven, not assumed. Considered the differential mismatch —
a graceful, logged fallback — but the flag removes the flakiness entirely.
**Files:** `src/main/update.ts`, `package.json`, `package-lock.json`

## 2026-09-24 — Black default, headerless UI, no DevTools, .md file association (OpenCode · big-pickle)
**What:** Four adjustments from the user's first-use notes and requests.
(1) **Black is the default theme again** — `DEFAULT_SETTINGS.theme` back to
`dark`, the dark palette is true black (`#000000`) with near-black surfaces,
and bare `:root` in `index.css` is dark (light is opt-in via `:root.light`);
`main/index.ts` reads the saved theme for the window `backgroundColor` so a
booted-dark app never flashes white. (2) **Less chrome** — the header row is
gone entirely; theme toggle, update indicator and the view-mode switcher moved
into a single bottom app-level `StatusBar` (saved/modified + click hint on the
left, empty state shows the wordmark), tabs got thinner with no active fill,
FileTree lost its bordered "FILES" label. (3) **DevTools removed** — the
detached auto-open in dev and the View-menu `toggleDevTools` role are gone, so
no inspect-element/shortcut pops up. (4) **`.md` file association** — new
`fileAssociations` in `electron-builder.yml` (ext md, role Editor) registers
TizoMD as a default-app option on Windows and sets the MimeType on Linux.
Main queues launch-argv markdown files (`queueOpenPaths`) which the renderer
drains on mount via `files:takeOpenPaths`, and a second-instance launch
(double-click while running) is pushed through `file:open-paths`. Verified:
typecheck, 29/29 tests, build, clean boot with a `.md` on the command line,
`dist:dir` packages.
**Why:** "blackmode for default", "make it less chromey", "no inspect element
page", "make it so it can be used as a default app for .md files".
**Files:** `src/main/{index,ipc,menu,store/settings}.ts`, `src/preload/index.ts`,
`src/shared/types.ts` (unchanged), `src/renderer/src/{App,index.css,strings}.tsx`
`.../App.tsx`, `.../index.css`, `.../components/TabBar.tsx`,
`.../components/FileTree.tsx`, `.../editor/EditorPane.tsx`,
`.../views/SettingsView.tsx`, `electron-builder.yml`

## 2026-09-24 — First release v0.1.0 published (OpenCode · big-pickle)
**What:** Bumped version 0.0.1 → 0.1.0 in `package.json` + `package-lock.json`,
committed, and pushed tag `v0.1.0`. The tag-driven Release workflow ran green:
Windows (typecheck + tests + build + electron-builder publish) then serialized
Linux; both jobs passed. The release is **published (not a draft)** with the
full asset set: `tizomd-0.1.0-setup.exe` (+ blockmap), `tizomd-0.1.0-x64.zip`,
`tizomd-0.1.0-x86_64.AppImage`, and **both update feeds** — `latest.yml`
(Windows) and `latest-linux.yml` (Linux) — so auto-update now has a real
target. Known CI noise: Node 20 deprecation warning on the checkout/setup-node
actions (forced to Node 24, harmless).
**Why:** User: "i guess make a release then?" — the first public build, and the
moment auto-update becomes real (a locally installed 0.0.1 build can now see
and update to 0.1.0). Proven end-to-end: tag ≡ version guard passed on CI.
**Files:** `package.json`, `package-lock.json`, tag `v0.1.0`

## 2026-09-24 — Typora-style UI restyle + repo pushed public (OpenCode · big-pickle)
**What:** User: "make it simple like typora or whatever, it does not need to look
like the video downloader." Replaced the navy-chrome/purple-accent theme with a
neutral, paper-first look — light is now the default theme (Typora-reference),
dark is a soft night gray. Chrome is near-invisible: slim 36px header holding
only wordmark + theme toggle (file actions moved into the native menu; new
**Settings…** item, Ctrl+, — `MenuAction 'settings'` added), flat tab strip with
an accent underline on the active tab (gradient dot colors dropped), FileTree
narrowed and quieted, EditorPane lost its whole toolbar row — preview is a
centered 46-rem paper column with a thin bottom status bar (Saved/Modified +
click hint; view-mode icons on the right). SettingsView + Segmented neutralized.
Window background white. Re-verified: typecheck, 29/29 tests, build, live
electron boot clean. Then pushed the repo public to `github.com/BKHornYT/tizomd`
(git init main, .gitattributes for LF, local identity, merged the user's GitHub
README via --allow-unrelated-histories, `gh repo edit` visibility public —
needed for electron-updater to read release feeds).
**Files:** `src/renderer/src/index.css`, `App.tsx`, `editor/EditorPane.tsx`,
`components/TabBar.tsx`, `components/FileTree.tsx`, `views/SettingsView.tsx`,
`strings.ts`, `src/main/menu.ts`, `src/main/index.ts`,
`src/main/store/settings.ts`, `src/shared/types.ts`, `.gitattributes`, `README.md`

## 2026-09-24 — Full scaffold: every layer written, tests + build + boot green (OpenCode · big-pickle)
**What:** Wrote the entire TizoMD codebase from the locked plan, then verified
it end to end. Config: `package.json` (tizomd/TizoMD 0.0.1, dep set mirroring
the downloader), `tsconfig.json`, `electron.vite.config.ts`, `.gitignore`,
`electron-builder.yml` (NSIS + zip on Windows, AppImage only on Linux — no
portable exe — publish to `BKHornYT/tizomd`), `.github/workflows/release.yml`
(tag-driven, tag≡package.json guard, windows then serialized linux, `--publish
always` so no draft-release trap). Shared: `types.ts` (all cross-process
contracts) and `markdown.ts` (renderMarkdown with `html:false` + highlight.js,
`splitBlocks` outermost-block model, `replaceLines` inverse). Main: app/window
with single-instance lock, dev icon from `build/icon.ico`, full application
menu (File/View/Edit/Help shipping `menu:action` to the renderer), the whole
IPC surface (files, folder tree, session, settings, export, updates),
`saveTextFile` disk guard in `files.ts`, `walkTree` folder browsing, HTML + PDF
export (PDF via hidden-window `printToPDF`), electron-updater at launch + 3h
timer. Stores: `session.json` with debounced writes and the `clean` flag,
validated `settings.json`. Preload: `window.tizomd` bridge. Renderer:
Tailwind-v4 theme (dark navy default + light, `md-body` typography, hljs
colors), App shell with session restore + recovery notices + save-guard wiring
+ update banners + About dialog, FileTree, TabBar, SettingsView, and the
Typora-style EditorPane (render→DOMPurify→ref innerHTML, click-aware
imperative textarea block editing, split/raw modes, Restore/Discard notice
bars). Icons: `scripts/build-icon.mjs` draws the navy rounded-square + white M
mark with a PNG-in-ICO encoder (7 sizes) into `build/iconsrc` + `build/icon.ico`.
Tests: `test-blocks` (split/replace round-trip), `test-session` (persistence
via an `electron` stub keyed on `TIZO_TEST_DATA_DIR` + `node --import` hooks),
`test-guard` (never-clobber disk guard) — all run real source. Verified:
`npm run typecheck` clean, `npm test` 29/29 green, `npm run build` green, and a
live `npx electron .` smoke boot with clean logs and a real `session.json`
written by the running app. Also fixed the type manifest along the way
(`ReadFileResult`/`SaveFileResult` as proper discriminated unions so the
renderer can narrow, `BrowserWindow` as a value import for export dialogs,
import-depth corrections in menu/update/editor paths, the dead `saveActiveAs`
call, unused imports).
**Why:** The plan was locked; this turns it into an app that boots and holds
state, with the dangerous parts (clipboard-of-data-loss session memory, the
no-clobber save guard, sanitized rendering, always-on auto-update) tested at
their seams before any eyes-on polish pass.
**Files:** package.json, tsconfig.json, electron.vite.config.ts, .gitignore,
LICENSE, electron-builder.yml, .github/workflows/release.yml, src/shared/*
(src/shared/types.ts, src/shared/markdown.ts), src/main/* (index.ts, ipc.ts,
menu.ts, files.ts, export.ts, update.ts, store/settings.ts, store/session.ts),
src/preload/index.ts, src/renderer/* (index.html, src/main.tsx, src/env.d.ts,
src/index.css, src/strings.ts, src/App.tsx, src/components/Icon.tsx,
src/components/FileTree.tsx, src/components/TabBar.tsx, src/views/SettingsView.tsx,
src/editor/EditorPane.tsx), scripts/* (build-icon.mjs, electron-stub.mjs,
electron-stub-hooks.mjs, electron-stub-register.mjs, test-blocks.ts,
test-session.ts, test-guard.ts), build/iconsrc/*, build/icon.ico, CLAUDE.md,
task.md, changes.md

## 2026-09-23 — Plan refined, repo created (OpenCode · big-pickle)
**What:** Locked Typora-style editing UX (clean rendered view by default, click a
block to edit its raw source, pane toggle + split view). Dropped the portable
exe — Windows ships NSIS + zip, Linux AppImage, updater on everywhere. Added the
file-changed-on-disk guard as a v1 feature (re-check before every save, reload
newer disk version, keep unsaved edits in the recovery buffer). Locked
markdown-it + highlight.js + DOMPurify (`html:false`). Created the GitHub repo
`BKHornYT/tizomd` (private now, public at v1). Updated `CLAUDE.md`, `task.md`.
**Why:** User decisions in the planning session; the repo is reserved before
first release so the auto-update path never has to move.
**Files:** CLAUDE.md, task.md

## 2026-09-23 — Planning locked (OpenCode · big-pickle)
**What:** Filled in `CLAUDE.md` with the full plan — what TizoMD is, the
decided stack (Electron + React + Tailwind), feature scope, the custom Tizo
license, Windows + Linux targets, TizoMD / `BKHornYT/tizomd` naming, and the
gotchas carried over from Video Downloader Tizo. Added the update system as a
core feature (electron-updater at launch + on a timer) so shipped fixes reach
real installs. Updated `task.md` with the plan backlog.
**Why:** This is a planning-only session; the docs are the deliverable so any
later session can build from a locked plan.
**Files:** CLAUDE.md, task.md

## 2026-09-23 — Project created
**What:** Scaffolded `CLAUDE.md`, `task.md`, and `changes.md`.
**Why:** New project created from the launcher.
**Files:** CLAUDE.md, task.md, changes.md
