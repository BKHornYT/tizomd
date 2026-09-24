import { useCallback, useEffect, useRef, useState } from 'react'
import type { JSX } from 'react'
import type {
  FileStat,
  MenuAction,
  Settings,
  SessionData,
  TreeNode,
  UpdateState,
  ViewMode
} from '../../shared/types'
import { strings } from './strings'
import Icon, { type IconName } from './components/Icon'
import FileTree from './components/FileTree'
import TabBar from './components/TabBar'
import TitleBar from './components/TitleBar'
import EditorPane from './editor/EditorPane'
import SettingsView from './views/SettingsView'

interface Tab {
  key: string
  isUntitled: boolean
  title: string
  path: string | null
  text: string
  /** What disk held at load / last save. `dirty` is `text !== savedText`. */
  savedText: string
  cursor: number
  scroll: number
  /** Guard snapshot: when the file was read from / written to disk. */
  loadedDisk: FileStat | null
  dirty: boolean
  exists: boolean
  notice: 'disk-changed' | 'recovery' | null
  recovery: string | null
}

function baseName(p: string): string {
  const parts = p.split(/[\\/]/)
  return parts[parts.length - 1] || p
}

function nextUntitledKey(tabs: Tab[]): string {
  let n = 1
  while (tabs.some((t) => t.key === `untitled:${n}`)) n++
  return `untitled:${n}`
}

