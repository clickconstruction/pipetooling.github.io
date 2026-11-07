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

  it('a phone row names the four steps in place of the dots, with the current one saying whose it is (v2.4881)', () => {
    render(<LienDeskNextUp rows={[row({ action: 'approve', button: 'Approve' })]} loading={false} isMobile onAct={() => {}} viewerIsLeader />)
    const tiles = Array.from(screen.getByTestId('lien-step-row').querySelectorAll('.lienStepTile')).map((t) => `${t.textContent}:${t.getAttribute('data-state')}`)
    expect(tiles).toEqual(['✓Owner:done', '✓Drafted:done', 'youApprove:now', '\u00a0Mail:todo'])
    expect(screen.queryByTestId('lien-step-mark')).toBeNull()
    cleanup()
    render(<LienDeskNextUp rows={[row({ action: 'draft', button: 'Draft notice' })]} loading={false} isMobile onAct={() => {}} />)
    expect(screen.getByTestId('lien-step-row').querySelector('[data-state="now"]')!.textContent).toBe('youDrafted')
    cleanup()
    render(<LienDeskNextUp rows={[row({ action: 'draft', button: 'Draft notice' })]} loading={false} isMobile={false} onAct={() => {}} />)
    expect(screen.queryByTestId('lien-step-row')).toBeNull()
    expect(screen.getByTestId('lien-step-mark')).toBeTruthy()
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
    const rows = [row({}), row({ key: 'run:gc1', jobId: null, title: 'Loberg Contracting', sub: '2 notices approved · ready to send', action: 'send_run', button: 'Send the run', target: { open: 'run', gcId: 'gc1' } })]
    render(<LienDeskNextUp rows={rows} loading={false} isMobile={false} onAct={onAct} onOpenJob={onOpenJob} />)
    const door = screen.getByTestId('lien-next-up-job-j1')
    expect(door.tagName).toBe('BUTTON')
    expect(door.textContent).toBe('650 · ATI Schertz')
    expect(door.className).toBe('lienJobDoor')
    expect(door.getAttribute('title')).toBe('Open the job: its history, its bills and Edit')
    fireEvent.click(door)
    expect(onOpenJob).toHaveBeenCalledWith('j1')
    expect(onAct).not.toHaveBeenCalled()
    // The run row names a GC, not a job: plain words, and the row still opens on a press.
    const run = document.querySelector('[data-lien-next-up-row="run:gc1"]') as HTMLElement
    expect(within(run).queryByRole('button', { name: 'Loberg Contracting' })).toBeNull()
    fireEvent.click(run)
    expect(onAct).toHaveBeenCalledTimes(1)
  })
  it('without onOpenJob the title is plain words, as before', () => {
    render(<LienDeskNextUp rows={[row({})]} loading={false} isMobile={false} onAct={() => {}} />)
    expect(screen.queryByTestId('lien-next-up-job-j1')).toBeNull()
    expect(screen.getByText('650 · ATI Schertz').tagName).toBe('SPAN')
  })
  it('on a phone the card\u2019s title is the same door', () => {
    const onOpenJob = vi.fn()
    render(<LienDeskNextUp rows={[row({})]} loading={false} isMobile onAct={() => {}} onOpenJob={onOpenJob} />)
    fireEvent.click(screen.getByTestId('lien-next-up-job-j1'))
    expect(onOpenJob).toHaveBeenCalledWith('j1')
  })
})

