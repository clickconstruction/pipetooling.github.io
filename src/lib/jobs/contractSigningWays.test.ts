import { describe, expect, it } from 'vitest'
import type { ContractSweepRowState } from './contractSweepRowState'
import { effectiveSigningWay, signingWayButtons, signingWayDetailLine, signingWaysForRow } from './contractSigningWays'

const state = (p: Partial<ContractSweepRowState>): ContractSweepRowState => ({ flags: ['ready'], sameEmailAs: [], emailOk: true, readyForBulk: true, action: 'send', ...p })

describe('signingWaysForRow', () => {
  it('a homeowner row leads with the PDF to sign by hand, the other two one tap away', () => {
    const plan = signingWaysForRow(state({}), null)
    expect(plan.defaultWay).toBe('pdf_email')
    expect(plan.ways.map((w) => w.way)).toEqual(['pdf_email', 'link', 'download'])
    expect(plan.ways.every((w) => w.disabledReason === null)).toBe(true)
    expect(plan.demoted).toEqual([])
  })

  it('no signer email: the two emails say why, and download to print is the pick', () => {
    const plan = signingWaysForRow(state({ flags: ['no_email'], emailOk: false, readyForBulk: false, action: 'fix_email' }), null)
    expect(plan.defaultWay).toBe('download')
    expect(plan.ways.find((w) => w.way === 'pdf_email')?.disabledReason).toMatch(/signer email/)
    expect(plan.ways.find((w) => w.way === 'link')?.disabledReason).toMatch(/signer email/)
    expect(plan.ways.find((w) => w.way === 'download')?.disabledReason).toBeNull()
  })

  it('a builder row collapses to filing their subcontract, ours demoted not removed', () => {
    const plan = signingWaysForRow(state({ flags: ['gc_job'], readyForBulk: false, action: 'file_theirs' }), 'Summit GC')
    expect(plan.defaultWay).toBe('file_theirs')
    expect(plan.ways).toHaveLength(1)
    expect(plan.ways[0]?.label).toBe("File Summit GC's subcontract")
    expect(plan.demoted.map((w) => w.way)).toEqual(['pdf_email', 'link', 'download'])
    expect(signingWaysForRow(state({ flags: ['gc_job'] }), null).ways[0]?.label).toBe('File their subcontract')
  })
})

describe('effectiveSigningWay', () => {
  it('keeps a usable pick, and falls back when the pick lost its email', () => {
    const ok = signingWaysForRow(state({}), null)
    expect(effectiveSigningWay(ok, 'link')).toBe('link')
    expect(effectiveSigningWay(ok, null)).toBe('pdf_email')
    const noEmail = signingWaysForRow(state({ emailOk: false }), null)
    expect(effectiveSigningWay(noEmail, 'link')).toBe('download')
    const gc = signingWaysForRow(state({ flags: ['gc_job'] }), 'Summit GC')
    expect(effectiveSigningWay(gc, 'pdf_email')).toBe('pdf_email')
    expect(effectiveSigningWay(gc, undefined)).toBe('file_theirs')
  })
})

describe('signingWayDetailLine (v2.3706)', () => {
  it('says what the chosen way does, and names the ways that are out and why', () => {
    const ready = signingWaysForRow({ flags: ['ready'], sameEmailAs: [], emailOk: true, readyForBulk: true, action: 'send' }, null)
    expect(signingWayDetailLine(ready, 'link')).toEqual({ detail: 'They sign on screen, no printing', note: null })
    const noEmail = signingWaysForRow({ flags: ['no_email'], sameEmailAs: [], emailOk: false, readyForBulk: false, action: 'fix_email' }, null)
    expect(signingWayDetailLine(noEmail, 'download')).toEqual({
      detail: 'For the counter or the mail — marks it handed over, so the job leaves this list',
      note: 'Email the PDF to sign by hand and Email a signing link: needs a signer email — type one in To above',
    })
    // A builder's row: the one way shown has nothing out; a demoted way still has a detail when picked.
    const gc = signingWaysForRow({ flags: ['gc_job'], sameEmailAs: [], emailOk: true, readyForBulk: false, action: 'file_theirs' }, 'Summit GC')
    expect(signingWayDetailLine(gc, 'file_theirs').note).toBeNull()
    expect(signingWayDetailLine(gc, 'pdf_email').detail).toContain('they print and sign')
  })
})

describe('signingWayButtons', () => {
  it('names the action by the way, with a fast path only when a row follows', () => {
    expect(signingWayButtons('pdf_email', true)).toMatchObject({ label: 'Email the PDF', andNextLabel: 'Email PDF & next' })
    expect(signingWayButtons('link', true).andNextLabel).toBe('Send link & next')
    expect(signingWayButtons('download', true)).toMatchObject({ label: 'Download & mark handed over', andNextLabel: 'Download & next' })
    expect(signingWayButtons('link', false).andNextLabel).toBeNull()
    expect(signingWayButtons('file_theirs', true).andNextLabel).toBeNull()
  })
})
