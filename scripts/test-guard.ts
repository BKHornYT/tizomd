/** File-changed-on-disk guard checks against real files in a throwaway dir.
 *  Run directly: `node --experimental-strip-types scripts/test-guard.ts` */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { saveTextFile } from '../src/main/files.ts'

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

const dir = mkdtempSync(join(tmpdir(), 'tizomd-guard-test-'))
const filePath = join(dir, 'notes.md')

try {
  const created = await saveTextFile(filePath, 'hello world', null)
  const createdStat = created.ok === true ? created.stat : null
  check('save creates a missing file', created.ok === true, JSON.stringify(createdStat))
  check('created file returns the new stat', createdStat !== null && createdStat.size === 'hello world'.length, JSON.stringify(createdStat))

  const first = await saveTextFile(filePath, 'more text', createdStat)
  const firstStat = first.ok === true ? first.stat : null
  check('save with a matching expected stat succeeds', first.ok === true, JSON.stringify(firstStat))

  const clobber = await saveTextFile(
    filePath,
    'CLOBBER',
    firstStat ? { mtimeMs: firstStat.mtimeMs + 1000000, size: firstStat.size } : null
  )
  const clobberCurrent = 'changed' in clobber && clobber.changed === true ? clobber.current : null
  check('stale expected stat is detected as changed', clobber.ok === false && clobber.changed === true, JSON.stringify(clobberCurrent))
  check('detected change reports the disk text, not the pending one', clobberCurrent !== null && clobberCurrent.text === 'more text', JSON.stringify(clobberCurrent))

  const staleMissing = await saveTextFile(
    join(dir, 'deleted.md'),
    'content',
    { mtimeMs: 0, size: 123 } // stat from a file that no longer exists
  )
  check('expected stat for a deleted file does not block the write', staleMissing.ok === true, JSON.stringify(staleMissing))

  const fresh = await saveTextFile(filePath, 'after', null)
  const freshStat = fresh.ok === true ? fresh.stat : null
  check('guard result includes updated stat for the next pass', freshStat !== null, JSON.stringify(freshStat))
} finally {
  rmSync(dir, { recursive: true, force: true })
}

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'} — ${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)