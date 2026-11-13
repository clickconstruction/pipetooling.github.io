// @vitest-environment jsdom
/**
 * The contract strip as the job window's Edit tab draws it (`variant="inline"`, the owner's pick
 * of 2026-11-13): the chip, then small outlined presses with the main one first, nothing filled,
 * and the Drive link box folded behind Paste a link… until it is asked for. Every press the row
 * had is still there, in every state. The strip keeps its filled press where Bill Customer and
 * View bill mount it. Every name is made up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import type { JobContractCoverage } from '../../lib/jobs/jobContractCoverage'

const { state, fileSigned } = vi.hoisted(() => ({
  state: { coverage: { kind: 'none' } as unknown, reload: (() => Promise.resolve()) as () => Promise<void> },
  fileSigned: { fn: (() => Promise.resolve({ row: { id: 'contract-9' } })) as (...args: unknown[]) => Promise<unknown> },
}))

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useJobContractCoverage', () => ({ useJobContractCoverage: () => ({ coverage: state.coverage, rows: [], reload: () => state.reload() }) }))
vi.mock('../../hooks/useJobContractPapers', () => ({ useJobContractPapers: () => ({ papers: [], numById: new Map(), reload: () => Promise.resolve() }) }))
vi.mock('../../lib/jobs/jobContractFileWrite', () => ({ fileSignedJobContract: (...args: unknown[]) => fileSigned.fn(...args) }))
vi.mock('./JobContractModal', () => ({ default: ({ open }: { open: boolean }) => (open ? <div data-testid="contract-window-stub" /> : null) }))
vi.mock('./TheirPaperSheet', () => ({ default: ({ open, existing }: { open: boolean; existing: unknown }) => (open ? <div data-testid="their-paper-stub">{existing ? 'edit' : 'new'}</div> : null) }))
vi.mock('./AddJobContractSheet', () => ({ default: () => <div data-testid="add-contract-stub" /> }))
vi.mock('./JobContractSiblingOffer', () => ({ default: () => null }))

import { makeJob, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import JobContractStrip from './JobContractStrip'

const job = makeJob({ id: 'job-7', hcp_number: '1431', customer_id: 'cust-1', customer_name: 'Dana Whitfield' })
const FILLED = /rgb\(37, 99, 235\)|#2563eb/i
const buttonNames = () => screen.getAllByRole('button').map((b) => b.textContent)
const set = (coverage: JobContractCoverage) => {
  state.coverage = coverage
}

beforeEach(() => {
  state.coverage = { kind: 'none' }
  state.reload = vi.fn(() => Promise.resolve())
  fileSigned.fn = vi.fn(() => Promise.resolve({ row: { id: 'contract-9' } }))
})
afterEach(cleanup)

describe('JobContractStrip in the job window’s row', () => {
  it('nothing on file: the chip, then Send contract, Paste a link… and Their paper…, all outlined and no box', () => {
    renderWithProviders(<JobContractStrip job={job} variant="inline" />)
    expect(buttonNames()).toEqual(['No contract', 'Send contract', 'Paste a link…', 'Their paper…'])
    for (const b of screen.getAllByRole('button')) expect(b.getAttribute('style') ?? '').not.toMatch(FILLED)
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('Send contract and the chip open the Contract window; Their paper… opens its sheet on a new record', () => {
    renderWithProviders(<JobContractStrip job={job} variant="inline" />)
    fireEvent.click(screen.getByRole('button', { name: 'Send contract' }))
    expect(screen.getByTestId('contract-window-stub')).toBeTruthy()
    cleanup()
    renderWithProviders(<JobContractStrip job={job} variant="inline" />)
    fireEvent.click(screen.getByRole('button', { name: /No contract/ }))
    expect(screen.getByTestId('contract-window-stub')).toBeTruthy()
    fireEvent.click(screen.getByTestId('their-paper-button'))
    expect(screen.getByTestId('their-paper-stub').textContent).toBe('new')
  })

  it('Paste a link… turns into the box with the cursor in it, and File it files the link as signed', async () => {
    renderWithProviders(<JobContractStrip job={job} variant="inline" />)
    fireEvent.click(screen.getByTestId('contract-link-open'))
    const box = screen.getByLabelText('Link to the signed contract in Google Drive') as HTMLInputElement
    expect(document.activeElement).toBe(box)
    expect(screen.queryByTestId('contract-link-open')).toBeNull()
    // File it shows once something is typed, and stays dead until it is a link.
    expect(screen.queryByRole('button', { name: 'File it' })).toBeNull()
    fireEvent.change(box, { target: { value: 'not a link' } })
    expect((screen.getByRole('button', { name: 'File it' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(box, { target: { value: 'https://docs.google.com/document/d/abc123' } })
    fireEvent.click(screen.getByRole('button', { name: 'File it' }))
    await waitFor(() => expect(fileSigned.fn).toHaveBeenCalledTimes(1))
    expect(fileSigned.fn).toHaveBeenCalledWith(expect.objectContaining({ jobId: 'job-7', signerName: 'Dana Whitfield', link: 'https://docs.google.com/document/d/abc123' }))
    await waitFor(() => expect(state.reload).toHaveBeenCalled())
    await settle()
    // Filed: the box folds away.
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('the box folds back into its button when it is left empty, or on Escape', () => {
    renderWithProviders(<JobContractStrip job={job} variant="inline" />)
    fireEvent.click(screen.getByTestId('contract-link-open'))
    fireEvent.blur(screen.getByRole('textbox'))
    expect(screen.queryByRole('textbox')).toBeNull()
    fireEvent.click(screen.getByTestId('contract-link-open'))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'https://docs.google.com/x' } })
    // Something typed: leaving the box keeps it, so File it can still be pressed.
    fireEvent.blur(screen.getByRole('textbox'))
    expect(screen.getByRole('textbox')).toBeTruthy()
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' })
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.getByTestId('contract-link-open')).toBeTruthy()
  })

  it('a draft keeps the same three presses', () => {
    set({ kind: 'draft', contractId: 'c-1' })
    renderWithProviders(<JobContractStrip job={job} variant="inline" />)
    expect(buttonNames()).toEqual(['Contract draft', 'Send contract', 'Paste a link…', 'Their paper…'])
  })

  it('not needed: Their paper… alone', () => {
    set({ kind: 'not_needed', at: '2026-11-01T15:00:00Z', reason: 'Service call' })
    renderWithProviders(<JobContractStrip job={job} variant="inline" />)
    expect(buttonNames()).toEqual(['No contract · not needed', 'Their paper…'])
  })

  it('sent: the chip and Resend / manage, which opens the Contract window', () => {
    set({ kind: 'sent', contractId: 'c-1', revision: 1, sentAt: new Date().toISOString(), viewCount: 2, recipientEmail: 'dana@example.com' })
    renderWithProviders(<JobContractStrip job={job} variant="inline" />)
    expect(buttonNames()).toEqual(['Contract sent · opened 2× · today', 'Resend / manage'])
    fireEvent.click(screen.getByRole('button', { name: 'Resend / manage' }))
    expect(screen.getByTestId('contract-window-stub')).toBeTruthy()
  })

  it('signed with a paper on file: the link to it and View record', () => {
    set({ kind: 'signed', source: 'paper', documentUrl: 'https://docs.google.com/document/d/abc123', signedAt: '2026-11-03T18:00:00Z', signerName: 'Dana Whitfield', contractId: 'c-1', estimateNumber: null, estimateId: null })
    renderWithProviders(<JobContractStrip job={job} variant="inline" />)
    expect(screen.getByTestId('contract-open-link').getAttribute('href')).toBe('https://docs.google.com/document/d/abc123')
    expect(screen.getByRole('button', { name: 'View record' })).toBeTruthy()
    expect(screen.queryByTestId('contract-link-open')).toBeNull()
    expect(screen.queryByTestId('their-paper-button')).toBeNull()
  })

  it('their paper: Edit the record opens the sheet on the record', () => {
    set({
      kind: 'their_paper',
      contractId: 'c-2',
      documentUrl: null,
      record: { contractId: 'c-2', title: 'Larkfield subcontract, their form', ourSigner: 'Sam Reyes', ourSignedOn: '2026-10-20', ourSignedHow: 'ink', theirSignedOn: null, reliedOn: null, documentUrl: null, hasUpload: false, terms: [] },
    })
    renderWithProviders(<JobContractStrip job={job} variant="inline" />)
    expect(buttonNames()).toEqual(['Their paper · signed by us only · not relied on yet', 'Edit the record'])
    fireEvent.click(screen.getByTestId('their-paper-edit'))
    expect(screen.getByTestId('their-paper-stub').textContent).toBe('edit')
  })
})

describe('JobContractStrip where the bill windows mount it', () => {
  it('keeps its filled Send one to sign and Add the contract, and draws no Paste a link…', () => {
    renderWithProviders(<JobContractStrip job={job} />)
    expect(screen.getByRole('button', { name: 'Send one to sign' }).getAttribute('style') ?? '').toMatch(FILLED)
    expect(screen.getByTestId('contract-add-button')).toBeTruthy()
    expect(screen.queryByTestId('contract-link-open')).toBeNull()
  })
})
