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
  key: 'notice:j1', kind: 'notice', jobId: 'j1', gcId: 'gc1', title: '650 · AXO Schertz', sub: 'Notice to draft', dueOn: '2026-10-09', daysLeft: 4, severity: 'red', group: 'now', action: 'draft', button: 'Draft notice', target: { open: 'notices', jobId: 'j1', pile: 'to_draft' }, ...over,
})

describe('LienDeskNextUp', () => {
  it('draws Needs you now and Coming up, each row with its tag, words, day and one button', () => {
    const onAct = vi.fn()
    const rows = [
      row({}),
      row({ key: 'run:gc1', jobId: null, title: 'Lowbeck Contracting', sub: '2 notices approved · ready to send', action: 'send_run', button: 'Send the run', target: { open: 'run', gcId: 'gc1' } }),
      row({ key: 'affidavit:j2', kind: 'affidavit', jobId: 'j2', title: '977 · Stonewick', sub: 'Affidavit approved · ready to file', dueOn: '2026-11-16', daysLeft: 42, severity: 'quiet', group: 'coming', action: 'file_affidavit', button: 'File the affidavit', target: { open: 'affidavits', jobId: 'j2' } }),
    ]
    render(<LienDeskNextUp rows={rows} loading={false} isMobile={false} onAct={onAct} />)
    const now = screen.getByRole('region', { name: 'Needs you now' })
    expect(now.textContent).toContain('Needs you now · 2')
    expect(screen.getByRole('region', { name: 'Coming up' }).textContent).toContain('Coming up · 1')
    const first = document.querySelector('[data-lien-next-up-row="notice:j1"]') as HTMLElement
    expect(first.textContent).toContain('Notice')
    expect(first.textContent).toContain('650 · AXO Schertz')
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

  it('nothing to do reads calm and points at the Calendar; a phone row’s press is as wide as its words and a thumb tall (punch list #352, PR 3)', () => {
    const view = render(<LienDeskNextUp rows={[]} loading={false} isMobile={false} onAct={() => {}} />)
    expect((document.querySelector('[data-lien-next-up="empty"]') as HTMLElement).textContent).toContain('Nothing needs you right now.')
    view.unmount()
    render(<LienDeskNextUp rows={[row({})]} loading={false} isMobile onAct={() => {}} />)
    const press = screen.getByRole('button', { name: 'Draft notice' }) as HTMLButtonElement
    expect(press.style.width).toBe('')
    expect(press.style.minHeight).toBe('40px')
  })

  it('the list is its own scroller unless the desk scrolls it with the month as one page (punch list #352, PR 0)', () => {
    const view = render(<LienDeskNextUp rows={[row({})]} loading={false} isMobile={false} onAct={() => {}} />)
    const list = () => document.querySelector('[data-lien-next-up="list"]') as HTMLElement
    expect(list().getAttribute('data-scrolls')).toBe('yes')
    expect(list().style.overflowY).toBe('auto')
    view.unmount()
    render(<LienDeskNextUp rows={[row({})]} loading={false} isMobile onAct={() => {}} scrolls={false} />)
    expect(list().getAttribute('data-scrolls')).toBe('no')
    expect(list().style.overflowY).toBe('visible')
  })

  it('a phone row wears the four dots; with no press for this viewer, the step’s name and whose it is stand beside them (punch list #352, PR 3; four named tiles from v2.4881 until then)', () => {
    render(<LienDeskNextUp rows={[row({ action: 'approve', button: 'Approve' })]} loading={false} isMobile onAct={() => {}} viewerIsLeader />)
    expect(screen.queryByTestId('lien-step-row')).toBeNull()
    expect(screen.getByTestId('lien-step-mark').getAttribute('aria-label')).toBe('Step 3 of 4: where this stands')
    // The dots alone: the fraction a computer draws beside them gives its room to the press.
    expect(screen.getByTestId('lien-step-mark').textContent).toBe('')
    // With a press of his own, the press names the step (*Approve*) and the words stay out of its way.
    expect(screen.getByRole('button', { name: 'Approve' })).toBeTruthy()
    expect(document.querySelector('[data-lien-next-up-step-words]')).toBeNull()
    cleanup()
    render(<LienDeskNextUp rows={[row({ action: 'approve', button: null })]} loading={false} isMobile onAct={() => {}} />)
    expect(document.querySelector('[data-lien-next-up-step-words]')!.textContent).toBe('Approve · leader')
    cleanup()
    render(<LienDeskNextUp rows={[row({ action: 'draft', button: 'Draft notice' })]} loading={false} isMobile={false} onAct={() => {}} />)
    expect(screen.queryByTestId('lien-step-row')).toBeNull()
    expect(screen.getByTestId('lien-step-mark')).toBeTruthy()
    // A computer's row has its own column for the state and no step words beside the dots.
    expect(document.querySelector('[data-lien-next-up-step-words]')).toBeNull()
  })

  it('a phone groups the rows by the day they are due, each head with how long is left and the money, and a row says what its job owes (punch list #352, PR 3)', () => {
    const rows = [
      row({ key: 'notice:a', jobId: 'a', title: '412 · Oak Hollow', dueOn: '2026-11-16', daysLeft: 3 }),
      row({ key: 'notice:b', jobId: 'b', title: '437 · Larkspur lot 9', dueOn: '2026-11-16', daysLeft: 3 }),
      row({ key: 'notice:c', jobId: 'c', title: '455 · Finch Ln', dueOn: '2026-12-15', daysLeft: 32, group: 'coming', severity: 'quiet' }),
    ]
    const owed: Record<string, number> = { a: 8400, b: 6125 }
    render(<LienDeskNextUp rows={rows} loading={false} isMobile onAct={() => {}} amountFor={(r) => (r.jobId ? owed[r.jobId] ?? null : null)} />)
    const heads = Array.from(document.querySelectorAll('[data-lien-phone-group] h3')).map((h) => h.textContent)
    expect(heads).toEqual(['Due Mon Nov 16 · 23 days$14,525', 'Due Tue Dec 15 · 132 days'])
    expect(Array.from(document.querySelectorAll('[data-lien-phone-group]')).map((el) => el.getAttribute('data-lien-phone-group'))).toEqual(['day:2026-11-16', 'day:2026-12-15'])
    const first = document.querySelector('[data-lien-next-up-row="notice:a"]') as HTMLElement
    expect(first.getAttribute('data-layout')).toBe('lines')
    expect(first.querySelector('[data-lien-next-up-amount]')!.textContent).toBe('$8,400')
    // The day is on the head, so the row does not say it again.
    expect(first.querySelector('[data-lien-next-up-sub]')!.textContent).not.toMatch(/Nov 16|days left/)
    // A job with nothing known draws no amount.
    expect(document.querySelector('[data-lien-next-up-row="notice:c"] [data-lien-next-up-amount]')).toBeNull()
    cleanup()
    // A computer keeps the desk's own groups and draws no money on the row.
    render(<LienDeskNextUp rows={rows} loading={false} isMobile={false} onAct={() => {}} amountFor={(r) => (r.jobId ? owed[r.jobId] ?? null : null)} />)
    expect(Array.from(document.querySelectorAll('[data-lien-next-up-group] h3')).map((h) => h.textContent)).toEqual(['Needs you now · 2', 'Coming up · 1'])
    expect(document.querySelector('[data-lien-next-up-amount]')).toBeNull()
    expect(document.querySelector('[data-lien-phone-group]')).toBeNull()
  })

  it('the day reads late, today, or days left', () => {
    expect(lienNextUpDueWords({ dueOn: '2026-10-01', daysLeft: -4 })).toBe('Oct 1 · 4 days late')
    expect(lienNextUpDueWords({ dueOn: '2026-10-04', daysLeft: -1 })).toBe('Oct 4 · 1 day late')
    expect(lienNextUpDueWords({ dueOn: '2026-10-05', daysLeft: 0 })).toBe('Oct 5 · today')
    expect(lienNextUpDueWords({ dueOn: '2026-10-06', daysLeft: 1 })).toBe('Oct 6 · 1 day left')
    expect(lienNextUpDueWords({ dueOn: null, daysLeft: null })).toBe('')
  })
})

describe('LienDeskNextUp · the job as a door (v2.4628)', () => {
  it('with onOpenJob the number and name are a text button that opens the job and not the row; a GC run row stays plain', () => {
    const onAct = vi.fn()
    const onOpenJob = vi.fn()
    const rows = [row({}), row({ key: 'run:gc1', jobId: null, title: 'Lowbeck Contracting', sub: '2 notices approved · ready to send', action: 'send_run', button: 'Send the run', target: { open: 'run', gcId: 'gc1' } })]
    render(<LienDeskNextUp rows={rows} loading={false} isMobile={false} onAct={onAct} onOpenJob={onOpenJob} />)
    const door = screen.getByTestId('lien-next-up-job-j1')
    expect(door.tagName).toBe('BUTTON')
    expect(door.textContent).toBe('650 · AXO Schertz')
    expect(door.className).toBe('lienJobDoor')
    expect(door.getAttribute('title')).toBe('Open the job: its history, its bills and Edit')
    fireEvent.click(door)
    expect(onOpenJob).toHaveBeenCalledWith('j1')
    expect(onAct).not.toHaveBeenCalled()
    // The run row names a GC, not a job: plain words, and the row still opens on a press.
    const run = document.querySelector('[data-lien-next-up-row="run:gc1"]') as HTMLElement
    expect(within(run).queryByRole('button', { name: 'Lowbeck Contracting' })).toBeNull()
    fireEvent.click(run)
    expect(onAct).toHaveBeenCalledTimes(1)
  })
  it('without onOpenJob the title is plain words, as before', () => {
    render(<LienDeskNextUp rows={[row({})]} loading={false} isMobile={false} onAct={() => {}} />)
    expect(screen.queryByTestId('lien-next-up-job-j1')).toBeNull()
    expect(screen.getByText('650 · AXO Schertz').tagName).toBe('SPAN')
  })
  it('on a phone the card\u2019s title is the same door', () => {
    const onOpenJob = vi.fn()
    render(<LienDeskNextUp rows={[row({})]} loading={false} isMobile onAct={() => {}} onOpenJob={onOpenJob} />)
    fireEvent.click(screen.getByTestId('lien-next-up-job-j1'))
    expect(onOpenJob).toHaveBeenCalledWith('j1')
  })

  it('on a phone with a job screen to open (punch list #352, PR 4): the row, its name and its dots open the job’s own screen; the press and the chip keep their own doors', () => {
    const on = { row: vi.fn(), job: vi.fn(), act: vi.fn(), paper: vi.fn() }
    const r = row({})
    render(<LienDeskNextUp rows={[r]} loading={false} isMobile onAct={on.act} onOpenJob={on.job} onOpenPaper={on.paper} onOpenRow={on.row} />)
    // The name is the press that opens the screen; the door to the Job window moved onto the screen.
    expect(screen.queryByTestId('lien-next-up-job-j1')).toBeNull()
    const name = screen.getByRole('button', { name: '650 · AXO Schertz: where it stands' })
    fireEvent.click(name)
    expect(on.row).toHaveBeenCalledTimes(1)
    expect(on.row).toHaveBeenLastCalledWith(r)
    // A tap anywhere on the row is the same press.
    fireEvent.click(document.querySelector('[data-lien-next-up-sub]')!)
    expect(on.row).toHaveBeenCalledTimes(2)
    // The dots open the screen in place of the step card's sheet.
    fireEvent.click(screen.getByTestId('lien-step-mark'))
    expect(on.row).toHaveBeenCalledTimes(3)
    expect(screen.queryByTestId('lien-step-card')).toBeNull()
    // The row's own press and its chip do what they did, and do not open the screen.
    fireEvent.click(screen.getByRole('button', { name: 'Draft notice' }))
    expect(on.act).toHaveBeenCalledWith(r)
    fireEvent.click(screen.getByTestId('lien-next-up-paper-j1-notice'))
    expect(on.paper).toHaveBeenCalledWith(r)
    expect(on.row).toHaveBeenCalledTimes(3)
    expect(on.job).not.toHaveBeenCalled()
  })

  it('a computer never opens the job screen: the name stays the job’s door and a press on the row acts', () => {
    const on = { row: vi.fn(), job: vi.fn(), act: vi.fn() }
    render(<LienDeskNextUp rows={[row({})]} loading={false} isMobile={false} onAct={on.act} onOpenJob={on.job} onOpenRow={on.row} />)
    fireEvent.click(screen.getByTestId('lien-next-up-job-j1'))
    expect(on.job).toHaveBeenCalledWith('j1')
    fireEvent.click(document.querySelector('[data-lien-next-up-row]')!)
    expect(on.act).toHaveBeenCalledTimes(1)
    expect(on.row).not.toHaveBeenCalled()
  })
})

describe('LienDeskNextUp · the steps (v2.4631)', () => {
  const rows = [
    row({ action: 'find_owner', sub: 'Needs the owner of record', button: 'Find the owner' }),
    row({ key: 'notice:j2', jobId: 'j2', title: '651 · AXO Schertz II' }),
    row({ key: 'notice:j3', jobId: 'j3', title: '652 · Tune 5', action: 'approve', sub: 'Waiting on your approval', button: 'Approve' }),
    row({ key: 'affidavit:j4', jobId: 'j4', kind: 'affidavit', title: '977 · Stonewick', action: 'fix_property', sub: 'Affidavit · the property record is not complete', button: 'Fix the property', target: { open: 'affidavits', jobId: 'j4' } }),
  ]
  it('draws no rail above the rows since v2.7332: the Board at the top of To do holds the steps, and a row keeps its dots', () => {
    render(<LienDeskNextUp rows={rows} loading={false} isMobile={false} onAct={() => {}} viewerIsLeader />)
    expect(screen.queryByTestId('lien-step-rails')).toBeNull()
    expect(document.querySelectorAll('[data-testid^="lien-step-rail-"]')).toHaveLength(0)
    expect(screen.queryByTestId('lien-step-brief')).toBeNull()
    expect(screen.getAllByTestId('lien-step-mark')).toHaveLength(4)
    // The list is the day groups and nothing else sorts it.
    const titles = Array.from(document.querySelectorAll('[data-lien-next-up-group] h3')).map((h) => h.textContent)
    expect(titles).toEqual(['Only you can approve · 1', 'Needs you now · 3'])
    cleanup()
    // A phone has no folded Steps of each paper row either.
    render(<LienDeskNextUp rows={rows} loading={false} isMobile onAct={() => {}} />)
    expect(screen.queryByTestId('lien-step-rails-fold')).toBeNull()
  })
  it('every row wears four dots and its fraction; hovering them opens the card beside, with the ladder written out and the row’s own button', () => {
    const onAct = vi.fn()
    render(<LienDeskNextUp rows={rows} loading={false} isMobile={false} onAct={onAct} factsFor={() => ({ ownerName: 'Elwick Holdings LLC', viewerIsLeader: true })} viewerIsLeader />)
    expect(screen.getAllByTestId('lien-step-mark')).toHaveLength(4)
    // By row, not by place: the leader's approval leads the list since punch list #101 PR 3.
    const markOf = (key: string) => within(document.querySelector(`[data-lien-next-up-row="${key}"]`) as HTMLElement).getByTestId('lien-step-mark')
    const marks = [null, null, markOf('notice:j3'), markOf('affidavit:j4')]
    expect(marks[2]!.textContent).toBe('3/4')
    expect(screen.queryByTestId('lien-step-card')).toBeNull()
    fireEvent.mouseEnter(marks[2]!)
    const card = screen.getByTestId('lien-step-card')
    expect(card.getAttribute('data-place')).toBe('beside')
    expect(screen.getByTestId('lien-step-card-title').textContent).toBe('652 · Tune 5')
    expect(screen.getByTestId('lien-step-card-deadline').textContent).toBe('In the mail by Oct 9 · 4 days left')
    expect(screen.getAllByTestId('lien-step-card-item').map((el) => el.getAttribute('data-state'))).toEqual(['done', 'done', 'now', 'todo'])
    expect(card.textContent).toContain('Elwick Holdings LLC, from the property record.')
    expect(screen.getByTestId('lien-step-card-foot').textContent).toBe('Step 3 of 4 · 2 done · 2 to go')
    fireEvent.click(screen.getByTestId('lien-step-card-act'))
    expect(onAct).toHaveBeenCalledTimes(1)
    expect(onAct.mock.calls[0]![0].key).toBe('notice:j3')
    expect(screen.queryByTestId('lien-step-card')).toBeNull()
    // Esc closes a card and nothing else.
    fireEvent.mouseEnter(marks[3]!)
    expect(screen.getByTestId('lien-step-card-blocked').textContent).toBe('Blocked by: the property record')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByTestId('lien-step-card')).toBeNull()
  })
  it('on a phone a tap on the dots opens the card as a sheet with a Close', () => {
    render(<LienDeskNextUp rows={rows} loading={false} isMobile onAct={() => {}} />)
    const mark = screen.getAllByTestId('lien-step-mark')[0] as HTMLButtonElement
    expect(mark.style.minHeight).toBe('40px')
    fireEvent.click(mark)
    expect(screen.getByTestId('lien-step-card').getAttribute('data-place')).toBe('sheet')
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByTestId('lien-step-card')).toBeNull()
  })
})

