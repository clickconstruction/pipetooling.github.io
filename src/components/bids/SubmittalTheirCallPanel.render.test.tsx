// @vitest-environment jsdom
/**
 * Render smoke for the Their call step's body, moved out of `BidsSubmittalsTab.tsx` (2026-10-04):
 * the seam pinned. It draws what it is handed and reports each press; nothing is written here.
 * Redrawn 2026-10-05: a square a fixture, what came back in the reviewer's words, who is still
 * owed an answer, and a quiet foot.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { SubmittalTheirCallPanel, type SubmittalTheirCallPanelProps } from './SubmittalTheirCallPanel'
import type { DecisionSummary } from '../../lib/submittals/reviewDecisions'
import type { ReviewerFile } from '../../lib/submittals/reviewerFiles'
import type { SubmittalTaskRow } from '../../lib/submittals/robotTasks'
import type { SubmittalRoomRow } from '../../lib/submittals/submittalRoom'
import type { SubmittalItemRow } from '../../lib/submittals/submittalRevision'
import type { SubmittalPartRow } from '../../lib/submittals/itemParts'
import type { RoomMessage } from '../../../supabase/functions/_shared/submittalRoomPayload'

const none: DecisionSummary = { decided: 0, approved: 0, revise: 0, rejected: 0, open: 3, noAnswer: 3, sentBack: 0, byName: [], entered: 0, enteredBy: [] }
const room = { id: 'room', bid_id: 'b', token: 'a'.repeat(48), status: 'open', shared_at: '2026-09-16T15:00:00Z', closed_at: null } as unknown as SubmittalRoomRow
const redline: ReviewerFile = { path: 'b/rev-2/reviewer/0-redlines.pdf', name: 'SUBMITTALS-REVISED.pdf', kind: 'redline', droppedAt: '2026-09-17T15:00:00Z', droppedBy: 'wendi', droppedByName: 'Wendi', personId: 'p1', personName: 'Dana Whitfield' }
const ask: RoomMessage = { id: 'm1', at: '2026-09-17T16:00:00Z', authorKind: 'reviewer', authorName: 'Dana Whitfield', body: 'Is WC-1 the ADA height?', kind: 'message', revNumber: 2, tags: ['WC-1'] }
const readTask = { id: 't1', bid_id: 'b', submittal_id: 'rev-2', kind: 'read_redlines', input: { reviewer_index: 0, path: redline.path }, result: { annotations: [{ page: 3, tag: 'WC-1', text: 'OK as noted', proposed: 'approved', confidence: 0.95 }, { page: 5, tag: 'L-2', text: 'see spec', proposed: 'revise', confidence: 0.4 }, { page: 6, tag: null, text: 'Who carries the carrier?', proposed: 'question', confidence: 0.9 }] }, status: 'ready', requested_at: '2026-09-17T15:05:00Z', claimed_at: null, finished_at: null, reviewed_at: null, summary: null } as unknown as SubmittalTaskRow

const fx = (o: Partial<SubmittalItemRow> & { id: string; tag: string }): SubmittalItemRow => ({
  submittal_id: 's1', source_count_row_id: null, sequence_order: 1, specified_manufacturer: null, specified_model: null, specified_description: null,
  submitted_manufacturer: null, submitted_model: null, submitted_label: `${o.tag} product`, supply_house_id: null, source_quote_line_id: null, status: 'proposed',
  reason_kind: null, reason_note: null, lead_time_days: null, sheet_file: null, sheet_pages: [], sheet_source: null, carried_from_item_id: null,
  decision_source: 'room', decision_entered_by: null, decision_entered_by_name: null, order_only: false, review_decision: null, review_note: null, reviewed_by_name: null,
  reviewed_by_person_id: null, reviewed_by_email: null, reviewed_at: null, created_at: '', updated_at: '', ...o,
} as SubmittalItemRow)
const gcPart = (id: string, item: string, label: string, seq: number, review_decision: string | null = null, review_note: string | null = null): SubmittalPartRow => ({ id, item_id: item, label, sequence_order: seq, on_submittal: true, review_decision, review_note } as unknown as SubmittalPartRow)

// The SpaceX draft in small: a fixture with one part rejected, two waiting, one with no product.
const typed = { review_decision: 'rejected', reviewed_by_name: 'structura', reviewed_at: '2026-10-02T15:00:00Z', decision_source: 'entered', decision_entered_by_name: 'Wendi' } as const
const lav = fx({ id: 'lav', tag: 'LAV-1', ...typed })
const dwh = fx({ id: 'dwh', tag: 'DWH-1', sequence_order: 2 })
const fco = fx({ id: 'fco', tag: 'FCO', sequence_order: 3 })
const sink = fx({ id: 'sink', tag: 'UTILITY SINK', sequence_order: 4, status: 'missing', submitted_label: null })
const bp = [lav, dwh, fco, sink]
const bpParts = new Map([['lav', [gcPart('tsl', 'lav', 'TSL.MON.B.38.2.PS1.BK MONOLITH', 1), gcPart('faucet', 'lav', 'TOTO T25S51E#CP', 2, 'rejected', 'TEL145')]]])
const sentBack: DecisionSummary = { ...none, decided: 1, rejected: 1, open: 2, noAnswer: 3, sentBack: 1, byName: ['structura'], entered: 1, enteredBy: ['Wendi'] }

function mount(over: Partial<SubmittalTheirCallPanelProps> = {}) {
  const on = { onEdit: vi.fn(), onAnswer: vi.fn(), onApproveAll: vi.fn(), onPickFile: vi.fn(), onAskRobot: vi.fn(), onOpenFile: vi.fn(), onRemoveFile: vi.fn(), onCancelTask: vi.fn(), onConfirmRedlines: vi.fn(), onToggleThread: vi.fn(), onReplyTo: vi.fn(), onReplyBody: vi.fn(), onSendReply: vi.fn() }
  renderWithProviders(
    <SubmittalTheirCallPanel items={[]} partsOf={new Map()} canEdit isNewest nextRev={2} decisions={none} decisionsText={() => 'text'} approvable={0} showDropFile={false} reviewerFiles={[]} tasks={[]} robotSeat={{ live: false, line: 'No robot seat exists.' }} room={null} messages={[]} threadOpen={false} replyTo={null} replyBody="" replying={false} busy={false} {...on} {...over} />,
  )
  return on
}

describe('SubmittalTheirCallPanel', () => {
  describe('where it stands, without being asked', () => {
    it('one square a fixture, the counts under them, and who answered', () => {
      mount({ items: bp, partsOf: bpParts, decisions: sentBack, approvable: 2 })
      expect([...screen.getByTestId('their-call-cells').children].map((c) => `${c.getAttribute('title')}`)).toEqual(['LAV-1 · sent back', 'DWH-1 · waiting', 'FCO · waiting', 'UTILITY SINK · no product yet'])
      expect(screen.getByTestId('their-call-cells').getAttribute('aria-label')).toBe('0 approved, 1 sent back, 2 waiting, 1 with no product yet')
      expect(screen.getByTestId('decisions-line').textContent).toBe('0approved1sent back2waiting1no product yet')
      expect(screen.getByTestId('their-call-who').textContent).toBe('structura answered. Wendi typed the answers in on Oct 2.')
    })

    it('what came back: the fixture, the part, the reviewer’s words, and the door to change it', () => {
      const on = mount({ items: bp, partsOf: bpParts, decisions: sentBack, approvable: 2 })
      const list = screen.getByTestId('their-call-sent-back')
      expect(list.textContent).toContain('Sent back · 1 fixture, 1 part')
      expect(screen.getAllByTestId('sent-back-part').map((p) => p.textContent)).toEqual(['TOTO T25S51E#CPRejectedthey wrote “TEL145”'])
      expect(screen.getByTestId('sent-back-next').textContent).toBe('When they are changed, start a Rev 2 draft in step 7.')
      fireEvent.click(within(list).getByRole('button', { name: 'Edit LAV-1 to change what was sent back' }))
      expect(on.onEdit).toHaveBeenCalledWith(lav)
    })

    it('on a shared version the parts are locked: no Edit, and the line says where to change them', () => {
      mount({ items: bp, partsOf: bpParts, decisions: sentBack, canEdit: false, nextRev: 3 })
      expect(within(screen.getByTestId('their-call-sent-back')).queryByRole('button')).toBeNull()
      expect(screen.getByTestId('sent-back-next').textContent).toBe('These parts are locked on a shared version. Start a Rev 3 draft in step 7 to change them.')
    })

    it('who is still owed an answer: each fixture is a button that opens Their answer, and one entry marks them all', () => {
      const on = mount({ items: bp, partsOf: bpParts, decisions: sentBack, approvable: 2 })
      const waiting = screen.getByTestId('their-call-waiting')
      expect(waiting.textContent).toContain('Waiting on structura · 2 fixtures')
      expect(waiting.textContent).toContain('Got an answer by email? Press the fixture and type it in.')
      expect(screen.getAllByTestId('waiting-fixture').map((b) => b.textContent)).toEqual(['DWH-1', 'FCO'])
      fireEvent.click(screen.getByRole('button', { name: 'Type in their answer on FCO' }))
      expect(on.onAnswer).toHaveBeenCalledWith(fco)
      expect(screen.getByTestId('approve-all-open').textContent).toBe('Mark all 2 approved…')
      fireEvent.click(screen.getByTestId('approve-all-open'))
      expect(on.onApproveAll).toHaveBeenCalledTimes(1)
    })

    it('a fixture with no product is set apart, with the door to add one', () => {
      const on = mount({ items: bp, partsOf: bpParts, decisions: sentBack })
      expect(screen.getByTestId('their-call-no-product').textContent).toBe('UTILITY SINK has no product yet, so there is nothing for them to answer. Add the product')
      fireEvent.click(screen.getByRole('button', { name: 'Add the product' }))
      expect(on.onEdit).toHaveBeenCalledWith(sink)
    })

    it('nothing answered yet: every fixture waits, the line says how it was shared, and the reviewer has no name', () => {
      mount({ items: [dwh, fco], approvable: 2, sharedLine: 'Room link · shared Sep 16 · opened 2×' })
      expect(screen.getByTestId('their-call-who').textContent).toBe('Room link · shared Sep 16 · opened 2× · No answers yet.')
      expect(screen.getByTestId('their-call-waiting').textContent).toContain('Waiting on the reviewer · 2 fixtures')
      expect(screen.queryByTestId('their-call-sent-back')).toBeNull()
      expect(screen.getByTestId('approve-all-open').parentElement!.textContent).toContain('when they approved the whole submittal in one go')
    })

    it('everything approved: one line says so and points on; nothing waits', () => {
      const ok = { review_decision: 'approved', reviewed_by_name: 'structura', reviewed_at: '2026-10-09T15:00:00Z' } as const
      mount({ items: [fx({ id: 'a', tag: 'DWH-1', ...ok }), fx({ id: 'b', tag: 'FCO', ...ok })], decisions: { ...none, decided: 2, approved: 2, open: 0, noAnswer: 0, byName: ['structura'] } })
      expect(screen.getByTestId('their-call-who').textContent).toBe('All 2 approved by structura on Oct 9. Nothing is left to do here. Order them in step 8.')
      expect(screen.queryByTestId('their-call-waiting')).toBeNull()
      expect(screen.queryByTestId('approve-all-open')).toBeNull()
    })

    it('a long list of waiting fixtures folds after fourteen and opens on a press', () => {
      const many = Array.from({ length: 20 }, (_, i) => fx({ id: `w${i}`, tag: `F-${i + 1}`, sequence_order: i + 1 }))
      mount({ items: many, approvable: 20 })
      expect(screen.getAllByTestId('waiting-fixture')).toHaveLength(14)
      fireEvent.click(screen.getByRole('button', { name: 'and 6 more' }))
      expect(screen.getAllByTestId('waiting-fixture')).toHaveLength(20)
    })
  })

  it('the quiet foot: the reviewer’s file, the answers as text, the messages and history', () => {
    const on = mount({ items: bp, partsOf: bpParts, decisions: sentBack, showDropFile: true, room, messages: [ask] })
    const foot = screen.getByTestId('their-call-foot')
    expect(within(foot).getAllByRole('button').map((b) => b.textContent!.replace(/ · .*/, ''))).toEqual(['Messages and history', "Drop a reviewer's file", 'Copy their decisions as text'])
    fireEvent.click(within(foot).getByRole('button', { name: "Drop a reviewer's file" }))
    expect(on.onPickFile).toHaveBeenCalledTimes(1)
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

  it('the messages stay folded until they are opened', () => {
    const closed = mount({ room, messages: [ask] })
    expect(screen.queryByTestId('room-thread-panel')).toBeNull()
    const toggle = screen.getByTestId('thread-toggle')
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(toggle.textContent).toMatch(/^Messages and history · /)
    fireEvent.click(toggle)
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
