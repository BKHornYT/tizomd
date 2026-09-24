import { useEffect, useState } from 'react'
import type { JSX } from 'react'
import { strings } from '../strings'
import Icon from './Icon'

/**
 * The app's only chrome now that the OS frame is gone: a sliver of drag region
 * with the M mark and the three window controls. Everything below it is the
 * editor. `-webkit-app-region` turns this row into the window's move handle;
 * the buttons carve themselves back out with .app-no-drag.
 */
export default function TitleBar(): JSX.Element {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    void window.tizomd.windowControls.isMaximized().then(setMaximized)
    return window.tizomd.windowControls.onMaximized(setMaximized)
  }, [])

  return (
    <div className="app-drag flex h-[34px] shrink-0 select-none items-center border-b border-subtle">
      <div className="flex min-w-0 items-center gap-2 pl-3">
        <div className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] bg-gradient-to-br from-[#f0a868] via-[#b95ce4] to-[#6f9fd8]">
          <span className="text-[11px] font-bold leading-none text-white">M</span>
        </div>
        <span className="truncate text-[12px] font-medium tracking-wide text-[var(--text-dim)]">
          {strings.appName}
        </span>
      </div>

      <div className="flex-1" />

      <div className="app-no-drag flex h-full items-stretch">
        <button
          onClick={() => void window.tizomd.windowControls.minimize()}
          title="Minimize"
          className="flex w-[46px] items-center justify-center text-[var(--text-dim)] transition hover:bg-[var(--surface-3)] hover:text-[var(--text)]"
        >
          <Icon name="minus" className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => void window.tizomd.windowControls.toggleMaximize()}
          title={maximized ? 'Restore' : 'Maximize'}
          className="flex w-[46px] items-center justify-center text-[var(--text-dim)] transition hover:bg-[var(--surface-3)] hover:text-[var(--text)]"
        >
          <Icon name={maximized ? 'restore' : 'square'} className="h-3 w-3" />
        </button>
        <button
          onClick={() => void window.tizomd.windowControls.close()}
          title="Close"
          className="flex w-[46px] items-center justify-center text-[var(--text-dim)] transition hover:bg-[#e81123] hover:text-white"
        >
          <Icon name="x" className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}