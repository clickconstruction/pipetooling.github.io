// @vitest-environment jsdom
/**
 * Standing… on the HR file (punch list #315, upgrade 4b): what the person is now, the stretches on file newest first,
 * and the four presses that write through the standing's one door. Made-up stretches.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { PersonStandingWindow } from './PersonStandingWindow'
import { writePersonEngagement } from '../../../lib/people/personEngagementsIo'
import type { PersonEngagementRow } from '../../../lib/people/personEngagements'

vi.mock('../../../lib/people/personEngagementsIo', () => ({ writePersonEngagement: vi.fn(async () => ({ ok: true })) }))

const row = (id: string, kind: string, from: string, to: string | null, over: Partial<PersonEngagementRow> = {}): PersonEngagementRow => ({ id, kind, started_on: from, ended_on: to, source: 'contract', source_ref: '', note: '', withdrawn_at: null, ...over })
const ROWS: PersonEngagementRow[] = [row('g1', 'subcontractor', '2026-02-01', '2026-05-31', { source_ref: 'the February agreement' }), row('g2', 'employee', '2026-06-01', null, { source: 'payroll' })]

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function show(over: Partial<Parameters<typeof PersonStandingWindow>[0]> = {}) {
  const onChanged = vi.fn()
  const onClose = vi.fn()
  const showToast = vi.fn()
  render(<PersonStandingWindow personId="p1" personName="Pat Doe" rows={ROWS} heldWhy={null} todayYmd="2026-11-19" canWrite onClose={onClose} onChanged={onChanged} showToast={showToast} {...over} />)
  return { onChanged, onClose, showToast }
}
const lastPayload = () => {
  const calls = vi.mocked(writePersonEngagement).mock.calls
  return calls[calls.length - 1]?.[0]
}

describe('PersonStandingWindow (punch list #315, upgrade 4b)', () => {
  it('says what the person is now and lists the stretches, the newest first, with where each fact comes from', () => {
    show()
    expect(screen.getByTestId('person-standing-now').textContent).toBe('Employee · since Jun 1, 2026 · still engaged')
    const items = within(screen.getByRole('dialog', { name: 'Standing' })).getAllByRole('listitem')
    expect(items[0]?.textContent).toContain('Employee since Jun 1, 2026, by how they were paid')
    expect(items[1]?.textContent).toContain('Subcontractor from Feb 1, 2026 to May 31, 2026, by a signed paper')
    expect(items[1]?.textContent).toContain('the February agreement')
  })

  it('changes the standing from a day: the other kind is offered, and the door takes one change', async () => {
    const { onChanged } = show()
    fireEvent.click(screen.getByRole('button', { name: 'Change to subcontractor…' }))
    fireEvent.change(screen.getByLabelText('From this day'), { target: { value: '2026-11-01' } })
    fireEvent.change(screen.getByLabelText('Where the fact comes from'), { target: { value: 'owner' } })
    fireEvent.click(screen.getByRole('button', { name: 'Change the standing' }))
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
    expect(lastPayload()).toEqual({ person_id: 'p1', change: { kind: 'subcontractor', on: '2026-11-01', source: 'owner' } })
  })

  it('ends the running stretch on a day, and refuses a day before it began in words', async () => {
    show()
    fireEvent.click(screen.getByRole('button', { name: 'End the stretch…' }))
    fireEvent.change(screen.getByLabelText('Last day'), { target: { value: '2026-05-01' } })
    fireEvent.click(screen.getByRole('button', { name: 'End the stretch' }))
    expect(screen.getByText('The last day is before the stretch’s first day.')).toBeTruthy()
    expect(writePersonEngagement).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Last day'), { target: { value: '2026-11-14' } })
    fireEvent.click(screen.getByRole('button', { name: 'End the stretch' }))
    await waitFor(() => expect(writePersonEngagement).toHaveBeenCalled())
    expect(lastPayload()).toEqual({ person_id: 'p1', close: { ended_on: '2026-11-14' } })
  })

  it('records a stretch on a file with none, and says an overlap in words before the door is asked', async () => {
    show({ rows: [] })
    expect(screen.queryByTestId('person-standing-now')).toBeNull()
    // Nothing on file: the empty line carries the one press.
    fireEvent.click(screen.getByRole('button', { name: 'Record a stretch…' }))
    fireEvent.click(screen.getByRole('button', { name: 'Record the stretch' }))
    expect(screen.getByText('Set the first day.')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('First day'), { target: { value: '2026-03-02' } })
    fireEvent.change(screen.getByLabelText('Which paper or record'), { target: { value: ' the March agreement ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Record the stretch' }))
    await waitFor(() => expect(writePersonEngagement).toHaveBeenCalled())
    expect(lastPayload()).toEqual({ person_id: 'p1', open: { kind: 'employee', started_on: '2026-03-02', source: 'contract', source_ref: 'the March agreement' } })
    cleanup()
    vi.clearAllMocks()
    show()
    fireEvent.click(screen.getByRole('button', { name: 'Record a stretch…' }))
    fireEvent.change(screen.getByLabelText('First day'), { target: { value: '2026-03-02' } })
    fireEvent.click(screen.getByRole('button', { name: 'Record the stretch' }))
    expect(screen.getByText(/These days overlap a stretch already on file/)).toBeTruthy()
    expect(writePersonEngagement).not.toHaveBeenCalled()
  })

  it('takes a stretch off only with a reason, and a refusal keeps the window open with its words', async () => {
    vi.mocked(writePersonEngagement).mockResolvedValueOnce({ ok: false, why: 'dev_engagement_write: that stretch was withdrawn already' })
    const { showToast, onChanged } = show()
    fireEvent.click(screen.getAllByRole('button', { name: 'Take it off…' })[1]!)
    const go = screen.getByRole('button', { name: 'Take the stretch off' }) as HTMLButtonElement
    expect(go.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Why it comes off'), { target: { value: 'Recorded on the wrong person.' } })
    fireEvent.click(go)
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Not written: dev_engagement_write: that stretch was withdrawn already', 'error'))
    expect(lastPayload()).toEqual({ person_id: 'p1', withdraw: { id: 'g1', why: 'Recorded on the wrong person.' } })
    expect(onChanged).not.toHaveBeenCalled()
  })

  it('a reader who may not write sees the stretches and no press but Close; a held read says why', () => {
    const { onClose } = show({ canWrite: false, heldWhy: 'permission denied for table person_engagements', rows: [] })
    expect(screen.getByText('The standing could not be read: permission denied for table person_engagements')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Record a stretch…' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalled()
  })
})
