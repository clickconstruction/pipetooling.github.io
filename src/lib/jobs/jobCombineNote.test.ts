import { describe, expect, it } from 'vitest'
import {
  combineStatusPreview,
  composeCombineNoteBody,
  describeStatusPct,
  parseCombineNoteBody,
} from './jobCombineNote'

describe('composeCombineNoteBody', () => {
  it('matches the SQL format from 20260822020000_combine_job_reconciliation.sql', () => {
    // Pinned against what the RPC's format()/to_char produces — the two
    // composers are a contract; change them together.
    expect(
      composeCombineNoteBody({ jobName: 'Johnny Ingram', number: '877', status: 'ready_to_bill', pctComplete: 100 }),
    ).toBe('Combined "Johnny Ingram" (Job #877) into this job — source was Ready to bill at 100%')
  })

  it('omits the pct when unknown, and the whole suffix when status is unknown', () => {
    expect(composeCombineNoteBody({ jobName: 'Wayne Lai', number: 'C-1042', status: 'working', pctComplete: null })).toBe(
      'Combined "Wayne Lai" (Job #C-1042) into this job — source was Working',
    )
    expect(composeCombineNoteBody({ jobName: 'Wayne Lai', number: '901', status: null, pctComplete: 40 })).toBe(
      'Combined "Wayne Lai" (Job #901) into this job',
    )
  })

  it('falls back to an em dash for a job with no number, mirroring the SQL COALESCE chain', () => {
    expect(composeCombineNoteBody({ jobName: 'X', number: '  ', status: null, pctComplete: null })).toBe(
      'Combined "X" (Job #—) into this job',
    )
  })

  it('keeps fractional percents without trailing zeros', () => {
    expect(composeCombineNoteBody({ jobName: 'X', number: '1', status: 'working', pctComplete: 87.5 })).toBe(
      'Combined "X" (Job #1) into this job — source was Working at 87.5%',
    )
  })
})

describe('parseCombineNoteBody', () => {
  it('round-trips the composed body', () => {
    const body = composeCombineNoteBody({ jobName: 'Johnny Ingram', number: '877', status: 'ready_to_bill', pctComplete: 100 })
    expect(parseCombineNoteBody(body)).toEqual({
      sourceJobName: 'Johnny Ingram',
      sourceNumber: '877',
      sourceWas: 'Ready to bill at 100%',
    })
  })

  it('parses a body without the status suffix', () => {
    expect(parseCombineNoteBody('Combined "Wayne Lai" (Job #901) into this job')).toEqual({
      sourceJobName: 'Wayne Lai',
      sourceNumber: '901',
      sourceWas: null,
    })
  })

  it('returns null for non-combine bodies', () => {
    expect(parseCombineNoteBody('Sent back to Working — missing footage')).toBeNull()
    expect(parseCombineNoteBody('100% complete — from field report')).toBeNull()
    expect(parseCombineNoteBody('combined "x" (Job #1) into this job')).toBeNull()
  })
})

describe('describeStatusPct', () => {
  it('labels known statuses with pct', () => {
    expect(describeStatusPct({ status: 'ready_to_bill', pctComplete: 100 })).toBe('Ready to bill at 100%')
    expect(describeStatusPct({ status: 'billed', pctComplete: null })).toBe('Billed')
  })

  it('falls back to em dash when unknown', () => {
    expect(describeStatusPct({ status: null, pctComplete: 50 })).toBe('—')
    expect(describeStatusPct({ status: '  ', pctComplete: null })).toBe('—')
  })
})

describe('combineStatusPreview', () => {
  it('warns on the job-877 case: source RTB@100% into a Billed target', () => {
    const p = combineStatusPreview(
      { status: 'ready_to_bill', pctComplete: 100 },
      { status: 'billed', pctComplete: null },
    )
    expect(p.warning).toContain('Ready to bill at 100%')
    expect(p.warning).toContain('Billed')
    expect(p.keeps).toContain("target's status")
    expect(p.keeps).toContain('Billed')
  })

  it('warns when the source is further along the pipeline than the target', () => {
    const p = combineStatusPreview(
      { status: 'ready_to_bill', pctComplete: 100 },
      { status: 'working', pctComplete: 40 },
    )
    expect(p.warning).toContain('Ready to bill at 100%')
    expect(p.warning).toContain('Working at 40%')
  })

  it('warns on same stage at a higher pct', () => {
    const p = combineStatusPreview({ status: 'working', pctComplete: 90 }, { status: 'working', pctComplete: 20 })
    expect(p.warning).not.toBeNull()
  })

  it('stays quiet when nothing on the source would be lost', () => {
    expect(
      combineStatusPreview({ status: 'working', pctComplete: 20 }, { status: 'working', pctComplete: 20 }).warning,
    ).toBeNull()
    expect(
      combineStatusPreview({ status: 'working', pctComplete: null }, { status: 'working', pctComplete: 60 }).warning,
    ).toBeNull()
  })

  it('stays quiet when either status is unknown', () => {
    expect(combineStatusPreview({ status: null, pctComplete: 100 }, { status: 'working', pctComplete: 0 }).warning).toBeNull()
    expect(combineStatusPreview({ status: 'billed', pctComplete: null }, { status: 'bogus', pctComplete: 0 }).warning).toBeNull()
  })
})
