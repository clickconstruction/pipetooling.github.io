// @vitest-environment jsdom
/**
 * Render smoke for the phone-width pass, round five (`to-dos/gc-mode/mockups/phone-pass.md`). At 375px
 * the chart stacks each name over a smaller pill and keeps its names over the bars' ports, a trade's
 * title and a crowded place take two lines, the parts card puts a part's cells in two columns, and the
 * customer's dates to meet are a list under the diamonds. jsdom has no layout, so these pin the styles
 * the pass measured in the browser, and that a desktop keeps its own.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { GcBuildingScheduleTab } from './GcBuildingSchedule'
import { GcPartsCard } from './GcSplitBars.proto'
import { GcCrowdedLane } from './GcPlaces'
import { GcCustomerSchedule } from './GcCustomerSchedule'
import { initialGcState } from '../../lib/gcMode/gcFixture'
import { gcReducer } from '../../lib/gcMode/gcReducer'
import { crowdedWeeks, placeRows } from '../../lib/gcMode/gcPlaces'
import type { GcAction, GcState } from '../../lib/gcMode/gcTypes'

const ID = 'fairoaksd'
const LIGHTING = 'felec-3'
const job = (s: GcState) => s.projects.find((p) => p.id === ID)!
const act = (s: GcState, lineId: string) => job(s).schedule!.activities.find((a) => a.lineId === lineId)!
const s0 = initialGcState()
const SPLIT: GcAction = {
  type: 'splitActivity',
  projectId: ID,
  lineId: LIGHTING,
  parts: [
    { name: 'Sales floor', start: '2026-09-14', finish: '2026-10-09' },
    { name: 'Back of house', start: '2026-10-10', finish: '2026-10-23' },
  ],
  by: 'Robert',
}
const s1 = gcReducer(s0, SPLIT)
/** Every guess kept, as Keep these places sends them: Inside is crowded. */
const kept = gcReducer(s0, { type: 'setActivityPlaces', projectId: ID, places: Object.fromEntries(placeRows(s0, job(s0)).flatMap((r) => (r.guess ? [[r.lineId, r.guess.place]] : []))) })

/** A phone at 375px, or a desktop, as the components ask it: `(max-width: 640px)`. */
const realMatchMedia = window.matchMedia
const asPhone = (phone: boolean) => {
  window.matchMedia = ((query: string) => ({ matches: phone && query.includes('max-width: 640px'), media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false })) as typeof window.matchMedia
}
afterEach(() => {
  cleanup()
  window.matchMedia = realMatchMedia
})

/** The Schedule tab's chart: a phone opens on the list, so it presses Chart. */
const chart = (state: GcState, phone: boolean) => {
  asPhone(phone)
  render(<GcBuildingScheduleTab state={state} project={job(state)} dispatch={() => undefined} />)
  if (phone) fireEvent.click(screen.getByRole('button', { name: 'Chart' }))
  return document.querySelector('[aria-label^="The schedule as a chart"]') as HTMLElement
}
const barName = (root: HTMLElement, name: string) => [...root.querySelectorAll<HTMLElement>('button[title="Change its dates and what it waits on"]')].find((b) => b.textContent === name)!
const pillOf = (cell: HTMLElement) => cell.lastElementChild as HTMLElement

