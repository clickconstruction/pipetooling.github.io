// @vitest-environment jsdom
/**
 * Punch list #357 PR 5: the ask at the end of a job, over fake ios. The job's window shows its own ask to the master
 * and nothing with none; Rate them opens the sheet with the job named and a save answers the ask with the rating;
 * Not now puts it away. The Bid Board's press counts GCs, lists them with their jobs, and one answer settles every
 * job of that GC. Someone who is never asked makes no read.
 */
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DIFFICULTY_CRITERIA_V1 } from '../../lib/bids/difficultyCriteria'
import { DIFFICULTY_PRICE_V1 } from '../../lib/bids/difficultyPrice'
import { RATE_SHEET_WORDS as S } from '../../lib/bids/difficultyRateSheet'
import type { RateSheetIo } from '../../lib/bids/difficultyRateSheetIo'
import { GC_DIFFICULTY_ASK_WORDS as A, type GcDifficultyOpenAsk } from '../../lib/bids/gcDifficultyAsk'
import type { GcDifficultyAskIo } from '../../lib/bids/gcDifficultyAskIo'
import { GC_DIFFICULTY_WORDS as W } from '../../lib/bids/gcDifficultyRating'
import { installDomShims, renderWithProviders } from '../../test/renderSmokeMocks'
import { GcDifficultyAskLine, GcDifficultyAsksPress } from './GcDifficultyAsk'

const auth = vi.hoisted(() => ({ role: 'master_technician' }))
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  const mod = useAuthModuleMock({ role: 'master_technician' })
  return { ...mod, useOptionalAuth: () => ({ role: auth.role }) }
})

// The published price list the ask reads for who may rate; null is none read (every group may).
const priceList = vi.hoisted(() => ({ raters: null as null | string[] }))
vi.mock('../../hooks/useDifficultyPrice', async () => {
  const { DIFFICULTY_PRICE_V1: v1 } = await import('../../lib/bids/difficultyPrice')
  return { useDifficultyPrice: (enabled = true) => (enabled && priceList.raters ? { id: 'p', version: 2, status: 'published', body: { ...v1, raters: priceList.raters }, note: '', publishedAt: null, publishedByName: '', updatedAt: '' } : null) }
})

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

installDomShims()

const ask = (jobId: string, customerId: string, name: string, closedAt: string): GcDifficultyOpenAsk => ({ jobId, customerId, customerName: name, jobLabel: `${jobId} Riverside Lofts`, closedAt })
const ASKS = [ask('1042', 'c1', 'Seguin Ridge Builders', '2026-11-14T15:00:00Z'), ask('1038', 'c1', 'Seguin Ridge Builders', '2026-11-12T15:00:00Z'), ask('1040', 'c2', 'Hill Country GC', '2026-11-13T15:00:00Z')]

function askIo(asks: GcDifficultyOpenAsk[] = ASKS): GcDifficultyAskIo {
  return { loadOpen: vi.fn(async () => asks), answer: vi.fn(async () => {}), dismiss: vi.fn(async () => {}) }
}

function sheetIo(): RateSheetIo {
  const V1 = { id: 'v1', version: 1, body: DIFFICULTY_CRITERIA_V1 }
  return {
    loadVersions: vi.fn(async () => ({ versions: [V1], published: V1 })),
    loadRatings: vi.fn(async () => []),
    loadPaying: vi.fn(async () => ({ readable: true, own: { medianDays: 20, samples: 1 }, receipts: [], gcPace: null, calendar: null, todayYmd: '2026-11-15' })),
    loadPrice: vi.fn(async () => DIFFICULTY_PRICE_V1),
    loadBid: vi.fn(async () => ({ pin: null, estimate: null, history: null })),
    saveRating: vi.fn(async (customerId, criteriaVersionId, picks, note, reasons = {}) => ({ id: 'r-new', customerId, criteriaVersionId, picks, pickReasons: reasons, note, ratedByName: 'Micah', ratedAt: '2026-11-15T00:00:00Z' })),
  }
}

afterEach(() => {
  cleanup()
  auth.role = 'master_technician'
  priceList.raters = null
})

describe('GcDifficultyAskLine', () => {
  it('shows this job’s ask; Rate them opens the sheet with the job named, and the save answers the ask', async () => {
    const io = askIo()
    const sheet = sheetIo()
    renderWithProviders(<GcDifficultyAskLine jobId="1042" io={io} sheetIo={sheet} />)
    const line = await screen.findByTestId('gc-difficulty-ask-line')
    expect(line.textContent).toContain(A.jobLine('Seguin Ridge Builders'))
    fireEvent.click(within(line).getByRole('button', { name: A.rate }))
    expect(await screen.findByRole('dialog', { name: 'Rate Seguin Ridge Builders' })).toBeTruthy()
    expect(await screen.findByText(S.askLead('1042 Riverside Lofts'))).toBeTruthy()
    fireEvent.click(await screen.findByRole('radio', { name: 'Field and superintendent: 2 points' }))
    fireEvent.change(screen.getByLabelText(W.noteLabel), { target: { value: 'The site was not ready twice.' } })
    fireEvent.click(screen.getByRole('button', { name: W.save(2) }))
    await waitFor(() => expect(io.answer).toHaveBeenCalledWith([ASKS[0]], 'r-new'))
    expect(sheet.saveRating).toHaveBeenCalledWith('c1', 'v1', { field: 2 }, 'The site was not ready twice.', {})
  })

  it('Not now puts this job’s ask away and says so', async () => {
    const io = askIo()
    renderWithProviders(<GcDifficultyAskLine jobId="1040" io={io} sheetIo={sheetIo()} />)
    fireEvent.click(within(await screen.findByTestId('gc-difficulty-ask-line')).getByRole('button', { name: A.notNow }))
    await waitFor(() => expect(io.dismiss).toHaveBeenCalledWith([ASKS[2]]))
    expect(await screen.findByText(A.putAway('Hill Country GC'))).toBeTruthy()
  })

  it('draws nothing for a job with no ask, and makes no read for someone who is never asked', async () => {
    const io = askIo()
    const { container } = renderWithProviders(<GcDifficultyAskLine jobId="999" io={io} sheetIo={sheetIo()} />)
    await waitFor(() => expect(io.loadOpen).toHaveBeenCalled())
    expect(container.querySelector('[data-testid="gc-difficulty-ask-line"]')).toBeNull()
    cleanup()
    auth.role = 'estimator'
    const quiet = askIo()
    renderWithProviders(<GcDifficultyAskLine jobId="1042" io={quiet} sheetIo={sheetIo()} />)
    expect(quiet.loadOpen).not.toHaveBeenCalled()
  })
})

