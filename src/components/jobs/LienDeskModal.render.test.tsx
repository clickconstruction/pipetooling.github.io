// @vitest-environment jsdom
/**
 * Render smokes for the Lien desk (v2.3405): the piles and the list from a
 * built queue, the office pane's readiness gate (owner of record blocks the
 * send and offers the door), months checkboxes, the document preview, the
 * spoken-word form, and the leader's decision footer. Wiring-level only —
 * the queue math lives in src/lib/jobs/lienDesk.test.ts.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import LienDeskModal from './LienDeskModal'
import { buildLienDeskQueue, summarizeLienDeskForNeedsYou, type LienDeskItemRow, type LienNoticeMonthRow } from '../../lib/jobs/lienDesk'
import type { LienDeskData } from '../../hooks/useLienDeskData'

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

const TODAY = '2026-09-14'

function row(job_id: string, work_month: string, deadline: string, extra: Partial<LienNoticeMonthRow> = {}): LienNoticeMonthRow {
  return { job_id, work_month, deadline, approved_hours: 82.6, noticed: false, open_balance: 33_500, customer_id: 'ati', gc_customer_id: 'loberg', property_kind: '', has_owner: false, desk_item_id: null, desk_status: null, desk_months: null, ...extra }
}

function data(rows: LienNoticeMonthRow[], items: LienDeskItemRow[] = [], hasOwnerAddress = false): LienDeskData {
  const queue = buildLienDeskQueue(rows, items, { loberg: 'ask' }, TODAY)
  return {
    queue,
    summary: summarizeLienDeskForNeedsYou(queue),
    rows,
    items,
    jobsById: {
      j650: { id: 'j650', hcp_number: '650', click_number: null, job_name: 'ATI Schertz', job_address: '1204 Elbel Rd, Schertz, TX', customer_id: 'ati', customer_name: 'ATI Schertz', gc_customer_id: 'loberg', customer_address_id: hasOwnerAddress ? 'addr1' : null, revenue: 33_500, payments_made: 0, master_user_id: null },
    },
    gcsById: { loberg: { id: 'loberg', name: 'Loberg Contracting', address: '2904 Corporate Cr, Flower Mound, TX', email: 'office@loberg.test', policy: 'ask', policyNote: '' } },
    addressesById: hasOwnerAddress
      ? ({ addr1: { id: 'addr1', county: 'Guadalupe', legal_description: 'Lot 1', property_kind: 'non_residential', homestead: false, owner_mode: 'building_owner', owner_name: '', owner_company: 'Elbel Holdings LLC', owner_mailing_address: '4 Example Way, Schertz, TX' } } as unknown as LienDeskData['addressesById'])
      : {},
    ownerByJob: {},
    promisesByJob: {},
    gcsWithPriorNotice: new Set(),
    gcsHeldBefore: new Set(),
  }
}

const J650 = [row('j650', '2026-06', '2026-09-15'), row('j650', '2026-07', '2026-10-15'), row('j650', '2026-08', '2026-11-16')]

const baseProps = {
  open: true,
  onClose: () => {},
  loading: false,
  todayYmd: TODAY,
  authUserId: 'u-taunya',
  authName: 'Taunya',
  workMonths: null,
  issuer: null,
  signerNameFor: () => 'Robert Douglas, Master Plumber',
  onChanged: () => {},
  onOpenEditJob: () => {},
  onOpenLienInstruments: () => {},
}

describe('LienDeskModal', () => {
  it('lists the job under Needs the owner, blocks the send, and offers the Find the owner door', () => {
    const onOpenEditJob = vi.fn()
    renderWithProviders(<LienDeskModal {...baseProps} authRole="assistant" data={data(J650)} onOpenEditJob={onOpenEditJob} />)
    expect(screen.getByRole('dialog', { name: 'Lien desk' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Needs the owner/ }).textContent).toContain('1')
    expect(screen.getAllByText(/650 · ATI Schertz/).length).toBeGreaterThan(0)
    expect(screen.getByText(/Jun notice due tomorrow/)).toBeTruthy()
    // Readiness: owner missing → the door, and the send button is disabled with the reason.
    fireEvent.click(screen.getByRole('button', { name: 'Find the owner ›' }))
    expect(onOpenEditJob).toHaveBeenCalledWith('j650')
    expect(screen.getByText(/Blocked until the owner of record is on the property record/)).toBeTruthy()
    expect((screen.getByRole('button', { name: /Send for approval/ }) as HTMLButtonElement).disabled).toBe(true)
    // Months: all three open windows ticked by default; the document names them.
    const boxes = screen.getAllByRole('checkbox').filter((b) => (b as HTMLInputElement).checked)
    expect(boxes.length).toBeGreaterThanOrEqual(3)
    expect(screen.getByText(/Work months June, July and August 2026/)).toBeTruthy()
    expect(screen.getByText(/Notice of Claim for Unpaid Labor or Materials/)).toBeTruthy()
    expect(screen.getByText(/first notice we've sent this GC/)).toBeTruthy()
  })

  it('with the owner on file the office can send for approval or record the leader’s spoken word', () => {
    renderWithProviders(<LienDeskModal {...baseProps} authRole="assistant" data={data(J650.map((r) => ({ ...r, has_owner: true })), [], true)} />)
    expect(screen.getByRole('button', { name: /To draft/ }).textContent).toContain('1')
    expect(screen.getByText(/Owner of record with a mailing address — Elbel Holdings LLC/)).toBeTruthy()
    expect((screen.getByRole('button', { name: /Send for approval/ }) as HTMLButtonElement).disabled).toBe(false)
    expect(screen.getByText(/No standing rule for Loberg Contracting, so this goes to the leader/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /The leader said to send it/ }))
    expect(screen.getByLabelText('Who said it and when')).toBeTruthy()
    expect(screen.getByText('by phone')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Record it and send/ })).toBeTruthy()
  })

  it('the leader sees what he is deciding, the standing rule, and Approve & next / Hold on an awaiting item', () => {
    const awaiting = {
      id: 'it1', job_id: 'j650', kind: 'notice_53_056', months: ['2026-06', '2026-07', '2026-08'], status: 'awaiting_approval', fields: {}, cover_note: true, drafted_by: 'u-taunya', drafted_at: '2026-09-14T14:00:00Z', submitted_at: '2026-09-14T14:12:00Z', approved_by: null, approved_at: null, approval_mode: null, word_note: '', word_channel: '', held_by: null, held_at: null, hold_reason: '', hold_until: null, sent_filing_id: null, sent_at: null, pulled_back_by: null, pulled_back_at: null, created_at: '2026-09-14T14:00:00Z', updated_at: '2026-09-14T14:12:00Z', voided_at: null,
    } as LienDeskItemRow
    renderWithProviders(<LienDeskModal {...baseProps} authRole="master_technician" data={data(J650, [awaiting], true)} />)
    expect(screen.getByRole('button', { name: /Awaiting approval/ }).textContent).toContain('1')
    expect(screen.getByText("What you're deciding")).toBeTruthy()
    expect(screen.getByText(/Open with Loberg Contracting/)).toBeTruthy()
    expect(screen.getByText(/Jun 2026's lien right ends September 15, 2026/)).toBeTruthy()
    expect(screen.getByText(/Standing rule for Loberg Contracting/)).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'Send notices without asking' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Approve & next/ })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Hold — I'll call first/ }))
    expect(screen.getByText(/then asks again/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Hold' })).toBeTruthy()
  })

  it('the office sees an awaiting item as waiting on the leader, and nothing due reads calm', () => {
    renderWithProviders(<LienDeskModal {...baseProps} authRole="controller" data={data([])} />)
    expect(screen.getByText(/Nothing is due/)).toBeTruthy()
  })
})
