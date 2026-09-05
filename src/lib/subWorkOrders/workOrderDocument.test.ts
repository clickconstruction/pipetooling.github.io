import { describe, expect, it } from 'vitest'
import { bidScopeLines, bidSubLaborTotals, buildWorkOrderDocument, renderWorkOrderDocumentHtml, workOrderRecordLabel } from './workOrderDocument'

const snapshot = {
  anchor: 'job',
  sheetLabel: 'J977 · 415 Springtown Way',
  lines: [{ label: 'Furnish and install all plumbing fixtures per contract documents', amount: null }, { label: 'Rough In · 22 fixtures: 4 WC, 6 Lav', amount: null }],
  exclusions: ['Sales tax on materials'],
  references: [
    { kind: 'book', name: 'General Conditions for Subcontractors', versionDate: '2026-06-19' },
    { kind: 'setting', name: 'How pay works here', versionDate: null },
    { kind: 'compliance', name: 'Insurance requirements', versionDate: '2027-03-01' },
  ],
  acknowledgements: ['My insurance certificate stays current for the whole job.'],
  bond: 'none',
  specialProvisions: 'Owner supplies the water heater.',
  facts: { jobLabel: 'J977', jobAddress: '415 Springtown Way, Austin TX', customerName: 'Hospital', trade: 'Plumbing', recordId: 'WO-977-01', issuedOn: '2026-09-04', issuerName: 'Maria Mendez', issuerTitle: 'Project Coordinator', subCompany: 'Kraja Mechanical LLC', msaSignedOn: '2026-01-12' },
}

const issuer = { companyName: 'Click Plumbing', companyLine: 'Plumbing, Electrical, and HVAC', address: '5501 Balcones Dr., Austin TX', phone: '(512) 360-0599' }

describe('buildWorkOrderDocument', () => {
  it('assembles the numbered document from the snapshot and the row', () => {
    const doc = buildWorkOrderDocument({
      snapshot,
      commitment: { amount: 6400, retainage_pct: 10, proposed_start: '2026-09-15', proposed_end: '2026-09-26', offer_expires_at: '2026-09-11', record_id: 'WO-977-01', offered_at: '2026-09-04T10:00:00Z', signed_at: null, accepted_at: null, signer_printed_name: null, display_name: 'Behar Kraja', status: 'offered' },
      issuer,
    })
    expect(doc.recordId).toBe('WO-977-01')
    expect(doc.issuedOn).toBe('Sep 4, 2026')
    expect(doc.amountLabel).toBe('$6,400.00')
    expect(doc.retainageLabel).toBe('10% retainage')
    expect(doc.windowLabel).toBe('Sep 15 → Sep 26')
    expect(doc.project.name).toBe('J977 · 415 Springtown Way')
    expect(doc.subcontractor.lines).toEqual(['Kraja Mechanical LLC', 'Master Subcontract Agreement signed Jan 12, 2026'])
    expect(doc.sections.map((s) => s.key)).toEqual(['scope', 'exclusions', 'terms', 'references', 'acknowledgements'])
    const terms = doc.sections.find((s) => s.key === 'terms')!.items
    expect(terms[0]).toBe('Subcontract amount $6,400.00, fixed. 10% retainage held until the walk-through.')
    expect(terms[1]).toBe('Work window Sep 15 → Sep 26. Offer good through Sep 11, 2026.')
    expect(terms).toContain('Special provisions: Owner supplies the water heater.')
    const refs = doc.sections.find((s) => s.key === 'references')!.items
    expect(refs).toEqual([
      'General Conditions for Subcontractors, v. Jun 19, 2026',
      'How pay works here, as published on the sub portal',
      'Insurance requirements; expires Mar 1, 2027',
      'Master Subcontract Agreement, signed Jan 12, 2026',
    ])
    expect(doc.signatures.issuer).toEqual({ name: 'Maria Mendez', title: 'Project Coordinator', on: 'Sep 4, 2026' })
    expect(doc.signatures.sub.name).toBeNull()
  })

  it('reads an unpriced draft and a signed order', () => {
    const draft = buildWorkOrderDocument({ snapshot: { lines: [{ label: 'x' }] }, commitment: { amount: null, retainage_pct: 0, proposed_start: null, proposed_end: null, offer_expires_at: null, record_id: null, offered_at: null, signed_at: null, accepted_at: null, signer_printed_name: null, display_name: 'Darren Pike', status: 'draft' }, issuer })
    expect(draft.recordId).toBe('DRAFT')
    expect(draft.amountLabel).toBe('Not priced yet')
    expect(draft.sections.find((s) => s.key === 'terms')!.items[0]).toMatch(/to be set before/)
    expect(draft.sections.some((s) => s.key === 'exclusions')).toBe(false)
    const signed = buildWorkOrderDocument({ snapshot, commitment: { amount: 6400, retainage_pct: 0, proposed_start: null, proposed_end: null, offer_expires_at: null, record_id: 'WO-977-01', offered_at: '2026-09-04', signed_at: '2026-09-05T14:00:00Z', accepted_at: '2026-09-05T14:00:00Z', signer_printed_name: 'Behar Kraja', signer_signature_mode: 'draw', display_name: 'Behar Kraja', status: 'accepted' }, issuer })
    expect(signed.signatures.sub).toEqual({ name: 'Behar Kraja', company: 'Kraja Mechanical LLC', on: 'Sep 5, 2026', via: 'signed on the sub portal (drawn signature on file)' })
    expect(signed.retainageLabel).toBeNull()
  })
})

