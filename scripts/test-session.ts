/** Session persistence round-trip through the REAL store module, with the
 *  electron stub redirecting userData to a throwaway dir.
 *  Run: `node --experimental-strip-types --import ./scripts/electron-stub-register.mjs scripts/test-session.ts` */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { SessionData } from '../src/shared/types.ts'
import { flushSession, loadSession, cacheSession } from '../src/main/store/session.ts'

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

process.env.TIZO_TEST_DATA_DIR = mkdtempSync(join(tmpdir(), 'tizomd-session-test-'))
const sessionFile = join(process.env.TIZO_TEST_DATA_DIR, 'session.json')

try {
  const missing = loadSession()
  check('missing session.json loads a clean default', missing.clean === false && missing.files && Object.keys(missing.files).length === 0, JSON.stringify(missing))

  const withFiles: SessionData = {
    version: 1,
    clean: false,
    active: null,
    files: {
      [join('C:', 'fake', 'a.md')]: { untitled: false, buffer: { text: '# hi', cursor: 5, scroll: 0 }, recovery: null },
      [join('C:', 'fake', 'b.md')]: { untitled: false, buffer: { text: 'world', cursor: 0, scroll: 0 }, recovery: null }
    }
  }
  cacheSession(withFiles)
  flushSession(false)
  const onDisk = JSON.parse(readFileSync(sessionFile, 'utf-8'))
  check('flushSession writes session.json', onDisk.version === 1, JSON.stringify(onDisk))
  check('both buffers persisted', Object.keys(onDisk.files).length === 2, JSON.stringify(Object.keys(onDisk.files)))

  const reloaded = loadSession()
  const a = reloaded.files?.[join('C:', 'fake', 'a.md')] ?? null
  check('reload returns the buffered text and cursor', a !== null && a.buffer.text === '# hi' && a.buffer.cursor === 5, JSON.stringify(a))

  flushSession(true)
  const cleanDisk = JSON.parse(readFileSync(sessionFile, 'utf-8'))
  check('clean flag recorded on quit', cleanDisk.clean === true, JSON.stringify(cleanDisk.clean))
} finally {
  rmSync(process.env.TIZO_TEST_DATA_DIR, { recursive: true, force: true })
}

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'} — ${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)