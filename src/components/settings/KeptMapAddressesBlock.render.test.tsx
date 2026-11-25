// @vitest-environment jsdom
/**
 * Kept map addresses (punch list #443, row 9): a dev finds a kept address and clears it when nothing is written
 * under it, an address a record holds stays and says which, and nobody else sees the block. Made-up addresses.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { KEPT_ADDRESS_SOURCES } from '../../lib/map/keptAddressClear'
import KeptMapAddressesBlock from './KeptMapAddressesBlock'

const io = vi.hoisted(() => ({
  rows: [] as Array<{ key: string; keptAtIso: string | null; placed: boolean }>,
  hits: {} as Record<string, number>,
  searched: [] as string[],
  cleared: [] as string[],
  searchFails: false,
  hitsFail: false,
  refuse: null as null | Error,
}))
vi.mock('../../lib/map/keptAddressClearIo', async () => {
  const { KEPT_ADDRESS_SOURCES: sources, keptAddressLikePattern } = await import('../../lib/map/keptAddressClear')
  return {
    searchKeptAddresses: async (typed: string) => {
      io.searched.push(typed)
      if (io.searchFails) throw new Error('The network dropped.')
      return io.rows
    },
    readKeptAddressHits: async (key: string) => {
      if (io.hitsFail) throw new Error('The network dropped.')
      if (!keptAddressLikePattern(key)) return null
      return sources.map((source) => ({ source, count: key === '208 juniper bend, alder, tx' ? (io.hits[source.table] ?? 0) : 0 }))
    },
    clearKeptAddress: async (key: string) => {
      if (io.refuse) throw io.refuse
      io.cleared.push(key)
    },
  }
})

const ZZ = '1 tset street, austin, tx'
const REAL = '208 juniper bend, alder, tx'
const draw = (role: string) => renderWithProviders(<KeptMapAddressesBlock role={role} />)
const openAndFind = async (words = 'tset') => {
  fireEvent.click(screen.getByRole('button', { name: /Kept map addresses \(dev\)/ }))
  fireEvent.change(screen.getByLabelText('Words of the address'), { target: { value: words } })
  fireEvent.click(screen.getByRole('button', { name: 'Find kept addresses' }))
  await waitFor(() => expect(io.searched).toEqual([words]))
}

beforeEach(() => {
  io.rows = [
    { key: ZZ, keptAtIso: '2026-11-25T01:48:37Z', placed: true },
    { key: REAL, keptAtIso: '2026-11-03T18:00:00Z', placed: true },
    { key: '9 st', keptAtIso: null, placed: false },
  ]
  io.hits = { jobs_ledger: 2, customers: 1 }
  io.searched = []
  io.cleared = []
  io.searchFails = false
  io.hitsFail = false
  io.refuse = null
})
afterEach(cleanup)

describe('KeptMapAddressesBlock', () => {
  it('draws nothing for every role but a dev', () => {
    for (const role of ['master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent', 'subcontractor', 'helpers']) {
      draw(role)
      expect(screen.queryByTestId('kept-map-addresses')).toBeNull()
      cleanup()
    }
  })

  it('opens folded, and finds nothing until three letters are typed', async () => {
    draw('dev')
    expect(screen.queryByLabelText('Words of the address')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Kept map addresses \(dev\)/ }))
    const find = screen.getByRole('button', { name: 'Find kept addresses' }) as HTMLButtonElement
    expect(find.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Words of the address'), { target: { value: 'ts' } })
    expect(screen.getByText('Type 3 letters or more of the address.')).toBeTruthy()
    expect(find.disabled).toBe(true)
    expect(io.searched).toEqual([])
  })

  it('lists what the search found, and clears an address nothing is written under after a confirm that names the act', async () => {
    draw('dev')
    await openAndFind()
    const lines = await screen.findAllByTestId('kept-map-address')
    expect(lines).toHaveLength(3)
    expect(lines[0]!.textContent).toContain(ZZ)
    expect(lines[0]!.textContent).toContain('Kept Tue, Nov 24.')
    fireEvent.click(screen.getByRole('button', { name: `Clear ${ZZ}` }))
    const yes = await screen.findByRole('button', { name: 'Clear the address' })
    expect(screen.getByText('Clear this kept address?')).toBeTruthy()
    expect(screen.getByText(`${ZZ}. No record holds its street line. The map looks it up again the next time anyone types it.`)).toBeTruthy()
    expect(io.cleared).toEqual([])
    fireEvent.click(yes)
    await waitFor(() => expect(io.cleared).toEqual([ZZ]))
    expect(await screen.findByText('The kept address was cleared.')).toBeTruthy()
    await waitFor(() => expect(screen.getAllByTestId('kept-map-address')).toHaveLength(2))
  })

  it('clears nothing when the confirm is cancelled', async () => {
    draw('dev')
    await openAndFind()
    fireEvent.click(await screen.findByRole('button', { name: `Clear ${ZZ}` }))
    await screen.findByRole('button', { name: 'Clear the address' })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Clear the address' })).toBeNull())
    expect(io.cleared).toEqual([])
  })

  it('keeps an address records are written under: no confirm, and the line names each kind', async () => {
    draw('dev')
    await openAndFind()
    fireEvent.click(await screen.findByRole('button', { name: `Clear ${REAL}` }))
    await waitFor(() => expect(screen.getAllByTestId('kept-map-address-why').map((el) => el.textContent)).toContain('Its street line is written on 2 jobs and 1 customer. It stays.'))
    expect(screen.queryByRole('button', { name: 'Clear the address' })).toBeNull()
    expect((screen.getByRole('button', { name: `Clear ${REAL}` }) as HTMLButtonElement).disabled).toBe(true)
    expect(io.cleared).toEqual([])
  })

  it('offers no clear of an address too short to check, and says why', async () => {
    draw('dev')
    await openAndFind()
    const press = (await screen.findByRole('button', { name: 'Clear 9 st' })) as HTMLButtonElement
    expect(press.disabled).toBe(true)
    expect(screen.getAllByTestId('kept-map-address-why').map((el) => el.textContent)).toContain('This address is too short to tell apart from the others. It stays.')
  })

  it('says what to do when the search finds nothing', async () => {
    io.rows = []
    draw('dev')
    await openAndFind('nowhere')
    expect((await screen.findByTestId('kept-map-addresses-none')).textContent).toBe('The map keeps no address with the words nowhere. Type fewer words and press Find kept addresses.')
  })

  it('says the reason and clears nothing when a read fails, or the clear is refused', async () => {
    io.hitsFail = true
    draw('dev')
    await openAndFind()
    fireEvent.click(await screen.findByRole('button', { name: `Clear ${ZZ}` }))
    expect(await screen.findByText('The network dropped.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Clear the address' })).toBeNull()
    io.hitsFail = false
    io.refuse = new Error('Its street line is written on 1 job. It stays.')
    await waitFor(() => expect((screen.getByRole('button', { name: `Clear ${ZZ}` }) as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(screen.getByRole('button', { name: `Clear ${ZZ}` }))
    fireEvent.click(await screen.findByRole('button', { name: 'Clear the address' }))
    expect(await screen.findByText('Its street line is written on 1 job. It stays.')).toBeTruthy()
    expect(io.cleared).toEqual([])
    expect(screen.getAllByTestId('kept-map-address')).toHaveLength(3)
  })

  it('reads every source the rule lists', () => {
    expect(KEPT_ADDRESS_SOURCES.length).toBeGreaterThan(20)
  })
})
