// @vitest-environment jsdom
/**
 * By paper → Retainage notices, the list alone (v2.7583): the rows under their piles, the open row, the
 * press on a row, and what an empty list says. The list inside the desk is held by `LienDesk.render.test.tsx`.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent } from '@testing-library/react'
import type { ComponentProps } from 'react'
import type { LienDeskData } from '../../hooks/useLienDeskData'
import { lienRetainageListView, type LienRetainageEntry, type LienRetainagePile } from '../../lib/jobs/lienDeskRetainage'
import { installDomShims, renderWithProviders } from '../../test/renderSmokeMocks'
import { LienDeskRetainageList } from './LienDeskRetainageList'

vi.mock('../../lib/supabase', () => ({ supabase: {} }))

const entry = (jobId: string, pile: LienRetainagePile, over: Partial<LienRetainageEntry> = {}): LienRetainageEntry =>
  ({ jobId, pile, retainageHeld: 1_000, contractEndedOn: '2026-09-03', contractEndedHow: 'complete', deadline: '2026-10-03', daysLeft: 9, severity: 'amber', inClaim: false, gcCustomerId: 'gc-1', ...over }) as LienRetainageEntry

const entries = [entry('job-a', 'to_draft'), entry('job-b', 'ready', { severity: 'red', inClaim: true })]

const data = {
  jobsById: { 'job-a': { hcp_number: '9001', click_number: null, job_name: 'ZZ Test Job A' }, 'job-b': { hcp_number: '9002', click_number: null, job_name: 'ZZ Test Job B' } },
  gcsById: { 'gc-1': { name: 'ZZ Test Builder' } },
  retainage: { entries, counts: { to_draft: 1, ready: 1 } },
  retainageUnrecorded: [],
  retainageUnrecordedFailure: null,
} as unknown as LienDeskData

function draw(over: Partial<ComponentProps<typeof LienDeskRetainageList>> = {}, shown: ReadonlyArray<LienRetainageEntry> = entries) {
  const view = lienRetainageListView({ entries: shown, pile: over.pile ?? null, finding: over.finding ?? false, matches: () => true, selectedJobId: null, oneColumn: false })
  const props: ComponentProps<typeof LienDeskRetainageList> = {
    data,
    loading: false,
    isMobile: false,
    office: true,
    pilesShown: view.pilesShown,
    heads: { listRef: { current: null }, lit: view.pilesShown[0]?.p ?? null, onScroll: () => {}, scrollToPile: () => {} },
    rowCount: view.visible.length,
    selectedJobId: null,
    pile: null,
    onShowEveryPile: () => {},
    finding: false,
    find: '',
    onClearFind: () => {},
    focusJobId: null,
    pileChips: null,
    supplierMarks: new Map(),
    onPick: () => {},
    onOpenLienContract: () => {},
    onChanged: () => {},
    ...over,
  }
  return renderWithProviders(<LienDeskRetainageList {...props} />)
}

beforeAll(() => installDomShims())
afterEach(() => cleanup())

describe('LienDeskRetainageList', () => {
  it('draws one row a job under its pile, with the job, the GC and where the claim stands', () => {
    draw()
    const list = document.querySelector('[data-lien-retainage-list]') as HTMLElement
    expect(list.querySelectorAll('[data-lien-pile-rows]')).toHaveLength(2)
    const draft = list.querySelector('[data-lien-pile-rows="to_draft"]') as HTMLElement
    expect(draft.textContent).toContain('9001 · ZZ Test Job A')
    expect(draft.textContent).toContain('ZZ Test Builder')
    expect(draft.textContent).toContain('not yet in a § 53.056 claim')
    expect((list.querySelector('[data-lien-pile-rows="ready"]') as HTMLElement).textContent).toContain('in the § 53.056 claim')
  })

  it('a row’s press hands its job to the desk, and the open row is marked', () => {
    const onPick = vi.fn()
    draw({ onPick, selectedJobId: 'job-b' })
    const rows = [...document.querySelectorAll<HTMLButtonElement>('[data-lien-pile-rows] > button')]
    expect(rows.map((r) => r.getAttribute('aria-current'))).toEqual([null, 'true'])
    fireEvent.click(rows[0]!)
    expect(onPick).toHaveBeenCalledWith('job-a')
  })

  it('says it is still looking while the desk loads', () => {
    draw({ loading: true, data: null }, [])
    expect(document.querySelector('[data-lien-retainage-list]')?.textContent).toContain('Looking at every job with retainage…')
  })

  it('with no retainage recorded, says where it goes', () => {
    draw({}, [])
    expect(document.querySelector('[data-lien-retainage-list]')?.textContent).toContain('No job with a GC has retainage recorded.')
    expect(document.querySelector('[data-lien-retainage-empty]')).toBeNull()
  })

  it('an empty pressed pile and an empty find each say so, with the press that clears them', () => {
    const onShowEveryPile = vi.fn()
    draw({ pile: 'held', onShowEveryPile }, [])
    const pileEmpty = document.querySelector('[data-lien-retainage-empty="held"]') as HTMLElement
    fireEvent.click(pileEmpty.querySelector('button') as HTMLButtonElement)
    expect(onShowEveryPile).toHaveBeenCalledTimes(1)
    cleanup()

    const onClearFind = vi.fn()
    draw({ finding: true, find: 'zzz', onClearFind }, [])
    const findEmpty = document.querySelector('[data-lien-retainage-empty="find"]') as HTMLElement
    fireEvent.click(findEmpty.querySelector('button') as HTMLButtonElement)
    expect(onClearFind).toHaveBeenCalledTimes(1)
  })
})
