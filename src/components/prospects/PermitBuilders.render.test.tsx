// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { answerBook, type CountedBid, type CustomerName } from '../../lib/research/builderAnswers'
import type { NameAnswerRow } from '../../lib/research/nameAnswers'
import type { BuilderRow } from '../../lib/research/permitBuilders'

/**
 * The answers on names as Builders shows them (punch list #307, PR 6's leftovers): the Our bids
 * column counts a tied customer's bids, and a builder's sheet shows each tie with whose word it
 * is, takes it back, asks *Same company?* of a customer whose name begins this one, and ties
 * any other through a search. Every name here is made up.
 */
const research = vi.hoisted(() => ({ loadBuilders: vi.fn(), loadPermitsOfBuilder: vi.fn(), markBuilder: vi.fn(), saveBuilder: vi.fn(), pullPermitsBack: vi.fn(), loadRecordsStart: vi.fn() }))
const siteIo = vi.hoisted(() => ({ loadAllNameAnswers: vi.fn(), loadCustomerNames: vi.fn(), loadRecentBidsWithCustomer: vi.fn(), loadPermitsByHouseNumber: vi.fn(), recordNameAnswer: vi.fn() }))
const answersIo = vi.hoisted(() => ({ loadBuilderAnswersGround: vi.fn() }))
vi.mock('../../lib/research/permitResearchIo', () => research)
vi.mock('../../lib/research/bidSiteIo', () => siteIo)
vi.mock('../../lib/research/builderAnswersIo', () => answersIo)

import { PermitBuilders } from './PermitBuilders'

const CUSTOMERS: CustomerName[] = [
  { id: 'c1', name: 'Ridgeway Builders' },
  { id: 'c2', name: 'Ridgeway Builders, LLC' },
  { id: 'c3', name: 'Hartwell Interiors' },
  { id: 'c4', name: 'Tall Pine Development' },
]
const TEXAS = 'ridgewaybuildersoftexas'

function builder(over: Partial<BuilderRow> = {}): BuilderRow {
  return { key: TEXAS, name: null, sample_contact: 'Ridgeway Builders of Texas LLC', kind: null, customer_id: null, mark: null, mark_reason: null, mark_by_name: null, mark_at: null, permits: 7, open: 2, last_permit_on: '2026-11-03', plumber: null, plumber_jobs: 0, bids: 0, won: 0, last_bid_on: null, ...over }
}
const copperline = builder({ key: 'copperlinemechanical', sample_contact: 'Copperline Mechanical', permits: 3, open: 0 })

const tie = (over: Partial<NameAnswerRow> = {}): NameAnswerRow => ({ id: 'a1', builder_key: TEXAS, customer_id: 'c2', answer: 'works_for', scope: 'all', permit_id: null, name: 'Ridgeway Builders of Texas LLC', answered_by: 'u2', answered_at: '2026-11-09T18:00:00Z', ...over })
const bid = (id: string, over: Partial<CountedBid> = {}): CountedBid => ({ id, customerId: 'c1', outcome: null, bidOn: '2026-06-01', projectName: 'Mill Street Lofts', legacyGcName: null, ...over })

/** What the list knows about the answers, built by the kernel the screen reads. */
function ground(rows: NameAnswerRow[], bids: CountedBid[] = []) {
  return { book: answerBook(rows, CUSTOMERS), bids, me: 'u1', people: new Map([['u1', 'Eve'], ['u2', 'Sam']]) }
}

function draw(isMobile = false) {
  return renderWithProviders(<PermitBuilders city="San Antonio" authUserId="u1" todayYmd="2026-11-11" isMobile={isMobile} onChanged={() => {}} />)
}

async function openSheet(name: string) {
  fireEvent.click(await screen.findByRole('button', { name }))
  return await screen.findByRole('dialog')
}

beforeEach(() => {
  research.loadBuilders.mockReset().mockResolvedValue([builder(), copperline])
  research.loadPermitsOfBuilder.mockReset().mockResolvedValue([])
  research.markBuilder.mockReset().mockResolvedValue(undefined)
  research.saveBuilder.mockReset().mockResolvedValue(undefined)
  research.pullPermitsBack.mockReset().mockResolvedValue(0)
  research.loadRecordsStart.mockReset().mockResolvedValue(null)
  // The worklist's own reads: the table is absent for it unless a test says so, so no chip.
  siteIo.loadAllNameAnswers.mockReset().mockResolvedValue(null)
  siteIo.loadCustomerNames.mockReset().mockResolvedValue(CUSTOMERS)
  siteIo.loadRecentBidsWithCustomer.mockReset().mockResolvedValue([])
  siteIo.loadPermitsByHouseNumber.mockReset().mockResolvedValue([])
  siteIo.recordNameAnswer.mockReset().mockResolvedValue(undefined)
  answersIo.loadBuilderAnswersGround.mockReset().mockResolvedValue(ground([]))
})
afterEach(() => cleanup())

