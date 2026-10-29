// @vitest-environment jsdom
/**
 * Your signature on an email (punch list #207 PR 1) over a fake io: an office person sees the name and the cell from
 * the account, the title and the two lines read back, the preview as the email carries them, and Save lit only on a
 * change and writing the row; before the lines' column lands the two boxes wait and the title saves alone; a long
 * line stops the save with the words; a helper sees no card.
 */
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SignatureIo, SignatureLoad } from '../../lib/messages/signatureIo'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { SignatureCard } from './SignatureCard'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

const WENDI: SignatureLoad = {
  sender: { name: 'Wendi Doll', title: 'Estimator', cell: '(512) 555-0147', lines: ['bids@clickplumbing.example'] },
  kept: { title: 'Estimator', lines: ['bids@clickplumbing.example'] },
  linesOn: true,
}

function fakeIo(load: SignatureLoad): SignatureIo & { save: ReturnType<typeof vi.fn> } {
  return { load: vi.fn(async () => load), save: vi.fn(async () => undefined) }
}

const preview = () => screen.getByText((_, el) => el?.matches('[data-signature-preview]') ?? false).textContent

afterEach(cleanup)

describe('SignatureCard', () => {
  it('shows the account’s name and cell, the title and the lines read back, and the signature as it goes; Save lights on a change and writes the row', async () => {
    const io = fakeIo(WENDI)
    renderWithProviders(<SignatureCard role="estimator" userId="u-wendi" io={io} />)
    expect((await screen.findByLabelText('Title')) as HTMLInputElement).toHaveProperty('value', 'Estimator')
    expect(screen.getByText('Wendi Doll', { selector: '[data-signature-name]' })).toBeTruthy()
    expect(screen.getByText('(512) 555-0147', { selector: '[data-signature-cell]' })).toBeTruthy()
    expect((screen.getByLabelText('Line 1') as HTMLInputElement).value).toBe('bids@clickplumbing.example')
    expect((screen.getByLabelText('Line 2') as HTMLInputElement).value).toBe('')
    expect(preview()).toBe('Wendi Doll\nEstimator · Click Construction\ncell (512) 555-0147\nbids@clickplumbing.example')
    const save = screen.getByRole('button', { name: 'Save the signature' }) as HTMLButtonElement
    expect(save.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Line 2'), { target: { value: ' TX M-12345 ' } })
    expect(preview()).toBe('Wendi Doll\nEstimator · Click Construction\ncell (512) 555-0147\nbids@clickplumbing.example\nTX M-12345')
    expect(save.disabled).toBe(false)
    fireEvent.click(save)
    await waitFor(() => expect(io.save).toHaveBeenCalledWith('u-wendi', { title: 'Estimator', lines: ['bids@clickplumbing.example', 'TX M-12345'] }, true))
    await waitFor(() => expect((screen.getByRole('button', { name: 'Save the signature' }) as HTMLButtonElement).disabled).toBe(true))
    expect((screen.getByLabelText('Line 2') as HTMLInputElement).value).toBe('TX M-12345')
  })

  it('draws no gap for a person with no title, no cell and no lines, and the owner’s reply line only when he types it', async () => {
    const io = fakeIo({ sender: { name: 'Robert', title: null, cell: null, lines: [] }, kept: { title: null, lines: [] }, linesOn: true })
    renderWithProviders(<SignatureCard role="master_technician" userId="u-robert" io={io} />)
    await screen.findByLabelText('Title')
    expect(screen.getByText('no cell on your account, so the line is left out')).toBeTruthy()
    expect(preview()).toBe('Robert\nClick Construction')
    fireEvent.change(screen.getByLabelText('Line 1'), { target: { value: 'Email back, text, or call.' } })
    expect(preview()).toBe('Robert\nClick Construction\nEmail back, text, or call.')
  })

  it('holds the two boxes while their column is not there yet, and saves the title alone', async () => {
    const io = fakeIo({ sender: { name: 'Wendi Doll', title: null, cell: '(512) 555-0147', lines: [] }, kept: { title: null, lines: [] }, linesOn: false })
    renderWithProviders(<SignatureCard role="estimator" userId="u-wendi" io={io} />)
    await screen.findByLabelText('Title')
    expect((screen.getByLabelText('Line 1') as HTMLInputElement).disabled).toBe(true)
    expect(screen.getByText('The two lines arrive with the next database update. The title saves now.')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Estimator' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save the signature' }))
    await waitFor(() => expect(io.save).toHaveBeenCalledWith('u-wendi', { title: 'Estimator', lines: [] }, false))
  })

  it('stops a save on a line past 80 characters, with the words, and says why a save was refused', async () => {
    const io = fakeIo(WENDI)
    io.save = vi.fn(() => Promise.reject(new Error('permission denied for table users')))
    renderWithProviders(<SignatureCard role="estimator" userId="u-wendi" io={io} />)
    await screen.findByLabelText('Title')
    fireEvent.change(screen.getByLabelText('Line 2'), { target: { value: 'x'.repeat(81) } })
    expect(screen.getByRole('alert').textContent).toBe('A signature line holds 80 characters at most.')
    expect((screen.getByRole('button', { name: 'Save the signature' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Line 2'), { target: { value: 'TX M-12345' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save the signature' }))
    expect((await screen.findByRole('alert')).textContent).toContain('permission denied')
  })

  it('draws nothing for a helper, who sends nothing from Messages', () => {
    const io = fakeIo(WENDI)
    const { container } = renderWithProviders(<SignatureCard role="helpers" userId="u-luis" io={io} />)
    expect(container.querySelector('[data-signature-card]')).toBeNull()
    expect(io.load).not.toHaveBeenCalled()
  })
})
