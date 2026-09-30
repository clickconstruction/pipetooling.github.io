import { describe, expect, it } from 'vitest'
import { readyToBillPushBody, readyToBillPushTitle, readyToBillSubject, readyToBillText, renderReadyToBillDetailed, renderReadyToBillSummary } from '../../supabase/functions/_shared/readyToBillEmail'
import { sampleReadyToBillPayload } from './teamSampleEmails'

// The Ready to bill email's renderer (v2.4173 lift): the sample gas-line job moved by its lead.
describe('readyToBillEmail kernel', () => {
  const p = sampleReadyToBillPayload('2026-09-29')

  it('the subject and push title name the job', () => {
    expect(readyToBillSubject(p)).toBe('Ready to bill — 1057 · Hunter Homes — gas line')
    expect(readyToBillPushTitle(p)).toBe('Ready to bill — 1057 · Hunter Homes — gas line')
  })

  it('the push body carries the draft total and who moved it', () => {
    expect(readyToBillPushBody(p, true)).toBe('$18,900.00 ready to bill · moved by Kim Tech')
  })

  it('the text says who moved it, when, and for whom', () => {
    const t = readyToBillText(p)
    expect(t.startsWith('1057 · Hunter Homes — gas line\n')).toBe(true)
    expect(t).toContain('Moved to Ready to Bill by Kim Tech — Tue, Sep 29, 4:05 PM')
    expect(t).toContain('Customer: Hunter Homes')
    expect(t).toContain('77 Hunter Loop, Kyle, TX 78640')
  })

  it('the detailed HTML carries the mover and the draft total; the summary keeps the mover and drops the dollars', () => {
    const detailed = renderReadyToBillDetailed(p)
    expect(detailed).toContain('Kim Tech')
    expect(detailed).toContain('$18,900.00')
    const summary = renderReadyToBillSummary(p)
    expect(summary).toContain('Kim Tech')
    expect(summary).not.toContain('$18,900.00')
  })

  it('a manual note lands in the body', () => {
    expect(renderReadyToBillDetailed(p, 'Moved from the board by hand')).toContain('Moved from the board by hand')
  })
})
