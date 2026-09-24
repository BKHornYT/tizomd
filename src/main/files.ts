/**
 * File reading, folder walking and the save-time changed-on-disk guard.
 * Pure node (no electron) so the guard logic is testable under plain Node.
 */
import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs'
import { basename, join, dirname } from 'node:path'
import type { DiskState, FileStat, TreeNode, ReadFileResult, SaveFileResult } from '../shared/types'

export function statDisk(path: string): DiskState {
  try {
    const s = statSync(path)
    return { exists: true, mtimeMs: s.mtimeMs, size: s.size }
  } catch {
    return { exists: false, mtimeMs: 0, size: 0 }
  }
}

export function readTextFile(path: string): ReadFileResult {
  const stat = statDisk(path)
  if (!stat.exists) return { ok: false, error: `ENOENT: ${path}` }
  return { ok: true, text: readFileSync(path, 'utf-8'), stat }
}

/**
 * The file-changed-on-disk guard, applied before every save. If the file moved
 * under us (mtime or size differ from the snapshot captured at load/save), we
 * refuse to overwrite it and hand back the newer content instead. The caller
 * keeps the user's unsaved buffer in recovery — nothing is merged or dropped.
 */
export function saveTextFile(
  path: string,
  text: string,
  expected: FileStat | null
): SaveFileResult {
  if (expected) {
    const now = statDisk(path)
    if (now.exists && (now.mtimeMs !== expected.mtimeMs || now.size !== expected.size)) {
      let currentText: string
      try {
        currentText = readFileSync(path, 'utf-8')
      } catch {
        return { ok: false, changed: false, error: 'The file changed on disk and no longer could be read.' }
      }
      return { ok: false, changed: true, current: { text: currentText, stat: now } }
    }
  }
  try {
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, text, 'utf-8')
    return { ok: true, stat: statDisk(path) }
  } catch (err) {
    return { ok: false, changed: false, error: err instanceof Error ? err.message : String(err) }
  }
}

const MAX_TREE_DEPTH = 12
const SKIPPED_DIRS = new Set(['node_modules', '.git', '.github', '.idea', '.vscode'])

/**
 * Recursive listing of a folder, filtered to directories and markdown files.
 * `children` is null for files, an array for directories.
 */
export function walkTree(root: string, depth = 0): TreeNode[] | null {
  if (depth > MAX_TREE_DEPTH) return []
  let entries
  try {
    entries = readdirSync(root, { withFileTypes: true })
  } catch {
    return null
  }
  const out: TreeNode[] = []
  for (const entry of entries) {
    const name = entry.name
    if (name.startsWith('.')) continue
    if (entry.isDirectory()) {
      if (SKIPPED_DIRS.has(name)) continue
      out.push({
        name,
        path: join(root, name),
        dir: true,
        children: walkTree(join(root, name), depth + 1) ?? []
      })
    } else if (entry.isFile() && isMarkdownFile(name)) {
      out.push({ name, path: join(root, name), dir: false, children: null })
    }
  }
  out.sort((a, b) => (a.dir === b.dir ? a.name.localeCompare(b.name) : a.dir ? -1 : 1))
  return out
}

export function isMarkdownFile(name: string): boolean {
  return /\.md$/i.test(name) || /\.markdown$/i.test(name)
}

export function fileTitle(path: string): string {
  return basename(path)
}