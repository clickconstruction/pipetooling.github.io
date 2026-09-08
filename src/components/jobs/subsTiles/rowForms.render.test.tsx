// @vitest-environment jsdom
/**
 * Render smokes for the three row forms (v2.2963, step 4): each mounts with its
 * pre-read values and its buttons; nothing is sent (the client is stubbed).
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
import type { SubsStageRow } from '../../../lib/subs/subsTabRows'
import type { JobWithDetails } from '../../../types/jobWithDetails'
import { OfferSheetForm, OfferStageForm, ResendForm } from './rowForms'

const TODAY = '2026-09-07'
const rail: SheetRail = { steps: [], current: 'work', gap: true, group: 'no_agreement', position: 0, label: '', sublabel: null, tone: 'now', crewPay: false }
const row: WorkOrderBoardRow = { key: 'sheet:1', sheetId: 's1', commitmentId: null, recordId: null, jobId: 'job-880', jobNumber: '880', primary: '#880 · Knight', secondary: null, notInPipeline: false, subNames: ['Airfordable HVAC'], subName: 'Airfordable HVAC', personId: 'p-air', agreed: 4200, paid: 0, open: 4200, unpriced: false, sheetDate: '2026-08-06', coverage: { kind: 'none' }, rail, next: { label: '', hint: null, button: 'draft', buttonLabel: null }, group: 'no_agreement' }
const jobs = [{ id: 'job-880', hcp_number: '880', customer_name: 'Knight Contracting', job_address: '150 E Sonterra Blvd', fixtures: [] } as unknown as JobWithDetails]
const actions = { linkSheetToJobQuiet: vi.fn(async () => true), newJobForSheet: vi.fn(), openAssembler: vi.fn(), changed: vi.fn(), saveWindow: vi.fn(async () => true) }

describe('row forms', () => {
  it('OfferSheetForm opens on the sheet total and the day they started, and can be cancelled', () => {
    const onCancel = vi.fn()
    renderWithProviders(<OfferSheetForm row={row} workingSince="2026-08-06" needsJob={false} jobs={jobs} contacts={new Map()} authUserId="u-1" todayYmd={TODAY} actions={actions} onSent={vi.fn()} onCancel={onCancel} />)
    expect((screen.getByPlaceholderText('0.00') as HTMLInputElement).value).toBe('4200')
    expect(screen.getByRole('button', { name: 'Send' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
  it('OfferSheetForm asks for the job first on a sheet that is not in Pipeline', () => {
    renderWithProviders(<OfferSheetForm row={{ ...row, jobId: null, jobNumber: '977', notInPipeline: true }} workingSince="2026-08-20" needsJob jobs={jobs} contacts={new Map()} authUserId="u-1" todayYmd={TODAY} actions={actions} onSent={vi.fn()} />)
    expect(screen.getByText('Pick the job first')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Link and send' })).toBeTruthy()
  })
  it('OfferStageForm lists the subs with availability and asks for the sub first', () => {
    const stage: SubsStageRow = { key: 'stage:a', kind: 'stage', jobId: 'job-880', stage: { id: 'a', name: 'Trim & final', amount: 1200, sequence: 1, kind: 'order', shared: false }, window: { id: 'w-a', job_id: 'job-880', fixture_id: 'a', window_start: '2026-09-22', window_end: '2026-10-02', window_by: 'office' }, span: { start: '2026-09-22', end: '2026-10-02' }, board: null }
    renderWithProviders(<OfferStageForm row={stage} suggestedSpan={null} phasePassed={false} jobs={jobs} subs={[{ id: 'p-behar', name: 'Behar Kraja', benched: false }]} contacts={new Map()} orders={[]} offDaysByPerson={new Map()} availabilityLoading={false} authUserId="u-1" todayYmd={TODAY} actions={actions} onSent={vi.fn()} />)
    expect(screen.getByText('Pick the sub')).toBeTruthy()
    expect(screen.getByText('free those days')).toBeTruthy()
    fireEvent.click(screen.getByRole('radio'))
    expect(screen.getByRole('button', { name: 'Send offer' })).toBeTruthy()
  })
  it('ResendForm keeps the WO number and opens on the order\'s values', () => {
    const order = { id: 'o-1', person_id: 'p-mike', display_name: 'Michael A', job_id: 'job-880', labor_job_id: null, status: 'offered', amount: 1500, record_id: 'WO-880-01', proposed_start: '2026-09-08', proposed_end: '2026-09-12', work_days: 4, stage_window_id: null } as unknown as StepCommitmentRow
    renderWithProviders(<ResendForm order={order} jobs={jobs} contacts={new Map()} authUserId="u-1" todayYmd={TODAY} actions={actions} onSent={vi.fn()} />)
    expect(screen.getByText(/Keeps WO-880-01/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Re-send' })).toBeTruthy()
  })
})