describe('the ask and the price list (v2.7468)', () => {
  it('a master the price list names is asked, in the job and on the board', async () => {
    priceList.raters = ['office', 'estimator', 'master']
    const io = askIo()
    renderWithProviders(<GcDifficultyAskLine jobId="1042" io={io} sheetIo={sheetIo()} />)
    expect(await screen.findByTestId('gc-difficulty-ask-line')).toBeTruthy()
    cleanup()
    renderWithProviders(<GcDifficultyAsksPress io={askIo()} sheetIo={sheetIo()} />)
    expect(await screen.findByTestId('gc-difficulty-asks-press')).toBeTruthy()
  })

  it('with the masters off the list nobody is asked to rate what they cannot save, and no read is made', async () => {
    priceList.raters = ['office', 'estimator']
    const line = askIo()
    const a = renderWithProviders(<GcDifficultyAskLine jobId="1042" io={line} sheetIo={sheetIo()} />)
    expect(line.loadOpen).not.toHaveBeenCalled()
    expect(a.container.querySelector('[data-testid="gc-difficulty-ask-line"]')).toBeNull()
    cleanup()
    const board = askIo()
    const b = renderWithProviders(<GcDifficultyAsksPress io={board} sheetIo={sheetIo()} />)
    expect(board.loadOpen).not.toHaveBeenCalled()
    expect(b.container.textContent).toBe('')
    cleanup()
    // A dev walking a test job is asked whatever the list says.
    auth.role = 'dev'
    renderWithProviders(<GcDifficultyAskLine jobId="1042" io={askIo()} sheetIo={sheetIo()} />)
    expect(await screen.findByTestId('gc-difficulty-ask-line')).toBeTruthy()
  })
})

describe('GcDifficultyAsksPress', () => {
  it('counts GCs, lists each with its jobs, and one put-away settles every job of that GC', async () => {
    const io = askIo()
    renderWithProviders(<GcDifficultyAsksPress io={io} sheetIo={sheetIo()} />)
    const press = await screen.findByTestId('gc-difficulty-asks-press')
    expect(press.textContent).toBe('Rate GCs after a job · 2')
    fireEvent.click(press)
    const list = within(await screen.findByRole('dialog', { name: A.listTitle }))
    expect(list.getByText('1042 Riverside Lofts and 1 more job')).toBeTruthy()
    expect(list.getByText('1040 Riverside Lofts')).toBeTruthy()
    fireEvent.click(list.getByRole('button', { name: `${A.notNow}: Seguin Ridge Builders` }))
    await waitFor(() => expect(io.dismiss).toHaveBeenCalledWith([ASKS[0], ASKS[1]]))
  })

  it('Rate them opens the sheet on the newest job, and nothing draws with nothing to rate', async () => {
    const io = askIo()
    renderWithProviders(<GcDifficultyAsksPress io={io} sheetIo={sheetIo()} />)
    fireEvent.click(await screen.findByTestId('gc-difficulty-asks-press'))
    fireEvent.click(await screen.findByRole('button', { name: `${A.rate}: Hill Country GC` }))
    expect(await screen.findByRole('dialog', { name: 'Rate Hill Country GC' })).toBeTruthy()
    expect(await screen.findByText(S.askLead('1040 Riverside Lofts'))).toBeTruthy()
    cleanup()
    const none = askIo([])
    const { container } = renderWithProviders(<GcDifficultyAsksPress io={none} sheetIo={sheetIo()} />)
    await waitFor(() => expect(none.loadOpen).toHaveBeenCalled())
    expect(container.textContent).toBe('')
  })

  it('tells the row that holds it whether it draws, so the row can lay itself out (v2.7927)', async () => {
    const open = vi.fn()
    renderWithProviders(<GcDifficultyAsksPress io={askIo()} sheetIo={sheetIo()} onOpenChange={open} />)
    await screen.findByTestId('gc-difficulty-asks-press')
    expect(open).toHaveBeenLastCalledWith(true)
    cleanup()
    const closed = vi.fn()
    const none = askIo([])
    renderWithProviders(<GcDifficultyAsksPress io={none} sheetIo={sheetIo()} onOpenChange={closed} />)
    await waitFor(() => expect(none.loadOpen).toHaveBeenCalled())
    expect(closed).toHaveBeenLastCalledWith(false)
    expect(closed).not.toHaveBeenCalledWith(true)
  })
})
