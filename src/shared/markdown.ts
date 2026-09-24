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

// --- Find in preview ---------------------------------------------------------

export interface TextMatch {
  start: number
  end: number
}

/**
 * Case-insensitive, non-overlapping match positions of `query` in `text`.
 * Used by the Find-in-preview highlighter over individual preview text nodes,
 * so an element boundary (e.g. **bold** around a match) splits a hit — the
 * same limitation Find-in-page has, and acceptable for a document editor.
 */
export function findMatches(text: string, query: string): TextMatch[] {
  if (!query) return []
  const needle = query.toLowerCase()
  const hay = text.toLowerCase()
  const out: TextMatch[] = []
  let from = 0
  while (from + needle.length <= hay.length) {
    const at = hay.indexOf(needle, from)
    if (at === -1) break
    out.push({ start: at, end: at + needle.length })
    from = at + needle.length
  }
  return out
}

// --- Local images in preview ------------------------------------------------

/**
 * Resolves an `<img src>` found inside a markdown file against the folder the
 * file lives in, into something the browser can actually load. `.md` files
 * refer to sibling images with relative paths; the preview has no idea what
 * folder the document is in without this. Pure string work — no node:path or
 * node:url, because the renderer bundle compiles against this file too.
 *
 * Rules:
 * - http/https/data/file/blob schemes and protocol-relative `//` pass through.
 * - Anything else is treated as a filesystem path and joined onto `baseDir`
 *   (the directory the md file sits in), then returned as a `file://` URL.
 * - Unsupported schemes (javascript:, vbscript:…) return null and are dropped.
 */
export function absolutizeImageSrc(src: string, baseDir: string | null): string | null {
  const target = src.trim()
  if (!target) return null
  const drivePath = /^[a-z]:[\\/]/i.test(target)
  if (!drivePath && /^[a-z][a-z0-9+.-]*:/i.test(target)) {
    // A single-letter "scheme" is a Windows drive (D:\…), not a URL scheme —
    // skip the whitelist for those and treat it as a filesystem path below.
    const scheme = target.slice(0, target.indexOf(':')).toLowerCase()
    const allowed = scheme === 'http' || scheme === 'https' || scheme === 'data' || scheme === 'file' || scheme === 'blob'
    return allowed ? target : null
  }
  if (target.startsWith('//')) return target
  // Untitled tab: no folder to root a relative path on. Leave the src alone so
  // the browser can try its own base URL instead of us nulling a valid image.
  if (!baseDir) return target

  const base = baseDir.replace(/\\/g, '/').replace(/\/+$/, '')
  const win = /^[a-z]:\//i.test(base)
  let fsPath: string
  if (drivePath) {
    fsPath = dotResolve(target.replace(/\\/g, '/'))
  } else if (target.startsWith('/')) {
    // Root-relative: on Windows root it on the drive that holds the document.
    fsPath = dotResolve(`${win ? base.slice(0, 2) : ''}${target}`)
  } else {
    fsPath = dotResolve(`${base}/${target.replace(/\\/g, '/')}`)
  }
  const enc = encodeURI(fsPath).replace(/#/g, '%23').replace(/\?/g, '%3F')
  return win ? `file:///${enc}` : `file://${enc}`
}

function dotResolve(path: string): string {
  const absolute = path.startsWith('/')
  const out: string[] = []
  for (const seg of path.split('/')) {
    if (!seg || seg === '.') continue
    if (seg === '..') {
      if (out.length && out[out.length - 1] !== '..') out.pop()
    } else {
      out.push(seg)
    }
  }
  return (absolute ? '/' : '') + out.join('/')
}