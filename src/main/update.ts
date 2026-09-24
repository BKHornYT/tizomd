/**
 * App self-update via electron-updater, checked at launch and on a 3-hour
 * timer — the same shape as the downloader, because an app whose release
 * pipeline is connected but whose client never asks (or asks in dev only)
 * is how a shipped fix quietly never reaches anyone.
 *
 * When an update is found, autoDownload pulls the new installer in the
 * background and the renderer shows the ready banner; the whole flow is
 * logged to the app's logs dir (update.log) so a silent failure is
 * diagnosable from the user's machine instead of a mystery.
 */
import { app, type BrowserWindow } from 'electron'
import type { UpdateState } from '../shared/types'
import { appendFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { autoUpdater } from 'electron-updater'

const CHECK_INTERVAL_MS = 3 * 60 * 60 * 1000

let currentState: UpdateState
let getWindow: () => BrowserWindow | null
let logSink: string | null = null

function log(message: string): void {
  if (!logSink) return
  try {
    appendFileSync(logSink, `${new Date().toISOString()} ${message}\n`)
  } catch {
    // Logging must never take the updater down with it.
  }
}

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
    try {
      const logsDir = app.getPath('logs')
      mkdirSync(logsDir, { recursive: true })
      logSink = join(logsDir, 'update.log')
    } catch {
      logSink = null
    }

    currentState = { ...currentState, status: 'idle', canSelfUpdate: true, reason: null }
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true
    // The installer is small; a differential pull that sha-mismatches
    // (seen in the 0.1.0 -> 0.1.1 proof run) just wastes a download before
    // falling back. Always take the full file instead.
    autoUpdater.disableDifferentialDownload = true
    autoUpdater.logger = {
      info: (m) => log(`info ${String(m ?? '')}`),
      warn: (m) => log(`warn ${String(m ?? '')}`),
      error: (m) => log(`error ${String(m ?? '')}`),
      debug: () => undefined
    }
    log(`updater ready v${app.getVersion()} feed ${process.arch}/${process.platform}`)

    autoUpdater.on('checking-for-update', () => {
      currentState = { ...currentState, status: 'checking', error: null }
      push()
    })
    autoUpdater.on('update-available', (info) => {
      const version = info.version ?? 'unknown'
      log(`update available ${version}, downloading`)
      currentState = {
        ...currentState,
        status: 'downloading',
        newVersion: version,
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
      const version = info.version ?? 'unknown'
      log(`update downloaded ${version} -> ready`)
      currentState = {
        ...currentState,
        status: 'ready',
        newVersion: version,
        percent: 100
      }
      push()
    })
    autoUpdater.on('error', (err) => {
      log(`error ${String(err?.message ?? err)}`)
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
  // checkForUpdates() rejects when the feed is unreachable (e.g. app launched
  // offline); the error event also fires, so the catch is only insurance against
  // an unhandled rejection crashing main. Below Node's default that is a throw.
  void autoUpdater.checkForUpdates().catch(() => undefined)
}

export function quitAndInstall(): void {
  log('quitAndInstall')
  autoUpdater.quitAndInstall(false, true)
}