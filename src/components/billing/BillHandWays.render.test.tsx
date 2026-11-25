// @vitest-environment jsdom
/**
 * The list window's delete (punch list #443, row 3): a dev reads **Delete…** on a way under *Taken off*, and nobody
 * else does. A way that is not a test way, and a way a bill was recorded with, stay and say why. Every name is made up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { BillHandWay } from '../../lib/billing/billHandWays'
import { BillHandWaysWindow, type BillHandWaysCtl } from './BillHandWays'

const io = vi.hoisted(() => ({ role: 'dev', counts: {} as Record<string, number>, countFails: false, counted: [] as string[], deleted: [] as string[], refuse: null as null | Error }))
vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => false }))
vi.mock('../../hooks/useAuth', () => {
  const auth = () => ({ role: io.role, user: { id: 'u1' }, profileName: 'Priya' })
  return { useAuth: auth, useOptionalAuth: auth }
})
vi.mock('../../lib/billing/billsSentIo', () => ({
  addBillHandWay: async () => null,
  renameBillHandWay: async () => undefined,
  setBillHandWayOnList: async () => undefined,
  moveBillHandWays: async () => undefined,
}))
vi.mock('../../lib/billing/billHandWayDeleteIo', () => ({
  countBillHandWayRecords: async (key: string) => {
    io.counted.push(key)
    if (io.countFails) throw new Error('The network dropped.')
    return io.counts[key] ?? 0
  },
  deleteBillHandWayNobodyUsed: async (way: { id: string }) => {
    if (io.refuse) throw io.refuse
    io.deleted.push(way.id)
  },
}))

const way = (over: Partial<BillHandWay>): BillHandWay => ({ id: 'w1', key: 'handed', label: 'Handed over', sentHow: 'hand', sortOrder: 1, retiredAtIso: null, retiredByName: '', createdByName: '', createdAtIso: '2026-11-13T15:00:00Z', ...over })
const list = (): BillHandWay[] => [
  way({}),
  way({ id: 'w5', key: 'w_aaaaaaaaaa', label: 'ZZ Test', sentHow: 'other', sortOrder: 5, retiredAtIso: '2026-11-24T16:00:00Z', retiredByName: 'Priya', createdByName: 'Priya' }),
  way({ id: 'w6', key: 'w_bbbbbbbbbb', label: 'ZZ Test used once', sentHow: 'other', sortOrder: 6, retiredAtIso: '2026-11-24T15:00:00Z', retiredByName: 'Priya', createdByName: 'Priya' }),
  way({ id: 'w7', key: 'w_cccccccccc', label: 'Faxed', sentHow: 'other', sortOrder: 7, retiredAtIso: '2026-11-09T16:00:00Z', retiredByName: 'Marcus', createdByName: 'Marcus' }),
]

function open(ways: BillHandWay[] = list()) {
  const state = { ways, reloads: 0 }
  const ctl: BillHandWaysCtl = {
    ways: state.ways,
    canEdit: true,
    reload: async () => {
      state.reloads += 1
    },
  }
  renderWithProviders(<BillHandWaysWindow ctl={ctl} onClose={() => undefined} />)
  const gone = screen.getByTestId('bill-hand-ways-gone')
  fireEvent.click(within(gone).getByRole('button', { name: 'Show' }))
  return { gone, state }
}

beforeEach(() => {
  io.role = 'dev'
  io.counts = { w_bbbbbbbbbb: 1 }
  io.countFails = false
  io.counted = []
  io.deleted = []
  io.refuse = null
})
afterEach(cleanup)

describe('BillHandWaysWindow, the delete of a way nobody used', () => {
  it('draws no Delete… for the office: the list reads as it did', () => {
    for (const role of ['master_technician', 'assistant', 'controller']) {
      io.role = role
      const { gone } = open()
      expect(within(gone).getAllByRole('button', { name: /^Bring .* back$/ })).toHaveLength(3)
      expect(within(gone).queryByRole('button', { name: /^Delete / })).toBeNull()
      expect(within(gone).queryByTestId('bill-hand-way-delete-why')).toBeNull()
      cleanup()
    }
  })

  it('for a dev, deletes a test way no bill was recorded with, after a confirm that names the act', async () => {
    const { gone, state } = open()
    fireEvent.click(within(gone).getByRole('button', { name: 'Delete ZZ Test' }))
    const yes = await screen.findByRole('button', { name: 'Delete the way' })
    expect(screen.getByText('Delete the way ZZ Test?')).toBeTruthy()
    expect(screen.getByText('No bill was recorded with this way. It leaves the list for everyone, and it cannot be brought back.')).toBeTruthy()
    expect(io.counted).toEqual(['w_aaaaaaaaaa'])
    expect(io.deleted).toEqual([])
    fireEvent.click(yes)
    await waitFor(() => expect(io.deleted).toEqual(['w5']))
    await waitFor(() => expect(state.reloads).toBe(1))
    expect(await screen.findByText('ZZ Test was deleted.')).toBeTruthy()
  })

  it('deletes nothing when the confirm is cancelled', async () => {
    const { gone } = open()
    fireEvent.click(within(gone).getByRole('button', { name: 'Delete ZZ Test' }))
    await screen.findByRole('button', { name: 'Delete the way' })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Delete the way' })).toBeNull())
    expect(io.deleted).toEqual([])
  })

  it('keeps a way a bill was recorded with: no confirm, and the line says why', async () => {
    const { gone } = open()
    fireEvent.click(within(gone).getByRole('button', { name: 'Delete ZZ Test used once' }))
    await waitFor(() => expect(gone.textContent).toContain('1 bill was recorded with this way. It stays.'))
    expect(screen.queryByRole('button', { name: 'Delete the way' })).toBeNull()
    expect((within(gone).getByRole('button', { name: 'Delete ZZ Test used once' }) as HTMLButtonElement).disabled).toBe(true)
    expect(io.deleted).toEqual([])
  })

  it('offers no delete of a way that is not a test way, and says why', () => {
    const { gone } = open()
    const faxed = within(gone).getByRole('button', { name: 'Delete Faxed' }) as HTMLButtonElement
    expect(faxed.disabled).toBe(true)
    const row = faxed.closest('[data-testid="bill-hand-way-gone-row"]')
    expect(row?.textContent).toContain('Only a test way can be deleted. Its name must start with ZZ.')
    fireEvent.click(faxed)
    expect(io.counted).toEqual([])
  })

  it('says the reason and deletes nothing when the count cannot be read, or the delete is refused', async () => {
    io.countFails = true
    const { gone } = open()
    fireEvent.click(within(gone).getByRole('button', { name: 'Delete ZZ Test' }))
    expect(await screen.findByText('The network dropped.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Delete the way' })).toBeNull()
    io.countFails = false
    io.refuse = new Error('The way was not deleted. You may not have leave to delete it, or it is back on the list.')
    fireEvent.click(within(gone).getByRole('button', { name: 'Delete ZZ Test' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Delete the way' }))
    expect(await screen.findByText('The way was not deleted. You may not have leave to delete it, or it is back on the list.')).toBeTruthy()
    expect(io.deleted).toEqual([])
  })
})
