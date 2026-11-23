// @vitest-environment jsdom
/**
 * The Lien desk's Next up list (punch list #82, PR 2): the two groups, a row's tag, words, day
 * and button, a row with no move for this viewer, the empty line, and the cards on a phone.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import LienDeskNextUp, { lienKindTagStyle, lienNextUpDueWords, lienPaperDoorStyle } from './LienDeskNextUp'
import type { LienNextUpRow } from '../../lib/jobs/lienNextUp'
import { LIEN_PHONE_PRESS_MIN_HEIGHT, LIEN_PHONE_QUIET_MIN_HEIGHT, lienPhoneRowColumns } from '../../lib/jobs/lienPhonePress'

afterEach(cleanup)

const row = (over: Partial<LienNextUpRow>): LienNextUpRow => ({
  key: 'notice:j1', kind: 'notice', jobId: 'j1', gcId: 'gc1', title: '650 · AXO Schertz', sub: 'Notice to send', dueOn: '2026-10-09', daysLeft: 4, severity: 'red', group: 'now', action: 'draft', button: 'Open the notice', target: { open: 'notices', jobId: 'j1', pile: 'to_draft' }, ...over,
})

describe('LienDeskNextUp', () => {
  it('draws Needs you now and Coming up, each row with its tag, words, day and one button', () => {
    const onAct = vi.fn()
    const rows = [
      row({}),
      row({ key: 'run:gc1', jobId: null, title: 'Lowbeck Contracting', sub: '2 notices approved · to print', action: 'send_run', button: 'Print and mail 2', target: { open: 'run', gcId: 'gc1' } }),
      row({ key: 'affidavit:j2', kind: 'affidavit', jobId: 'j2', title: '977 · Stonewick', sub: 'Affidavit approved · ready to file', dueOn: '2026-11-16', daysLeft: 42, severity: 'quiet', group: 'coming', action: 'file_affidavit', button: 'File the affidavit', target: { open: 'affidavits', jobId: 'j2' } }),
    ]
    render(<LienDeskNextUp rows={rows} loading={false} isMobile={false} onAct={onAct} />)
    const now = screen.getByRole('region', { name: 'Needs you now' })
    expect(now.textContent).toContain('Needs you now · 2')
    expect(screen.getByRole('region', { name: 'Coming up' }).textContent).toContain('Coming up · 1')
    const first = document.querySelector('[data-lien-next-up-row="notice:j1"]') as HTMLElement
    expect(first.textContent).toContain('Notice')
    expect(first.textContent).toContain('650 · AXO Schertz')
    // The day both rows share is on the head (v2.7372), so no row says it again.
    expect(now.querySelector('[data-lien-next-up-head-day]')!.textContent).toBe('due Fri Oct 9 · 4 days left')
    expect(first.textContent).not.toContain('Oct 9')
    fireEvent.click(within(first).getByRole('button', { name: 'Open the notice' }))
    expect(onAct).toHaveBeenCalledTimes(1)
    expect(onAct.mock.calls[0]![0].key).toBe('notice:j1')
    fireEvent.click(within(now).getByRole('button', { name: 'Print and mail 2' }))
    expect(onAct.mock.calls[1]![0].target).toEqual({ open: 'run', gcId: 'gc1' })
  })

  it('a chip that opens its paper is the same size and weight as a plain one (v2.7442)', () => {
    // A whole `font` set after the chip's size wiped it in the browser, so the door drew at the row's size; the test
    // browser ignores `font: inherit`, so the style itself is what is held here.
    for (const kind of ['notice', 'affidavit'] as const) {
      const door = lienPaperDoorStyle(kind, false)
      const plain = lienKindTagStyle(kind)
      expect(Object.keys(door)).not.toContain('font')
      expect([door.fontSize, door.fontWeight, door.lineHeight]).toEqual([plain.fontSize, plain.fontWeight, plain.lineHeight])
      expect(door.fontFamily).toBe('inherit')
    }
    // The drawn door wears it.
    render(<LienDeskNextUp rows={[row({})]} loading={false} isMobile={false} onAct={vi.fn()} onOpenPaper={vi.fn()} gapsFor={() => 0} />)
    const drawn = screen.getByTestId('lien-next-up-paper-j1-notice')
    expect([drawn.style.fontSize, drawn.style.fontWeight]).toEqual(['0.68rem', '700'])
  })

  it('a row with no move for this viewer still opens: the button reads Open, and a press on the row opens it too', () => {
    const onAct = vi.fn()
    render(<LienDeskNextUp rows={[row({ action: 'approve', button: null, sub: 'Waiting on the leader' })]} loading={false} isMobile={false} onAct={onAct} />)
    expect(screen.getByRole('button', { name: 'Open' })).toBeTruthy()
    fireEvent.click(document.querySelector('[data-lien-next-up-row="notice:j1"]') as HTMLElement)
    expect(onAct).toHaveBeenCalledTimes(1)
  })

  it('nothing to do reads calm and points at the Calendar; a phone row’s press fills its one column and is a fingertip tall', () => {
    const view = render(<LienDeskNextUp rows={[]} loading={false} isMobile={false} onAct={() => {}} />)
    expect((document.querySelector('[data-lien-next-up="empty"]') as HTMLElement).textContent).toContain('Nothing needs you right now.')
    view.unmount()
    render(<LienDeskNextUp rows={[row({})]} loading={false} isMobile onAct={() => {}} />)
    const press = screen.getByRole('button', { name: 'Open the notice' }) as HTMLButtonElement
    // Until 2026-11-23 the press was as wide as its words and 40 px tall, on a line of its own (punch list #352, PR 3).
    expect(press.style.width).toBe('100%')
    expect(press.style.minHeight).toBe(`${LIEN_PHONE_PRESS_MIN_HEIGHT}px`)
    expect(press.style.whiteSpace).toBe('normal')
  })

  it('a phone’s row is two columns: the words at the left, one press at the right, the second way out a quiet line under the words', () => {
    const held = row({ key: 'affidavit:h', kind: 'affidavit', jobId: 'h', title: '2051 · Lakeside Remodel', sub: 'Affidavit · nobody has answered whether this home is a homestead', action: 'fix_property', button: 'Answer the homestead question', doors: [{ words: 'Not lienable…', target: { open: 'affidavits', jobId: 'h' } }] })
    const plain = row({ key: 'notice:p', jobId: 'p', title: '2041 · Ridgeway Builders' })
    const onAct = vi.fn()
    render(<LienDeskNextUp rows={[held, plain]} loading={false} isMobile onAct={onAct} amountFor={() => 450} />)
    const heldRow = document.querySelector('[data-lien-next-up-row="affidavit:h"]') as HTMLElement
    const plainRow = document.querySelector('[data-lien-next-up-row="notice:p"]') as HTMLElement
    for (const el of [heldRow, plainRow]) {
      expect(el.getAttribute('data-layout')).toBe('columns')
      expect(el.className).toContain('lienPhoneRow')
      expect(el.style.gridTemplateColumns).toBe(lienPhoneRowColumns())
      // The press column holds one press, the row's own, and it is the same on every row.
      const direct = Array.from(el.children).filter((c) => c.tagName === 'BUTTON') as HTMLButtonElement[]
      expect(direct).toHaveLength(1)
      expect(direct[0]!.hasAttribute('data-lien-next-up-act')).toBe(true)
      expect(direct[0]!.style.width).toBe('100%')
      expect(direct[0]!.style.minHeight).toBe(`${LIEN_PHONE_PRESS_MIN_HEIGHT}px`)
    }
    // The words: the amount stands on their last line, after the paper's chip and the dots.
    const words = heldRow.querySelector('[data-lien-next-up-words]') as HTMLElement
    const meta = words.querySelector('[data-lien-next-up-meta]') as HTMLElement
    expect(meta.querySelector('[data-lien-next-up-amount]')!.textContent).toBe('$450')
    expect(within(meta).getByTestId('lien-step-mark')).toBeTruthy()
    // The second way out is under the words, never in the press column, and still acts.
    const quiet = words.querySelector('[data-lien-next-up-quiet] [data-lien-next-up-door]') as HTMLButtonElement
    expect(quiet.textContent).toBe('Not lienable…')
    expect(quiet.style.minHeight).toBe(`${LIEN_PHONE_QUIET_MIN_HEIGHT}px`)
    expect(quiet.style.color).toBe('var(--text-link)')
    fireEvent.click(quiet)
    expect(onAct).toHaveBeenCalledTimes(1)
    expect(plainRow.querySelector('[data-lien-next-up-quiet]')).toBeNull()
    // A long press takes its short form on a phone, and keeps its whole name for a reader and a hover.
    const press = heldRow.querySelector(':scope > button') as HTMLButtonElement
    expect(press.textContent).toBe('Answer it')
    expect(press.getAttribute('aria-label')).toBe('Answer the homestead question')
    expect(press.title).toBe('Answer the homestead question')
    cleanup()
    // A computer keeps the whole words and its own two buttons.
    render(<LienDeskNextUp rows={[held]} loading={false} isMobile={false} onAct={() => {}} />)
    expect(screen.getByRole('button', { name: 'Answer the homestead question' }).textContent).toBe('Answer the homestead question')
    expect(document.querySelector('[data-lien-next-up-quiet]')).toBeNull()
    expect(document.querySelector('.lienPhoneRow')).toBeNull()
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
    render(<LienDeskNextUp rows={[row({ action: 'draft', button: 'Open the notice' })]} loading={false} isMobile={false} onAct={() => {}} />)
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
    expect(first.getAttribute('data-layout')).toBe('columns')
    expect(first.querySelector('[data-lien-next-up-amount]')!.textContent).toBe('$8,400')
    // The day is on the head, so the row does not say it again.
    expect(first.querySelector('[data-lien-next-up-sub]')!.textContent).not.toMatch(/Nov 16|days left/)
    // A job with nothing known draws no amount.
    expect(document.querySelector('[data-lien-next-up-row="notice:c"] [data-lien-next-up-amount]')).toBeNull()
    cleanup()
    // A computer keeps the desk's own groups; since v2.7372 its row carries the money too, and a job with nothing known draws none.
    render(<LienDeskNextUp rows={rows} loading={false} isMobile={false} onAct={() => {}} amountFor={(r) => (r.jobId ? owed[r.jobId] ?? null : null)} />)
    expect(Array.from(document.querySelectorAll('[data-lien-next-up-group] h3')).map((h) => h.textContent)).toEqual(['Needs you now · 2', 'Coming up · 1'])
    expect(Array.from(document.querySelectorAll('[data-lien-next-up-amount]')).map((el) => el.textContent)).toEqual(['$8,400', '$6,125'])
    expect(document.querySelector('[data-lien-next-up-row="notice:c"] [data-lien-next-up-amount]')).toBeNull()
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
    const rows = [row({}), row({ key: 'run:gc1', jobId: null, title: 'Lowbeck Contracting', sub: '2 notices approved · to print', action: 'send_run', button: 'Print and mail 2', target: { open: 'run', gcId: 'gc1' } })]
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
  it('with zoomFor the number is its own press to the paper’s stage (v2.7333) and the name stays the job’s door; a row the Board has no chip for keeps the one door', () => {
    const onAct = vi.fn()
    const onOpenJob = vi.fn()
    const press = vi.fn()
    const rows = [row({}), row({ key: 'notice:j2', jobId: 'j2', title: '651 · Tune 5' })]
    render(<LienDeskNextUp rows={rows} loading={false} isMobile={false} onAct={onAct} onOpenJob={onOpenJob} zoomFor={(r) => (r.jobId === 'j1' ? { press, words: 'Open the notice' } : null)} />)
    const zoom = screen.getByTestId('lien-next-up-zoom-j1')
    expect(zoom.textContent).toBe('650')
    expect(zoom.getAttribute('title')).toBe('Open the notice')
    fireEvent.click(zoom)
    expect(press).toHaveBeenCalledTimes(1)
    expect(onAct).not.toHaveBeenCalled()
    const name = screen.getByTestId('lien-next-up-job-j1')
    expect(name.textContent).toBe('AXO Schertz')
    fireEvent.click(name)
    expect(onOpenJob).toHaveBeenCalledWith('j1')
    expect(screen.queryByTestId('lien-next-up-zoom-j2')).toBeNull()
    expect(screen.getByTestId('lien-next-up-job-j2').textContent).toBe('651 · Tune 5')
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
    fireEvent.click(screen.getByRole('button', { name: 'Open the notice' }))
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
      row({ key: 'run:gc1', jobId: null, title: 'Lowbeck Contracting', action: 'send_run', button: 'Print and mail 2', target: { open: 'run', gcId: 'gc1' } }),
      row({ key: 'retainage:j3', jobId: 'j3', kind: 'retainage', title: '700 · Retainage', action: 'draft', button: 'Open the notice', target: { open: 'retainage', jobId: 'j3' } }),
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
    key: 'run:printed', jobId: null, gcId: null, title: '19 notices printed Oct 7', sub: 'Mailed? Type each envelope’s number. Not mailing them? Take the run back.', action: 'record_mailing', button: 'Enter mail numbers', target: { open: 'run', gcId: null },
    secondary: { words: 'Take back…', target: { open: 'run', gcId: null, takeBack: true } },
    jobs: [{ jobId: 'j2', title: '712 · Cedar Park', dueOn: '2026-10-15' }, { jobId: 'j3', title: '715 · Leander', dueOn: '2026-11-15' }],
  })
  it('one row tagged Run, two buttons, its jobs folded until pressed, each a door to its job', () => {
    const onAct = vi.fn()
    const onOpenJob = vi.fn()
    render(<LienDeskNextUp rows={[run]} loading={false} isMobile={false} onAct={onAct} onOpenJob={onOpenJob} />)
    const el = document.querySelector('[data-lien-next-up-row="run:printed"]') as HTMLElement
    expect(el.textContent).toContain('Run')
    expect(el.textContent).toContain('19 notices printed Oct 7')
    fireEvent.click(within(el).getByRole('button', { name: 'Take back…' }))
    expect(onAct.mock.calls[0]![0].target).toEqual({ open: 'run', gcId: null, takeBack: true })
    fireEvent.click(within(el).getByRole('button', { name: 'Enter mail numbers' }))
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
  it('the find opens the fold; a phone draws the run’s second press as a quiet line under the words, and its jobs across the whole row', () => {
    render(<LienDeskNextUp rows={[run]} loading={false} isMobile onAct={() => {}} foldsOpen />)
    const body = document.querySelector('[data-lien-next-up-fold-body="run:printed"]') as HTMLElement
    expect(body).toBeTruthy()
    const back = screen.getByRole('button', { name: 'Take back…' }) as HTMLButtonElement
    expect(back.style.minHeight).toBe(`${LIEN_PHONE_QUIET_MIN_HEIGHT}px`)
    expect(back.closest('[data-lien-next-up-quiet]')).toBeTruthy()
    // The fold is the row's own last line, across both columns, so the jobs have the row's whole width.
    expect((body.parentElement as HTMLElement).style.gridColumn).toBe('1 / -1')
    expect(body.closest('[data-lien-next-up-words]')).toBeNull()
  })
})

describe('LienDeskNextUp · only you can approve, first (punch list #101 PR 3)', () => {
  it('the leader’s approvals lead under their own title; the office’s stand under the leader’s name, above the rows on track (v2.7371; last until then)', () => {
    const approve = row({ key: 'notice:j2', jobId: 'j2', title: '744 · Pecan St', action: 'approve', button: 'Approve', sub: 'Waiting on your approval', dueOn: '2026-11-15', daysLeft: 41, severity: 'quiet', group: 'coming' })
    render(<LienDeskNextUp rows={[row({}), approve]} loading={false} isMobile={false} onAct={() => {}} />)
    const titles = Array.from(document.querySelectorAll('[data-lien-next-up-group] h3')).map((h) => h.textContent)
    expect(titles).toEqual(['Only you can approve · 1', 'Needs you now · 1'])
    cleanup()
    render(<LienDeskNextUp rows={[row({}), { ...approve, button: null, sub: 'Waiting on Sam' }]} loading={false} isMobile={false} onAct={() => {}} waitingOn="Sam" />)
    // One head over the parts, then each part's own: the approvals that wait, then what is on track.
    expect((document.querySelector('[data-lien-next-up-now-head]') as HTMLElement).textContent).toBe('Needs you now · 1and 1 waiting on Sam to approve')
    expect(Array.from(document.querySelectorAll('[data-lien-next-up-group]')).map((g) => [g.getAttribute('data-lien-next-up-group'), g.getAttribute('data-part'), g.querySelector('h4')?.textContent])).toEqual([
      ['waiting', 'yes', 'Waiting on Sam to approve · 1'],
      ['now', 'yes', 'On track · 1'],
    ])
  })
})

describe('LienDeskNextUp · Needs you now in three parts (v2.7371, punch list #362 step 2)', () => {
  const owner = row({ key: 'notice:j1', jobId: 'j1', title: '372 · ZZ Cedar Row', sub: 'Needs the owner of record', action: 'find_owner', button: 'Find the owner' })
  const facts = row({ key: 'affidavit:j9', kind: 'affidavit', jobId: 'j9', title: '1077 · ZZ Locks', sub: 'Affidavit · the property record is not complete', action: 'fix_property', button: 'Fix the property' })
  const waits = row({ key: 'notice:j2', jobId: 'j2', title: '891 · ZZ Builders', action: 'approve', button: null, sub: 'Waiting on Sam · since Oct 7' })
  const small = row({ key: 'affidavit:j3', kind: 'affidavit', jobId: 'j3', title: '1052 · ZZ Sample Rd', sub: 'Affidavit approved · ready to file', action: 'file_affidavit', button: 'File the affidavit' })
  const big = row({ key: 'affidavit:j4', kind: 'affidavit', jobId: 'j4', title: '1024 · ZZ Marlow', sub: 'Affidavit approved · ready to file', action: 'file_affidavit', button: 'File the affidavit' })
  const later = row({ key: 'notice:j5', jobId: 'j5', title: '1123 · ZZ Lake Dr', dueOn: '2026-11-16', daysLeft: 42, severity: 'quiet', group: 'coming' })
  const risk = (r: LienNextUpRow) => ({ 'notice:j1': 4, 'affidavit:j9': 3 })[r.key] ?? null
  const amountFor = (r: LienNextUpRow) => ({ j3: 610, j4: 9400 })[r.jobId ?? ''] ?? null
  const rows = [small, owner, waits, big, facts, later]
  const riskLabel = (n: number) => `Will not make tomorrow as ${n === 1 ? 'it stands' : 'they stand'}`
  const parts = () => Array.from(document.querySelectorAll('[data-lien-next-up-group]')).map((g) => [g.getAttribute('data-lien-next-up-group'), (g.querySelector('h4, h3') as HTMLElement).textContent, Array.from(g.querySelectorAll('[data-lien-next-up-row]')).map((r) => r.getAttribute('data-lien-next-up-row'))])

  it('first what will not make its day, the longest road first; then waiting on the leader; then on track, largest first; Coming up follows', () => {
    render(<LienDeskNextUp rows={rows} loading={false} isMobile={false} onAct={() => {}} waitingOn="Sam" risk={risk} riskLabel={riskLabel} amountFor={amountFor} />)
    expect((document.querySelector('[data-lien-next-up-now-head]') as HTMLElement).textContent).toBe('Needs you now · 4and 1 waiting on Sam to approve')
    expect(parts()).toEqual([
      ['risk', 'Will not make tomorrow as they stand · 2', ['notice:j1', 'affidavit:j9']],
      ['waiting', 'Waiting on Sam to approve · 1', ['notice:j2']],
      ['now', 'On track · 2', ['affidavit:j4', 'affidavit:j3']],
      ['coming', 'Coming up · 1', ['notice:j5']],
    ])
    // The head stands once, before the first part.
    expect(document.querySelectorAll('[data-lien-next-up-now-head]')).toHaveLength(1)
    expect(document.querySelector('[data-lien-next-up-group="coming"]')!.getAttribute('data-part')).toBeNull()
  })

  it('the waiting head carries one press that reminds the leader; dead it reads why and does nothing; busy it says so', () => {
    const onPress = vi.fn()
    const view = render(<LienDeskNextUp rows={rows} loading={false} isMobile={false} onAct={() => {}} waitingOn="Sam" risk={risk} remind={{ button: 'Remind Sam of 1 paper', dead: false, onPress }} />)
    const press = () => document.querySelector('[data-lien-next-up-remind]') as HTMLButtonElement
    expect(press().textContent).toBe('Remind Sam of 1 paper')
    // It sits on the waiting head and nowhere else, and the head keeps its own words.
    expect(document.querySelectorAll('[data-lien-next-up-remind]')).toHaveLength(1)
    expect(document.querySelector('[data-lien-next-up-group="waiting"]')!.contains(press())).toBe(true)
    expect((document.querySelector('[data-lien-next-up-group="waiting"] h4') as HTMLElement).textContent).toBe('Waiting on Sam to approve · 1')
    fireEvent.click(press())
    expect(onPress).toHaveBeenCalledTimes(1)
    view.rerender(<LienDeskNextUp rows={rows} loading={false} isMobile={false} onAct={() => {}} waitingOn="Sam" risk={risk} remind={{ button: 'Reminded at 2:14 PM', dead: true, onPress }} />)
    expect(press().textContent).toBe('Reminded at 2:14 PM')
    expect(press().disabled).toBe(true)
    fireEvent.click(press())
    expect(onPress).toHaveBeenCalledTimes(1)
    view.rerender(<LienDeskNextUp rows={rows} loading={false} isMobile={false} onAct={() => {}} waitingOn="Sam" risk={risk} remind={{ button: 'Remind Sam of 1 paper', dead: false, busy: true, onPress }} />)
    expect(press().textContent).toBe('Reminding…')
    expect(press().disabled).toBe(true)
  })

  it('with no press handed in the waiting head is words alone, and a desk with nothing at risk or waiting keeps its one head', () => {
    const view = render(<LienDeskNextUp rows={rows} loading={false} isMobile={false} onAct={() => {}} waitingOn="Sam" risk={risk} />)
    expect(document.querySelector('[data-lien-next-up-remind]')).toBeNull()
    view.unmount()
    render(<LienDeskNextUp rows={[small, big, later]} loading={false} isMobile={false} onAct={() => {}} risk={() => null} />)
    expect(document.querySelector('[data-lien-next-up-now-head]')).toBeNull()
    expect(Array.from(document.querySelectorAll('[data-lien-next-up-group] h3')).map((h) => h.textContent)).toEqual(['Needs you now · 2', 'Coming up · 1'])
  })

  it('on a phone the rows at risk lead their day, the waiting rows follow the days that need a person, and the press sits under their head a thumb tall', () => {
    const onPress = vi.fn()
    render(<LienDeskNextUp rows={rows} loading={false} isMobile onAct={() => {}} waitingOn="Sam" risk={risk} amountFor={amountFor} remind={{ button: 'Remind Sam of 1 paper', dead: false, onPress }} />)
    const groups = Array.from(document.querySelectorAll('[data-lien-phone-group]')).map((g) => [g.getAttribute('data-lien-phone-group'), Array.from(g.querySelectorAll('[data-lien-next-up-row]')).map((r) => r.getAttribute('data-lien-next-up-row'))])
    expect(groups).toEqual([
      ['day:2026-10-09', ['notice:j1', 'affidavit:j9', 'affidavit:j4', 'affidavit:j3']],
      ['waiting', ['notice:j2']],
      ['day:2026-11-16', ['notice:j5']],
    ])
    const press = document.querySelector('[data-lien-next-up-remind]') as HTMLButtonElement
    expect(press.style.minHeight).toBe('40px')
    expect(document.querySelector('[data-lien-phone-group="waiting"]')!.contains(press)).toBe(true)
    fireEvent.click(press)
    expect(onPress).toHaveBeenCalledTimes(1)
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
      { words: 'Change the last day of work…', target: { open: 'lien_window', jobId: 'j1', tab: 'notice', openLastWork: true } },
    ],
  })
  it('draws each door as its own press, each acting on the row with that door’s target, beside the draft press', () => {
    const onAct = vi.fn()
    render(<LienDeskNextUp rows={[owed]} loading={false} isMobile={false} onAct={onAct} />)
    const el = document.querySelector('[data-lien-next-up-row="notice:j1"]') as HTMLElement
    expect(el.textContent).toContain('September 2026 has no notice.')
    fireEvent.click(within(el).getByRole('button', { name: 'The paper named September 2026 too' }))
    expect(onAct.mock.calls[0]![0].target).toEqual({ open: 'notice_record_months', jobId: 'j1', months: ['2026-09'] })
    fireEvent.click(within(el).getByRole('button', { name: 'Change the last day of work…' }))
    expect(onAct.mock.calls[1]![0].target).toEqual({ open: 'lien_window', jobId: 'j1', tab: 'notice', openLastWork: true })
    fireEvent.click(within(el).getByRole('button', { name: 'Open the notice' }))
    expect(onAct.mock.calls[2]![0].target).toEqual({ open: 'notices', jobId: 'j1', pile: 'to_draft' })
    expect(el.querySelectorAll('[data-lien-next-up-door]')).toHaveLength(2)
  })
})

describe('LienDeskNextUp · a computer’s row in two lines (v2.7372, punch list #362 step 3)', () => {
  const ready = row({ key: 'affidavit:j3', kind: 'affidavit', jobId: 'j3', title: '1052 · ZZ Service Visit, 12 Sample Rd', sub: 'Affidavit approved · ready to file', detail: '', action: 'file_affidavit', button: 'File the affidavit' })
  const facts = row({ key: 'affidavit:j9', kind: 'affidavit', jobId: 'j9', title: '1077 · ZZ Locks', sub: 'Affidavit · nobody has answered whether this home is a homestead', detail: 'Nobody has answered whether this home is a homestead.', action: 'fix_property', button: 'Answer the homestead question' })
  const send = row({ key: 'notice:j1', jobId: 'j1', title: '1110 · ZZ Oak Hollow', sub: 'Notice to send', detail: 'September 2026' })
  const late = row({ key: 'notice:j4', jobId: 'j4', title: '891 · ZZ Builders', sub: 'Notice to send', detail: 'August 2026', dueOn: '2026-10-01', daysLeft: -4 })
  const retainage = row({ key: 'retainage:j5', kind: 'retainage', jobId: 'j5', title: '700 · ZZ Pine St', sub: 'Retainage notice to send' })
  const stageFor = (r: LienNextUpRow) => ({ 'affidavit:j3': 'Ready to file', 'affidavit:j9': 'Needs the property facts', 'notice:j1': 'To send for Master approval', 'notice:j4': 'To send for Master approval' })[r.key] ?? null
  const noticeFor = (r: LienNextUpRow) => (r.key === 'affidavit:j3' ? { tone: 'ok' as const, words: 'Notice sent Oct 14' } : r.key === 'affidavit:j9' ? { tone: 'none' as const, words: 'No notice needed · contracted with the owner' } : null)
  const amountFor = (r: LienNextUpRow) => ({ j3: 610, j9: 240, j1: 2900 })[r.jobId ?? ''] ?? null
  const lineOf = (key: string) => document.querySelector(`[data-lien-next-up-row="${key}"] [data-lien-next-up-line]`) as HTMLElement
  const draw = () => render(<LienDeskNextUp rows={[ready, facts, send, late, retainage]} loading={false} isMobile={false} onAct={() => {}} stageFor={stageFor} noticeFor={noticeFor} amountFor={amountFor} />)

  it('under the job: the Board’s bin, the one thing to know, and where an affidavit’s notice stands; the row carries what it owes', () => {
    // Every row shares Oct 9, so the head carries the day and the lines are the words alone.
    render(<LienDeskNextUp rows={[ready, facts, send, retainage]} loading={false} isMobile={false} onAct={() => {}} stageFor={stageFor} noticeFor={noticeFor} amountFor={amountFor} />)
    expect(document.querySelector('[data-lien-next-up-row="affidavit:j3"]')!.getAttribute('data-layout')).toBe('two-line')
    // The stage says it all for a ready affidavit; its notice rides beside it.
    expect(lineOf('affidavit:j3').textContent).toBe('Ready to fileNotice sent Oct 14')
    expect(lineOf('affidavit:j3').querySelector('[data-lien-next-up-tag]')!.getAttribute('data-lien-next-up-tag')).toBe('ok')
    // The held paper asks its one question, on the row and on its button.
    expect(lineOf('affidavit:j9').textContent).toBe('Needs the property facts · Nobody has answered whether this home is a homestead.No notice needed · contracted with the owner')
    expect(within(document.querySelector('[data-lien-next-up-row="affidavit:j9"]') as HTMLElement).getByRole('button', { name: 'Answer the homestead question' })).toBeTruthy()
    expect(lineOf('notice:j1').textContent).toBe('To send for Master approval · September 2026')
    expect(Array.from(document.querySelectorAll('[data-lien-next-up-amount]')).map((el) => el.textContent)).toEqual(['$610', '$240', '$2,900'])
  })

  it('the bin’s name is the door to the card the dots opened; a row with no bin keeps its dots and its words', () => {
    draw()
    // No dots on a row the Board has a bin for.
    expect(within(document.querySelector('[data-lien-next-up-row="affidavit:j3"]') as HTMLElement).queryByTestId('lien-step-mark')).toBeNull()
    const door = document.querySelector('[data-lien-next-up-stage="affidavit:j3"]') as HTMLButtonElement
    expect(door.textContent).toBe('Ready to file')
    expect(door.getAttribute('aria-label')).toBe('Ready to file: where this stands')
    fireEvent.click(door)
    expect(screen.getByTestId('lien-step-card')).toBeTruthy()
    // Retainage has no bin: its dots stand where the bin's name would, and its words are its own.
    const ret = document.querySelector('[data-lien-next-up-row="retainage:j5"]') as HTMLElement
    expect(within(ret).getByTestId('lien-step-mark')).toBeTruthy()
    expect(ret.querySelector('[data-lien-next-up-stage]')).toBeNull()
    expect(lineOf('retainage:j5').textContent).toContain('Retainage notice to send')
  })

  it('the head carries the day only when every row under it shares it; then a row says its day only when it is another', () => {
    // Four rows due Oct 9 and one four days late: two days, so the head carries none and each row says its own.
    const view = draw()
    expect(document.querySelector('[data-lien-next-up-head-day]')).toBeNull()
    expect(lineOf('notice:j4').querySelector('[data-lien-next-up-due]')!.textContent).toBe('Oct 1 · 4 days late')
    expect(lineOf('affidavit:j3').querySelector('[data-lien-next-up-due]')!.textContent).toBe('Oct 9 · 4 days left')
    view.unmount()
    render(<LienDeskNextUp rows={[ready, facts, send]} loading={false} isMobile={false} onAct={() => {}} stageFor={stageFor} />)
    expect(document.querySelector('[data-lien-next-up-head-day]')!.textContent).toBe('due Fri Oct 9 · 4 days left')
    expect(document.querySelector('[data-lien-next-up-due]')).toBeNull()
  })

  it('one press on the head over the rows on track is the door to the batch print; absent, the head has none', () => {
    const onPress = vi.fn()
    const view = render(<LienDeskNextUp rows={[ready, send]} loading={false} isMobile={false} onAct={() => {}} trackPress={{ button: 'Print 12 for notarization ›', onPress }} />)
    const press = document.querySelector('[data-lien-next-up-track-press]') as HTMLButtonElement
    expect(press.textContent).toBe('Print 12 for notarization ›')
    expect(document.querySelector('[data-lien-next-up-group="now"]')!.contains(press)).toBe(true)
    fireEvent.click(press)
    expect(onPress).toHaveBeenCalledTimes(1)
    view.unmount()
    render(<LienDeskNextUp rows={[ready, send]} loading={false} isMobile={false} onAct={() => {}} />)
    expect(document.querySelector('[data-lien-next-up-track-press]')).toBeNull()
  })

  it('a phone’s row is not the computer’s two lines: its own columns, its dots, no bin name', () => {
    render(<LienDeskNextUp rows={[ready]} loading={false} isMobile onAct={() => {}} stageFor={stageFor} noticeFor={noticeFor} />)
    const phone = document.querySelector('[data-lien-next-up-row="affidavit:j3"]') as HTMLElement
    expect(phone.getAttribute('data-layout')).toBe('columns')
    expect(phone.querySelector('[data-lien-next-up-stage]')).toBeNull()
    expect(within(phone).getByTestId('lien-step-mark')).toBeTruthy()
  })
})

describe('LienDeskNextUp · a computer’s list follows the Board (v2.7456, punch list #362 step 4)', () => {
  const BINS = {
    'notice:to_send': { key: 'notice:to_send', label: 'To send for Master approval', kind: 'notice' as const, order: 1 },
    'notice:awaiting': { key: 'notice:awaiting', label: 'Awaiting Master approval', kind: 'notice' as const, order: 2 },
    'affidavit:ready': { key: 'affidavit:ready', label: 'Ready to file', kind: 'affidavit' as const, order: 10 },
  }
  const binOf: Record<string, keyof typeof BINS> = { 'notice:j1': 'notice:to_send', 'notice:j2': 'notice:awaiting', 'affidavit:j3': 'affidavit:ready', 'affidavit:j4': 'affidavit:ready', 'affidavit:j5': 'affidavit:ready', 'notice:j6': 'notice:to_send' }
  const binFor = (r: LienNextUpRow) => (binOf[r.key] ? BINS[binOf[r.key]!] : null)
  const ready = (id: string, title: string) => row({ key: `affidavit:${id}`, kind: 'affidavit', jobId: id, title, sub: 'Affidavit approved · ready to file', detail: '', action: 'file_affidavit', button: 'File the affidavit', target: { open: 'affidavits', jobId: id } })
  const rows = [
    ready('j3', '1024 · ZZ Marlow, main house'),
    ready('j4', '1031 · ZZ Marlow, hilltop'),
    ready('j5', '1044 · ZZ Oak Hollow, barn'),
    row({ key: 'notice:j2', jobId: 'j2', title: '1101 · ZZ Builders, lot 7', sub: 'Waiting on Malachi', detail: 'Sent for approval Oct 5', action: 'approve', button: null }),
    row({}),
    row({ key: 'notice:j6', jobId: 'j6', title: '1123 · ZZ Service Visit', dueOn: '2026-11-16', daysLeft: 42, severity: 'quiet', group: 'coming' }),
  ]
  const folds = [{ bin: 'affidavit:ready', action: 'file_affidavit' as const, title: (n: number) => `${n} affidavits approved and ready to file`, sub: 'One stack for the notary, then the county clerk.', button: 'Print 3 for notarization ›', target: { open: 'affidavit_pile' as const, pile: 'ready' as const } }]
  const amountFor = (r: Pick<LienNextUpRow, 'jobId'>) => ({ j1: 900, j2: 1200, j3: 9400, j4: 6100, j5: 5200, j6: 700 })[r.jobId ?? ''] ?? null
  const draw = (over: Partial<Parameters<typeof LienDeskNextUp>[0]> = {}) => render(<LienDeskNextUp rows={rows} loading={false} isMobile={false} onAct={vi.fn()} waitingOn="Malachi" amountFor={amountFor} stageFor={(r) => binFor(r)?.label ?? null} byBin={{ binFor, folds }} {...over} />)

  it('one group a bin in the Board’s order, each head with its papers and what they owe, under one head for what needs you now', () => {
    draw()
    // The head names its unit and says where the rest are (the owner's pick of 2026-11-18): five papers now, one under Later.
    expect(document.querySelector('[data-lien-next-up-now-head]')!.textContent).toBe('Needs you now · 5 papers1 more under Later')
    expect(document.querySelector('[data-lien-next-up-now-later]')!.textContent).toBe('1 more under Later')
    expect(document.querySelector('[data-lien-next-up-now-total]')!.textContent).toBe('$22,800')
    const heads = Array.from(document.querySelectorAll('[data-lien-next-up-part-head]')).map((h) => h.textContent)
    expect(heads).toEqual(['To send for Master approval · 1 notice', 'Awaiting Master approval · 1 notice · waiting on Malachi', 'Ready to file · 3 affidavits'])
    expect(Array.from(document.querySelectorAll('[data-lien-next-up-bin]')).map((el) => el.getAttribute('data-lien-next-up-bin'))).toEqual(['notice:to_send', 'notice:awaiting', 'affidavit:ready'])
    expect(document.querySelector('[data-lien-next-up-bin="affidavit:ready"] [data-lien-next-up-group-total]')!.textContent).toBe('$20,700')
    // Under its bin's own head a row says the one thing to know, not the bin again, and not the day the head carries.
    const waitingRow = document.querySelector('[data-lien-next-up-row="notice:j2"]') as HTMLElement
    expect(waitingRow.querySelector('[data-lien-next-up-stage]')).toBeNull()
    expect(waitingRow.querySelector('[data-lien-next-up-line]')!.textContent).toBe('Sent for approval Oct 5')
    expect(document.querySelector('[data-lien-next-up-row="notice:j1"] [data-lien-next-up-line]')!.textContent).toBe('Notice to send')
  })

  it('the three ready affidavits are one row with one press, their jobs behind a fold with what each owes', () => {
    const onAct = vi.fn()
    draw({ onAct })
    const bin = document.querySelector('[data-lien-next-up-bin="affidavit:ready"]') as HTMLElement
    expect(bin.querySelectorAll('[data-lien-next-up-row]')).toHaveLength(1)
    const fold = bin.querySelector('[data-lien-next-up-row="fold:affidavit:ready:file_affidavit"]') as HTMLElement
    expect(fold.textContent).toContain('Affidavits')
    expect(fold.textContent).toContain('3 affidavits approved and ready to file')
    expect(fold.querySelector('[data-lien-next-up-amount]')!.textContent).toBe('$20,700')
    expect(fold.querySelector('[data-lien-next-up-run-sub]')!.textContent).toBe('One stack for the notary, then the county clerk.')
    expect(fold.querySelector('[data-lien-next-up-fold-body]')).toBeNull()
    fireEvent.click(within(fold).getByRole('button', { name: /The 3 jobs/ }))
    const body = fold.querySelector('[data-lien-next-up-fold-body]') as HTMLElement
    expect(body.textContent).toContain('1024 · ZZ Marlow, main house')
    expect(Array.from(body.querySelectorAll('[data-lien-next-up-fold-amount]')).map((el) => el.textContent)).toEqual(['$9,400', '$6,100', '$5,200'])
    fireEvent.click(within(fold).getByRole('button', { name: 'Print 3 for notarization ›' }))
    expect(onAct.mock.calls[0]![0].target).toEqual({ open: 'affidavit_pile', pile: 'ready' })
  })

  it('the reminder press sits on the bin whose papers wait on the leader, and the print door is the fold’s, not a head’s', () => {
    const onPress = vi.fn()
    draw({ remind: { button: 'Remind Malachi of 1 paper', dead: false, onPress }, trackPress: { button: 'Print 3 for notarization ›', onPress: vi.fn() } })
    const waiting = document.querySelector('[data-lien-next-up-bin="notice:awaiting"]') as HTMLElement
    fireEvent.click(within(waiting).getByRole('button', { name: 'Remind Malachi of 1 paper' }))
    expect(onPress).toHaveBeenCalledTimes(1)
    expect(document.querySelectorAll('[data-lien-next-up-remind]')).toHaveLength(1)
    expect(document.querySelector('[data-lien-next-up-track-press]')).toBeNull()
  })

  it('everything due later waits under one line, folded; a press, a find or a pressed bin opens it', () => {
    const view = draw()
    const later = screen.getByRole('region', { name: 'Later' })
    expect(later.textContent).toContain('Later · 1 paper')
    expect(later.querySelector('[data-lien-next-up-later]')!.textContent).toContain('To send for Master approval, notices 1')
    expect(later.querySelector('[data-lien-next-up-row]')).toBeNull()
    fireEvent.click(within(later).getByRole('button', { name: '▸ Show the 1' }))
    expect(later.querySelector('[data-lien-next-up-row="notice:j6"]')).toBeTruthy()
    // Later holds rows of many bins, so each keeps its bin's name.
    expect(later.querySelector('[data-lien-next-up-row="notice:j6"] [data-lien-next-up-stage]')!.textContent).toBe('To send for Master approval')
    fireEvent.click(within(later).getByRole('button', { name: '▾ Hide them' }))
    expect(later.querySelector('[data-lien-next-up-row]')).toBeNull()
    view.unmount()
    draw({ byBin: { binFor, folds, narrowed: true } })
    expect(screen.getByRole('region', { name: 'Later' }).querySelector('[data-lien-next-up-row="notice:j6"]')).toBeTruthy()
    expect(document.querySelector('[data-lien-next-up-later-press]')).toBeNull()
  })

  it('a row with nothing else to say keeps its bin’s name under the bin’s head, since the name opens its card', () => {
    render(<LienDeskNextUp rows={[ready('j3', '1024 · ZZ Marlow, main house')]} loading={false} isMobile={false} onAct={vi.fn()} stageFor={(r) => binFor(r)?.label ?? null} byBin={{ binFor }} />)
    expect(document.querySelector('[data-lien-next-up-row="affidavit:j3"] [data-lien-next-up-stage]')!.textContent).toBe('Ready to file')
  })

  it('with nothing due now, Later is open: the list is never one folded line', () => {
    render(<LienDeskNextUp rows={[rows[5]!]} loading={false} isMobile={false} onAct={vi.fn()} byBin={{ binFor }} />)
    expect(document.querySelector('[data-lien-next-up-now-head]')).toBeNull()
    expect(document.querySelector('[data-lien-next-up-row="notice:j6"]')).toBeTruthy()
  })

  it('a phone keeps its list by the day, and a desk that hands over no bins keeps the list as it was', () => {
    const phone = draw({ isMobile: true })
    expect(document.querySelector('[data-lien-next-up-bin]')).toBeNull()
    expect(document.querySelectorAll('[data-lien-next-up-row^="affidavit:"]')).toHaveLength(3)
    phone.unmount()
    draw({ byBin: null })
    expect(document.querySelector('[data-lien-next-up-bin]')).toBeNull()
    expect(document.querySelector('[data-lien-next-up-row^="fold:"]')).toBeNull()
  })
})
