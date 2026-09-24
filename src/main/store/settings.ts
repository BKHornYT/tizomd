/**
 * Persisted user settings, validated field-by-field on read so a half-written
 * or hand-edited settings.json degrades to defaults instead of crashing.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { app } from 'electron'
import type { Settings, Theme, ViewMode } from '../../shared/types'

export const DEFAULT_SETTINGS: Settings = {
  theme: 'light',
  viewMode: 'preview',
  editorFontSize: 15,
  sidebarOpen: true,
  openFolder: null
}

function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

export function loadSettings(): Settings {
  const out = { ...DEFAULT_SETTINGS }
  try {
    const parsed = JSON.parse(readFileSync(settingsPath(), 'utf-8')) as Partial<Settings>
    if (parsed.theme === 'dark' || parsed.theme === 'light') out.theme = parsed.theme
    if (isViewMode(parsed.viewMode)) out.viewMode = parsed.viewMode
    if (isWholeNumber(parsed.editorFontSize)) out.editorFontSize = parsed.editorFontSize
    if (typeof parsed.sidebarOpen === 'boolean') out.sidebarOpen = parsed.sidebarOpen
    if (typeof parsed.openFolder === 'string') out.openFolder = parsed.openFolder
  } catch {
    // First run, or a corrupt file — defaults are fine.
  }
  return out
}

export function saveSettings(settings: Settings): Settings {
  const path = settingsPath()
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(settings, null, 2), 'utf-8')
  return settings
}

function isViewMode(v: unknown): v is ViewMode {
  return v === 'preview' || v === 'split' || v === 'raw'
}

function isWholeNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 8 && v <= 32
}

export function isTheme(v: unknown): v is Theme {
  return v === 'dark' || v === 'light'
}