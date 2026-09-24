import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { JSX, MouseEvent } from 'react'
import DOMPurify from 'dompurify'
import type { ViewMode } from '../../../shared/types'
import { renderMarkdown, replaceLines, splitBlocks } from '../../../shared/markdown'
import { strings } from '../strings'
import Icon from '../components/Icon'

type Notice = 'disk-changed' | 'recovery' | null

interface EditorTab {
  key: string
  title: string
  text: string
  cursor: number
  scroll: number
  dirty: boolean
  notice: Notice
}

/**
 * The Typora-style editing surface: a clean, centered page. Save / open /
 * export live in the native menu (Ctrl+S etc.); the only chrome left is a
 * thin status strip with the saved-state and the view-mode switcher on the
 * right, like a document app.
 *
 * `preview` renders the cleaned document and swaps any single block for a raw
 * textarea when clicked (commit on blur / Ctrl+Enter, cancel on Escape). The
 * preview owns no content while a block is being edited — the textarea is
 * DOM-added on top of the rendered block, and only on commit is the buffer
 * updated, so the caret is never thrown away by a re-render.
 *
 * `split` is a live raw source editor beside a live preview; `raw` is that
 * source editor alone. Mode switching never touches the buffer.
 */
export default function EditorPane({
  tab,
  viewMode,
  fontSize,
  onText,
  onCursor,
  onScroll,
  onNotice
}: {
  tab: EditorTab
  viewMode: ViewMode
  fontSize: number
  onText: (text: string) => void
  onCursor: (cursor: number) => void
  onScroll: (scroll: number) => void
  onNotice: (notice: Notice, action?: 'restore' | 'discard') => void
}): JSX.Element {
  const blocks = useMemo(() => splitBlocks(tab.text), [tab.text])
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const previewRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const editingValue = useRef<string | null>(null)
  const mountedScroll = useRef(false)

  // --- rendered preview ----------------------------------------------------
  const renderPreview = useCallback((): void => {
    const el = previewRef.current
    if (!el) return
    const rawHtml = renderMarkdown(tab.text)
    el.innerHTML = DOMPurify.sanitize(rawHtml, { USE_PROFILES: { html: true } })
    // Tag each top-level block so clicking maps back to splitBlocks order in a
    // way that survives any token/DOM mismatch.
    Array.from(el.children).forEach((child, i) => {
      child.setAttribute('data-block-index', String(i))
    })
  }, [tab.text])

  useEffect(() => {
    renderPreview()
    // A freshly opened tab restores its previous scroll.
    if (!mountedScroll.current && tab.scroll > 0 && previewRef.current) {
      previewRef.current.scrollTop = tab.scroll
      mountedScroll.current = true
    }
  }, [renderPreview, tab.scroll])

  // --- open a block editor over the preview ---------------------------------
  useEffect(() => {
    if (viewMode !== 'preview') {
      setEditingIndex(null)
      editingValue.current = null
      return
    }
    if (editingIndex === null) return
    const el = previewRef.current
    if (!el) return
    const child = el.children[editingIndex]
    if (!child || child.getAttribute('data-tizo-editing') === '1') return
    const block = blocks[editingIndex]
    if (!block) {
      setEditingIndex(null)
      return
    }
    child.setAttribute('data-tizo-editing', '1')
    child.innerHTML = ''
    const ta = document.createElement('textarea')
    ta.value = editingValue.current ?? block.text
    ta.spellcheck = false
    ta.className =
      'w-full resize-none bg-transparent p-0 font-normal text-[var(--text)] outline-none ' +
      (child.nodeName === 'PRE' ? 'mono text-[0.88em]' : '')
    ta.style.fontSize = 'inherit'
    ta.style.lineHeight = 'inherit'
    child.appendChild(ta)
    textareaRef.current = ta
    ta.addEventListener('input', () => {
      editingValue.current = ta.value
    })
    ta.addEventListener('blur', () => commitBlock())
    ta.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        cancelBlock()
      } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey || event.altKey)) {
        event.preventDefault()
        commitBlock()
        // Enter on a single-line block commits too — editing is click-to-fix,
        // not a stay-in mode.
      } else if (event.key === 'Enter' && ta.value.split('\n').length <= 1) {
        event.preventDefault()
        commitBlock()
      }
    })
    ta.focus()
    if (child.nodeName === 'PRE') {
      ta.select()
    } else {
      ta.setSelectionRange(ta.value.length, ta.value.length)
    }
  }, [editingIndex, viewMode, blocks])

  const commitBlock = useCallback((): void => {
    const block = editingIndex !== null ? blocks[editingIndex] : null
    const ta = textareaRef.current
    if (!block || !ta) return
    const next = ta.value
    if (next !== block.text) {
      onText(replaceLines(tab.text, block.start, block.end, next))
    }
    setEditingIndex(null)
    editingValue.current = null
    textareaRef.current = null
  }, [editingIndex, blocks, tab.text, onText])

  const cancelBlock = useCallback((): void => {
    setEditingIndex(null)
    editingValue.current = null
    textareaRef.current = null
  }, [])

  const openBlock = useCallback(
    (index: number): void => {
      const block = blocks[index]
      if (!block) return
      editingValue.current = block.text
      setEditingIndex(index)
    },
    [blocks]
  )

  const handlePreviewClick = useCallback(
    (event: MouseEvent): void => {
      if (viewMode !== 'preview') return
      if (editingIndex !== null) {
        // Commit first; the block layout may shift, so the clicked index is
        // only trusted for a fresh click.
        commitBlock()
        return
      }
      const el = previewRef.current
      if (!el) return
      let target = event.target as HTMLElement | null
      while (target && target !== el) {
        const idx = Number(target.getAttribute?.('data-block-index') ?? NaN)
        if (Number.isInteger(idx) && idx >= 0) {
          openBlock(idx)
          return
        }
        target = target.parentElement
      }
    },
    [viewMode, editingIndex, commitBlock, openBlock]
  )

  // --- raw / split source editor --------------------------------------------
  const mountedCursor = useRef(false)
  const rawRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    if (viewMode === 'preview') return
    const ra = rawRef.current
    if (ra) {
      ra.style.fontSize = `${fontSize}px`
      if (!mountedCursor.current && tab.cursor > 0) {
        ra.setSelectionRange(tab.cursor, tab.cursor)
        mountedCursor.current = true
      }
      if (!mountedScroll.current && tab.scroll > 0) {
        ra.scrollTop = tab.scroll
      }
    }
  }, [viewMode, fontSize, tab.cursor, tab.scroll])

  const rawEditor = (
    <textarea
      ref={rawRef}
      className="raw-editor h-full w-full resize-none bg-transparent p-5 text-[var(--text)] outline-none"
      value={tab.text}
      spellCheck={false}
      style={{ fontSize: `${fontSize}px` }}
      onChange={(e) => onText(e.target.value)}
      onSelect={(e) => onCursor(e.currentTarget.selectionStart)}
      onScroll={(e) => onScroll(e.currentTarget.scrollTop)}
    />
  )

  // The preview is a centered paper column — the text carries the design.
  const preview = (
    <div
      ref={previewRef}
      onClick={handlePreviewClick}
      className="md-body mx-auto h-full w-full max-w-[46rem] overflow-y-auto px-8 py-6"
      style={{ fontSize: `${fontSize}px` }}
      onScroll={(e) => onScroll(e.currentTarget.scrollTop)}
    />
  )

  return (
    <div className="flex h-full flex-col">
      {tab.notice && (
        <NoticeBar
          notice={tab.notice}
          onRestore={() => onNotice(tab.notice, 'restore')}
          onDiscard={() => onNotice(tab.notice, 'discard')}
          onDismiss={() => onNotice(null)}
        />
      )}

      <div className="min-h-0 flex-1">
        {viewMode === 'preview' && preview}
        {viewMode === 'raw' && <div className="surface h-full overflow-hidden">{rawEditor}</div>}
        {viewMode === 'split' && (
          <div className="flex h-full">
            <div className="surface h-full min-w-0 flex-1 border-r border-subtle">{rawEditor}</div>
            {preview}
          </div>
        )}
      </div>
    </div>
  )
}