describe('renderWorkOrderDocumentHtml', () => {
  it('escapes and includes every section', () => {
    const doc = buildWorkOrderDocument({ snapshot: { ...snapshot, lines: [{ label: 'Trim <b>set</b> & test', amount: null }] }, commitment: { amount: 100, retainage_pct: 0, proposed_start: null, proposed_end: null, offer_expires_at: null, record_id: 'WO-1-01', offered_at: null, signed_at: null, accepted_at: null, signer_printed_name: null, display_name: 'A & B', status: 'draft' }, issuer })
    const html = renderWorkOrderDocumentHtml(doc)
    expect(html).toContain('Trim &lt;b&gt;set&lt;/b&gt; &amp; test')
    expect(html).not.toContain('<b>set</b>')
    expect(html).toContain('1. Scope of work')
    expect(html).toContain('Confirmed at signing')
    expect(html).toContain('WO-1-01')
    expect(html).toContain('Great Vibes')
  })
})

describe('bid helpers', () => {
  it('condenses takeoff rows into one line per stage, in stage order', () => {
    const lines = bidScopeLines([
      { fixture: 'Lav', count: 6, group_tag: 'trim_set' },
      { fixture: 'WC', count: 4, group_tag: 'Rough In' },
      { fixture: 'Lav', count: 6, group_tag: 'rough_in' },
      { fixture: 'Hose bib', count: 2, group_tag: 'rough-in' },
      { fixture: '', count: 3, group_tag: 'rough_in' },
      { fixture: 'Sink', count: 0, group_tag: 'top_out' },
      { fixture: 'Floor drain', count: 1, group_tag: null },
    ])
    expect(lines.map((l) => l.stage)).toEqual(['Rough In', 'Trim Set', 'All stages'])
    expect(lines[0]!.label).toBe('Rough In · 12 fixtures: 6 Lav, 4 WC, 2 Hose bib')
    expect(lines[2]!.label).toBe('All stages · 1 fixture: 1 Floor drain')
  })
  it('sums the sub-labor line per stage', () => {
    expect(bidSubLaborTotals([{ rough_in: 2000, top_out: 1500.5, trim_set: null }, { rough_in: 400, top_out: 0, trim_set: 300 }])).toEqual({ rough_in: 2400, top_out: 1500.5, trim_set: 300, total: 4200.5 })
  })
  it('record label falls back to DRAFT', () => {
    expect(workOrderRecordLabel(null)).toBe('DRAFT')
    expect(workOrderRecordLabel(' WO-1-02 ')).toBe('WO-1-02')
  })
})
