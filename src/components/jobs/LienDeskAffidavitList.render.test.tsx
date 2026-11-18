// @vitest-environment jsdom
/**
 * By paper → Lien affidavits through its hook and its list alone (v2.7585): what the hook hands back with
 * nothing to list, the held-only press, the print box's fold, and what the empty list says and offers. The
 * rows, the three batch presses and the print with data are held where they were, by `LienDesk.render.test.tsx`.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, renderHook } from '@testing-library/react'
import type { LienDeskData } from '../../hooks/useLienDeskData'
import { installDomShims, renderWithProviders } from '../../test/renderSmokeMocks'
import { LienDeskAffidavitList } from './LienDeskAffidavitList'
import { useLienDeskAffidavits, type LienDeskAffidavitsInput } from './useLienDeskAffidavits'

const seen = vi.hoisted(() => ({ confirms: 0, toasts: 0, prints: 0 }))

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../contexts/ConfirmDialogContext', async (orig) => ({
  ...(await orig<typeof import('../../contexts/ConfirmDialogContext')>()),
  useConfirmDialog: () => () => {
    seen.confirms += 1
    return Promise.resolve(true)
  },
}))
vi.mock('../../contexts/ToastContext', async (orig) => ({
  ...(await orig<typeof import('../../contexts/ToastContext')>()),
  useToastContext: () => ({
    showToast: () => {
      seen.toasts += 1
    },
  }),
}))
vi.mock('../../lib/people/fetchActiveUsers', () => ({ fetchActiveUsers: () => Promise.resolve({ data: [] }) }))
vi.mock('../../lib/jobsDocuments/printWindow', () => ({
  openHtmlPrintWindow: () => {
    seen.prints += 1
    return true
  },
}))

const emptyData = { affidavits: { entries: [], counts: {} }, jobsById: {}, gcsById: {}, ownerCallByJob: {} } as unknown as LienDeskData

const input = (over: Partial<LienDeskAffidavitsInput> = {}): LienDeskAffidavitsInput => ({
  data: null,
  todayYmd: '2026-11-17',
  authUserId: 'user-1',
  issuer: null,
  signerNameFor: () => '',
  onChanged: () => {},
  finding: false,
  findWords: [],
  findFactsFor: () => ({ shown: [] }) as never,
  oneColumn: false,
  affPile: null,
  setAffPile: () => {},
  affHeldOnlyPicked: false,
  setAffHeldOnlyPicked: () => {},
  affSelectedJobId: null,
  ...over,
})

function Harness({ over = {}, list = {} }: { over?: Partial<LienDeskAffidavitsInput>; list?: Partial<Parameters<typeof LienDeskAffidavitList>[0]> }) {
  const aff = useLienDeskAffidavits(input(over))
  return (
    <LienDeskAffidavitList
      aff={aff}
      heads={{ listRef: { current: null }, lit: null, onScroll: () => {}, scrollToPile: () => {} }}
      data={over.data ?? null}
      loading={false}
      isMobile={false}
      office
      finding={over.finding ?? false}
      find=""
      onClearFind={() => {}}
      affPile={over.affPile ?? null}
      onShowEveryPile={() => {}}
      onShowCalendar={() => {}}
      pileChips={null}
      supplierMarks={new Map()}
      rowLabel={(jobId) => jobId}
      onPick={() => {}}
      {...list}
    />
  )
}

beforeAll(() => installDomShims())
afterEach(() => {
  cleanup()
  seen.confirms = 0
  seen.toasts = 0
  seen.prints = 0
})

describe('useLienDeskAffidavits', () => {
  it('hands back an empty list and dead presses until the desk has data', () => {
    const { result } = renderHook(() => useLienDeskAffidavits(input()))
    expect(result.current.affVisible).toEqual([])
    expect(result.current.affSelected).toBeNull()
    expect(result.current.affShown).toBeNull()
    expect(result.current.affCount).toBe(0)
    expect(result.current.affPilesShown).toEqual([])
    expect(result.current.affPrintPlanAll.ready).toEqual([])
    expect(result.current.affSendPlanAll.ready).toEqual([])
    expect(result.current.redrawPlan.ready).toEqual([])
    expect(result.current.affHeldOnly).toBe(false)
    expect(result.current.affPrintWords.dead).toBe(true)
  })

  it('the held-only press needs a held paper to narrow the list', () => {
    const { result } = renderHook(() => useLienDeskAffidavits(input({ affHeldOnlyPicked: true })))
    expect(result.current.affHeldOnly).toBe(false)
  })

  it('showing the held papers lifts the pressed pile; going back does not', () => {
    const setAffPile = vi.fn()
    const setAffHeldOnlyPicked = vi.fn()
    const { result } = renderHook(() => useLienDeskAffidavits(input({ setAffPile, setAffHeldOnlyPicked })))
    act(() => result.current.showHeldAffidavits(true))
    expect(setAffHeldOnlyPicked).toHaveBeenLastCalledWith(true)
    expect(setAffPile).toHaveBeenCalledWith(null)
    act(() => result.current.showHeldAffidavits(false))
    expect(setAffHeldOnlyPicked).toHaveBeenLastCalledWith(false)
    expect(setAffPile).toHaveBeenCalledTimes(1)
  })

  it('the print box opens folded and the press unfolds it', () => {
    const { result } = renderHook(() => useLienDeskAffidavits(input()))
    expect(result.current.affPrintFolded).toBe(true)
    act(() => result.current.toggleAffPrintFold())
    expect(result.current.affPrintFolded).toBe(false)
  })

  it('with nothing ready, the three batch presses print, ask and write nothing', async () => {
    const { result } = renderHook(() => useLienDeskAffidavits(input({ data: emptyData })))
    await act(async () => {
      result.current.printReadyAffidavits()
      await result.current.redrawReady()
      await result.current.sendDraftedAffidavits()
    })
    expect(seen.prints).toBe(0)
    expect(seen.confirms).toBe(0)
  })
})

describe('LienDeskAffidavitList', () => {
  it('says it is still looking while the desk loads', () => {
    renderWithProviders(<Harness list={{ loading: true }} />)
    expect(document.querySelector('[data-lien-affidavit-list]')?.textContent).toContain('Looking at every unpaid job…')
    expect(document.querySelector('[data-lien-affidavit-empty]')).toBeNull()
  })

  it('an empty list offers the calendar, and draws none of the batch boxes', () => {
    const onShowCalendar = vi.fn()
    renderWithProviders(<Harness over={{ data: emptyData }} list={{ onShowCalendar }} />)
    const empty = document.querySelector('[data-lien-affidavit-empty="list"]') as HTMLElement
    fireEvent.click(empty.querySelector('button') as HTMLButtonElement)
    expect(onShowCalendar).toHaveBeenCalledTimes(1)
    expect(document.querySelector('[data-lien-affidavit-redraw]')).toBeNull()
    expect(document.querySelector('[data-lien-affidavit-send-all]')).toBeNull()
    expect(document.querySelector('[data-lien-affidavit-print-all]')).toBeNull()
  })

  it('an empty pressed pile and an empty find each offer the press that clears them', () => {
    const onShowEveryPile = vi.fn()
    renderWithProviders(<Harness over={{ data: emptyData, affPile: 'ready' }} list={{ onShowEveryPile }} />)
    fireEvent.click((document.querySelector('[data-lien-affidavit-empty="ready"]') as HTMLElement).querySelector('button') as HTMLButtonElement)
    expect(onShowEveryPile).toHaveBeenCalledTimes(1)
    cleanup()

    const onClearFind = vi.fn()
    renderWithProviders(<Harness over={{ data: emptyData, finding: true, findWords: ['zzz'] }} list={{ find: 'zzz', onClearFind }} />)
    fireEvent.click((document.querySelector('[data-lien-affidavit-empty="find"]') as HTMLElement).querySelector('button') as HTMLButtonElement)
    expect(onClearFind).toHaveBeenCalledTimes(1)
  })
})
