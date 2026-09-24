import { useState } from 'react'
import type { JSX } from 'react'
import type { TreeNode } from '../../../shared/types'
import { strings } from '../strings'
import Icon from './Icon'

/**
 * Sidebar file tree. Owns its own expanded state — a folder that is collapsed
 * stays collapsed until the user says otherwise; opening the tree defaults to
 * all expansions, the useful thing for a folder of markdown notes.
 */
export default function FileTree({
  tree,
  activePath,
  onPick,
  onRefresh
}: {
  tree: TreeNode[] | null
  activePath?: string
  onPick: (path: string) => void
  onRefresh: () => void
}): JSX.Element {
  const [toggled, setToggled] = useState<Record<string, boolean>>({})

  // Default open; a path in `toggled` overrides to folder state.
  const isOpen = (path: string): boolean => toggled[path] ?? true

  const toggle = (path: string): void => {
    setToggled((prev) => ({ ...prev, [path]: !(prev[path] ?? true) }))
  }

  return (
    <aside className="surface-2 flex w-52 shrink-0 flex-col border-r border-subtle">
      <div className="flex items-center justify-end px-2 pt-1.5">
        <button
          onClick={onRefresh}
          title={strings.tree.refresh}
          className="rounded text-[var(--text-dim)] transition hover:text-[var(--text)]"
        >
          <Icon name="refresh" className="h-3 w-3" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2 pt-1">
        {tree && tree.length > 0 ? (
          <ul className="space-y-px">
            {tree.map((node) => (
              <TreeRow
                key={node.path}
                node={node}
                depth={0}
                isOpen={isOpen}
                activePath={activePath}
                onPick={onPick}
                onToggle={toggle}
              />
            ))}
          </ul>
        ) : (
          <p className="px-2 py-4 text-xs leading-relaxed text-[var(--text-dim)]">
            {strings.tree.empty}
          </p>
        )}
      </div>
    </aside>
  )
}

function TreeRow({
  node,
  depth,
  isOpen,
  activePath,
  onPick,
  onToggle
}: {
  node: TreeNode
  depth: number
  isOpen: (path: string) => boolean
  activePath?: string
  onPick: (path: string) => void
  onToggle: (path: string) => void
}): JSX.Element {
  const isActive = !node.dir && activePath === node.path
  return (
    <li>
      <button
        onClick={() => (node.dir ? onToggle(node.path) : onPick(node.path))}
        className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-[13px] transition ${
          isActive
            ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
            : 'text-[var(--text-dim)] hover:bg-[var(--border)] hover:text-[var(--text)]'
        }`}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
      >
        {node.dir ? (
          <>
            <Icon
              name="chevronRight"
              className={`h-3 w-3 shrink-0 transition-transform ${isOpen(node.path) ? 'rotate-90' : ''}`}
            />
            <Icon name="folder" className="h-3.5 w-3.5 shrink-0" />
          </>
        ) : (
          <span className="w-[18px]" />
        )}
        <span className="truncate">{node.name}</span>
      </button>
      {node.dir && isOpen(node.path) && node.children && node.children.length > 0 && (
        <ul className="space-y-px">
          {node.children.map((child) => (
            <TreeRow
              key={child.path}
              node={child}
              depth={depth + 1}
              isOpen={isOpen}
              activePath={activePath}
              onPick={onPick}
              onToggle={onToggle}
            />
          ))}
        </ul>
      )}
    </li>
  )
}