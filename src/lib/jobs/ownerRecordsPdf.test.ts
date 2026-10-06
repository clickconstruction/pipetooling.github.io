import { describe, expect, it } from 'vitest'
import { buildOwnerPacket } from './ownerRecords'
import { ownerPacketPdfFilename, ownerPacketPdfModel } from './ownerRecordsPdf'
import type { OwnerRecordsDocFacts, OwnerRecordsDocFormat } from './ownerRecordsDocs'

const fmt: OwnerRecordsDocFormat = { day: (ymd) => `day(${ymd})`, dateTime: (iso) => `at(${iso})`, money: (n) => `$${n.toFixed(2)}` }
const facts: OwnerRecordsDocFacts = { company: 'Click Plumbing', owner: 'Umar Khan', address: '9703 Lenox Hill, San Antonio, TX', asOfYmd: '2026-10-05', requestedOnYmd: '2026-10-01' }

describe('ownerPacketPdfModel', () => {
  it('mirrors the printed packet: the cover note, the summary, each job with its bills, payments and open lines', () => {
    const packet = buildOwnerPacket([
      {
        id: 'j273', number: '273', name: 'Dudley (Lennox)', address: '9703 Lenox Hill', gcName: 'RMC', total: 1000,
        bills: [{ id: 'b1', amount: 600, status: 'billed', billedAt: '2026-03-16', order: 0 }, { id: 'd', amount: 50, status: 'draft', billedAt: null, order: 1 }],
        payments: [{ id: 'p1', billId: 'b1', amount: 100, paidOn: '2026-04-01', recordedAt: null, type: 'check', reference: '4471' }, { id: 'p2', billId: null, amount: 200, paidOn: '2025-10-10', recordedAt: '2026-07-03T19:32:00Z', type: '', reference: '' }],
      },
      { id: 'j858', number: '858', name: 'Service Visit', address: '9703 Lenox Hill', gcName: null, total: 500, bills: [], payments: [] },
    ])
    const m = ownerPacketPdfModel(packet, facts, fmt)
    expect(m.title).toBe('Records for 9703 Lenox Hill, San Antonio, TX')
    expect(m.cover.slice(0, 3)).toEqual(['day(2026-10-05)', 'Umar Khan', '9703 Lenox Hill, San Antonio, TX'])
    expect(m.cover[3]).toContain('You asked us in writing on day(2026-10-01)')
    expect(m.cover[m.cover.length - 1]).toBe('Click Plumbing')
    expect(m.summary.head).toEqual(['Job', 'Job total', 'Paid', 'Still owed'])
    expect(m.summary.rows).toEqual([
      ['273 · Dudley (Lennox)', '$1000.00', '$300.00', '$700.00'],
      ['858 · Service Visit', '$500.00', '$0.00', '$500.00'],
    ])
    expect(m.summary.sum).toEqual(['This property', '$1500.00', '$300.00', '$1200.00'])
    const j = m.jobs[0]!
    expect([j.heading, j.sub]).toEqual(['273 · Dudley (Lennox)', '9703 Lenox Hill · billed to RMC'])
    expect(j.rows.map((r) => `${r.tone}|${r.label}|${r.amount}`)).toEqual([
      'plain|Job total|$1000.00',
      'plain|Bill 1 · billed day(2026-03-16)|$600.00',
      'pay|Payment · day(2026-04-01) · check 4471|$100.00',
      'muted|Open on bill 1|$500.00',
      'muted|Payments on the job that name no bill|',
      'pay|Payment · day(2025-10-10) · recorded at(2026-07-03T19:32:00Z)|$200.00',
      'plain|Paid on this job|$300.00',
      'sum|Still owed on this job|$700.00',
    ])
    // A job with nothing billed says so, as the print does.
    expect(m.jobs[1]!.rows[1]).toEqual({ label: 'No bill has gone out on this job yet.', amount: '', tone: 'muted' })
  })

  it('names the file after the property and the day', () => {
    expect(ownerPacketPdfFilename('9703 Lenox Hill, San Antonio, TX', '2026-10-05')).toBe('Records-9703-Lenox-Hill-San-Antonio-TX-2026-10-05.pdf')
    expect(ownerPacketPdfFilename('', '2026-10-05')).toBe('Records-property-2026-10-05.pdf')
  })
})
