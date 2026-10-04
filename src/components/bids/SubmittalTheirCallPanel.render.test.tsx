// @vitest-environment jsdom
/**
 * Render smoke for the Their call step's body, moved out of `BidsSubmittalsTab.tsx` (2026-10-04):
 * the seam pinned. It draws what it is handed and reports each press; nothing is written here.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { SubmittalTheirCallPanel, type SubmittalTheirCallPanelProps } from './SubmittalTheirCallPanel'
import type { DecisionSummary } from '../../lib/submittals/reviewDecisions'
import type { ReviewerFile } from '../../lib/submittals/reviewerFiles'
import type { SubmittalTaskRow } from '../../lib/submittals/robotTasks'
import type { SubmittalRoomRow } from '../../lib/submittals/submittalRoom'
import type { RoomMessage } from '../../../supabase/functions/_shared/submittalRoomPayload'

const none: DecisionSummary = { decided: 0, approved: 0, revise: 0, rejected: 0, open: 3, noAnswer: 3, sentBack: 0, byName: [], entered: 0, enteredBy: [] }
const some: DecisionSummary = { ...none, decided: 2, approved: 1, rejected: 1, open: 1, noAnswer: 1, sentBack: 1, byName: ['Dana Whitfield'] }
const room = { id: 'room', bid_id: 'b', token: 'a'.repeat(48), status: 'open', shared_at: '2026-09-16T15:00:00Z', closed_at: null } as unknown as SubmittalRoomRow
const redline: ReviewerFile = { path: 'b/rev-2/reviewer/0-redlines.pdf', name: 'SUBMITTALS-REVISED.pdf', kind: 'redline', droppedAt: '2026-09-17T15:00:00Z', droppedBy: 'wendi', droppedByName: 'Wendi', personId: 'p1', personName: 'Dana Whitfield' }
const ask: RoomMessage = { id: 'm1', at: '2026-09-17T16:00:00Z', authorKind: 'reviewer', authorName: 'Dana Whitfield', body: 'Is WC-1 the ADA height?', kind: 'message', revNumber: 2, tags: ['WC-1'] }
const readTask = { id: 't1', bid_id: 'b', submittal_id: 'rev-2', kind: 'read_redlines', input: { reviewer_index: 0, path: redline.path }, result: { annotations: [{ page: 3, tag: 'WC-1', text: 'OK as noted', proposed: 'approved', confidence: 0.95 }, { page: 5, tag: 'L-2', text: 'see spec', proposed: 'revise', confidence: 0.4 }, { page: 6, tag: null, text: 'Who carries the carrier?', proposed: 'question', confidence: 0.9 }] }, status: 'ready', requested_at: '2026-09-17T15:05:00Z', claimed_at: null, finished_at: null, reviewed_at: null, summary: null } as unknown as SubmittalTaskRow

function mount(over: Partial<SubmittalTheirCallPanelProps> = {}) {
  const on = { onApproveAll: vi.fn(), onPickFile: vi.fn(), onAskRobot: vi.fn(), onOpenFile: vi.fn(), onRemoveFile: vi.fn(), onCancelTask: vi.fn(), onConfirmRedlines: vi.fn(), onToggleThread: vi.fn(), onReplyTo: vi.fn(), onReplyBody: vi.fn(), onSendReply: vi.fn() }
  renderWithProviders(
    <SubmittalTheirCallPanel decisions={none} decisionsText={() => 'text'} approvable={0} showDropFile={false} reviewerFiles={[]} tasks={[]} robotSeat={{ live: false, line: 'No robot seat exists.' }} room={null} messages={[]} threadOpen={false} replyTo={null} replyBody="" replying={false} busy={false} {...on} {...over} />,
  )
  return on
}

describe('SubmittalTheirCallPanel', () => {
  it('the decisions line, and one entry for the rows with no answer yet', () => {
    const on = mount({ decisions: some, approvable: 1 })
    expect(screen.getByTestId('decisions-line').textContent).toContain('1 still open')
    expect(screen.getByRole('button', { name: 'Copy their decisions as text' })).toBeTruthy()
    expect(screen.getByTestId('approve-all-open').textContent).toBe('They approved the other 1…')
    fireEvent.click(screen.getByTestId('approve-all-open'))
    expect(on.onApproveAll).toHaveBeenCalledTimes(1)
  })

  it('nothing decided: the whole-submittal entry; no offer when nothing is approvable', () => {
    mount({ approvable: 3 })
    expect(screen.queryByTestId('decisions-line')).toBeNull()
    expect(screen.getByTestId('approve-all-open').textContent).toBe('They approved all of it…')
  })

  it("a reviewer's file with what the robot read: each press reports its file, its task and whether the unsure ride along", () => {
    const on = mount({ showDropFile: true, reviewerFiles: [redline], tasks: [readTask] })
    fireEvent.click(screen.getByRole('button', { name: "Drop a reviewer's file" }))
    expect(on.onPickFile).toHaveBeenCalledTimes(1)
    const card = screen.getByTestId('reviewer-files')
    expect(card.textContent).toContain('SUBMITTALS-REVISED.pdf')
    expect(card.textContent).toContain("Dana Whitfield's redlined PDF · dropped Sep 17 by Wendi")
    const read = screen.getByTestId('robot-redlines')
    expect(read.textContent).toContain('WC-1 · Approved')
    expect(read.textContent).toContain('L-2 ?')
    expect(read.textContent).toContain('no tag · a question for the thread')
    fireEvent.click(screen.getByTestId('confirm-redlines'))
    expect(on.onConfirmRedlines).toHaveBeenLastCalledWith(readTask, false)
    fireEvent.click(within(read).getByRole('button', { name: 'Take the unsure ones too' }))
    expect(on.onConfirmRedlines).toHaveBeenLastCalledWith(readTask, true)
    fireEvent.click(within(card).getByRole('button', { name: 'Open the file' }))
    expect(on.onOpenFile).toHaveBeenCalledWith(redline)
    fireEvent.click(within(card).getByRole('button', { name: 'Remove this file' }))
    expect(on.onRemoveFile).toHaveBeenCalledWith(0)
  })

  it('the thread stays folded until it is opened', () => {
    const closed = mount({ room, messages: [ask] })
    expect(screen.queryByTestId('room-thread-entries')).toBeNull()
    fireEvent.click(within(screen.getByTestId('room-thread-panel')).getByRole('button', { name: /Thread/ }))
    expect(closed.onToggleThread).toHaveBeenCalledTimes(1)
  })

  it('an open thread with an answer under way', () => {
    const on = mount({ room, messages: [ask], threadOpen: true, replyTo: 'm1', replyBody: 'Yes, 17 in.' })
    expect(screen.getByTestId('room-thread-entries').textContent).toContain('Is WC-1 the ADA height?')
    fireEvent.click(screen.getByRole('button', { name: 'Reply' }))
    expect(on.onReplyTo).toHaveBeenLastCalledWith('m1')
    fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: 'Yes.' } })
    expect(on.onReplyBody).toHaveBeenCalledWith('Yes.')
    fireEvent.click(screen.getByRole('button', { name: 'Send the answer' }))
    expect(on.onSendReply).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(on.onReplyTo).toHaveBeenLastCalledWith(null)
  })
})
