// @vitest-environment jsdom
/**
 * Windows drawn inside another window's backdrop, outside its panel (v2.4352). A real click on
 * the inner backdrop runs its handler and then bubbles through React to the outer backdrop's
 * `onClick`, which closed the window behind too. Each window below now stops its backdrop click
 * before closing, so a click outside it closes it only. Each case renders the window inside a
 * stand-in for the window behind (`<div onClick>`); every one fails without its fix.
 *
 * Where each is drawn: Assign focus in Review Hours, Switch user in the user review, a report in
 * the customer summary, the job picker in Quick assign, the run in the Lien desk and Put a GC on
 * notice, the owner's call in the Lien desk, the portal visits and the work order in the sheet
 * story, the Apply Schedule % confirm in Hours align. The Legal desk's sheets and its Apply
 * discount window are tested in the real desk (`legal/LegalDeskModal.render.test.tsx`).
 * `scripts/check-nested-windows.mjs` finds new ones.
 *
 * The same click reached rows that open on a click (v2.4356): outside the GC notes it also
 * opened or shut the Bid Board row, and outside Cost this task it toggled the Checklist row's
 * activity. Those windows are here too, with Mark account opened, which rows and other windows
 * draw; the stand-in plays the row. `check-nested-windows.mjs --rows` finds new ones.
 *
 * The Pipeline (v2.4359): the Stripe "Email this invoice?" confirm sits in a job row and is drawn
 * on <body>, so a click in it found no button above it there and the row opened or shut the
 * job's thread; the stand-in uses the row's own rule. A card (Mobile cards) draws its open thread
 * inside itself, so a tap in the thread, inline or full screen, folded the card; the real card is
 * here.
 */
import type { ReactElement } from 'react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { installDomShims, renderWithProviders, settle } from '../test/renderSmokeMocks'
import { AssignFocusModal } from './AssignFocusModal'
import { UserReviewSwitchUserModal } from './userReview/UserReviewSwitchUserModal'
import ReportViewModal from './ReportViewModal'
import { ScheduleDispatchAssignJobPickerModal } from './schedule/ScheduleDispatchAssignJobPickerModal'
import LienDeskRunModal from './jobs/LienDeskRunModal'
import LienOwnerCallDialog from './jobs/LienOwnerCallDialog'
import { SubPortalVisitsModal } from './people/SubPortalVisitsModal'
import { WorkOrderAssemblerModal } from './jobs/WorkOrderAssemblerModal'
import { ApplyScheduleApprovedConfirmModal } from './clock-sessions/ApplyScheduleApprovedConfirmModal'
import { BidGcNotesPopover } from './bids/BidGcNotesPopover'
import ChecklistCostModal from './checklist/ChecklistCostModal'
import { MarkJobAccountOpenedModal } from './materials/MarkJobAccountOpenedModal'
import { StripeInvoiceSendFromStripeButton } from './jobs/StripeInvoiceSendFromStripeButton'
import { shouldSuppressStagesRowJobThreadToggle } from './jobs/jobsStagesRowShared'
import JobsStagesCardList from './jobs/JobsStagesCardList'
import { makeJob } from '../test/renderSmokeMocks'
import { makeStagesCardListProps } from '../test/stagesCardListProps'
import { practiceCallFacts } from '../lib/jobs/lienCallerMatch'

vi.mock('../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../test/renderSmokeMocks')
  return useAuthModuleMock()
})
vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../lib/subPortal/resolveSubPortalUrl', () => ({ resolveSubPortalUrl: vi.fn(async () => null) }))

beforeAll(() => {
  installDomShims()
  // The report's scroll lock restores the page offset on unmount; jsdom's scrollTo only shouts.
  vi.stubGlobal('scrollTo', vi.fn())
})

/** The panel carries role="dialog"; the backdrop is its parent. */
const backdropOfDialog = (name?: string) => () => screen.getByRole('dialog', name ? { name } : {}).parentElement as HTMLElement

