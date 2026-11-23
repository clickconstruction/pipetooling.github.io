// @vitest-environment jsdom
/**
 * The flow of a lien paper on a phone (punch list #428, the owner's pick of 2026-11-23: *One screen, pinned line*):
 * the switch, the flow as counts in two columns, the day's one line, the pinned line while a stage's papers are the
 * screen, a cell that moves the pick, and the way back. The rule is `lienBoardFlow.test.ts`; this is the wiring.
 * A computer draws none of it. Every job and count here is made up.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import LienBoard, { type LienBoardBinPress } from './LienBoard'
import { buildLienBoard, lienBoardLeaderPick, lienBoardPick, type LienBoardBinKey, type LienBoardInput } from '../../lib/jobs/lienBoard'
import { lienBoardLatePick } from '../../lib/jobs/lienBoardDayLine'
import { LIEN_FLOW_VIEW_STORAGE_KEY } from '../../lib/jobs/lienBoardFlow'
import type { LienDeskEntry, LienDeskPile } from '../../lib/jobs/lienDesk'
import type { LienAffidavitEntry, LienAffidavitGate, LienAffidavitPile } from '../../lib/jobs/lienDeskAffidavits'

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})

const TODAY = '2026-11-15'
function notice(jobId: string, pile: LienDeskPile, over: Partial<LienDeskEntry> = {}): LienDeskEntry {
  return { jobId, customerId: 'c1', gcCustomerId: 'gc1', openBalance: 1000, hasOwner: pile !== 'needs_owner', propertyKind: '', months: [], datedFromCreation: false, dueMonths: ['2026-08'], missedMonths: [], missedUnrecorded: [], affidavitDay: null, affidavitDaysLeft: null, earliestDeadline: '2026-12-15', daysLeft: 30, severity: 'quiet', gates: [], ready: true, item: null, pile, ...over } as LienDeskEntry
}
const gate = (key: LienAffidavitGate['key'], ok: boolean): LienAffidavitGate => ({ key, ok, label: key })
function affidavit(jobId: string, pile: LienAffidavitPile, over: Partial<LienAffidavitEntry> = {}): LienAffidavitEntry {
  return { jobId, isSub: true, lastMonth: '2026-07', lastMonthFromCreation: false, deadline: '2026-12-15', daysLeft: 30, severity: 'quiet', openBalance: 1000, customerId: 'c1', gcCustomerId: 'gc1', propertyKind: '', gates: [gate('owner', true), gate('legal', true)], ready: true, item: null, pile, ...over }
}
function board(over: Partial<LienBoardInput> = {}) {
  return buildLienBoard({
    todayYmd: TODAY,
    notices: [
      notice('2101', 'needs_owner'),
      notice('2102', 'to_draft'),
      notice('2103', 'to_draft', { earliestDeadline: '2026-11-20', daysLeft: 5 }),
      notice('2104', 'awaiting'),
      // Past its day and still able to go: the day tile's red line counts it.
      notice('2105', 'to_draft', { earliestDeadline: '2026-11-10', daysLeft: -5 }),
      notice('2106', 'sent'),
    ],
    affidavits: [affidavit('2101', 'needs_property', { gates: [gate('owner', false), gate('legal', false)] }), affidavit('2108', 'ready'), affidavit('2109', 'missed', { deadline: '2026-11-10', daysLeft: -5 })],
    retainage: [],
    jobNumber: (id) => id,
    jobName: (id) => `ZZ Test Job ${id}`,
    gcName: () => 'Alder Ridge Builders',
    leaderName: 'Sam',
    ...over,
  })
}

const section = () => screen.getByRole('region', { name: 'The Board' })
const stage = (key: string) => document.querySelector(`[data-lien-board-stage="${key}"]`) as HTMLElement
const stageRead = (key: string) => [stage(key).querySelector('[data-lien-board-stage-name]')!.textContent, stage(key).querySelector('[data-lien-board-stage-count]')!.textContent]
const showFlow = () => fireEvent.click(document.querySelector('[data-lien-board-switch-press="flow"]') as HTMLButtonElement)

describe('LienBoard on a phone · the switch', () => {
  it('stands in the fold’s place, By day pressed the first time: the tiles, and no flow', () => {
    render(<LienBoard board={board()} isMobile />)
    const sw = document.querySelector('[data-lien-board-switch]') as HTMLElement
    expect(Array.from(sw.querySelectorAll('button')).map((b) => [b.textContent, b.getAttribute('aria-pressed'), b.style.minHeight])).toEqual([
      ['By day', 'true', '44px'],
      ['The flow', 'false', '44px'],
    ])
    expect(section().getAttribute('data-lien-board-phone')).toBe('day')
    expect(section().querySelectorAll('[data-lien-board-tile]')).toHaveLength(4)
    expect(document.querySelector('[data-lien-board-phone-flow]')).toBeNull()
    expect(document.querySelector('[data-lien-board-fold]')).toBeNull()
  })

  it('The flow draws the flow and stands the tiles down; By day puts them back; the phone keeps the view last used', () => {
    const first = render(<LienBoard board={board()} isMobile />)
    showFlow()
    expect(section().getAttribute('data-lien-board-phone')).toBe('flow')
    expect(document.querySelector('[data-lien-board-phone-flow]')).toBeTruthy()
    expect(document.querySelector('[data-lien-board-tiles]')).toBeNull()
    expect(window.localStorage.getItem(LIEN_FLOW_VIEW_STORAGE_KEY)).toBe('flow')
    first.unmount()
    // The next visit opens where the last one was.
    render(<LienBoard board={board()} isMobile />)
    expect(section().getAttribute('data-lien-board-phone')).toBe('flow')
    fireEvent.click(document.querySelector('[data-lien-board-switch-press="day"]') as HTMLButtonElement)
    expect(section().getAttribute('data-lien-board-phone')).toBe('day')
    expect(document.querySelector('[data-lien-board-phone-flow]')).toBeNull()
    expect(window.localStorage.getItem(LIEN_FLOW_VIEW_STORAGE_KEY)).toBe('day')
  })

  it('an empty desk has no switch: the tiles and the words that say so', () => {
    window.localStorage.setItem(LIEN_FLOW_VIEW_STORAGE_KEY, 'flow')
    render(<LienBoard board={board({ notices: [], affidavits: [] })} isMobile />)
    expect(document.querySelector('[data-lien-board-switch]')).toBeNull()
    expect(document.querySelector('[data-lien-board-phone-flow]')).toBeNull()
    expect(section().querySelectorAll('[data-lien-board-tile]')).toHaveLength(4)
    expect(document.querySelector('[data-lien-board-empty-board]')!.textContent).toContain('Nothing is on the desk.')
  })

  it('a computer draws no switch, no flow and no pinned line, whatever the phone last chose', () => {
    window.localStorage.setItem(LIEN_FLOW_VIEW_STORAGE_KEY, 'flow')
    const b = board()
    render(<LienBoard board={b} isMobile={false} columnsOnly onPick={vi.fn()} pick={lienBoardPick(b, ['notice:to_send'])} />)
    expect(document.querySelector('[data-lien-board-switch]')).toBeNull()
    expect(document.querySelector('[data-lien-board-phone-flow]')).toBeNull()
    expect(document.querySelector('[data-lien-board-line]')).toBeNull()
    expect(section().hasAttribute('data-lien-board-phone')).toBe(false)
    expect(document.querySelectorAll('[data-lien-board-bin]').length).toBeGreaterThan(10)
    expect(section().style.position).toBe('relative')
  })
})

describe('LienBoard on a phone · the flow', () => {
  it('is the two columns side by side, each stage one press a fingertip tall with its name and its count, and no chip', () => {
    render(<LienBoard board={board()} isMobile onPick={vi.fn()} />)
    showFlow()
    const flow = document.querySelector('[data-lien-board-phone-flow]') as HTMLElement
    expect(flow.style.gridTemplateColumns).toBe('minmax(0, 1fr) minmax(0, 1fr)')
    expect(Array.from(flow.querySelectorAll('[data-lien-board-flow-column]')).map((c) => [c.getAttribute('data-lien-board-flow-column'), c.querySelector('h3')!.textContent])).toEqual([
      ['notice', 'Monthly notices'],
      ['affidavit', 'Lien affidavits'],
    ])
    expect(Array.from(flow.querySelectorAll('[data-lien-board-flow-column="notice"] [data-lien-board-stage]')).map((el) => el.getAttribute('data-lien-board-stage'))).toEqual(['notice:needs_owner', 'notice:to_send', 'notice:awaiting', 'notice:to_sign', 'notice:to_print', 'notice:in_mail', 'notice:sent'])
    // The affidavits' closed end is drawn while a job is in it, last.
    expect(Array.from(flow.querySelectorAll('[data-lien-board-flow-column="affidavit"] [data-lien-board-stage]')).map((el) => el.getAttribute('data-lien-board-stage'))).toEqual(['affidavit:needs_property', 'affidavit:needs_notice', 'affidavit:to_send', 'affidavit:awaiting', 'affidavit:ready', 'affidavit:filed', 'affidavit:served', 'affidavit:missed'])
    expect(stageRead('notice:to_send')).toEqual(['To send for Master approval', '3'])
    expect(stageRead('affidavit:ready')).toEqual(['Ready to file', '1'])
    for (const el of Array.from(flow.querySelectorAll<HTMLElement>('[data-lien-board-stage]'))) {
      expect([el.getAttribute('data-lien-board-stage'), el.tagName, el.style.minHeight]).toEqual([el.getAttribute('data-lien-board-stage'), 'BUTTON', '44px'])
    }
    expect(document.querySelector('[data-lien-board-chip]')).toBeNull()
    expect(document.querySelector('[data-lien-board-bin]')).toBeNull()
  })

  it('draws an empty stage dashed and muted, the closed end dashed, and a stage’s count in its papers’ worst colour', () => {
    render(<LienBoard board={board()} isMobile onPick={vi.fn()} />)
    showFlow()
    const empty = stage('notice:to_print')
    expect([empty.getAttribute('data-empty'), empty.style.borderStyle, empty.style.color]).toEqual(['yes', 'dashed', 'var(--text-muted)'])
    const closed = stage('affidavit:missed')
    expect([closed.getAttribute('data-closed'), closed.style.borderStyle, closed.getAttribute('data-tone')]).toEqual(['yes', 'dashed', null])
    const full = stage('notice:sent')
    expect([full.getAttribute('data-empty'), full.style.borderStyle]).toEqual([null, 'solid'])
    // To send holds a paper past its day: red. Awaiting waits on the leader, its day far off: violet.
    expect([stage('notice:to_send').getAttribute('data-tone'), (stage('notice:to_send').querySelector('[data-lien-board-stage-count]') as HTMLElement).style.color]).toEqual(['red', 'var(--text-red-700)'])
    expect([stage('notice:awaiting').getAttribute('data-tone'), (stage('notice:awaiting').querySelector('[data-lien-board-stage-count]') as HTMLElement).style.color]).toEqual(['violet', 'var(--text-violet-700)'])
  })

  it('says the day in one line over it, and the red part still narrows the list to the papers it counts', () => {
    const onTile = vi.fn()
    render(<LienBoard board={board()} isMobile onTile={onTile} onPick={vi.fn()} />)
    showFlow()
    const day = document.querySelector('[data-lien-board-flow-day]') as HTMLElement
    expect(day.querySelector('[data-lien-board-flow-day-figure]')!.getAttribute('data-tone')).toBe('red')
    expect(day.textContent).toContain('1 is past its day.')
    expect(day.textContent).not.toContain('to send')
    const press = day.querySelector('[data-lien-board-flow-day-press]') as HTMLButtonElement
    expect(press.textContent).toContain('Show them ›')
    fireEvent.click(press)
    expect(onTile).toHaveBeenCalledWith({ kind: 'late' })
  })

  it('a pressed stage asks for its papers', () => {
    const onPick = vi.fn()
    render(<LienBoard board={board()} isMobile onPick={onPick} />)
    showFlow()
    fireEvent.click(stage('notice:to_send'))
    expect(onPick).toHaveBeenCalledWith('notice:to_send')
  })

  it('keeps under it what the bins had under them: the retainage line, the desk’s lines and the prints', () => {
    render(<LienBoard board={board({ retainage: [{ jobId: '2110', retainageHeld: 500, contractEndedOn: '2026-09-20', contractEndedHow: 'complete', deadline: '2026-10-20', daysLeft: 15, severity: 'amber', noticed: false, inClaim: false, openBalance: 1000, customerId: 'c1', gcCustomerId: 'gc1', propertyKind: '', hasOwner: true, paymentBond: 'unknown', gates: [], ready: true, item: null, pile: 'to_draft' }] })} isMobile over={<div data-test-over />} underAffidavits={<div data-test-under />} foot={<div data-test-foot />} />)
    // By day: the desk's line over the bins and its foot still show, and what stood in the grid does not.
    expect(document.querySelector('[data-test-over]')).toBeTruthy()
    expect(document.querySelector('[data-test-foot]')).toBeTruthy()
    expect(document.querySelector('[data-test-under]')).toBeNull()
    expect(document.querySelector('[data-lien-board-retainage]')).toBeNull()
    showFlow()
    const order = Array.from(section().children).map((el) => (el.hasAttribute('data-lien-board-switch') ? 'switch' : el.hasAttribute('data-lien-board-flow-day') ? 'day' : el.hasAttribute('data-lien-board-phone-flow') ? 'flow' : el.hasAttribute('data-lien-board-retainage-row') ? 'retainage' : el.hasAttribute('data-test-over') ? 'over' : el.hasAttribute('data-test-under') ? 'under' : el.hasAttribute('data-test-foot') ? 'foot' : '?'))
    expect(order).toEqual(['switch', 'day', 'flow', 'retainage', 'over', 'under', 'foot'])
  })

  it('a tile’s pick keeps the line under the Board, and draws no pinned line', () => {
    const b = board()
    const onPick = vi.fn()
    const late = render(<LienBoard board={b} isMobile onPick={onPick} pick={lienBoardLatePick(b)} shown={1} />)
    expect(document.querySelector('[data-lien-board-line]')).toBeNull()
    expect(document.querySelector('[data-lien-board-pick-words]')!.textContent).toContain('Showing 1 row')
    fireEvent.click(document.querySelector('[data-lien-board-pick-clear]') as HTMLButtonElement)
    expect(onPick).toHaveBeenCalledWith(null)
    late.unmount()
    render(<LienBoard board={b} isMobile onPick={onPick} pick={lienBoardLeaderPick(b, 'Sam')} shown={1} />)
    expect(document.querySelector('[data-lien-board-line]')).toBeNull()
    expect(document.querySelector('[data-lien-board-pick]')).toBeTruthy()
  })
})

describe('LienBoard on a phone · the pinned line', () => {
  const picked = (b: ReturnType<typeof board>, key: LienBoardBinKey) => lienBoardPick(b, [key])

  it('is all the Board draws while one stage is picked: the way back, where the stage stands, its name and count, and its column’s cells', () => {
    const b = board()
    render(<LienBoard board={b} isMobile onPick={vi.fn()} pick={picked(b, 'notice:awaiting')} shown={1} />)
    expect(section().getAttribute('data-lien-board-phone')).toBe('line')
    expect(document.querySelector('[data-lien-board-switch]')).toBeNull()
    expect(document.querySelector('[data-lien-board-tiles]')).toBeNull()
    expect(document.querySelector('[data-lien-board-phone-flow]')).toBeNull()
    expect(document.querySelector('[data-lien-board-pick]')).toBeNull()
    const line = document.querySelector('[data-lien-board-line]') as HTMLElement
    expect(line.getAttribute('data-lien-board-line')).toBe('notice:awaiting')
    const back = line.querySelector('[data-lien-board-line-back]') as HTMLElement
    expect([back.textContent, back.style.minHeight]).toEqual(['‹ The flow', '44px'])
    expect(line.querySelector('[data-lien-board-line-where]')!.textContent).toBe('Monthly notices, stage 3 of 7')
    expect(line.querySelector('[data-lien-board-line-name]')!.textContent).toBe('Awaiting Master approval · 1')
    const cells = Array.from(line.querySelectorAll<HTMLElement>('[data-lien-board-line-cell]'))
    expect(cells.map((c) => [c.textContent, c.getAttribute('data-lit'), c.style.minHeight])).toEqual([
      ['1', null, '44px'],
      ['3', null, '44px'],
      ['1', 'yes', '44px'],
      ['0', null, '44px'],
      ['0', null, '44px'],
      ['0', null, '44px'],
      ['1', null, '44px'],
    ])
    expect(cells[2]!.getAttribute('aria-current')).toBe('true')
    expect(cells[1]!.getAttribute('aria-label')).toBe('To send for Master approval, 3')
  })

  it('sticks to the top of the desk’s scroller, over the list’s headings, and tells the desk its height', () => {
    const b = board()
    const onPinned = vi.fn()
    const view = render(<LienBoard board={b} isMobile onPick={vi.fn()} pick={picked(b, 'notice:awaiting')} onPinned={onPinned} />)
    expect([section().style.position, section().style.top, section().style.zIndex, section().style.background]).toEqual(['sticky', '0px', '3', 'var(--surface)'])
    expect(onPinned).toHaveBeenCalled()
    // With no stage picked nothing is pinned, and the desk is told so.
    onPinned.mockClear()
    view.rerender(<LienBoard board={b} isMobile onPick={vi.fn()} pick={null} onPinned={onPinned} />)
    expect(section().style.position).toBe('relative')
    expect(onPinned).toHaveBeenLastCalledWith(0)
  })

  it('a cell moves the pick to its stage, the lit cell does nothing, and ‹ The flow asks for every row', () => {
    const b = board()
    const onPick = vi.fn()
    render(<LienBoard board={b} isMobile onPick={onPick} pick={picked(b, 'notice:awaiting')} />)
    fireEvent.click(document.querySelector('[data-lien-board-line-cell="notice:to_send"]') as HTMLButtonElement)
    expect(onPick).toHaveBeenLastCalledWith('notice:to_send')
    onPick.mockClear()
    fireEvent.click(document.querySelector('[data-lien-board-line-cell="notice:awaiting"]') as HTMLButtonElement)
    expect(onPick).not.toHaveBeenCalled()
    fireEvent.click(document.querySelector('[data-lien-board-line-back]') as HTMLButtonElement)
    expect(onPick).toHaveBeenCalledWith(null)
  })

  it('the way back opens the flow with that stage still lit, whatever view the phone was on', () => {
    const b = board()
    const view = render(<LienBoard board={b} isMobile onPick={vi.fn()} pick={picked(b, 'affidavit:ready')} />)
    view.rerender(<LienBoard board={b} isMobile onPick={vi.fn()} pick={null} />)
    expect(section().getAttribute('data-lien-board-phone')).toBe('flow')
    expect(stage('affidavit:ready').getAttribute('data-lit')).toBe('yes')
    expect(document.querySelectorAll('[data-lien-board-stage][data-lit="yes"]')).toHaveLength(1)
  })

  it('draws the bin’s own press with its lines and doors, so no act the bins offered is lost', () => {
    const b = board()
    const onPress = vi.fn()
    const onDoor = vi.fn()
    const press = (over: Partial<LienBoardBinPress> = {}): Partial<Record<LienBoardBinKey, LienBoardBinPress>> => ({
      'notice:awaiting': { label: 'Remind Sam of 1 paper ›', onPress, quiet: true, lines: [{ key: 'left', words: '1 left out', tone: 'amber', doors: [{ key: 'see', label: 'See it ›', onPress: onDoor }] }], ...over },
    })
    const view = render(<LienBoard board={b} isMobile onPick={vi.fn()} pick={picked(b, 'notice:awaiting')} binPress={press()} />)
    const act = document.querySelector('[data-lien-board-line] [data-lien-board-bin-press="notice:awaiting"]') as HTMLButtonElement
    expect([act.textContent, act.style.minHeight, act.style.width]).toEqual(['Remind Sam of 1 paper ›', '44px', '100%'])
    fireEvent.click(act)
    expect(onPress).toHaveBeenCalledTimes(1)
    expect(document.querySelector('[data-lien-board-line] [data-lien-board-bin-line="left"]')!.textContent).toBe('1 left out · See it ›')
    fireEvent.click(document.querySelector('[data-lien-board-line] [data-lien-board-bin-door="see"]') as HTMLButtonElement)
    expect(onDoor).toHaveBeenCalledTimes(1)
    // A dead press is drawn dead, and a filled one in the desk's blue.
    view.rerender(<LienBoard board={b} isMobile onPick={vi.fn()} pick={picked(b, 'notice:awaiting')} binPress={press({ dead: true })} />)
    expect((document.querySelector('[data-lien-board-line] [data-lien-board-bin-press]') as HTMLButtonElement).disabled).toBe(true)
    view.rerender(<LienBoard board={b} isMobile onPick={vi.fn()} pick={picked(b, 'notice:awaiting')} binPress={press({ filled: true })} />)
    expect((document.querySelector('[data-lien-board-line] [data-lien-board-bin-press]') as HTMLElement).style.color).toBe('rgb(255, 255, 255)')
  })

  it('draws no press for a stage with no paper, unless the press says it is live when empty', () => {
    const b = board()
    const live: LienBoardBinPress = { label: 'Enter mail numbers · 2 ›', onPress: vi.fn() }
    const view = render(<LienBoard board={b} isMobile onPick={vi.fn()} pick={picked(b, 'notice:in_mail')} binPress={{ 'notice:in_mail': live }} />)
    expect(document.querySelector('[data-lien-board-line-name]')!.textContent).toBe('Approved · to mail · 0')
    expect(document.querySelector('[data-lien-board-line] [data-lien-board-bin-press]')).toBeNull()
    view.rerender(<LienBoard board={b} isMobile onPick={vi.fn()} pick={picked(b, 'notice:in_mail')} binPress={{ 'notice:in_mail': { ...live, whenEmpty: true } }} />)
    expect(document.querySelector('[data-lien-board-line] [data-lien-board-bin-press]')!.textContent).toBe('Enter mail numbers · 2 ›')
  })
})
