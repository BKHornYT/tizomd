/**
 * Markdown rendering, shared between main (HTML/PDF export) and renderer
 * (preview). Pure: no electron, no DOM, so it runs under plain Node in tests.
 *
 * Security is locked here, not borrowed from a component:
 * - `html: false` — raw HTML in a .md file is ESCAPED to text, never emitted.
 *   A malicious readme that ships an <img onerror> or an <iframe> renders as
 *   the text of a hostile document, not as live markup.
 * - `linkify`/link validation — markdown-it rejects javascript:, file: and
 *   vbscript: links by default. Data: URIs are allowed only for images.
 * - The renderer additionally runs the output through DOMPurify before it
 *   reaches the DOM. That is defense in depth against anything this layer or a
 *   future markdown-it version emits.
 */
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js/lib/common'

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  breaks: false,
  highlight(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value
      } catch {
        // Fall through to escaped, unhighlighted output.
      }
    }
    return ''
  }
})

/** Renders a markdown source string to HTML. Callers sanitize before injecting. */
export function renderMarkdown(src: string): string {
  return md.render(src)
}

// --- Typora-style block editing ---------------------------------------------

/**
 * One clickable block in a rendered document, mapped back onto the source.
 * `start`/`end` are line indices in the LF-normalized source; `text` is exactly
 * `lines[start..end]`, so editing the block means replacing those lines.
 */
export interface Block {
  start: number
  end: number
  text: string
}

/**
 * Splits a markdown source into the blocks markdown-it renders as top-level
 * elements, using each block token's `map` (its source line range). Nested
 * tokens (a paragraph inside a list item) share the parent's range, so the
 * `cursor` monotonic filter keeps only the outermost block — a whole list is
 * one editable block, matching what the preview draws as one box.
 */
export function splitBlocks(src: string): Block[] {
  const lines = src.split('\n')
  const blocks: Block[] = []
  let cursor = 0
  for (const token of md.parse(src, {})) {
    const map = token.map
    if (!map) continue
    if (map[0] < cursor) continue
    const start = Math.max(0, map[0])
    const end = Math.min(lines.length, map[1])
    if (end <= start) continue
    blocks.push({ start, end, text: lines.slice(start, end).join('\n') })
    cursor = end
  }
  return blocks
}

/**
 * Replaces source lines `[start, end)` with `replacement` — the inverse of
 * `splitBlocks`. Editing a block is `src = replaceLines(src, block.start,
 * block.end, editedText)`; everything outside the block is untouched.
 */
export function replaceLines(src: string, start: number, end: number, replacement: string): string {
  const lines = src.split('\n')
  const before = lines.slice(0, start)
  const after = lines.slice(end)
  return [...before, ...replacement.split('\n'), ...after].join('\n')
}