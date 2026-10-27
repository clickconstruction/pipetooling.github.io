// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { SubsBoard, type SubsBoardProspect } from './SubsBoard'
import type { GcNeed } from '../../lib/prospects/gcNeeds'
import type { SubRecord } from '../../lib/prospects/subRecord'
import type { PlansChoice } from '../../lib/prospects/subsStages'

const sub = (id: string, name: string, trades: string[], over: Partial<SubsBoardProspect> = {}): SubsBoardProspect => ({
  id,
  company_name: name,
  contact_name: null,
  phone_number: '(210) 555-0100',
  contact_phone: null,
  address: '12 Oak St, Boerne, TX',
  is_person: false,
  trades,
  created_at: '2026-10-01',
  last_contact: null,
  prospect_fit_status: null,
  ...over,
})

const need = (trade: string, over: Partial<GcNeed> = {}): GcNeed => ({ trade, why: 'bench', asks: [], onBench: 0, dependable: 0, benchShort: 3, toCall: 1, unasked: 0, ...over })
const ask = { projectId: 'p1', projectName: 'Oak Run Clinic', bids: 0, short: 2, bidDue: '2026-10-30', daysLeft: 7, asked: 1, unasked: 0 }
const needs = { rows: [need('Concrete', { why: 'quotes' as const, asks: [ask], onBench: 1, dependable: 1, benchShort: 2 }), need('HVAC')], book: [{ trade: 'Fire sprinkler', toCall: 2 }] }
const plan: PlansChoice = { id: 'p1', name: 'Oak Run Clinic', bidDue: '2026-10-30', daysLeft: 7, trades: ['Fire sprinkler', 'Concrete'], packageByTrade: { 'fire sprinkler': 'k1', concrete: 'k2' } }
const subs = [sub('a', 'Alamo Sprinkler Co', ['Fire sprinkler']), sub('b', 'Hill Country Fire Protection', ['Fire sprinkler', 'Sitework']), sub('c', 'Kendall Concrete', ['Concrete']), sub('d', 'Cool Air Co', ['HVAC'])]
const records = new Map<string, SubRecord>([['b', { calls: 2, answered: 2, record: 'reliable' }]])

function draw(over: Partial<Parameters<typeof SubsBoard<SubsBoardProspect>>[0]> = {}) {
  const onCall = vi.fn()
  const onBench = vi.fn()
  const onPass = vi.fn()
  const onPick = vi.fn()
  render(
    <MemoryRouter>
      <SubsBoard subs={subs} needs={needs} plans={[plan]} picked={null} onPick={onPick} records={records} calledIds={new Set(['b'])} lastCalls={{ b: { interaction_type: 'answered', created_at: '2026-10-20T15:00:00Z' } }} onCall={onCall} onBench={onBench} onPass={onPass} onEdit={() => undefined} onAddSub={() => undefined} {...over} />
    </MemoryRouter>,
  )
  return { onCall, onBench, onPass, onPick }
}

describe('SubsBoard (v2.5808)', () => {
  afterEach(cleanup)

  it('draws one column a trade in the panel’s order, who answers first, and hands the top three to the deck', () => {
    const { onCall } = draw()
    const columns = [...document.querySelectorAll('[data-board-column]')].map((el) => el.getAttribute('data-board-column'))
    expect(columns).toEqual(['Concrete', 'HVAC', 'Fire sprinkler', 'Sitework'])
    const fire = document.querySelector('[data-board-column="Fire sprinkler"]') as HTMLElement
    const cards = [...fire.querySelectorAll('[data-board-card]')].map((el) => el.getAttribute('data-board-card'))
    expect(cards).toEqual(['b', 'a'])
    expect(within(fire).getByText('answers')).toBeTruthy()
    expect(within(fire).getByText('call next')).toBeTruthy()
    expect(within(fire).getByText('also in: Sitework')).toBeTruthy()
    fireEvent.click(within(fire).getByRole('button', { name: 'Call the 2 here →' }))
    expect(onCall).toHaveBeenCalledWith(['b', 'a'], 'Fire sprinkler', null)
  })

  it('brings the picked project’s trades forward with its ask on the head, folds the rest, and carries the package', () => {
    const { onCall } = draw({ picked: plan })
    expect([...document.querySelectorAll('[data-board-column]')].map((el) => el.getAttribute('data-board-column'))).toEqual(['Concrete', 'Fire sprinkler'])
    const concrete = document.querySelector('[data-board-column="Concrete"]') as HTMLElement
    expect(within(concrete).getByText('0 of 2 quotes')).toBeTruthy()
    expect(within(concrete).getByText(/due Oct 30, in 7 days/)).toBeTruthy()
    // One card: the column's head reads Call now → too, so the first is the head's.
    fireEvent.click(within(concrete).getAllByRole('button', { name: 'Call now →' })[0]!)
    expect(onCall).toHaveBeenCalledWith(['c'], 'Concrete', 'k2')
    fireEvent.click(screen.getByRole('button', { name: '2 trades folded · Press to show all' }))
    expect(document.querySelectorAll('[data-board-column]').length).toBe(4)
  })

  it('offers To the bench ✓ and Pass on every card, and Add a sub on an empty column', () => {
    const { onBench, onPass } = draw({ subs: subs.filter((s) => s.id !== 'd') })
    const fire = document.querySelector('[data-board-column="Fire sprinkler"]') as HTMLElement
    const card = within(fire).getAllByRole('listitem')[0] as HTMLElement
    fireEvent.click(within(card).getByRole('button', { name: 'To the bench ✓' }))
    expect(onBench).toHaveBeenCalledWith(expect.objectContaining({ id: 'b' }))
    fireEvent.click(within(card).getByRole('button', { name: 'Pass' }))
    expect(onPass).toHaveBeenCalledWith(expect.objectContaining({ id: 'b' }))
    const hvac = document.querySelector('[data-board-column="HVAC"]') as HTMLElement
    expect(within(hvac).getByRole('button', { name: 'Add a sub' })).toBeTruthy()
  })
})

describe('the Subs board’s ? (punch list #187 PR 4)', () => {
  it('folds the board’s sentences behind one press, with the guide as the card’s door', () => {
    draw()
    expect(screen.queryByText(/One column a trade\./)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'What this board holds' }))
    const card = screen.getByTestId('legend-card-subs-board')
    expect(card.textContent).toContain('Call the top 3')
    expect(card.textContent).toContain('A drag pins it.')
    expect((screen.getByTestId('legend-card-subs-board-guide') as HTMLAnchorElement).getAttribute('href')).toBe('/help?g=find-subs-for-the-bench&via=legend')
    fireEvent.click(within(card).getByRole('button', { name: 'Close' }))
    expect(screen.queryByTestId('legend-card-subs-board')).toBeNull()
  })
})
