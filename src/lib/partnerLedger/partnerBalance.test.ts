import { describe, expect, it } from 'vitest'
import {
  balanceBridgeText,
  balanceConventionTitle,
  ledgerHours,
  officeBalanceLabel,
  officeBalanceWords,
  partnerBalanceFromLedger,
  partnerStubsToPostedJournal,
  pendingPartnerOffsets,
  splitPartnerBalance,
  type OffsetAttachment,
} from './partnerBalance'
import { buildJournalWeekCards, partnerStubsToJournal, type PartnerLedgerOffset, type PartnerLedgerStub, type PartnerSummary } from './partnerWeeks'

/**
 * Fixture reproducing the J26-F4 screen to the cent: the office read
 * Ledger −$1,008.13 · Timeline +$967.60 · Statements "attaching −$1,975.73"
 * with nothing on screen saying how they relate.
 */
const stubA: PartnerLedgerStub = {
  id: 'sA',
  period_start: '2026-08-02',
  period_end: '2026-08-08',
  // J26-F2: the stub says 12.85 h, the stamped tier days sum to 12.86 h.
  hours_total: 12.85,
  gross_pay: 450.1,
  company_ack_at: '2026-08-09',
  partner_ack_at: null,
  day_rates: [
    { rate: 35, hours: 12.86, amount: 450.1 },
    { rate: 0, hours: 0, amount: 0 },
  ],
  additional: [],
  // Mirrors the attached back-charge o-att — must not count twice.
  deductions: [{ description: 'Back-charge — return trip', amount: 150, person_offset_id: 'o-att' }],
  payments: [{ amount: 1000, paid_at: '2026-08-07', memo: null }],
}
const stubB: PartnerLedgerStub = {
  id: 'sB',
  period_start: '2026-08-09',
  period_end: '2026-08-15',
  hours_total: 40.5,
  gross_pay: 1755,
  company_ack_at: '2026-08-16',
  partner_ack_at: null,
  day_rates: [
    { rate: 50, hours: 22.5, amount: 1125 },
    { rate: 35, hours: 18, amount: 630 },
  ],
  additional: [],
  deductions: [],
  payments: [{ amount: 87.5, paid_at: '2026-08-14', memo: 'Friday' }],
}
const stubs = [stubB, stubA] // payload order: newest first

const offsets: PartnerLedgerOffset[] = [
  { id: 'o-att', type: 'backcharge', amount: 150, occurred_date: '2026-08-05', description: 'Return trip' },
  { id: 'o-p1', type: 'damage', amount: 1500, occurred_date: '2026-08-18', description: 'Cracked fixture' },
  { id: 'o-p2', type: 'utility_overage', amount: 475.73, occurred_date: '2026-08-20', description: null },
]
const attachments = new Map<string, OffsetAttachment>([
  ['o-att', { pay_stub_id: 'sA', person_name: 'Bryan Herber' }],
  ['o-p1', { pay_stub_id: null, person_name: 'Bryan Herber' }],
  ['o-p2', { pay_stub_id: null, person_name: 'Bryan Herber' }],
])

const summary: PartnerSummary = {
  exists: true,
  partnership_id: 'pp1',
  display_name: 'Bryan Herber',
  company_name: 'Herber Electric',
  started_on: '2026-03-22',
  status: 'active',
  balance: 967.6,
  modules: { weekly_statement: true, costing: true, profit_shares: true },
  current_week: { week_start: '2026-08-23', field_hours: 0, office_hours: 0, farm_hours: 0, gross_so_far: 0, pending_sessions: 0 },
  latest_statement: { pay_stub_id: 'sB', period_start: '2026-08-09', period_end: '2026-08-15', partner_ack_at: null, company_ack_at: '2026-08-16' },
  rates: { field: 50, estimating: 35, farm: 0 },
  pending_offsets: { count: 2, net: -1975.73 },
}

