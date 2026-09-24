/** Split/replace round-trip checks for the Typora block model. Run directly:
 *  `node --experimental-strip-types scripts/test-blocks.ts` */
import { replaceLines, splitBlocks } from '../src/shared/markdown.ts'

let pass = 0
let fail = 0

function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    pass++
    console.log(`  ok  ${name}`)
  } else {
    fail++
    console.error(`FAIL  ${name}${detail ? `\n      ${detail}` : ''}`)
  }
}

function guardMissingEdges(blocks: ReturnType<typeof splitBlocks>, src: string) {
  const lines = src.split('\n')
  for (const b of blocks) {
    if (b.start >= b.end) return `block ${JSON.stringify(b)} has empty range`
    const got = lines.slice(b.start, b.end).join('\n')
    if (got !== b.text)
      return `block ${JSON.stringify(b)} does not slice to its text:\n      got   ${JSON.stringify(got)}\n      expct ${JSON.stringify(b.text)}`
  }
  for (let i = 1; i < blocks.length; i++) {
    if (blocks[i - 1].end > blocks[i].start) return `blocks overlap: ${JSON.stringify(blocks[i - 1])} then ${JSON.stringify(blocks[i])}`
  }
  return null
}

const doc = `# TizoMD

A *tiny* intro.

- first item
- second item

\`\`\`ts
const x = 1
\`\`\`

And **bye**.

> a quote
`

const blocks = splitBlocks(doc)
check('document parses into blocks', blocks.length > 0, `got ${blocks.length}`)
const coverage = guardMissingEdges(blocks, doc)
check('every block slices back to its own text with no overlaps', coverage === null, coverage ?? '')
check('heading is its own block', blocks[0].text.startsWith('# TizoMD'), JSON.stringify(blocks[0]))
check('blank-line gap before list', blocks[1].start > blocks[0].end, `h end ${blocks[0].end}, list start ${blocks[1].start}`)
const list = blocks.find((b) => b.text.includes('first item'))
check('whole list is one block', list !== undefined && list.text.startsWith('- ') && list.text.includes('second item'), JSON.stringify(list))
const fence = blocks.find((b) => b.text.startsWith('```ts'))
check('fence is one block including delimiters', fence !== undefined && fence.text.includes('const x = 1') && fence.text.endsWith('```'), JSON.stringify(fence))
const quote = blocks.find((b) => b.text.startsWith('>'))
check('blockquote is one block', quote !== undefined, JSON.stringify(quote))

const edited = replaceLines(doc, list!.start, list!.end, '- new one\n- new two\n- new three')
check('replaceLines swaps a block', edited.includes('new three') && !edited.includes('first item'))
const editedBlocks = splitBlocks(edited)
check('re-slitted document is still coherent', guardMissingEdges(editedBlocks, edited) === null, guardMissingEdges(editedBlocks, edited) ?? '')
check('heading survives the block edit', editedBlocks[0].text.startsWith('# TizoMD'))
check('fence survives the block edit', editedBlocks.some((b) => b.text.startsWith('```ts')))
check('quote survives the block edit', editedBlocks.some((b) => b.text.startsWith('>')))

const empties = splitBlocks('')
check('empty document yields no blocks', empties.length === 0)

const trailing = splitBlocks('para\n\n\ntail')
check('trailing blank lines are not blocks', trailing.every((b) => b.text.length > 0) && trailing.length === 2, JSON.stringify(trailing))

const noBlank = splitBlocks('one\ntwo\nthree')
check('consecutive lines are one paragraph block', noBlank.length === 1 && noBlank[0].text === 'one\ntwo\nthree', JSON.stringify(noBlank))

const fine = replaceLines('a\nb\nc', 0, 1, 'A')
check('replace first line', fine === 'A\nb\nc', JSON.stringify(fine))
const whole = replaceLines('x\ny', 0, 2, 'z')
check('replace whole document', whole === 'z', JSON.stringify(whole))

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'} — ${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)