describe('Builders, Our bids', () => {
  it('counts the bids of a customer someone tied the name to, and says through whom', async () => {
    answersIo.loadBuilderAnswersGround.mockResolvedValue(ground([tie()], [bid('b1', { outcome: 'won' }), bid('b2', { customerId: 'c2', bidOn: '2026-10-14' }), bid('b3', { projectName: 'ZZ Shadow MILL STREET LOFTS' })]))
    draw()
    expect(await screen.findByText('2 priced, 1 won')).toBeTruthy()
    expect(screen.getByText('through Ridgeway Builders')).toBeTruthy()
    // The untied name still reads the same-name count alone.
    expect(screen.getByText('never')).toBeTruthy()
    // A tied name is no longer one to get to know: only the other builder is left.
    expect(screen.getByRole('button', { name: '3 or more permits and never bid 1' })).toBeTruthy()
    expect(answersIo.loadBuilderAnswersGround).toHaveBeenCalledTimes(1)
  })

  it('adds the answers to the same-name count the read gave', async () => {
    research.loadBuilders.mockResolvedValue([builder({ bids: 3, won: 1, last_bid_on: '2026-02-01' })])
    answersIo.loadBuilderAnswersGround.mockResolvedValue(ground([tie()], [bid('b1', { outcome: 'won', bidOn: '2026-10-14' })]))
    draw()
    expect(await screen.findByText('4 priced, 2 won')).toBeTruthy()
    const sheet = await openSheet('Ridgeway Builders of Texas LLC')
    expect(within(sheet).getByText('Our bids: 4 priced, 2 won, the last on Oct 14. Plumber they use: nobody yet.')).toBeTruthy()
    expect(within(sheet).getByText('1 of them is with Ridgeway Builders, tied to this name by a person’s word.')).toBeTruthy()
  })

  it('says it on a phone card too', async () => {
    answersIo.loadBuilderAnswersGround.mockResolvedValue(ground([tie()], [bid('b1')]))
    draw(true)
    expect(await screen.findByText('Our bids: 1 priced, none won · Plumber: nobody yet')).toBeTruthy()
  })

  it('reads the same-name count alone before the answers table is on the database, and draws no section on the sheet', async () => {
    answersIo.loadBuilderAnswersGround.mockResolvedValue(null)
    research.loadBuilders.mockResolvedValue([builder({ bids: 3, won: 1 })])
    draw()
    expect(await screen.findByText('3 priced, 1 won')).toBeTruthy()
    const sheet = await openSheet('Ridgeway Builders of Texas LLC')
    expect(within(sheet).queryByTestId('builder-name-ties')).toBeNull()
  })

  it('names the reason when the answers cannot be read, and still lists the builders', async () => {
    answersIo.loadBuilderAnswersGround.mockRejectedValue(new Error('The network dropped.'))
    draw()
    expect(await screen.findByText('The network dropped.')).toBeTruthy()
    expect(screen.getByText('Until the answers on names read, Our bids counts the same name only.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Copperline Mechanical' })).toBeTruthy()
  })
})

