// @vitest-environment jsdom
/**
 * The dev's list of voided by-hand notice records (punch list #443, row 1): a dev reads it, nobody else does, a
 * record on a real job stays and says why, and a record something points at stays and says what. Made-up names.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { JobLienFilingRow } from '../../lib/jobs/lienDeadlines'
import { LienVoidedByHandRecords } from './LienVoidedByHandRecords'

const io = vi.hoisted(() => ({
  ties: { deskPapers: 0, bills: 0, appliedFrom: 0, sentCopies: 0 },
  siblings: 0,
  tiesFail: false,
  asked: [] as string[],
  tiesRead: [] as string[],
  refuse: null as null | Error,
}))
vi.mock('../../lib/jobs/lienByHandRecordDeleteIo', () => ({
  readLienRecordTies: async (id: string) => {
    io.tiesRead.push(id)
    if (io.tiesFail) throw new Error('The network dropped.')
    return io.ties
  },
  countLienPacketSiblings: async () => io.siblings,
  deleteLienByHandRecord: async (id: string) => {
    if (io.refuse) throw io.refuse
    io.asked.push(id)
  },
}))

const filing = (over: Partial<JobLienFilingRow>): JobLienFilingRow =>
  ({ id: 'f1', job_id: 'j1', kind: 'notice_53_056', by_hand: true, packet_id: 'p1', months_covered: ['2026-08'], sends: [], fields: {}, amount: 100, filed_at: null, voided_at: '2026-11-24T20:00:00Z', created_at: '2026-11-23T18:00:00Z', document_url: '', document_note: '', ...over }) as JobLienFilingRow
const FILINGS = [
  filing({}),
  filing({ id: 'f2', packet_id: 'p2', voided_at: '2026-11-24T21:00:00Z' }),
  // Never listed: a live by-hand record, a voided record the run made, a voided affidavit.
  filing({ id: 'live', voided_at: null }),
  filing({ id: 'run', by_hand: false }),
  filing({ id: 'aff', kind: 'affidavit' }),
]
const ZZ = { job_name: 'ZZ Test lien walk', customer_name: 'ZZ Test Customer' }
const REAL = { job_name: 'Larkfield Lot 9', customer_name: 'Larkfield Homes' }

const draw = (role: string, job = ZZ, filings = FILINGS) => {
  const changed = { n: 0 }
  renderWithProviders(<LienVoidedByHandRecords role={role} filings={filings} job={job} onChanged={() => void (changed.n += 1)} />)
  return changed
}
const openList = () => fireEvent.click(within(screen.getByTestId('lien-voided-by-hand')).getByRole('button', { name: 'Show' }))
const deletePress = (i: number) => within(screen.getAllByTestId('lien-voided-by-hand-record')[i]!).getByRole('button') as HTMLButtonElement

beforeEach(() => {
  io.ties = { deskPapers: 0, bills: 0, appliedFrom: 0, sentCopies: 0 }
  io.siblings = 0
  io.tiesFail = false
  io.asked = []
  io.tiesRead = []
  io.refuse = null
})
afterEach(cleanup)

describe('LienVoidedByHandRecords', () => {
  it('draws nothing for every role but a dev', () => {
    for (const role of ['master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent', 'subcontractor', 'helpers']) {
      draw(role)
      expect(screen.queryByTestId('lien-voided-by-hand')).toBeNull()
      cleanup()
    }
  })

  it('draws nothing for a dev on a job with no voided by-hand notice', () => {
    draw('dev', ZZ, FILINGS.slice(2))
    expect(screen.queryByTestId('lien-voided-by-hand')).toBeNull()
  })

  it('lists the voided by-hand notices behind Show, newest voided first, and no other record', () => {
    draw('dev')
    expect(screen.getByTestId('lien-voided-by-hand').textContent).toContain('Voided by-hand notice records · 2')
    expect(screen.queryAllByTestId('lien-voided-by-hand-record')).toHaveLength(0)
    openList()
    const lines = screen.getAllByTestId('lien-voided-by-hand-record')
    expect(lines).toHaveLength(2)
    expect(lines[0]!.textContent).toContain('Covers 2026-08. Recorded Mon, Nov 23. Voided Tue, Nov 24.')
    expect(screen.getByTestId('lien-voided-by-hand').textContent).toContain('Its line on the job’s Activity stays.')
  })

  it('deletes a record nothing points at, after a confirm that names the act and says the Activity line stays', async () => {
    io.siblings = 1
    const changed = draw('dev')
    openList()
    fireEvent.click(deletePress(0))
    const yes = await screen.findByRole('button', { name: 'Delete the record' })
    expect(io.tiesRead).toEqual(['f2'])
    expect(screen.getByText('Delete this notice record?')).toBeTruthy()
    expect(screen.getByText('1 record is deleted, for good. Its line on the job’s Activity stays. 1 other record of the same paper, on another job, stays.')).toBeTruthy()
    expect(io.asked).toEqual([])
    fireEvent.click(yes)
    await waitFor(() => expect(io.asked).toEqual(['f2']))
    await waitFor(() => expect(changed.n).toBe(1))
    expect(await screen.findByText('The record was deleted. Its line on the job’s Activity stays.')).toBeTruthy()
  })

  it('deletes nothing when the confirm is cancelled', async () => {
    const changed = draw('dev')
    openList()
    fireEvent.click(deletePress(0))
    await screen.findByRole('button', { name: 'Delete the record' })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Delete the record' })).toBeNull())
    expect(io.asked).toEqual([])
    expect(changed.n).toBe(0)
  })

  it('keeps a record a desk paper is tied to: no confirm, and the line says what points at it', async () => {
    io.ties = { deskPapers: 1, bills: 0, appliedFrom: 0, sentCopies: 0 }
    draw('dev')
    openList()
    fireEvent.click(deletePress(0))
    await waitFor(() => expect(screen.getByTestId('lien-voided-by-hand-why').textContent).toBe('A paper on the Lien desk is tied to this record. It stays.'))
    expect(screen.queryByRole('button', { name: 'Delete the record' })).toBeNull()
    expect(deletePress(0).disabled).toBe(true)
    expect(io.asked).toEqual([])
  })

  it('keeps every record of a real job for a dev too: dead presses, and the reason on each line', () => {
    draw('dev', REAL)
    openList()
    expect(deletePress(0).disabled).toBe(true)
    expect(deletePress(1).disabled).toBe(true)
    expect(screen.getAllByTestId('lien-voided-by-hand-why').map((el) => el.textContent)).toEqual(['Only a record on a test job can be deleted. This job is a real one.', 'Only a record on a test job can be deleted. This job is a real one.'])
    fireEvent.click(deletePress(0))
    expect(io.tiesRead).toEqual([])
  })

  it('says the reason and deletes nothing when the ties cannot be read, or the delete is refused', async () => {
    io.tiesFail = true
    const changed = draw('dev')
    openList()
    fireEvent.click(deletePress(0))
    expect(await screen.findByText('The network dropped.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Delete the record' })).toBeNull()
    io.tiesFail = false
    io.refuse = new Error('The record was not deleted. You may not have leave to delete it.')
    await waitFor(() => expect(deletePress(0).disabled).toBe(false))
    fireEvent.click(deletePress(0))
    fireEvent.click(await screen.findByRole('button', { name: 'Delete the record' }))
    expect(await screen.findByText('The record was not deleted. You may not have leave to delete it.')).toBeTruthy()
    expect(changed.n).toBe(0)
  })

  it('stands each press a thumb tall', () => {
    draw('dev')
    openList()
    for (const b of within(screen.getByTestId('lien-voided-by-hand')).getAllByRole('button')) expect((b as HTMLButtonElement).style.minHeight).toBe('44px')
  })
})
