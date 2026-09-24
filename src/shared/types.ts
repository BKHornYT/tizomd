/**
 * Types shared across main, preload and renderer. Nothing in here may import
 * from electron or node — the renderer compiles against it too.
 */

// --- Files ------------------------------------------------------------------

export interface FileStat {
  mtimeMs: number
  size: number
}

export interface DiskState extends FileStat {
  exists: boolean
}

export type ReadFileResult = { ok: true; text: string; stat: FileStat } | { ok: false; error: string }

export type SaveFileResult =
  | { ok: true; stat: FileStat }
  /** The file changed on disk since we loaded it. Never overwrite silently. */
  | { ok: false; changed: true; current: { text: string; stat: DiskState } }
  | { ok: false; changed: false; error: string }

export interface TreeNode {
  name: string
  path: string
  dir: boolean
  children: TreeNode[] | null
}

// --- Session memory ---------------------------------------------------------

/**
 * Everything needed to rebuild the editor after a restart without losing a
 * single keystroke. `text` is always the live working copy; `recovery` is a
 * copy of what the user typed that would otherwise have been clobbered by a
 * file that changed on disk — surfaced with a Restore / Discard choice, never
 * merged silently.
 */
export interface BufferState {
  text: string
  cursor: number
  scroll: number
  /** Split-view divider position, 20–80; undefined falls back to 50. */
  splitPercent?: number
}

export interface SessionFile {
  untitled: boolean
  buffer: BufferState
  recovery: string | null
}

export interface SessionData {
  version: 1
  /**
   * True only when the app exited through the normal close path. A crash leaves
   * it false, so the next launch knows buffers held at close time are recovery
   * copies that survived a hard kill.
   */
  clean: boolean
  active: string | null
  /** Keyed by absolute path, or `untitled:<n>` for unsaved tabs. */
  files: Record<string, SessionFile>
}

// --- Settings ---------------------------------------------------------------

export type Theme = 'dark' | 'light'

export type ViewMode = 'preview' | 'split' | 'raw'

export interface Settings {
  theme: Theme
  /** The resting editing surface: block-edit preview, split, or raw source. */
  viewMode: ViewMode
  editorFontSize: number
  sidebarOpen: boolean
  /** The folder whose tree the sidebar shows. */
  openFolder: string | null
}

// --- Updates ----------------------------------------------------------------

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'current'
  | 'downloading'
  | 'ready'
  | 'error'
  | 'unsupported'

export interface UpdateState {
  currentVersion: string
  status: UpdateStatus
  newVersion: string | null
  percent: number | null
  error: string | null
  canSelfUpdate: boolean
  /** Why self-update is off, when it is: running in dev. */
  reason: 'dev' | null
}

// --- Menu -------------------------------------------------------------------

/** Actions the menu sends down to the renderer. */
export type MenuAction =
  | 'file:new'
  | 'file:open'
  | 'file:open-folder'
  | 'file:save'
  | 'file:save-as'
  | 'file:close-tab'
  | 'file:export-html'
  | 'file:export-pdf'
  | 'edit:find'
  | 'view:toggle-sidebar'
  | 'view:preview'
  | 'view:split'
  | 'view:raw'
  | 'view:theme'
  | 'app:check-updates'
  | 'settings'
  | 'about'