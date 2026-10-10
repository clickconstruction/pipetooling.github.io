// @vitest-environment jsdom
/**
 * GC mode, the real build, the schedule's PR 14c: "Trades say they will be late" on main's test state. Fair Oaks D, today
 * Fri Oct 2: Summit Roofing says its TPO membrane (Sep 21 to Oct 9) will finish Wed Oct 14. Take hands Why it moved the
 * notice's day, reason and words; Push back sends a sentence, and a refusal keeps the person's words; a notice pushed
 * back reads what we said and waits.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { GcLateNotices } from './GcLateNotices'
import type { PendingMove } from './GcScheduleMoves'
import { initialGcState } from '../../lib/gc/schedule/testState'
import type { LateNotice } from '../../lib/gc/schedule/types'
import type { GcProject } from '../../lib/gc/types'

afterEach(cleanup)

const s = initialGcState()
const fairOaks = s.projects.find((p) => p.id === 'fairoaksd')!
const NOTE = 'The membrane ships Oct 12. We finish two days after it lands.'
const NOTICE: LateNotice = {
  id: 'late-1',
  partnerId: 'summit',
  lineId: 'froof-1',
  on: '2026-10-02',
  by: 'Carla Nguyen',
  started: true,
  was: { start: '2026-09-21', finish: '2026-10-09' },
  to: { start: '2026-09-21', finish: '2026-10-14' },
  reason: 'materials',
  note: NOTE,
}
const withNotice = (notice: LateNotice = NOTICE): GcProject => ({ ...fairOaks, schedule: { ...fairOaks.schedule!, lateNotices: [notice] } })

describe('Trades say they will be late (PR 14c)', () => {
  it('says what the company said, and Take hands Why it moved the notice', () => {
    const onTake = vi.fn((_move: PendingMove) => undefined)
    render(<GcLateNotices state={s} project={withNotice()} onTake={onTake} onPushBack={vi.fn()} />)
    expect(screen.getByText('Trades say they will be late (1)')).toBeTruthy()
    expect(screen.getByText('1 to answer')).toBeTruthy()
    expect(screen.getByText(`“${NOTE}”`, { exact: false })).toBeTruthy()
    expect(screen.getByRole('link', { name: /^Call / }).getAttribute('href')).toMatch(/^tel:/)
    fireEvent.click(screen.getByRole('button', { name: 'Take Wed Oct 14' }))
    expect(onTake).toHaveBeenCalledWith({
      lineId: 'froof-1',
      start: '2026-09-21',
      finish: '2026-10-14',
      after: fairOaks.schedule!.activities.find((a) => a.lineId === 'froof-1')!.after,
      why: { reason: 'materials', note: `Summit Roofing told us Fri Oct 2: ${NOTE}` },
      lateNoticeId: 'late-1',
    })
  })

  it('pushes back only with a sentence, and sends it trimmed', async () => {
    const onPushBack = vi.fn((_id: string, _note: string) => Promise.resolve())
    render(<GcLateNotices state={s} project={withNotice()} onTake={vi.fn()} onPushBack={onPushBack} />)
    fireEvent.click(screen.getByRole('button', { name: 'Push back' }))
    expect(screen.getByText('It goes to Summit Roofing in its portal. TPO membrane keeps its finish, Fri Oct 9.')).toBeTruthy()
    const send = () => screen.getByRole('button', { name: 'Send it to Summit Roofing' }) as HTMLButtonElement
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'No.' } })
    expect(send().disabled).toBe(true)
    expect(screen.getByText('Say what you need, in a sentence.')).toBeTruthy()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '  We need the roof dry by Oct 9.  ' } })
    fireEvent.click(send())
    await waitFor(() => expect(onPushBack).toHaveBeenCalledWith('late-1', 'We need the roof dry by Oct 9.'))
    await waitFor(() => expect(screen.queryByRole('textbox')).toBeNull())
  })

  it('keeps the person’s words when the push back is refused', async () => {
    const onPushBack = vi.fn(() => Promise.reject(new Error('That notice was answered already. Reload the schedule to see it.')))
    render(<GcLateNotices state={s} project={withNotice()} onTake={vi.fn()} onPushBack={onPushBack} />)
    fireEvent.click(screen.getByRole('button', { name: 'Push back' }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'We need the roof dry by Oct 9.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send it to Summit Roofing' }))
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByText('That notice was answered already. Reload the schedule to see it.')).toBeTruthy()
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('We need the roof dry by Oct 9.')
  })

  it('reads a notice pushed back with what we said, and offers nothing to press', () => {
    render(<GcLateNotices state={s} project={withNotice({ ...NOTICE, pushedBack: { on: s.today, by: 'Robert Douglas', note: 'We need the roof dry by Oct 9.' } })} onTake={vi.fn()} onPushBack={vi.fn()} />)
    expect(screen.getByText('pushed back')).toBeTruthy()
    expect(screen.getByText('We asked them today to keep Fri Oct 9. No answer yet.')).toBeTruthy()
    expect(screen.queryByText('1 to answer')).toBeNull()
    expect(screen.queryByRole('button', { name: /^Take / })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Push back' })).toBeNull()
  })

  it('draws nothing when no trade said it will be late', () => {
    const { container } = render(<GcLateNotices state={s} project={fairOaks} onTake={vi.fn()} onPushBack={vi.fn()} />)
    expect(container.innerHTML).toBe('')
  })
})
