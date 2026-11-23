// @vitest-environment jsdom
/**
 * Steps · Windows (v2.3815, punch list #42): the strip opens on Steps — today's rail plus the
 * green first-day line — and the corner switch draws the same path as windows, remembered in
 * this browser. The mini row has no switch.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import LienTimelineStrip, { LienTimelineViewSwitch } from './LienTimelineStrip'
import { buildLienTimeline } from '../../lib/jobs/lienTimeline'
import { setLienTimelineView } from '../../hooks/useLienTimelineView'

const timeline = buildLienTimeline({
  todayYmd: '2026-09-24',
  isSub: true,
  // Commercial: the months' own dates are the 3rd-month notices.
  propertyKind: 'non_residential',
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
  it('the pane can lift the switch to its title line (v2.7317): switchOutside keeps the box bare, and LienTimelineViewSwitch drives the same view', () => {
    setLienTimelineView('steps')
    const { container } = render(
      <>
        <LienTimelineViewSwitch />
        <LienTimelineStrip timeline={timeline} layout="row" switchOutside />
      </>,
    )
    expect(container.querySelectorAll('[data-lien-timeline-switch]').length).toBe(1)
    expect(container.querySelector('[data-lien-timeline] [data-lien-timeline-switch]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Windows' }))
    expect(container.querySelector('[data-lien-timeline]')?.getAttribute('data-view')).toBe('windows')
  })

  it('inside a phone’s open paper the switch’s two presses are a thumb tall (v2.7392): the switch clips a pad, so the stylesheet grows them', () => {
    setLienTimelineView('steps')
    const { container } = render(
      <div data-lien-pane-phone="yes">
        <LienTimelineStrip timeline={timeline} layout="list" />
      </div>,
    )
    // The rule reaches the switch by these two hooks, and the switch still clips: that is why a pad would not do.
    const group = container.querySelector('[data-lien-pane-phone] [data-lien-timeline-switch]') as HTMLElement
    expect(group.style.overflow).toBe('hidden')
    expect([...group.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['Steps', 'Windows'])
    const css = readFileSync(join(process.cwd(), 'src/index.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
    expect(css).toMatch(/\[data-lien-pane-phone\] \[data-lien-timeline-switch\] button \{[^}]*min-height: 40px;/)
    // The pad the rest of the pane's small presses get is drawn by the same sheet.
    expect(css).toMatch(/\[data-lien-pane-phone\] \[data-press-pad\]::after \{[^}]*position: absolute;/)
  })

  it('the Legal desk’s scope opens on Windows and remembers its own choice apart from the Lien window’s (v2.6104)', () => {
    setLienTimelineView('steps')
    const { container, unmount } = render(<LienTimelineStrip timeline={timeline} layout="row" viewScope="desk" />)
    expect(container.querySelector('[data-lien-timeline]')?.getAttribute('data-view')).toBe('windows')
    fireEvent.click(screen.getByRole('button', { name: 'Steps' }))
    expect(container.querySelector('[data-lien-timeline]')?.getAttribute('data-view')).toBe('steps')
    unmount()
    // The Lien window's strip still reads its own remembered view.
    const { container: win } = render(<LienTimelineStrip timeline={timeline} layout="row" />)
    expect(win.querySelector('[data-lien-timeline]')?.getAttribute('data-view')).toBe('steps')
    setLienTimelineView('windows', 'desk')
  })

  it('opens on Steps with the first-day line, then switches to Windows and remembers it', () => {
    setLienTimelineView('steps')
    const { container } = render(<LienTimelineStrip timeline={timeline} layout="row" />)
    expect(container.querySelector('[data-lien-timeline]')?.getAttribute('data-view')).toBe('steps')
    // The day in the first-day line is its own bold value since punch list #399, so the line is read whole.
    expect(container.querySelector('[data-lien-timeline-step="notice:2026-07"] [data-lien-timeline-opens]')?.textContent).toBe('open since Aug\u00a01')
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
    propertyKind: 'non_residential',
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
    expect(container.querySelector('[data-lien-timeline-waiting]')?.textContent).toBe('Waiting on the GC — a reply to the Sep 14 demand letter by Sep 28 · $8,940')
    // Not our move (v2.7321): the quiet tag at the band's right, and no press.
    expect(container.querySelector('[data-lien-timeline-waiting-tag]')?.textContent).toBe('Waiting on the GC')
    expect(container.querySelector('[data-lien-timeline-act]')).toBeNull()
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

describe('LienTimelineStrip — one story (v2.4652): job 890 read Oct 20, the lien is gone', () => {
  // A residential sub job whose only work month, July, closed Sep 15 with nothing sent, and the affidavit window closed Oct 15 — nothing open, nothing ahead.
  const gone = buildLienTimeline({
    todayYmd: '2026-10-20',
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
    expect(verdict.querySelector('[data-lien-timeline-waiting]')?.textContent).toContain('Waiting on us')
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

describe('LienTimelineStrip — the late notice (v2.4708): job 890 read Oct 6, the affidavit window still open', () => {
  const late = buildLienTimeline({
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
  it('the band says send it late then file, in amber; the lien is a dashed window hanging off today, not a ghost', () => {
    const { container } = render(<LienTimelineStrip timeline={late} layout="row" view="windows" />)
    const verdict = container.querySelector('[data-lien-timeline-verdict]')!
    expect(verdict.getAttribute('data-tone')).toBe('amber')
    expect(verdict.textContent).toContain('Send the Jul notice late, then file the affidavit — 9 days.')
    expect(verdict.textContent).toContain('the lien can be filed any day until Oct 15')
    const lien = container.querySelector('[data-lien-timeline-window="affidavit"]')!
    expect(lien.getAttribute('data-lien-timeline-window-kind')).toBe('violet')
    expect(lien.textContent).toContain('opens when the late notice is mailed · by Oct 15')
    expect(lien.querySelector('[data-lien-timeline-move="ours"]')).toBeTruthy()
    expect(container.querySelector('[data-lien-timeline-window="notice:2026-07"]')?.getAttribute('data-lien-timeline-window-kind')).toBe('closed')
    expect(container.querySelector('[data-lien-timeline-windows-after]')?.textContent).toMatch(/^After a filing:/)
    expect(container.querySelector('[data-lien-timeline-windows-legend]')!.textContent).toContain('┄ opens when the notice is mailed')
  })

  it('with onOpenStep every stop title is a door that hands the step over; without it the titles are plain (v2.4793)', () => {
    const onOpenStep = vi.fn()
    const { unmount } = render(<LienTimelineStrip timeline={timeline} layout="row" onOpenStep={onOpenStep} />)
    const door = document.querySelector('[data-lien-timeline-stop-door="notice:2026-07"]') as HTMLButtonElement
    expect(door.tagName).toBe('BUTTON')
    expect(door.textContent).toBe('§ 53.056 · Jul')
    fireEvent.click(door)
    expect(onOpenStep).toHaveBeenCalledTimes(1)
    expect(onOpenStep.mock.calls[0]![0].key).toBe('notice:2026-07')
    unmount()
    render(<LienTimelineStrip timeline={timeline} layout="row" />)
    expect(document.querySelector('[data-lien-timeline-stop-door]')).toBeNull()
  })

  it('the last day’s press sits on its own line under the LAST WORK stop, in both layouts, and says what it does (v2.7684)', () => {
    setLienTimelineView('steps')
    const onChangeLastWork = vi.fn()
    for (const layout of ['row', 'list'] as const) {
      const { container, unmount } = render(<LienTimelineStrip timeline={timeline} layout={layout} onChangeLastWork={onChangeLastWork} />)
      const stop = container.querySelector('[data-lien-timeline-step="last_work"]') as HTMLElement
      const door = stop.querySelector('[data-lien-timeline-last-work-door]') as HTMLButtonElement
      // Clock hours behind the month: the day is there to change.
      expect(door.textContent).toBe('change ›')
      // Its own line: a block under the stop's words, where it trailed them inside their span until now.
      expect(stop.textContent).toContain('clock hours')
      expect(door.parentElement?.tagName).toBe('DIV')
      expect([...container.querySelectorAll('[data-lien-timeline-last-work-door]')].length).toBe(1)
      fireEvent.click(door)
      unmount()
    }
    expect(onChangeLastWork).toHaveBeenCalledTimes(2)
  })

  it('over a stand-in month the press reads set the day ›; with no door handed, and in the mini row, there is none (v2.7684)', () => {
    setLienTimelineView('steps')
    const standIn = buildLienTimeline({ todayYmd: '2026-09-24', isSub: true, propertyKind: 'non_residential', lastMonth: '2026-08', lastMonthFromCreation: true, months: [{ key: '2026-08', deadline: '2026-11-16', fromCreation: true, outcome: 'open', at: '' }], noticeState: 'needs_owner', retainage: null, affidavit: null, originalContractCompletedOn: null, releasedAt: null, paid: false })
    const view = render(<LienTimelineStrip timeline={standIn} layout="row" onChangeLastWork={() => {}} />)
    expect(view.container.querySelector('[data-lien-timeline-step="last_work"]')?.textContent).toContain('dated from the job’s creation · no clock hours')
    expect(view.container.querySelector('[data-lien-timeline-last-work-door]')?.textContent).toBe('set the day ›')
    view.unmount()
    // A reader's strip: the stop's words alone.
    const reader = render(<LienTimelineStrip timeline={standIn} layout="row" />)
    expect(reader.container.querySelector('[data-lien-timeline-last-work-door]')).toBeNull()
    reader.unmount()
    const mini = render(<LienTimelineStrip timeline={standIn} layout="mini" withNext={false} onChangeLastWork={() => {}} />)
    expect(mini.container.querySelector('[data-lien-timeline-last-work-door]')).toBeNull()
  })

  it('inside a phone’s open paper the press is a thumb tall: the stylesheet grows it (v2.7684)', () => {
    const css = readFileSync(join(process.cwd(), 'src/index.css'), 'utf8')
    const rule = css.split('\n').find((l) => l.startsWith('[data-lien-pane-phone] [data-lien-timeline-last-work-door]')) ?? ''
    expect(rule).toContain('min-height: 44px')
    expect(rule).toContain('display: inline-flex')
  })

  describe('values in place (punch list #399, the first screen)', () => {
    /** The values one element draws, in order. */
    const worked = (el: Element | null | undefined) => [...(el?.querySelectorAll('[data-value="worked-out"]') ?? [])].map((v) => v.textContent)

    it('every day on the steps is a bold value apart from its words, in both layouts, and the words read as the kernel wrote them', () => {
      setLienTimelineView('steps')
      for (const layout of ['row', 'list'] as const) {
        const { container, unmount } = render(<LienTimelineStrip timeline={timeline} layout={layout} />)
        const stop = (key: string) => container.querySelector(`[data-lien-timeline-step="${key}"]`)
        // The last month of work, and each day that follows from it.
        expect(worked(stop('last_work')?.querySelector('[data-lien-timeline-date]'))).toEqual(['Aug 2026'])
        expect(worked(stop('notice:2026-07')?.querySelector('[data-lien-timeline-date]'))).toEqual(['Oct 15'])
        expect(worked(stop('suit')?.querySelector('[data-lien-timeline-date]'))).toEqual(['Dec 15, 2027'])
        expect(worked(stop('serve')?.querySelector('[data-lien-timeline-date]'))).toEqual(['+5 days'])
        // The first day and the days left, inside the two small lines.
        expect(worked(stop('notice:2026-07')?.querySelector('[data-lien-timeline-opens]'))).toEqual(['Aug\u00a01'])
        expect(worked(stop('notice:2026-07'))).toContain('21 days')
        // A stop with no day keeps its line as it was: no value drawn on a dash.
        expect(worked(stop('retainage')?.querySelector('[data-lien-timeline-date]'))).toEqual([])
        expect(stop('retainage')?.querySelector('[data-lien-timeline-date]')?.textContent).toBe('—')
        // The words are the kernel's: the stop still reads its sentence whole.
        expect(stop('notice:2026-07')?.textContent).toContain('21 days · owner of record missing')
        // No value on the strip takes a press: the app works out every one.
        expect(container.querySelector('[data-value="changeable"]')).toBeNull()
        unmount()
      }
    })

    it('the verdict band draws the days in its sentence, and the hover still reads plain words', () => {
      setLienTimelineView('steps')
      const { container } = render(<LienTimelineStrip timeline={timeline} layout="row" />)
      const next = container.querySelector('[data-lien-timeline-verdict] [data-lien-timeline-next]')
      expect(next?.textContent).toContain(timeline.next.words)
      expect(worked(next)).toContain('21 days')
      expect(container.querySelector('[data-lien-timeline-step="notice:2026-07"]')?.getAttribute('title')).toBe('§ 53.056 · Jul · Oct 15 · 21 days · owner of record missing')
      expect(container.textContent).not.toMatch(/[⟪⟫]/)
    })

    it('a word in front of a date is a quiet word and the date is the value: reply by Sep 28', () => {
      setLienTimelineView('steps')
      const withLetter = buildLienTimeline({ todayYmd: '2026-09-24', isSub: true, propertyKind: 'non_residential', lastMonth: '2026-08', lastMonthFromCreation: false, months: [{ key: '2026-08', deadline: '2026-11-16', fromCreation: false, outcome: 'open', at: '' }], noticeState: 'to_draft', retainage: null, affidavit: null, originalContractCompletedOn: null, releasedAt: null, paid: false, demandLetters: [{ sentAt: '2026-09-14', deadlineDate: '2026-09-28', amount: 8940, openRemaining: 8940, debtorParty: 'gc' }] })
      const { container } = render(<LienTimelineStrip timeline={withLetter} layout="row" />)
      const date = container.querySelector('[data-lien-timeline-step="demand"] [data-lien-timeline-date]') as HTMLElement
      expect(date.textContent).toBe('reply by Sep 28')
      expect(worked(date)).toEqual(['Sep 28'])
      expect(date.style.fontWeight).toBe('400')
    })

    it('the calendar draws the days in its captions, and the mini row keeps its short dates', () => {
      setLienTimelineView('windows')
      const { container, unmount } = render(<LienTimelineStrip timeline={timeline} layout="row" />)
      expect(worked(container.querySelector('[data-lien-timeline-window="notice:2026-07"] [data-lien-timeline-caption]'))).toEqual(['Aug 1', 'Oct 15', '21 of 75 days', '21 days'])
      expect(worked(container.querySelector('[data-lien-timeline-windows-aside]'))).toEqual(['Dec 15'])
      unmount()
      setLienTimelineView('steps')
      const mini = render(<LienTimelineStrip timeline={timeline} layout="mini" withNext={false} />)
      expect(mini.container.querySelector('[data-lien-timeline-step="suit"]')?.textContent).toContain('Dec ’27')
      expect(mini.container.querySelector('[data-value]')).toBeNull()
    })
  })
})

