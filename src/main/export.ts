/**
 * Export to HTML and PDF. A .md file becomes a self-contained standalone
 * document (light theme — exports are meant to be read, printed and shared,
 * not to mirror the app's dark editing surface), rendered from the SAME
 * renderMarkdown the preview uses so what you export is what you saw.
 */
import { BrowserWindow } from 'electron'
import { renderMarkdown } from '../shared/markdown'
import type { FileStat } from '../shared/types'

const EXPORT_CSS = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 48px 56px;
    background: #ffffff;
    color: #23263a;
    font-family: 'Segoe UI', -apple-system, system-ui, sans-serif;
    font-size: 15px;
    line-height: 1.7;
    -webkit-font-smoothing: antialiased;
  }
  article { max-width: 780px; margin: 0 auto; }
  h1, h2, h3, h4, h5, h6 { font-weight: 650; line-height: 1.3; margin: 1.6em 0 0.5em; }
  h1 { font-size: 2em; border-bottom: 1px solid #e3e6ee; padding-bottom: 0.3em; }
  h2 { font-size: 1.5em; border-bottom: 1px solid #eef0f5; padding-bottom: 0.25em; }
  h3 { font-size: 1.25em; }
  p { margin: 0.6em 0; }
  a { color: #7a2fb0; text-decoration: none; }
  a:hover { text-decoration: underline; }
  ul, ol { padding-left: 1.6em; }
  li { margin: 0.2em 0; }
  blockquote {
    margin: 1em 0; padding: 0.4em 1.1em;
    border-left: 4px solid #c9b3e6; background: #f6f3fa;
    color: #4a5069; border-radius: 0 6px 6px 0;
  }
  code {
    font-family: ui-monospace, 'Cascadia Code', Consolas, monospace;
    font-size: 0.92em;
  }
  :not(pre) > code { background: #f0f1f6; color: #8a2fc2; padding: 0.15em 0.4em; border-radius: 4px; }
  pre {
    background: #0f1420; color: #e6e9f2;
    padding: 14px 16px; border-radius: 8px; overflow-x: auto;
    font-size: 13px; line-height: 1.55;
  }
  pre code { background: none; color: inherit; padding: 0; }
  .hljs-keyword, .hljs-selector-tag, .hljs-literal { color: #c678dd; }
  .hljs-string, .hljs-regexp, .hljs-addition { color: #98c379; }
  .hljs-number { color: #d19a66; }
  .hljs-comment, .hljs-quote { color: #7d8799; font-style: italic; }
  .hljs-title, .hljs-function .hljs-title, .hljs-section { color: #61afef; }
  .hljs-attr, .hljs-attribute, .hljs-variable, .hljs-template-variable { color: #d19a66; }
  .hljs-built_in, .hljs-type, .hljs-class .hljs-title { color: #e5c07b; }
  .hljs-tag, .hljs-name, .hljs-selector-class, .hljs-selector-id { color: #e06c75; }
  .hljs-symbol, .hljs-bullet { color: #56b6c2; }
  .hljs-meta, .hljs-link { color: #61afef; }
  table { border-collapse: collapse; margin: 1em 0; }
  th, td { border: 1px solid #dde1ea; padding: 6px 12px; text-align: left; }
  th { background: #f4f5f9; font-weight: 600; }
  tr:nth-child(even) td { background: #fafbfd; }
  hr { border: none; border-top: 1px solid #e3e6ee; margin: 2em 0; }
  img { max-width: 100%; border-radius: 6px; }
  .doc-title { margin-bottom: 1.6em; }
  .doc-title h1 { border-bottom: none; margin: 0; }
  .doc-meta { color: #8b93a7; font-size: 0.85em; margin-top: 0.2em; }
`

export function buildDocumentHtml(title: string, markdown: string): string {
  const body = renderMarkdown(markdown)
  const escapedTitle = title.replace(/[<>&"']/g, (c) => {
    return { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]!
  })
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapedTitle}</title>
<style>${EXPORT_CSS}</style>
</head>
<body>
<article>
  <div class="doc-title"><h1>${escapedTitle}</h1></div>
  ${body}
</article>
</body>
</html>`
}

/**
 * Renders a document through a hidden window and returns the PDF bytes.
 * The window is sandboxed and never shown; it only exists because
 * printToPDF is a webContents API.
 */
export function pdfFromHtml(html: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const win = new BrowserWindow({
      show: false,
      width: 860,
      height: 1100,
      webPreferences: { sandbox: true }
    })
    const cleanup = (): void => {
      if (!win.isDestroyed()) win.destroy()
    }
    win.webContents.on('did-finish-load', async () => {
      try {
        const data = await win.webContents.printToPDF({
          pageSize: 'A4',
          printBackground: true,
          margins: { top: 0.6, bottom: 0.6, left: 0.5, right: 0.5 }
        })
        cleanup()
        resolve(Buffer.from(data))
      } catch (err) {
        cleanup()
        reject(err instanceof Error ? err : new Error(String(err)))
      }
    })
    const b64 = Buffer.from(html, 'utf-8').toString('base64')
    void win.loadURL(`data:text/html;charset=utf-8;base64,${b64}`)
  })
}

export interface ExportResult {
  ok: boolean
  canceled: boolean
  error: string | null
  stat: FileStat | null
}