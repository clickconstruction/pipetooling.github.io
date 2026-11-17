// @vitest-environment jsdom
/**
 * Documents → Where files go, the Signed contracts card (punch list #377, PR 5): the counts over the signed papers, the
 * press that says its count and files what is ready, the held papers with their reasons, the good empty state and a
 * failed read on the retry panel.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { ContractForDrive } from '../../lib/documents/whereFilesGoContractsIo'
import WhereFilesGoContractsCard from './WhereFilesGoContractsCard'

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, role: 'dev' }), useOptionalAuth: () => ({ user: { id: 'u1' }, role: 'dev' }) }))
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

const io = vi.hoisted(() => ({
  rows: [] as unknown[],
  readFails: null as null | Error,
  sweeps: 0,
  sweep: { filed: 0, held: 0 },
  sweepFails: null as null | Error,
  afterSweep: null as null | unknown[],
}))

vi.mock('../../lib/documents/whereFilesGoContractsIo', () => ({
  readSignedContractsForDrive: async () => {
    if (io.readFails) throw io.readFails
    return io.rows
  },
  fileSignedContractsInDrive: async (onPage?: (s: { filed: number; held: number }) => void) => {
    io.sweeps += 1
    if (io.sweepFails) throw io.sweepFails
    onPage?.(io.sweep)
    if (io.afterSweep) io.rows = io.afterSweep
    return io.sweep
  },
}))

const FILE = '1AbCdEfGhIjKlMnOpQrStUvWxYz012345'
function contract(over: Partial<ContractForDrive> & { id: string }): ContractForDrive {
  return { job_id: `job-${over.id}`, status: 'signed', voided_at: null, job: { hcp_number: '1042', job_name: 'Ridgeway Lot 14', customer_name: 'Ridgeway Builders' }, ...over }
}
const filed = (id: string) => contract({ id, drive_file_id: FILE, drive_file_origin: 'filed' })

beforeEach(() => {
  io.rows = []
  io.readFails = null
  io.sweeps = 0
  io.sweep = { filed: 0, held: 0 }
  io.sweepFails = null
  io.afterSweep = null
})
afterEach(cleanup)

describe('Where files go → Signed contracts', () => {
  it('says where a signed contract goes and who can open it', async () => {
    renderWithProviders(<WhereFilesGoContractsCard />)
    const card = screen.getByTestId('wfg-contracts-card')
    expect(card.textContent).toContain('under Team only › Contracts')
    expect(screen.getByTestId('wfg-contracts-who').textContent).toBe('Who can open it: the members of the jobs drive, and the office and estimators through Find a file.')
    await waitFor(() => expect(screen.getByTestId('wfg-contracts-counts')).toBeTruthy())
  })

  it('counts the papers in Drive, waiting and held, and says its count on the press', async () => {
    io.rows = [
      filed('a'),
      contract({ id: 'b', drive_file_id: FILE, drive_file_origin: 'adopted' }),
      contract({ id: 'c' }),
      contract({ id: 'd' }),
      contract({ id: 'e', drive_file_hold: 'no_file', job: { hcp_number: '1021', job_name: 'Cedar Flats Unit B', customer_name: 'Ines Calloway' } }),
    ]
    renderWithProviders(<WhereFilesGoContractsCard />)
    const counts = await screen.findByTestId('wfg-contracts-counts')
    expect(counts.textContent).toBe('5 signed contracts2 in Drive2 waiting1 held')
    expect(screen.getByTestId('wfg-contracts-press').textContent).toBe('File 2 signed contracts · 1 is held ▸')
    expect((screen.getByTestId('wfg-contracts-press') as HTMLButtonElement).disabled).toBe(false)
    expect(screen.getByTestId('wfg-contracts-held-line').textContent).toBe('1 signed contract is held. It says why.')
    const held = within(screen.getByTestId('wfg-contracts-held'))
    expect(held.getByText('1021 · Cedar Flats Unit B')).toBeTruthy()
    expect(held.getByText('Nothing to file. This record has no scan and no link.')).toBeTruthy()
    expect(held.getByText('Open the job').getAttribute('href')).toBe('/jobs?edit=job-e')
  })

  it('shows a held job folder with the job’s own reason and the door to its Edit tab', async () => {
    io.rows = [contract({ id: 'h', drive_file_hold: 'job_folder', drive_file_hold_words: 'This job’s Drive link is not a folder. Fix the link on the Edit tab, then the folder is placed.' })]
    renderWithProviders(<WhereFilesGoContractsCard />)
    const held = within(await screen.findByTestId('wfg-contracts-held'))
    expect(held.getByText('This job’s Drive link is not a folder. Fix the link on the Edit tab, then the folder is placed.')).toBeTruthy()
    expect(held.getByText('Open the job’s Edit tab').getAttribute('href')).toBe('/jobs?edit=job-h')
    // Nothing is ready: the press is dead, and the held paper still shows.
    expect((screen.getByTestId('wfg-contracts-press') as HTMLButtonElement).disabled).toBe(true)
  })

  it('files what is ready, names what it held, and reads the counts again', async () => {
    io.rows = [contract({ id: 'c' }), contract({ id: 'd' }), contract({ id: 'e', drive_file_hold: 'no_file' })]
    io.sweep = { filed: 2, held: 1 }
    io.afterSweep = [filed('c'), filed('d'), contract({ id: 'e', drive_file_hold: 'no_file' })]
    renderWithProviders(<WhereFilesGoContractsCard />)
    fireEvent.click(await screen.findByTestId('wfg-contracts-press'))
    await waitFor(() => expect(screen.getByTestId('wfg-contracts-counts').textContent).toBe('3 signed contracts2 in Drive0 waiting1 held'))
    expect(io.sweeps).toBe(1)
    expect(screen.getAllByText('Filed 2 signed contracts. 1 did not file.').length).toBeGreaterThan(0)
    expect((screen.getByTestId('wfg-contracts-press') as HTMLButtonElement).disabled).toBe(true)
  })

  it('says nothing is waiting when every signed contract is filed, and when none is signed yet', async () => {
    io.rows = [filed('a'), filed('b')]
    const first = renderWithProviders(<WhereFilesGoContractsCard />)
    expect((await screen.findByTestId('wfg-contracts-good')).textContent).toBe('Nothing waiting on Drive. Every signed contract is filed.')
    expect((screen.getByTestId('wfg-contracts-press') as HTMLButtonElement).disabled).toBe(true)
    first.unmount()
    io.rows = []
    renderWithProviders(<WhereFilesGoContractsCard />)
    expect((await screen.findByTestId('wfg-contracts-good')).textContent).toBe('Nothing waiting on Drive. A signed contract is filed here by itself.')
  })

  it('names the reason when the press fails, and keeps the list', async () => {
    io.rows = [contract({ id: 'c' })]
    io.sweepFails = new Error('Office only.')
    renderWithProviders(<WhereFilesGoContractsCard />)
    fireEvent.click(await screen.findByTestId('wfg-contracts-press'))
    await waitFor(() => expect(screen.getByText('Office only.')).toBeTruthy())
    expect(screen.getByTestId('wfg-contracts-counts').textContent).toBe('1 signed contract0 in Drive1 waiting0 held')
  })

  it('draws a failed read on the retry panel with its reason, and reads again on Retry', async () => {
    io.readFails = Object.assign(new Error('permission denied for table job_contracts'), { code: '42501' })
    renderWithProviders(<WhereFilesGoContractsCard />)
    await waitFor(() => expect(screen.getByTestId('wfg-contracts-card').textContent).toContain('The signed contracts did not read.'))
    expect(screen.queryByTestId('wfg-contracts-counts')).toBeNull()
  })
})
