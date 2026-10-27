// @vitest-environment jsdom
/**
 * Render smoke for Bids → RFIs → Paste RFI flags (punch list #184, sweep A, PR 2): the button
 * counts the parsed paste as it is typed, the import keeps going past a flag that fails, and the
 * flags that did not import stay in the box with the reason.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import { BidRfiQueue } from './BidRfiQueue'

const inserted: string[] = []
let rfiNumber = 0

vi.mock('../../lib/supabase', () => {
  function reads(data: unknown) {
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'order']) b[m] = () => b
    b.then = (ok?: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve({ data, error: null }).then(ok, bad)
    return b
  }
  return {
    supabase: {
      from: (table: string) => ({
        select: () => reads([]),
        insert: (row: { question?: string }) => {
          if (table !== 'bids_rfis') return Promise.resolve({ data: null, error: null })
          const q = row.question ?? ''
          return {
            select: () => ({
              single: async () => {
                if (q.includes('gas')) return { data: null, error: { message: 'new row violates row-level security policy', code: '42501' } }
                inserted.push(q)
                rfiNumber += 1
                return { data: { rfi_number: rfiNumber, question: q, sheet_ref: null }, error: null }
              },
            }),
          }
        },
      }),
    },
  }
})

afterEach(() => {
  cleanup()
  inserted.length = 0
})

const BID = { id: 'bid-1', customer_id: null, customers: null } as unknown as BidWithBuilder

describe('Bids → RFIs → Paste RFI flags', () => {
  it('counts the paste, imports past a refused flag, and keeps that flag in the box with the reason', async () => {
    renderWithProviders(<BidRfiQueue bid={BID} authUser={null} />)
    await screen.findByText('No RFIs on this bid yet.')
    fireEvent.click(screen.getByRole('button', { name: 'Paste RFI flags' }))
    const box = screen.getByPlaceholderText(/Paste CountTooling/) as HTMLTextAreaElement
    expect(screen.getByRole('button', { name: 'Import as drafts' }).hasAttribute('disabled')).toBe(true)
    fireEvent.change(box, { target: { value: 'RFI flags\tHartline\nP201\tWhich fixture at 3/B?\nP202\tIs the gas line by others?\nP203\tWho sets the water heater?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Import 3 as drafts' }))
    const failed = await waitFor(() => {
      const el = document.querySelector('[data-rfi-import-failed]')
      if (!el) throw new Error('no failed list yet')
      return el
    })
    // The flag after the refused one still imported.
    expect(inserted).toEqual(['Which fixture at 3/B?', 'Who sets the water heater?'])
    expect(failed.textContent).toContain('1 RFI did not import. It stays here with the reason.')
    expect(failed.textContent).toContain('P202')
    expect(box.value).toBe('P202\tIs the gas line by others?')
    expect(screen.getByRole('button', { name: 'Import 1 as a draft' })).toBeTruthy()
  })
})
