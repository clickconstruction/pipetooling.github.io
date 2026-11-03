import { describe, expect, it } from 'vitest'
import { buildChargeStatementHtml, chargeStatementPeriodLabel, chargeStatementWords, cutJobChargesToPeriod, jobChargesSpan, nextChargeStatementRecordId, parseChargeStatementRecordId, type ChargeStatementSnapshot } from './statementOfCharges'
import { buildJobCharges } from './jobCharges'
import { chargeAdjustmentFromRow } from './adjustments'
import type { CrewSessionInput } from './crewDays'

const OWNER = { rates: { master_helper: 285, two_techs: 285, tech_alone: 185, helper_alone: 75 }, extraPerson: null, materialsMarkupPct: 25 }
const s = (userId: string, name: string, standing: CrewSessionInput['standing'], workDate: string, hours: number, imported = false): CrewSessionInput => ({ userId, name, standing, workDate, hours, imported })

const snapshot: ChargeStatementSnapshot = {
  input: {
    sessions: [s('t', 'Avery', 'master', '2026-04-20', 9), s('z', 'Blake', 'tech', '2026-04-20', 9.93), s('t', 'Avery', 'master', '2026-04-22', 8), s('z', 'Blake', 'tech', '2026-04-25', 9.44), s('t', 'Avery', 'master', '2026-01-20', 8, true), s('t', 'Avery', 'master', '2026-12-01', 8)],
    lines: [
      { id: 'inv:1', kind: 'supply_invoice', label: 'A supply house · invoice 1001', dateKey: '2026-04-16', cost: 2000 },
      { id: 'inv:2', kind: 'supply_invoice', label: 'A rental yard · invoice 2002', dateKey: '2026-04-01', cost: 1400 },
      { id: 'inv:3', kind: 'supply_invoice', label: 'A supply house · invoice 3003', dateKey: '2026-11-12', cost: 1700 },
      { id: 'typed:1', kind: 'typed_charge', label: 'Pipe from the yard', dateKey: null, cost: 100 },
    ],
    card: OWNER,
    rule: { kind: 'shape', shape: 'master_helper' },
    markupPct: null,
    adjustments: [chargeAdjustmentFromRow({ id: 'a1', job_id: 'j', kind: 'line_pass_through', target: 'inv:2', amount: 1400, reason: 'a rental', made_by_name: 'Dana', created_at: '2026-11-03T08:00:00Z' })!],
    revenue: 250000,
  },
  period: { start: '2026-01-01', end: '2026-10-31' },
  job: { number: '1042', name: 'ROUGH IN: house and barn', customer: 'Example Builders', site: '1 Field Rd, Anytown' },
  preparedBy: 'Dana',
  preparedOn: 'November 3, 2026',
  asOf: 'Nov 3, 9:00 AM',
  nameImportedDays: true,
}

describe('the Statement of charges (punch list #254)', () => {
  it('counts record ids per job from 0001 and parses them back', () => {
    expect(nextChargeStatementRecordId('1042', [])).toBe('SC-1042-0001')
    expect(nextChargeStatementRecordId('1042', ['SC-1042-0001', 'SC-1042-0007', 'HS-1042-0009'])).toBe('SC-1042-0008')
    expect(parseChargeStatementRecordId('SC-1042-0008')).toEqual({ jobNumber: '1042', n: 8 })
    expect(parseChargeStatementRecordId('HS-1042-0008')).toBeNull()
  })

  it('cuts the read to the period, keeping an undated line, and finds the span anything happened in', () => {
    const cut = cutJobChargesToPeriod(snapshot.input, '2026-01-01', '2026-10-31')
    expect(cut.sessions.map((x) => x.workDate)).toEqual(['2026-04-20', '2026-04-20', '2026-04-22', '2026-04-25', '2026-01-20'])
    expect(cut.lines.map((l) => l.id)).toEqual(['inv:1', 'inv:2', 'typed:1'])
    expect(jobChargesSpan(snapshot.input)).toEqual({ start: '2026-01-20', end: '2026-12-01' })
    expect(chargeStatementPeriodLabel('2026-01-01', '2026-10-31')).toBe('January 1 – October 31, 2026')
    expect(chargeStatementPeriodLabel('2025-03-10', '2026-03-27')).toBe('March 10, 2025 – March 27, 2026')
  })

  it("words how the paper was priced: the job's rule with its rate, the markup both ways, the imported days named", () => {
    const charges = buildJobCharges(cutJobChargesToPeriod(snapshot.input, '2026-01-01', '2026-10-31'))
    const w = chargeStatementWords(snapshot, charges)
    expect(w.laborAt).toBe('master with a helper throughout · $285.00 the crew’s hour')
    expect(w.materialsAt).toBe('25% over cost, the company’s markup')
    expect(w.laborNote).toBe('A crew’s hours are the longest day of anyone in it. 1 of the 4 days are imported from the pay records, the rest from the clock.')
    expect(w.materialsNote).toBe('1 line is passed through at cost.')
    expect(w.preparedLine).toBe('Prepared from the company’s records, labor as master with a helper throughout · $285.00 the crew’s hour, materials at 25% over cost, the company’s markup')
  })

  it('prints the office copy with cost, markup, the premium and the adjustments, and the customer copy with charged amounts only', () => {
    const office = buildChargeStatementHtml({ snapshot, copy: 'office', recordId: 'SC-1042-0001' })
    const customer = buildChargeStatementHtml({ snapshot, copy: 'customer', recordId: 'SC-1042-0001' })
    expect(office).toContain('<h1>Statement of charges</h1>')
    expect(office).toContain('Office copy · Statement SC-1042-0001')
    expect(office).toContain('<th class="n">Cost</th>')
    expect(office).toContain('Office only · never on the customer copy')
    expect(office).toContain('<b>Premium</b>')
    expect(office).toContain('passed through at cost · a rental · Dana')
    // the note sits under the grid, not inside it, so the figures keep their column
    expect(office).toMatch(/every line is the record<\/div>|a rental · Dana<\/div>/)
    expect(office).toContain('</div></div>\n    <p class="note">')
    expect(office).toContain('Week of Apr 20')
    expect(office).toContain('Blake, Avery')
    expect(customer).not.toContain('<th class="n">Cost</th>')
    expect(customer).not.toContain('Office only')
    expect(customer).not.toContain('Premium')
    expect(customer).toContain('This is a statement of charges for the period, not an invoice.')
    expect(customer).toContain('Prepared from the company’s records · by Dana')
    // the cents smaller than the dollars, the owner's rule
    expect(office).toContain('<span class="c">.')
  })
})
