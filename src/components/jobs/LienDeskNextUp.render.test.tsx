// @vitest-environment jsdom
/**
 * The Lien desk's Next up list (punch list #82, PR 2): the two groups, a row's tag, words, day
 * and button, a row with no move for this viewer, the empty line, and the cards on a phone.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import LienDeskNextUp, { lienNextUpDueWords } from './LienDeskNextUp'
import type { LienNextUpRow } from '../../lib/jobs/lienNextUp'

afterEach(cleanup)

const row = (over: Partial<LienNextUpRow>): LienNextUpRow => ({
  key: 'notice:j1', kind: 'notice', jobId: 'j1', gcId: 'gc1', title: '650 · ATI Schertz', sub: 'Notice to draft', dueOn: '2026-10-09', daysLeft: 4, severity: 'red', group: 'now', action: 'draft', button: 'Draft notice', target: { open: 'notices', jobId: 'j1', pile: 'to_draft' }, ...over,
})

describe('LienDeskNextUp', () => {
  it('draws Needs you now and Coming up, each row with its tag, words, day and one button', () => {
    const onAct = vi.fn()
    const rows = [
      row({}),
      row({ key: 'run:gc1', jobId: null, title: 'Loberg Contracting', sub: '2 notices approved · ready to send', action: 'send_run', button: 'Send the run', target: { open: 'run', gcId: 'gc1' } }),
      row({ key: 'affidavit:j2', kind: 'affidavit', jobId: 'j2', title: '977 · Springtown', sub: 'Affidavit approved · ready to file', dueOn: '2026-11-16', daysLeft: 42, severity: 'quiet', group: 'coming', action: 'file_affidavit', button: 'File the affidavit', target: { open: 'affidavits', jobId: 'j2' } }),
    ]
    render(<LienDeskNextUp rows={rows} loading={false} isMobile={false} onAct={onAct} />)
    const now = screen.getByRole('region', { name: 'Needs you now' })
    expect(now.textContent).toContain('Needs you now · 2')
    expect(screen.getByRole('region', { name: 'Coming up' }).textContent).toContain('Coming up · 1')
    const first = document.querySelector('[data-lien-next-up-row="notice:j1"]') as HTMLElement
    expect(first.textContent).toContain('Notice')
    expect(first.textContent).toContain('650 · ATI Schertz')
    expect(first.textContent).toContain('Oct 9 · 4 days left')
    fireEvent.click(within(first).getByRole('button', { name: 'Draft notice' }))
    expect(onAct).toHaveBeenCalledTimes(1)
    expect(onAct.mock.calls[0]![0].key).toBe('notice:j1')
    fireEvent.click(within(now).getByRole('button', { name: 'Send the run' }))
    expect(onAct.mock.calls[1]![0].target).toEqual({ open: 'run', gcId: 'gc1' })
  })

  it('a row with no move for this viewer still opens: the button reads Open, and a press on the row opens it too', () => {
    const onAct = vi.fn()
    render(<LienDeskNextUp rows={[row({ action: 'approve', button: null, sub: 'Waiting on the leader' })]} loading={false} isMobile={false} onAct={onAct} />)
    expect(screen.getByRole('button', { name: 'Open' })).toBeTruthy()
    fireEvent.click(document.querySelector('[data-lien-next-up-row="notice:j1"]') as HTMLElement)
    expect(onAct).toHaveBeenCalledTimes(1)
  })

  it('nothing to do reads calm and points at the Calendar; a phone draws cards with a full-width button', () => {
    const view = render(<LienDeskNextUp rows={[]} loading={false} isMobile={false} onAct={() => {}} />)
    expect((document.querySelector('[data-lien-next-up="empty"]') as HTMLElement).textContent).toContain('Nothing needs you right now.')
    view.unmount()
    render(<LienDeskNextUp rows={[row({})]} loading={false} isMobile onAct={() => {}} />)
    expect((screen.getByRole('button', { name: 'Draft notice' }) as HTMLButtonElement).style.width).toBe('100%')
  })

  it('the day reads late, today, or days left', () => {
    expect(lienNextUpDueWords({ dueOn: '2026-10-01', daysLeft: -4 })).toBe('Oct 1 · 4 days late')
    expect(lienNextUpDueWords({ dueOn: '2026-10-04', daysLeft: -1 })).toBe('Oct 4 · 1 day late')
    expect(lienNextUpDueWords({ dueOn: '2026-10-05', daysLeft: 0 })).toBe('Oct 5 · today')
    expect(lienNextUpDueWords({ dueOn: '2026-10-06', daysLeft: 1 })).toBe('Oct 6 · 1 day left')
    expect(lienNextUpDueWords({ dueOn: null, daysLeft: null })).toBe('')
  })
})