describe('the chart on a phone', () => {
  it('stacks a bar’s name over a smaller pill, each with the whole column, and neither cut', () => {
    const root = chart(s0, true)
    const name = barName(root, 'Top out')
    const cell = name.parentElement!
    expect([cell.style.display, cell.style.gridTemplateColumns, name.style.justifySelf]).toEqual(['grid', 'minmax(0, 1fr)', 'stretch'])
    const pill = pillOf(cell)
    expect([pill.textContent, pill.style.fontSize, pill.style.overflow, pill.style.textOverflow]).toEqual(['37 spare days', '0.65rem', '', ''])
  })

  it('stacks a wait’s name over its pill, and a split bar’s parts, its caret beside both lines', () => {
    const root = chart(s1, true)
    const wait = [...root.querySelectorAll<HTMLElement>('span[title]')].find((s) => s.textContent === 'The transformer')!
    expect([wait.parentElement!.style.display, pillOf(wait.parentElement!).textContent, pillOf(wait.parentElement!).style.fontSize]).toEqual(['grid', 'requested Sep 15', '0.65rem'])
    const lighting = barName(root, 'Lighting').parentElement!
    expect([lighting.style.gridTemplateColumns, (lighting.firstElementChild as HTMLElement).style.gridRow]).toEqual(['0.8rem minmax(0, 1fr)', '1 / span 2'])
    const part = [...root.querySelectorAll<HTMLElement>('button[title^="A part of Lighting"]')].find((b) => b.textContent === 'Back of house')!
    expect([part.parentElement!.style.display, part.style.fontSize, pillOf(part.parentElement!).style.fontSize]).toEqual(['grid', '0.7rem', '0.65rem'])
  })

  it('lets a trade’s title take two lines', () => {
    const root = chart(s0, true)
    const title = [...root.querySelectorAll<HTMLElement>('strong')].find((s) => s.textContent === 'Structural steel')!
    expect([title.style.whiteSpace, title.style.overflow]).toEqual(['normal', 'hidden'])
  })

  it('keeps its names over the bars’ ports', () => {
    const root = chart(s0, true)
    const port = root.querySelector<HTMLElement>('[data-gantt-port]')!
    const cell = barName(root, 'Top out').parentElement!
    expect(Number(cell.style.zIndex)).toBeGreaterThan(Number(port.style.zIndex))
  })

  it('leaves a desktop’s name and pill side by side, the pill its own size', () => {
    const root = chart(s0, false)
    const cell = barName(root, 'Top out').parentElement!
    expect([cell.style.display, pillOf(cell).style.fontSize, Number(cell.style.zIndex) > Number(root.querySelector<HTMLElement>('[data-gantt-port]')!.style.zIndex)]).toEqual(['flex', '0.75rem', true])
  })
})

describe('the crowded lane on a phone', () => {
  it('gives a typed place two lines, and a desktop one line', () => {
    const lane = (phone: boolean) => render(<GcCrowdedLane weeks={crowdedWeeks(kept, job(kept))} first="2026-09-28" px={9} labelW={phone ? 168 : 360} width={900} phone={phone} rowH={32} />)
    const place = (c: HTMLElement) => [...c.querySelectorAll<HTMLElement>('[data-crowded-place] span')].find((s) => s.textContent === '· Inside')!
    expect(place(lane(true).container).style.whiteSpace).toBe('normal')
    cleanup()
    expect(place(lane(false).container).style.whiteSpace).toBe('nowrap')
  })
})

describe('the parts card on a phone', () => {
  it('puts a part’s four cells in two columns, and a desktop’s in four', () => {
    const card = (phone: boolean) => {
      asPhone(phone)
      return render(<GcPartsCard project={job(s1)} activity={act(s1, LIGHTING)} pct={40} by="Robert" dispatch={() => undefined} onMovePart={() => undefined} />).container
    }
    expect((card(true).querySelector('[role="row"]') as HTMLElement).style.gridTemplateColumns).toBe('1fr 1fr')
    cleanup()
    expect((card(false).querySelector('[role="row"]') as HTMLElement).style.gridTemplateColumns).toBe('minmax(8rem, 1.4fr) minmax(8rem, 1.2fr) minmax(6rem, 1fr) minmax(5rem, auto)')
  })
})

describe('the customer’s dates to meet', () => {
  it('reads each date whole in a list under its diamond', () => {
    const { container } = render(<GcCustomerSchedule state={s0} project={job(s0)} />)
    const list = container.querySelector('[data-gc-dates-to-meet]') as HTMLElement
    expect([...list.children].map((c) => c.textContent)).toEqual(['Slab poured · Aug 28, met', 'Dry-in · Sep 25, 7 days late', 'Rough-in inspection · Oct 13', 'Substantial completion · Dec 11'])
    expect([list.style.flexWrap, list.style.gridColumn]).toEqual(['wrap', '1 / -1'])
    // The diamonds carry no words beside them, only their title.
    const diamonds = [...(list.previousElementSibling as HTMLElement).querySelectorAll<HTMLElement>('span[title]')]
    expect(diamonds.map((d) => [d.textContent, d.title])).toEqual([
      ['', 'Slab poured · Aug 28'],
      ['', 'Dry-in · Sep 25'],
      ['', 'Rough-in inspection · Oct 13'],
      ['', 'Substantial completion · Dec 11'],
    ])
  })
})