describe('splitPartnerBalance — the three office figures from one payload', () => {
  it('reproduces the J26 screen and pins the relationship: posted + attaching = ledger', () => {
    const s = splitPartnerBalance(stubs, offsets, attachments)
    expect(s.postedBalance).toBe(967.6) // Timeline running column
    expect(s.attaching).toBe(-1975.73) // Statements "attaching 2 of 2"
    expect(s.ledgerBalance).toBe(-1008.13) // Ledger headline = partner's BALANCE
    expect(s.pendingCount).toBe(2)
    expect(Math.round((s.postedBalance + s.attaching) * 100) / 100).toBe(s.ledgerBalance)
    expect(s.timelineDelta).toBe(s.attaching)
  })

  it('a pending credit lifts the ledger balance and the attaching figure together; the posted chain never moves', () => {
    const credit: PartnerLedgerOffset = { id: 'o-c', type: 'employee_credit', amount: 100, occurred_date: '2026-08-21', description: 'Tool credit' }
    const att = new Map(attachments)
    att.set('o-c', { pay_stub_id: null, person_name: 'Bryan Herber' })
    const s = splitPartnerBalance(stubs, [...offsets, credit], att)
    expect(s.postedBalance).toBe(967.6)
    expect(s.attaching).toBe(-1875.73)
    expect(s.ledgerBalance).toBe(-908.13)
    expect(s.pendingCount).toBe(3)
    expect(Math.round((s.postedBalance + s.attaching) * 100) / 100).toBe(s.ledgerBalance)
  })

  it('with nothing pending all three coincide', () => {
    const s = splitPartnerBalance(stubs, offsets.slice(0, 1), attachments)
    expect(s.attaching).toBe(0)
    expect(s.pendingCount).toBe(0)
    expect(s.ledgerBalance).toBe(s.postedBalance)
    expect(s.timelineDelta).toBe(0)
  })

  it('an attached charge is never counted twice — the statement deduction and the dated charge are one posting', () => {
    const s = splitPartnerBalance(stubs, offsets, attachments)
    const posted = partnerStubsToPostedJournal(stubs)
    const charges = partnerStubsToJournal(stubs, offsets)
    expect(posted.rows.filter((r) => r.label.startsWith('Back-charge'))).toHaveLength(1)
    expect(charges.rows.filter((r) => r.label === 'Return trip' || r.label.startsWith('Back-charge'))).toHaveLength(1)
    expect(charges.rows.find((r) => r.label === 'Return trip')?.offset_id).toBe('o-att')
    // Posted journal books it on the statement's week; the charges journal on its own date — same money,
    // so the two journals differ by exactly the charges still pending.
    expect(Math.round((charges.balance - s.attaching) * 100) / 100).toBe(posted.balance)
  })
})

describe('partnerBalanceFromLedger — straight from the raw RPC payload', () => {
  const payload = { exists: true, notes: [], stubs, offsets }

  it('reads the same three figures the tabs show', () => {
    const s = partnerBalanceFromLedger(payload, attachments)
    expect([s.ledgerBalance, s.postedBalance, s.attaching]).toEqual([-1008.13, 967.6, -1975.73])
  })

  it('without the attachment lookup charges still know they are pending (deduction links); the identity holds', () => {
    const s = partnerBalanceFromLedger(payload)
    expect(s.pendingCount).toBe(2)
    expect([s.ledgerBalance, s.postedBalance, s.attaching]).toEqual([-1008.13, 967.6, -1975.73])
  })

  it('without the lookup a pending CREDIT reads as attached — in neither figure, so nothing disagrees', () => {
    const credit = { id: 'o-c', type: 'employee_credit', amount: 100, occurred_date: '2026-08-21', description: 'Tool credit' }
    const s = partnerBalanceFromLedger({ ...payload, offsets: [...offsets, credit] })
    expect(s.pendingCount).toBe(2)
    expect(s.ledgerBalance).toBe(-1008.13)
    expect(Math.round((s.postedBalance + s.attaching) * 100) / 100).toBe(s.ledgerBalance)
  })

  it('exists:false / garbage → zeros', () => {
    expect(partnerBalanceFromLedger({ exists: false })).toEqual({ ledgerBalance: 0, postedBalance: 0, attaching: 0, timelineDelta: 0, pendingCount: 0 })
    expect(partnerBalanceFromLedger(null).ledgerBalance).toBe(0)
  })
})

describe('hours — the office reads the same rate-tier days the partner reads (J26-F2)', () => {
  it('ledgerHours is Σ tier hours (12.86), not the stub total (12.85)', () => {
    expect(ledgerHours(stubA)).toBe(12.86)
    expect(ledgerHours({ ...stubA, day_rates: [] })).toBe(12.85)
    expect(ledgerHours({ ...stubA, day_rates: [], hours_total: 12.849 })).toBe(12.85)
  })

  it('the posted journal (Timeline) and the charges journal (Ledger) both say 12.86 h for the fixture week', () => {
    const posted = partnerStubsToPostedJournal(stubs).rows.find((r) => r.pay_stub_id === 'sA' && r.kind === 'labor')
    const charges = partnerStubsToJournal(stubs, offsets).rows.find((r) => r.pay_stub_id === 'sA' && r.kind === 'labor')
    expect(posted?.hours).toBe(12.86)
    expect(charges?.hours).toBe(12.86)
    expect(posted?.label).toBe('Labor — 12.86 h (week of 2026-08-02)')
    expect(charges?.label).toBe(posted?.label)
    // And the partner's own card says the same number.
    const cards = buildJournalWeekCards(summary, stubs, offsets)
    const weekA = cards.find((c) => c.stubId === 'sA')
    expect(weekA?.lines.find((l) => l.label.startsWith('Labor'))?.label).toBe('Labor · 12.86 h × $35')
  })
})

