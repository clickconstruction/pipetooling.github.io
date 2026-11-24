// @vitest-environment jsdom
/**
 * Render smokes for *Addresses that look alike* (punch list #439, piece 2): the pairs in their three groups with
 * their counts, **Same place** and **Not the same** keeping an answer under the pair's two keys in order, **Undo**
 * taking it back, the addresses with no street number, a refused read with its reason, and a refused answer said
 * in a toast. Every address and name here is made up.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import AddressLookAlikesWindow from './AddressLookAlikesWindow'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { forgetAddressesOnFile } from '../../hooks/useAddressesOnFile'

const tables: Record<string, Record<string, unknown>[]> = {}
const refuse: { read: string | null; write: string | null } = { read: null, write: null }
const writes: { table: string; op: string; row?: unknown; where?: Record<string, unknown> }[] = []

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const answer = () => (refuse.read === table ? { data: null, error: { message: 'permission denied for table ' + table, code: '42501' } } : { data: tables[table] ?? [], error: null })
      const chain = {
        select: () => chain,
        order: () => chain,
        range: () => Promise.resolve(answer()),
        upsert: (row: { key_a: string; key_b: string; same: boolean }) => {
          writes.push({ table, op: 'upsert', row })
          if (refuse.write) return Promise.resolve({ error: { message: refuse.write } })
          const rows = (tables[table] ??= [])
          const at = rows.findIndex((r) => r.key_a === row.key_a && r.key_b === row.key_b)
          const kept = { ...row, by_name: 'Cora Sample', answered_at: '2026-11-24T18:00:00Z' }
          if (at >= 0) rows[at] = kept
          else rows.push(kept)
          return Promise.resolve({ error: null })
        },
        delete: () => {
          const where: Record<string, unknown> = {}
          const del = {
            eq: (col: string, v: unknown) => {
              where[col] = v
              return del
            },
            then: (ok: (v: { error: null }) => unknown) => {
              writes.push({ table, op: 'delete', where })
              tables[table] = (tables[table] ?? []).filter((r) => !(r.key_a === where.key_a && r.key_b === where.key_b))
              return Promise.resolve({ error: null }).then(ok)
            },
          }
          return del
        },
      }
      return chain
    },
  },
}))

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'assistant' })
})

const BASE = { lat: 30, lng: -98 }

beforeEach(() => {
  cleanup()
  forgetAddressesOnFile()
  writes.length = 0
  refuse.read = null
  refuse.write = null
  tables.jobs_ledger = [
    { id: 'j1', job_address: '115 E Sample St, Exampleville, TX', development_id: null, hcp_number: '1078', click_number: null },
    { id: 'j2', job_address: '115 E Sample St, Exampleville, TX', development_id: null, hcp_number: '1114', click_number: null },
    { id: 'j3', job_address: '115 E Sampel St, Exampleville, TX', development_id: null, hcp_number: '1098', click_number: null },
    { id: 'j4', job_address: '7400 San Sample Ave, Placeholder, TX', development_id: null, hcp_number: '1016', click_number: null },
    { id: 'j5', job_address: '7400 San Sampel Ave, Placeholder, TX', development_id: null, hcp_number: '1069', click_number: null },
    { id: 'j6', job_address: 'Old Quarry Trail, Sampleton, TX', development_id: null, hcp_number: '1201', click_number: null },
  ]
  tables.bids = [{ id: 'b1', address: 'Old Quarry Trail, Sampleton, TX', development_id: null, bid_number: 'B214' }]
  tables.developments = []
  tables.address_geocodes = [
    { address_normalized: '115 e sample st, exampleville, tx', ...BASE },
    { address_normalized: '115 e sampel st, exampleville, tx', ...BASE },
    { address_normalized: '7400 san sample ave, placeholder, tx', lat: 31, lng: -98 },
    { address_normalized: '7400 san sampel ave, placeholder, tx', lat: 31.01, lng: -98 },
  ]
  tables.address_place_answers = []
})

const rows = () => screen.queryAllByTestId('address-look-alike-row')

describe('AddressLookAlikesWindow', () => {
  it('lists the pairs of the first group with what is at each address, and counts the rest', async () => {
    renderWithProviders(<AddressLookAlikesWindow onClose={() => {}} />)
    await waitFor(() => expect(rows().length).toBe(1))
    expect(screen.getByRole('tab', { name: 'Written alike, same spot on the map · 1' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tab', { name: 'Written alike, the map says apart · 1' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Different words, same spot · 0' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'No street number · 1' })).toBeTruthy()
    const row = rows()[0] as HTMLElement
    expect(row.textContent).toContain('115 E Sampel St, Exampleville, TX')
    expect(row.textContent).toContain('1 job · J1098')
    expect(row.textContent).toContain('115 E Sample St, Exampleville, TX')
    expect(row.textContent).toContain('2 jobs · J1078, J1114')
    expect(row.textContent).toContain('same spot')
    expect(screen.getByTestId('address-look-alike-counts').textContent).toBe('2 pairs to look at. 0 answered.')
    expect(screen.getByText('Same place records the match and changes no address.')).toBeTruthy()
  })

  it('keeps Same place under the two keys in order, and shows who answered with Undo', async () => {
    renderWithProviders(<AddressLookAlikesWindow onClose={() => {}} />)
    await waitFor(() => expect(rows().length).toBe(1))
    fireEvent.click(screen.getByRole('button', { name: 'Same place' }))
    await waitFor(() => expect(rows()[0]?.getAttribute('data-answered')).toBe('true'))
    expect(writes[0]).toEqual({ table: 'address_place_answers', op: 'upsert', row: { key_a: '115 east sampel street exampleville tx', key_b: '115 east sample street exampleville tx', same: true } })
    expect(rows()[0]?.textContent).toContain('Same place · Cora Sample, Nov 24')
    expect(screen.getByRole('tab', { name: 'Written alike, same spot on the map · 0' })).toBeTruthy()
    expect(screen.getByTestId('address-look-alike-counts').textContent).toBe('1 pair to look at. 1 answered.')
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(rows()[0]?.getAttribute('data-answered')).toBe('false'))
    expect(writes[1]).toEqual({ table: 'address_place_answers', op: 'delete', where: { key_a: '115 east sampel street exampleville tx', key_b: '115 east sample street exampleville tx' } })
  })

  it('keeps Not the same on the second group', async () => {
    renderWithProviders(<AddressLookAlikesWindow onClose={() => {}} />)
    await waitFor(() => expect(rows().length).toBe(1))
    fireEvent.click(screen.getByRole('tab', { name: 'Written alike, the map says apart · 1' }))
    expect(rows()[0]?.textContent).toContain('1.1 km apart')
    fireEvent.click(screen.getByRole('button', { name: 'Not the same' }))
    await waitFor(() => expect(rows()[0]?.textContent).toContain('Not the same · Cora Sample, Nov 24'))
    expect((writes[0]?.row as { same: boolean }).same).toBe(false)
  })

  it('lists the addresses with no street number, and says so when a group has nothing waiting', async () => {
    renderWithProviders(<AddressLookAlikesWindow onClose={() => {}} />)
    await waitFor(() => expect(rows().length).toBe(1))
    fireEvent.click(screen.getByRole('tab', { name: 'No street number · 1' }))
    expect(screen.getByTestId('address-no-number-row').textContent).toBe('Old Quarry Trail, Sampleton, TX1 job and 1 bid · J1201, B214')
    fireEvent.click(screen.getByRole('tab', { name: 'Different words, same spot · 0' }))
    expect(screen.getByText('Nothing waiting. Every pair that looks alike is answered.')).toBeTruthy()
  })

  it('says why when the read is refused, with no Retry for a refusal', async () => {
    refuse.read = 'address_place_answers'
    renderWithProviders(<AddressLookAlikesWindow onClose={() => {}} />)
    // The app says a permission refusal in its own words, and offers no Retry for one.
    await waitFor(() => expect(document.body.textContent).toContain('Couldn’t read the addresses that look alike. You don\'t have access to this record.'))
    expect(screen.queryByRole('button', { name: /Retry/ })).toBeNull()
    expect(rows().length).toBe(0)
  })

  it('says the reason in a toast when an answer is refused, and leaves the pair waiting', async () => {
    refuse.write = 'new row violates row-level security policy'
    renderWithProviders(<AddressLookAlikesWindow onClose={() => {}} />)
    await waitFor(() => expect(rows().length).toBe(1))
    fireEvent.click(screen.getByRole('button', { name: 'Same place' }))
    await waitFor(() => expect(screen.getByText(/row-level security/)).toBeTruthy())
    expect(rows()[0]?.getAttribute('data-answered')).toBe('false')
  })
})