describe('LienDeskNextUp · the chip as a door to the paper (v2.4632)', () => {
  it('with onOpenPaper the chip is a button that opens the paper and not the row, wears the gap count or a tick; a run row and retainage stay plain', () => {
    const onAct = vi.fn()
    const onOpenPaper = vi.fn()
    const rows = [
      row({ action: 'find_owner', sub: 'Needs the owner of record', button: 'Find the owner' }),
      row({ key: 'notice:j2', jobId: 'j2', title: '651 · AXO Schertz II', action: 'approve', button: 'Approve' }),
      row({ key: 'run:gc1', jobId: null, title: 'Lowbeck Contracting', action: 'send_run', button: 'Send the run', target: { open: 'run', gcId: 'gc1' } }),
      row({ key: 'retainage:j3', jobId: 'j3', kind: 'retainage', title: '700 · Retainage', action: 'draft', button: 'Draft notice', target: { open: 'retainage', jobId: 'j3' } }),
    ]
    render(<LienDeskNextUp rows={rows} loading={false} isMobile={false} onAct={onAct} onOpenPaper={onOpenPaper} gapsFor={(r) => (r.jobId === 'j1' ? 1 : 0)} />)
    const door = screen.getByTestId('lien-next-up-paper-j1-notice')
    expect(door.tagName).toBe('BUTTON')
    expect(door.className).toBe('lienPaperDoor')
    expect(door.getAttribute('title')).toBe('Open the notice as it stands: 1 detail missing')
    expect(within(door).getByTestId('lien-paper-gap-count').textContent).toBe('1')
    expect(within(screen.getByTestId('lien-next-up-paper-j2-notice')).getByTestId('lien-paper-gap-ok')).toBeTruthy()
    fireEvent.click(door)
    expect(onOpenPaper).toHaveBeenCalledTimes(1)
    expect(onOpenPaper.mock.calls[0]![0].key).toBe('notice:j1')
    expect(onAct).not.toHaveBeenCalled()
    expect(screen.queryByTestId('lien-next-up-paper-j3-retainage')).toBeNull()
    const run = document.querySelector('[data-lien-next-up-row="run:gc1"]') as HTMLElement
    expect(within(run).queryByRole('button', { name: /Notice/ })).toBeNull()
  })
  it('without onOpenPaper the chip is the plain tag', () => {
    render(<LienDeskNextUp rows={[row({})]} loading={false} isMobile={false} onAct={() => {}} />)
    expect(screen.queryByTestId('lien-next-up-paper-j1-notice')).toBeNull()
    expect(screen.getByText('Notice').tagName).toBe('SPAN')
  })
})

