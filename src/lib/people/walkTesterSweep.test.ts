/**
 * The walk tester hides like a sample (punch list #142 PR 3, v2.5738): every place the client leaves the View-as
 * samples out of a roster, a picker or a fan-out leaves the walk kit's tester out too. A `.eq('is_sample', false)` with
 * no `.eq('is_walk_tester', false)` in the same chain, or an in-memory `is_sample` filter that does not name
 * `is_walk_tester`, fails here, so a new picker cannot forget it (the `realAccountSweep.test.ts` pattern for the edge
 * functions, where `REAL_ACCOUNT` carries the flag).
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '../../..')
const SRC = join(ROOT, 'src')

/** Files that read `is_sample` for what it is: the samples' own doors, the View as door, and types. */
const LEFT_ALONE = [
  'src/components/layout/ViewAsPanel.tsx',
  'src/components/prospects/ShareColumnDialog.tsx',
  'src/components/settings/SampleAccountsCard.tsx',
  'src/lib/sampleAccounts.ts',
  'src/lib/viewAs.ts',
  'src/types/database.ts',
  'src/types/settingsRows.ts',
  'src/lib/people/activeRoster.ts',
  'src/lib/people/rosterPeople.ts',
  // The walk tester's own door reads both flags on purpose, and its fixtures beside it are not a picker.
  'src/lib/walk/kitDoor.ts',
  'src/lib/walk/kitDoorFixtures.ts',
]

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name)
    if (e.isDirectory()) return walk(p)
    return e.isFile() && /\.(ts|tsx)$/.test(p) && !/\.test\.tsx?$/.test(p) ? [p] : []
  })
}

const files = walk(SRC)
  .map((abs) => ({ path: relative(ROOT, abs).split(sep).join('/'), src: readFileSync(abs, 'utf8') }))
  .filter((f) => f.src.includes('is_sample'))
  .sort((a, b) => a.path.localeCompare(b.path))
const swept = files.filter((f) => !LEFT_ALONE.includes(f.path))

/** The `.eq(...)` chain a filter sits in: from the `.eq('is_sample', false)` to the end of its statement. */
function chainAround(src: string, at: number): string {
  const start = src.lastIndexOf('\n', src.lastIndexOf('.from(', at) >= 0 ? src.lastIndexOf('.from(', at) : at)
  const end = src.indexOf('\n\n', at)
  return src.slice(start < 0 ? 0 : start, end < 0 ? src.length : end)
}

describe('the walk tester hides wherever a sample does', () => {
  it('every query that leaves the samples out leaves the tester out in the same chain', () => {
    const missing: string[] = []
    for (const f of swept) {
      const re = /\.eq\(\s*'is_sample'\s*,\s*false\s*\)/g
      let m: RegExpExecArray | null
      while ((m = re.exec(f.src))) {
        const chain = chainAround(f.src, m.index)
        if (!/\.eq\(\s*'is_walk_tester'\s*,\s*false\s*\)/.test(chain)) missing.push(`${f.path}: ${f.src.slice(0, m.index).split('\n').length}`)
      }
    }
    expect(missing, "add .eq('is_walk_tester', false) beside each").toEqual([])
  })

  it('every in-memory filter on is_sample names is_walk_tester too', () => {
    const missing: string[] = []
    for (const f of swept) {
      const re = /![a-z]\.is_sample\b/g
      let m: RegExpExecArray | null
      while ((m = re.exec(f.src))) {
        const line = f.src.slice(f.src.lastIndexOf('\n', m.index) + 1, f.src.indexOf('\n', m.index))
        if (!line.includes('is_walk_tester')) missing.push(`${f.path}: ${line.trim()}`)
      }
    }
    expect(missing, 'add !x.is_walk_tester beside each').toEqual([])
  })

  it('every select that reads is_sample to filter in memory reads is_walk_tester too', () => {
    const missing: string[] = []
    for (const f of swept) {
      const re = /\.select\(\s*'([^']*\bis_sample\b[^']*)'\s*\)/g
      let m: RegExpExecArray | null
      while ((m = re.exec(f.src))) if (!m[1]!.includes('is_walk_tester')) missing.push(`${f.path}: ${m[1]}`)
      const columns = /COLUMNS\s*=\s*'([^']*\bis_sample\b[^']*)'/g
      while ((m = columns.exec(f.src))) if (!m[1]!.includes('is_walk_tester')) missing.push(`${f.path}: ${m[1]}`)
    }
    expect(missing, 'add is_walk_tester to each select').toEqual([])
  })

  it('names the files it sweeps, so a new one is a decision', () => {
    expect(swept.map((f) => f.path)).toEqual([
      'src/components/people/PeopleUsersTab.tsx',
      'src/components/personDesk/sections/MergeDuplicateDialog.tsx',
      'src/components/prospects/TeamProspectsTab.tsx',
      'src/hooks/usePeopleRoster.ts',
      'src/lib/emailIn/countCardIo.ts',
      'src/lib/followUp/followUpThreadIo.ts',
      'src/lib/followUp/newLaneCardIo.ts',
      'src/lib/hiring/columnShares.ts',
      'src/lib/legal/legalOfficeContactsIo.ts',
      'src/lib/messages/assignRuleIo.ts',
      'src/lib/people/fetchActiveUsers.ts',
      'src/lib/quo/seatsCardIo.ts',
      'src/lib/scheduleDispatchHub.ts',
    ])
  })
})
