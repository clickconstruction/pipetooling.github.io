// @vitest-environment jsdom
/**
 * Send for signature, the one window that emails a person's paper: it opens on the roster's address, refuses an address
 * that is not one before anything is sent, sends through the one sender, writes a quick-send pick's row only once Send
 * email is pressed and keeps that row for a second try, and says so when the paper is sent again.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { ContractSendWindow } from './ContractSendWindow'

const io = vi.hoisted(() => ({
  sends: [] as Array<Record<string, unknown>>,
  writes: [] as Array<Record<string, unknown>>,
  fail: null as null | Error,
}))
vi.mock('../../lib/contracts/personPaperSendIo', () => ({
  sendPersonPaperForSignature: async (input: Record<string, unknown>) => {
    io.sends.push(input)
    if (io.fail) throw io.fail
    return { acceptUrl: 'https://x/contract/accept?t=1', emailed: true, emailNote: null }
  },
  materializeQuickSendRow: async (pending: Record<string, unknown>) => {
    io.writes.push(pending)
    return 'new-row'
  },
  readPortalSlugIfLive: async () => null,
}))

/** Every name and address here is made up. */
const target = { personName: 'Priya Nair', documentName: 'Employee handbook' }
const base = { target, docId: 'd1', initialEmail: 'priya@example.com', sender: { name: 'Grace Hale', email: 'grace@example.com' }, personId: null }

beforeEach(() => {
  io.sends = []
  io.writes = []
  io.fail = null
})
afterEach(() => cleanup())

describe('ContractSendWindow', () => {
  it('opens on the roster’s address and sends the saved paper by email', async () => {
    const onSent = vi.fn()
    renderWithProviders(<ContractSendWindow {...base} onClose={() => {}} onSent={onSent} />)
    expect(screen.getByRole('dialog', { name: 'Send for signature' })).toBeTruthy()
    expect((screen.getByLabelText('Signer email') as HTMLInputElement).value).toBe('priya@example.com')
    expect(screen.queryByTestId('contract-send-again-note')).toBeNull()
    fireEvent.change(screen.getByLabelText('Email subject (optional)'), { target: { value: 'Please sign' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send email' }))
    await waitFor(() => expect(onSent).toHaveBeenCalledWith({ docId: 'd1', emailed: true, planKind: null }))
    expect(io.sends).toEqual([{ documentId: 'd1', mode: 'email', signerEmail: 'priya@example.com', subject: 'Please sign', intro: '' }])
    expect(io.writes).toEqual([])
    expect(await screen.findByText('Signing link emailed.')).toBeTruthy()
  })

  it('refuses an address that is not one, and sends nothing', async () => {
    renderWithProviders(<ContractSendWindow {...base} initialEmail="" onClose={() => {}} onSent={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Send email' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Enter a valid signer email.')
    fireEvent.change(screen.getByLabelText('Signer email'), { target: { value: 'not-an-email' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send email' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Enter a valid email address.'))
    expect(io.sends).toEqual([])
  })

  it('writes a quick-send pick’s row only on Send email, and a second try sends that same row', async () => {
    const plan = { kind: 'insert' as const, source: { kind: 'book' as const, appliedTemplateDocumentId: 'b1', signingBodyHtml: '<p>x</p>', signingBodyFormat: 'html', canonicalDocumentUrl: null } }
    const onRowWritten = vi.fn()
    const onSent = vi.fn()
    io.fail = new Error('Could not activate signing link')
    renderWithProviders(<ContractSendWindow {...base} docId={null} quickSendPlan={plan} onClose={() => {}} onRowWritten={onRowWritten} onSent={onSent} />)
    expect(io.writes).toEqual([])
    fireEvent.click(screen.getByRole('button', { name: 'Send email' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Could not activate signing link')
    expect(onRowWritten).toHaveBeenCalledWith('new-row')
    expect(onSent).not.toHaveBeenCalled()
    io.fail = null
    fireEvent.click(screen.getByRole('button', { name: 'Send email' }))
    await waitFor(() => expect(onSent).toHaveBeenCalledWith({ docId: 'new-row', emailed: true, planKind: 'insert' }))
    // One row was written, and both tries went to it.
    expect(io.writes.length).toBe(1)
    expect(io.sends.map((s) => s.documentId)).toEqual(['new-row', 'new-row'])
  })

  it('sent again, it says so, and that the link sent before stops working', () => {
    renderWithProviders(<ContractSendWindow {...base} again onClose={() => {}} onSent={() => {}} />)
    expect(screen.getByRole('dialog', { name: 'Send again' })).toBeTruthy()
    expect(screen.getByTestId('contract-send-again-note').textContent).toBe('Employee handbook goes to Priya Nair again, with a new signing link. The link sent before stops working.')
    expect(screen.getByRole('button', { name: 'Send the email again' })).toBeTruthy()
  })

  it('Cancel closes and sends nothing', () => {
    const onClose = vi.fn()
    renderWithProviders(<ContractSendWindow {...base} onClose={onClose} onSent={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalled()
    expect(io.sends).toEqual([])
  })
})
