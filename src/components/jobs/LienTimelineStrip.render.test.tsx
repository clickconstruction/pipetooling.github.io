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
    // The closed month is a bar on the calendar, struck at its last day, not a footnote (v2.4652).
    const closed = container.querySelector('[data-lien-timeline-window="notice:2026-03"]')!
    expect(closed.getAttribute('data-lien-timeline-window-kind')).toBe('closed')
    expect(closed.textContent).toContain('open Apr 1 → Jun 15 · closed, nothing sent')
    expect(closed.querySelector('[data-lien-timeline-chip]')?.textContent).toBe('not noted')
    expect(closed.querySelector('[data-lien-timeline-struck]')).toBeTruthy()
    expect(container.querySelectorAll('[data-lien-timeline-windows-tick]').length).toBe(9)
    const legend = container.querySelector('[data-lien-timeline-windows-legend]')!.textContent!
    expect(legend).toContain('▭ a window that closed')
    expect(legend).toContain('┄ opens when the notice is mailed')
    expect(legend).not.toContain('never opened')
    expect(container.querySelector('[data-lien-timeline-windows-aside]')?.textContent).toContain('the lien can be filed any day until Dec 15')
    // The verdict band leads the calendar.
    const verdict = container.querySelector('[data-lien-timeline-verdict]')!
    expect(verdict.getAttribute('data-tone')).toBe('quiet')
    expect(verdict.compareDocumentPosition(container.querySelector('[data-lien-timeline-windows]')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(verdict.querySelector('[data-lien-timeline-next]')).toBeTruthy()
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
  it('the calendar draws a run of more than three closed months as one bar with the fold\'s count', () => {
    const { container } = render(<LienTimelineStrip timeline={folded} layout="row" view="windows" />)
    const bars = container.querySelectorAll('[data-lien-timeline-window-kind="closed"]')
    expect(bars.length).toBe(1)
    expect(bars[0]!.textContent).toContain('4 windows closed')
    expect(bars[0]!.querySelector('[data-lien-timeline-chip]')?.textContent).toBe('1 to note')
  })
})

describe('LienTimelineStrip — one story (v2.4652): job 890 on 2026-10-06, the lien is gone', () => {
  // A residential sub job whose only work month, July, closed Sep 15 with nothing sent — nothing open, nothing ahead.
  const gone = buildLienTimeline({
    todayYmd: '2026-10-06',
    isSub: true,
    propertyKind: 'residential',
    lastMonth: '2026-07',
    lastMonthFromCreation: false,
    months: [{ key: '2026-07', deadline: '2026-09-15', fromCreation: false, outcome: 'missed', at: '' }],
    noticeState: '',
    retainage: null,
    affidavit: null,
    originalContractCompletedOn: null,
    releasedAt: null,
    paid: false,
  })
  it('verdict first, in red, with Waiting on inside the band', () => {
    const { container } = render(<LienTimelineStrip timeline={gone} layout="row" view="windows" />)
    const verdict = container.querySelector('[data-lien-timeline-verdict]')!
    expect(verdict.getAttribute('data-tone')).toBe('red')
    expect(verdict.textContent).toContain('Lien: gone. Money: still owed — chase it in Collections.')
    expect(verdict.querySelector('[data-lien-timeline-waiting]')?.textContent).toContain('Waiting onus')
    expect(verdict.compareDocumentPosition(container.querySelector('[data-lien-timeline-windows]')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
  it('July\'s closed window is a struck bar, the lien a dotted ghost under it with no date, the axis three months', () => {
    const { container } = render(<LienTimelineStrip timeline={gone} layout="row" view="windows" />)
    const jul = container.querySelector('[data-lien-timeline-window="notice:2026-07"]')!
    expect(jul.getAttribute('data-lien-timeline-window-kind')).toBe('closed')
    expect(jul.textContent).toContain('open Aug 1 → Sep 15 · closed, nothing sent')
    expect(jul.querySelector('[data-lien-timeline-chip]')?.textContent).toBe('not noted')
    const lien = container.querySelector('[data-lien-timeline-window="affidavit"]')!
    expect(lien.getAttribute('data-lien-timeline-window-kind')).toBe('ghost')
    expect(lien.firstElementChild!.textContent).toBe('§ 53.052 lien↳ needs the notice above')
    expect(lien.textContent).toContain('blocked — it would have run Sep 15 → Oct 15, once the notice was mailed')
    expect(lien.querySelector('[data-lien-timeline-move]')).toBeNull()
    expect(container.querySelectorAll('[data-lien-timeline-windows-tick]').length).toBe(3)
    expect(Array.from(container.querySelectorAll('[data-lien-timeline-windows-tick]')).map((t) => t.getAttribute('data-lien-timeline-windows-tick'))).toEqual(['2026-08', '2026-09', '2026-10'])
  })
  it('today runs only across the bar rows; the undated retainage is a line of words; serve and suit are one quiet sentence; the legend names only the marks drawn', () => {
    const { container } = render(<LienTimelineStrip timeline={gone} layout="row" view="windows" />)
    expect(container.querySelectorAll('[data-lien-timeline-today]').length).toBe(2)
    const ret = container.querySelector('[data-lien-timeline-window="retainage"]')!
    expect(ret.getAttribute('data-lien-timeline-window-kind')).toBe('undated')
    expect(ret.querySelector('[data-lien-timeline-today]')).toBeNull()
    expect(container.querySelector('[data-lien-timeline-window="serve"]')).toBeNull()
    expect(container.querySelector('[data-lien-timeline-windows-after]')?.textContent).toBe('§ 53.055 serve · § 53.158 suit follow a filing. None can follow on this job.')
    const legend = container.querySelector('[data-lien-timeline-windows-legend]')!.textContent!
    expect(legend).toContain('▭ a window that closed')
    expect(legend).toContain('┈ a window that never opened')
    expect(legend).toContain('│ today')
    expect(legend).not.toContain('days already gone')
    expect(legend).not.toContain('opens when the notice is mailed')
  })
})
