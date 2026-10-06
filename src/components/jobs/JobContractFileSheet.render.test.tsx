// @vitest-environment jsdom
/**
 * The filing sheet and a paper signed by two (v2.4657): the Second signer box starts with the
 * second signer the draft named, the office clears it when one person signed, and a second
 * signature already given through the link is shown and kept instead of a box.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import JobContractFileSheet from './JobContractFileSheet'
import type { JobContractRow } from '../../lib/jobs/jobContractLifecycle'

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, role: 'dev' }) }))

type FileInput = { signerName: string; coSignerName?: string; existingDraft: JobContractRow | null }
const fileSpy = vi.fn((_input: FileInput) => Promise.resolve({ row: { id: 'c1' } as JobContractRow, uploadError: null }))
vi.mock('../../lib/jobs/jobContractFileWrite', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/jobs/jobContractFileWrite')>()),
  fileSignedJobContract: (input: FileInput) => fileSpy(input),
}))

const draft = (p: Record<string, unknown> = {}) => ({ id: 'c1', job_id: 'j1', status: 'draft', voided_at: null, co_signer_name: null, co_signed_at: null, co_signer_printed_name: null, ...p }) as unknown as JobContractRow

async function renderSheet(p: { defaultCoSignerName?: string; existingDraft?: JobContractRow | null } = {}) {
  const onFiled = vi.fn()
  renderWithProviders(
    <JobContractFileSheet
      layout="inline"
      jobId="j1"
      defaultSignerName="Sam Owner"
      defaultCoSignerName={p.defaultCoSignerName}
      existingDraft={p.existingDraft ?? null}
      basePayload={null}
      initialLink="https://docs.google.com/document/d/abc"
      initialSignedOn=""
      onFiled={onFiled}
      onCancel={() => undefined}
    />,
  )
  await settle()
  return { onFiled }
}
const secondBox = () => screen.getByLabelText('Second signer') as HTMLInputElement

beforeEach(() => fileSpy.mockClear())
afterEach(cleanup)

describe('JobContractFileSheet — a paper signed by two', () => {
  it('starts the Second signer box with the second signer the window names, and files both', async () => {
    const { onFiled } = await renderSheet({ defaultCoSignerName: 'Alex Owner', existingDraft: draft({ co_signer_name: 'Alex Owner' }) })
    expect(secondBox().value).toBe('Alex Owner')
    expect((screen.getByLabelText('Who signed') as HTMLInputElement).value).toBe('Sam Owner')
    fireEvent.click(screen.getByTestId('contract-file-record'))
    await waitFor(() => expect(onFiled).toHaveBeenCalled())
    expect(fileSpy.mock.calls[0]![0]).toMatchObject({ signerName: 'Sam Owner', coSignerName: 'Alex Owner' })
  })

  it('files one signer when the office clears the box', async () => {
    const { onFiled } = await renderSheet({ defaultCoSignerName: 'Alex Owner' })
    fireEvent.change(secondBox(), { target: { value: '' } })
    fireEvent.click(screen.getByTestId('contract-file-record'))
    await waitFor(() => expect(onFiled).toHaveBeenCalled())
    expect(fileSpy.mock.calls[0]![0]).toMatchObject({ signerName: 'Sam Owner', coSignerName: '' })
  })

  it('starts empty with no second signer named, and files the one the office types', async () => {
    const { onFiled } = await renderSheet()
    expect(secondBox().value).toBe('')
    expect(secondBox().placeholder).toBe('Only if two people signed')
    fireEvent.change(secondBox(), { target: { value: 'Jordan Owner' } })
    fireEvent.click(screen.getByTestId('contract-file-record'))
    await waitFor(() => expect(onFiled).toHaveBeenCalled())
    expect(fileSpy.mock.calls[0]![0]).toMatchObject({ coSignerName: 'Jordan Owner' })
  })

  it("falls back to the draft row's second signer when the caller names none (the sweep)", async () => {
    await renderSheet({ existingDraft: draft({ co_signer_name: 'Alex Owner' }) })
    expect(secondBox().value).toBe('Alex Owner')
  })

  it("follows the sweep's draft when it lands or changes after the sheet opened, but never over a name the office typed", async () => {
    const sheet = (existingDraft: JobContractRow | null) => (
      <JobContractFileSheet layout="inline" jobId="j1" defaultSignerName="Sam Owner" existingDraft={existingDraft} basePayload={null} initialLink="https://docs.google.com/document/d/abc" initialSignedOn="" onFiled={() => undefined} onCancel={() => undefined} />
    )
    const first = renderWithProviders(sheet(null))
    await settle()
    expect(secondBox().value).toBe('')
    first.rerender(sheet(draft({ co_signer_name: 'Alex Owner' })))
    await waitFor(() => expect(secondBox().value).toBe('Alex Owner'))
    // the second signer taken off the draft in the full window: the untouched box empties
    first.rerender(sheet(draft({ co_signer_name: null })))
    await waitFor(() => expect(secondBox().value).toBe(''))
    first.unmount()

    const second = renderWithProviders(sheet(null))
    await settle()
    fireEvent.change(secondBox(), { target: { value: 'Jordan Owner' } })
    second.rerender(sheet(draft({ co_signer_name: 'Alex Owner' })))
    await settle()
    expect(secondBox().value).toBe('Jordan Owner')
  })

  it('shows a second signature already given through the link and keeps it', async () => {
    const out = draft({ status: 'sent', sent_channel: 'pdf_email', co_signer_name: 'Alex Owner', co_signed_at: '2026-10-01T15:00:00Z', co_signer_printed_name: 'Alex Owner' })
    const { onFiled } = await renderSheet({ defaultCoSignerName: 'Alex Owner', existingDraft: out })
    expect(screen.queryByLabelText('Second signer')).toBeNull()
    expect(screen.getByTestId('contract-file-co-on-file').textContent).toBe('Alex Owner signed through the link on Oct 1. That signature stays.')
    fireEvent.click(screen.getByTestId('contract-file-record'))
    await waitFor(() => expect(onFiled).toHaveBeenCalled())
    expect(fileSpy.mock.calls[0]![0]).toMatchObject({ signerName: 'Sam Owner', coSignerName: '' })
  })
})
