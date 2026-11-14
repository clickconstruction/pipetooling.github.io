// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import LienDeskJobScreen from './LienDeskJobScreen'
import type { LienNextUpRow } from '../../lib/jobs/lienNextUp'
import { lienStepCard } from '../../lib/jobs/lienNextUpSteps'
import { lienJobScreen } from '../../lib/jobs/lienPhoneJobScreen'

afterEach(cleanup)

const row = (over: Partial<LienNextUpRow> = {}): LienNextUpRow => ({
  key: 'aff:j1', kind: 'affidavit', jobId: 'j1', gcId: null, title: '412 · Oak Hollow remodel', sub: 'Ready to file', dueOn: '2026-11-16', daysLeft: 3, severity: 'red', group: 'now',
  action: 'file_affidavit', button: 'File the affidavit', target: { open: 'affidavits', jobId: 'j1' }, ...over,
})

function draw(r: LienNextUpRow, opts: { amount?: number | null; gaps?: number | null } = {}) {
  const card = lienStepCard(r, {})
  const s = lienJobScreen(r, card, { amount: opts.amount ?? null, gaps: opts.gaps ?? null, can: { paper: true, lienWindow: true, job: true } })
  const on = { close: vi.fn(), act: vi.fn(), secondary: vi.fn(), door: vi.fn(), job: vi.fn() }
  render(<LienDeskJobScreen row={r} screen={s} card={card} onClose={on.close} onAct={on.act} onSecondary={r.secondary ? on.secondary : undefined} onDoor={on.door} onOpenJob={on.job} />)
  return on
}

describe('LienDeskJobScreen (punch list #352, PR 4)', () => {
  it('is the job alone: its name and what it owes, when the paper is due, the four steps written out, the doors, and the row’s press at the foot', () => {
    const on = draw(row(), { amount: 8400, gaps: 2 })
    const dialog = screen.getByRole('dialog', { name: '412 · Oak Hollow remodel: where its lien paper stands' })
    expect(dialog.getAttribute('data-lien-job-screen')).toBe('aff:j1')
    expect(dialog.querySelector('[data-lien-job-screen-title]')!.textContent).toBe('412 · Oak Hollow remodel')
    expect(dialog.querySelector('[data-lien-job-screen-owes]')!.textContent).toContain('$8,400 open')
    const due = dialog.querySelector('[data-lien-job-screen-due]')!
    expect(due.getAttribute('data-tone')).toBe('red')
    expect(due.textContent).toContain('File by Nov 16 · 3 days left')
    expect(due.textContent).toContain('Ready to file')
    // The step card's own four steps, in the size a thumb reads.
    const items = screen.getAllByTestId('lien-step-card-item')
    expect(items).toHaveLength(4)
    expect(items.map((i) => i.getAttribute('data-state'))).toEqual(['done', 'done', 'done', 'now'])
    expect(items[0]!.closest('ol')!.getAttribute('data-roomy')).toBe('yes')
    expect(dialog.querySelector('[data-lien-job-screen-foot-words]')!.textContent).toBe('Step 4 of 4 · 3 done · 1 to go')
    // Three doors, each a thumb tall; the paper's says what is missing.
    const doors = [...dialog.querySelectorAll<HTMLElement>('[data-lien-job-screen-door]')]
    expect(doors.map((d) => d.getAttribute('data-lien-job-screen-door'))).toEqual(['paper', 'lien_window', 'job'])
    expect(doors[0]!.textContent).toContain('Open the affidavit as it stands')
    expect(doors[0]!.textContent).toContain('2 details missing')
    expect(doors.every((d) => d.style.minHeight === '56px')).toBe(true)
    fireEvent.click(doors[1]!)
    expect(on.door).toHaveBeenCalledWith('lien_window')
    // One press, pinned, with the desk's own words.
    const press = dialog.querySelector<HTMLElement>('[data-lien-job-screen-act]')!
    expect(press.textContent).toBe('File the affidavit')
    expect(press.style.minHeight).toBe('48px')
    expect(press.closest('[data-lien-job-screen-foot]')).not.toBeNull()
    expect(dialog.querySelector('[data-lien-job-screen-body]')!.contains(press)).toBe(false)
    fireEvent.click(press)
    expect(on.act).toHaveBeenCalledTimes(1)
    expect(dialog.querySelector('[data-lien-job-screen-secondary]')).toBeNull()
  })

  it('the way back is a thumb wide, takes the focus, and Escape is the same press', () => {
    const on = draw(row())
    const back = screen.getByRole('button', { name: 'Back to the list' })
    expect(back.style.width).toBe('44px')
    expect(back.style.height).toBe('44px')
    expect(document.activeElement).toBe(back)
    fireEvent.click(back)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(on.close).toHaveBeenCalledTimes(2)
  })

  it('a row this viewer has no move on reads Open; a step-one row says what blocks it', () => {
    draw(row({ kind: 'notice', action: 'find_owner', button: null, sub: 'Needs the owner of record', target: { open: 'notices', jobId: 'j1', pile: 'needs_owner' } }))
    expect(document.querySelector('[data-lien-job-screen-act]')!.textContent).toBe('Open')
    expect(screen.getByTestId('lien-step-card-blocked').textContent).toContain('the owner of record')
    expect(document.querySelector('[data-lien-job-screen-owes]')).toBeNull()
  })

  it('a run row lists its jobs as doors to each job and keeps its second press', () => {
    const run = row({ key: 'run:printed', jobId: null, kind: 'notice', title: '2 notices printed Nov 9', sub: 'Mailed? Type each number.', action: 'record_mailing', button: 'Record the mailing', target: { open: 'run', gcId: null }, secondary: { words: 'Take back…', target: { open: 'run', gcId: null, takeBack: true } }, jobs: [{ jobId: 'a', title: '455 · Service visit', dueOn: '2026-11-15' }, { jobId: 'b', title: '461 · Calder duplex', dueOn: null }] })
    const on = draw(run)
    expect(document.querySelectorAll('[data-lien-job-screen-door]')).toHaveLength(0)
    const jobs = [...document.querySelectorAll<HTMLElement>('[data-lien-job-screen-job]')]
    expect(jobs.map((j) => j.textContent)).toEqual(['455 · Service visitNov 15', '461 · Calder duplex'])
    fireEvent.click(jobs[1]!)
    expect(on.job).toHaveBeenCalledWith('b')
    fireEvent.click(document.querySelector('[data-lien-job-screen-secondary]')!)
    expect(on.secondary).toHaveBeenCalledTimes(1)
    expect(document.querySelector('[data-lien-job-screen-act]')!.textContent).toBe('Record the mailing')
  })
})
