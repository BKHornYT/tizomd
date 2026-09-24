/**
 * Application menu. File/View actions are shipped down to the renderer as
 * `menu:action` events — the renderer owns the editor state and performs the
 * action against it. Edit uses native roles so clipboard works in focused
 * textareas exactly as it should.
 */
import { app, Menu, shell, type BrowserWindow, type MenuItemConstructorOptions } from 'electron'
import type { MenuAction } from '../shared/types'

function action(item: BrowserWindow | null, a: MenuAction): void {
  if (!item || item.isDestroyed()) return
  item.webContents.send('menu:action', a)
}

function actor(getWindow: () => BrowserWindow | null) {
  return (a: MenuAction) => () => action(getWindow(), a)
}

export function installMenu(getWindow: () => BrowserWindow | null): void {
  const send = actor(getWindow)

  const fileMenu: MenuItemConstructorOptions = {
    label: '&File',
    submenu: [
      { label: 'New File', accelerator: 'CmdOrCtrl+N', click: send('file:new') },
      { label: 'Open File…', accelerator: 'CmdOrCtrl+O', click: send('file:open') },
      { label: 'Open Folder…', accelerator: 'CmdOrCtrl+Shift+O', click: send('file:open-folder') },
      { type: 'separator' },
      { label: 'Save', accelerator: 'CmdOrCtrl+S', click: send('file:save') },
      { label: 'Save As…', accelerator: 'CmdOrCtrl+Shift+S', click: send('file:save-as') },
      { type: 'separator' },
      {
        label: 'Export HTML…',
        click: send('file:export-html')
      },
      {
        label: 'Export PDF…',
        click: send('file:export-pdf')
      },
      { type: 'separator' },
      { label: 'Close Tab', accelerator: 'CmdOrCtrl+W', click: send('file:close-tab') },
      { type: 'separator' },
      { label: 'Settings…', accelerator: 'CmdOrCtrl+,', click: send('settings') },
      { type: 'separator' },
      { label: 'Quit', accelerator: 'CmdOrCtrl+Q', role: 'quit' }
    ]
  }

  const editMenu: MenuItemConstructorOptions = {
    label: '&Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'selectAll' }
    ]
  }

  const viewMenu: MenuItemConstructorOptions = {
    label: '&View',
    submenu: [
      { label: 'Toggle Sidebar', accelerator: 'CmdOrCtrl+B', click: send('view:toggle-sidebar') },
      { type: 'separator' },
      { label: 'Preview Mode', accelerator: 'CmdOrCtrl+1', click: send('view:preview') },
      { label: 'Split View', accelerator: 'CmdOrCtrl+2', click: send('view:split') },
      { label: 'Raw Source', accelerator: 'CmdOrCtrl+3', click: send('view:raw') },
      { type: 'separator' },
      { label: 'Toggle Theme', accelerator: 'CmdOrCtrl+Shift+T', click: send('view:theme') },
      { type: 'separator' },
      { role: 'toggleDevTools' },
      { role: 'resetZoom' },
      { role: 'zoomIn' },
      { role: 'zoomOut' }
    ]
  }

  const helpMenu: MenuItemConstructorOptions = {
    label: '&Help',
    submenu: [
      {
        label: 'Check for Updates',
        click: send('app:check-updates')
      },
      {
        label: 'Report an Issue',
        click: () => void shell.openExternal('https://github.com/BKHornYT/tizomd/issues')
      },
      {
        label: 'About TizoMD',
        click: () => {
          const win = getWindow()
          if (win && !win.isDestroyed()) win.webContents.send('menu:action', 'about')
        }
      }
    ]
  }

  const template: MenuItemConstructorOptions[] =
    process.platform === 'darwin'
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' }
            ]
          },
          editMenu,
          viewMenu,
          fileMenu,
          helpMenu
        ]
      : [fileMenu, editMenu, viewMenu, helpMenu]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}