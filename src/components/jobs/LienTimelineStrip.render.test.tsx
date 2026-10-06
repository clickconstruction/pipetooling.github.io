// @vitest-environment jsdom
/**
 * Steps · Windows (v2.3815, punch list #42): the strip opens on Steps — today's rail plus the
 * green first-day line — and the corner switch draws the same path as windows, remembered in
 * this browser. The mini row has no switch.
 */
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import LienTimelineStrip from './LienTimelineStrip'
import { buildLienTimeline } from '../../lib/jobs/lienTimeline'
import { setLienTimelineView } from '../../hooks/useLienTimelineView'

const timeline = buildLienTimeline({
  todayYmd: '2026-09-24',
  isSub: true,
  propertyKind: '',
  lastMonth: '2026-08',
  lastMonthFromCreation: false,
  months: [
    { key: '2026-03', deadline: '2026-06-15', fromCreation: false, outcome: 'missed', at: '' },
    { key: '2026-07', deadline: '2026-10-15', fromCreation: false, outcome: 'open', at: '' },
    { key: '2026-08', deadline: '2026-11-16', fromCreation: false, outcome: 'open', at: '' },
  ],
  noticeState: 'needs_owner',
  retainage: null,
  affidavit: null,
  originalContractCompletedOn: null,
  releasedAt: null,
  paid: false,
})

