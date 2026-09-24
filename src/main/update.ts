/**
 * App self-update via electron-updater, checked at launch and on a 3-hour
 * timer — the same shape as the downloader, because an app whose release
 * pipeline is connected but whose client never asks (or asks in dev only)
 * is how a shipped fix quietly never reaches anyone.
 */
import { app, type BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { UpdateState } from '../shared/types'

const CHECK_INTERVAL_MS = 3 * 60 * 60 * 1000

let currentState: UpdateState
let getWindow: () => BrowserWindow | null

function push(): void {
  const win = getWindow()
  if (win && !win.isDestroyed()) win.webContents.send('update:state', currentState)
}

export function initUpdates(fn: () => BrowserWindow | null): void {
  getWindow = fn
  currentState = {
    currentVersion: app.getVersion(),
    status: 'unsupported',
    newVersion: null,
    percent: null,
    error: null,
    canSelfUpdate: false,
    reason: 'dev'
  }

  if (app.isPackaged) {
    currentState = { ...currentState, status: 'idle', canSelfUpdate: true, reason: null }
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true
    // Redside noise off; only our own state matters.
    autoUpdater.logger = null

    autoUpdater.on('checking-for-update', () => {
      currentState = { ...currentState, status: 'checking', error: null }
      push()
    })
    autoUpdater.on('update-available', (info) => {
      currentState = {
        ...currentState,
        status: 'downloading',
        newVersion: info.version ?? null,
        percent: 0
      }
      push()
    })
    autoUpdater.on('download-progress', (progress) => {
      currentState = {
        ...currentState,
        status: 'downloading',
        percent: Math.round(progress.percent)
      }
      push()
    })
    autoUpdater.on('update-downloaded', (info) => {
      currentState = {
        ...currentState,
        status: 'ready',
        newVersion: info.version ?? null,
        percent: 100
      }
      push()
    })
    autoUpdater.on('error', (err) => {
      // First check often fails to reach the network (no update server
      // reachable); keep any prior state so the UI does not flap.
      currentState = { ...currentState, status: 'error', error: String(err?.message ?? err) }
      push()
    })
  }

  app.whenReady().then(() => {
    if (!app.isPackaged) return
    // Launch check, then a quiet timer so a fix actually reaches installs that
    // stay open for days.
    void checkForUpdates()
    setInterval(() => void checkForUpdates(), CHECK_INTERVAL_MS)
  })
}

export function currentUpdateState(): UpdateState {
  return currentState
}

export function checkForUpdates(): void {
  if (!app.isPackaged) {
    currentState = {
      ...currentState,
      status: 'unsupported',
      canSelfUpdate: false,
      reason: 'dev',
      error: null
    }
    push()
    return
  }
  void autoUpdater.checkForUpdates()
}

export function quitAndInstall(): void {
  autoUpdater.quitAndInstall(false, true)
}