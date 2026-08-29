import { describe, expect, it } from 'vitest'
import { allowedTransitions, canTransition, openRfisAtSend, parseCtRfiFlags, rfiAuditNote } from './rfiFlow'

describe('canTransition', () => {
  it('walks the happy path draft → approved → sent → answered', () => {
    expect(canTransition('draft', 'approved')).toBe(true)
    expect(canTransition('approved', 'sent')).toBe(true)
    expect(canTransition('sent', 'answered')).toBe(true)
  })
  it('approved can fall back to draft; draft cannot jump to sent', () => {
    expect(canTransition('approved', 'draft')).toBe(true)
    expect(canTransition('draft', 'sent')).toBe(false)
    expect(canTransition('draft', 'answered')).toBe(false)
  })
  it('answered and withdrawn are terminal', () => {
    expect(allowedTransitions('answered')).toEqual([])
    expect(allowedTransitions('withdrawn')).toEqual([])
  })
  it('withdraw is allowed from every live status', () => {
    expect(canTransition('draft', 'withdrawn')).toBe(true)
    expect(canTransition('approved', 'withdrawn')).toBe(true)
    expect(canTransition('sent', 'withdrawn')).toBe(true)
  })
})

describe('parseCtRfiFlags', () => {
  it('parses the CT export: header skipped, sheet + question kept', () => {
    const text = 'RFI flags\tZZ Twin LIVSTE\np1 P200\tfixture on plan missing from schedule\np2 P201 · Canvas 2\triser disagrees here'
    expect(parseCtRfiFlags(text)).toEqual([
      { sheet_ref: 'p1 P200', question: 'fixture on plan missing from schedule' },
      { sheet_ref: 'p2 P201 · Canvas 2', question: 'riser disagrees here' },
    ])
  })
  it('tolerates missing header, blank lines, and garbage without tabs', () => {
    expect(parseCtRfiFlags('p3 P301\tunlabeled line\n\nno tab here\n')).toEqual([
      { sheet_ref: 'p3 P301', question: 'unlabeled line' },
    ])
    expect(parseCtRfiFlags('')).toEqual([])
    expect(parseCtRfiFlags(null as unknown as string)).toEqual([])
  })
})

describe('rfiAuditNote', () => {
  const base = { rfi_number: 3, question: 'Gas water heater vs COMcheck all-electric — which governs?', sheet_ref: 'P002 vs COMcheck', sent_via: 'email' as const, sent_to: [{ gc_customer_id: 'x', name: 'Knight Contracting' }], answer_ref: 'Addendum 1' }
  it('stamps each event with the RFI number', () => {
    expect(rfiAuditNote('created', base)).toContain('[RFI-3] drafted (P002 vs COMcheck)')
    expect(rfiAuditNote('sent', base)).toContain('sent via email to Knight Contracting')
    expect(rfiAuditNote('answered', base)).toBe('[RFI-3] answered — Addendum 1')
    expect(rfiAuditNote('withdrawn', base)).toBe('[RFI-3] withdrawn')
  })
  it('truncates very long questions in the stamp', () => {
    const long = { ...base, question: 'x'.repeat(200) }
    expect(rfiAuditNote('created', long).length).toBeLessThan(200)
  })
})

describe('openRfisAtSend', () => {
  it('counts draft + approved + sent as open; answered/withdrawn closed', () => {
    expect(openRfisAtSend([
      { status: 'draft' }, { status: 'approved' }, { status: 'sent' },
      { status: 'answered' }, { status: 'withdrawn' },
    ])).toBe(3)
  })
})