describe('LienTimelineStrip — Steps · Windows', () => {
  it('opens on Steps with the first-day line, then switches to Windows and remembers it', () => {
    setLienTimelineView('steps')
    const { container } = render(<LienTimelineStrip timeline={timeline} layout="row" />)
    expect(container.querySelector('[data-lien-timeline]')?.getAttribute('data-view')).toBe('steps')
    expect(screen.getByText('open since Aug 1')).toBeTruthy()
    expect(screen.getByText('opens when the notice is mailed')).toBeTruthy()
    expect(container.querySelector('[data-lien-timeline-windows-aside]')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Windows' }))
    expect(container.querySelector('[data-lien-timeline]')?.getAttribute('data-view')).toBe('windows')
    expect(container.querySelector('[data-lien-timeline-window="notice:2026-07"]')?.textContent).toContain('Aug 1 → Oct 15 · 21 of 75 days left')
    expect(container.querySelector('[data-lien-timeline-window="affidavit"]')?.textContent).toContain('opens when the notice is mailed · by Dec 15')
    expect(container.querySelector('[data-lien-timeline-windows-closed]')?.textContent).toContain('Mar closed Jun 15 — it was open Apr 1 → Jun 15')
    expect(container.querySelector('[data-lien-timeline-windows-aside]')?.textContent).toContain('the lien can be filed any day until Dec 15')
    expect(window.localStorage.getItem('lienTimelineView')).toBe('windows')

    fireEvent.click(screen.getByRole('button', { name: 'Steps' }))
    expect(container.querySelector('[data-lien-timeline]')?.getAttribute('data-view')).toBe('steps')
    expect(window.localStorage.getItem('lienTimelineView')).toBe('steps')
  })

  it('the mini row never changes and has no switch', () => {
    setLienTimelineView('windows')
    const { container } = render(<LienTimelineStrip timeline={timeline} layout="mini" withNext={false} />)
    expect(container.querySelector('[data-lien-timeline]')?.getAttribute('data-view')).toBe('steps')
    expect(screen.queryByRole('button', { name: 'Windows' })).toBeNull()
    expect(container.querySelector('[data-lien-timeline-opens]')).toBeNull()
    setLienTimelineView('steps')
  })
})

describe('LienTimelineStrip — whose move, the demand letter, Waiting on (v2.3877, punch list #32)', () => {
  const withLetter = buildLienTimeline({
    todayYmd: '2026-09-27',
    isSub: true,
    propertyKind: 'commercial',
    lastMonth: '2026-07',
    lastMonthFromCreation: false,
    months: [
      { key: '2026-06', deadline: '2026-09-15', fromCreation: false, outcome: 'sent', at: '2026-08-14T15:00:00Z' },
      { key: '2026-07', deadline: '2026-10-15', fromCreation: false, outcome: 'sent', at: '2026-09-12T15:00:00Z' },
    ],
    noticeState: 'sent',
    retainage: null,
    affidavit: null,
    originalContractCompletedOn: null,
    releasedAt: null,
    paid: false,
    demandLetters: [{ sentAt: '2026-09-14T16:00:00Z', deadlineDate: '2026-09-28', amount: 8940, openRemaining: 8940, debtorParty: 'gc' }],
  })

  it('the row: a square letter node with its words, a move word under each live node, and the Waiting-on line', () => {
    setLienTimelineView('steps')
    const { container } = render(<LienTimelineStrip timeline={withLetter} layout="row" />)
    const letter = container.querySelector('[data-lien-timeline-step="demand"]')!
    expect(letter.textContent).toContain('Demand letter')
    expect(letter.textContent).toContain('reply by Sep 28')
    expect(letter.textContent).toContain('tomorrow · sent Sep\u00a014 · $8,940')
    expect(letter.querySelector('[data-lien-timeline-move="gc"]')?.textContent).toBe('the GC')
    expect((letter.querySelector('span[aria-hidden]') as HTMLElement).style.borderRadius).toBe('3px')
    expect(container.querySelector('[data-lien-timeline-step="affidavit"] [data-lien-timeline-move="ours"]')?.textContent).toBe('ours')
    expect(container.querySelector('[data-lien-timeline-step="notice:2026-07"] [data-lien-timeline-move]')).toBeNull()
    expect(container.querySelector('[data-lien-timeline-waiting]')?.textContent).toBe('Waiting onthe GC— a reply to the Sep 14 demand letter by Sep 28 · $8,940')
  })

  it('the list carries the word as a chip in front of the step; the mini row carries neither word nor line', () => {
    const list = render(<LienTimelineStrip timeline={withLetter} layout="list" />)
    const row = list.container.querySelector('[data-lien-timeline-step="demand"]')!
    expect(row.querySelector('[data-lien-timeline-move="gc"]')).toBeTruthy()
    expect(list.container.querySelector('[data-lien-timeline-waiting]')).toBeTruthy()
    list.unmount()
    const mini = render(<LienTimelineStrip timeline={withLetter} layout="mini" withNext={false} />)
    expect(mini.container.querySelector('[data-lien-timeline-move]')).toBeNull()
    expect(mini.container.querySelector('[data-lien-timeline-waiting]')).toBeNull()
    expect(mini.container.querySelector('[data-lien-timeline-step="demand"]')?.textContent).toBe('!reply by Sep 28')
  })

  it('Windows lists the letter as a line of words with its reply-by day', () => {
    const { container } = render(<LienTimelineStrip timeline={withLetter} layout="row" view="windows" />)
    expect(container.querySelector('[data-lien-timeline-window="demand"]')?.textContent).toContain('reply by Sep 28')
    setLienTimelineView('steps')
  })
})

describe('LienTimelineStrip — closed months fold into one node (v2.4111)', () => {
  const folded = buildLienTimeline({
    todayYmd: '2026-09-28',
    isSub: true,
    propertyKind: 'residential',
    lastMonth: '2026-09',
    lastMonthFromCreation: false,
    months: [
      { key: '2026-05', deadline: '2026-08-17', fromCreation: false, outcome: 'missed', at: '2026-09-21T15:00:00Z' },
      { key: '2026-06', deadline: '2026-09-15', fromCreation: false, outcome: 'missed', at: '2026-09-21T15:00:00Z' },
      { key: '2026-07', deadline: '2026-09-15', fromCreation: false, outcome: 'missed', at: '2026-09-21T15:00:00Z' },
      { key: '2026-08', deadline: '2026-09-15', fromCreation: false, outcome: 'missed', at: '' },
      { key: '2026-09', deadline: '2026-10-15', fromCreation: false, outcome: 'open', at: '' },
    ],
    noticeState: 'to_draft',
    retainage: null,
    affidavit: null,
    originalContractCompletedOn: null,
    releasedAt: null,
    paid: false,
  })
  it('one stacked node with a count badge; the door fans the months open and names the one still to note', () => {
    setLienTimelineView('steps')
    const { container } = render(<LienTimelineStrip timeline={folded} layout="row" />)
    expect(container.querySelectorAll('[data-lien-timeline-fold]').length).toBe(1)
    expect(container.querySelector('[data-lien-timeline-fold-count]')?.textContent).toBe('4')
    expect(screen.getByText('4 windows closed')).toBeTruthy()
    expect(screen.getByText('1 to note')).toBeTruthy()
    expect(container.querySelector('[data-lien-timeline-fold-tray]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /show the months/ }))
    const tray = container.querySelector('[data-lien-timeline-fold-tray]')
    expect(tray).not.toBeNull()
    expect(tray!.querySelectorAll('[data-lien-timeline-step]').length).toBe(4)
    expect(screen.getByText('§ 53.056 · Aug')).toBeTruthy()
    expect(screen.getByText('not noted')).toBeTruthy()
  })
  it('the mini row draws the stacked node and no door', () => {
    const { container } = render(<LienTimelineStrip timeline={folded} layout="mini" withNext={false} />)
    expect(container.querySelectorAll('[data-lien-timeline-fold]').length).toBe(1)
    expect(container.querySelector('[data-lien-timeline-fold-door]')).toBeNull()
  })
})
