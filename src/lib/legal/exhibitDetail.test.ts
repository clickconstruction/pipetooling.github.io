import { describe, expect, it } from 'vitest'
import { EXHIBIT_LINES_SHOWN, exhibitDetails, exhibitsSummaryWords, type ExhibitSource } from './exhibitDetail'

const source = (over: Partial<ExhibitSource> = {}): ExhibitSource => ({
  exhibits: [
    { letter: 'A', title: 'Invoices and payments', count: 3 },
    { letter: 'B', title: 'What was said — contacts, promises, calls', count: 2 },
    { letter: 'C', title: 'Field reports and clock sessions', count: 7 },
  ],
  account: {
    ledger: [
      { ymd: '2026-04-13', jobLabel: '718', kind: 'invoice', text: 'Invoice · sent through Housecall Pro', amount: 1480 },
      { ymd: '2026-04-13', jobLabel: '717', kind: 'invoice', text: 'Invoice · sent through Housecall Pro', amount: 7502 },
      { ymd: '2026-05-02', jobLabel: '717', kind: 'payment', text: 'Payment', amount: -500 },
    ],
    properties: [{ address: '15054 State Hwy 71', owner: 'TLE Holdings', source: 'record' }, { address: '15054 State Hwy 71', owner: '', source: 'job_address' }],
  },
  paper: { agreements: [], demandLetters: [], lienFilings: [] },
  theirWord: {
    timeline: [
      { ymd: '2026-07-04', text: 'Sent to collections: theft of service.', shared: true, jobLabel: '707' },
      { ymd: '2026-07-05', text: 'Held back', shared: false, jobLabel: '707' },
      { ymd: '2026-07-06', text: 'Left a message', shared: true, jobLabel: null },
    ],
  },
  evidence: [{ jobLabel: '717', reports: 3, sessions: 4, hours: 12.4 }, { jobLabel: '718', reports: 0, sessions: 0, hours: 0 }],
  ...over,
})

describe('exhibitDetails', () => {
  it('letters each exhibit the way the firm’s packet does, names its tab, and lists what is inside', () => {
    const d = exhibitDetails(source())
    expect(d.map((x) => [x.section, x.tab])).toEqual([
      ['A · Statement of account', 'account'],
      ['C · Record of contact', 'their_word'],
      ['D · Field evidence', 'evidence'],
    ])
    expect(d[0]?.lines[0]).toBe('04/13/26 · 718 · Invoice · sent through Housecall Pro · $1,480.00')
    expect(d[0]?.lines[2]).toContain('$500.00')
    expect(d[1]?.lines).toEqual(['07/04/26 · 707 · Sent to collections: theft of service.', '07/06/26 · Left a message'])
    expect(d[2]?.lines).toEqual(['717 · 3 reports · 4 clock sessions · 12 h'])
  })

  it('shows a few lines and counts the rest', () => {
    const ledger = Array.from({ length: 10 }, (_, i) => ({ ymd: `2026-01-${String(i + 1).padStart(2, '0')}`, jobLabel: '717', kind: 'invoice' as const, text: `Bill ${i + 1}`, amount: 100 }))
    const d = exhibitDetails(source({ exhibits: [{ letter: 'A', title: 'Invoices and payments', count: 10 }], account: { ledger, properties: [] } }))
    expect(d[0]?.lines).toHaveLength(EXHIBIT_LINES_SHOWN)
    expect(d[0]?.more).toBe(10 - EXHIBIT_LINES_SHOWN)
  })

  it('puts the folds in the firm’s order, the two A exhibits together', () => {
    const d = exhibitDetails(source({ exhibits: [
      { letter: 'A', title: 'Invoices and payments', count: 3 },
      { letter: 'B', title: 'What was said — contacts, promises, calls', count: 2 },
      { letter: 'C', title: 'Field reports and clock sessions', count: 7 },
      { letter: 'D', title: 'Property record', count: 1 },
    ] }))
    expect(d.map((x) => x.section)).toEqual(['A · Statement of account', 'A · Property record', 'C · Record of contact', 'D · Field evidence'])
  })

  it('leaves the job address out of the property record, as the count does', () => {
    const d = exhibitDetails(source({ exhibits: [{ letter: 'A', title: 'Property record', count: 1 }] }))
    expect(d[0]?.lines).toEqual(['15054 State Hwy 71 · owner TLE Holdings'])
  })
})

describe('exhibitsSummaryWords', () => {
  it('says how much goes and in how many exhibits', () => {
    expect(exhibitsSummaryWords([{ count: 3 }, { count: 2 }])).toBe("5 records go with the packet, in 2 exhibits, lettered the way the firm's packet letters them. Open one to see what is in it. The tabs above hold every row.")
    expect(exhibitsSummaryWords([{ count: 1 }])).toContain('1 record goes')
  })
  it('says what fills it when nothing goes yet', () => {
    expect(exhibitsSummaryWords([])).toMatch(/^Nothing goes with the packet yet/)
  })
})
