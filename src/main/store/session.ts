/**
 * Session memory — the "never lose user content" contract.
 *
 * The renderer owns the live editor state and hands it over on every change
 * (`cacheSession`); this module debounces the write to disk so a keystroke
 * storm cannot hammer the SSD. On the normal quit path `flushSession(true)` is
 * called; a crash leaves the file carrying `clean: false`, which is exactly
 * what tells the next launch that the buffers on disk are a recovery copy —
 * to be offered for restore, never auto-merged or dropped.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { app } from 'electron'
import type { SessionData } from '../../shared/types'

const SESSION_VERSION = 1
const WRITE_DELAY_MS = 400

function defaultSession(): SessionData {
  return { version: SESSION_VERSION, clean: false, active: null, files: {} }
}

function sessionPath(): string {
  return join(app.getPath('userData'), 'session.json')
}

let cached: SessionData = defaultSession()
let timer: NodeJS.Timeout | null = null

function writeSession(data: SessionData): void {
  const path = sessionPath()
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(data), 'utf-8')
}

export function loadSession(): SessionData {
  try {
    const parsed = JSON.parse(readFileSync(sessionPath(), 'utf-8')) as SessionData
    if (parsed && parsed.version === SESSION_VERSION && parsed.files) {
      return { ...defaultSession(), ...parsed }
    }
  } catch {
    // First run, or a file that no longer parses — start clean.
  }
  return defaultSession()
}

/** Latest editor state. Kept in memory; written after a short debounce. */
export function cacheSession(data: SessionData): void {
  cached = data
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    timer = null
    writeSession(cached)
  }, WRITE_DELAY_MS)
}

/** Write the current state immediately and mark it clean (normal quit). */
export function flushSession(clean: boolean): void {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  cached.clean = clean
  writeSession(cached)
}

/** Written synchronously on quit so the next launch has the final state. */
export function finalWrite(): void {
  flushSession(true)
}