import { describe, expect, it } from 'vitest'
import type { WorkOrderBoardRow } from '../subWorkOrders/workOrderBoardRows'
import type { SheetRail } from '../subWorkOrders/sheetRail'
import { standingMovesForRow, subFirstName } from './standingMove'

const rail = (current: SheetRail['current']): SheetRail => ({ steps: [], current, gap: false, group: 'signed', position: 0, label: '', sublabel: null, tone: 'now', crewPay: false })
const row = (over: Partial<WorkOrderBoardRow>): WorkOrderBoardRow =>
  ({ key: 'k', sheetId: 's', commitmentId: null, recordId: null, jobId: 'j', jobNumber: '880', primary: '#880', secondary: null, notInPipeline: false, subNames: ['Behar Kraja'], subName: 'Behar Kraja', personId: 'p', agreed: 1000, paid: 0, open: 1000, unpriced: false, sheetDate: null, coverage: { kind: 'none' }, rail: rail('work'), next: { label: '', hint: 'a hint', button: null, buttonLabel: null }, group: 'no_agreement', ...over }) as WorkOrderBoardRow

const ctx = { todayYmd: '2026-09-06', customerName: 'Heron' }

describe('standingMovesForRow', () => {
  it('names the first name, keeps multi-name sheets whole', () => {
    expect(subFirstName('Behar Kraja')).toBe('Behar')
    expect(subFirstName('Michael A | Behar Kraja')).toBe('Michael A | Behar Kraja')
    expect(subFirstName('')).toBe('the sub')
  })
  it('agreement states', () => {
    expect(standingMovesForRow(row({}), ctx).primary).toMatchObject({ kind: 'draft', label: 'Get it in writing', tone: 'primary', hint: 'a hint' })
    expect(standingMovesForRow(row({ coverage: { kind: 'draft', id: 'o', subName: 'S', unpriced: true } }), ctx).primary).toMatchObject({ kind: 'price', tone: 'primary' })
    expect(standingMovesForRow(row({ coverage: { kind: 'draft', id: 'o', subName: 'S', unpriced: false } }), ctx).primary).toMatchObject({ kind: 'send', label: 'Send it' })
    expect(standingMovesForRow(row({ coverage: { kind: 'declined', id: 'o', subName: 'S', reason: 'too soon' } }), ctx).primary).toMatchObject({ kind: 'reoffer', tone: 'warn' })
  })
  it('sent: waiting, then a nudge after three days, then re-send once expired', () => {
    const sent = (sentAt: string, expired = false) => row({ coverage: { kind: 'sent', id: 'o', subName: 'S', amount: 1, sentAt, expiresOn: '2026-09-11', expired } })
    expect(standingMovesForRow(sent('2026-09-05'), ctx).primary).toMatchObject({ kind: 'view', label: 'Waiting on Behar · 1 day', tone: 'ghost', hint: 'good through 2026-09-11' })
    expect(standingMovesForRow(sent('2026-09-02'), ctx).primary).toMatchObject({ kind: 'nudge', label: 'Nudge Behar', tone: 'warn' })
    expect(standingMovesForRow(sent('2026-08-28', true), ctx).primary).toMatchObject({ kind: 'resend', label: 'Re-send…', tone: 'warn', hint: 'expired 2026-09-11' })
  })
  it('signed: the sheet step decides, with two moves only at pre-inspection', () => {
    const signed = (current: SheetRail['current'], open = 1000) => row({ open, rail: rail(current), coverage: { kind: 'signed', id: 'o', subName: 'S', amount: 1000, signedOn: '2026-09-01', laborJobId: 's', recordId: 'WO' } })
    expect(standingMovesForRow(signed('work'), ctx).primary).toMatchObject({ kind: 'wait_sub', tone: 'quiet', label: 'Waiting on Behar' })
    const insp = standingMovesForRow(signed('inspection'), ctx)
    expect(insp.primary).toMatchObject({ kind: 'inspection', label: 'Schedule inspection…' })
    expect(insp.second).toMatchObject({ kind: 'passed', label: 'Passed → bill', tone: 'ok' })
    expect(standingMovesForRow(signed('customer_pays'), ctx).primary).toMatchObject({ kind: 'bill', label: 'Bill Heron', hint: 'Behar is owed $1,000.00 once they pay' })
    expect(standingMovesForRow(signed('paid', 250), ctx).primary).toMatchObject({ kind: 'pay', label: 'Pay Behar · $250.00', tone: 'ok' })
    expect(standingMovesForRow(signed('paid', 0), ctx).primary).toMatchObject({ kind: 'done', tone: 'quiet' })
  })
})
