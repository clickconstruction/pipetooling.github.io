// @vitest-environment jsdom
/**
 * The Contract window's Drive block (punch list #377, PR 4): each state it draws, and the press that files one paper now.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import ContractDriveBlock from './ContractDriveBlock'
import type { ContractDriveRow } from '../../lib/jobs/jobContractDrive'

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, role: 'dev' }) }))

const FILE_A = '1AbCdEfGhIjKlMnOpQrStUvWxYz012345'
const invoked: { current: { name: string; body: unknown }[] } = { current: [] }
const answer: { current: { data: unknown; error: unknown } } = { current: { data: null, error: null } }
const indexPath: { current: string | null } = { current: null }

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  const stub = makeSupabaseStub() as { from: (t: string) => unknown; functions?: unknown }
  const realFrom = stub.from.bind(stub)
  stub.from = (table: string) => {
    if (table !== 'file_index') return realFrom(table)
    const builder: Record<string, unknown> = {}
    for (const m of ['select', 'eq']) builder[m] = () => builder
    builder.maybeSingle = () => Promise.resolve({ data: indexPath.current ? { path: indexPath.current } : null, error: null })
    return builder
  }
  stub.functions = {
    invoke: (name: string, opts: { body: unknown }) => {
      invoked.current.push({ name, body: opts.body })
      return Promise.resolve(answer.current)
    },
  }
  return { supabase: stub }
})

beforeEach(() => {
  invoked.current = []
  answer.current = { data: null, error: null }
  indexPath.current = null
})
afterEach(cleanup)

function row(over: Partial<ContractDriveRow> = {}): ContractDriveRow {
  return { id: 'c1', job_id: 'j1', kind: 'contract', status: 'signed', voided_at: null, signed_at: '2026-11-14T18:00:00Z', signed_pdf_path: 'c1/signed.pdf', ...over }
}

const mount = (r: ContractDriveRow, onRowChanged?: () => void) => renderWithProviders(<ContractDriveBlock row={r} jobId="j1" onClose={() => {}} onRowChanged={onRowChanged} />)

describe('the Contract window’s Drive block', () => {
  it('draws nothing for a paper that is not signed', () => {
    mount(row({ status: 'sent' }))
    expect(screen.queryByTestId('contract-drive-block')).toBeNull()
  })

  it('says a filed paper is in the job’s folder, with its day and the door to Drive', () => {
    mount(row({ drive_file_id: FILE_A, drive_file_origin: 'filed', drive_filed_at: '2026-11-14T18:05:00Z' }))
    const block = screen.getByTestId('contract-drive-block')
    expect(block.getAttribute('data-state')).toBe('filed')
    expect(block.textContent).toContain('In the job’s Drive folder')
    expect(block.textContent).toContain('Team only › Contracts · filed Nov 14')
    expect(screen.getByTestId('contract-drive-open').getAttribute('href')).toBe(`https://drive.google.com/file/d/${FILE_A}/view`)
    expect(screen.queryByTestId('contract-drive-press')).toBeNull()
  })

  it('says an adopted paper is where the office put it, with its place from the index', async () => {
    indexPath.current = 'Jobs › Harlan Custom Homes › 988 · Harlan Duplex'
    mount(row({ drive_file_id: FILE_A, drive_file_origin: 'adopted', drive_filed_at: '2026-11-14T18:05:00Z' }))
    expect(screen.getByTestId('contract-drive-block').textContent).toContain('In Drive, where the office put it')
    await waitFor(() => expect(screen.getByTestId('contract-drive-block').textContent).toContain('Jobs › Harlan Custom Homes › 988 · Harlan Duplex'))
  })

  it('files a waiting paper now, then reads as filed from the function’s answer', async () => {
    answer.current = { data: { ok: true, outcome: { id: 'c1', did: 'filed', driveFileId: FILE_A }, drive: { drive_file_id: FILE_A, drive_file_origin: 'filed', drive_filed_at: '2026-11-17T18:00:00Z', drive_file_hold: null, drive_file_hold_words: null } }, error: null }
    mount(row())
    expect(screen.getByTestId('contract-drive-block').getAttribute('data-state')).toBe('waiting')
    const press = screen.getByTestId('contract-drive-press')
    expect(press.textContent).toBe('File it in Drive now')
    fireEvent.click(press)
    await waitFor(() => expect(screen.getByTestId('contract-drive-block').getAttribute('data-state')).toBe('filed'))
    expect(invoked.current).toEqual([{ name: 'job-contract-drive', body: { contract_id: 'c1' } }])
    expect(screen.getByText('The signed contract is in the job’s Drive folder.')).toBeTruthy()
  })

  it('shows a hold with its reason, its door and Try again', () => {
    mount(row({ drive_file_hold: 'job_folder', drive_file_hold_words: 'This job’s Drive link is not a folder. Fix the link on the Edit tab, then the folder is placed.' }))
    const block = screen.getByTestId('contract-drive-block')
    expect(block.getAttribute('data-state')).toBe('held')
    expect(block.textContent).toContain('Not in Drive yet')
    expect(block.textContent).toContain('This job’s Drive link is not a folder.')
    expect(screen.getByTestId('contract-drive-door').textContent).toBe('Open the job’s Edit tab')
    expect(screen.getByTestId('contract-drive-press').textContent).toBe('Try again')
  })

  it('offers Add the scan, and no Try again, on a record with nothing to file', () => {
    mount(row({ signed_pdf_path: null, drive_file_hold: 'no_file' }))
    expect(screen.getByTestId('contract-drive-door').textContent).toBe('Add the scan')
    expect(screen.queryByTestId('contract-drive-press')).toBeNull()
  })

  it('keeps the held reason on the screen when a second try is held again', async () => {
    answer.current = { data: { ok: true, outcome: { id: 'c1', did: 'held', hold: { kind: 'open_link', words: 'This job’s folder is open to anyone with its link. A signed contract is not filed there.' } }, drive: { drive_file_id: null, drive_file_origin: null, drive_file_hold: 'open_link', drive_file_hold_words: 'This job’s folder is open to anyone with its link. A signed contract is not filed there.' } }, error: null }
    mount(row({ drive_file_hold: 'drive_refused', drive_file_hold_words: 'Drive answered 500.' }))
    fireEvent.click(screen.getByTestId('contract-drive-press'))
    await waitFor(() => expect(screen.getByTestId('contract-drive-block').textContent).toContain('open to anyone with its link'))
    expect(screen.getByTestId('contract-drive-door').textContent).toBe('Open the job’s folder')
  })

  it('names the reason when the call itself fails, and stays as it was', async () => {
    answer.current = { data: null, error: { message: 'Office only.' } }
    mount(row())
    fireEvent.click(screen.getByTestId('contract-drive-press'))
    await waitFor(() => expect(screen.getByText('Office only.')).toBeTruthy())
    expect(screen.getByTestId('contract-drive-block').getAttribute('data-state')).toBe('waiting')
  })

  it('says a voided paper’s copy is renamed and kept', () => {
    mount(row({ status: 'voided', voided_at: '2026-11-16T12:00:00Z', drive_file_id: FILE_A, drive_file_origin: 'filed', drive_void_marked_at: '2026-11-16T12:10:00Z' }))
    const block = screen.getByTestId('contract-drive-block')
    expect(block.getAttribute('data-state')).toBe('voided')
    expect(block.textContent).toContain('The Drive copy is renamed VOIDED and kept.')
  })
})
