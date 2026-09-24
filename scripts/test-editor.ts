/** Desktop-editor helpers: find-match ranges and local image src resolution.
 *  Run directly: `node --experimental-strip-types scripts/test-editor.ts` */
import { absolutizeImageSrc, findMatches } from '../src/shared/markdown.ts'

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

// --- findMatches -------------------------------------------------------------
const m = (text: string, query: string) => JSON.stringify(findMatches(text, query))

check('empty query yields no matches', findMatches('abc', '').length === 0, m('abc', ''))
check('no match yields none', findMatches('abc', 'z').length === 0)
check('case-insensitive match', m('Hello hi', 'hI') === '[{"start":6,"end":8}]', m('Hello hi', 'hI'))
check('multiple non-overlapping hits', m('aaa', 'a') === '[{"start":0,"end":1},{"start":1,"end":2},{"start":2,"end":3}]', m('aaa', 'a'))
check('overlapping needle advances', m('aaaa', 'aa') === '[{"start":0,"end":2},{"start":2,"end":4}]', m('aaaa', 'aa'))
check('unicode text matches', m('hællo', 'æ') === '[{"start":1,"end":2}]', m('hællo', 'æ'))
check('empty query-space text', findMatches(' ', ' ').length > 0)

// --- absolutizeImageSrc ------------------------------------------------------
const a = (src: string, base: string | null) => absolutizeImageSrc(src, base)

check('posix relative resolves', a('img/a.png', '/home/u/docs') === 'file:///home/u/docs/img/a.png', a('img/a.png', '/home/u/docs') ?? '')
check('absolute posix resolves', a('/static/a.png', '/home/u/docs') === 'file:///static/a.png', a('/static/a.png', '/home/u/docs') ?? '')
check('posix climbs out of the doc dir', a('../assets/a.png', '/home/u/docs') === 'file:///home/u/assets/a.png', a('../assets/a.png', '/home/u/docs') ?? '')
check('posix rejects climbing past root', a('../../../x.png', '/home/u/docs') === 'file:///x.png', a('../../../x.png', '/home/u/docs') ?? '')
check('apple all the way down', a('.//./img/a.png', '/home/u/docs') === 'file:///home/u/docs/img/a.png', a('.//./img/a.png', '/home/u/docs') ?? '')
check('windows relative resolves', a('./img/a b.png', 'C:\\data\\docs') === 'file:///C:/data/docs/img/a%20b.png', a('./img/a b.png', 'C:\\data\\docs') ?? '')
check('windows drive-letter absolute wins', a('D:\\pics\\x.png', 'C:\\data\\docs') === 'file:///D:/pics/x.png', a('D:\\pics\\x.png', 'C:\\data\\docs') ?? '')
check('windows root-relative roots on doc drive', a('/pic.png', 'C:\\data\\docs') === 'file:///C:/pic.png', a('/pic.png', 'C:\\data\\docs') ?? '')
check('windows climbs out of the doc dir', a('..\\..\\assets\\x.png', 'C:\\data\\docs\\sub') === 'file:///C:/data/assets/x.png', a('..\\..\\assets\\x.png', 'C:\\data\\docs\\sub') ?? '')
check('hash in filename escapes', a('img/a#1.png', '/home/u/docs') === 'file:///home/u/docs/img/a%231.png', a('img/a#1.png', '/home/u/docs') ?? '')
check('question mark in filename escapes', a('img/a?1.png', '/home/u/docs') === 'file:///home/u/docs/img/a%3F1.png', a('img/a?1.png', '/home/u/docs') ?? '')
check('https passes through', a('https://x/y.png', '/home/u/docs') === 'https://x/y.png', a('https://x/y.png', '/home/u/docs') ?? '')
check('data uri passes through', a('data:image/png;base64,AAA', '/home/u/docs') === 'data:image/png;base64,AAA', a('data:image/png;base64,AAA', '/home/u/docs') ?? '')
check('file uri passes through', a('file:///abs/pic.png', '/home/u/docs') === 'file:///abs/pic.png', a('file:///abs/pic.png', '/home/u/docs') ?? '')
check('protocol-relative passes through', a('//cdn/x.png', '/home/u/docs') === '//cdn/x.png', a('//cdn/x.png', '/home/u/docs') ?? '')
check('javascript: scheme rejected', a('javascript:alert(1)', '/home/u/docs') === null, a('javascript:alert(1)', '/home/u/docs') ?? '')
check('vbscript: scheme rejected', a('vbscript:msgbox()', '/home/u/docs') === null, a('vbscript:msgbox()', '/home/u/docs') ?? '')
check('empty src rejected', a('', '/home/u/docs') === null, a('', '/home/u/docs') ?? '')
check('untitled tab leaves relative alone', a('img/a.png', null) === 'img/a.png', a('img/a.png', null) ?? '')
check('untitled tab still passes https', a('https://x/y.png', null) === 'https://x/y.png', a('https://x/y.png', null) ?? '')

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'} — ${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)