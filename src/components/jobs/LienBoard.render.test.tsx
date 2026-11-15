// @vitest-environment jsdom
/**
 * Render smokes for the Lien desk's Board (v2.7332): the bins in column order with their chips sorted and
 * coloured, the tiles, the arrows, the lit bin, a pair lit in both columns on hover, a bin's press and the
 * line that says what the list shows. The rule is `lienBoard.test.ts`; this is the wiring.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import LienBoard, { lienBoardArrowPaths } from './LienBoard'
import { buildLienBoard, lienBoardForLeader, lienBoardPick, type LienBoardInput } from '../../lib/jobs/lienBoard'
import type { LienDeskEntry, LienDeskPile } from '../../lib/jobs/lienDesk'
import type { LienAffidavitEntry, LienAffidavitGate, LienAffidavitPile } from '../../lib/jobs/lienDeskAffidavits'

afterEach(cleanup)

const TODAY = '2026-11-15'
function notice(jobId: string, pile: LienDeskPile, over: Partial<LienDeskEntry> = {}): LienDeskEntry {
  return { jobId, customerId: 'c1', gcCustomerId: 'gc1', openBalance: 1000, hasOwner: pile !== 'needs_owner', propertyKind: '', months: [], datedFromCreation: false, dueMonths: ['2026-08'], missedMonths: [], missedUnrecorded: [], affidavitDay: null, affidavitDaysLeft: null, earliestDeadline: '2026-11-16', daysLeft: 1, severity: 'red', item: null, policy: 'ask', pile, ...over }
}
const gate = (key: LienAffidavitGate['key'], ok: boolean): LienAffidavitGate => ({ key, ok, label: key })
function affidavit(jobId: string, pile: LienAffidavitPile, over: Partial<LienAffidavitEntry> = {}): LienAffidavitEntry {
  return { jobId, isSub: true, lastMonth: '2026-07', lastMonthFromCreation: false, deadline: '2026-12-15', daysLeft: 30, severity: 'quiet', openBalance: 1000, customerId: 'c1', gcCustomerId: 'gc1', propertyKind: '', gates: [gate('owner', true), gate('legal', true)], ready: true, item: null, pile, ...over }
}
const item = (id: string, over: Record<string, unknown> = {}) => ({ id, status: 'approved', fields: {}, months: [], voided_at: null, ...over }) as unknown as LienDeskEntry['item']

function board(over: Partial<LienBoardInput> = {}) {
  return buildLienBoard({
    todayYmd: TODAY,
    notices: [
      notice('1', 'needs_owner'),
      notice('2', 'to_draft', { earliestDeadline: '2026-12-15', daysLeft: 30 }),
      notice('3', 'to_draft', { earliestDeadline: '2026-11-20', daysLeft: 5 }),
      notice('4', 'awaiting', { earliestDeadline: '2026-12-15', daysLeft: 30 }),
      notice('5', 'printed', { item: item('i5', { printed_at: '2026-11-14T10:00:00Z' }) }),
      notice('6', 'sent'),
      notice('7', 'held'),
    ],
    affidavits: [affidavit('1', 'needs_property', { gates: [gate('owner', false), gate('legal', false)] }), affidavit('8', 'ready', { deadline: '2026-11-16', daysLeft: 1 })],
    retainage: [],
    jobNumber: (id) => `JP${id}`,
    jobName: (id) => `Job ${id}`,
    gcName: () => 'Byrne',
    leaderName: 'Malachi',
    ...over,
  })
}

describe('LienBoard', () => {
  it('draws the two columns of bins in flow order, Held beside only while a job is in it, each chip in its bin sorted by day and coloured by urgency', () => {
    render(<LienBoard board={board()} isMobile={false} />)
    const section = screen.getByRole('region', { name: 'The Board' })
    expect(section.getAttribute('data-lien-board-layout')).toBe('columns')
    const stages = (kind: string) => Array.from(section.querySelectorAll(`[data-lien-board-column="${kind}"] [data-lien-board-bin]`)).map((el) => el.getAttribute('data-stage'))
    expect(stages('notice')).toEqual(['needs_owner', 'to_send', 'awaiting', 'in_mail', 'sent', 'held'])
    expect(stages('affidavit')).toEqual(['needs_property', 'to_send', 'awaiting', 'ready', 'filed'])
    expect(section.querySelector('[data-lien-board-bin="notice:held"]')!.getAttribute('data-beside')).toBe('yes')
    expect(section.querySelector('[data-lien-board-bin="notice:missed"]')).toBeNull()
    // To send: the one due in five days before the one due next month; amber then grey.
    const toSend = Array.from(section.querySelectorAll('[data-lien-board-chips="notice:to_send"] [data-lien-board-chip]'))
    expect(toSend.map((el) => el.textContent)).toEqual(['JP3', 'JP2'])
    expect(toSend.map((el) => el.getAttribute('data-urgency'))).toEqual(['week', 'later'])
    const urgency = (bin: string) => Array.from(section.querySelectorAll(`[data-lien-board-chips="${bin}"] [data-lien-board-chip]`)).map((el) => el.getAttribute('data-urgency'))
    expect(urgency('notice:needs_owner')).toEqual(['day'])
    expect(urgency('notice:awaiting')).toEqual(['waiting'])
    expect(urgency('notice:sent')).toEqual(['later'])
    // Needs the owner from a Sunday for Monday: four stages left, one working day, so it carries the risk mark.
    const atRisk = section.querySelector('[data-lien-board-chips="notice:needs_owner"] [data-lien-board-chip]') as HTMLElement
    expect(atRisk.getAttribute('data-at-risk')).toBe('yes')
    expect(within(atRisk).getByText('!')).toBeTruthy()
    expect(atRisk.getAttribute('title')).toBe('Job 1 · Byrne · $1,000 · due within a day · will not make its day as it stands')
    // An empty bin says so quietly.
    expect(section.querySelector('[data-lien-board-chips="affidavit:filed"]')!.textContent).toBe('none')
    // The busiest bin is lit: To send with two.
    expect(section.querySelector('[data-lien-board-bin="notice:to_send"]')!.getAttribute('data-lit')).toBe('yes')
    expect(section.querySelectorAll('[data-lit="yes"]')).toHaveLength(1)
  })
  it('draws the four tiles with their figures and words; the run tile and the waiting tile press, the others only read', () => {
    const onTile = vi.fn()
    render(<LienBoard board={board()} isMobile={false} onTile={onTile} />)
    const tiles = Array.from(document.querySelectorAll('[data-lien-board-tile]'))
    expect(tiles.map((el) => el.getAttribute('data-lien-board-tile'))).toEqual(['by_day', 'waiting', 'in_mail', 'unpaid'])
    // Due by Monday: the notice that needs its owner, the printed one, the held one and the affidavit ready to file.
    expect(tiles.map((el) => el.querySelector('[data-lien-board-tile-figure]')!.textContent)).toEqual(['4', '1', '1', '$8,000'])
    expect(tiles[0]!.querySelector('[data-lien-board-tile-label]')!.textContent).toBe('by tomorrow · 1 to file · 3 to send')
    expect(tiles[0]!.querySelector('[data-lien-board-tile-line]')!.textContent).toBe('2 will not make tomorrow as they stand.')
    expect(tiles[1]!.querySelector('[data-lien-board-tile-label]')!.textContent).toBe('waiting on Malachi')
    expect(tiles[2]!.querySelector('[data-lien-board-tile-line]')!.textContent).toBe('Type the tracking number.')
    expect(tiles[0]!.tagName).toBe('DIV')
    expect(tiles[3]!.tagName).toBe('DIV')
    fireEvent.click(tiles[1]!)
    expect(onTile.mock.calls[0]![0]).toEqual({ kind: 'stage', stage: 'awaiting' })
    fireEvent.click(tiles[2]!)
    expect(onTile.mock.calls[1]![0]).toEqual({ kind: 'run' })
  })
  it('a bin’s head presses with its key, the picked bin is marked, and the line under the bins says what the list shows with Show every row', () => {
    const onPick = vi.fn()
    const b = board()
    const { rerender } = render(<LienBoard board={b} isMobile={false} onPick={onPick} />)
    expect(document.querySelector('[data-lien-board-pick]')).toBeNull()
    const head = () => document.querySelector('button[data-lien-board-bin-head="notice:to_send"]') as HTMLButtonElement
    expect(head().textContent).toBe('To send2')
    fireEvent.click(head())
    expect(onPick).toHaveBeenCalledWith('notice:to_send')
    rerender(<LienBoard board={b} isMobile={false} onPick={onPick} pick={lienBoardPick(b, ['notice:to_send'])} shown={2} />)
    expect(document.querySelector('[data-lien-board-bin="notice:to_send"]')!.getAttribute('data-picked')).toBe('yes')
    expect(document.querySelector('[data-lien-board-bin="affidavit:to_send"]')!.getAttribute('data-picked')).toBeNull()
    expect(head().getAttribute('aria-pressed')).toBe('true')
    expect(document.querySelector('[data-lien-board-pick-words]')!.textContent).toBe('Showing 2 rows in To send.')
    fireEvent.click(screen.getByRole('button', { name: 'Show every row' }))
    expect(onPick).toHaveBeenLastCalledWith(null)
    // Without onPick the heads are plain words.
    cleanup()
    render(<LienBoard board={b} isMobile={false} />)
    expect(document.querySelector('button[data-lien-board-bin-head]')).toBeNull()
    expect(document.querySelector('[data-lien-board-bin-head="notice:to_send"]')!.textContent).toBe('To send2')
  })
  it('a job in both columns for one reason lights in both on hover, and only those two', () => {
    render(<LienBoard board={board()} isMobile={false} />)
    const pair = Array.from(document.querySelectorAll('[data-pair="owner:1"]'))
    expect(pair.map((el) => el.closest('[data-lien-board-bin]')!.getAttribute('data-lien-board-bin'))).toEqual(['notice:needs_owner', 'affidavit:needs_property'])
    expect(document.querySelectorAll('[data-pair-lit="yes"]')).toHaveLength(0)
    fireEvent.mouseEnter(pair[0]!)
    // The notice is at risk for Monday; the affidavit's day is a month off, so only the notice wears the mark.
    expect(Array.from(document.querySelectorAll('[data-pair-lit="yes"]')).map((el) => el.textContent)).toEqual(['JP1!', 'JP1'])
    fireEvent.mouseLeave(pair[0]!)
    expect(document.querySelectorAll('[data-pair-lit="yes"]')).toHaveLength(0)
    // A chip with no pair has no hover state to give.
    expect(document.querySelector('[data-lien-board-chips="notice:to_send"] [data-lien-board-chip]')!.getAttribute('data-pair')).toBeNull()
  })
  it('chips are plain until the desk hands onChip; then each is a press with its chip', () => {
    const onChip = vi.fn()
    render(<LienBoard board={board()} isMobile={false} onChip={onChip} />)
    const chip = document.querySelector('[data-lien-board-chip="3"]') as HTMLElement
    expect(chip.tagName).toBe('BUTTON')
    fireEvent.click(chip)
    expect(onChip.mock.calls[0]![0]).toMatchObject({ jobId: '3', kind: 'notice', stage: 'to_send', destination: { kind: 'paper', tab: 'notices', jobId: '3' } })
    cleanup()
    render(<LienBoard board={board()} isMobile={false} />)
    expect((document.querySelector('[data-lien-board-chip="3"]') as HTMLElement).tagName).toBe('SPAN')
  })
  it('stacks the columns on a phone, with the tiles two by two and no crossing arrow; the retainage line sits under the notices; an empty desk says so', () => {
    render(<LienBoard board={board({ retainage: [{ jobId: '9', retainageHeld: 500, contractEndedOn: '2026-09-20', contractEndedHow: 'complete', deadline: '2026-10-20', daysLeft: 15, severity: 'amber', noticed: false, inClaim: false, openBalance: 1000, customerId: 'c1', gcCustomerId: 'gc1', propertyKind: '', hasOwner: true, paymentBond: 'unknown', gates: [], ready: true, item: null, pile: 'to_draft' }] })} isMobile />)
    const section = screen.getByRole('region', { name: 'The Board' })
    expect(section.getAttribute('data-lien-board-layout')).toBe('stacked')
    expect((section.querySelector('[data-lien-board-tiles]') as HTMLElement).style.gridTemplateColumns).toBe('repeat(2, minmax(0, 1fr))')
    expect(section.querySelectorAll('[data-lien-board-arrow][data-kind="cross"]')).toHaveLength(0)
    expect(section.querySelector('[data-lien-board-column="notice"] [data-lien-board-retainage]')!.textContent).toBe('Retainage · 1 to send')
    // A phone keeps the bins behind one press, a thumb tall; the tiles always show.
    const fold = section.querySelector('[data-lien-board-fold]') as HTMLButtonElement
    expect(fold.textContent).toContain('Show the bins · 9')
    expect((section.querySelector('[data-lien-board-grid]') as HTMLElement).style.display).toBe('none')
    fireEvent.click(fold)
    expect(fold.textContent).toContain('Hide the bins')
    expect((section.querySelector('[data-lien-board-grid]') as HTMLElement).style.display).toBe('grid')
    cleanup()
    render(<LienBoard board={board()} isMobile={false} />)
    expect(document.querySelector('[data-lien-board-fold]')).toBeNull()
    cleanup()
    render(<LienBoard board={board({ notices: [], affidavits: [] })} isMobile={false} />)
    expect(document.querySelector('[data-lien-board-empty-board]')!.textContent).toContain('Nothing is on the desk.')
  })
  it('the arrows run from each bin’s bottom middle to the next bin’s top, and the crossing one from Sent’s right edge along the gutter into Needs the property facts, gone when stacked', () => {
    const b = board()
    const box = (left: number, top: number) => ({ left, top, width: 200, height: 60 })
    const boxes = {
      'notice:needs_owner': box(0, 0), 'notice:to_send': box(0, 100), 'notice:awaiting': box(0, 200), 'notice:in_mail': box(0, 300), 'notice:sent': box(0, 400),
      'affidavit:needs_property': box(300, 0), 'affidavit:to_send': box(300, 100), 'affidavit:awaiting': box(300, 200), 'affidavit:ready': box(300, 300), 'affidavit:filed': box(300, 400),
    }
    const lines = lienBoardArrowPaths(b.arrows, boxes, false)
    expect(lines).toHaveLength(9)
    expect(lines[0]).toEqual({ key: 'notice:needs_owner>notice:to_send', kind: 'down', d: 'M 100 60 L 100 99' })
    expect(lines[8]).toEqual({ key: 'notice:sent>affidavit:needs_property', kind: 'cross', d: 'M 200 430 H 250 V 30 L 299 30' })
    expect(lienBoardArrowPaths(b.arrows, boxes, true)).toHaveLength(8)
    // With the columns measured the vertical run sits in the gutter between them, clear of a bin beside the notices.
    const withColumns = { ...boxes, 'col:notice': { left: 0, top: 0, width: 240, height: 500 }, 'col:affidavit': { left: 300, top: 0, width: 240, height: 500 } }
    expect(lienBoardArrowPaths(b.arrows, withColumns, false)[8]!.d).toBe('M 200 430 H 270 V 30 L 299 30')
    // A bin not drawn (Missed while empty) has no box and so no arrow; nothing throws.
    expect(lienBoardArrowPaths([{ from: 'notice:held', to: 'notice:missed', kind: 'down' }], boxes, false)).toEqual([])
  })
  it('the leader’s view (v2.7334): only his two bins under the tiles, the one counted press with its foot, the held papers as chips with their reasons, and the switch to every bin', () => {
    const b = board({ notices: [notice('1', 'awaiting'), notice('2', 'to_draft')], affidavits: [affidavit('3', 'awaiting'), affidavit('4', 'awaiting', { deadline: '2026-11-10', daysLeft: -5 }), affidavit('5', 'ready')] })
    const onApprove = vi.fn()
    const onToggleMine = vi.fn()
    const onChip = vi.fn()
    const { rerender } = render(<LienBoard board={b} isMobile={false} onChip={onChip} leader={{ view: lienBoardForLeader(b), mine: true, onToggleMine, onApprove }} />)
    const section = screen.getByRole('region', { name: 'The Board' })
    expect(Array.from(section.querySelectorAll('[data-lien-board-bin]')).map((el) => el.getAttribute('data-lien-board-bin'))).toEqual(['notice:awaiting', 'affidavit:awaiting'])
    expect(section.querySelector('[data-lien-board-leader-bar]')!.textContent).toContain('Only the bins that wait on you.')
    const press = section.querySelector('[data-lien-board-approve]') as HTMLButtonElement
    expect(press.textContent).toBe('Approve 1 affidavit · 2 are held ▸')
    expect(press.disabled).toBe(false)
    expect(section.querySelector('[data-lien-board-approve-foot]')!.textContent).toBe('2 are held. They stay here with the reason. The 1 ready one approves now.')
    const held = Array.from(section.querySelectorAll('[data-lien-board-held-row]'))
    expect(held.map((el) => el.textContent)).toEqual(['JP4is past its day', 'JP1!needs your signature'])
    fireEvent.click(held[1]!.querySelector('[data-lien-board-chip]') as HTMLElement)
    expect(onChip.mock.calls[0]![0]).toMatchObject({ jobId: '1', kind: 'notice' })
    fireEvent.click(press)
    expect(onApprove).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Every bin' }))
    expect(onToggleMine).toHaveBeenCalledTimes(1)
    // Busy: the press waits. Nothing ready: the press is dead with its words.
    rerender(<LienBoard board={b} isMobile={false} leader={{ view: lienBoardForLeader(b), mine: true, onToggleMine, onApprove, busy: true }} />)
    expect((section.querySelector('[data-lien-board-approve]') as HTMLButtonElement).disabled).toBe(true)
    expect(section.querySelector('[data-lien-board-approve]')!.textContent).toBe('Approving…')
    const none = board({ notices: [notice('1', 'awaiting')], affidavits: [] })
    rerender(<LienBoard board={none} isMobile={false} leader={{ view: lienBoardForLeader(none), mine: true, onToggleMine, onApprove }} />)
    expect((section.querySelector('[data-lien-board-approve]') as HTMLButtonElement).disabled).toBe(true)
    expect(section.querySelector('[data-lien-board-approve]')!.textContent).toBe('Approve ▸')
    expect(section.textContent).not.toContain('Nothing waits on you.')
    // A leader whose bins are empty, as a dev reading another master's jobs: the bins say none, and the line says why the press is dead.
    const empty = board({ notices: [notice('1', 'awaiting')], affidavits: [] })
    rerender(<LienBoard board={empty} isMobile={false} leader={{ view: lienBoardForLeader(empty, { leads: () => false }), mine: true, onToggleMine, onApprove }} />)
    expect(section.textContent).toContain('Nothing waits on you.')
    expect(section.querySelector('[data-lien-board-approve]')!.textContent).toBe('Approve')
    // Every bin: the whole Board with the switch back, no press.
    rerender(<LienBoard board={b} isMobile={false} leader={{ view: lienBoardForLeader(b), mine: false, onToggleMine, onApprove }} />)
    expect(section.querySelectorAll('[data-lien-board-bin]').length).toBeGreaterThan(2)
    expect(screen.getByRole('button', { name: 'Only my bins' })).toBeTruthy()
    expect(section.querySelector('[data-lien-board-approve]')).toBeNull()
  })

  it('the day tile’s red line is a press of its own that hands the desk its door; with no desk to hand it to, it is words (v2.7371)', () => {
    const b = board({ notices: [notice('3', 'to_draft', { earliestDeadline: '2026-11-16', daysLeft: 1 })], affidavits: [affidavit('8', 'ready', { deadline: '2026-11-16', daysLeft: 1 })] })
    expect(b.atRisk).toBeGreaterThan(0)
    const onTile = vi.fn()
    const view = render(<LienBoard board={b} isMobile={false} onTile={onTile} columnsOnly />)
    const tile = document.querySelector('[data-lien-board-tile="by_day"]') as HTMLElement
    const line = tile.querySelector('[data-lien-board-tile-line]') as HTMLButtonElement
    // The tile itself only reads; the line under its count is the press.
    expect(tile.tagName).toBe('DIV')
    expect(line.tagName).toBe('BUTTON')
    expect(line.textContent).toMatch(/will not make tomorrow as (it stands|they stand)\.$/)
    fireEvent.click(line)
    expect(onTile).toHaveBeenCalledWith({ kind: 'risk' })
    view.unmount()
    render(<LienBoard board={b} isMobile={false} columnsOnly />)
    expect((document.querySelector('[data-lien-board-tile="by_day"] [data-lien-board-tile-line]') as HTMLElement).tagName).toBe('SPAN')
  })
})
