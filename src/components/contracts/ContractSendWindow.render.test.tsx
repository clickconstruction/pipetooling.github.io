// @vitest-environment jsdom
/**
 * Send for signature, the one window that emails a person's paper: it opens on the roster's address, refuses an address
 * that is not one before anything is sent, sends through the one sender, writes a quick-send pick's row only once Send
 * email is pressed and keeps that row for a second try, and says so when the paper is sent again. Since punch list #403
 * it also takes who signs: it opens on the person the paper is filed under, or on the signer the paper kept, and sends
 * the name and the title with the address.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { ContractSendWindow } from './ContractSendWindow'

const io = vi.hoisted(() => ({
  sends: [] as Array<Record<string, unknown>>,
  writes: [] as Array<Record<string, unknown>>,
  fail: null as null | Error,
  kept: { name: '', title: '', email: '' },
  keptReads: [] as string[],
  keptFails: false,
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
  readKeptSigner: async (documentId: string) => {
    io.keptReads.push(documentId)
    if (io.keptFails) throw new Error('The paper did not read.')
    return io.kept
  },
}))

/** Every name and address here is made up. */
const target = { personName: 'Priya Nair', documentName: 'Employee handbook' }
const base = { target, docId: 'd1', initialEmail: 'priya@example.com', sender: { name: 'Grace Hale', email: 'grace@example.com' }, personId: null }

beforeEach(() => {
  io.sends = []
  io.writes = []
  io.fail = null
  io.kept = { name: '', title: '', email: '' }
  io.keptReads = []
  io.keptFails = false
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
    expect(io.sends).toEqual([{ documentId: 'd1', mode: 'email', signerEmail: 'priya@example.com', signerName: 'Priya Nair', signerTitle: '', subject: 'Please sign', intro: '' }])
    expect(io.writes).toEqual([])
    expect(await screen.findByText('Signing link emailed.')).toBeTruthy()
  })

  it('opens Signer name on the person the paper is filed under, with no title, and says both are kept', () => {
    renderWithProviders(<ContractSendWindow {...base} onClose={() => {}} onSent={() => {}} />)
    expect((screen.getByLabelText('Signer name') as HTMLInputElement).value).toBe('Priya Nair')
    expect((screen.getByLabelText('Title (optional)') as HTMLInputElement).value).toBe('')
    expect(screen.getByTestId('contract-send-signer-kept').textContent).toBe('The name and the address are kept on the paper.')
  })

  it('sends the name and the title the office typed', async () => {
    const onSent = vi.fn()
    renderWithProviders(<ContractSendWindow {...base} onClose={() => {}} onSent={onSent} />)
    fireEvent.change(screen.getByLabelText('Signer name'), { target: { value: 'Priya R. Nair' } })
    fireEvent.change(screen.getByLabelText('Title (optional)'), { target: { value: 'Lead installer' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send email' }))
    await waitFor(() => expect(onSent).toHaveBeenCalled())
    expect(io.sends[0]).toMatchObject({ signerName: 'Priya R. Nair', signerTitle: 'Lead installer', signerEmail: 'priya@example.com' })
  })

  it('refuses a send with nobody named to sign, before the address is looked at', async () => {
    renderWithProviders(<ContractSendWindow {...base} initialEmail="" onClose={() => {}} onSent={() => {}} />)
    fireEvent.change(screen.getByLabelText('Signer name'), { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send email' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Enter the name of the person who signs.')
    expect(io.sends).toEqual([])
  })

  it('opens on the signer the caller read with the paper, and reads nothing itself', () => {
    renderWithProviders(<ContractSendWindow {...base} initialSignerName="Luis Ortega" initialSignerTitle="Owner" onClose={() => {}} onSent={() => {}} />)
    expect((screen.getByLabelText('Signer name') as HTMLInputElement).value).toBe('Luis Ortega')
    expect((screen.getByLabelText('Title (optional)') as HTMLInputElement).value).toBe('Owner')
    expect(io.keptReads).toEqual([])
  })

  it('reads the signer a saved paper kept when the caller passed none, and keeps the roster’s address', async () => {
    io.kept = { name: 'Luis Ortega', title: 'Owner', email: 'luis@elsewhere.example' }
    renderWithProviders(<ContractSendWindow {...base} onClose={() => {}} onSent={() => {}} />)
    await waitFor(() => expect((screen.getByLabelText('Signer name') as HTMLInputElement).value).toBe('Luis Ortega'))
    expect(io.keptReads).toEqual(['d1'])
    expect((screen.getByLabelText('Title (optional)') as HTMLInputElement).value).toBe('Owner')
    expect((screen.getByLabelText('Signer email') as HTMLInputElement).value).toBe('priya@example.com')
  })

  it('fills an empty address box with the address the paper kept', async () => {
    io.kept = { name: '', title: '', email: 'luis@elsewhere.example' }
    renderWithProviders(<ContractSendWindow {...base} initialEmail="" onClose={() => {}} onSent={() => {}} />)
    await waitFor(() => expect((screen.getByLabelText('Signer email') as HTMLInputElement).value).toBe('luis@elsewhere.example'))
    // Nobody was kept, so the name stays the person the paper is filed under.
    expect((screen.getByLabelText('Signer name') as HTMLInputElement).value).toBe('Priya Nair')
  })

  it('never lands a kept name over what the office typed', async () => {
    io.kept = { name: 'Luis Ortega', title: 'Owner', email: '' }
    renderWithProviders(<ContractSendWindow {...base} onClose={() => {}} onSent={() => {}} />)
    fireEvent.change(screen.getByLabelText('Signer name'), { target: { value: 'Someone Else' } })
    await waitFor(() => expect((screen.getByLabelText('Title (optional)') as HTMLInputElement).value).toBe('Owner'))
    expect((screen.getByLabelText('Signer name') as HTMLInputElement).value).toBe('Someone Else')
  })

  it('a kept signer that fails to read leaves the boxes as they opened', async () => {
    io.keptFails = true
    renderWithProviders(<ContractSendWindow {...base} onClose={() => {}} onSent={() => {}} />)
    await waitFor(() => expect(io.keptReads).toEqual(['d1']))
    expect((screen.getByLabelText('Signer name') as HTMLInputElement).value).toBe('Priya Nair')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('a quick-send pick has no saved paper, so nothing is read', () => {
    const plan = { kind: 'insert' as const, source: { kind: 'book' as const, appliedTemplateDocumentId: 'b1', signingBodyHtml: '<p>x</p>', signingBodyFormat: 'html', canonicalDocumentUrl: null } }
    renderWithProviders(<ContractSendWindow {...base} docId={null} quickSendPlan={plan} onClose={() => {}} onSent={() => {}} />)
    expect(io.keptReads).toEqual([])
    expect((screen.getByLabelText('Signer name') as HTMLInputElement).value).toBe('Priya Nair')
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
