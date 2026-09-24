/**
 * ALL user-visible copy. Never hardcode text in a component — retrofitting i18n
 * means swapping this one module, not touching every component.
 */
export const strings = {
  appName: 'TizoMD',

  toolbar: {
    new: 'New file',
    open: 'Open…',
    openFolder: 'Open folder',
    sidebar: 'Sidebar',
    preview: 'Preview',
    split: 'Split',
    raw: 'Raw',
    checkUpdates: 'Check for updates'
  },

  editor: {
    untitled: (n: number): string => `Untitled ${n}`,
    markdownTag: 'Markdown',
    emptyHint: 'Open a .md file, or press Ctrl+N to start typing.',
    clickHint: 'Click any block to edit its source',
    previewMode: 'Preview',
    splitMode: 'Split',
    rawMode: 'Raw'
  },

  state: {
    modified: 'Modified',
    saved: 'Saved',
    missing: 'File missing',
    blank: 'Empty document'
  },

  notice: {
    diskChangedTitle: 'File changed on disk',
    diskChangedBody:
      'This file was edited by something else while you were working. TizoMD loaded the newer on-disk version — your unsaved edits are kept aside and nothing was overwritten.',
    diskChangedRestore: 'Restore my edits',
    diskChangedDiscard: 'Discard',
    recoveryTitle: 'Unsaved edits from an earlier session',
    recoveryBody:
      'TizoMD did not close cleanly last time and this file had unsaved edits. Nothing has been merged or dropped — keep working on the recovered copy, or start from the version on disk.',
    recoveryKeep: 'Keep editing',
    recoveryDiscard: 'Start from disk',
    fileSaved: (name: string): string => `Saved ${name}`,
    exportDone: (ext: string): string => `Exported ${ext}`,
    exportFailed: (ext: string): string => `Export ${ext} failed`
  },

  update: {
    ready: (version: string): string => `TizoMD ${version} is ready`,
    downloading: (percent: number): string => `Downloading update… ${percent}%`,
    checking: 'Checking for updates…',
    error: 'Update check failed',
    install: 'Restart & install',
    later: 'Later',
    current: (version: string): string => `v${version}`,
    dev: 'dev build'
  },

  settings: {
    title: 'Settings',
    theme: 'Appearance',
    dark: 'Dark',
    light: 'Light',
    fontSize: 'Editor text size',
    viewMode: 'Default view',
    preview: 'Preview (Typora-style)',
    split: 'Split (source + preview)',
    raw: 'Raw source',
    sidebar: 'Start with sidebar open',
    about: 'About TizoMD',
    version: 'Version',
    stack: 'Electron · React · Tailwind',
    back: 'Back to editor'
  },

  tree: {
    empty: 'Open a folder to browse markdown files',
    root: 'Files',
    refresh: 'Refresh'
  },

  tabs: {
    close: 'Close tab'
  },

  confirm: {
    discardTitle: (name: string): string => `Discard changes to ${name}?`,
    discardBody: 'This file has unsaved edits. Closing it now loses them.',
    discard: 'Discard',
    cancel: 'Stay'
  }
}