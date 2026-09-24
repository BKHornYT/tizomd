import { contextBridge, ipcRenderer } from 'electron'
import type {
  FileStat,
  MenuAction,
  ReadFileResult,
  SaveFileResult,
  SessionData,
  Settings,
  TreeNode,
  UpdateState
} from '../shared/types'

/**
 * The entire main <-> renderer surface. The renderer has no filesystem access,
 * no child_process, and no Node globals — if it needs something, it gets a
 * named channel here and nothing more.
 */
const api = {
  versions: (): Promise<{ app: string; electron: string; chrome: string; node: string }> =>
    ipcRenderer.invoke('app:versions'),

  quit: (): Promise<void> => ipcRenderer.invoke('app:quit'),

  files: {
    /** Returns paths, or null when the dialog was canceled. */
    openDialog: (): Promise<string[] | null> => ipcRenderer.invoke('dialog:open-files'),
    openFolderDialog: (): Promise<{ folder: string; tree: TreeNode[] } | null> =>
      ipcRenderer.invoke('dialog:open-folder'),
    saveAsDialog: (defaultPath?: string): Promise<string | null> =>
      ipcRenderer.invoke('dialog:save-markdown', defaultPath),
    read: (path: string): Promise<ReadFileResult | { ok: false; error: string }> =>
      ipcRenderer.invoke('file:read', path),
    save: (payload: {
      path: string
      text: string
      expected: FileStat | null
    }): Promise<SaveFileResult> => ipcRenderer.invoke('file:save', payload),
    stat: (path: string): Promise<{ exists: boolean; mtimeMs: number; size: number }> =>
      ipcRenderer.invoke('file:stat', path),
    reveal: (path: string): Promise<void> => ipcRenderer.invoke('shell:reveal', path)
  },

  folder: {
    read: (path: string): Promise<TreeNode[] | null> => ipcRenderer.invoke('folder:read', path)
  },

  session: {
    load: (): Promise<SessionData> => ipcRenderer.invoke('session:load'),
    save: (data: SessionData): Promise<void> => ipcRenderer.invoke('session:save', data),
    /** Normal close: write final state and mark it clean. */
    flushClean: (): Promise<void> => ipcRenderer.invoke('session:flush-clean')
  },

  settings: {
    get: (): Promise<Settings> => ipcRenderer.invoke('settings:get'),
    set: (patch: Partial<Settings>): Promise<Settings> => ipcRenderer.invoke('settings:set', patch),
    reset: (): Promise<Settings> => ipcRenderer.invoke('settings:reset')
  },

  export: {
    html: (payload: {
      title: string
      markdown: string
      defaultPath?: string
    }): Promise<{ ok: boolean; canceled: boolean; error: string | null }> =>
      ipcRenderer.invoke('export:html', payload),
    pdf: (payload: {
      title: string
      markdown: string
      defaultPath?: string
    }): Promise<{ ok: boolean; canceled: boolean; error: string | null }> =>
      ipcRenderer.invoke('export:pdf', payload)
  },

  updates: {
    state: (): Promise<UpdateState> => ipcRenderer.invoke('update:state'),
    check: (): Promise<void> => ipcRenderer.invoke('update:check'),
    install: (): Promise<void> => ipcRenderer.invoke('update:install'),
    onChange: (handler: (state: UpdateState) => void): (() => void) => {
      const listener = (_e: unknown, state: UpdateState): void => handler(state)
      ipcRenderer.on('update:state', listener)
      return () => {
        ipcRenderer.off('update:state', listener)
      }
    }
  },

  /** Menu commands, as sent from the application menu / accelerators. */
  onMenu: (handler: (action: MenuAction) => void): (() => void) => {
    const listener = (_e: unknown, action: MenuAction): void => handler(action)
    ipcRenderer.on('menu:action', listener)
    return () => {
      ipcRenderer.off('menu:action', listener)
    }
  }
}

contextBridge.exposeInMainWorld('tizomd', api)

export type TizoMdApi = typeof api