describe('the builder’s sheet, the answer on a name', () => {
  it('shows which customer the name is tied to with whose word, and takes it back on the row it was written on', async () => {
    answersIo.loadBuilderAnswersGround.mockResolvedValue(ground([tie()]))
    draw()
    const sheet = await openSheet('Ridgeway Builders of Texas LLC')
    const section = within(sheet).getByTestId('builder-name-ties')
    expect(within(section).getByText('Our customer under this name')).toBeTruthy()
    expect(within(section).getByText('Ridgeway Builders')).toBeTruthy()
    expect(within(section).getByText('Same company · Sam’s word, Nov 9')).toBeTruthy()
    // Tied already: nothing is asked.
    expect(within(section).queryByText('Same company?')).toBeNull()
    fireEvent.click(within(section).getByRole('button', { name: 'Take back the answer on Ridgeway Builders' }))
    await waitFor(() => expect(siteIo.recordNameAnswer).toHaveBeenCalledWith({ builderKey: TEXAS, customerId: 'c2', answer: 'taken_back', scope: null, permitId: null, name: 'Ridgeway Builders of Texas LLC' }))
    // The list reads the answers again, once.
    await waitFor(() => expect(answersIo.loadBuilderAnswersGround).toHaveBeenCalledTimes(2))
  })

  it('asks Same company? of a customer whose name begins this one, and writes the same row as the bid’s window', async () => {
    draw()
    const sheet = await openSheet('Ridgeway Builders of Texas LLC')
    const section = within(sheet).getByTestId('builder-name-ties')
    expect(within(section).getByText('No customer is tied to this name. Our bids count the exact same name only.')).toBeTruthy()
    expect(within(section).getByText('Your customer is Ridgeway Builders.')).toBeTruthy()
    expect(within(section).getByText('Same company?')).toBeTruthy()
    expect(within(section).getByText('Asked because one name begins the other. Asked once.')).toBeTruthy()
    expect(siteIo.recordNameAnswer).not.toHaveBeenCalled()
    fireEvent.click(within(section).getByRole('button', { name: 'Same company' }))
    await waitFor(() => expect(siteIo.recordNameAnswer).toHaveBeenCalledWith({ builderKey: TEXAS, customerId: 'c1', answer: 'works_for', scope: 'all', permitId: null, name: 'Ridgeway Builders of Texas LLC' }))
  })

  it('keeps a No, and a Not sure, each as its own answer', async () => {
    const first = draw()
    let sheet = await openSheet('Ridgeway Builders of Texas LLC')
    fireEvent.click(within(sheet).getByRole('button', { name: 'Not them' }))
    await waitFor(() => expect(siteIo.recordNameAnswer).toHaveBeenCalledWith(expect.objectContaining({ customerId: 'c1', answer: 'someone_else', scope: null })))
    first.unmount()
    siteIo.recordNameAnswer.mockClear()
    draw()
    sheet = await openSheet('Ridgeway Builders of Texas LLC')
    fireEvent.click(within(sheet).getByRole('button', { name: 'Not sure' }))
    await waitFor(() => expect(siteIo.recordNameAnswer).toHaveBeenCalledWith(expect.objectContaining({ customerId: 'c1', answer: 'not_sure', scope: null })))
  })

  it('shows a No with whose word it is, and asks nothing more of that customer', async () => {
    answersIo.loadBuilderAnswersGround.mockResolvedValue(ground([tie({ customer_id: 'c1', answer: 'someone_else', scope: null, answered_by: 'u1' })]))
    draw()
    const sheet = await openSheet('Ridgeway Builders of Texas LLC')
    expect(within(sheet).getByText('Not them · your word, Nov 9')).toBeTruthy()
    expect(within(sheet).queryByText('Same company?')).toBeNull()
    // A No ties nobody, so the sheet still says the name is not tied.
    expect(within(sheet).getByText('No customer is tied to this name. Our bids count the exact same name only.')).toBeTruthy()
  })

  it('says a name is not tied, and ties it to a customer found by a search', async () => {
    draw()
    const sheet = await openSheet('Copperline Mechanical')
    const section = within(sheet).getByTestId('builder-name-ties')
    expect(within(section).getByText('No customer is tied to this name. Our bids count the exact same name only.')).toBeTruthy()
    expect(within(section).queryByText('Same company?')).toBeNull()
    fireEvent.click(within(section).getByRole('button', { name: 'Tie to a customer' }))
    const search = within(section).getByLabelText('Search our customers')
    fireEvent.change(search, { target: { value: 'zzz' } })
    expect(within(section).getByText('No customer begins with those words.')).toBeTruthy()
    fireEvent.change(search, { target: { value: 'hart' } })
    fireEvent.click(within(section).getByRole('button', { name: 'Same company: Hartwell Interiors' }))
    await waitFor(() => expect(siteIo.recordNameAnswer).toHaveBeenCalledWith({ builderKey: 'copperlinemechanical', customerId: 'c3', answer: 'works_for', scope: 'all', permitId: null, name: 'Copperline Mechanical' }))
  })

  it('never offers to tie a name that files for others', async () => {
    research.loadBuilders.mockResolvedValue([builder({ kind: 'files_for_others' })])
    draw()
    const sheet = await openSheet('Ridgeway Builders of Texas LLC')
    expect(within(sheet).getByText('No customer is tied to this name. A name that files for others is never tied to one customer.')).toBeTruthy()
    expect(within(sheet).queryByRole('button', { name: 'Tie to a customer' })).toBeNull()
    expect(within(sheet).queryByText('Same company?')).toBeNull()
  })

  it('names the reason when an answer cannot be saved', async () => {
    siteIo.recordNameAnswer.mockRejectedValue(new Error('Sign in again to answer.'))
    draw()
    const sheet = await openSheet('Ridgeway Builders of Texas LLC')
    fireEvent.click(within(sheet).getByRole('button', { name: 'Same company' }))
    expect(await within(sheet).findByText('Sign in again to answer.')).toBeTruthy()
  })
})

describe('Looks like a customer, beside the answers', () => {
  it('drops a pair someone has since answered on a builder’s sheet from the count', async () => {
    siteIo.loadAllNameAnswers.mockResolvedValue({ rows: [], me: 'u1' })
    const open = draw()
    expect(await screen.findByRole('button', { name: 'Looks like a customer 1' })).toBeTruthy()
    open.unmount()
    answersIo.loadBuilderAnswersGround.mockResolvedValue(ground([tie()]))
    draw()
    expect(await screen.findByRole('button', { name: 'Looks like a customer 0' })).toBeTruthy()
  })
})