function NoticeBar({
  notice,
  onRestore,
  onDiscard,
  onDismiss
}: {
  notice: Exclude<Notice, null>
  onRestore: () => void
  onDiscard: () => void
  onDismiss: () => void
}): JSX.Element {
  const isDisk = notice === 'disk-changed'
  return (
    <div className="surface-3 flex shrink-0 items-center gap-3 border-b border-subtle px-4 py-2.5 text-xs">
      <Icon name="warn" className="h-4 w-4 shrink-0" />
      <div className="min-w-0">
        <p className="font-semibold text-[var(--danger)]">
          {isDisk ? strings.notice.diskChangedTitle : strings.notice.recoveryTitle}
        </p>
        <p className="text-[var(--text-dim)]">
          {isDisk ? strings.notice.diskChangedBody : strings.notice.recoveryBody}
        </p>
      </div>
      <button
        onClick={onRestore}
        className="shrink-0 rounded-md bg-[var(--accent)] px-3 py-1.5 font-medium text-white transition hover:opacity-90"
      >
        {isDisk ? strings.notice.diskChangedRestore : strings.notice.recoveryKeep}
      </button>
      <button
        onClick={onDiscard}
        className="shrink-0 rounded-md border border-subtle px-3 py-1.5 font-medium text-[var(--text-dim)] transition hover:bg-[var(--border)]"
      >
        {isDisk ? strings.notice.diskChangedDiscard : strings.notice.recoveryDiscard}
      </button>
      <button
        onClick={onDismiss}
        className="shrink-0 text-[var(--text-dim)] transition hover:text-[var(--text)]"
        title="Dismiss"
      >
        <Icon name="x" className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}