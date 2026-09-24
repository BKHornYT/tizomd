# Tasks — TizoMD

## Now

Repo is **public** and pushed (`github.com/BKHornYT/tizomd`, main), UI restyled
to a Typora-simple look (2026-09-24): light paper default, slim header, flat
tabs, centered preview column, Save open export moved to the native menu
(Settings… = Ctrl+,). All green: typecheck, 29/29 tests, build, live boot.
Next is the first "feel it" pass: install `tizomd-0.0.1-setup.exe` (or
`npm run dist` / `npm run dev`) on real `.md` files, exercise the Typora block
editor, save-guard and session restore, then fix what that surfaces.

## Next

- [ ] **User testing on Windows** — install the NSIS build (build it with
      `npm run dist`), open a folder of real `.md` files, click blocks to edit,
      try Preview/Split/Raw, Save As, exports, theme toggle, Ctrl+N/O/S/Ctrl+,
      and tell the owner what feels wrong; expect UI polish fixes
- [ ] Verify session memory across a restart: dirty tab + crash (force-kill)
      → reopen offers recovery; normal close → no recovery prompt
- [ ] Verify the save guard against a real edit: open a file, change it in
      another editor, hit Save → disk-changed banner, Restore/Discard works
- [ ] First tagged release `v0.1.0` → GitHub Actions builds + publishes
      (Windows NSIS + zip, Linux AppImage); then a `v0.1.1` bump to prove
      auto-update actually updates a test install
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