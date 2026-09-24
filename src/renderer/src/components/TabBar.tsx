import type { JSX } from 'react'
import { strings } from '../strings'
import Icon from './Icon'

/**
 * Slim Typora-style tab strip: plain filenames, the active tab underlined,
 * a small dot for unsaved. No chrome, no colour.
 */
export default function TabBar({
  tabs,
  activeKey,
  onPick,
  onClose
}: {
  tabs: Array<{ key: string; title: string; dirty: boolean; exists: boolean }>
  activeKey: string | null
  onPick: (key: string) => void
  onClose: (key: string) => void
}): JSX.Element {
  return (
    <div className="surface flex shrink-0 items-stretch gap-0.5 overflow-x-auto border-b border-subtle px-2">
      {tabs.map((tab) => {
        const isActive = tab.key === activeKey
        return (
          <div
            key={tab.key}
            onClick={() => onPick(tab.key)}
            className={`group relative flex cursor-pointer items-center gap-1.5 border-b-2 px-2.5 py-[7px] text-[13px] transition ${
              isActive
                ? 'border-[var(--accent)] bg-[var(--surface-3)] text-[var(--text)]'
                : 'border-transparent text-[var(--text-dim)] hover:bg-[var(--surface-3)] hover:text-[var(--text)]'
            }`}
          >
            <span className="max-w-44 truncate">{tab.title}</span>
            {!tab.exists && (
              <span
                className="text-[10px] text-[var(--danger)]"
                title={strings.state.missing}
              >
                ●
              </span>
            )}
            {tab.dirty && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--danger)]" />}
            <button
              onClick={(e) => {
                e.stopPropagation()
                onClose(tab.key)
              }}
              title={strings.tabs.close}
              className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[var(--text-dim)] opacity-0 transition group-hover:opacity-100 hover:bg-[var(--border)] hover:text-[var(--text)]"
            >
              <Icon name="x" className="h-3 w-3" />
            </button>
          </div>
        )
      })}
    </div>
  )
}