/**
 * The agent's check, read on the revision of the usual a job's sheet went out on (punch list #404). The screen's
 * warning and `document-builder-send`'s refusal ask one rule. The function's source is read to hold that it does.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { sheetUnreadWords, sheetWentOutChecked } from './sendWords'

const GENERIC = 'Your insurance agent has not checked your usual sheet.'

describe('the agent\u2019s check, read on the revision of the usual a job\u2019s sheet went out on', () => {
  it('holds for a sheet that went out on the checked revision, with a newer usual nobody checked', () => {
    // Revision 1 of the usual was checked. Revision 2 was published since, and nobody checked it.
    expect(sheetWentOutChecked(1, 1)).toBe(true)
    expect(sheetUnreadWords({ readRevision: 1, sheetUsualRevision: 1, usualRevision: 2 })).toBe('')
    // The same job, published again: it is now on revision 2, which nobody checked.
    expect(sheetWentOutChecked(1, 2)).toBe(false)
    expect(sheetUnreadWords({ readRevision: 1, sheetUsualRevision: 2, usualRevision: 2 })).toBe(GENERIC)
  })

  it('does not hold for a sheet that went out on an unchecked revision, with a newer usual that was checked', () => {
    // Revision 1 went out unchecked. Revision 2 was published and checked. The job is still on revision 1.
    expect(sheetWentOutChecked(2, 1)).toBe(false)
    expect(sheetUnreadWords({ readRevision: 2, sheetUsualRevision: 1, usualRevision: 2 })).toBe("Your insurance agent has not checked revision 1 of your usual sheet. This job's sheet went out on that revision.")
    // Published again, the job is on the checked revision.
    expect(sheetWentOutChecked(2, 2)).toBe(true)
    expect(sheetUnreadWords({ readRevision: 2, sheetUsualRevision: 2, usualRevision: 2 })).toBe('')
  })

  it('does not hold with no mark at all, or for a sheet never published', () => {
    expect(sheetWentOutChecked(null, 1)).toBe(false)
    expect(sheetWentOutChecked(undefined, 1)).toBe(false)
    expect(sheetWentOutChecked(1, null)).toBe(false)
    expect(sheetWentOutChecked(0, 0)).toBe(false)
    expect(sheetUnreadWords({ readRevision: null, sheetUsualRevision: 1, usualRevision: 1 })).toBe(GENERIC)
  })

  it('asks a job with no sheet yet of the usual\u2019s newest, the one it would go out on', () => {
    expect(sheetUnreadWords({ readRevision: 2, sheetUsualRevision: null, usualRevision: 2 })).toBe('')
    expect(sheetUnreadWords({ readRevision: 1, sheetUsualRevision: null, usualRevision: 2 })).toBe(GENERIC)
    expect(sheetUnreadWords({ readRevision: null, sheetUsualRevision: null, usualRevision: 0 })).toBe(GENERIC)
  })

  it('reads in plain words', () => {
    expect([GENERIC, sheetUnreadWords({ readRevision: 2, sheetUsualRevision: 1, usualRevision: 2 })].flatMap((t) => plainWordsFailures(t))).toEqual([])
  })

  it('is the rule the function refuses by, on the sheet\u2019s own usual revision', () => {
    const source = readFileSync(resolve(__dirname, '../../../supabase/functions/document-builder-send/index.ts'), 'utf8')
    expect(source).toContain("if (!sheetWentOutChecked(usual.read_revision, sheet.usual_revision) && !m.anyway) return refuse('unread')")
    expect(source).not.toContain('usual.read_revision !== usual.revision')
  })
})
