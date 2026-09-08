// @vitest-environment jsdom
/**
 * Render smokes for the four Subs tile queues (v2.2963): each mounts on fixture
 * rows in its populated state, paints the header number, the row facts and the
 * row's own buttons, and the open row's inline form. Writes are stubbed —
 * nothing here reaches the client.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'

vi.mock('../../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

import { renderWithProviders } from '../../../test/renderSmokeMocks'
import type { WorkOrderBoardRow } from '../../../lib/subWorkOrders/workOrderBoardRows'
import type { SheetRail } from '../../../lib/subWorkOrders/sheetRail'
import type { StepCommitmentRow } from '../../../lib/workflow/stepCommitments'
import type { SubsJobGroup } from '../../../lib/subs/subsTabRows'
import type { SubDispatchOrder } from '../../../lib/subs/subDispatch'
import type { JobWithDetails } from '../../../types/jobWithDetails'
import type { SubsTileActions } from './subsTileActions'
import { HandshakeQueue } from './HandshakeQueue'
import { StagesQueue } from './StagesQueue'
import { OffersQueue } from './OffersQueue'
import { SignedQueue } from './SignedQueue'

const TODAY = '2026-09-06'

const rail = (current: SheetRail['current'], group: SheetRail['group'], label = ''): SheetRail => ({ steps: [], current, gap: group === 'no_agreement', group, position: 0, label, sublabel: null, tone: 'now', crewPay: false })

function row(over: Partial<WorkOrderBoardRow> & { key: string }): WorkOrderBoardRow {
  return {
    sheetId: `sheet-${over.key}`,
    commitmentId: null,
    recordId: null,
    jobId: 'job-880',
    jobNumber: '880',
    primary: '#880 · Knight Contracting',
    secondary: '150 E Sonterra Blvd',
    notInPipeline: false,
    subNames: ['Airfordable HVAC'],
    subName: 'Airfordable HVAC',
    personId: 'p-air',
    agreed: 4200,
    paid: 0,
    open: 4200,
    unpriced: false,
    sheetDate: '2026-09-02',
    coverage: { kind: 'none' },
    rail: rail('work', 'no_agreement', 'Work · no agreement'),
    next: { label: 'Get it in writing', hint: null, button: 'draft', buttonLabel: 'Draft a work order…' },
    group: 'no_agreement',
    ...over,
  }
}

function order(over: Partial<StepCommitmentRow> & { id: string }): StepCommitmentRow {
  return { person_id: 'p-behar', display_name: 'Behar Kraja', job_id: 'job-880', labor_job_id: null, status: 'offered', amount: 3800, record_id: `WO-880-${over.id}`, proposed_start: '2026-09-22', proposed_end: '2026-10-02', offer_expires_at: '2026-09-11', offered_at: '2026-09-04T12:00:00Z', stage_window_id: null, work_days: 5, picked_start: null, picked_end: null, signer_signature_mode: null, ...over } as StepCommitmentRow
}

const jobs = [{ id: 'job-880', hcp_number: '880', customer_name: 'Knight Contracting', job_address: '150 E Sonterra Blvd', customer_id: 'c-1', fixtures: [] } as unknown as JobWithDetails]

const actions = (): SubsTileActions => ({
  changed: vi.fn(),
  openAssembler: vi.fn(),
  withdraw: vi.fn(async () => {}),
  withdrawQuiet: vi.fn(async () => true),
  nudge: vi.fn(async () => {}),
  markSignedOnPaper: vi.fn(async () => {}),
  print: vi.fn(),
  saveWindow: vi.fn(async () => true),
  removeWindow: vi.fn(async () => {}),
  answerGcAsk: vi.fn(async () => {}),
  linkSheetToJobQuiet: vi.fn(async () => true),
  newJobForSheet: vi.fn(),
  extendOffer: vi.fn(async () => true),
  openSheet: vi.fn(),
  setSheetStage: vi.fn(async () => true),
  openMakePayment: vi.fn(),
  billCustomer: vi.fn(),
  openAddInspection: vi.fn(),
})

describe('HandshakeQueue', () => {
  it('lists handshake rows most money first, opens the first as a pre-read order, and gates a Not in Pipeline row on the job', () => {
    const board = [row({ key: 'air' }), row({ key: 'tx', jobId: null, jobNumber: '977', primary: '#977', secondary: 'Hospital', subNames: ['Texas R & A'], subName: 'Texas R & A', personId: 'p-tx', agreed: 40000, open: 40000, sheetDate: '2026-08-30', notInPipeline: true })]
    renderWithProviders(<HandshakeQueue board={board} jobs={jobs} contacts={new Map([['p-tx', { email: null, phone: '(512) 555-0142' }]])} authUserId="u-1" todayYmd={TODAY} actions={actions()} onClose={vi.fn()} />)
    expect(screen.getByText('Get it in writing')).toBeTruthy()
    expect(screen.getByText('$44,200.00')).toBeTruthy()
    // The $40,000 row is first and open; it needs a job before it can go.
    expect(screen.getByText('Pick the job first')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Link and send' })).toBeTruthy()
    expect(screen.getByText('📞 (512) 555-0142')).toBeTruthy()
    expect(screen.getAllByText(/7 days/).length).toBeGreaterThan(0)
    // The second row waits with its own door.
    expect(screen.getByRole('button', { name: 'Draft a work order…' })).toBeTruthy()
    expect(screen.getByText('0 of 2')).toBeTruthy()
  })
})

describe('StagesQueue', () => {
  const stageRow = (id: string, start: string, end: string, asked: boolean) => ({
    key: `stage:${id}`,
    kind: 'stage' as const,
    jobId: 'job-880',
    stage: { id, name: id === 'a' ? 'Trim & final' : 'Rough-in', amount: 1200, sequence: 1, kind: 'order' as const, shared: false },
    window: { id: `w-${id}`, job_id: 'job-880', fixture_id: id, window_start: start, window_end: end, window_by: 'office', asked_start: asked ? '2026-09-29' : null, asked_end: asked ? '2026-10-10' : null, asked_at: asked ? '2026-09-05T00:00:00Z' : null, asked_note: asked ? 'framing slipped' : null, answered_at: null },
    span: { start, end },
    board: null,
  })
  const groups: SubsJobGroup[] = [{ key: 'job-880', jobId: 'job-880', jobNumber: '880', primary: '#880 · Knight Contracting', secondary: null, rows: [stageRow('a', '2026-09-01', '2026-09-05', false), stageRow('b', '2026-09-22', '2026-10-02', true)], attention: 2, freeFixtures: [] }]
  const orders: SubDispatchOrder[] = [{ id: 'o-1', personId: 'p-mike', personName: 'Michael A', jobId: 'job-273', jobLabel: '#273', status: 'accepted', pickedStart: '2026-09-08', pickedEnd: '2026-09-09', proposedStart: null, proposedEnd: null, windowStart: null, windowEnd: null, stageName: 'Trim & final', recordId: null }]
  it('groups passed before ahead, answers the GC on the row, and shows who is free in the picker', () => {
    renderWithProviders(
      <StagesQueue groups={groups} jobs={jobs} subs={[{ id: 'p-behar', name: 'Behar Kraja', benched: false }, { id: 'p-mike', name: 'Michael A', benched: false }, { id: 'p-old', name: 'Old Timer', benched: true }]} contacts={new Map()} orders={orders} offDaysByPerson={new Map()} availabilityLoading={false} authUserId="u-1" todayYmd={TODAY} actions={actions()} onClose={vi.fn()} />,
    )
    expect(screen.getByText('Put a sub on each stage')).toBeTruthy()
    expect(screen.getByText(/Window passed/)).toBeTruthy()
    expect(screen.getByText('Ahead')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Accept Sep 29 – Oct 10' })).toBeTruthy()
    // The passed window is open: its suggested span (Sep 7 – Sep 10) drives the picker's question.
    expect(screen.getByText(/free Sep 7 – Sep 10\?/)).toBeTruthy()
    expect(screen.getByText('free those days')).toBeTruthy()
    expect(screen.getByText('on #273 · Trim & final')).toBeTruthy()
    expect(screen.getByRole('button', { name: '+ 1 on the bench' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Move window and send offer' })).toBeTruthy()
    expect(screen.getByText('Pick the sub')).toBeTruthy()
  })
})

describe('OffersQueue', () => {
  it('puts the expired offer first with Re-send, offers Nudge and Extend on the live one, and reads the portal log', () => {
    const expired = order({ id: 'old', person_id: 'p-mike', display_name: 'Michael A', amount: 1500, offered_at: '2026-08-28T12:00:00Z', offer_expires_at: '2026-09-04' })
    const live = order({ id: 'new' })
    const board = [
      row({ key: 'order:new', commitmentId: 'new', recordId: 'WO-880-new', subName: 'Behar Kraja', subNames: ['Behar Kraja'], personId: 'p-behar', group: 'sent', rail: rail('signed', 'sent', 'Sent'), coverage: { kind: 'sent', id: 'new', subName: 'Behar Kraja', amount: 3800, sentAt: '2026-09-04', expiresOn: '2026-09-11', expired: false } }),
      row({ key: 'order:old', commitmentId: 'old', recordId: 'WO-880-old', subName: 'Michael A', subNames: ['Michael A'], personId: 'p-mike', group: 'sent', rail: rail('signed', 'sent', 'Sent'), coverage: { kind: 'sent', id: 'old', subName: 'Michael A', amount: 1500, sentAt: '2026-08-28', expiresOn: '2026-09-04', expired: true } }),
    ]
    const visits = new Map([
      ['p-mike', { personId: 'p-mike', outsideOpens: 0, firstOutsideAt: null, lastOutsideAt: null, staffLooks: 0, lastStaffAt: null, lastStaffUserId: null, lastStaffName: null }],
      ['p-behar', { personId: 'p-behar', outsideOpens: 3, firstOutsideAt: null, lastOutsideAt: '2026-09-06T10:00:00Z', staffLooks: 0, lastStaffAt: null, lastStaffUserId: null, lastStaffName: null }],
    ])
    const a = actions()
    renderWithProviders(<OffersQueue board={board} ordersById={new Map([['old', expired], ['new', live]])} stageByOrderId={new Map([['new', { name: 'Rough-in', span: { start: '2026-09-22', end: '2026-10-02' } }]])} jobs={jobs} contacts={new Map()} visits={visits} authUserId="u-1" todayYmd={TODAY} actions={a} onClose={vi.fn()} />)
    expect(screen.getByText('Chase the signatures')).toBeTruthy()
    expect(screen.getAllByText(/1 expired/).length).toBeGreaterThan(0)
    // Expired first and open on the Re-send form.
    expect(screen.getByRole('button', { name: 'Re-send' })).toBeTruthy()
    expect(screen.getByText('expired Sep 4')).toBeTruthy()
    expect(screen.getByText('never opened their portal')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Offer someone else…' })).toBeTruthy()
    // The live one.
    expect(screen.getByText('Sep 11 · 5 days left')).toBeTruthy()
    expect(screen.getByText(/pick a start inside Sep 22 – Oct 2/)).toBeTruthy()
    expect(screen.getByText(/opened Sep 6 · 3×/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Extend +7 days' }))
    expect(a.extendOffer).toHaveBeenCalledWith(live, 7)
    expect(screen.getByRole('button', { name: 'Nudge everyone unopened · 1' })).toBeTruthy()
  })
})

describe('SignedQueue', () => {
  it('turns the board\'s next move into a button per row and steps back a month in the footer', () => {
    const signed = (key: string, current: SheetRail['current'], signedOn: string, open: number, over: Partial<WorkOrderBoardRow> = {}) =>
      row({ key, commitmentId: key, recordId: `WO-880-${key}`, group: 'signed', open, rail: rail(current, 'signed', current === 'inspection' ? 'Pre-inspection' : current === 'customer_pays' ? 'Waiting on customer' : current === 'paid' ? 'Queued for the pay run' : 'Work'), coverage: { kind: 'signed', id: key, subName: 'Behar Kraja', amount: 1000, signedOn, laborJobId: `sheet-${key}`, recordId: `WO-880-${key}` }, subName: 'Behar Kraja', subNames: ['Behar Kraja'], personId: 'p-behar', agreed: 1000, ...over })
    const board = [signed('insp', 'inspection', '2026-09-04', 1000), signed('bill', 'customer_pays', '2026-09-01', 1000), signed('pay', 'paid', '2026-09-03', 1000), signed('wait', 'work', '2026-09-05', 1000), signed('aug', 'work', '2026-08-20', 1000)]
    const orders = new Map(board.map((r) => [r.key, order({ id: r.key, status: 'accepted', picked_start: r.key === 'pay' ? '2026-09-09' : null, picked_end: r.key === 'pay' ? '2026-09-10' : null, signer_signature_mode: r.key === 'insp' ? null : 'typed' })]))
    const a = actions()
    renderWithProviders(<SignedQueue board={board} ordersById={orders} stageByOrderId={new Map()} jobs={jobs} month="2026-09" currentMonth="2026-09" onMonthChange={vi.fn()} actions={a} onClose={vi.fn()} />)
    expect(screen.getByText("Signed in September · what's next")).toBeTruthy()
    expect(screen.getByText('$4,000.00')).toBeTruthy()
    expect(screen.getByText(/3 needs? the office|3 need the office/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Passed → bill' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Schedule inspection…' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Bill Knight Contracting' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Pay Behar Kraja · $1,000.00' })).toBeTruthy()
    expect(screen.getByText('Waiting on the sub')).toBeTruthy()
    expect(screen.getByText('on paper')).toBeTruthy()
    expect(screen.getByText(/their pick/)).toBeTruthy()
    expect(screen.getByRole('button', { name: '‹ August · 1' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Pay Behar Kraja · $1,000.00' }))
    expect(a.openMakePayment).toHaveBeenCalledWith(expect.objectContaining({ id: 'sheet-pay', contractor: 'Behar Kraja', outstanding: 1000 }), '1000')
  })
})
