// @vitest-environment jsdom
/**
 * Edit customer → Contacts (punch list #416): **Remove** asks first. Cancel writes nothing and the contact stays; the
 * confirm's press, which names the contact, deletes the row and the list is read again. Every name here is made up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'

const db = vi.hoisted(() => ({
  rows: [] as Array<{ id: string; name: string; phone: string | null; email: string | null; note: string | null; gets_bill_copies: boolean | null }>,
  deleted: [] as string[],
}))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ order: async () => ({ data: db.rows, error: null }) }) }),
      delete: () => ({
        eq: async (_column: string, id: string) => {
          db.deleted.push(id)
          db.rows = db.rows.filter((r) => r.id !== id)
          return { error: null }
        },
      }),
    }),
  },
}))

import CustomerContactsSection from './CustomerContactsSection'

beforeEach(() => {
  db.rows = [
    { id: 'c1', name: 'Dana Whitlock', phone: null, email: 'dana@northgate.test', note: 'AP clerk', gets_bill_copies: true },
    { id: 'c2', name: 'Lee Okafor', phone: '555-0100', email: null, note: null, gets_bill_copies: false },
  ]
  db.deleted = []
})
afterEach(cleanup)

async function openDana() {
  renderWithProviders(<CustomerContactsSection customerId="cust-1" />)
  fireEvent.click(await screen.findByRole('button', { name: 'Edit contact Dana Whitlock' }))
  fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
  return within(await screen.findByRole('alertdialog'))
}

describe('CustomerContactsSection, removing a contact', () => {
  it('asks first, and Cancel writes nothing', async () => {
    const ask = await openDana()
    expect(ask.getByText('Remove Dana Whitlock from this customer’s contacts? They stop getting a copy of every bill. A dev can put them back for 90 days, from Recently deleted in Settings.')).toBeTruthy()
    expect(db.deleted).toEqual([])
    fireEvent.click(ask.getByRole('button', { name: 'Keep them' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(db.deleted).toEqual([])
    // The sheet is still open on the contact, and nothing left the list.
    expect((screen.getByRole('textbox', { name: 'Contact name' }) as HTMLInputElement).value).toBe('Dana Whitlock')
    expect(screen.getByText('Lee Okafor')).toBeTruthy()
  })

  it('removes the contact on the press that names them, then reads the list again', async () => {
    const ask = await openDana()
    fireEvent.click(ask.getByRole('button', { name: 'Remove Dana Whitlock' }))
    await waitFor(() => expect(db.deleted).toEqual(['c1']))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Edit contact Dana Whitlock' })).toBeNull())
    expect(screen.queryByRole('textbox', { name: 'Contact name' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Edit contact Lee Okafor' })).toBeTruthy()
  })
})