describe('LienTimelineStrip — a caption stays inside its column on a narrow strip', () => {
  it('the lead before a caption gives way first, and a late bar’s caption ends at the column’s end', () => {
    setLienTimelineView('windows')
    const { container } = render(<LienTimelineStrip timeline={timeline} layout="row" />)
    const rows = [...container.querySelectorAll<HTMLElement>('[data-lien-timeline-caption-row]')]
    expect(rows.length).toBeGreaterThan(1)
    expect(rows.some((r) => r.dataset.lienTimelineCaptionRow === 'start')).toBe(true)
    for (const row of rows) {
      // The row spans the column, so a caption can never begin past the room it has.
      expect(row.style.position).toBe('absolute')
      expect(row.style.display).toBe('flex')
      const caption = row.querySelector('[data-lien-timeline-caption]') as HTMLElement
      // The caption keeps the width of its words, and is cut only when it is wider than the whole column.
      expect(caption.style.flexShrink).toBe('0')
      expect(caption.style.maxWidth).toBe('100%')
      expect(caption.style.textOverflow).toBe('ellipsis')
      const lead = row.querySelector<HTMLElement>('[data-lien-timeline-caption-lead]')
      if (row.dataset.lienTimelineCaptionRow === 'start') {
        // Where its bar starts, as a share of the column, and the first thing to give way.
        expect(lead).toBeTruthy()
        expect(lead!.style.flexGrow).toBe('0')
        expect(lead!.style.flexShrink).toBe('1')
        expect(parseFloat(lead!.style.flexBasis)).toBeLessThanOrEqual(55)
        expect(row.firstElementChild).toBe(lead)
      } else {
        expect(lead).toBeNull()
        expect(row.style.justifyContent).toBe('flex-end')
      }
    }
  })
})
