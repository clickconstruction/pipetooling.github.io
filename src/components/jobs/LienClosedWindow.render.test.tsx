// @vitest-environment jsdom
/**
 * The window a chip at a closed end opens. The reads and the writes are mocked; the jobs are made up. The words and
 * the rule are `lienClosedEnd.test.ts`; this is the wiring: which press does which write, what is kept as the reason,
 * the second step of Let it go, the doors, the walk and the dead presses.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'

const io = vi.hoisted(() => ({ keepCollectingLienClosed: vi.fn(), letLienClosedJobGo: vi.fn(), readLienClosedFirmWarning: vi.fn(), recordLienMonthsClosed: vi.fn() }))
vi.mock('../../lib/jobs/lienClosedEndIo', () => io)
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

import LienClosedWindow, { type LienClosedPaper } from './LienClosedWindow'
import type { LienClosedFacts } from '../../lib/jobs/lienClosedEnd'

const facts = (over: Partial<LienClosedFacts> = {}): LienClosedFacts => ({ number: '4127', name: 'Cedar Park Dental', gcName: 'Ridgeway Builders', unpaid: 2918, months: [], lienDay: '2026-11-16', lienDaysLeft: -2, lastMonth: '2026-08', source: 'hours', commercial: false, hasPaper: true, collectionsSince: '2026-11-10T15:00:00Z', status: 'billed', canAnswer: true, canSetLastWork: true, ...over })
const GONE: LienClosedPaper = { jobId: 'j1', facts: facts(), gcCustomerId: 'gc1', customerId: 'c1' }
const GONE_TOO: LienClosedPaper = { jobId: 'j2', facts: facts({ number: '4068', name: 'Alder Row', collectionsSince: null, hasPaper: false }), gcCustomerId: 'gc1', customerId: null }
const MONTH: LienClosedPaper = { jobId: 'j3', facts: facts({ number: '4093', name: 'Maple Street Lofts', months: [{ key: '2026-08', deadline: '2026-10-15' }], lienDay: '2026-12-15', lienDaysLeft: 27, source: 'bill', collectionsSince: null }), gcCustomerId: 'gc1', customerId: null }

type Doors = { onClose: ReturnType<typeof vi.fn>; onChanged: ReturnType<typeof vi.fn>; onSetLastWork: ReturnType<typeof vi.fn>; onRecordFiling: ReturnType<typeof vi.fn>; onDraftLateNotice: ReturnType<typeof vi.fn> }

function open(papers: LienClosedPaper[], start = papers[0]!.jobId): Doors {
  const doors: Doors = { onClose: vi.fn(), onChanged: vi.fn(), onSetLastWork: vi.fn(), onRecordFiling: vi.fn(), onDraftLateNotice: vi.fn() }
  renderWithProviders(<LienClosedWindow jobIds={papers.map((p) => p.jobId)} startJobId={start} paperFor={(id) => papers.find((p) => p.jobId === id) ?? null} authUserId="u1" authName="Dana" authRole="assistant" {...doors} />)
  return doors
}
const press = (key: string) => document.querySelector(`[data-lien-closed-press="${key}"]`) as HTMLButtonElement
const answerRow = (key: string) => document.querySelector(`[data-lien-closed-answer="${key}"]`) as HTMLElement

afterEach(() => {
  cleanup()
  for (const fn of Object.values(io)) fn.mockReset()
})

describe('LienClosedWindow · the lien day has passed', () => {
  it('says what closed, the day and where the day comes from, then the three answers', async () => {
    io.readLienClosedFirmWarning.mockResolvedValue(null)
    open([GONE])
    const win = screen.getByRole('dialog', { name: 'The lien day has passed' })
    expect(win.getAttribute('data-lien-closed-kind')).toBe('gone')
    expect(win.querySelector('[data-lien-closed-sub]')!.textContent).toBe('4127 · Cedar Park Dental · Ridgeway Builders · $2,918 unpaid')
    expect(Array.from(win.querySelectorAll('[data-lien-closed-what]')).map((el) => el.textContent)).toEqual(['The last day to file a lien on this job was Monday, Nov 16.', 'An affidavit was made for it, and no filing is on record.', 'As the dates stand, no lien can be filed for this job.', 'The money is still owed.'])
    expect(win.querySelector('[data-lien-closed-from]')!.textContent).toBe('The last month of work is August 2026. It comes from the job’s approved hours.')
    expect(screen.getByText(/Ask the attorney when it is not clear\./)).toBeTruthy()
    expect(Array.from(win.querySelectorAll('[data-lien-closed-answer]')).map((el) => el.getAttribute('data-lien-closed-answer'))).toEqual(['date', 'keep', 'let_go'])
    expect([press('date').textContent, press('keep').textContent, press('let_go').textContent]).toEqual(['Set the last day of work ›', 'Keep collecting 4127', 'Mark 4127 Uncollectible'])
    expect(win.querySelector('[data-lien-closed-open]')).toBeNull()
    // The Legal desk's warning is asked for by the job's payer, the GC first.
    await waitFor(() => expect(io.readLienClosedFirmWarning).toHaveBeenCalledWith({ gc_customer_id: 'gc1', customer_id: 'c1' }))
  })

  it('Keep collecting takes the job off the lien path with the day, the choice and the person’s note as the reason', async () => {
    io.readLienClosedFirmWarning.mockResolvedValue(null)
    io.keepCollectingLienClosed.mockResolvedValue({ answer: 'off_path', changed: true, onAttorneyList: false, alreadyOnList: true, held: null })
    const doors = open([GONE])
    fireEvent.change(document.querySelector('[data-lien-closed-note]') as HTMLInputElement, { target: { value: 'The builder pays in January' } })
    fireEvent.click(press('keep'))
    await waitFor(() => expect(doors.onClose).toHaveBeenCalledWith(true))
    expect(io.keepCollectingLienClosed).toHaveBeenCalledWith({ jobId: 'j1', reason: 'The lien day passed on Nov 16 with no lien filed. The office keeps collecting. The builder pays in January.', inCollections: true })
    expect(doors.onChanged).toHaveBeenCalledTimes(1)
    expect(io.letLienClosedJobGo).not.toHaveBeenCalled()
    expect(await screen.findByText('4127 is off the Lien desk. It stays in Collections.')).toBeTruthy()
  })

  it('Let it go asks once more before it marks, and Not yet takes the question back', async () => {
    io.readLienClosedFirmWarning.mockResolvedValue(null)
    io.letLienClosedJobGo.mockResolvedValue({ stripe: [] })
    const doors = open([GONE])
    fireEvent.click(press('let_go'))
    // Armed: nothing is written, and the row asks with the act named on its press.
    expect(io.letLienClosedJobGo).not.toHaveBeenCalled()
    expect(press('let_go')).toBeNull()
    expect(answerRow('let_go').querySelector('[data-lien-closed-confirm]')!.textContent).toContain('Mark 4127 Uncollectible?')
    expect(press('let_go_yes').textContent).toBe('Yes, mark 4127 Uncollectible')
    fireEvent.click(press('let_go_no'))
    expect(press('let_go').textContent).toBe('Mark 4127 Uncollectible')
    expect(io.letLienClosedJobGo).not.toHaveBeenCalled()
    fireEvent.click(press('let_go'))
    fireEvent.click(press('let_go_yes'))
    await waitFor(() => expect(doors.onClose).toHaveBeenCalledWith(true))
    expect(io.letLienClosedJobGo).toHaveBeenCalledWith({ jobId: 'j1', reason: 'The lien day passed on Nov 16 with no lien filed. The office let it go.', inCollections: true, authRole: 'assistant' })
    expect(io.keepCollectingLienClosed).not.toHaveBeenCalled()
    expect(await screen.findByText('4127 is marked Uncollectible. It is off the Lien desk.')).toBeTruthy()
  })

  it('shows the Legal desk’s warning under Let it go when a law firm holds the account', async () => {
    io.readLienClosedFirmWarning.mockResolvedValue('The Legal desk has this account with the firm (demand sent).')
    open([GONE])
    await waitFor(() => expect(answerRow('let_go').querySelector('[data-lien-closed-firm]')!.textContent).toBe('The Legal desk has this account with the firm (demand sent).'))
  })

  it('a write that fails leaves the window open on the paper and says the reason', async () => {
    io.readLienClosedFirmWarning.mockResolvedValue(null)
    io.keepCollectingLienClosed.mockRejectedValue({ message: 'Only the office can take a job off the lien path.' })
    const doors = open([GONE])
    fireEvent.click(press('keep'))
    expect(await screen.findByText('4127 is as it was: Only the office can take a job off the lien path.')).toBeTruthy()
    expect(doors.onClose).not.toHaveBeenCalled()
    expect(doors.onChanged).not.toHaveBeenCalled()
    await waitFor(() => expect(press('keep').disabled).toBe(false))
  })

  it('the doors close the window and open where the date or the filing is fixed', () => {
    io.readLienClosedFirmWarning.mockResolvedValue(null)
    const a = open([GONE])
    fireEvent.click(press('date'))
    expect(a.onClose).toHaveBeenCalledWith(false)
    expect(a.onSetLastWork).toHaveBeenCalledWith('j1')
    cleanup()
    const b = open([GONE])
    fireEvent.click(document.querySelector('[data-lien-closed-door="filed"]') as HTMLButtonElement)
    expect(b.onClose).toHaveBeenCalledWith(false)
    expect(b.onRecordFiling).toHaveBeenCalledWith('j1')
  })

  it('a viewer outside the lien office reads the window with every answer dead and its reason, and no note box', () => {
    io.readLienClosedFirmWarning.mockResolvedValue(null)
    open([{ ...GONE, facts: facts({ canAnswer: false, canSetLastWork: false }) }])
    expect([press('date').disabled, press('keep').disabled, press('let_go').disabled]).toEqual([true, true, true])
    expect(Array.from(document.querySelectorAll('[data-lien-closed-dead]')).map((el) => el.textContent)).toEqual(['The office sets the last day of work.', 'The office answers this.', 'The office answers this.'])
    expect(document.querySelector('[data-lien-closed-note]')).toBeNull()
    fireEvent.click(press('keep'))
    expect(io.keepCollectingLienClosed).not.toHaveBeenCalled()
  })
})

describe('LienClosedWindow · a month’s notice window closed', () => {
  it('says what is still open and offers a late notice, the date and the record, never the let-go answers', () => {
    const doors = open([MONTH])
    const win = screen.getByRole('dialog', { name: 'A notice window closed' })
    expect(win.getAttribute('data-lien-closed-kind')).toBe('month')
    expect(win.querySelector('[data-lien-closed-open]')!.textContent).toBe('A late notice still counts while the lien day is ahead. This job’s lien day is Dec 15.')
    expect(Array.from(win.querySelectorAll('[data-lien-closed-answer]')).map((el) => el.getAttribute('data-lien-closed-answer'))).toEqual(['late_notice', 'date', 'record'])
    expect(win.querySelector('[data-lien-closed-note]')).toBeNull()
    // No lien day has passed, so the Legal desk is not asked.
    expect(io.readLienClosedFirmWarning).not.toHaveBeenCalled()
    fireEvent.click(press('late_notice'))
    expect(doors.onClose).toHaveBeenCalledWith(false)
    expect(doors.onDraftLateNotice).toHaveBeenCalledWith('j3')
  })

  it('Record it closed writes the months down with who looked', async () => {
    io.recordLienMonthsClosed.mockResolvedValue(undefined)
    const doors = open([MONTH])
    expect(press('record').textContent).toBe('Record August 2026 closed')
    fireEvent.click(press('record'))
    await waitFor(() => expect(doors.onClose).toHaveBeenCalledWith(true))
    expect(io.recordLienMonthsClosed).toHaveBeenCalledWith({ jobId: 'j3', months: ['2026-08'], userId: 'u1', userName: 'Dana' })
    expect(await screen.findByText('Recorded. No notice goes for August 2026 on 4093.')).toBeTruthy()
  })
})

describe('LienClosedWindow · walking a bin’s papers', () => {
  it('counts the papers, passes one over with Next, and moves on after an answer until none is left', async () => {
    io.readLienClosedFirmWarning.mockResolvedValue(null)
    io.keepCollectingLienClosed.mockResolvedValue({ answer: 'off_path', changed: true, onAttorneyList: true, alreadyOnList: false, held: null })
    const doors = open([GONE, GONE_TOO])
    const at = () => screen.getByTestId('lien-closed-window').getAttribute('data-lien-closed-job')
    const walk = () => document.querySelector('[data-lien-closed-walk]')!.textContent
    expect([at(), walk()]).toEqual(['j1', '1 of 2'])
    fireEvent.click(document.querySelector('[data-lien-closed-next]') as HTMLButtonElement)
    expect([at(), walk()]).toEqual(['j2', '2 of 2'])
    // Answer the second: the window goes back to the one passed over, and no Next is left to press.
    fireEvent.click(press('keep'))
    await waitFor(() => expect(at()).toBe('j1'))
    expect(io.keepCollectingLienClosed).toHaveBeenLastCalledWith({ jobId: 'j2', reason: 'The lien day passed on Nov 16 with no lien filed. The office keeps collecting.', inCollections: false })
    expect(doors.onClose).not.toHaveBeenCalled()
    expect(doors.onChanged).toHaveBeenCalledTimes(1)
    expect(document.querySelector('[data-lien-closed-next]')).toBeNull()
    expect(await screen.findByText('4068 is off the Lien desk. It is in Collections.')).toBeTruthy()
    fireEvent.click(press('keep'))
    await waitFor(() => expect(doors.onClose).toHaveBeenCalledWith(true))
    expect(doors.onChanged).toHaveBeenCalledTimes(2)
  })

  it('opens on the chip that was pressed, and Escape closes it', () => {
    io.readLienClosedFirmWarning.mockResolvedValue(null)
    const doors = open([GONE, GONE_TOO], 'j2')
    expect(screen.getByTestId('lien-closed-window').getAttribute('data-lien-closed-job')).toBe('j2')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(doors.onClose).toHaveBeenCalledWith(false)
  })

  it('closes by itself on a paper that has left the closed end', async () => {
    const doors = open([], 'gone-already')
    await waitFor(() => expect(doors.onClose).toHaveBeenCalledWith(false))
  })
})
