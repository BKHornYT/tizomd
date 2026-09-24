import { useCallback, useEffect, useDeferredValue, useMemo, useRef, useState } from 'react'
import type { JSX, MouseEvent, PointerEvent as ReactPointerEvent } from 'react'
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
  // Blocks drive the Typora click-to-edit overlay, which only exists in
  // preview/split; splitting a big document on every keystroke in raw mode
  // is pure waste, so it is skipped there.
  const showBlocks = viewMode === 'preview' || viewMode === 'split'
  const blocks = useMemo(() => (showBlocks ? splitBlocks(tab.text) : []), [showBlocks, tab.text])
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const previewRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const editingValue = useRef<string | null>(null)
  // Fresh mirrors of state for the imperative overlay listeners and the deferred
  // preview rebuild, so a long-lived textarea or a stale render never acts on a
  // stale closure.
  const editingIndexRef = useRef<number | null>(null)
  const viewModeRef = useRef<ViewMode>(viewMode)
  const blocksRef = useRef(blocks)
  const savedBlockHtmlRef = useRef<string | null>(null)
  const applyOverlayRef = useRef<(index: number) => void>(() => {})
  const commitBlockRef = useRef<() => void>(() => {})
  const cancelBlockRef = useRef<() => void>(() => {})
  editingIndexRef.current = editingIndex
  viewModeRef.current = viewMode
  blocksRef.current = blocks

  // --- split ratio ---------------------------------------------------------
  const [leftPercent, setLeftPercent] = useState(50)
  const [dragging, setDragging] = useState(false)
  const draggingRef = useRef(false)
  const splitRef = useRef<HTMLDivElement | null>(null)

  const percentAt = useCallback((clientX: number): number => {
    const el = splitRef.current
    if (!el) return 50
    const rect = el.getBoundingClientRect()
    const pct = ((clientX - rect.left) / rect.width) * 100
    return Math.min(80, Math.max(20, pct))
  }, [])

  const onDividerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>): void => {
      if (e.button !== 0) return
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      draggingRef.current = true
      setDragging(true)
      setLeftPercent(percentAt(e.clientX))
    },
    [percentAt]
  )

  const onDividerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>): void => {
      if (!draggingRef.current) return
      setLeftPercent(percentAt(e.clientX))
    },
    [percentAt]
  )

  const onDividerUp = useCallback((): void => {
    if (!draggingRef.current) return
    draggingRef.current = false
    setDragging(false)
  }, [])

  // --- rendered preview ----------------------------------------------------
  // Typing in a split/raw source editor updates the document every keystroke;
  // rendering markdown is the expensive part. Deferring it lets React keep the
  // input responsive and do the render in idle time, so a big file still types
  // at full speed while the preview trails by a beat.
  const deferredText = useDeferredValue(tab.text)
  const renderPreview = useCallback((): void => {
    const el = previewRef.current
    if (!el) return
    const rawHtml = renderMarkdown(deferredText)
    el.innerHTML = DOMPurify.sanitize(rawHtml, { USE_PROFILES: { html: true } })
    // Tag each top-level block so clicking maps back to splitBlocks order in a
    // way that survives any token/DOM mismatch.
    Array.from(el.children).forEach((child, i) => {
      child.setAttribute('data-block-index', String(i))
    })
    // A rebuild lands ~one beat after the last commit's text does, and the fresh
    // innerHTML would silently destroy a block editor that is still open. Re-attach
    // it against the fresh nodes so an editor survives its own deferred re-render.
    const idx = editingIndexRef.current
    if (viewModeRef.current === 'preview' && idx !== null) {
      applyOverlayRef.current(idx)
    }
  }, [deferredText])

  // The preview node unmounts on every mode switch (it lives at different tree
  // positions in preview vs split) and remounts blank. So: render when the node
  // is fresh or the text changed, never on a scroll-only change — reading must
  // not rebuild the document (or kill an in-progress block edit), and returning
  // from split/raw must not come back empty.
  const lastRenderedText = useRef<string | null>(null)
  const restoreScrollNext = useRef(false)
  useEffect(() => {
    const el = previewRef.current
    if (!el || (viewMode !== 'preview' && viewMode !== 'split')) return
    const fresh = el.childElementCount === 0
    if (fresh || lastRenderedText.current !== deferredText) {
      renderPreview()
      lastRenderedText.current = deferredText
      restoreScrollNext.current = fresh
    }
    if (restoreScrollNext.current) {
      el.scrollTop = tab.scroll
      restoreScrollNext.current = false
    }
  }, [viewMode, tab.scroll, deferredText, renderPreview])

  // --- open a block editor over the preview ----------------------------------
  // The overlay lives imperatively on top of the rendered block. The block's
  // formatted HTML is captured when the editor opens and restoreBlock sends it
  // back when the edit ends — crucial for a commit that changed nothing: in that
  // case nothing re-renders, so without the restore the block stays stuck as a
  // bare textarea. A commit that DID change the text restores a fresh render of
  // the new text, so no stale copy flashes before the deferred preview catches up.
  const restoreBlock = useCallback((index: number, html: string): void => {
    const el = previewRef.current
    if (!el || viewModeRef.current !== 'preview') return
    const child = el.children[index]
    if (child) child.outerHTML = html
  }, [])

  const renderBlockHtml = useCallback((text: string, index: number): string | null => {
    const host = document.createElement('div')
    host.innerHTML = DOMPurify.sanitize(renderMarkdown(text), { USE_PROFILES: { html: true } })
    const node = host.firstElementChild
    if (!node) return null
    node.setAttribute('data-block-index', String(index))
    return node.outerHTML
  }, [])

  const applyOverlay = useCallback((index: number): void => {
    const el = previewRef.current
    if (!el || viewModeRef.current !== 'preview') return
    const block = blocksRef.current[index]
    if (!block || index < 0) {
      setEditingIndex(null)
      savedBlockHtmlRef.current = null
      return
    }
    const child = el.children[index] as HTMLElement | undefined
    if (!child || child.getAttribute('data-tizo-editing') === '1') return
    // Keep the formatted copy around so the block can go back to it on exit.
    savedBlockHtmlRef.current = child.outerHTML
    // Fit the edit surface to the block that was there: measure before clearing
    // and re-grow on input, so entering/leaving edit mode never jumps the layout.
    const settledHeight = Math.max(child.getBoundingClientRect().height, 24)
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
    ta.style.whiteSpace = 'pre-wrap'
    ta.style.overflow = 'hidden'
    const autosize = (): void => {
      ta.style.height = 'auto'
      ta.style.height = `${Math.max(settledHeight, ta.scrollHeight)}px`
    }
    child.appendChild(ta)
    textareaRef.current = ta
    ta.addEventListener('input', () => {
      editingValue.current = ta.value
      autosize()
    })
    // Listeners go through refs so a textarea that outlives a render always talks
    // to the latest handlers (Escape must discard even after a later render).
    ta.addEventListener('blur', () => commitBlockRef.current())
    ta.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        cancelBlockRef.current()
      } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey || event.altKey)) {
        event.preventDefault()
        commitBlockRef.current()
        // Enter on a single-line block commits too — editing is click-to-fix,
        // not a stay-in mode.
      } else if (event.key === 'Enter' && ta.value.split('\n').length <= 1) {
        event.preventDefault()
        commitBlockRef.current()
      }
    })
    ta.focus()
    autosize()
    if (child.nodeName === 'PRE') {
      ta.select()
    } else {
      ta.setSelectionRange(ta.value.length, ta.value.length)
    }
  }, [])
  applyOverlayRef.current = applyOverlay

  useEffect(() => {
    if (viewMode !== 'preview') {
      savedBlockHtmlRef.current = null
      setEditingIndex(null)
      editingValue.current = null
      return
    }
    if (editingIndex === null) return
    applyOverlay(editingIndex)
  }, [editingIndex, viewMode, applyOverlay])

  // Idempotent: clearing textareaRef on entry means a blur-then-click pair (or
  // two events for one physical click) can safely both call commitBlock — the
  // second one is a no-op instead of replacing a second, wrong block.
  const commitBlock = useCallback((): void => {
    const ta = textareaRef.current
    if (!ta) return
    textareaRef.current = null
    const idx = editingIndexRef.current
    const block = idx !== null ? blocksRef.current[idx] : null
    if (!block || idx === null) {
      setEditingIndex(null)
      editingValue.current = null
      savedBlockHtmlRef.current = null
      return
    }
    const next = ta.value
    if (next !== block.text) {
      onText(replaceLines(tab.text, block.start, block.end, next))
    }
    // Always send the block back to its formatted state, even on a no-change
    // commit where no re-render is coming to clear the textarea for us. With a
    // change, restore a render of the fresh text so the old copy never flashes.
    const saved = savedBlockHtmlRef.current
    if (saved) {
      if (next !== block.text) {
        const html = renderBlockHtml(next, idx)
        if (html) restoreBlock(idx, html)
      } else {
        restoreBlock(idx, saved)
      }
      savedBlockHtmlRef.current = null
    }
    setEditingIndex(null)
    editingValue.current = null
  }, [tab.text, onText, renderBlockHtml, restoreBlock])
  commitBlockRef.current = commitBlock

  const cancelBlock = useCallback((): void => {
    // Null the ref before the outerHTML replacement, or removing the focused
    // textarea fires blur → commitBlock and Escape would "cancel" by committing.
    textareaRef.current = null
    const idx = editingIndexRef.current
    const saved = savedBlockHtmlRef.current
    if (idx !== null && saved) {
      savedBlockHtmlRef.current = null
      restoreBlock(idx, saved)
    }
    setEditingIndex(null)
    editingValue.current = null
  }, [restoreBlock])
  cancelBlockRef.current = cancelBlock

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
      const el = previewRef.current
      if (!el) return
      let target = event.target as HTMLElement | null
      let clickedIndex = -1
      while (target && target !== el) {
        const idx = Number(target.getAttribute?.('data-block-index') ?? NaN)
        if (Number.isInteger(idx) && idx >= 0) {
          clickedIndex = idx
          break
        }
        target = target.parentElement
      }
      if (editingIndex !== null) {
        // A click inside the block being edited is just a caret move — leave
        // the edit open. Clicking another block commits this one and hops
        // straight into the clicked block, so block-to-block editing is one
        // click; any other click (whitespace, anything) just stops editing.
        // The blur that precedes this click also commits, so commitBlock is a
        // guarded no-op when that already ran.
        if (clickedIndex === editingIndex) return
        commitBlock()
        if (clickedIndex >= 0) openBlock(clickedIndex)
        return
      }
      if (clickedIndex >= 0) openBlock(clickedIndex)
    },
    [viewMode, editingIndex, commitBlock, openBlock]
  )

  // --- raw / split source editor --------------------------------------------
  const rawRef = useRef<HTMLTextAreaElement | null>(null)
  const lastRawNode = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    if (viewMode === 'preview') return
    const ra = rawRef.current
    if (!ra) return
    ra.style.fontSize = `${fontSize}px`
    // The textarea unmounts on mode switches (raw vs split live at different
    // tree positions); only a freshly mounted node takes the saved cursor/scroll.
    // Restoring on every change would fight the live position.
    if (ra !== lastRawNode.current) {
      lastRawNode.current = ra
      ra.setSelectionRange(tab.cursor, tab.cursor)
      ra.scrollTop = tab.scroll
    }
  }, [viewMode, fontSize, tab.cursor, tab.scroll])

  // --- throttled scroll → parent -------------------------------------------
  // scrollTop changes fire per wheel-tick/scrollbar-drag; batching to one
  // requestAnimationFrame per frame keeps the session write down to ~60/s (and
  // the renderer debounce in App stops the IPC storm entirely). The final value
  // is flushed on unmount so switching tabs never loses the read position.
  const onScrollRef = useRef(onScroll)
  onScrollRef.current = onScroll
  const scrollPending = useRef<number | null>(null)
  const scrollFrame = useRef<number | null>(null)
  const queueScroll = useCallback((value: number): void => {
    scrollPending.current = value
    if (scrollFrame.current !== null) return
    scrollFrame.current = requestAnimationFrame(() => {
      scrollFrame.current = null
      const v = scrollPending.current
      if (v !== null) onScrollRef.current(v)
    })
  }, [])
  useEffect(
    () => () => {
      if (scrollFrame.current !== null) cancelAnimationFrame(scrollFrame.current)
      scrollFrame.current = null
      const v = scrollPending.current
      if (v !== null) onScrollRef.current(v)
    },
    []
  )

  const rawEditor = (
    <textarea
      ref={rawRef}
      className="raw-editor h-full w-full resize-none bg-transparent p-5 text-[var(--text)] outline-none"
      value={tab.text}
      spellCheck={false}
      style={{ fontSize: `${fontSize}px` }}
      onChange={(e) => onText(e.target.value)}
      onSelect={(e) => onCursor(e.currentTarget.selectionStart)}
      onScroll={(e) => queueScroll(e.currentTarget.scrollTop)}
    />
  )

  // The preview is a centered paper column — the text carries the design.
  const preview = (
    <div
      ref={previewRef}
      onClick={handlePreviewClick}
      className="md-body mx-auto h-full w-full max-w-[46rem] overflow-y-auto px-8 py-6"
      style={{ fontSize: `${fontSize}px` }}
      onScroll={(e) => queueScroll(e.currentTarget.scrollTop)}
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
          <div ref={splitRef} className="flex h-full select-none">
            <div
              className="relative h-full min-w-0 overflow-hidden"
              style={{ width: `${leftPercent}%` }}
            >
              <div className="surface absolute inset-0">{rawEditor}</div>
            </div>
            <div
              role="separator"
              aria-orientation="vertical"
              aria-valuenow={Math.round(leftPercent)}
              aria-valuemin={20}
              aria-valuemax={80}
              onPointerDown={onDividerDown}
              onPointerMove={onDividerMove}
              onPointerUp={onDividerUp}
              onPointerCancel={onDividerUp}
              className={`group relative z-10 flex w-[7px] shrink-0 cursor-col-resize items-stretch justify-center transition-colors ${
                dragging ? 'bg-[var(--accent-soft)]' : 'hover:bg-[var(--accent-soft)]'
              }`}
            >
              <div className="w-px bg-[var(--border)] group-hover:bg-[var(--accent)]" />
            </div>
            <div className="relative h-full min-w-0 flex-1 overflow-hidden">{preview}</div>
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