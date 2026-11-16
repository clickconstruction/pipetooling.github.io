// @vitest-environment jsdom
/**
 * Render smokes for the Lien desk's Board (v2.7332): the bins in column order with their chips sorted and
 * coloured, the tiles, the arrows, the lit bin, a pair lit in both columns on hover, a bin's press and the
 * line that says what the list shows. The rule is `lienBoard.test.ts`; this is the wiring.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import LienBoard, { lienBoardArrowPaths } from './LienBoard'
import { buildLienBoard, lienBoardForLeader, lienBoardPick, type LienBoardInput } from '../../lib/jobs/lienBoard'
import { lienBoardChipCard } from '../../lib/jobs/lienBoardChipCard'
import { lienBoardAffidavitPrint, lienBoardNoticePrint } from '../../lib/jobs/lienBoardPrints'
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
    expect(stages('notice')).toEqual(['needs_owner', 'to_send', 'awaiting', 'to_print', 'in_mail', 'sent', 'held'])
    expect(stages('affidavit')).toEqual(['needs_property', 'needs_notice', 'to_send', 'awaiting', 'ready', 'filed'])
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
  it('an approved notice stands in Approved · to print until its packet prints and in Approved · to mail after, each bin under its own name, and both chips open the run (v2.7448)', () => {
    const onChip = vi.fn()
    const b = board({ notices: [notice('4', 'ready', { item: item('i4') }), notice('5', 'printed', { item: item('i5', { printed_at: '2026-11-14T10:00:00Z' }) })], affidavits: [] })
    render(<LienBoard board={b} isMobile={false} onChip={onChip} />)
    const head = (key: string) => document.querySelector(`[data-lien-board-bin-head="${key}"]`)!.textContent
    expect(head('notice:to_print')).toBe('Approved · to print1')
    expect(head('notice:in_mail')).toBe('Approved · to mail1')
    const chips = (key: string) => Array.from(document.querySelectorAll(`[data-lien-board-chips="${key}"] [data-lien-board-chip]`)).map((el) => el.textContent)
    expect(chips('notice:to_print')).toEqual(['JP4'])
    expect(chips('notice:in_mail')).toEqual(['JP5'])
    fireEvent.click(document.querySelector('[data-lien-board-chip="4"]') as HTMLElement)
    expect(onChip.mock.calls[0]![0]).toMatchObject({ jobId: '4', stage: 'to_print', destination: { kind: 'run', itemId: 'i4', jobId: '4' } })
    fireEvent.click(document.querySelector('[data-lien-board-chip="5"]') as HTMLElement)
    expect(onChip.mock.calls[1]![0]).toMatchObject({ jobId: '5', stage: 'in_mail', destination: { kind: 'run', itemId: 'i5', jobId: '5' } })
    // The tiles over them: the approved notice is unsigned, so it waits on the leader too.
    const line = (key: string) => document.querySelector(`[data-lien-board-tile="${key}"] [data-lien-board-tile-line]`)!.textContent
    expect(line('waiting')).toBe('1 to sign')
    expect(line('in_mail')).toBe('1 to print · 1 to mail')
  })
  it('draws the four tiles with their figures and words; the waiting tile and the print and mail tile press, the others only read', () => {
    const onTile = vi.fn()
    render(<LienBoard board={board()} isMobile={false} onTile={onTile} />)
    const tiles = Array.from(document.querySelectorAll('[data-lien-board-tile]'))
    expect(tiles.map((el) => el.getAttribute('data-lien-board-tile'))).toEqual(['by_day', 'waiting', 'in_mail', 'unpaid'])
    // Due by Monday: the notice that needs its owner, the printed one, the held one and the affidavit ready to file.
    expect(tiles.map((el) => el.querySelector('[data-lien-board-tile-figure]')!.textContent)).toEqual(['4', '1', '1', '$8,000'])
    expect(tiles[0]!.querySelector('[data-lien-board-tile-label]')!.textContent).toBe('by tomorrow · 1 to file · 3 to send')
    expect(tiles[0]!.querySelector('[data-lien-board-tile-line]')!.textContent).toBe('2 will not make tomorrow as they stand.')
    expect(tiles[1]!.querySelector('[data-lien-board-tile-label]')!.textContent).toBe('waiting on Malachi')
    // One notice awaits approval and none is approved and unsigned; one has printed and none is still to print (v2.7448).
    expect(tiles[1]!.querySelector('[data-lien-board-tile-line]')!.textContent).toBe('1 to approve')
    expect(tiles[2]!.querySelector('[data-lien-board-tile-label]')!.textContent).toBe('to print and mail')
    expect(tiles[2]!.querySelector('[data-lien-board-tile-line]')!.textContent).toBe('1 to mail')
    expect(tiles[0]!.tagName).toBe('DIV')
    expect(tiles[3]!.tagName).toBe('DIV')
    fireEvent.click(tiles[1]!)
    expect(onTile.mock.calls[0]![0]).toEqual({ kind: 'leader' })
    fireEvent.click(tiles[2]!)
    expect(onTile.mock.calls[1]![0]).toEqual({ kind: 'run' })
  })
  it('a bin’s head presses with its key, the picked bin is marked, and the line under the bins says what the list shows with Show every row', () => {
    const onPick = vi.fn()
    const b = board()
    const { rerender } = render(<LienBoard board={b} isMobile={false} onPick={onPick} />)
    expect(document.querySelector('[data-lien-board-pick]')).toBeNull()
    const head = () => document.querySelector('button[data-lien-board-bin-head="notice:to_send"]') as HTMLButtonElement
    expect(head().textContent).toBe('To send for Master approval2')
    fireEvent.click(head())
    expect(onPick).toHaveBeenCalledWith('notice:to_send')
    rerender(<LienBoard board={b} isMobile={false} onPick={onPick} pick={lienBoardPick(b, ['notice:to_send'])} shown={2} />)
    expect(document.querySelector('[data-lien-board-bin="notice:to_send"]')!.getAttribute('data-picked')).toBe('yes')
    expect(document.querySelector('[data-lien-board-bin="affidavit:to_send"]')!.getAttribute('data-picked')).toBeNull()
    expect(head().getAttribute('aria-pressed')).toBe('true')
    expect(document.querySelector('[data-lien-board-pick-words]')!.textContent).toBe('Showing 2 rows in To send for Master approval.')
    fireEvent.click(screen.getByRole('button', { name: 'Show every row' }))
    expect(onPick).toHaveBeenLastCalledWith(null)
    // Without onPick the heads are plain words.
    cleanup()
    render(<LienBoard board={b} isMobile={false} />)
    expect(document.querySelector('button[data-lien-board-bin-head]')).toBeNull()
    expect(document.querySelector('[data-lien-board-bin-head="notice:to_send"]')!.textContent).toBe('To send for Master approval2')
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
    expect(section.querySelector('[data-lien-board-column="notice"] [data-lien-board-retainage]')!.textContent).toBe('Retainage · 1 to send for approval')
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
  it('the arrows run from each bin’s bottom middle to the next bin’s top, and the crossing one from Sent’s right edge along the gutter into Waiting on its notice, gone when stacked', () => {
    const b = board()
    const box = (left: number, top: number) => ({ left, top, width: 200, height: 60 })
    const boxes = {
      'notice:needs_owner': box(0, 0), 'notice:to_send': box(0, 100), 'notice:awaiting': box(0, 200), 'notice:to_print': box(0, 300), 'notice:in_mail': box(0, 400), 'notice:sent': box(0, 500),
      'affidavit:needs_property': box(300, 0), 'affidavit:needs_notice': box(300, 100), 'affidavit:to_send': box(300, 200), 'affidavit:awaiting': box(300, 300), 'affidavit:ready': box(300, 400), 'affidavit:filed': box(300, 500),
    }
    const lines = lienBoardArrowPaths(b.arrows, boxes, false)
    // Five down the notices (v2.7448), five down the affidavits (v2.7457), one across.
    expect(lines).toHaveLength(11)
    expect(lines[0]).toEqual({ key: 'notice:needs_owner>notice:to_send', kind: 'down', d: 'M 100 60 L 100 99' })
    expect(lines.slice(2, 4)).toEqual([
      { key: 'notice:awaiting>notice:to_print', kind: 'down', d: 'M 100 260 L 100 299' },
      { key: 'notice:to_print>notice:in_mail', kind: 'down', d: 'M 100 360 L 100 399' },
    ])
    // The crossing arrow lands on the second bin of the affidavits (v2.7457): the one a recorded mailing empties.
    expect(lines[10]).toEqual({ key: 'notice:sent>affidavit:needs_notice', kind: 'cross', d: 'M 200 530 H 250 V 130 L 299 130' })
    expect(lienBoardArrowPaths(b.arrows, boxes, true)).toHaveLength(10)
    // With the columns measured the vertical run sits in the gutter between them, clear of a bin beside the notices.
    const withColumns = { ...boxes, 'col:notice': { left: 0, top: 0, width: 240, height: 600 }, 'col:affidavit': { left: 300, top: 0, width: 240, height: 600 } }
    expect(lienBoardArrowPaths(b.arrows, withColumns, false)[10]!.d).toBe('M 200 530 H 270 V 130 L 299 130')
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

  it('a chip pointed at shows a card before any press: the job, its address and its customer, then where its paper stands; it goes when the pointer leaves (v2.7381)', async () => {
    const b = board()
    const cardFor = vi.fn((chip: Parameters<typeof lienBoardChipCard>[0]) => lienBoardChipCard(chip, b, { todayYmd: TODAY, jobName: 'ZZ Service Visit', address: '12 Sample Rd, Schertz, TX', customer: 'ZZ Homeowner', gc: 'ZZ Builders', detail: 'September 2026', leader: 'Sam' }))
    const onChip = vi.fn()
    render(<LienBoard board={b} isMobile={false} onChip={onChip} cardFor={cardFor} columnsOnly />)
    const chip = document.querySelector('[data-lien-board-chips="notice:to_send"] [data-lien-board-chip]') as HTMLElement
    // No card until a chip is pointed at, and the browser's own tip stands down for it.
    expect(document.querySelector('[data-lien-board-chip-card]')).toBeNull()
    expect(chip.getAttribute('title')).toBeNull()
    fireEvent.mouseEnter(chip)
    const card = document.querySelector('[data-lien-board-chip-card]') as HTMLElement
    expect(card.getAttribute('role')).toBe('tooltip')
    expect(card.querySelector('[data-lien-board-card-title]')!.textContent).toBe(`${chip.textContent!.replace('!', '')} · ZZ Service Visit`)
    expect(Array.from(card.querySelectorAll('[data-lien-board-card-fact]')).map((f) => [f.getAttribute('data-lien-board-card-fact'), f.textContent])).toEqual([
      ['address', '12 Sample Rd, Schertz, TX'],
      ['customer', 'ZZ Homeowner'],
      ['gc', 'ZZ Builders'],
    ])
    expect(card.querySelector('[data-lien-board-card-status]')!.textContent).toContain('Monthly noticeTo send for Master approval')
    expect(card.querySelector('[data-lien-board-card-detail]')!.textContent).toBe('September 2026')
    expect(card.querySelector('[data-lien-board-card-door]')!.textContent).toBe('Press to open the notice.')
    // It will make its day, so the card names no stages (v2.7419).
    expect(card.querySelector('[data-lien-board-card-risk]')).toBeNull()
    expect(card.querySelector('[data-lien-board-card-left]')).toBeNull()
    // The card never takes the pointer, so the chip's press still lands; nothing is pressed by pointing.
    expect(card.style.pointerEvents).toBe('none')
    expect(onChip).not.toHaveBeenCalled()
    fireEvent.mouseLeave(chip)
    await waitFor(() => expect(document.querySelector('[data-lien-board-chip-card]')).toBeNull())
    // A paper that will not make its day names the stages it still has to pass, in order, with its leader by name
    // (v2.7419; Taunya's ask of 2026-11-15: *3 stages left* did not say which three).
    const late = document.querySelector('[data-lien-board-chips="notice:needs_owner"] [data-lien-board-chip]') as HTMLElement
    fireEvent.mouseEnter(late)
    const lateCard = document.querySelector('[data-lien-board-chip-card]') as HTMLElement
    expect(lateCard.querySelector('[data-lien-board-card-risk]')!.textContent).toBe('Will not make its day as it stands. Still to do, with 1 working day left:')
    expect(Array.from(lateCard.querySelectorAll('ol[data-lien-board-card-left] li')).map((li) => li.textContent)).toEqual(['Name the owner on the property record', 'Send it for approval', 'Sam approves and signs it', 'Print it, mail it and enter its mail number'])
    fireEvent.mouseLeave(late)
    await waitFor(() => expect(document.querySelector('[data-lien-board-chip-card]')).toBeNull())
    // The keyboard reaches it too, and a page that moves takes the card away.
    fireEvent.focus(chip)
    expect(document.querySelector('[data-lien-board-chip-card]')).not.toBeNull()
    fireEvent.scroll(window)
    await waitFor(() => expect(document.querySelector('[data-lien-board-chip-card]')).toBeNull())
  })

  it('with no card handed in a chip keeps the browser’s one-line tip, and a phone draws no card', () => {
    const b = board()
    const view = render(<LienBoard board={b} isMobile={false} columnsOnly />)
    const chip = () => document.querySelector('[data-lien-board-chips="notice:to_send"] [data-lien-board-chip]') as HTMLElement
    expect(chip().getAttribute('title')).toBeTruthy()
    fireEvent.mouseEnter(chip())
    expect(document.querySelector('[data-lien-board-chip-card]')).toBeNull()
    view.unmount()
    render(<LienBoard board={b} isMobile cardFor={(c) => lienBoardChipCard(c, b, { todayYmd: TODAY, jobName: 'ZZ', address: null, customer: null, gc: null })} />)
    fireEvent.click(document.querySelector('[data-lien-board-fold]') as HTMLButtonElement)
    fireEvent.mouseEnter(chip())
    expect(document.querySelector('[data-lien-board-chip-card]')).toBeNull()
    expect(chip().getAttribute('title')).toBeTruthy()
  })
})

describe('LienBoard · public property (v2.7443)', () => {
  it('a marked chip draws ⊘ and says why in its words; the desk’s line sits over the bins and its bin under the affidavits', () => {
    render(<LienBoard board={board({ publicJobIds: new Set(['3']) })} isMobile={false} columnsOnly over={<div data-test-over>over</div>} underAffidavits={<div data-test-under>under</div>} />)
    const chip = document.querySelector('[data-lien-board-chip="3"]') as HTMLElement
    expect(chip.getAttribute('data-public')).toBe('yes')
    expect(chip.querySelector('[data-lien-board-public-mark]')!.textContent).toBe('⊘')
    expect(chip.getAttribute('data-urgency')).toBe('later')
    expect(chip.getAttribute('title')).toContain('public property, no paper until the property is answered')
    const grid = document.querySelector('[data-lien-board-grid]') as HTMLElement
    const over = document.querySelector('[data-test-over]') as HTMLElement
    expect(over.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect((document.querySelector('[data-lien-board-column="affidavit"]') as HTMLElement).querySelector('[data-test-under]')).toBeTruthy()
    expect(document.querySelector('[data-lien-board-chip="2"]')!.getAttribute('data-public')).toBeNull()
  })
})

describe('LienBoard · the two prints, between the tiles and the columns (v2.7470; moved up in v2.7483, punch list #362)', () => {
  const sides = () => ({ notice: lienBoardNoticePrint({ toPrint: 15, waits: 7, printed: 0, leaderName: 'Malachi' }), affidavit: lienBoardAffidavitPrint({ ready: 10, held: 2, earlierForm: 0, with: ['the help sheet'] }) })
  const handlers = () => ({ onPress: vi.fn(), onLeft: vi.fn(), onNote: vi.fn() })

  it('each column has its own print over it: the press with its count, what it leaves out with its door, and what the affidavits print with', () => {
    const h = handlers()
    render(<LienBoard board={board()} isMobile={false} columnsOnly prints={{ ...sides(), ...h }} />)
    // One band, after the tiles and before the columns, the notices' print on the left as its column is. Nothing is left at a column's foot.
    const band = document.querySelector('[data-lien-board-prints]') as HTMLElement
    expect(band.getAttribute('data-layout')).toBe('columns')
    expect(Array.from(band.children).map((el) => el.getAttribute('data-lien-board-print'))).toEqual(['notice', 'affidavit'])
    const tiles = document.querySelector('[data-lien-board-tiles]') as HTMLElement
    const grid = document.querySelector('[data-lien-board-grid]') as HTMLElement
    expect(tiles.compareDocumentPosition(band) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(band.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(document.querySelector('[data-lien-board-column] [data-lien-board-print]')).toBeNull()
    expect(document.querySelectorAll('[data-lien-board-print]')).toHaveLength(2)
    const left = band.querySelector('[data-lien-board-print="notice"]') as HTMLElement
    const right = band.querySelector('[data-lien-board-print="affidavit"]') as HTMLElement
    expect(within(left).getByRole('button', { name: 'Print and mail 8 notices' })).toBeTruthy()
    expect(left.querySelector('[data-lien-board-print-left]')!.textContent).toBe('7 wait on Malachi’s signature · See them ›')
    expect(left.querySelector('[data-lien-board-print-note]')).toBeNull()
    expect(right.querySelector('[data-lien-board-print-left]')!.textContent).toBe('2 held on a property fact · See them ›')
    expect(right.querySelector('[data-lien-board-print-note]')!.textContent).toBe('Prints with the help sheet · Change ›')
    fireEvent.click(within(left).getByRole('button', { name: 'Print and mail 8 notices' }))
    expect(h.onPress.mock.calls[0]![0]).toMatchObject({ kind: 'notice', act: 'print_run' })
    fireEvent.click(within(right).getByRole('button', { name: 'Print 10 for notarization' }))
    expect(h.onPress.mock.calls[1]![0]).toMatchObject({ kind: 'affidavit', act: 'print_affidavits' })
    fireEvent.click(within(left).getByRole('button', { name: 'See them ›' }))
    expect(h.onLeft.mock.calls[0]![0].kind).toBe('notice')
    fireEvent.click(within(right).getByRole('button', { name: 'Change ›' }))
    expect(h.onNote).toHaveBeenCalledTimes(1)
  })

  it('a press with nothing ready is dead and still says why; a column with no approved paper ends with no press', () => {
    const h = handlers()
    render(<LienBoard board={board()} isMobile={false} columnsOnly prints={{ notice: lienBoardNoticePrint({ toPrint: 2, waits: 2, printed: 0 }), affidavit: null, ...h }} />)
    const press = document.querySelector('[data-lien-board-print="notice"] [data-lien-board-print-press]') as HTMLButtonElement
    expect(press.disabled).toBe(true)
    expect(document.querySelector('[data-lien-board-print="notice"] [data-lien-board-print-left]')!.textContent).toContain('2 wait on the leader’s signature')
    fireEvent.click(press)
    expect(h.onPress).not.toHaveBeenCalled()
    expect(document.querySelector('[data-lien-board-print="affidavit"]')).toBeNull()
  })

  it('the third tile only reads while the notices’ print stands under the tiles: one door to the run, not two; with no print it keeps its press', () => {
    const onTile = vi.fn()
    const view = render(<LienBoard board={board()} isMobile={false} columnsOnly onTile={onTile} prints={{ ...sides(), ...handlers() }} />)
    expect(document.querySelector('button[data-lien-board-tile="in_mail"]')).toBeNull()
    expect(document.querySelector('[data-lien-board-tile="in_mail"]')).toBeTruthy()
    view.unmount()
    render(<LienBoard board={board()} isMobile={false} columnsOnly onTile={onTile} />)
    fireEvent.click(document.querySelector('button[data-lien-board-tile="in_mail"]') as HTMLButtonElement)
    expect(onTile).toHaveBeenCalledWith({ kind: 'run' })
  })

  it('a column with nothing approved leaves its side of the band empty, so the other print stays over its own column', () => {
    render(<LienBoard board={board()} isMobile={false} columnsOnly prints={{ notice: null, affidavit: sides().affidavit, ...handlers() }} />)
    const band = document.querySelector('[data-lien-board-prints]') as HTMLElement
    expect(band.children).toHaveLength(2)
    expect(band.children[0]!.getAttribute('data-lien-board-print')).toBeNull()
    expect(band.children[1]!.getAttribute('data-lien-board-print')).toBe('affidavit')
  })

  it('on a phone the two stand stacked over the folded bins, the notices’ first', () => {
    render(<LienBoard board={board()} isMobile prints={{ ...sides(), ...handlers() }} />)
    const stack = document.querySelector('[data-lien-board-prints]') as HTMLElement
    expect(stack.getAttribute('data-layout')).toBe('stacked')
    expect(Array.from(stack.children).map((el) => el.getAttribute('data-lien-board-print'))).toEqual(['notice', 'affidavit'])
    // Not drawn a second time inside the columns.
    expect(document.querySelectorAll('[data-lien-board-print]')).toHaveLength(2)
    expect((document.querySelector('[data-lien-board-grid]') as HTMLElement).style.display).toBe('none')
  })

  it('the leader’s own bins and a Board handed no prints end as before', () => {
    const b = board()
    const view = render(<LienBoard board={b} isMobile={false} columnsOnly leader={{ view: lienBoardForLeader(b), mine: true, onToggleMine: vi.fn(), onApprove: vi.fn() }} prints={{ ...sides(), ...handlers() }} />)
    expect(document.querySelector('[data-lien-board-print]')).toBeNull()
    view.unmount()
    render(<LienBoard board={b} isMobile={false} columnsOnly />)
    expect(document.querySelector('[data-lien-board-print]')).toBeNull()
  })
})
