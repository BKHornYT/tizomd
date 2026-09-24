/**
 * Every channel the renderer can reach. The renderer has no filesystem access
 * and no Node globals — everything it needs crosses this one file.
 */
import { app, dialog, ipcMain, shell, BrowserWindow } from 'electron'
import { writeFileSync, mkdirSync } from 'node:fs'
import { basename, dirname } from 'node:path'
import type {
  Settings,
  SessionData,
  SaveFileResult,
  ReadFileResult,
  TreeNode,
  FileStat
} from '../shared/types'
import { statDisk, readTextFile, saveTextFile, walkTree } from './files'
import { loadSettings, saveSettings } from './store/settings'
import { loadSession, cacheSession, finalWrite } from './store/session'
import { checkForUpdates, quitAndInstall, initUpdates, currentUpdateState } from './update'
import { buildDocumentHtml, pdfFromHtml } from './export'

// Files handed to the app on the command line (a .md double-click / "Open with").
// Packaged Electron starts before the renderer's listener exists, so main queues
// them here and the renderer pulls the queue on mount. A second launch while the
// app is running is pushed live through 'file:open-paths' instead (the listener
// is already up by then).
let queuedOpenPaths: string[] = []

export function queueOpenPaths(paths: string[]): void {
  queuedOpenPaths.push(...paths)
}

function takeQueuedOpenPaths(): string[] {
  const paths = queuedOpenPaths
  queuedOpenPaths = []
  return paths
}

function wire(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle('app:versions', () => ({
    app: app.getVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node
  }))

  ipcMain.handle('app:quit', () => {
    finalWrite()
    app.quit()
  })

  // --- Files -------------------------------------------------------------

  ipcMain.handle('files:get-open-paths', (): string[] => takeQueuedOpenPaths())

  ipcMain.handle('dialog:open-files', async () => {
    const r = await dialog.showOpenDialog({
      title: 'Open Markdown File',
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
      properties: ['openFile', 'multiSelections']
    })
    return r.canceled ? null : r.filePaths
  })

  ipcMain.handle('dialog:open-folder', async () => {
    const r = await dialog.showOpenDialog({
      title: 'Open Folder',
      properties: ['openDirectory']
    })
    if (r.canceled || r.filePaths.length === 0) return null
    const folder = r.filePaths[0]
    return { folder, tree: walkTree(folder) }
  })

  ipcMain.handle('dialog:save-markdown', async (_e, defaultPath?: string) => {
    const opts = {
      title: 'Save As',
      defaultPath,
      filters: [{ name: 'Markdown', extensions: ['md'] }]
    }
    const win = getWindow()
    const r = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts)
    return r.canceled || !r.filePath ? null : r.filePath
  })

  ipcMain.handle('file:read', (_e, path: string): ReadFileResult => {
    return readTextFile(path)
  })

  ipcMain.handle(
    'file:save',
    (
      _e,
      payload: { path: string; text: string; expected: FileStat | null }
    ): SaveFileResult => saveTextFile(payload.path, payload.text, payload.expected)
  )

  ipcMain.handle('file:stat', (_e, path: string) => statDisk(path))

  ipcMain.handle('folder:read', (_e, path: string): TreeNode[] | null => walkTree(path))

  ipcMain.handle('shell:reveal', (_e, path: string) => {
    shell.showItemInFolder(path)
  })

  // --- Session -----------------------------------------------------------

  ipcMain.handle('session:load', (): SessionData => loadSession())

  ipcMain.handle('session:save', (_e, data: SessionData) => {
    cacheSession(data)
  })

  ipcMain.handle('session:flush-clean', () => {
    finalWrite()
  })

  // --- Settings ----------------------------------------------------------

  ipcMain.handle('settings:get', (): Settings => loadSettings())

  ipcMain.handle('settings:set', (_e, patch: Partial<Settings>): Settings => {
    const merged = { ...loadSettings(), ...patch }
    return saveSettings(merged)
  })

  ipcMain.handle('settings:reset', (): Settings => saveSettings(loadSettings()))

  // --- Export ------------------------------------------------------------

  ipcMain.handle(
    'export:html',
    async (e, payload: { title: string; markdown: string; defaultPath?: string }) => {
      const win = BrowserWindow.fromWebContents(e.sender) ?? getWindow()
      const opts = {
        title: 'Export HTML',
        defaultPath: payload.defaultPath,
        filters: [{ name: 'HTML', extensions: ['html'] }]
      }
      const r = win
        ? await dialog.showSaveDialog(win, opts)
        : await dialog.showSaveDialog(opts)
      if (r.canceled || !r.filePath) return { ok: false, canceled: true, error: null, stat: null }
      const html = buildDocumentHtml(payload.title, payload.markdown)
      try {
        mkdirSync(dirname(r.filePath), { recursive: true })
        writeFileSync(r.filePath, html, 'utf-8')
        return { ok: true, canceled: false, error: null, stat: statDisk(r.filePath) }
      } catch (err) {
        return {
          ok: false,
          canceled: false,
          error: err instanceof Error ? err.message : String(err),
          stat: null
        }
      }
    }
  )

  ipcMain.handle(
    'export:pdf',
    async (_e, payload: { title: string; markdown: string; defaultPath?: string }) => {
      const opts = {
        title: 'Export PDF',
        defaultPath: payload.defaultPath,
        filters: [{ name: 'PDF', extensions: ['pdf'] }]
      }
      const win = getWindow()
      const r = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts)
      if (r.canceled || !r.filePath) return { ok: false, canceled: true, error: null, stat: null }
      try {
        const html = buildDocumentHtml(payload.title, payload.markdown)
        const buffer = await pdfFromHtml(html)
        mkdirSync(dirname(r.filePath), { recursive: true })
        writeFileSync(r.filePath, buffer)
        return { ok: true, canceled: false, error: null, stat: statDisk(r.filePath) }
      } catch (err) {
        return {
          ok: false,
          canceled: false,
          error: err instanceof Error ? err.message : String(err),
          stat: null
        }
      }
    }
  )

  // --- Updates -----------------------------------------------------------

  ipcMain.handle('update:state', () => currentUpdateState())

  ipcMain.handle('update:check', () => {
    checkForUpdates()
  })

  ipcMain.handle('update:install', () => {
    quitAndInstall()
  })

  // --- Helpers -----------------------------------------------------------

  ipcMain.handle('path:basename', (_e, path: string) => basename(path))

  ipcMain.handle('path:stem', (_e, path: string) => {
    const b = basename(path, '.md').replace(/\.markdown$/i, '')
    return b
  })
}

export function installIpc(getWindow: () => BrowserWindow | null): void {
  wire(getWindow)
  initUpdates(getWindow)
}