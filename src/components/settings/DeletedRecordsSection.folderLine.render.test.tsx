// @vitest-environment jsdom
/**
 * Recently deleted, the wiring of the Drive folder line (punch list #443, row 18): the section reads the deleted
 * jobs' kept names and links once for the list, by the job bundles' ids, and draws the line on a ZZ test job's card
 * and on no other. Made-up names and ids.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'

const seat = vi.hoisted(() => ({ role: 'dev', values: new Map<string, unknown>() }))
const io = vi.hoisted(() => ({ read: [] as string[][], facts: new Map<string, unknown>(), readFails: false }))
/** One steady answer, as the real hook's state is: a new list every draw would read the archive every draw. */
const archive = vi.hoisted(() => ({
  value: {
    bundles: [
      { group_key: 'job-zz', kind: 'job', label: '1142 · ZZ Test Payoff 1', row_count: 6, tables: ['jobs_ledger'], deleted_by: null, deleted_by_name: 'ZZ Test Dev', deleted_at: '2026-11-26T07:53:27Z' },
      { group_key: 'job-real', kind: 'job', label: '940 · Cedar Bend', row_count: 3, tables: ['jobs_ledger'], deleted_by: null, deleted_by_name: 'ZZ Test Dev', deleted_at: '2026-11-25T10:00:00Z' },
      { group_key: 'bid-zz', kind: 'bid', label: 'ZZ Test bid', row_count: 2, tables: ['bids'], deleted_by: null, deleted_by_name: 'ZZ Test Dev', deleted_at: '2026-11-24T10:00:00Z' },
    ],
    loading: false,
    error: null,
    preview: null,
    busy: null,
    submitting: false,
    runPreview: async () => {},
    runRestore: async () => null,
  },
}))
const noAlerts = vi.hoisted(() => ({ value: { alerts: [] as unknown[] } }))

vi.mock('../../hooks/useAuth', async () => {
  const { makeUseAuthValue } = await import('../../test/renderSmokeMocks')
  const value = () => {
    if (!seat.values.has(seat.role)) seat.values.set(seat.role, makeUseAuthValue({ role: seat.role }))
    return seat.values.get(seat.role)
  }
  return { useAuth: value, useOptionalAuth: value, AuthProvider: ({ children }: { children: unknown }) => children }
})
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useBulkDeleteAlerts', () => ({ useBulkDeleteAlerts: () => noAlerts.value }))
vi.mock('../../hooks/useDeletedRecordsArchive', () => ({ useDeletedRecordsArchive: () => archive.value }))
vi.mock('../../lib/jobs/jobDriveFoldersIo', () => ({
  readDeletedJobFolderFacts: async (ids: string[]) => {
    io.read.push([...ids])
    if (io.readFails) throw new Error('The network dropped.')
    return io.facts
  },
  trashDeletedJobFolder: async () => ({ act: 'trashed', words: 'Its Drive folder went to Drive’s trash.' }),
}))

import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import DeletedRecordsSection from './DeletedRecordsSection'

const LINK = 'https://drive.google.com/drive/folders/job-folder-id'
const openSection = async () => {
  renderWithProviders(<DeletedRecordsSection />)
  fireEvent.click(screen.getByRole('button', { name: /Recently deleted/ }))
  await screen.findByText('1142 · ZZ Test Payoff 1')
  await settle()
}
const card = (label: string) => within(screen.getByText(label).closest('li') as HTMLElement)

beforeEach(() => {
  seat.role = 'dev'
  io.read = []
  io.readFails = false
  io.facts = new Map<string, unknown>([
    ['job-zz', { job_name: 'ZZ Test Payoff 1', customer_name: 'ZZ Test Payoff Customer', google_drive_link: LINK }],
    ['job-real', { job_name: 'Cedar Bend', customer_name: 'Ridge Builders', google_drive_link: LINK }],
  ])
})
afterEach(cleanup)

describe('DeletedRecordsSection: the Drive folder line', () => {
  it('reads the job bundles’ kept copies once, by their ids, and draws the line on the ZZ test job alone', async () => {
    await openSection()
    await waitFor(() => expect(io.read).toEqual([['job-zz', 'job-real']]))
    expect(await card('1142 · ZZ Test Payoff 1').findByRole('button', { name: 'Send its Drive folder to the trash…' })).toBeTruthy()
    expect(card('940 · Cedar Bend').queryByTestId('deleted-job-folder')).toBeNull()
    expect(card('ZZ Test bid').queryByTestId('deleted-job-folder')).toBeNull()
    expect(screen.getAllByTestId('deleted-job-folder')).toHaveLength(1)
  })

  it('draws the cards as they were when the read fails: no line, and nothing else changed', async () => {
    io.readFails = true
    await openSection()
    await waitFor(() => expect(io.read).toHaveLength(1))
    await settle()
    expect(screen.queryByTestId('deleted-job-folder')).toBeNull()
    expect(card('1142 · ZZ Test Payoff 1').getByRole('button', { name: 'Preview restore' })).toBeTruthy()
  })
})
