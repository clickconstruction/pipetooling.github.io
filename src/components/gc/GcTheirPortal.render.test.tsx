// @vitest-environment jsdom
/** A trade partner's portal link as the company window shows it (the Board's B3-c): loaded for one company on its own. */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { TradeLinkRow, TradeLinkVisits } from '../../lib/gc/tradePortalLinks'
import { installDomShims } from '../../test/renderSmokeMocks'

const io = vi.hoisted(() => ({
  links: [] as TradeLinkRow[],
  visits: {} as Record<string, TradeLinkVisits>,
  load: vi.fn(),
  make: vi.fn(async (_id: string, _remake: boolean) => 'new-token'),
  off: vi.fn(async (_id: string) => undefined),
}))

vi.mock('../../lib/gc/tradePortalLinksIo', () => ({
  loadTradePortalLinks: vi.fn(async (ids: string[]) => {
    io.load(ids)
    return { links: io.links, visits: io.visits }
  }),
  makeTradePortalLink: (id: string, remake: boolean) => io.make(id, remake),
  turnOffTradePortalLink: (id: string) => io.off(id),
}))

import { GcTheirPortal } from './GcTheirPortal'

installDomShims()

beforeEach(() => {
  io.links = []
  io.visits = {}
  io.load.mockClear()
  io.make.mockClear()
  io.off.mockClear()
})

describe('GcTheirPortal', () => {
  it('loads the one company’s link, and makes it when there is none', async () => {
    render(<GcTheirPortal companyId="hillside" />)
    expect(await screen.findByText('no link yet')).toBeTruthy()
    expect(io.load).toHaveBeenCalledWith(['hillside'])
    io.links = [{ company_id: 'hillside', token: 'new-token', created_at: '2026-10-08T10:00:00Z', revoked_at: null }]
    fireEvent.click(screen.getByRole('button', { name: 'Make the link' }))
    await waitFor(() => expect(io.make).toHaveBeenCalledWith('hillside', false))
    expect(await screen.findByText('not opened yet')).toBeTruthy()
    expect((screen.getByRole('link', { name: /Open it as the office/ }) as HTMLAnchorElement).getAttribute('href')).toBe('/t/new-token?preview=1')
  })

  it('says how often they opened it, and asks once more before turning it off', async () => {
    io.links = [{ company_id: 'hillside', token: 'tok', created_at: '2026-10-01T10:00:00Z', revoked_at: null }]
    io.visits = { hillside: { opens: 2, lastAt: '2026-10-06T12:00:00Z' } }
    render(<GcTheirPortal companyId="hillside" />)
    expect(await screen.findByText('Opened 2 times, last Oct 6.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Turn it off' }))
    expect(screen.getByText('The link stops working.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Turn it off' }))
    await waitFor(() => expect(io.off).toHaveBeenCalledWith('hillside'))
  })
})
