/**
 * v2.5027 (the owner's call of 2026-10-09, Submittals' Mail Drop residual): a submittal leaves the
 * office only through Share or Send the link. The app no longer records a revision as sent outside
 * it: no app source writes `bid_submittals.sent_outside_at`, and no door offers to. A revision that
 * already carries the day keeps its chip and its step line.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { describeRevisionChip, sentByEmailLine } from './submittalRevision'

const SRC = resolve(__dirname, '../..')

/** Every app source under src, tests and the generated types left out. */
function appSources(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      if (path !== join(SRC, 'types')) out.push(...appSources(path))
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(path)
  }
  return out
}

describe('submittals leave only from the tab (v2.5027)', () => {
  it('no app source writes sent_outside_at, and none draws the Sent by email door', () => {
    const offenders = appSources(SRC).filter((f) => {
      const s = readFileSync(f, 'utf8')
      return /\.(update|insert|upsert)\(\{[^)]*\bsent_outside_at\b/s.test(s) || s.includes('sent-outside-open') || s.includes('markSentOutside')
    })
    expect(offenders.map((f) => f.slice(SRC.length + 1))).toEqual([])
  })

  it('a revision that already carries the day keeps its chip and its line', () => {
    expect(describeRevisionChip({ rev_number: 1, status: 'draft', created_at: '2026-09-29T20:00:00Z', shared_at: null, sent_outside_at: '2026-09-29T22:00:00Z' })).toBe('Rev 1 · sent by email · Sep 29')
    expect(sentByEmailLine('2026-09-29T22:00:00Z', 4)).toBe('Sent by email · Sep 29 · answers typed in')
  })
})