function titleFor(key: string, text: string): string {
  if (key.startsWith('untitled')) {
    const n = key.split(':')[1]
    return strings.editor.untitled(Number(n))
  }
  const firstLine = text.split('\n', 1)[0]?.trim()
  if (firstLine && /^#\s+/.test(firstLine)) return firstLine.replace(/^#\s+/, '').trim()
  return baseName(key)
}

export default function App(): JSX.Element {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [tabs, setTabs] = useState<Tab[]>([])
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('preview')
  const [tree, setTree] = useState<TreeNode[] | null>(null)
  const [update, setUpdate] = useState<UpdateState | null>(null)
  const [dismissedUpdate, setDismissedUpdate] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [aboutOpen, setAboutOpen] = useState(false)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // --- theme ---------------------------------------------------------------
  useEffect(() => {
    if (!settings) return
    const el = document.documentElement
    el.classList.toggle('light', settings.theme === 'light')
    el.classList.toggle('dark', settings.theme === 'dark')
    setViewMode(settings.viewMode)
  }, [settings])

  // --- startup: settings + session restore ---------------------------------
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [nextSettings, session] = await Promise.all([
        window.tizomd.settings.get(),
        window.tizomd.session.load()
      ])
      if (cancelled) return
      setSettings(nextSettings)
      if (nextSettings.openFolder) {
        setTree(await window.tizomd.folder.read(nextSettings.openFolder))
      }

      const restored: Tab[] = []
      for (const [key, sf] of Object.entries(session.files)) {
        if (sf.untitled) {
          restored.push({
            key,
            isUntitled: true,
            title: titleFor(key, sf.buffer.text),
            path: null,
            text: sf.buffer.text,
            savedText: '',
            cursor: sf.buffer.cursor,
            scroll: sf.buffer.scroll,
            loadedDisk: null,
            dirty: sf.buffer.text !== '',
            exists: true,
            notice: null,
            recovery: sf.recovery
          })
          continue
        }
        const read = await window.tizomd.files.read(key)
        if (read.ok) {
          // A session buffer that differs from disk is the crash-recovery case:
          // show it with a choice, never merge, never drop.
          const dirty = sf.buffer.text !== read.text
          restored.push({
            key,
            isUntitled: false,
            title: baseName(key),
            path: key,
            text: sf.buffer.text,
            savedText: read.text,
            cursor: sf.buffer.cursor,
            scroll: sf.buffer.scroll,
            loadedDisk: read.stat,
            dirty,
            exists: true,
            notice: dirty ? 'recovery' : null,
            recovery: sf.recovery
          })
        } else {
          // The file is gone (renamed/moved on another machine). Keep the
          // buffer — it is the user's words; saving writes a new file.
          restored.push({
            key,
            isUntitled: false,
            title: baseName(key),
            path: key,
            text: sf.buffer.text,
            savedText: '',
            cursor: sf.buffer.cursor,
            scroll: sf.buffer.scroll,
            loadedDisk: null,
            dirty: sf.buffer.text !== '',
            exists: false,
            notice: null,
            recovery: sf.recovery
          })
        }
      }
      if (cancelled) return
      setTabs(restored)
      const nextActive =
        session.active && restored.some((t) => t.key === session.active)
          ? session.active
          : restored[0]?.key ?? null
      setActiveKey(nextActive)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // --- live session persistence (keystroke-period, debounced on the main side)
  useEffect(() => {
    if (!settings) return
    const data: SessionData = {
      version: 1,
      clean: false,
      active: activeKey,
      files: {}
    }
    for (const t of tabs) {
      data.files[t.key] = {
        untitled: t.isUntitled,
        buffer: { text: t.text, cursor: t.cursor, scroll: t.scroll },
        recovery: t.recovery
      }
    }
    window.tizomd.session.save(data)
  }, [tabs, activeKey, settings])

  // Flush clean on close. `beforeunload` fires for normal closes; the invoke is
  // synchronous on the main side, so the final state lands on disk.
  useEffect(() => {
    const flush = (): void => {
      void window.tizomd.session.flushClean()
    }
    window.addEventListener('beforeunload', flush)
    return () => window.removeEventListener('beforeunload', flush)
  }, [])

  // --- updates --------------------------------------------------------------
  useEffect(() => {
    void window.tizomd.updates.state().then(setUpdate)
    return window.tizomd.updates.onChange(setUpdate)
  }, [])

  // --- files handed over by the OS (a .md double-click / "Open with") -------
  useEffect(() => {
    let mounted = true
    void window.tizomd.files.takeOpenPaths().then((paths) => {
      if (mounted && paths.length > 0) void openHandedOff(paths)
    })
    const off = window.tizomd.files.onOpenCommand((paths) => {
      if (paths.length > 0) void openHandedOff(paths)
    })
    return () => {
      mounted = false
      off()
    }
  }, [])

  async function openHandedOff(paths: string[]): Promise<void> {
    for (const path of paths) await openKnownPath(path)
    setActiveKey(paths[0] ?? null)
  }

  // --- menu ----------------------------------------------------------------
  const handleMenuAction = useCallback(
    (action: MenuAction) => {
      switch (action) {
        case 'file:new':
          newFile()
          break
        case 'file:open':
          void openFiles()
          break
        case 'file:open-folder':
          void openFolder()
          break
        case 'file:save':
          void saveActive()
          break
        case 'file:save-as':
          if (activeKey) void saveFileAs(activeKey)
          break
        case 'file:close-tab':
          if (activeKey) closeTab(activeKey)
          break
        case 'file:export-html':
          void exportActive('html')
          break
        case 'file:export-pdf':
          void exportActive('pdf')
          break
        case 'view:toggle-sidebar':
          setSettings((s) => {
            if (!s) return s
            const next: Settings = { ...s, sidebarOpen: !s.sidebarOpen }
            void window.tizomd.settings.set(next).then(setSettings)
            return s
          })
          break
        case 'view:preview':
        case 'view:split':
        case 'view:raw':
          changeView(action.split(':')[1] as ViewMode)
          break
        case 'view:theme':
          toggleTheme()
          break
        case 'app:check-updates':
          void window.tizomd.updates.check()
          break
        case 'settings':
          setShowSettings(true)
          break
        case 'about':
          setAboutOpen(true)
          break
      }
    },
    [activeKey, tabs, settings]
  )

  useEffect(() => {
    return window.tizomd.onMenu(handleMenuAction)
  }, [handleMenuAction])

  // --- helpers ----------------------------------------------------------------
  const showToast = useCallback((message: string): void => {
    setToast(message)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3200)
  }, [])

  const patchTab = useCallback(
    (key: string, updater: Partial<Tab> | ((t: Tab) => Tab)): void => {
      setTabs((prev) =>
        prev.map((t) =>
          t.key === key ? (typeof updater === 'function' ? updater(t) : { ...t, ...updater }) : t
        )
      )
    },
    []
  )

  const newFile = useCallback((): void => {
    const key = nextUntitledKey(tabs)
    const tab: Tab = {
      key,
      isUntitled: true,
      title: strings.editor.untitled(Number(key.split(':')[1])),
      path: null,
      text: '',
      savedText: '',
      cursor: 0,
      scroll: 0,
      loadedDisk: null,
      dirty: false,
      exists: true,
      notice: null,
      recovery: null
    }
    setTabs((prev) => [...prev, tab])
    setActiveKey(key)
  }, [tabs])

  const openFiles = useCallback(async (): Promise<void> => {
    const paths = await window.tizomd.files.openDialog()
    if (!paths) return
    const next = [...tabs]
    for (const path of paths) {
      if (next.some((t) => t.path === path)) continue
      const read = await window.tizomd.files.read(path)
      if (!read.ok) {
        showToast(`Could not open ${baseName(path)}`)
        continue
      }
      next.push({
        key: path,
        isUntitled: false,
        title: baseName(path),
        path,
        text: read.text,
        savedText: read.text,
        cursor: 0,
        scroll: 0,
        loadedDisk: read.stat,
        dirty: false,
        exists: true,
        notice: null,
        recovery: null
      })
    }
    setTabs(next)
    setActiveKey(paths[0] ?? null)
  }, [tabs, showToast])

  const openFolder = useCallback(async (): Promise<void> => {
    const result = await window.tizomd.files.openFolderDialog()
    if (!result) return
    setTree(result.tree)
    setSettings((s) => {
      if (!s) return s
      const next = { ...s, openFolder: result.folder, sidebarOpen: true }
      void window.tizomd.settings.set(next).then(setSettings)
      return s
    })
  }, [])

  const saveTab = useCallback(
    async (key: string): Promise<void> => {
      const tab = tabs.find((t) => t.key === key)
      if (!tab) return
      if (tab.isUntitled || !tab.path) {
        await saveFileAs(key)
        return
      }
      const result = await window.tizomd.files.save({
        path: tab.path,
        text: tab.text,
        expected: tab.loadedDisk
      })
      if (result.ok) {
        patchTab(key, {
          savedText: tab.text,
          loadedDisk: result.stat,
          dirty: false,
          notice: null,
          recovery: null
        })
        showToast(strings.notice.fileSaved(tab.title))
      } else if (result.changed) {
        // Never clobber a newer file. Adopt the disk version, stash the edit.
        patchTab(key, {
          text: result.current.text,
          savedText: result.current.text,
          loadedDisk: result.current.stat,
          dirty: false,
          notice: 'disk-changed',
          recovery: tab.text,
          exists: true
        })
      } else {
        showToast(result.error ?? 'Save failed')
      }
    },
    [tabs, patchTab, showToast]
  )

  const closeTab = useCallback(
    (key: string): void => {
      const tab = tabs.find((t) => t.key === key)
      if (!tab) return
      if (tab.dirty && !window.confirm(strings.confirm.discardTitle(tab.title))) return
      const next = tabs.filter((t) => t.key !== key)
      setTabs(next)
      if (activeKey === key) setActiveKey(next[0]?.key ?? null)
    },
    [tabs, activeKey]
  )

  const exportActive = useCallback(
    async (kind: 'html' | 'pdf'): Promise<void> => {
      const tab = tabs.find((t) => t.key === activeKey)
      if (!tab) return
      const base = tab.isUntitled ? strings.appName : tab.path!.replace(/\.(md|markdown)$/i, '')
      const payload = {
        title: titleFor(tab.key, tab.text),
        markdown: tab.text,
        defaultPath: `${base}.${kind}`
      }
      const result =
        kind === 'html'
          ? await window.tizomd.export.html(payload)
          : await window.tizomd.export.pdf(payload)
      if (result.ok) showToast(strings.notice.exportDone(kind.toUpperCase()))
      else if (!result.canceled) showToast(`${strings.notice.exportFailed(kind.toUpperCase())}: ${result.error ?? ''}`)
    },
    [tabs, activeKey, showToast]
  )

  const changeView = useCallback((mode: ViewMode): void => {
    setViewMode(mode)
    setSettings((s) => {
      if (!s) return s
      const next = { ...s, viewMode: mode }
      void window.tizomd.settings.set(next).then(setSettings)
      return s
    })
  }, [])

  const toggleTheme = useCallback((): void => {
    setSettings((s) => {
      if (!s) return s
      const next: Settings = { ...s, theme: s.theme === 'dark' ? 'light' : 'dark' }
      void window.tizomd.settings.set(next).then(setSettings)
      return s
    })
  }, [])

  // --- editor interactions ----------------------------------------------------
  const onText = useCallback(
    (key: string, text: string): void => {
      patchTab(key, (t) => ({ ...t, text, dirty: text !== t.savedText }))
    },
    [patchTab]
  )

  // --- render -------------------------------------------------------------------
  if (!settings) return <div className="app-bg h-full" />

  const active = tabs.find((t) => t.key === activeKey) ?? null
  const restoring = tabs.length > 0 && !active

  return (
    <div className="app-bg flex h-full flex-col overflow-hidden">
      <TitleBar />
      {showSettings ? (
        <SettingsView settings={settings} onBack={() => setShowSettings(false)} onChanged={setSettings} />
      ) : (
        <>
          {tabs.length > 0 && (
            <TabBar
              tabs={tabs}
              activeKey={activeKey}
              onPick={setActiveKey}
              onClose={(key) => closeTab(key)}
            />
          )}

          {restoring && <div className="flex-1" />}

          {active ? (
            <div className="flex min-h-0 flex-1">
              {settings.sidebarOpen && (
                <FileTree
                  tree={tree}
                  activePath={active.path ?? undefined}
                  onPick={(path) => void openKnownPath(path)}
                  onRefresh={() => void refreshTree()}
                />
              )}
              <main className="min-h-0 flex-1">
                <EditorPane
                  key={active.key}
                  tab={active}
                  viewMode={viewMode}
                  fontSize={settings.editorFontSize}
                  onText={(text) => onText(active.key, text)}
                  onCursor={(cursor) => patchTab(active.key, { cursor })}
                  onScroll={(scroll) => patchTab(active.key, { scroll })}
                  onNotice={(notice, action) => handleNotice(active.key, notice, action)}
                />
              </main>
            </div>
          ) : (
            <EmptyState
              onOpen={() => void openFiles()}
              onOpenFolder={() => void openFolder()}
              onNew={() => newFile()}
            />
          )}
        </>
      )}

      {!showSettings && (
        <StatusBar
          open={active}
          theme={settings.theme}
          viewMode={viewMode}
          update={update}
          onToggleTheme={() => toggleTheme()}
          onCheckUpdates={() => void window.tizomd.updates.check()}
          onMode={(mode) => changeView(mode)}
        />
      )}

      {update?.status === 'ready' && update.newVersion !== dismissedUpdate && (
        <UpdateBanner
          version={update.newVersion ?? ''}
          percent={null}
          onDismiss={() => setDismissedUpdate(update.newVersion)}
        />
      )}
      {update?.status === 'downloading' && update.newVersion && (
        <UpdateBanner
          version={update.newVersion}
          percent={update.percent ?? 0}
          onDismiss={() => setDismissedUpdate(update.newVersion)}
        />
      )}

      {aboutOpen && (
        <AboutDialog
          currentVersion={update?.currentVersion ?? null}
          onClose={() => setAboutOpen(false)}
        />
      )}

      {toast && (
        <div className="surface-3 fixed right-4 bottom-4 z-50 max-w-sm rounded-lg border border-subtle px-4 py-2.5 text-sm shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )

  // --- inner helpers used above ------------------------------------------------

  async function refreshTree(): Promise<void> {
    if (!settings?.openFolder) return
    setTree(await window.tizomd.folder.read(settings.openFolder))
  }

  async function saveFileAs(key: string): Promise<void> {
    const tab = tabs.find((t) => t.key === key)
    if (!tab) return
    const defaultPath = tab.isUntitled
      ? `${strings.appName}.md`
      : tab.path!.replace(/\.(md|markdown)$/i, '')
    const savedPath = await window.tizomd.files.saveAsDialog(defaultPath)
    if (!savedPath) return
    const renamed = {
      ...tab,
      key: savedPath,
      path: savedPath,
      isUntitled: false,
      title: baseName(savedPath)
    }
    setTabs((prev) => prev.map((t) => (t.key === key ? renamed : t)))
    setActiveKey(savedPath)
    void saveTab(savedPath)
  }

  async function openKnownPath(path: string): Promise<void> {
    if (tabs.some((t) => t.path === path)) {
      setActiveKey(path)
      return
    }
    const read = await window.tizomd.files.read(path)
    if (!read.ok) {
      showToast(`Could not open ${baseName(path)}`)
      return
    }
    const tab: Tab = {
      key: path,
      isUntitled: false,
      title: baseName(path),
      path,
      text: read.text,
      savedText: read.text,
      cursor: 0,
      scroll: 0,
      loadedDisk: read.stat,
      dirty: false,
      exists: true,
      notice: null,
      recovery: null
    }
    setTabs((prev) => [...prev, tab])
    setActiveKey(path)
  }

  function saveActive(): Promise<void> {
    return activeKey ? saveTab(activeKey) : Promise.resolve()
  }

  function handleNotice(
    key: string,
    notice: 'disk-changed' | 'recovery' | null,
    action?: 'restore' | 'discard'
  ): void {
    const tab = tabs.find((t) => t.key === key)
    if (!tab) return
    if (notice === null) {
      patchTab(key, { notice: null })
      return
    }
    if (action === 'restore') {
      if (notice === 'disk-changed' && tab.recovery !== null) {
        patchTab(key, {
          text: tab.recovery,
          dirty: tab.recovery !== tab.savedText,
          recovery: null,
          notice: null
        })
      } else {
        patchTab(key, { notice: null })
      }
      return
    }
    if (action === 'discard') {
      patchTab(key, {
        text: tab.savedText,
        dirty: false,
        recovery: null,
        notice: null
      })
    }
  }
}

// --- small building blocks -------------------------------------------------

function StatusBar({
  open,
  theme,
  viewMode,
  update,
  onToggleTheme,
  onCheckUpdates,
  onMode
}: {
  open: { dirty: boolean; notice: string | null } | null
  theme: Settings['theme']
  viewMode: ViewMode
  update: UpdateState | null
  onToggleTheme: () => void
  onCheckUpdates: () => void
  onMode: (mode: ViewMode) => void
}): JSX.Element {
  return (
    <div className="surface flex shrink-0 items-center gap-2 border-t border-subtle px-3 py-[3px] text-[11px] text-[var(--text-dim)]">
      {open ? (
        <>
          <span className={`font-medium ${open.dirty ? 'text-[var(--text)]' : ''}`}>
            {open.dirty ? strings.state.modified : strings.state.saved}
          </span>
          {!open.notice && <span className="hidden truncate md:inline">{strings.editor.clickHint}</span>}
        </>
      ) : (
        <span className="select-none">{strings.appName}</span>
      )}
      <div className="flex-1" />
      {update && (
        <button
          onClick={onCheckUpdates}
          title={strings.toolbar.checkUpdates}
          className="mono text-[11px] transition hover:text-[var(--text)]"
        >
          {update.canSelfUpdate ? strings.update.current(update.currentVersion) : strings.update.dev}
        </button>
      )}
      <button
        onClick={onToggleTheme}
        title="Ctrl+Shift+T"
        className="flex h-5 w-5 items-center justify-center rounded transition hover:bg-[var(--border)]"
      >
        <Icon name={theme === 'dark' ? 'sun' : 'moon'} className="h-3 w-3" />
      </button>
      {open && (
        <>
          <span className="mx-1 h-4 w-px bg-[var(--border)]" />
          <ModeButton icon="eye" label={strings.editor.previewMode} active={viewMode === 'preview'} onClick={() => onMode('preview')} />
          <ModeButton icon="columns" label={strings.editor.splitMode} active={viewMode === 'split'} onClick={() => onMode('split')} />
          <ModeButton icon="code" label={strings.editor.rawMode} active={viewMode === 'raw'} onClick={() => onMode('raw')} />
        </>
      )}
    </div>
  )
}

function ModeButton({
  icon,
  label,
  active,
  onClick
}: {
  icon: IconName
  label: string
  active: boolean
  onClick: () => void
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`flex h-5 items-center rounded px-1 transition ${
        active
          ? 'text-[var(--accent)]'
          : 'hover:bg-[var(--border)] hover:text-[var(--text)]'
      }`}
    >
      <Icon name={icon} className="h-3 w-3" />
    </button>
  )
}

function UpdateBanner({
  version,
  percent,
  onDismiss
}: {
  version: string
  percent: number | null
  onDismiss: () => void
}): JSX.Element {
  const ready = percent === null
  return (
    <div className="surface-3 flex shrink-0 items-center justify-center gap-3 border-t border-subtle bg-[var(--accent-soft)] px-8 py-2 text-xs">
      <span>
        {ready ? strings.update.ready(version) : strings.update.downloading(percent ?? 0)}
      </span>
      {ready && (
        <button
          onClick={() => void window.tizomd.updates.install()}
          className="rounded-md bg-[var(--accent)] px-3 py-1 font-medium text-white transition hover:opacity-90"
        >
          {strings.update.install}
        </button>
      )}
      <button onClick={onDismiss} className="text-[var(--text-dim)] transition hover:text-[var(--text)]">
        {strings.update.later}
      </button>
    </div>
  )
}

function EmptyState({
  onOpen,
  onOpenFolder,
  onNew
}: {
  onOpen: () => void
  onOpenFolder: () => void
  onNew: () => void
}): JSX.Element {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-[#f0a868] via-[#b95ce4] to-[#6f9fd8] opacity-80">
        <span className="text-3xl font-bold text-white">M↓</span>
      </div>
      <div>
        <p className="text-sm text-[var(--text-dim)]">{strings.editor.emptyHint}</p>
        <p className="mt-1 text-xs text-[var(--text-dim)] opacity-70">{strings.editor.clickHint}</p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onOpen}
          className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
        >
          {strings.toolbar.open}
        </button>
        <button
          onClick={onOpenFolder}
          className="surface-3 rounded-lg border border-subtle px-4 py-2 text-sm font-medium transition hover:opacity-90"
        >
          {strings.toolbar.openFolder}
        </button>
        <button
          onClick={onNew}
          className="surface-3 rounded-lg border border-subtle px-4 py-2 text-sm font-medium transition hover:opacity-90"
        >
          {strings.toolbar.new}
        </button>
      </div>
    </div>
  )
}

function AboutDialog({
  currentVersion,
  onClose
}: {
  currentVersion: string | null
  onClose: () => void
}): JSX.Element {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="surface-3 w-80 rounded-xl border border-subtle p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#f0a868] via-[#b95ce4] to-[#6f9fd8]">
          <span className="text-lg font-bold text-white">M↓</span>
        </div>
        <h2 className="text-lg font-semibold">{strings.appName}</h2>
        <p className="mt-1 text-xs text-[var(--text-dim)]">{strings.settings.stack}</p>
        {currentVersion && (
          <p className="mt-3 text-xs text-[var(--text-dim)]">
            {strings.settings.version} {currentVersion}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="surface-3 rounded-md border border-subtle px-3 py-1.5 text-xs font-medium transition hover:opacity-90"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}