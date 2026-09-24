import type { JSX, ReactNode } from 'react'
import type { Settings } from '../../../shared/types'
import { strings } from '../strings'
import Icon from '../components/Icon'

export default function SettingsView({
  settings,
  onBack,
  onChanged
}: {
  settings: Settings
  onBack: () => void
  onChanged: (s: Settings) => void
}): JSX.Element {
  const persist = async (patch: Partial<Settings>): Promise<void> => {
    const next = await window.tizomd.settings.set(patch)
    onChanged(next)
  }

  return (
    <main className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-xl px-8 py-8">
        <button
          onClick={onBack}
          className="mb-6 flex items-center gap-2 text-sm text-[var(--text-dim)] transition hover:text-[var(--text)]"
        >
          <Icon name="back" className="h-4 w-4" />
          {strings.settings.back}
        </button>

        <h1 className="mb-6 text-xl font-semibold">{strings.settings.title}</h1>

        <section className="space-y-5">
          <SettingRow label={strings.settings.theme}>
            <Segmented
              value={settings.theme}
              options={[
                { value: 'dark', label: strings.settings.dark },
                { value: 'light', label: strings.settings.light }
              ]}
              onPick={(value) => void persist({ theme: value as 'dark' | 'light' })}
            />
          </SettingRow>

          <SettingRow label={strings.settings.viewMode}>
            <Segmented
              value={settings.viewMode}
              options={[
                { value: 'preview', label: strings.settings.preview, short: strings.editor.previewMode },
                { value: 'split', label: strings.settings.split, short: strings.editor.splitMode },
                { value: 'raw', label: strings.settings.raw, short: strings.editor.rawMode }
              ]}
              onPick={(value) => void persist({ viewMode: value as 'preview' | 'split' | 'raw' })}
            />
          </SettingRow>

          <SettingRow label={strings.settings.fontSize}>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={11}
                max={22}
                step={1}
                value={settings.editorFontSize}
                onChange={(e) => void persist({ editorFontSize: Number(e.target.value) })}
                className="accent-[var(--accent)]"
              />
              <span className="mono w-8 text-xs text-[var(--text-dim)]">
                {settings.editorFontSize}px
              </span>
            </div>
          </SettingRow>

          <SettingRow label={strings.settings.sidebar}>
            <input
              type="checkbox"
              checked={settings.sidebarOpen}
              onChange={(e) => void persist({ sidebarOpen: e.target.checked })}
              className="h-4 w-4 accent-[var(--accent)]"
            />
          </SettingRow>
        </section>

        <section className="mt-10">
          <h2 className="mb-1 text-sm font-semibold">{strings.settings.about}</h2>
          <p className="text-xs text-[var(--text-dim)]">
            {strings.appName} · {strings.settings.version} · {strings.settings.stack}
          </p>
        </section>
      </div>
    </main>
  )
}

function SettingRow({
  label,
  children
}: {
  label: string
  children: ReactNode
}): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-6">
      <label className="text-sm text-[var(--text-dim)]">{label}</label>
      {children}
    </div>
  )
}

function Segmented({
  value,
  options,
  onPick
}: {
  value: string
  options: Array<{ value: string; label: string; short?: string }>
  onPick: (value: string) => void
}): JSX.Element {
  return (
    <div className="surface-3 flex overflow-hidden rounded-lg border border-subtle">
      {options.map((option) => {
        const isActive = option.value === value
        return (
          <button
            key={option.value}
            onClick={() => onPick(option.value)}
            className={`px-3 py-1.5 text-xs font-medium transition ${
              isActive ? 'bg-[var(--surface)] text-[var(--text)]' : 'text-[var(--text-dim)] hover:text-[var(--text)]'
            }`}
          >
            {option.short ?? option.label}
          </button>
        )
      })}
    </div>
  )
}