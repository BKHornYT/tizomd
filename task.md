# Tasks — TizoMD

## Now

**Chrome + split overhaul done, unverified by eye:** frameless window with a
custom 34px titlebar (M + wordmark, drag region, min/max/close — native menu
bar hidden, accelerators kept) and the split view is now a real side-by-side
with a draggable divider. Code is green (typecheck, 29/29, build, dev boot
with a .md arg). Not yet released — the owner runs v0.1.1.

## Next

- [ ] **Owner: run the latest code** and feel the frameless window + split
      divider before this gets tagged/released — "remove the electron vibe"
      verdict needs a pair of eyes on the result
- [ ] Tag the chrome + split work as v0.1.2 once verified (same bump→tag→CI
      flow; installed v0.1.1 will auto-update — the updater is proven)
- [ ] **User testing on Windows** — .md association (double-click opens here),
      block editor on real docs, exports, theme toggle, Ctrl+N/O/S/Ctrl+,
      session restore, save guard — report what feels wrong
- [ ] Ready for consideration: persist the split ratio in session memory per
      tab (currently in-memory only, resets to 50% on reopen)
- [ ] macOS not built (out of scope); nothing in the stack blocks it later
- [ ] `docs/gotchas.md`: move the Gotchas section out of `CLAUDE.md` once
      coding deepens

## Blocked

_Nothing blocked._ `npm run dist` / `dist:linux` are not run locally — the tag
release is the real dist; CI does it and publishes.

## Done

<details><summary>Completed tasks</summary>

- [x] 2026-09-24 — Typora-style restyle: neutral light-default theme, slim
      header (wordmark + theme only), flat tab strip, centered preview page,
      EditorPane status bar, Settings… menu item (Ctrl+,), FileTree/Settings
      quieted; typecheck + 29/29 + build + boot re-verified
- [x] 2026-09-24 — Repo pushed public: git init (main), .gitattributes, merged
      the GitHub README, `gh repo edit` → Public (enables auto-update feeds)
- [x] 2026-09-24 — Chrome + split overhaul: frameless window (custom titlebar,
      hidden native menu, window-control IPC), split view fixed to real
      side-by-side with a draggable divider (20–80% clamp)
- [x] 2026-09-24 — v0.1.1: auto-update audit + hardening (file logger to
      `<logs>/update.log`, `.catch` on feed check), feed verified
      (app-update.yml embedded, latest.yml live), release tagged + pushed
- [x] 2026-09-24 — Feedback fixes: black default theme (true-black palette,
      window bg follows saved theme), header removed (all affordances in one
      bottom status bar), DevTools auto-open + menu role removed, `.md` file
      association (fileAssociations + argv open + second-instance push)
- [x] 2026-09-24 — v0.1.0 released: version bump, tag `v0.1.0`, CI published
      Windows NSIS + zip and Linux AppImage with both update feeds; not a draft
- [x] 2026-09-23 — Project created
- [x] 2026-09-23 — Planning: form (Electron app), features, license (custom
      Tizo), platforms (Windows + Linux), repo name, update system
- [x] 2026-09-23 — Plan refined: Typora-style editing UX, no portable exe,
      file-changed-on-disk guard, markdown-it + DOMPurify locked, repo
      `BKHornYT/tizomd` created (private now → public at v1)
- [x] 2026-09-24 — Scaffold: package.json, tsconfig, electron.vite.config,
      LICENSE (custom Tizo), build icons (PNG-in-ICO generator), electron
      test stubs, electron-builder.yml, GitHub Actions release.yml
- [x] 2026-09-24 — Shared layer: `types.ts` (FileStat/DiskState/SaveFileResult/
      SessionData/Settings/UpdateState/MenuAction) and `markdown.ts`
      (renderMarkdown with `html:false` + highlight.js, `splitBlocks`
      outermost-block model, `replaceLines` inverse)
- [x] 2026-09-24 — Main process: app/window/single-instance, application menu,
      full IPC surface (files, folders, session, settings, export, updates),
      `saveTextFile` disk guard, `walkTree` folder tree, HTML + PDF export
      (hidden-window printToPDF), electron-updater init
- [x] 2026-09-24 — Session store (`session.json`, debounced writes, clean
      flag) + settings store (validated field-by-field) + test stubs
- [x] 2026-09-24 — Preload bridge (`window.tizomd`) with the full renderer API
- [x] 2026-09-24 — Renderer: Tailwind-v4 theme (dark navy default + light),
      App shell with session restore + recovery notices + save guard wiring +
      auto-update banner, FileTree, TabBar, SettingsView, EditorPane (Typora
      block editing, split/raw modes, notice banners)
- [x] 2026-09-24 — Tests: `test-blocks` (split/replace round-trip), `test-session`
      (persist/reload via electron stub), `test-guard` (no-clobber disk guard);
      all green under `npm test` (typecheck + 29 checks)
- [x] 2026-09-24 — Verified: `npm run build` green, live `npx electron .` boot
      with clean logs, session.json round-trip written from the running app

</details>