describe('LienDeskNextUp · the steps (v2.4631)', () => {
  const rows = [
    row({ action: 'find_owner', sub: 'Needs the owner of record', button: 'Find the owner' }),
    row({ key: 'notice:j2', jobId: 'j2', title: '651 · ATI Schertz II' }),
    row({ key: 'notice:j3', jobId: 'j3', title: '652 · Take 5', action: 'approve', sub: 'Waiting on your approval', button: 'Approve' }),
    row({ key: 'affidavit:j4', jobId: 'j4', kind: 'affidavit', title: '977 · Springtown', action: 'fix_property', sub: 'Affidavit · the property record is not complete', button: 'Fix the property', target: { open: 'affidavits', jobId: 'j4' } }),
  ]
  it('draws a rail per ladder with its counts, the run count on the fourth rung, and a press narrows the list to that rung', () => {
    const onOpenRun = vi.fn()
    render(<LienDeskNextUp rows={rows} loading={false} isMobile={false} onAct={() => {}} ready={{ notice: 11 }} onOpenRun={onOpenRun} viewerIsLeader />)
    expect(screen.getByTestId('lien-step-rail-notice')).toBeTruthy()
    expect(screen.getByTestId('lien-step-rail-affidavit')).toBeTruthy()
    expect(screen.queryByTestId('lien-step-rail-retainage')).toBeNull()
    expect(['1', '2', '3', '4'].map((n) => screen.getByTestId(`lien-step-count-notice-${n}`).textContent)).toEqual(['1', '1', '1', '11 ready'])
    expect(screen.getByTestId('lien-step-count-affidavit-1').textContent).toBe('1')
    fireEvent.click(screen.getByTestId('lien-step-notice-2'))
    expect(screen.getByTestId('lien-step-notice-2').getAttribute('aria-pressed')).toBe('true')
    // v2.6574: the press sorts the list — the rung's rows first, the rest after at full strength; nothing is faded.
    const titles = () => Array.from(document.querySelectorAll('[data-lien-next-up-group] h3')).map((h) => h.textContent)
    expect(titles()).toEqual(['On this step · 1', 'On other steps · 3'])
    expect(Array.from(document.querySelectorAll('[data-lien-next-up-group="step_on"] [data-lien-next-up-row]')).map((el) => el.getAttribute('data-lien-next-up-row'))).toEqual(['notice:j2'])
    expect(document.querySelectorAll('[data-dim]')).toHaveLength(0)
    fireEvent.click(screen.getByTestId('lien-step-notice-2'))
    expect(screen.queryByTestId('lien-step-brief')).toBeNull()
    expect(titles()[0]).not.toBe('On this step · 1')
    // The fourth rung is the run itself.
    fireEvent.click(screen.getByTestId('lien-step-notice-4'))
    expect(onOpenRun).toHaveBeenCalledTimes(1)
  })
  it('a pressed rung opens a step brief with the rung’s name, count and words on every rail, and Every step clears it (v2.6574, v2.6577)', () => {
    render(<LienDeskNextUp rows={rows} loading={false} isMobile={false} onAct={() => {}} />)
    expect(screen.queryByTestId('lien-step-brief')).toBeNull()
    fireEvent.click(screen.getByTestId('lien-step-notice-2'))
    const brief = screen.getByTestId('lien-step-brief')
    expect(brief.getAttribute('data-ladder')).toBe('notice')
    expect(screen.getByTestId('lien-step-brief-title').textContent).toBe('2 · Draft notice')
    expect(screen.getByTestId('lien-step-brief-count').textContent).toBe('the office’s step · 1 notice here')
    // The notice rail's own brief (v2.6577): the four parts, no schedule strip (that is the REMINDERS rail's).
    expect(screen.getByTestId('lien-step-brief-plain').textContent).toContain('The owner is known and a month of our work is unpaid.')
    expect(screen.getByTestId('lien-step-brief-usual').textContent).toBe('Draft notice · the office presses it · fills the state’s form from the job; read it once, then send it to the leader')
    expect(Array.from(screen.getByTestId('lien-step-brief-instead').querySelectorAll('strong')).map((el) => el.textContent)).toEqual(['The leader said to send it ▸', 'Hold — they promised…', 'Hold — I’ll call first'])
    expect(screen.getByTestId('lien-step-brief-nobody').textContent).toContain('After the notice’s day the lien right for that month is lost.')
    expect(screen.queryByTestId('lien-schedule-strip')).toBeNull()
    expect(screen.queryByTestId('lien-step-showing')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Every step' }))
    expect(screen.queryByTestId('lien-step-brief')).toBeNull()
    expect(screen.getByTestId('lien-step-notice-2').getAttribute('aria-pressed')).toBe('false')
    // On a phone the brief and its press stay.
    cleanup()
    render(<LienDeskNextUp rows={rows} loading={false} isMobile onAct={() => {}} />)
    fireEvent.click(screen.getByTestId('lien-step-affidavit-1'))
    expect(screen.getByTestId('lien-step-brief-title').textContent).toBe('1 · Fix the property')
    expect(screen.getByTestId('lien-step-brief-usual').textContent).toContain('Fix the property · the office presses it · opens the property record')
    expect(screen.getByTestId('lien-step-brief-count').textContent).toBe('the office’s step · 1 affidavit here')
    expect(screen.getByTestId('lien-step-brief-instead').textContent).toContain('Fill in the record ›')
    expect(screen.getByTestId('lien-step-brief-clear').textContent).toBe('Every step')
  })
  it('every row wears four dots and its fraction; hovering them opens the card beside, with the ladder written out and the row’s own button', () => {
    const onAct = vi.fn()
    render(<LienDeskNextUp rows={rows} loading={false} isMobile={false} onAct={onAct} factsFor={() => ({ ownerName: 'Elbel Holdings LLC', viewerIsLeader: true })} viewerIsLeader />)
    expect(screen.getAllByTestId('lien-step-mark')).toHaveLength(4)
    // By row, not by place: the leader's approval leads the list since punch list #101 PR 3.
    const markOf = (key: string) => within(document.querySelector(`[data-lien-next-up-row="${key}"]`) as HTMLElement).getByTestId('lien-step-mark')
    const marks = [null, null, markOf('notice:j3'), markOf('affidavit:j4')]
    expect(marks[2]!.textContent).toBe('3/4')
    expect(screen.queryByTestId('lien-step-card')).toBeNull()
    fireEvent.mouseEnter(marks[2]!)
    const card = screen.getByTestId('lien-step-card')
    expect(card.getAttribute('data-place')).toBe('beside')
    expect(screen.getByTestId('lien-step-card-title').textContent).toBe('652 · Take 5')
    expect(screen.getByTestId('lien-step-card-deadline').textContent).toBe('In the mail by Oct 9 · 4 days left')
    expect(screen.getAllByTestId('lien-step-card-item').map((el) => el.getAttribute('data-state'))).toEqual(['done', 'done', 'now', 'todo'])
    expect(card.textContent).toContain('Elbel Holdings LLC, from the property record.')
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
  it('on a phone a tap on the named steps opens the card as a sheet with a Close', () => {
    render(<LienDeskNextUp rows={rows} loading={false} isMobile onAct={() => {}} />)
    fireEvent.click(screen.getAllByTestId('lien-step-row')[0]!)
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
      row({ key: 'notice:j2', jobId: 'j2', title: '651 · ATI Schertz II', action: 'approve', button: 'Approve' }),
      row({ key: 'run:gc1', jobId: null, title: 'Loberg Contracting', action: 'send_run', button: 'Send the run', target: { open: 'run', gcId: 'gc1' } }),
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
    expect(screen.getByTestId('lien-step-count-notice-4').textContent).toBe('19 printed')
  })
  it('the find opens the fold; a phone stacks both buttons full width', () => {
    render(<LienDeskNextUp rows={[run]} loading={false} isMobile onAct={() => {}} foldsOpen />)
    expect(document.querySelector('[data-lien-next-up-fold-body="run:printed"]')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Take back…' }) as HTMLButtonElement).style.width).toBe('100%')
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
      { jobId: 'j10', title: '706 · Summit', step: 4 as const, state: 'owner_called' as const, words: 'owner called Nov 1', day: 22, counted: true },
    ],
  }
  const rows = [
    row({ action: 'find_owner', sub: 'Needs the owner of record', button: 'Find the owner', key: 'notice:j2', jobId: 'j2', title: '651 · ATI Schertz II' }),
    row({ key: 'courtesy:j1', title: '744 · Castell', action: 'courtesy', button: 'Send a courtesy notice', sub: 'day 21 · nothing since the packet', dueOn: null, daysLeft: null, severity: 'red', target: { open: 'notices', jobId: 'j1', pile: 'sent' }, reminder: reminders.rows[0] }),
    row({ key: 'courtesy:j5', jobId: 'j5', title: '752 · Pecan Grove', action: 'courtesy', button: 'Send a courtesy notice', sub: 'day 29 · nothing since the packet', dueOn: null, daysLeft: null, severity: 'red', target: { open: 'notices', jobId: 'j5', pile: 'sent' }, reminder: reminders.rows[1] }),
  ]
  it('at 1,400 wide: a violet rail between notices and affidavits with the kernel’s counts and the before-day-7 words; the courtesy rows read under Reminders, not Needs you now', () => {
    render(<LienDeskNextUp rows={rows} loading={false} isMobile={false} onAct={() => {}} reminders={reminders} viewerIsLeader />)
    const rails = Array.from(document.querySelectorAll('[data-testid^="lien-step-rail-"]')).map((el) => el.getAttribute('data-testid'))
    expect(rails).toEqual(['lien-step-rail-notice', 'lien-step-rail-reminder'])
    expect(['1', '2', '3', '4'].map((n) => screen.getByTestId(`lien-step-count-reminder-${n}`).textContent)).toEqual(['2 · 1 before day 7', '1', '1', '2'])
    expect(screen.getByRole('group', { name: "The reminder's four steps" }).textContent).toContain('Reminder due')
    expect(screen.getByRole('group', { name: "The reminder's four steps" }).textContent).toContain('Attorney’s letteryou')
    const titles = Array.from(document.querySelectorAll('[data-lien-next-up-group] h3')).map((h) => h.textContent)
    expect(titles).toEqual(['Needs you now · 1', 'Reminders · 2'])
    const group = screen.getByRole('region', { name: 'Reminders' })
    expect(within(group).getAllByRole('button', { name: 'Send a courtesy notice' })).toHaveLength(2)
    // The row's dots read on the REMINDERS ladder.
    const mark = within(document.querySelector('[data-lien-next-up-row="courtesy:j1"]') as HTMLElement).getByTestId('lien-step-mark')
    expect(mark.textContent).toBe('1/4')
  })
  it('a rung pressed opens its brief, sorts the list to its rows first, and lists the notices on it that have no row, each opening its notice', () => {
    const onAct = vi.fn()
    const onOpenReminder = vi.fn()
    render(<LienDeskNextUp rows={rows} loading={false} isMobile={false} onAct={onAct} reminders={reminders} onOpenReminder={onOpenReminder} />)
    expect(screen.queryByTestId('lien-reminder-step-list')).toBeNull()
    fireEvent.click(screen.getByTestId('lien-step-reminder-1'))
    // v2.6574: the step brief under the rail — the schedule strip with the notices' days on it, what, why, the usual move, the other moves — and the list sorted, nothing faded.
    const brief = screen.getByTestId('lien-step-brief')
    expect(brief.getAttribute('data-ladder')).toBe('reminder')
    expect(screen.getByTestId('lien-step-brief-title').textContent).toBe('1 · Reminder due')
    expect(screen.getByTestId('lien-step-brief-count').textContent).toBe('the office’s step · 3 notices here')
    expect(Array.from(brief.querySelectorAll('[data-lien-schedule-point]')).map((el) => el.getAttribute('data-lien-schedule-point'))).toEqual(['0', '7', '10', '14'])
    expect(Array.from(brief.querySelectorAll('[data-lien-schedule-mark]')).map((el) => el.textContent)).toEqual(['day 4', 'day 21', 'day 29+'])
    expect(brief.textContent).toContain('The packet went, nothing came back, it is day 7 or later, and reminders week of the lien’s month has opened (days 1 to 5).')
    expect(screen.getByTestId('lien-step-brief-usual').textContent).toContain('Send a courtesy notice · the office presses it · sends the email and the text in one press')
    expect(Array.from(screen.getByTestId('lien-step-brief-instead').querySelectorAll('strong')).map((el) => el.textContent)).toEqual(['Send the attorney’s letter', 'Record the owner’s call', 'The GC authorized direct pay'])
    expect(Array.from(document.querySelectorAll('[data-lien-next-up-group] h3')).map((h) => h.textContent)).toEqual(['On this step · 2', 'On other steps · 1'])
    expect(document.querySelectorAll('[data-dim]')).toHaveLength(0)
    const list = within(brief).getByTestId('lien-reminder-step-list')
    expect(list.getAttribute('data-step')).toBe('1')
    expect(list.textContent).toContain('Also on this step, with no row on the list · 1 · 2 on the list below')
    expect(list.textContent).toContain('760 · Harlan Homes')
    expect(list.textContent).toContain('day 4 · courtesy from day 7')
    fireEvent.click(screen.getByTestId('lien-step-reminder-4'))
    const closed = screen.getByTestId('lien-reminder-step-list')
    expect(closed.getAttribute('data-step')).toBe('4')
    expect(closed.textContent).toContain('Also on this step, with no row on the list · 2')
    expect(screen.getByTestId('lien-step-brief-count').textContent).toBe('the office’s step · 2 notices here')
    expect(screen.getByTestId('lien-step-brief-usual').textContent).toBe('Nothing. This one needs nobody.')
    expect(closed.textContent).toContain('owner called Nov 1')
    fireEvent.click(within(closed).getAllByRole('button', { name: 'Open' })[0]!)
    expect(onOpenReminder).toHaveBeenCalledTimes(1)
    expect(onOpenReminder.mock.calls[0]![0].jobId).toBe('j9')
    expect(onAct).not.toHaveBeenCalled()
    // Press it again: every row is back.
    fireEvent.click(screen.getByTestId('lien-step-reminder-4'))
    expect(screen.queryByTestId('lien-reminder-step-list')).toBeNull()
    expect(screen.queryByTestId('lien-step-brief')).toBeNull()
  })
  it('with the desk’s facts the brief draws the picked notice’s dated timeline, the today band with the usual press, Show another, and why these are here as counts (PR 2 of #274)', () => {
    const rowsFor = (jobId: string) => [
      { key: 'mailed', kind: 'law' as const, from: '2026-10-14', dayFrom: 0, title: `The lien notice was mailed to the owner and the GC (${jobId}).`, detail: 'Day 0 counts from the day the run recorded it, Oct 14.', chip: 'legal requirement', status: 'done' as const, statusWords: '✓ done', next: '23 days ago · the clock started' },
      { key: 'letter', kind: 'letter' as const, from: '2026-10-24', to: '2026-10-28', dayFrom: 10, dayTo: 14, title: 'The attorney’s letter should go in this window: the stronger letter our attorney wrote.', detail: 'Counsel’s rule, 10 to 14 days after the notice.', chip: 'attorney’s letter', status: 'late' as const, statusWords: 'late · act now', next: '9 days past the window · it still goes, weaker each day' },
      { key: 'today', kind: 'today' as const, from: '2026-11-06', dayFrom: 23, title: 'You are here. Nothing has been paid or answered, and the attorney’s letter has not gone.', detail: '', chip: '', status: 'now' as const, statusWords: 'now', next: '' },
      { key: 'lien', kind: 'law' as const, from: '2026-11-16', dayFrom: 33, title: 'The lien must be on file at the county by this day, or the right to it is lost.', detail: '§ 53.052.', chip: 'legal requirement', status: 'deadline' as const, statusWords: 'deadline · in 10 days', next: 'miss it and the lien is lost for good' },
    ]
    const withWhy = { ...reminders, rows: reminders.rows.map((r) => ({ ...r, why: r.step === 1 ? (r.counted ? 'nothing since the packet' : 'before day 7') : r.words })) }
    render(<LienDeskNextUp rows={rows} loading={false} isMobile={false} onAct={() => {}} reminders={withWhy} timelineFor={rowsFor} />)
    fireEvent.click(screen.getByTestId('lien-step-reminder-1'))
    const tl = screen.getByTestId('lien-notice-timeline')
    expect(screen.queryByTestId('lien-schedule-strip')).toBeNull()
    expect(Array.from(tl.querySelectorAll('[data-lien-timeline-row]')).map((el) => `${el.getAttribute('data-lien-timeline-row')}:${el.getAttribute('data-status') ?? 'now'}`)).toEqual(['mailed:done', 'letter:late', 'today:now', 'lien:deadline'])
    expect(tl.textContent).toContain('Oct 24 → Oct 28')
    expect(tl.textContent).toContain('day 10 to day 14')
    expect(tl.textContent).toContain('late · act now')
    expect(tl.textContent).toContain('9 days past the window · it still goes, weaker each day')
    // The today band carries the brief's usual press and the first two fallbacks, and says the press is on the row.
    expect(screen.getByTestId('lien-notice-timeline-action').textContent).toContain('Send a courtesy notice · the office presses it · sends the email and the text in one press; it takes a minute · the press is on the row below')
    // The picker lists the step's notices, the first picked; picking another asks the desk for its rows.
    const pick = screen.getByTestId('lien-notice-timeline-pick') as HTMLSelectElement
    expect(Array.from(pick.options).map((o) => o.textContent)).toEqual(['744 · Castell', '752 · Pecan Grove', '760 · Harlan Homes'])
    expect(tl.textContent).toContain('(j1)')
    fireEvent.change(pick, { target: { value: 'j5' } })
    expect(screen.getByTestId('lien-notice-timeline').textContent).toContain('(j5)')
    // Why these are here, as counts of the step's own notices.
    expect(screen.getByTestId('lien-step-brief-why').textContent).toBe('2 · nothing since the packet')
  })
  it('without a desk door the Open press opens the notice under Sent through onAct', () => {
    const onAct = vi.fn()
    render(<LienDeskNextUp rows={rows} loading={false} isMobile={false} onAct={onAct} reminders={reminders} />)
    fireEvent.click(screen.getByTestId('lien-step-reminder-3'))
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    expect(onAct.mock.calls[0]![0].target).toEqual({ open: 'notices', jobId: 'j8', pile: 'sent' })
  })
  it('a notice paying it down (PR 3 of #274): its row asks what they promised, and the pressed step 2 brief reads the payment’s words with the press on the today band', () => {
    const paying = { jobId: 'j7', title: '741 · Ridgeway', step: 2 as const, state: 'paying' as const, words: 'paying it down · $4,000 paid Nov 3 · $8,045 still owed', day: 20, counted: true, why: 'paying it down' }
    const withPaying = { ...reminders, rows: reminders.rows.map((r) => (r.jobId === 'j7' ? paying : r)) }
    const promiseRow = row({ key: 'promise:j7', jobId: 'j7', title: '741 · Ridgeway', action: 'promise', button: 'Record what they promised', sub: paying.words, dueOn: null, daysLeft: null, severity: 'amber', target: { open: 'notices', jobId: 'j7', pile: 'sent' }, reminder: paying })
    const rowsFor = () => [
      { key: 'mailed', kind: 'law' as const, from: '2026-10-14', dayFrom: 0, title: 'The lien notice was mailed to the owner and the GC.', detail: '', chip: 'legal requirement', status: 'done' as const, statusWords: '✓ done', next: '23 days ago · the clock started' },
      { key: 'pay:2026-11-03:0', kind: 'payment' as const, from: '2026-11-03', dayFrom: 20, title: '$4,000 paid · $8,045 still owed.', detail: '', chip: 'payment', status: 'paying' as const, statusWords: 'paying', next: '3 days ago · reminders paused until Nov 10' },
      { key: 'today', kind: 'today' as const, from: '2026-11-06', dayFrom: 23, title: 'You are here. They are paying it down. The attorney’s letter waits while they pay.', detail: '', chip: '', status: 'now' as const, statusWords: 'now', next: '' },
    ]
    const onAct = vi.fn()
    render(<LienDeskNextUp rows={[...rows, promiseRow]} loading={false} isMobile={false} onAct={onAct} reminders={withPaying} timelineFor={rowsFor} />)
    const group = screen.getByRole('region', { name: 'Reminders' })
    fireEvent.click(within(group).getByRole('button', { name: 'Record what they promised' }))
    expect(onAct.mock.calls[0]![0]).toMatchObject({ action: 'promise', jobId: 'j7' })
    fireEvent.click(screen.getByTestId('lien-step-reminder-2'))
    expect(screen.getByTestId('lien-step-brief-usual').textContent).toContain('Record what they promised · the office presses it · the date and the amount they gave for the rest; the desk asks again on that date')
    expect(screen.getByTestId('lien-step-brief').textContent).toContain('A partial payment is an answer')
    expect(Array.from(screen.getByTestId('lien-step-brief-instead').querySelectorAll('strong')).map((el) => el.textContent)).toEqual(['Send the attorney’s letter', 'Record the owner’s call', 'The GC authorized direct pay'])
    expect(screen.getByTestId('lien-notice-timeline-action').textContent).toContain('Record what they promised')
    expect(screen.getByTestId('lien-notice-timeline').textContent).toContain('reminders paused until Nov 10')
    expect(screen.getByTestId('lien-step-brief-why').textContent).toBe('1 · paying it down')
  })
  it('at 375 wide the rail stacks, a courtesy card wears the four reminder tiles in violet, and the step’s list is one column with a full-width Open', () => {
    render(<LienDeskNextUp rows={rows} loading={false} isMobile onAct={() => {}} reminders={reminders} />)
    expect(screen.getByTestId('lien-step-rail-reminder')).toBeTruthy()
    const card = document.querySelector('[data-lien-next-up-row="courtesy:j1"]') as HTMLElement
    const stepRow = within(card).getByTestId('lien-step-row')
    expect(stepRow.getAttribute('data-ladder')).toBe('reminder')
    expect(Array.from(stepRow.querySelectorAll('.lienStepTile')).map((t) => `${t.textContent}:${t.getAttribute('data-state')}`)).toEqual(['youDue:now', ' Sent:todo', ' Attorney’s letter:todo', ' Closed:todo'])
    fireEvent.click(screen.getByTestId('lien-step-reminder-2'))
    expect((within(screen.getByTestId('lien-reminder-step-list')).getByRole('button', { name: 'Open' }) as HTMLButtonElement).style.width).toBe('100%')
  })
  it('without the kernel’s counts the rail shows only when a row stands on it, from the rows themselves', () => {
    render(<LienDeskNextUp rows={[rows[0]!]} loading={false} isMobile={false} onAct={() => {}} />)
    expect(screen.queryByTestId('lien-step-rail-reminder')).toBeNull()
    cleanup()
    render(<LienDeskNextUp rows={rows} loading={false} isMobile={false} onAct={() => {}} />)
    expect(screen.getByTestId('lien-step-count-reminder-1').textContent).toBe('2')
  })
})
