// @vitest-environment jsdom
/**
 * The dev's list of voided by-hand notice records (punch list #443, row 1): a dev reads it, nobody else does, a
 * record on a real job stays and says why, and a record something points at stays and says what. Under it, on a test
 * job, the Activity lines of records deleted before, with Clear. Made-up names.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { onJobActivityChanged } from '../../lib/jobs/jobActivityChanged'
import type { JobLienFilingRow } from '../../lib/jobs/lienDeadlines'
import { LienVoidedByHandRecords } from './LienVoidedByHandRecords'

const io = vi.hoisted(() => ({
  ties: { deskPapers: 0, bills: 0, appliedFrom: 0, sentCopies: 0 },
  siblings: 0,
  tiesFail: false,
  asked: [] as string[],
  tiesRead: [] as string[],
  refuse: null as null | Error,
  /** The job's notice lines on its Activity, as each read answers them. */
  lines: [] as Array<{ id: string; detail: unknown }>,
  linesFail: false,
  linesRead: [] as string[],
  /** What the clear answers: how many lines the function cleared. */
  clearAnswer: 0,
  clearRefuse: null as null | Error,
  clearAsked: [] as string[],
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
  readLienNoticeActivityLines: async (jobId: string) => {
    io.linesRead.push(jobId)
    if (io.linesFail) throw new Error('The network dropped.')
    return io.lines
  },
  clearLienNoticeStrayLines: async (jobId: string) => {
    io.clearAsked.push(jobId)
    if (io.clearRefuse) throw io.clearRefuse
    return io.clearAnswer
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
  renderWithProviders(<LienVoidedByHandRecords role={role} filings={filings} job={job} jobId="j1" onChanged={() => void (changed.n += 1)} />)
  return changed
}
/** Two lines whose records are gone, one whose record stands (the job's live record) and one that names no record. */
const LINES = [
  { id: 'l-gone-1', detail: { source_id: 'gone-1' } },
  { id: 'l-gone-2', detail: { source_id: 'gone-2' } },
  { id: 'l-stands', detail: { source_id: 'live' } },
  { id: 'l-names-nothing', detail: {} },
]
const strayBox = () => screen.queryByTestId('lien-notice-stray-lines')
const clearPress = () => within(screen.getByTestId('lien-notice-stray-lines')).getByRole('button') as HTMLButtonElement
const openList = () => fireEvent.click(within(screen.getByTestId('lien-voided-by-hand')).getByRole('button', { name: 'Show' }))
const deletePress = (i: number) => within(screen.getAllByTestId('lien-voided-by-hand-record')[i]!).getByRole('button') as HTMLButtonElement

