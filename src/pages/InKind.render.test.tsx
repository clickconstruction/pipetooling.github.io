// @vitest-environment jsdom
/**
 * In kind, every arrangement in one list (punch list #301, PR 4): the totals, a row per deal with the month due first,
 * the ended ones behind a press, an empty list that names the press that fills it, a failed read that says why, and a
 * role that is not the office sent to the Dashboard.
 */
import { fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
const auth = vi.hoisted(() => ({ role: 'assistant' as string }))
vi.mock('../hooks/useAuth', async () => {
  const mocks = await import('../test/renderSmokeMocks')
  return { useAuth: () => mocks.makeUseAuthValue({ role: auth.role }) }
})

import InKind, { type InKindPageIo } from './InKind'
import { renderWithProviders, settle } from '../test/renderSmokeMocks'
import { concreteDeal, rentDeal } from '../components/inKind/inKindTestData'

function makeIo(over: Partial<InKindPageIo> = {}): InKindPageIo {
  return {
    load: vi.fn(() => Promise.resolve([concreteDeal(), rentDeal()])),
    loadBank: vi.fn(() => Promise.resolve([{ id: 't1', day: '2026-11-03', amount: 1500, name: 'Calloway Holdings LLC' }])),
    searchCustomers: vi.fn(() => Promise.resolve([{ id: 'c9', name: 'Pecan Creek Gravel' }])),
    ...over,
  }
}

beforeEach(() => {
  auth.role = 'assistant'
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-10T18:00:00Z'))
})
afterEach(() => vi.useRealTimers())

describe('InKind page', () => {
  it('lists every open deal, the one with a month due first, with the totals above', async () => {
    renderWithProviders(<InKind io={makeIo()} />)
    await settle()
    const rows = await screen.findAllByTestId('in-kind-row')
    expect(rows.map((r) => r.textContent?.includes('Calloway Holdings'))).toEqual([true, false])
    expect(rows[0]!.textContent).toContain('2 months are due. October is the oldest.')
    expect(rows[0]!.textContent).toContain('Enter October’s credit')
    expect(rows[1]!.textContent).toContain('Lone Oak Concrete')
    expect(rows[1]!.textContent).toContain('$3,540.00 of $6,800.00')
    expect(rows[1]!.textContent).toContain('The last line was Nov 4.')
    expect(screen.getByText('$5,852.90')).toBeTruthy() // still to come: 2,592.90 + 3,260.00
    expect(screen.getByText('on 2 arrangements, none chased as late')).toBeTruthy()
    expect(screen.getByText('2 open')).toBeTruthy()
  })

  it('keeps an ended deal behind a press', async () => {
    const ended = concreteDeal()
    ended.arrangement.ended_at = '2026-08-14T00:00:00Z'
    renderWithProviders(<InKind io={makeIo({ load: () => Promise.resolve([ended, rentDeal()]) })} />)
    await settle()
    expect(await screen.findAllByTestId('in-kind-row')).toHaveLength(1)
    fireEvent.click(screen.getByText('Show 1 ended'))
    expect(screen.getAllByTestId('in-kind-row')).toHaveLength(2)
  })

  it('names the press that fills an empty list, and finds a customer to set up', async () => {
    const io = makeIo({ load: () => Promise.resolve([]) })
    renderWithProviders(<InKind io={io} />)
    await settle()
    expect(await screen.findByText('Nobody pays in kind yet.')).toBeTruthy()
    fireEvent.click(screen.getByTestId('in-kind-page-set-up'))
    fireEvent.change(screen.getByLabelText('Which customer pays in kind? Type their name.'), { target: { value: 'pecan' } })
    expect(await screen.findByText('Pecan Creek Gravel', {}, { timeout: 2000 })).toBeTruthy()
    expect(io.searchCustomers).toHaveBeenCalledWith('pecan')
  })

  it('says why a read failed and reads again on the press', async () => {
    const load = vi.fn().mockRejectedValueOnce({ message: 'permission denied for table in_kind_arrangements' }).mockResolvedValueOnce([concreteDeal()])
    renderWithProviders(<InKind io={makeIo({ load })} />)
    await settle()
    expect((await screen.findByRole('alert')).textContent).toContain('permission denied')
    fireEvent.click(screen.getByText('Read it again'))
    await settle()
    expect(await screen.findAllByTestId('in-kind-row')).toHaveLength(1)
  })

  it('reads nothing for a role that is not the office', async () => {
    auth.role = 'helpers'
    const io = makeIo()
    renderWithProviders(<InKind io={io} />)
    await settle()
    expect(io.load).not.toHaveBeenCalled()
    expect(screen.queryByText('In kind')).toBeNull()
  })
})
