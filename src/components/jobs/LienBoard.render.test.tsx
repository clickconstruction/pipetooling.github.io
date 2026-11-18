// @vitest-environment jsdom
/**
 * Render smokes for the Lien desk's Board (v2.7332): the bins in column order with their chips sorted and
 * coloured, the tiles, the arrows, the lit bin, a pair lit in both columns on hover, a bin's press and the
 * line that says what the list shows. The rule is `lienBoard.test.ts`; this is the wiring.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import LienBoard, { LIEN_BOARD_QUIET_HEAD, lienBoardArrowPaths } from './LienBoard'
import { buildLienBoard, lienBoardForLeader, lienBoardLeaderBinPress, lienBoardPick, type LienBoardInput } from '../../lib/jobs/lienBoard'
import { lienBoardChipCard } from '../../lib/jobs/lienBoardChipCard'
import { LIEN_BOARD_USUAL_STACK, lienBoardAffidavitPrint, lienBoardMailNumbersPress, lienBoardNoticePrint, lienBoardSendDoor, lienBoardSignDoor } from '../../lib/jobs/lienBoardPrints'
import { lienFieldsHash } from '../../lib/jobs/lienNoticeSignature'
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
/** The columns of a notice the leader signed as it stands: without them an approved notice waits in Approved · to sign. */
const SIGNED = { signed_at: '2026-11-13T19:14:00Z', signer_printed_name: 'Malachi', signer_signature_mode: 'type', signed_fields_hash: lienFieldsHash({}) }
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