describe('reconcile — the partner statement is unchanged by the office reading its payload (J26-K1)', () => {
  it("the office Ledger headline IS the partner's Full-ledger balance (plus credits still pending)", () => {
    const office = splitPartnerBalance(stubs, offsets, attachments)
    const partner = partnerStubsToJournal(stubs, offsets)
    expect(office.ledgerBalance).toBe(partner.balance) // no pending credits in the fixture
    // Row for row: the office journal is the partner journal (offset_id is the only extra field).
    const officeRows = partnerStubsToJournal(stubs, offsets).rows.map(({ offset_id: _o, ...r }) => r)
    const partnerRows = partner.rows.map(({ offset_id: _o, ...r }) => r)
    expect(officeRows).toEqual(partnerRows)
  })

  it('every week card still satisfies opening + lines = closing, and the newest closing is the Full-ledger balance', () => {
    const cards = buildJournalWeekCards(summary, stubs, offsets)
    const round2 = (n: number) => Math.round(n * 100) / 100
    for (const c of cards) {
      const sum = c.lines.reduce((a, l) => a + (l.amount ?? 0), 0)
      expect(round2((c.opening ?? 0) + sum)).toBe(c.closing)
    }
    expect(cards[0]?.closing).toBe(partnerStubsToJournal(stubs, offsets).balance)
    expect(cards[0]?.closing).toBe(-1008.13)
  })
})

describe('pendingPartnerOffsets', () => {
  it('charges: pending unless a statement deduction links them; credits: pending only when the attachment row says so; newest first', () => {
    const p = pendingPartnerOffsets(stubs, offsets, attachments)
    expect(p.map((o) => o.id)).toEqual(['o-p2', 'o-p1'])
    expect(pendingPartnerOffsets(stubs, offsets, new Map()).map((o) => o.id)).toEqual(['o-p2', 'o-p1'])
    const credit: PartnerLedgerOffset = { id: 'o-c', type: 'profit_share', amount: 300, occurred_date: '2026-08-22', description: null }
    expect(pendingPartnerOffsets(stubs, [...offsets, credit], new Map()).map((o) => o.id)).toEqual(['o-p2', 'o-p1'])
    const att = new Map(attachments)
    att.set('o-c', { pay_stub_id: null, person_name: 'Bryan Herber' })
    expect(pendingPartnerOffsets(stubs, [...offsets, credit], att).map((o) => o.id)).toEqual(['o-c', 'o-p2', 'o-p1'])
    att.set('o-c', { pay_stub_id: 'sB', person_name: 'Bryan Herber' })
    expect(pendingPartnerOffsets(stubs, [...offsets, credit], att).map((o) => o.id)).toEqual(['o-p2', 'o-p1'])
  })
})

describe('words — who owes whom, office side', () => {
  it('officeBalanceWords / officeBalanceLabel', () => {
    expect(officeBalanceWords(967.6, 'Bryan')).toBe('we owe Bryan')
    expect(officeBalanceWords(-1008.13, 'Bryan')).toBe('Bryan owes us')
    expect(officeBalanceWords(0, 'Bryan')).toBe('even')
    expect(officeBalanceLabel(967.6, 'Bryan')).toBe('we owe Bryan $967.60')
    expect(officeBalanceLabel(-1008.13, 'Bryan')).toBe('Bryan owes us $1,008.13')
    expect(officeBalanceLabel(0, 'Bryan')).toBe('even')
  })

  it('balanceBridgeText spells the relationship in one line; empty when nothing is pending', () => {
    const s = splitPartnerBalance(stubs, offsets, attachments)
    expect(balanceBridgeText(s, 'Bryan')).toBe('posted we owe Bryan $967.60 · −$1,975.73 not yet on a statement (2) → Bryan owes us $1,008.13')
    expect(balanceBridgeText(splitPartnerBalance(stubs, offsets.slice(0, 1), attachments), 'Bryan')).toBe('')
  })

  it('balanceConventionTitle names both directions', () => {
    const t = balanceConventionTitle('Bryan')
    expect(t).toContain('+ we owe Bryan')
    expect(t).toContain('− Bryan owes us')
  })
})