const CASES: { name: string; render: (onClose: () => void) => ReactElement; backdrop: () => HTMLElement }[] = [
  {
    name: 'Assign focus (Review Hours)',
    render: (onClose) => <AssignFocusModal sessionIds={['s1']} label="Rough-in (1.0h)" onSaved={() => {}} onClose={onClose} />,
    backdrop: backdropOfDialog(),
  },
  {
    name: 'Switch user (user review)',
    render: (onClose) => <UserReviewSwitchUserModal open onClose={onClose} currentDisplayName="Taunya" options={[]} loading={false} error={null} onPick={() => {}} />,
    backdrop: backdropOfDialog(),
  },
  {
    name: 'A report (customer summary)',
    render: (onClose) => (
      <ReportViewModal open onClose={onClose} report={{ id: 'r-1', template_name: 'Daily Report', job_display_name: 'HCP-12 Kitchen rough-in', created_at: '2026-07-24T15:00:00Z', created_by_name: 'Tech One', field_values: { notes: 'Set the closet flange.' } }} />
    ),
    backdrop: backdropOfDialog(),
  },
  {
    name: 'The job picker (Quick assign)',
    render: (onClose) => <ScheduleDispatchAssignJobPickerModal open onClose={onClose} subtitle="Pick a job" jobRows={[]} searchValue="" onSearchChange={() => {}} onPickJob={() => {}} />,
    backdrop: backdropOfDialog(),
  },
  {
    name: 'Send the run (Lien desk, Put a GC on notice)',
    render: (onClose) => <LienDeskRunModal notices={[]} issuer={null} todayYmd="2026-10-01" userId="u1" onClose={onClose} onRecorded={() => {}} />,
    // The run's backdrop is the dialog itself.
    backdrop: () => screen.getByRole('dialog', { name: 'Send the run' }),
  },
  {
    name: 'The owner called (Lien desk)',
    render: (onClose) => (
      <LienOwnerCallDialog practice facts={practiceCallFacts({ us: 'Click Plumbing and Electrical', todayYmd: '2026-10-01', signer: 'Malachi Whites', phone: '' })} existing={null} takerName="Taunya" busy={false} onClose={onClose} onSave={() => {}} />
    ),
    backdrop: backdropOfDialog(),
  },
  {
    name: 'Portal visits (sheet story)',
    render: (onClose) => <SubPortalVisitsModal personId="p1" personName="Ana" onClose={onClose} />,
    backdrop: backdropOfDialog(),
  },
  {
    name: 'A work order (sheet story)',
    render: (onClose) => <WorkOrderAssemblerModal open onClose={onClose} jobs={[]} initial={null} authUserId="u1" />,
    backdrop: backdropOfDialog(),
  },
  {
    name: 'Apply Schedule % confirm (Hours align)',
    render: (onClose) => <ApplyScheduleApprovedConfirmModal open busy={false} onCancel={onClose} onConfirm={() => {}} />,
    backdrop: backdropOfDialog(),
  },
  {
    name: 'GC notes (Bid Board row)',
    render: (onClose) => <BidGcNotesPopover bidId="b-385" bidLabel="Galloway Park" gcId={null} gcName="HCS, Inc." sentOn="9/22" outcome={null} onClose={onClose} onChanged={() => {}} />,
    backdrop: backdropOfDialog(),
  },
  {
    name: 'Cost this task (Checklist row)',
    render: (onClose) => <ChecklistCostModal open costKey="item-1" taskTitle="Clear back half of floor" onClose={onClose} />,
    backdrop: backdropOfDialog(),
  },
  {
    name: 'Mark account opened (a job account chip)',
    render: (onClose) => (
      <MarkJobAccountOpenedModal jobId="j-258" jobLabel="258 · Dudley Mason" house={{ id: 'h-1', name: 'Ferguson' }} existing={null} reps={[]} onClose={onClose} onSaved={() => {}} />
    ),
    backdrop: backdropOfDialog(),
  },
]

describe('a window drawn inside another window or a row', () => {
  it.each(CASES)('$name: a click outside closes it only, not what is behind it', async ({ render, backdrop }) => {
    const onClose = vi.fn()
    const windowBehind = vi.fn()
    renderWithProviders(<div onClick={windowBehind}>{render(onClose)}</div>)
    await settle()
    fireEvent.click(backdrop())
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(windowBehind).not.toHaveBeenCalled()
  })
})

describe('the Stripe "Email this invoice?" confirm in a Pipeline row', () => {
  /** Opens the confirm from a row that toggles the way the Pipeline row does; returns the row's toggle. */
  async function openConfirm() {
    const rowToggles = vi.fn()
    renderWithProviders(
      <div onClick={(e) => (shouldSuppressStagesRowJobThreadToggle(e.target) ? undefined : rowToggles())}>
        <StripeInvoiceSendFromStripeButton jobsLedgerInvoiceId="inv-1" stripeInvoiceId="in_1" customerEmail="ap@example.com" stripeModeForBilling="live" compact micro unboxed hideInlineSuccessLine buttonLabel="Resend" />
      </div>,
    )
    await settle()
    fireEvent.click(screen.getByRole('button', { name: /Resend/ }))
    await settle()
    return rowToggles
  }
  const confirm = () => screen.queryByRole('dialog', { name: 'Email this invoice?' })

  it('a click on its words leaves it open and the row alone', async () => {
    const rowToggles = await openConfirm()
    fireEvent.click(screen.getByText('Most recent sends (ClickTooling)'))
    expect(confirm()).toBeTruthy()
    expect(rowToggles).not.toHaveBeenCalled()
  })

  it('a click outside closes it only, not the row', async () => {
    const rowToggles = await openConfirm()
    fireEvent.click(confirm()?.parentElement as HTMLElement)
    expect(confirm()).toBeNull()
    expect(rowToggles).not.toHaveBeenCalled()
  })
})

describe('the open thread on a Pipeline card (Mobile cards)', () => {
  /** A card with its thread open; returns the card's toggle. */
  async function openCard(fullscreen: boolean) {
    const toggle = vi.fn()
    const job = makeJob({ job_name: 'Ellison kitchen' })
    renderWithProviders(
      <JobsStagesCardList {...makeStagesCardListProps({ jobList: [job], expandedJobThreadId: job.id, jobThreadFullscreen: fullscreen, toggleStagesJobThreadExpanded: toggle })} />,
    )
    await settle()
    return toggle
  }

  it('a tap on the card above the thread still folds it', async () => {
    const toggle = await openCard(false)
    fireEvent.click(screen.getByText('Ellison kitchen'))
    expect(toggle).toHaveBeenCalledTimes(1)
  })

  it('a tap in the thread leaves the card open', async () => {
    const toggle = await openCard(false)
    fireEvent.click(screen.getByText('Job activity / notes'))
    expect(toggle).not.toHaveBeenCalled()
  })

  it('a tap in the full-screen thread leaves it open', async () => {
    const toggle = await openCard(true)
    fireEvent.click(screen.getByText('esc to close'))
    expect(toggle).not.toHaveBeenCalled()
  })
})
