// @vitest-environment jsdom
/** The office's Trade portals card (P1b-ii-b): each company's link, made, copied, remade and turned off by a dev. */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { TradeLinkRow, TradeLinkVisits } from '../../lib/gc/tradePortalLinks'
import { boardStateFromRows } from '../../lib/gc/boardRows'
import { clinicBoardRows } from '../../lib/gc/boardTestRows'
import { installDomShims } from '../../test/renderSmokeMocks'

const io = vi.hoisted(() => ({
  links: [] as TradeLinkRow[],
  visits: {} as Record<string, TradeLinkVisits>,
  make: vi.fn(async (_id: string, _remake: boolean) => 'new-token'),
  off: vi.fn(async (_id: string) => undefined),
}))

vi.mock('../../lib/gc/tradePortalLinksIo', () => ({
  loadTradePortalLinks: vi.fn(async () => ({ links: io.links, visits: io.visits })),
  makeTradePortalLink: (id: string, remake: boolean) => io.make(id, remake),
  turnOffTradePortalLink: (id: string) => io.off(id),
}))

import { GcTradePortals } from './GcTradePortals'

installDomShims()

const state = boardStateFromRows(clinicBoardRows())
const row = (id: string) => within(document.querySelector(`[data-gc-trade-portal="${id}"]`) as HTMLElement)

beforeEach(() => {
  io.links = []
  io.visits = {}
  io.make.mockClear()
  io.off.mockClear()
})

describe('GcTradePortals', () => {
  it('lists every company with no link yet, and makes one', async () => {
    render(<GcTradePortals state={state} />)
    await waitFor(() => expect(document.querySelector('[data-gc-trade-portal="hillside"]')).toBeTruthy())
    expect(row('hillside').getByText('no link yet')).toBeTruthy()
    io.links = [{ company_id: 'hillside', token: 'new-token', created_at: '2026-10-08T10:00:00Z', revoked_at: null }]
    fireEvent.click(row('hillside').getByRole('button', { name: 'Make the link' }))
    await waitFor(() => expect(io.make).toHaveBeenCalledWith('hillside', false))
    expect(await row('hillside').findByText('not opened yet')).toBeTruthy()
    expect(row('hillside').getByText('The link is on. Copy it and send it with the ask to quote.')).toBeTruthy()
    expect((row('hillside').getByRole('link', { name: /Open it as the office/ }) as HTMLAnchorElement).getAttribute('href')).toBe('/t/new-token?preview=1')
  })

  it('asks before it makes a new link or turns one off, and says how often they opened it', async () => {
    io.links = [{ company_id: 'hillside', token: 'tok', created_at: '2026-10-01T10:00:00Z', revoked_at: null }]
    io.visits = { hillside: { opens: 3, lastAt: '2026-10-06T12:00:00Z' } }
    render(<GcTradePortals state={state} />)
    await waitFor(() => expect(document.querySelector('[data-gc-trade-portal="hillside"]')).toBeTruthy())
    expect(row('hillside').getByText('Opened 3 times, last Oct 6.')).toBeTruthy()
    fireEvent.click(row('hillside').getByRole('button', { name: 'Make a new link' }))
    expect(row('hillside').getByText('The old link stops working.')).toBeTruthy()
    fireEvent.click(row('hillside').getByRole('button', { name: 'Keep it' }))
    expect(io.make).not.toHaveBeenCalled()
    fireEvent.click(row('hillside').getByRole('button', { name: 'Turn it off' }))
    fireEvent.click(row('hillside').getByRole('button', { name: 'Turn it off' }))
    await waitFor(() => expect(io.off).toHaveBeenCalledWith('hillside'))
  })

  it('shows a refusal in its own words', async () => {
    io.make.mockRejectedValueOnce(new Error('Only a dev can make a trade portal link for now.'))
    render(<GcTradePortals state={state} />)
    await waitFor(() => expect(document.querySelector('[data-gc-trade-portal="hillside"]')).toBeTruthy())
    fireEvent.click(row('hillside').getByRole('button', { name: 'Make the link' }))
    expect(await row('hillside').findByText('Only a dev can make a trade portal link for now.')).toBeTruthy()
    expect(screen.getAllByText('no link yet').length).toBeGreaterThan(0)
  })
})