beforeEach(() => {
  io.ties = { deskPapers: 0, bills: 0, appliedFrom: 0, sentCopies: 0 }
  io.siblings = 0
  io.tiesFail = false
  io.asked = []
  io.tiesRead = []
  io.refuse = null
  io.lines = []
  io.linesFail = false
  io.linesRead = []
  io.clearAnswer = 0
  io.clearRefuse = null
  io.clearAsked = []
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

  it('draws nothing for a dev on a job with no voided by-hand notice and no stray line', async () => {
    io.lines = [LINES[2]!, LINES[3]!]
    const { container } = renderWithProviders(<LienVoidedByHandRecords role="dev" filings={FILINGS.slice(2)} job={ZZ} jobId="j1" onChanged={() => {}} />)
    await waitFor(() => expect(io.linesRead).toEqual(['j1']))
    expect(screen.queryByTestId('lien-voided-by-hand')).toBeNull()
    expect(strayBox()).toBeNull()
    expect(container.querySelector('button')).toBeNull()
  })

  it('lists the voided by-hand notices behind Show, newest voided first, and no other record', async () => {
    draw('dev')
    await settle()
    expect(screen.getByTestId('lien-voided-by-hand').textContent).toContain('Voided by-hand notice records · 2')
    expect(screen.queryAllByTestId('lien-voided-by-hand-record')).toHaveLength(0)
    openList()
    const lines = screen.getAllByTestId('lien-voided-by-hand-record')
    expect(lines).toHaveLength(2)
    expect(lines[0]!.textContent).toContain('Covers 2026-08. Recorded Mon, Nov 23. Voided Tue, Nov 24.')
    expect(screen.getByTestId('lien-voided-by-hand').textContent).toContain('Its line on the job’s Activity goes with it.')
    expect(screen.getByTestId('lien-voided-by-hand').textContent).not.toContain('Activity stays')
  })

  it('deletes a record nothing points at, after a confirm that names the act and says the Activity line goes with it', async () => {
    io.siblings = 1
    const changed = draw('dev')
    openList()
    fireEvent.click(deletePress(0))
    const yes = await screen.findByRole('button', { name: 'Delete the record' })
    expect(io.tiesRead).toEqual(['f2'])
    expect(screen.getByText('Delete this notice record?')).toBeTruthy()
    expect(screen.getByText('1 record is deleted, for good. Its line on the job’s Activity goes with it. 1 other record of the same paper, on another job, stays.')).toBeTruthy()
    expect(io.asked).toEqual([])
    fireEvent.click(yes)
    await waitFor(() => expect(io.asked).toEqual(['f2']))
    await waitFor(() => expect(changed.n).toBe(1))
    expect(await screen.findByText('The record was deleted. Its line on the job’s Activity went with it.')).toBeTruthy()
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

  it('stands each press a thumb tall', async () => {
    io.lines = LINES
    draw('dev')
    openList()
    await waitFor(() => expect(strayBox()).not.toBeNull())
    const presses = [...within(screen.getByTestId('lien-voided-by-hand')).getAllByRole('button'), clearPress()]
    expect(presses).toHaveLength(4)
    for (const b of presses) expect((b as HTMLButtonElement).style.minHeight).toBe('44px')
  })
})

describe('LienVoidedByHandRecords · the Activity lines of deleted notice records', () => {
  it('draws nothing new for every role but a dev, and reads nothing for them', async () => {
    io.lines = LINES
    for (const role of ['master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent', 'subcontractor', 'helpers']) {
      draw(role)
      await Promise.resolve()
      expect(strayBox()).toBeNull()
      expect(screen.queryByTestId('lien-voided-by-hand')).toBeNull()
      cleanup()
    }
    expect(io.linesRead).toEqual([])
  })

  it('draws the line with its count for a dev on a test job that holds no voided record', async () => {
    io.lines = LINES
    draw('dev', ZZ, FILINGS.slice(2))
    await waitFor(() => expect(strayBox()?.textContent).toContain('Activity lines of deleted notice records · 2'))
    expect(io.linesRead).toEqual(['j1'])
    expect(screen.queryByTestId('lien-voided-by-hand')).toBeNull()
    expect(clearPress().textContent).toBe('Clear…')
    expect(clearPress().disabled).toBe(false)
  })

  it('draws it under the list of voided records when the job holds both', async () => {
    io.lines = LINES
    draw('dev')
    await waitFor(() => expect(strayBox()).not.toBeNull())
    const records = screen.getByTestId('lien-voided-by-hand')
    expect(records.textContent).toContain('Voided by-hand notice records · 2')
    expect(records.compareDocumentPosition(strayBox()!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('counts a line only when the job holds no record with the id it names', async () => {
    // f1 and f2 are the job's voided records, live is its live one: a line that names any of them is no stray.
    io.lines = [{ id: 'a', detail: { source_id: 'f1' } }, { id: 'b', detail: { source_id: 'f2' } }, { id: 'c', detail: { source_id: 'live' } }, { id: 'd', detail: null }]
    draw('dev')
    await waitFor(() => expect(io.linesRead).toEqual(['j1']))
    expect(strayBox()).toBeNull()
  })

  it('does not draw it on a real job, and reads nothing there', async () => {
    io.lines = LINES
    draw('dev', REAL)
    await Promise.resolve()
    expect(screen.getByTestId('lien-voided-by-hand')).toBeTruthy()
    expect(strayBox()).toBeNull()
    expect(io.linesRead).toEqual([])
  })

  it('Clear… confirms with the count, calls the function once, toasts the count it answered, and reads the window again', async () => {
    io.lines = LINES
    io.clearAnswer = 2
    const changed = draw('dev', ZZ, FILINGS.slice(2))
    await waitFor(() => expect(strayBox()).not.toBeNull())
    fireEvent.click(clearPress())
    const yes = await screen.findByRole('button', { name: 'Clear 2 lines' })
    expect(screen.getByText('Clear these 2 Activity lines?')).toBeTruthy()
    expect(screen.getByText('2 lines are deleted from the job’s Activity, for good. Each names a notice record that was deleted. Every other line stays.')).toBeTruthy()
    expect(io.clearAsked).toEqual([])
    // The function cleared them: the next read holds only the lines that stay.
    io.lines = [LINES[2]!, LINES[3]!]
    fireEvent.click(yes)
    await waitFor(() => expect(io.clearAsked).toEqual(['j1']))
    expect(await screen.findByText('2 Activity lines were cleared.')).toBeTruthy()
    await waitFor(() => expect(changed.n).toBe(1))
    await waitFor(() => expect(strayBox()).toBeNull())
    expect(io.linesRead).toEqual(['j1', 'j1'])
    expect(io.clearAsked).toEqual(['j1'])
  })

  it('says the count the function answered, not the count the window drew', async () => {
    io.lines = LINES
    io.clearAnswer = 1
    draw('dev', ZZ, FILINGS.slice(2))
    await waitFor(() => expect(strayBox()).not.toBeNull())
    fireEvent.click(clearPress())
    fireEvent.click(await screen.findByRole('button', { name: 'Clear 2 lines' }))
    expect(await screen.findByText('1 Activity line was cleared.')).toBeTruthy()
  })

  it('says so when the function cleared none', async () => {
    io.lines = [LINES[0]!]
    io.clearAnswer = 0
    draw('dev', ZZ, FILINGS.slice(2))
    await waitFor(() => expect(strayBox()?.textContent).toContain('· 1'))
    fireEvent.click(clearPress())
    fireEvent.click(await screen.findByRole('button', { name: 'Clear 1 line' }))
    expect(await screen.findByText('No Activity line was cleared. The database found no line whose record is gone.')).toBeTruthy()
  })

  it('calls nothing when the confirm is cancelled', async () => {
    io.lines = LINES
    const changed = draw('dev', ZZ, FILINGS.slice(2))
    await waitFor(() => expect(strayBox()).not.toBeNull())
    fireEvent.click(clearPress())
    await screen.findByRole('button', { name: 'Clear 2 lines' })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Clear 2 lines' })).toBeNull())
    expect(io.clearAsked).toEqual([])
    expect(changed.n).toBe(0)
    await waitFor(() => expect(clearPress().disabled).toBe(false))
    expect(strayBox()?.textContent).toContain('· 2')
  })

  it('says the function’s reason when the clear is refused, and reads nothing again', async () => {
    io.lines = LINES
    io.clearRefuse = new Error('Only a developer can clear Activity lines.')
    const changed = draw('dev', ZZ, FILINGS.slice(2))
    await waitFor(() => expect(strayBox()).not.toBeNull())
    fireEvent.click(clearPress())
    fireEvent.click(await screen.findByRole('button', { name: 'Clear 2 lines' }))
    expect(await screen.findByText('Only a developer can clear Activity lines.')).toBeTruthy()
    expect(changed.n).toBe(0)
    expect(io.linesRead).toEqual(['j1'])
    expect(strayBox()?.textContent).toContain('· 2')
  })

  it('draws nothing extra when the lines cannot be read, and the list of records is as it was', async () => {
    io.linesFail = true
    draw('dev')
    await waitFor(() => expect(io.linesRead).toEqual(['j1']))
    expect(strayBox()).toBeNull()
    expect(screen.getByTestId('lien-voided-by-hand').textContent).toContain('Voided by-hand notice records · 2')
    openList()
    expect(deletePress(0).disabled).toBe(false)
    expect(screen.queryByText('The network dropped.')).toBeNull()
  })

  it('does not count a record’s own line as a stray while the window reads again after its delete', async () => {
    // The job's records, then the same job with f2 deleted: its line went with it, so the next read holds no stray.
    io.lines = [{ id: 'l-f2', detail: { source_id: 'f2' } }]
    const changed = { n: 0 }
    const { rerender } = renderWithProviders(<LienVoidedByHandRecords role="dev" filings={FILINGS} job={ZZ} jobId="j1" onChanged={() => void (changed.n += 1)} />)
    await waitFor(() => expect(io.linesRead).toEqual(['j1']))
    expect(strayBox()).toBeNull()
    io.lines = []
    rerender(<LienVoidedByHandRecords role="dev" filings={FILINGS.filter((f) => f.id !== 'f2')} job={ZZ} jobId="j1" onChanged={() => void (changed.n += 1)} />)
    expect(strayBox()).toBeNull()
    await waitFor(() => expect(io.linesRead).toEqual(['j1', 'j1']))
    expect(strayBox()).toBeNull()
  })
})

describe('LienVoidedByHandRecords · a job window open behind it hears a delete (finding 283)', () => {
  /** The jobs a list of Activity would read again. */
  const hear = () => {
    const heard: string[] = []
    const stop = onJobActivityChanged((id) => heard.push(id))
    return { heard, stop }
  }

  it('Clear… says the job’s Activity changed once the function cleared lines', async () => {
    io.lines = LINES
    io.clearAnswer = 2
    const { heard, stop } = hear()
    const changed = draw('dev', ZZ, FILINGS.slice(2))
    await waitFor(() => expect(strayBox()).not.toBeNull())
    fireEvent.click(clearPress())
    const yes = await screen.findByRole('button', { name: 'Clear 2 lines' })
    // Nothing is said on the first press or while the confirm stands.
    expect(heard).toEqual([])
    fireEvent.click(yes)
    await waitFor(() => expect(changed.n).toBe(1))
    expect(heard).toEqual(['j1'])
    stop()
  })

  it('says nothing when the function cleared none, when the confirm is cancelled, or when the clear is refused', async () => {
    io.lines = LINES
    io.clearAnswer = 0
    const { heard, stop } = hear()
    const changed = draw('dev', ZZ, FILINGS.slice(2))
    await waitFor(() => expect(strayBox()).not.toBeNull())
    fireEvent.click(clearPress())
    fireEvent.click(await screen.findByRole('button', { name: 'Clear 2 lines' }))
    await waitFor(() => expect(changed.n).toBe(1))
    await waitFor(() => expect(clearPress().disabled).toBe(false))
    fireEvent.click(clearPress())
    await screen.findByRole('button', { name: 'Clear 2 lines' })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Clear 2 lines' })).toBeNull())
    await waitFor(() => expect(clearPress().disabled).toBe(false))
    io.clearRefuse = new Error('This job is not a test job.')
    fireEvent.click(clearPress())
    fireEvent.click(await screen.findByRole('button', { name: 'Clear 2 lines' }))
    expect(await screen.findByText('This job is not a test job.')).toBeTruthy()
    expect(heard).toEqual([])
    stop()
  })

  it('Delete… says so too, since the record’s line goes with it, and says nothing when the delete is refused', async () => {
    const { heard, stop } = hear()
    const changed = draw('dev')
    openList()
    fireEvent.click(deletePress(0))
    fireEvent.click(await screen.findByRole('button', { name: 'Delete the record' }))
    await waitFor(() => expect(changed.n).toBe(1))
    expect(heard).toEqual(['j1'])
    io.refuse = new Error('A desk paper points at this record.')
    await waitFor(() => expect(deletePress(1).disabled).toBe(false))
    fireEvent.click(deletePress(1))
    fireEvent.click(await screen.findByRole('button', { name: 'Delete the record' }))
    expect(await screen.findByText('A desk paper points at this record.')).toBeTruthy()
    expect(heard).toEqual(['j1'])
    stop()
  })
})