describe('LienDeskNextUp · the printed run (punch list #101)', () => {
  const run = row({
    key: 'run:printed', jobId: null, gcId: null, title: '19 notices printed Oct 7', sub: 'Mailed? Type each envelope’s number. Not mailing them? Take the run back.', action: 'record_mailing', button: 'Record the mailing', target: { open: 'run', gcId: null },
    secondary: { words: 'Take back…', target: { open: 'run', gcId: null, takeBack: true } },
    jobs: [{ jobId: 'j2', title: '712 · Cedar Park', dueOn: '2026-10-15' }, { jobId: 'j3', title: '715 · Leander', dueOn: '2026-11-15' }],
  })
  it('one row tagged Run, two buttons, its jobs folded until pressed, each a door to its job', () => {
    const onAct = vi.fn()
    const onOpenJob = vi.fn()
    render(<LienDeskNextUp rows={[run]} loading={false} isMobile={false} onAct={onAct} onOpenJob={onOpenJob} ready={{ notice: 19 }} printed={{ notice: 19 }} onOpenRun={() => {}} />)
    const el = document.querySelector('[data-lien-next-up-row="run:printed"]') as HTMLElement
    expect(el.textContent).toContain('Run')
    expect(el.textContent).toContain('19 notices printed Oct 7')
    fireEvent.click(within(el).getByRole('button', { name: 'Take back…' }))
    expect(onAct.mock.calls[0]![0].target).toEqual({ open: 'run', gcId: null, takeBack: true })
    fireEvent.click(within(el).getByRole('button', { name: 'Record the mailing' }))
    expect(onAct.mock.calls[1]![0].target).toEqual({ open: 'run', gcId: null })
    expect(document.querySelector('[data-lien-next-up-fold-body]')).toBeNull()
    fireEvent.click(within(el).getByRole('button', { name: '▸ The 2 jobs' }))
    expect(onAct).toHaveBeenCalledTimes(2)
    const body = document.querySelector('[data-lien-next-up-fold-body="run:printed"]') as HTMLElement
    expect(body.textContent).toContain('712 · Cedar Park')
    expect(body.textContent).toContain('Oct 15')
    fireEvent.click(screen.getByTestId('lien-next-up-job-j3'))
    expect(onOpenJob).toHaveBeenCalledWith('j3')
    expect(onAct).toHaveBeenCalledTimes(2)
  })
  it('the find opens the fold; a phone draws both buttons a thumb tall at the row’s end', () => {
    render(<LienDeskNextUp rows={[run]} loading={false} isMobile onAct={() => {}} foldsOpen />)
    expect(document.querySelector('[data-lien-next-up-fold-body="run:printed"]')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Take back…' }) as HTMLButtonElement).style.minHeight).toBe('40px')
  })
})

describe('LienDeskNextUp · only you can approve, first (punch list #101 PR 3)', () => {
  it('the leader’s approvals lead under their own title; the office’s close the list under the leader’s name', () => {
    const approve = row({ key: 'notice:j2', jobId: 'j2', title: '744 · Pecan St', action: 'approve', button: 'Approve', sub: 'Waiting on your approval', dueOn: '2026-11-15', daysLeft: 41, severity: 'quiet', group: 'coming' })
    render(<LienDeskNextUp rows={[row({}), approve]} loading={false} isMobile={false} onAct={() => {}} />)
    const titles = Array.from(document.querySelectorAll('[data-lien-next-up-group] h3')).map((h) => h.textContent)
    expect(titles).toEqual(['Only you can approve · 1', 'Needs you now · 1'])
    cleanup()
    render(<LienDeskNextUp rows={[row({}), { ...approve, button: null, sub: 'Waiting on Sam' }]} loading={false} isMobile={false} onAct={() => {}} waitingOn="Sam" />)
    expect(Array.from(document.querySelectorAll('[data-lien-next-up-group] h3')).map((h) => h.textContent)).toEqual(['Needs you now · 1', 'Waiting on Sam · 1'])
  })
})

describe('LienDeskNextUp · the REMINDERS strip (punch list #262)', () => {
  const reminders = {
    counts: [2, 1, 1, 2] as [number, number, number, number],
    waiting: 1,
    scheduled: 0,
    rows: [
      { jobId: 'j1', title: '744 · Castell', step: 1 as const, state: 'due' as const, words: 'day 21 · nothing since the packet', day: 21, counted: true },
      { jobId: 'j5', title: '752 · Pecan Grove', step: 1 as const, state: 'due' as const, words: 'day 29 · nothing since the packet', day: 29, counted: true },
      { jobId: 'j6', title: '760 · Harlan Homes', step: 1 as const, state: 'waiting' as const, words: 'day 4 · courtesy from day 7', day: 4, counted: false },
      { jobId: 'j7', title: '741 · Ridgeway', step: 2 as const, state: 'sent' as const, words: 'courtesy sent Nov 2 by email and text', day: 9, counted: true },
      { jobId: 'j8', title: '733 · Castell II', step: 3 as const, state: 'two_drafting' as const, words: 'the attorney’s letter · unresponsive · drafting', day: 16, counted: true },
      { jobId: 'j9', title: '729 · Pecan Grove II', step: 4 as const, state: 'paid' as const, words: 'paid', day: 30, counted: true },
      { jobId: 'j10', title: '706 · Selwick', step: 4 as const, state: 'owner_called' as const, words: 'owner called Nov 1', day: 22, counted: true },
    ],
  }
  const rows = [
    row({ action: 'find_owner', sub: 'Needs the owner of record', button: 'Find the owner', key: 'notice:j2', jobId: 'j2', title: '651 · AXO Schertz II' }),
    row({ key: 'courtesy:j1', title: '744 · Castell', action: 'courtesy', button: 'Send a courtesy notice', sub: 'day 21 · nothing since the packet', dueOn: null, daysLeft: null, severity: 'red', target: { open: 'notices', jobId: 'j1', pile: 'sent' }, reminder: reminders.rows[0] }),
    row({ key: 'courtesy:j5', jobId: 'j5', title: '752 · Pecan Grove', action: 'courtesy', button: 'Send a courtesy notice', sub: 'day 29 · nothing since the packet', dueOn: null, daysLeft: null, severity: 'red', target: { open: 'notices', jobId: 'j5', pile: 'sent' }, reminder: reminders.rows[1] }),
  ]
  // The violet rail, its brief, the timeline and the no-row list left with v2.7332 (the Board); the rows keep their heading and their dots.
  it('the courtesy rows read under Reminders, not Needs you now, and their dots read on the REMINDERS ladder', () => {
    render(<LienDeskNextUp rows={rows} loading={false} isMobile={false} onAct={() => {}} viewerIsLeader />)
    expect(document.querySelectorAll('[data-testid^="lien-step-rail-"]')).toHaveLength(0)
    const titles = Array.from(document.querySelectorAll('[data-lien-next-up-group] h3')).map((h) => h.textContent)
    expect(titles).toEqual(['Needs you now · 1', 'Reminders · 2'])
    const group = screen.getByRole('region', { name: 'Reminders' })
    expect(within(group).getAllByRole('button', { name: 'Send a courtesy notice' })).toHaveLength(2)
    const mark = within(document.querySelector('[data-lien-next-up-row="courtesy:j1"]') as HTMLElement).getByTestId('lien-step-mark')
    expect(mark.textContent).toBe('1/4')
  })
  it('a notice paying it down (PR 3 of #274): its row asks what they promised', () => {
    const paying = { jobId: 'j7', title: '741 · Ridgeway', step: 2 as const, state: 'paying' as const, words: 'paying it down · $4,000 paid Nov 3 · $8,045 still owed', day: 20, counted: true, why: 'paying it down' }
    const promiseRow = row({ key: 'promise:j7', jobId: 'j7', title: '741 · Ridgeway', action: 'promise', button: 'Record what they promised', sub: paying.words, dueOn: null, daysLeft: null, severity: 'amber', target: { open: 'notices', jobId: 'j7', pile: 'sent' }, reminder: paying })
    const onAct = vi.fn()
    render(<LienDeskNextUp rows={[...rows, promiseRow]} loading={false} isMobile={false} onAct={onAct} />)
    const group = screen.getByRole('region', { name: 'Reminders' })
    fireEvent.click(within(group).getByRole('button', { name: 'Record what they promised' }))
    expect(onAct.mock.calls[0]![0]).toMatchObject({ action: 'promise', jobId: 'j7' })
    expect(within(document.querySelector('[data-lien-next-up-row="promise:j7"]') as HTMLElement).getByTestId('lien-step-mark').textContent).toBe('2/4')
  })
  it('at 375 wide a courtesy row wears the reminder dots with its step’s name', () => {
    render(<LienDeskNextUp rows={rows} loading={false} isMobile onAct={() => {}} />)
    expect(screen.queryByTestId('lien-step-rails-fold')).toBeNull()
    const card = document.querySelector('[data-lien-next-up-row="courtesy:j1"]') as HTMLElement
    // The card is three lines (punch list #352, PR 3): the dots stand in for the four violet tiles, with the step's name beside them.
    expect(within(card).getByTestId('lien-step-mark').getAttribute('aria-label')).toBe('Step 1 of 4: where this stands')
    expect(within(card).getByTestId('lien-step-mark').textContent).toBe('')
  })
})

describe('LienDeskNextUp · the doors beside a row whose notice on record still owes a month (punch list #353, part 2)', () => {
  const owed = row({
    sub: 'September 2026 has no notice. The one on record names April, June, July and August 2026.',
    doors: [
      { words: 'The paper named September 2026 too', target: { open: 'notice_record_months', jobId: 'j1', months: ['2026-09'] } },
      { words: 'The last day of work is wrong', target: { open: 'lien_window', jobId: 'j1', tab: 'notice', openLastWork: true } },
    ],
  })
  it('draws each door as its own press, each acting on the row with that door’s target, beside the draft press', () => {
    const onAct = vi.fn()
    render(<LienDeskNextUp rows={[owed]} loading={false} isMobile={false} onAct={onAct} />)
    const el = document.querySelector('[data-lien-next-up-row="notice:j1"]') as HTMLElement
    expect(el.textContent).toContain('September 2026 has no notice.')
    fireEvent.click(within(el).getByRole('button', { name: 'The paper named September 2026 too' }))
    expect(onAct.mock.calls[0]![0].target).toEqual({ open: 'notice_record_months', jobId: 'j1', months: ['2026-09'] })
    fireEvent.click(within(el).getByRole('button', { name: 'The last day of work is wrong' }))
    expect(onAct.mock.calls[1]![0].target).toEqual({ open: 'lien_window', jobId: 'j1', tab: 'notice', openLastWork: true })
    fireEvent.click(within(el).getByRole('button', { name: 'Draft notice' }))
    expect(onAct.mock.calls[2]![0].target).toEqual({ open: 'notices', jobId: 'j1', pile: 'to_draft' })
    expect(el.querySelectorAll('[data-lien-next-up-door]')).toHaveLength(2)
  })
})
