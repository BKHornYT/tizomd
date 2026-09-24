import { app, shell, BrowserWindow } from 'electron'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { installIpc, queueOpenPaths } from './ipc'
import { installMenu } from './menu'
import { finalWrite } from './store/session'
import { loadSettings } from './store/settings'

const isDev = !app.isPackaged

/** Files handed to the app on the command line that already exist on disk. */
function markdownFilesFrom(argv: string[]): string[] {
  return argv.filter((a) => !a.startsWith('-') && /\.(md|markdown)$/i.test(a) && existsSync(a))
}

function createWindow(): BrowserWindow {
  // Packaged builds get the icon from electron-builder; in dev it has to be set
  // explicitly or the window and taskbar show the default Electron logo.
  const devIcon = join(__dirname, '../../build/icon.ico')

  // Match the saved theme instead of guessing, so an app booted dark does not
  // flash a pale window before the renderer paints.
  const pageBg = loadSettings().theme === 'light' ? '#ffffff' : '#000000'

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false, // revealed on ready-to-show to avoid a white flash
    backgroundColor: pageBg,
    ...(!app.isPackaged && existsSync(devIcon) ? { icon: devIcon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // electron-vite emits a CJS preload bundle, which the sandbox loader
      // cannot require. The renderer stays isolated regardless.
      sandbox: false
    }
  })

  win.on('ready-to-show', () => win.show())

  // Anything that wants a new window is an external link — hand it to the OS
  // browser rather than opening an unsandboxed Electron window for it.
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

if (!app.requestSingleInstanceLock()) {
  // Single instance: a second launch focuses the existing window instead of
  // starting a rival copy that would fight over the session store and the same
  // files.
  app.quit()
} else {
  let mainWindow: BrowserWindow | null = null

  // A .md double-click that lands while the app is already running arrives as a
  // second-instance launch; forward its files to the open traffic.
  app.on('second-instance', (_e, commandLine) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
      const files = markdownFilesFrom(commandLine.slice(1))
      if (files.length > 0) mainWindow.webContents.send('file:open-paths', files)
    }
  })

  void app.whenReady().then(() => {
    // Open the launch-time files (if any) once the renderer is mounted enough
    // to ask for them.
    queueOpenPaths(markdownFilesFrom(process.argv.slice(1)))
    installMenu(() => mainWindow)
    installIpc(() => mainWindow)
    mainWindow = createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow()
    })
  })

  // Only the normal quit goes through here — a crash leaves the session on
  // disk with clean: false, which is the signal the next launch needs to treat
  // its buffers as a recovery copy rather than a settled state.
  app.on('before-quit', finalWrite)

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}