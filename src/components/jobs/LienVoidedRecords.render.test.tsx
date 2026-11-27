// @vitest-environment jsdom
/**
 * The dev's list of a test job's voided records (punch list #443, row 2): a dev on a ZZ test job reads it, nobody
 * else does and no real job draws it, the press asks first and calls the function once, and a refusal the function
 * raises is shown as its own sentence. Made-up names.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { JobLienFilingRow } from '../../lib/jobs/lienDeadlines'
import { LienVoidedRecords } from './LienVoidedRecords'

const io = vi.hoisted(() => {
  class Refused extends Error {
    constructor(reason: string) {
      super(reason)
      this.name = 'LienUnvoidRefused'
    }
  }
  return {
    Refused,
    asked: [] as string[],
    answer: { restored: 1, unsetAside: 0 },
    fail: null as null | Error,
  }
})
vi.mock('../../lib/jobs/lienFilingUnvoidIo', () => ({
  LienUnvoidRefused: io.Refused,
  unvoidLienFiling: async (record: { id: string }) => {
    io.asked.push(record.id)
    if (io.fail) throw io.fail
    return io.answer
  },
}))

const filing = (over: Partial<JobLienFilingRow>): JobLienFilingRow =>
  ({ id: 'f1', job_id: 'j1', kind: 'notice_53_056', by_hand: false, applied_from: null, packet_id: null, months_covered: ['2026-08'], sends: [], fields: {}, amount: 100, filed_at: null, voided_at: '2026-11-24T20:00:00Z', created_at: '2026-11-23T18:00:00Z', document_url: '', document_note: '', ...over }) as JobLienFilingRow
const FILINGS = [
  filing({}),
  filing({ id: 'aff', kind: 'affidavit', filed_at: '2026-11-16', months_covered: [], voided_at: '2026-11-25T20:00:00Z' }),
  filing({ id: 'applied', by_hand: true, applied_from: 'f1', voided_at: '2026-11-22T20:00:00Z' }),
  // Never listed: a live record.
  filing({ id: 'live', voided_at: null }),
]
const ZZ = { job_name: 'ZZ Test lien walk', customer_name: 'ZZ Test Customer' }
const REAL = { job_name: 'Larkfield Lot 9', customer_name: 'Larkfield Homes' }

const draw = (role: string, job = ZZ, filings = FILINGS) => {
  const changed = { n: 0 }
  const view = renderWithProviders(<LienVoidedRecords role={role} filings={filings} job={job} onChanged={() => void (changed.n += 1)} />)
  return { changed, container: view.container }
}
const box = () => screen.queryByTestId('lien-voided-records')
const openList = () => fireEvent.click(within(screen.getByTestId('lien-voided-records')).getByRole('button', { name: 'Show' }))
const rows = () => screen.getAllByTestId('lien-voided-record')
const press = (i: number) => within(rows()[i]!).getByRole('button') as HTMLButtonElement

beforeEach(() => {
  io.asked = []
  io.answer = { restored: 1, unsetAside: 0 }
  io.fail = null
})
afterEach(cleanup)

describe('LienVoidedRecords', () => {
  it('draws nothing for every role but a dev, on a test job too', () => {
    for (const role of ['master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent', 'subcontractor', 'helpers']) {
      const { container } = draw(role)
      expect(box()).toBeNull()
      expect(container.querySelector('button')).toBeNull()
      cleanup()
    }
  })

  it('draws nothing for a dev on a real job', () => {
    const { container } = draw('dev', REAL)
    expect(box()).toBeNull()
    expect(container.querySelector('button')).toBeNull()
  })

  it('draws nothing for a dev on a test job that holds no voided record', () => {
    const { container } = draw('dev', ZZ, [filing({ id: 'live', voided_at: null })])
    expect(box()).toBeNull()
    expect(container.querySelector('button')).toBeNull()
  })

  it('lists the voided records of every kind behind Show, newest void first, each fact a value on its own line', () => {
    draw('dev')
    expect(box()!.textContent).toContain('Voided records · 3')
    expect(screen.queryAllByTestId('lien-voided-record')).toHaveLength(0)
    openList()
    expect(rows()).toHaveLength(3)
    const values = (i: number) => [...rows()[i]!.querySelectorAll('[data-value="worked-out"]')].map((el) => el.textContent)
    expect(values(0)).toEqual(['Lien affidavit', 'Mon, Nov 16', 'Mon, Nov 23', 'Wed, Nov 25'])
    expect(values(1)).toEqual(['§ 53.056 notice', '2026-08', 'Mon, Nov 23', 'Tue, Nov 24'])
    expect(values(2)).toEqual(['§ 53.056 notice, applied from a paper on record', '2026-08', 'Mon, Nov 23', 'Sun, Nov 22'])
    expect([...rows()[1]!.querySelectorAll('.vipLineLabel')].map((el) => el.textContent)).toEqual(['Record', 'Covers', 'Recorded', 'Voided'])
    expect(box()!.textContent).toContain('Only a developer sees this list, and only on a test job.')
  })

  it('puts a record back after a confirm that names the act and says what comes back', async () => {
    const { changed } = draw('dev')
    openList()
    fireEvent.click(press(1))
    const yes = await screen.findByRole('button', { name: 'Put the record back' })
    expect(screen.getByText('Put this record back?')).toBeTruthy()
    expect(screen.getByText('The record stands live on this job again. A paper its void put back on the Lien desk goes to sent again, tied to this record. A paper its void set aside stands again.')).toBeTruthy()
    expect(io.asked).toEqual([])
    fireEvent.click(yes)
    await waitFor(() => expect(io.asked).toEqual(['f1']))
    await waitFor(() => expect(changed.n).toBe(1))
    expect(await screen.findByText('The record is back. Its paper on the Lien desk is sent again, tied to it.')).toBeTruthy()
  })

  it('puts nothing back when the confirm is cancelled', async () => {
    const { changed } = draw('dev')
    openList()
    fireEvent.click(press(0))
    await screen.findByRole('button', { name: 'Put the record back' })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Put the record back' })).toBeNull())
    expect(io.asked).toEqual([])
    expect(changed.n).toBe(0)
  })

  it('shows a refusal the function raises as its own sentence, on the record’s line, and reads the window again', async () => {
    io.fail = new io.Refused('The paper this record sent has moved on since the void. The record stays voided.')
    const { changed } = draw('dev')
    openList()
    fireEvent.click(press(1))
    fireEvent.click(await screen.findByRole('button', { name: 'Put the record back' }))
    await waitFor(() => expect(within(rows()[1]!).getByTestId('lien-voided-record-why').textContent).toBe('The paper this record sent has moved on since the void. The record stays voided.'))
    expect(screen.getAllByText('The paper this record sent has moved on since the void. The record stays voided.').length).toBeGreaterThanOrEqual(2)
    expect(document.body.textContent).not.toContain('Failed to')
    expect(changed.n).toBe(1)
    // The press stays live: what held the record may change.
    await waitFor(() => expect(press(1).disabled).toBe(false))
  })

  it('shows any other failure with its reason, and keeps nothing on the line', async () => {
    io.fail = new Error('The record was not put back. The database gave no answer.')
    const { changed } = draw('dev')
    openList()
    fireEvent.click(press(1))
    fireEvent.click(await screen.findByRole('button', { name: 'Put the record back' }))
    expect(await screen.findByText('The record was not put back. The database gave no answer.')).toBeTruthy()
    expect(within(rows()[1]!).queryByTestId('lien-voided-record-why')).toBeNull()
    expect(changed.n).toBe(0)
  })

  it('draws the press dead on a record that applied a paper already on record, with the reason beside it', () => {
    draw('dev')
    openList()
    expect(press(2).disabled).toBe(true)
    expect(within(rows()[2]!).getByTestId('lien-voided-record-why').textContent).toBe('This record applied a paper already on record. Undo was its take-back. It stays voided.')
    fireEvent.click(press(2))
    expect(screen.queryByRole('button', { name: 'Put the record back' })).toBeNull()
    expect(io.asked).toEqual([])
  })

  it('stands each press a thumb tall', () => {
    draw('dev')
    openList()
    const presses = within(screen.getByTestId('lien-voided-records')).getAllByRole('button')
    expect(presses).toHaveLength(4)
    for (const b of presses) expect((b as HTMLButtonElement).style.minHeight).toBe('44px')
  })
})