describe('LienBoard — the closed end at the foot of each column', () => {
  const closedBoard = () =>
    board({
      notices: [
        notice('6', 'sent'),
        notice('7', 'held'),
        // Every month closed. A late notice can still save 21; 22 is past its lien day too.
        notice('21', 'missed', { dueMonths: [], earliestDeadline: null, daysLeft: null, missedUnrecorded: ['2026-08'], affidavitDay: '2026-12-15', affidavitDaysLeft: 30 }),
        notice('22', 'missed', { dueMonths: [], earliestDeadline: null, daysLeft: null, missedUnrecorded: ['2026-07'], affidavitDay: '2026-11-10', affidavitDaysLeft: -5 }),
      ],
      affidavits: [affidavit('8', 'ready', { deadline: '2026-11-16', daysLeft: 1 }), affidavit('22', 'missed', { deadline: '2026-11-10', daysLeft: -5 })],
    })

  it('draws each closed bin under its column’s flow, named for what closed, and off the heading line', () => {
    render(<LienBoard board={closedBoard()} isMobile={false} columnsOnly />)
    const section = screen.getByRole('region', { name: 'The Board' })
    for (const [kind, name] of [['notice', 'Window closed · no notice'], ['affidavit', 'Lien day passed · not filed']] as const) {
      const column = section.querySelector(`[data-lien-board-column="${kind}"]`) as HTMLElement
      const foot = column.querySelector(`[data-lien-board-closed="${kind}"]`) as HTMLElement
      const bin = foot.querySelector(`[data-lien-board-bin="${kind}:missed"]`) as HTMLElement
      expect(bin.getAttribute('data-closed')).toBe('yes')
      expect(bin.getAttribute('data-inline')).toBeNull()
      expect(within(bin).getByText(name)).toBeTruthy()
      // After the flow, never inside it and never on the heading line.
      const flow = column.querySelector(`[data-lien-board-flow="${kind}"]`) as HTMLElement
      expect(flow.querySelector('[data-stage="missed"]')).toBeNull()
      expect(column.querySelector(`[data-lien-board-heading="${kind}"] [data-stage="missed"]`)).toBeNull()
      expect(flow.compareDocumentPosition(foot) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    }
    // No bin stands on a heading line: a held paper is drawn in the bin where it stopped (v2.7783), with its mark.
    expect(section.querySelector('[data-lien-board-heading] [data-lien-board-bin]')).toBeNull()
    expect(section.querySelector('[data-lien-board-chips="notice:awaiting"] [data-lien-board-chip="7"]')!.getAttribute('data-held')).toBe('yes')
  })

  it('draws a closed chip quiet and dashed, never red, and marks the one a late notice can still save', () => {
    render(<LienBoard board={closedBoard()} isMobile={false} columnsOnly />)
    const section = screen.getByRole('region', { name: 'The Board' })
    const chips = Array.from(section.querySelectorAll<HTMLElement>('[data-lien-board-chips="notice:missed"] [data-lien-board-chip]'))
    expect(chips.map((el) => [el.textContent, el.getAttribute('data-closed'), el.getAttribute('data-late-notice'), el.getAttribute('data-urgency')])).toEqual([['JP21', 'yes', 'yes', 'later'], ['JP22', 'yes', null, 'later']])
    expect(chips.map((el) => el.style.borderStyle)).toEqual(['dashed', 'dashed'])
    expect(chips[0]!.style.color).toBe('var(--text-amber-800)')
    expect(chips[1]!.style.color).toBe('var(--text-muted)')
    expect(chips[0]!.getAttribute('title')).toContain('a late notice can still go')
    const gone = section.querySelector('[data-lien-board-chips="affidavit:missed"] [data-lien-board-chip]') as HTMLElement
    expect(gone.getAttribute('title')).toContain('the lien day passed')
    expect(gone.querySelector('[data-lien-board-risk]')).toBeNull()
    // A chip in the flow keeps its solid colours.
    expect((section.querySelector('[data-lien-board-chips="affidavit:ready"] [data-lien-board-chip]') as HTMLElement).style.borderStyle).toBe('')
  })

  it('draws no closed end while nothing has closed, and no arrow runs into one', () => {
    const { unmount } = render(<LienBoard board={board()} isMobile={false} columnsOnly />)
    expect(document.querySelector('[data-lien-board-closed]')).toBeNull()
    unmount()
    expect(closedBoard().arrows.some((a) => a.to.endsWith(':missed') || a.from.endsWith(':missed'))).toBe(false)
  })

  it('takes a press on its title line, as every bin does, and narrows the list from its head', () => {
    const onPress = vi.fn()
    const onPick = vi.fn()
    render(<LienBoard board={closedBoard()} isMobile={false} columnsOnly onPick={onPick} binPress={{ 'affidavit:missed': { label: 'Answer 1 ›', onPress } }} />)
    const bin = document.querySelector('[data-lien-board-bin="affidavit:missed"]') as HTMLElement
    fireEvent.click(within(bin).getByRole('button', { name: 'Answer 1 ›' }))
    expect(onPress).toHaveBeenCalledTimes(1)
    fireEvent.click(bin.querySelector('[data-lien-board-bin-head]') as HTMLElement)
    expect(onPick).toHaveBeenCalledWith('affidavit:missed')
  })
})

describe('LienBoard', () => {
  it('draws the two columns of bins in flow order, a held paper in the bin of its stage and no bin named Held, each chip in its bin sorted by day and coloured by urgency', () => {
    render(<LienBoard board={board()} isMobile={false} />)
    const section = screen.getByRole('region', { name: 'The Board' })
    expect(section.getAttribute('data-lien-board-layout')).toBe('columns')
    const stages = (kind: string) => Array.from(section.querySelectorAll(`[data-lien-board-flow="${kind}"] [data-lien-board-bin]`)).map((el) => el.getAttribute('data-stage'))
    expect(stages('notice')).toEqual(['needs_owner', 'to_send', 'awaiting', 'to_sign', 'to_print', 'in_mail', 'sent'])
    expect(stages('affidavit')).toEqual(['needs_property', 'needs_notice', 'to_send', 'awaiting', 'ready', 'filed', 'served'])
    // No bin is named Held (v2.7783): the held notice stands in Awaiting Master approval, after the one that waits, with its mark. The bin counts the one that can move.
    expect(section.querySelector('[data-lien-board-bin$=":held"]')).toBeNull()
    expect(section.querySelector('[data-lien-board-heading="notice"] [data-lien-board-bin]')).toBeNull()
    const awaiting = section.querySelector('[data-lien-board-bin="notice:awaiting"]') as HTMLElement
    expect(awaiting.querySelector('[data-lien-board-count]')!.textContent).toBe('1')
    expect(Array.from(awaiting.querySelectorAll('[data-lien-board-chip]')).map((el) => [el.textContent, el.getAttribute('data-held')])).toEqual([['JP4', null], ['JP7!‖', 'yes']])
    expect(section.querySelector('[data-lien-board-heading="affidavit"] [data-lien-board-bin]')).toBeNull()
    expect(section.querySelector('[data-lien-board-bin="notice:missed"]')).toBeNull()
    // To send: the one due in five days before the one due next month; amber then grey.
    const toSend = Array.from(section.querySelectorAll('[data-lien-board-chips="notice:to_send"] [data-lien-board-chip]'))
    expect(toSend.map((el) => el.textContent)).toEqual(['JP3', 'JP2'])
    expect(toSend.map((el) => el.getAttribute('data-urgency'))).toEqual(['week', 'later'])
    const urgency = (bin: string) => Array.from(section.querySelectorAll(`[data-lien-board-chips="${bin}"] [data-lien-board-chip]`)).map((el) => el.getAttribute('data-urgency'))
    expect(urgency('notice:needs_owner')).toEqual(['day'])
    // The one that waits is purple. The held one beside it keeps its day's colour: due tomorrow, so red.
    expect(urgency('notice:awaiting')).toEqual(['waiting', 'day'])
    expect(urgency('notice:sent')).toEqual(['later'])
    // Needs the owner from a Sunday for Monday: four stages left, one working day, so it carries the risk mark.
    const atRisk = section.querySelector('[data-lien-board-chips="notice:needs_owner"] [data-lien-board-chip]') as HTMLElement
    expect(atRisk.getAttribute('data-at-risk')).toBe('yes')
    expect(within(atRisk).getByText('!')).toBeTruthy()
    expect(atRisk.getAttribute('title')).toBe('Job 1 · Byrne · $1,000 · due within a day · will not make its day as it stands')
    // An empty bin folds to one quiet line (v2.7714): its name and a zero, no row under them.
    const empty = section.querySelector('[data-lien-board-bin="affidavit:filed"]') as HTMLElement
    expect(empty.getAttribute('data-folded')).toBe('yes')
    expect(empty.textContent).toBe('Filed · copies to mail0')
    expect(section.querySelector('[data-lien-board-chips="affidavit:filed"]')).toBeNull()
    expect(section.querySelector('[data-lien-board-bin="notice:to_send"]')!.getAttribute('data-folded')).toBeNull()
    // No bin is lit as the busiest, and with no press on the Board none has the blue edge.
    expect(section.querySelector('[data-lit]')).toBeNull()
    expect(section.querySelector('[data-act]')).toBeNull()
  })
  it('an approved notice stands in Approved · to sign until the leader signs it (v2.7712), in Approved · to print until its packet prints and in Approved · to mail after, each bin under its own name; the two that can go open the run and the unsigned one opens its notice', () => {
    const onChip = vi.fn()
    const b = board({ notices: [notice('4', 'ready', { item: item('i4', SIGNED) }), notice('5', 'printed', { item: item('i5', { ...SIGNED, printed_at: '2026-11-14T10:00:00Z' }) }), notice('6', 'ready', { item: item('i6'), earliestDeadline: '2026-12-15', daysLeft: 30 })], affidavits: [] })
    render(<LienBoard board={b} isMobile={false} onChip={onChip} />)
    const head = (key: string) => document.querySelector(`[data-lien-board-bin-head="${key}"]`)!.textContent
    expect(head('notice:to_sign')).toBe('Approved · to sign1')
    expect(head('notice:to_print')).toBe('Approved · to print1')
    expect(head('notice:in_mail')).toBe('Approved · to mail1')
    const chips = (key: string) => Array.from(document.querySelectorAll(`[data-lien-board-chips="${key}"] [data-lien-board-chip]`)).map((el) => el.textContent)
    expect(chips('notice:to_sign')).toEqual(['JP6'])
    expect(chips('notice:to_print')).toEqual(['JP4'])
    expect(chips('notice:in_mail')).toEqual(['JP5'])
    // The unsigned one is violet, as every paper that waits on the leader is.
    expect(document.querySelector('[data-lien-board-chip="6"]')!.getAttribute('data-urgency')).toBe('waiting')
    fireEvent.click(document.querySelector('[data-lien-board-chip="4"]') as HTMLElement)
    expect(onChip.mock.calls[0]![0]).toMatchObject({ jobId: '4', stage: 'to_print', destination: { kind: 'run', itemId: 'i4', jobId: '4' } })
    fireEvent.click(document.querySelector('[data-lien-board-chip="5"]') as HTMLElement)
    expect(onChip.mock.calls[1]![0]).toMatchObject({ jobId: '5', stage: 'in_mail', destination: { kind: 'run', itemId: 'i5', jobId: '5' } })
    fireEvent.click(document.querySelector('[data-lien-board-chip="6"]') as HTMLElement)
    expect(onChip.mock.calls[2]![0]).toMatchObject({ jobId: '6', stage: 'to_sign', destination: { kind: 'paper', tab: 'notices', jobId: '6' } })
    // The tiles over them: the unsigned notice is the second tile's, and the third counts the two bins under it.
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
      'notice:needs_owner': box(0, 0), 'notice:to_send': box(0, 100), 'notice:awaiting': box(0, 200), 'notice:to_sign': box(0, 300), 'notice:to_print': box(0, 400), 'notice:in_mail': box(0, 500), 'notice:sent': box(0, 600),
      'affidavit:needs_property': box(300, 0), 'affidavit:needs_notice': box(300, 100), 'affidavit:to_send': box(300, 200), 'affidavit:awaiting': box(300, 300), 'affidavit:ready': box(300, 400), 'affidavit:filed': box(300, 500), 'affidavit:served': box(300, 600),
    }
    const lines = lienBoardArrowPaths(b.arrows, boxes, false)
    // Six down the notices (v2.7448, and Approved · to sign since v2.7712), six down the affidavits (v2.7457, and Served since v2.7497), one across.
    expect(lines).toHaveLength(13)
    expect(lines.some((l) => l.key === 'affidavit:filed>affidavit:served')).toBe(true)
    expect(lines[0]).toEqual({ key: 'notice:needs_owner>notice:to_send', kind: 'down', d: 'M 100 60 L 100 99' })
    expect(lines.slice(2, 4)).toEqual([
      { key: 'notice:awaiting>notice:to_sign', kind: 'down', d: 'M 100 260 L 100 299' },
      { key: 'notice:to_sign>notice:to_print', kind: 'down', d: 'M 100 360 L 100 399' },
    ])
    // The crossing arrow lands on the second bin of the affidavits (v2.7457): the one a recorded mailing empties.
    expect(lines[12]).toEqual({ key: 'notice:sent>affidavit:needs_notice', kind: 'cross', d: 'M 200 630 H 250 V 130 L 299 130' })
    expect(lienBoardArrowPaths(b.arrows, boxes, true)).toHaveLength(12)
    // With the columns measured the vertical run sits in the gutter between them, clear of a bin beside the notices.
    const withColumns = { ...boxes, 'col:notice': { left: 0, top: 0, width: 240, height: 600 }, 'col:affidavit': { left: 300, top: 0, width: 240, height: 600 } }
    expect(lienBoardArrowPaths(b.arrows, withColumns, false)[12]!.d).toBe('M 200 630 H 270 V 130 L 299 130')
    // A bin not drawn (Missed while empty) has no box and so no arrow; nothing throws.
    expect(lienBoardArrowPaths([{ from: 'notice:missed', to: 'affidavit:missed', kind: 'down' }], boxes, false)).toEqual([])
  })
  it('the leader’s press stands on his bin’s title line, among every bin (v2.7708; his own two bins and their switch are retired)', () => {
    const b = board({ notices: [notice('1', 'awaiting'), notice('2', 'to_draft')], affidavits: [affidavit('3', 'awaiting'), affidavit('4', 'awaiting', { deadline: '2026-11-10', daysLeft: -5 }), affidavit('5', 'ready')] })
    const onApprove = vi.fn()
    const words = lienBoardLeaderBinPress(lienBoardForLeader(b))!
    expect(words).toEqual({ label: 'Approve 1 affidavit', dead: false, line: '1 is past its day and stays here.' })
    const press = (over: Record<string, unknown> = {}) => ({ 'affidavit:awaiting': { label: words.label, onPress: onApprove, filled: true, dead: words.dead, lines: [{ key: 'late', words: words.line! }], marks: { 'data-lien-board-approve': 'yes' }, ...over } })
    const { rerender } = render(<LienBoard board={b} isMobile={false} binPress={press()} />)
    const section = screen.getByRole('region', { name: 'The Board' })
    // Every bin stands, and no switch narrows them.
    expect(section.querySelectorAll('[data-lien-board-bin]').length).toBeGreaterThan(2)
    expect(section.querySelector('[data-lien-board-leader-bar]')).toBeNull()
    expect(section.querySelector('[data-lien-board-mine]')).toBeNull()
    const approve = section.querySelector('[data-lien-board-approve]') as HTMLButtonElement
    expect(approve.textContent).toBe('Approve 1 affidavit')
    // It is on the title line of the bin it empties, after the bin's name and count, and filled.
    const title = section.querySelector('[data-lien-board-bin-title="affidavit:awaiting"]') as HTMLElement
    expect(approve.parentElement).toBe(title)
    expect(Array.from(title.children).map((el) => el.getAttribute('data-lien-board-bin-head') ?? el.getAttribute('data-lien-board-bin-press'))).toEqual(['affidavit:awaiting', 'affidavit:awaiting'])
    expect(approve.style.background).toBe('rgb(37, 99, 235)')
    expect(section.querySelector('[data-lien-board-bin="affidavit:awaiting"] [data-lien-board-bin-line="late"]')!.textContent).toBe('1 is past its day and stays here.')
    fireEvent.click(approve)
    expect(onApprove).toHaveBeenCalledTimes(1)
    // Busy: the press waits under its own words.
    rerender(<LienBoard board={b} isMobile={false} binPress={press({ label: 'Approving…', dead: true })} />)
    expect((section.querySelector('[data-lien-board-approve]') as HTMLButtonElement).disabled).toBe(true)
    expect(section.querySelector('[data-lien-board-approve]')!.textContent).toBe('Approving…')
    // No affidavit of his waits: no press. A notice takes his signature in its own column.
    const none = board({ notices: [notice('1', 'awaiting')], affidavits: [] })
    expect(lienBoardLeaderBinPress(lienBoardForLeader(none))).toBeNull()
    // A dev reading another master's jobs leads none of them: no press.
    expect(lienBoardLeaderBinPress(lienBoardForLeader(b, { leads: () => false }))).toBeNull()
    // Only late ones wait: the press is dead and the line says why.
    const late = board({ notices: [], affidavits: [affidavit('4', 'awaiting', { deadline: '2026-11-10', daysLeft: -5 }), affidavit('6', 'awaiting', { deadline: '2026-11-11', daysLeft: -4 })] })
    expect(lienBoardLeaderBinPress(lienBoardForLeader(late))).toEqual({ label: 'Approve affidavits', dead: true, line: '2 are past their day and stay here.' })
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

describe('LienBoard · every press on its bin’s title line (v2.7708, punch list #383; the two prints stood in a band under the tiles since v2.7483)', () => {
  const sides = () => ({ notice: lienBoardNoticePrint({ toPrint: 15, waits: 7, printed: 0 }), affidavit: lienBoardAffidavitPrint({ ready: 10, held: 2, earlierForm: 0, stack: { helpSheet: true, noticeRecord: false, noticeCopies: false } }) })
  const handlers = () => ({ onPress: vi.fn(), onLeft: vi.fn(), onNote: vi.fn() })
  const bin = (key: string) => document.querySelector(`[data-lien-board-bin="${key}"]`) as HTMLElement

  it('each print stands on the title line of the bin it empties: the press with its count, and what the affidavits print with when that is not the usual stack', () => {
    const h = handlers()
    render(<LienBoard board={board()} isMobile={false} columnsOnly prints={{ ...sides(), ...h }} />)
    // Nothing stands between the tiles and the chart.
    expect(document.querySelector('[data-lien-board-prints]')).toBeNull()
    const tiles = document.querySelector('[data-lien-board-tiles]') as HTMLElement
    expect(tiles.nextElementSibling!.hasAttribute('data-lien-board-grid')).toBe(true)
    const left = bin('notice:to_print')
    const right = bin('affidavit:ready')
    expect(document.querySelectorAll('[data-lien-board-print-press]')).toHaveLength(2)
    // The press is on the title line, after the bin's name and count; the lines stand under it, over the chips.
    const title = left.querySelector('[data-lien-board-bin-title]') as HTMLElement
    expect(Array.from(title.children).map((el) => el.textContent)).toEqual(['Approved · to print0', 'Print and mail 8 notices'])
    const parts = (el: HTMLElement) => Array.from(el.children).map((c) => (c.hasAttribute('data-lien-board-bin-title') ? 'title' : c.hasAttribute('data-lien-board-bin-line') ? 'line' : 'chips'))
    expect(parts(right)).toEqual(['title', 'line', 'chips'])
    expect(within(left).getByRole('button', { name: 'Print and mail 8 notices' }).style.background).toBe('rgb(37, 99, 235)')
    // The notices' print has no line (v2.7712): what waits on a signature stands in its own bin, Approved · to sign.
    expect(parts(left)).toEqual(['title', 'chips'])
    expect(left.querySelector('[data-lien-board-print-left]')).toBeNull()
    expect(left.querySelector('[data-lien-board-print-note]')).toBeNull()
    // A held affidavit has no line (v2.7783): its chip stands in the bin with a hold mark.
    expect(right.querySelector('[data-lien-board-print-left]')).toBeNull()
    // The stack is not the usual one here, so the bin says so, and its press is the way back to the usual pages.
    expect(right.querySelector('[data-lien-board-print-note]')!.textContent).toBe('Prints without the notice records · Put them back ›')
    fireEvent.click(within(left).getByRole('button', { name: 'Print and mail 8 notices' }))
    expect(h.onPress.mock.calls[0]![0]).toMatchObject({ kind: 'notice', act: 'print_run', bin: 'notice:to_print' })
    fireEvent.click(within(right).getByRole('button', { name: 'Print 10 for notarization' }))
    expect(h.onPress.mock.calls[1]![0]).toMatchObject({ kind: 'affidavit', act: 'print_affidavits', bin: 'affidavit:ready' })
    fireEvent.click(within(right).getByRole('button', { name: 'Put them back ›' }))
    expect(h.onNote).toHaveBeenCalledTimes(1)
  })

  it('Back from the clerk (v2.7856): its door is a line under the print on Ready to file, and the bin’s own press where no print takes the line', () => {
    const onPress = vi.fn()
    const door = { label: 'Enter document numbers · 3 ›', onPress, under: [{ key: 'filings', words: 'Back from the clerk?', tone: 'muted' as const, doors: [{ key: 'filings', label: 'Enter document numbers · 3 ›', onPress }] }] }
    const b = board({ affidavits: [affidavit('8', 'ready')] })
    render(<LienBoard board={b} isMobile={false} columnsOnly binPress={{ 'affidavit:ready': door }} prints={{ notice: null, affidavit: lienBoardAffidavitPrint({ ready: 3, held: 0, earlierForm: 0, stack: LIEN_BOARD_USUAL_STACK }), ...handlers() }} />)
    const ready = document.querySelector('[data-lien-board-bin="affidavit:ready"]') as HTMLElement
    // The print keeps the title line. The door stands on a line of its own under it.
    expect(within(ready.querySelector('[data-lien-board-bin-title]') as HTMLElement).getByRole('button', { name: 'Print 3 for notarization' })).toBeTruthy()
    const line = ready.querySelector('[data-lien-board-bin-line]') as HTMLElement
    expect(line.textContent).toContain('Back from the clerk?')
    fireEvent.click(within(line).getByRole('button', { name: 'Enter document numbers · 3 ›' }))
    expect(onPress).toHaveBeenCalledTimes(1)
    cleanup()
    // With no print on the bin, the door is the bin's own press and draws no line.
    render(<LienBoard board={b} isMobile={false} columnsOnly binPress={{ 'affidavit:ready': door }} />)
    const alone = document.querySelector('[data-lien-board-bin="affidavit:ready"]') as HTMLElement
    expect(alone.querySelector('[data-lien-board-bin-line]')).toBeNull()
    fireEvent.click(within(alone).getByRole('button', { name: 'Enter document numbers · 3 ›' }))
    expect(onPress).toHaveBeenCalledTimes(2)
  })

  it('the usual stack draws no line under Ready to file, and neither does a held paper: the bin is its name, its count, its press and its chips', () => {
    const b = board({ affidavits: [affidavit('8', 'ready')] })
    render(<LienBoard board={b} isMobile={false} columnsOnly prints={{ notice: null, affidavit: lienBoardAffidavitPrint({ ready: 10, held: 2, earlierForm: 0, stack: LIEN_BOARD_USUAL_STACK }), ...handlers() }} />)
    const ready = document.querySelector('[data-lien-board-bin="affidavit:ready"]') as HTMLElement
    expect(ready.querySelector('[data-lien-board-bin-line]')).toBeNull()
    expect(Array.from(ready.children).map((c) => (c.hasAttribute('data-lien-board-bin-title') ? 'title' : 'chips'))).toEqual(['title', 'chips'])
    expect(within(ready).getByRole('button', { name: 'Print 10 for notarization' })).toBeTruthy()
  })

  it('a paper on the earlier form keeps its line and its door, since its chip stands in the bin unmarked', () => {
    const h = handlers()
    const b = board({ affidavits: [affidavit('8', 'ready'), affidavit('9', 'ready')] })
    render(<LienBoard board={b} isMobile={false} columnsOnly prints={{ notice: null, affidavit: lienBoardAffidavitPrint({ ready: 1, held: 0, earlierForm: 1, stack: LIEN_BOARD_USUAL_STACK }), ...h }} />)
    const ready = document.querySelector('[data-lien-board-bin="affidavit:ready"]') as HTMLElement
    expect(ready.querySelector('[data-lien-board-print-left]')!.textContent).toBe('1 on the earlier form · See it ›')
    fireEvent.click(within(ready).getByRole('button', { name: 'See it ›' }))
    expect(h.onLeft.mock.calls[0]![0].kind).toBe('affidavit')
  })

  it('a held paper stands in the bin of its stage with a hold mark, after the chips that can move, in its day’s colour, and the bin counts what its press takes (v2.7783)', () => {
    const closed = [gate('owner', true), gate('legal', true), gate('homestead_answer', false)]
    const b = board({
      affidavits: [
        affidavit('8', 'ready', { item: item('a8') }),
        // Approved, then a fact came to hold it: one past its day, one with a month left.
        affidavit('11', 'held', { item: item('a11'), ready: false, gates: closed, deadline: '2026-11-13', daysLeft: -2 }),
        affidavit('13', 'held', { item: item('a13'), ready: false, gates: closed }),
        // The leader held this one: it waits on him again.
        affidavit('12', 'held', { item: item('a12', { status: 'held' }) }),
      ],
    })
    const onChip = vi.fn()
    render(<LienBoard board={b} isMobile={false} columnsOnly onChip={onChip} prints={{ notice: null, affidavit: lienBoardAffidavitPrint({ ready: 1, held: 2, earlierForm: 0, stack: LIEN_BOARD_USUAL_STACK }), ...handlers() }} />)
    expect(document.querySelector('[data-lien-board-bin$=":held"]')).toBeNull()
    expect(document.querySelector('[data-lien-board-heading="affidavit"] [data-lien-board-bin]')).toBeNull()
    const ready = bin('affidavit:ready')
    // One number: the count beside the press that takes as many. The two held chips stand after the one that prints.
    expect(Array.from(ready.querySelector('[data-lien-board-bin-title]')!.children).map((el) => el.textContent)).toEqual(['Ready to file1', 'Print 1 for notarization'])
    expect(ready.querySelector('[data-lien-board-bin-line]')).toBeNull()
    const chips = Array.from(ready.querySelectorAll('[data-lien-board-chip]')) as HTMLElement[]
    expect(chips.map((el) => [el.textContent, el.getAttribute('data-held'), el.getAttribute('data-urgency')])).toEqual([['JP8', null, 'later'], ['JP11‖', 'yes', 'day'], ['JP13‖', 'yes', 'later']])
    // The hold is the dashed edge and the mark. The colour is still the day's: red for the late one, grey for the other.
    expect(chips.map((el) => el.style.borderStyle)).toEqual(['', 'dashed', 'dashed'])
    expect(chips.map((el) => el.style.marginLeft)).toEqual(['', '8px', ''])
    expect(chips[1]!.querySelector('[data-lien-board-held-mark]')!.getAttribute('aria-hidden')).toBe('true')
    expect(chips[1]!.getAttribute('aria-label')).toContain('held on a property fact')
    // The held chip's press is the door to the fact that holds it.
    fireEvent.click(chips[1]!)
    expect(onChip.mock.calls[0]![0]).toMatchObject({ jobId: '11', held: true, destination: { kind: 'property', focus: 'homestead_answer' } })
    // The leader's hold stands in his bin. Nothing there can move, so the bin reads 0 and still shows its chip.
    const awaiting = bin('affidavit:awaiting')
    expect(awaiting.getAttribute('data-folded')).toBeNull()
    expect(awaiting.querySelector('[data-lien-board-count]')!.textContent).toBe('0')
    const leaderHeld = awaiting.querySelector('[data-lien-board-chip]') as HTMLElement
    expect([leaderHeld.textContent, leaderHeld.getAttribute('data-held'), leaderHeld.style.marginLeft]).toEqual(['JP12‖', 'yes', ''])
    expect(leaderHeld.getAttribute('aria-label')).toContain('held by the leader')
  })

  it('a bin that holds only held papers shows no press: nothing in it can print', () => {
    const closed = [gate('owner', true), gate('legal', true), gate('homestead_answer', false)]
    const b = board({ affidavits: [affidavit('11', 'held', { item: item('a11'), ready: false, gates: closed })] })
    render(<LienBoard board={b} isMobile={false} columnsOnly prints={{ notice: null, affidavit: lienBoardAffidavitPrint({ ready: 0, held: 1, earlierForm: 0, stack: LIEN_BOARD_USUAL_STACK }), ...handlers() }} />)
    const ready = bin('affidavit:ready')
    expect(ready.querySelector('[data-lien-board-bin-press]')).toBeNull()
    expect(ready.querySelector('[data-lien-board-count]')!.textContent).toBe('0')
    expect(ready.querySelector('[data-lien-board-chip]')!.textContent).toBe('JP11‖')
    expect(ready.getAttribute('data-act')).toBeNull()
  })

  it('once every notice has printed the notices’ press stands on Approved · to mail, named for the mail numbers', () => {
    const h = handlers()
    render(<LienBoard board={board()} isMobile={false} columnsOnly prints={{ notice: lienBoardNoticePrint({ toPrint: 0, waits: 0, printed: 1 }), affidavit: null, ...h }} />)
    const press = bin('notice:in_mail').querySelector('[data-lien-board-print-press]') as HTMLButtonElement
    expect(press.textContent).toBe('Enter mail numbers · 1')
    expect(bin('notice:to_print').querySelector('[data-lien-board-bin-press]')).toBeNull()
    fireEvent.click(press)
    expect(h.onPress.mock.calls[0]![0]).toMatchObject({ act: 'record_run', bin: 'notice:in_mail' })
    // While notices still wait to print, the desk hands the same door for that bin; with none printed, or none left to print, it hands none.
    expect(lienBoardMailNumbersPress({ toPrint: 3, printed: 6 })).toEqual({ label: 'Enter mail numbers · 6' })
    expect(lienBoardMailNumbersPress({ toPrint: 3, printed: 0 })).toBeNull()
    expect(lienBoardMailNumbersPress({ toPrint: 0, printed: 6 })).toBeNull()
  })

  it('Approved · to sign carries the office’s reminder on its title line, and for the leader the door to sign them; dead it reads when it went (v2.7491; on the bin since v2.7712)', () => {
    const onPress = vi.fn()
    const b = board({ notices: [notice('9', 'ready', { item: item('i9') }), notice('10', 'ready', { item: item('i10', SIGNED) })] })
    const remind = (over: Record<string, unknown> = {}) => ({ 'notice:to_sign': { label: 'Remind Malachi of 1 paper ›', onPress, marks: { 'data-lien-board-remind': 'yes' }, ...over } })
    const view = render(<LienBoard board={b} isMobile={false} columnsOnly binPress={remind()} prints={{ notice: lienBoardNoticePrint({ toPrint: 2, waits: 1, printed: 0 }), affidavit: null, ...handlers() }} />)
    const press = document.querySelector('[data-lien-board-remind]') as HTMLButtonElement
    expect(press.parentElement!.getAttribute('data-lien-board-bin-title')).toBe('notice:to_sign')
    expect(press.textContent).toBe('Remind Malachi of 1 paper ›')
    // An outline: the bin's act is the leader's, and this is the office's nudge.
    expect(press.style.background).toBe('var(--surface)')
    // The print bin under it holds what the print takes, and says so with one number.
    expect(bin('notice:to_print').querySelector('[data-lien-board-bin-title]')!.textContent).toBe('Approved · to print1Print and mail 1 notice')
    fireEvent.click(press)
    expect(onPress).toHaveBeenCalledTimes(1)
    view.unmount()
    const sent = render(<LienBoard board={b} isMobile={false} columnsOnly binPress={remind({ label: 'Reminded at 2:14 PM', dead: true })} />)
    expect((document.querySelector('[data-lien-board-remind]') as HTMLButtonElement).textContent).toBe('Reminded at 2:14 PM')
    expect((document.querySelector('[data-lien-board-remind]') as HTMLButtonElement).disabled).toBe(true)
    sent.unmount()
    // The leader's own desk: the door to the notices that take his signature, filled, since the act is his.
    const door = lienBoardSignDoor({ mine: 1 })!
    render(<LienBoard board={b} isMobile={false} columnsOnly binPress={{ 'notice:to_sign': { label: door.label, onPress, filled: true, marks: { 'data-lien-board-sign': 'yes' } } }} />)
    const sign = document.querySelector('[data-lien-board-sign]') as HTMLButtonElement
    expect(sign.textContent).toBe('Sign 1 notice ›')
    expect(sign.style.background).toBe('rgb(37, 99, 235)')
    expect(document.querySelector('[data-lien-board-remind]')).toBeNull()
  })

  it('a leader’s Sign press counts his own notices, the line under the bin’s name says what waits on another leader, and the blue edge is on the bin only when the act is his (v2.7853)', () => {
    const onPress = vi.fn()
    const b = board({ notices: [notice('9', 'ready', { item: item('i9') }), notice('11', 'ready', { item: item('i11') }), notice('12', 'ready', { item: item('i12') })] })
    const toSign = () => document.querySelector('[data-lien-board-bin="notice:to_sign"]') as HTMLElement
    // He leads two of the three: the bin reads 3, the press takes 2 and the line names the other 1.
    const door = lienBoardSignDoor({ mine: 2, others: 1, othersLeader: 'Malachi' })!
    const mixed = render(<LienBoard board={b} isMobile={false} columnsOnly binPress={{ 'notice:to_sign': { label: door.label, onPress, filled: true, lines: [{ key: 'others', words: door.line!, marks: { 'data-lien-board-sign-others': 'yes' } }], marks: { 'data-lien-board-sign': 'yes' } } }} />)
    expect(toSign().querySelector('[data-lien-board-count]')!.textContent).toBe('3')
    expect((document.querySelector('[data-lien-board-sign]') as HTMLButtonElement).textContent).toBe('Sign 2 notices ›')
    expect(document.querySelector('[data-lien-board-sign-others]')!.textContent).toBe('1 waits on Malachi.')
    expect(toSign().getAttribute('data-act')).toBe('yes')
    fireEvent.click(document.querySelector('[data-lien-board-sign]') as HTMLButtonElement)
    expect(onPress).toHaveBeenCalledTimes(1)
    mixed.unmount()
    // He leads none of them: the kernel hands no door, the desk draws the office's reminder, and the bin has no blue edge.
    expect(lienBoardSignDoor({ mine: 0, others: 3, othersLeader: 'Malachi' })).toBeNull()
    render(<LienBoard board={b} isMobile={false} columnsOnly binPress={{ 'notice:to_sign': { label: 'Remind Malachi of 3 papers ›', onPress, quiet: true, marks: { 'data-lien-board-remind': 'yes' } } }} />)
    expect(document.querySelector('[data-lien-board-sign]')).toBeNull()
    expect(toSign().getAttribute('data-act')).toBeNull()
    expect(toSign().style.borderLeft).toBe('')
  })

  it('a press with nothing ready is dead while its bin holds a paper; in an empty bin it is not drawn; a column with no approved paper has no press', () => {
    const h = handlers()
    const held = board({ notices: [notice('9', 'ready', { item: item('i9', SIGNED) })] })
    const view = render(<LienBoard board={held} isMobile={false} columnsOnly prints={{ notice: lienBoardNoticePrint({ toPrint: 2, waits: 2, printed: 0 }), affidavit: null, ...h }} />)
    const press = bin('notice:to_print').querySelector('[data-lien-board-print-press]') as HTMLButtonElement
    expect(press.disabled).toBe(true)
    fireEvent.click(press)
    expect(h.onPress).not.toHaveBeenCalled()
    expect(bin('affidavit:ready').querySelector('[data-lien-board-bin-press]')).toBeNull()
    view.unmount()
    // Every approved notice waits on a signature: they stand in Approved · to sign, and the empty print bin draws no dead press.
    const unsigned = board({ notices: [notice('9', 'ready', { item: item('i9') })] })
    render(<LienBoard board={unsigned} isMobile={false} columnsOnly prints={{ notice: lienBoardNoticePrint({ toPrint: 1, waits: 1, printed: 0 }), affidavit: null, ...h }} />)
    expect(document.querySelector('[data-lien-board-print-press]')).toBeNull()
    expect(bin('notice:to_print').querySelector('[data-lien-board-count]')!.textContent).toBe('0')
    expect(bin('notice:to_sign').querySelector('[data-lien-board-count]')!.textContent).toBe('1')
  })

  it('the third tile opens the run again on a computer, with the print in its bin or with none; on a phone, where the print stands right under the tiles, it only reads', () => {
    const onTile = vi.fn()
    const view = render(<LienBoard board={board()} isMobile={false} columnsOnly onTile={onTile} prints={{ ...sides(), ...handlers() }} />)
    fireEvent.click(document.querySelector('button[data-lien-board-tile="in_mail"]') as HTMLButtonElement)
    expect(onTile).toHaveBeenCalledWith({ kind: 'run' })
    view.unmount()
    const phone = render(<LienBoard board={board()} isMobile onTile={onTile} prints={{ ...sides(), ...handlers() }} />)
    expect(document.querySelector('button[data-lien-board-tile="in_mail"]')).toBeNull()
    expect(document.querySelector('[data-lien-board-tile="in_mail"]')).toBeTruthy()
    phone.unmount()
    render(<LienBoard board={board()} isMobile onTile={onTile} />)
    expect(document.querySelector('button[data-lien-board-tile="in_mail"]')).toBeTruthy()
  })

  it('on a phone the two stand in one row over the folded bins, in their short words, the notices’ first; an opened bin draws the lines without the press a second time', () => {
    const h = handlers()
    render(<LienBoard board={board()} isMobile prints={{ ...sides(), ...h }} />)
    const row = document.querySelector('[data-lien-board-prints]') as HTMLElement
    expect(row.getAttribute('data-layout')).toBe('row')
    expect(Array.from(row.children).map((el) => el.textContent)).toEqual(['Print and mail 8 notices', 'Print 10 for notarization'])
    // One row on every phone (v2.7847): a grid of equal columns, a column a press, so the second can never fall under the first. A press may narrow to nothing and wraps its own words.
    expect(row.style.display).toBe('grid')
    expect(row.style.gridTemplateColumns).toBe('repeat(2, minmax(0, 1fr))')
    expect(Array.from(row.children).map((el) => (el as HTMLElement).style.minWidth)).toEqual(['0', '0'])
    expect((document.querySelector('[data-lien-board-grid]') as HTMLElement).style.display).toBe('none')
    fireEvent.click(row.children[1] as HTMLButtonElement)
    expect(h.onPress.mock.calls[0]![0]).toMatchObject({ kind: 'affidavit' })
    fireEvent.click(document.querySelector('[data-lien-board-fold]') as HTMLButtonElement)
    expect(document.querySelectorAll('[data-lien-board-print-press]')).toHaveLength(2)
    expect(bin('affidavit:ready').querySelector('[data-lien-board-bin-press]')).toBeNull()
    expect(bin('affidavit:ready').querySelector('[data-lien-board-print-note]')!.textContent).toBe('Prints without the notice records · Put them back ›')
  })

  it('a Board handed no prints draws none', () => {
    render(<LienBoard board={board()} isMobile={false} columnsOnly />)
    expect(document.querySelector('[data-lien-board-print-press]')).toBeNull()
    expect(document.querySelector('[data-lien-board-bin-press]')).toBeNull()
  })

  it('a bin’s own press stands on its title line, an outline when it is a door to a window (punch list #366; under the chips until v2.7708)', () => {
    const onPress = vi.fn()
    const b = board({ affidavits: [affidavit('8', 'filed'), affidavit('9', 'filed')], serve: [{ jobId: '8', serveDue: '2026-11-16' }] })
    const binPress = { 'affidavit:filed': { label: 'Print 1 lien’s copies ›', onPress }, 'affidavit:ready': { label: 'never drawn', onPress } } as const
    render(<LienBoard board={b} isMobile={false} binPress={binPress} />)
    const press = document.querySelector('[data-lien-board-bin-press="affidavit:filed"]') as HTMLButtonElement
    expect(press.textContent).toBe('Print 1 lien’s copies ›')
    expect(press.parentElement!.getAttribute('data-lien-board-bin-title')).toBe('affidavit:filed')
    expect(press.style.background).toBe('var(--surface)')
    fireEvent.click(press)
    expect(onPress).toHaveBeenCalledTimes(1)
    // A bin with no chip draws no press, and the served lien stands in its own bin.
    expect(document.querySelector('[data-lien-board-bin-press="affidavit:ready"]')).toBeNull()
    expect(document.querySelector('[data-lien-board-chips="affidavit:served"]')!.textContent).toContain('JP9')
  })

  it('a bin whose own press is live has the blue edge, something to do now; a dead press, the office’s reminder and a bin with no press have none (v2.7714)', () => {
    const b = board({ notices: [notice('9', 'ready', { item: item('i9') }), notice('10', 'ready', { item: item('i10', SIGNED) })], affidavits: [affidavit('3', 'to_draft'), affidavit('8', 'ready')] })
    const onPress = vi.fn()
    const binPress = { 'notice:to_sign': { label: 'Remind Malachi of 1 paper ›', onPress, quiet: true }, 'affidavit:to_send': { label: lienBoardSendDoor(1)!.label, onPress, marks: { 'data-lien-board-send': 'yes' } } }
    render(<LienBoard board={b} isMobile={false} columnsOnly binPress={binPress} prints={{ notice: lienBoardNoticePrint({ toPrint: 2, waits: 1, printed: 0 }), affidavit: lienBoardAffidavitPrint({ ready: 0, held: 1, earlierForm: 0, stack: LIEN_BOARD_USUAL_STACK }), ...handlers() }} />)
    const edged = Array.from(document.querySelectorAll('[data-act="yes"]')).map((el) => el.getAttribute('data-lien-board-bin'))
    // The print that can go, and the door to the affidavits to send. Not the reminder's bin, and not the dead print's.
    expect(edged).toEqual(['notice:to_print', 'affidavit:to_send'])
    expect((bin('notice:to_print') as HTMLElement).style.borderLeft).toBe('3px solid rgb(37, 99, 235)')
    expect(bin('notice:to_sign').getAttribute('data-act')).toBeNull()
    expect((bin('affidavit:ready').querySelector('[data-lien-board-print-press]') as HTMLButtonElement).disabled).toBe(true)
    expect(bin('affidavit:ready').getAttribute('data-act')).toBeNull()
    const send = document.querySelector('[data-lien-board-send]') as HTMLButtonElement
    expect(send.textContent).toBe('Send 1 for approval ›')
    expect(send.parentElement!.getAttribute('data-lien-board-bin-title')).toBe('affidavit:to_send')
    fireEvent.click(send)
    expect(onPress).toHaveBeenCalledTimes(1)
  })
})

describe('LienBoard · a bin with no paper has a quiet name (v2.7845, the owner’s ask of 2026-11-18)', () => {
  /** Each bin as the page draws it: is it folded, its dashed edge, and the style its name and its count carry. */
  const read = () =>
    Array.from(document.querySelectorAll<HTMLElement>('[data-lien-board-bin]')).map((el) => {
      const head = el.querySelector<HTMLElement>('[data-lien-board-bin-head]')!
      const count = el.querySelector<HTMLElement>('[data-lien-board-count]')!
      return { key: el.getAttribute('data-lien-board-bin')!, chips: el.querySelectorAll('[data-lien-board-chip]').length, folded: el.getAttribute('data-folded') === 'yes', dashed: el.style.borderStyle === 'dashed', name: [head.style.color, head.style.fontWeight], count: [count.style.color, count.style.fontWeight] }
    })
  const QUIET = [LIEN_BOARD_QUIET_HEAD.color, String(LIEN_BOARD_QUIET_HEAD.fontWeight)]

  it('greys the name and the count of every bin that holds no chip, lighter than bold, and leaves a bin with a chip as it was', () => {
    render(<LienBoard board={board()} isMobile={false} columnsOnly />)
    const bins = read()
    // The token and the weight themselves: a muted grey that still reads, never a raw hex.
    expect(QUIET).toEqual(['var(--text-muted)', '600'])
    const by = (key: string) => bins.find((b) => b.key === key)!
    // Empty: the dashed edge and the quiet name together.
    expect(by('affidavit:filed')).toMatchObject({ chips: 0, folded: true, dashed: true, name: QUIET, count: QUIET })
    expect(by('affidavit:served')).toMatchObject({ chips: 0, folded: true, dashed: true, name: QUIET, count: QUIET })
    // With a chip: the name keeps the sheet's own colour and bold, the count its strong figure.
    expect(by('notice:to_send')).toMatchObject({ chips: 2, folded: false, dashed: false, name: ['', ''], count: ['var(--text-strong)', '700'] })
    expect(by('affidavit:ready')).toMatchObject({ chips: 1, folded: false, name: ['', ''] })
    // One flag for both: on every bin the dashed edge, the quiet name and the quiet count agree, and each is there only with no chip.
    expect(bins.length).toBe(14)
    for (const b of bins) {
      expect([b.key, b.dashed, b.name[0] === QUIET[0], b.count[1] === QUIET[1]]).toEqual([b.key, b.folded, b.folded, b.folded])
      expect([b.key, b.folded]).toEqual([b.key, b.chips === 0])
    }
    expect(bins.filter((b) => b.folded).length).toBeGreaterThan(0)
    expect(bins.filter((b) => !b.folded).length).toBeGreaterThan(0)
  })

  it('keeps the rule when a bin’s head is a press, and on a phone with the bins opened', () => {
    render(<LienBoard board={board()} isMobile onPick={vi.fn()} />)
    fireEvent.click(document.querySelector('[data-lien-board-fold]') as HTMLElement)
    const bins = read()
    expect(document.querySelector('[data-lien-board-bin="affidavit:filed"] [data-lien-board-bin-head]')!.tagName).toBe('BUTTON')
    expect(bins.find((b) => b.key === 'affidavit:filed')).toMatchObject({ folded: true, dashed: true, name: QUIET, count: QUIET })
    expect(bins.find((b) => b.key === 'notice:to_send')).toMatchObject({ folded: false, dashed: false, name: ['', ''] })
    for (const b of bins) expect([b.key, b.name[0] === QUIET[0]]).toEqual([b.key, b.folded])
  })

  it('an empty bin that offers a live press is not quiet: its name and its press stay at full strength', () => {
    render(<LienBoard board={board()} isMobile={false} columnsOnly binPress={{ 'affidavit:filed': { label: 'Mail the copies ›', onPress: vi.fn(), filled: true, whenEmpty: true } }} />)
    const live = read().find((b) => b.key === 'affidavit:filed')!
    expect(live).toMatchObject({ chips: 0, folded: false, dashed: false, name: ['', ''] })
    const press = document.querySelector('[data-lien-board-bin-press="affidavit:filed"]') as HTMLButtonElement
    expect([press.disabled, press.style.color, press.style.background]).toEqual([false, 'rgb(255, 255, 255)', 'rgb(37, 99, 235)'])
    // A dead press in an empty bin is not drawn, so that bin folds and goes quiet like any other.
    cleanup()
    render(<LienBoard board={board()} isMobile={false} columnsOnly binPress={{ 'affidavit:filed': { label: 'Mail the copies ›', onPress: vi.fn(), filled: true, whenEmpty: true, dead: true } }} />)
    expect(read().find((b) => b.key === 'affidavit:filed')).toMatchObject({ folded: true, dashed: true, name: QUIET, count: QUIET })
    expect(document.querySelector('[data-lien-board-bin-press="affidavit:filed"]')).toBeNull()
  })
})
