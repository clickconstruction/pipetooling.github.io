// @vitest-environment jsdom
/**
 * By paper → Monthly notices, the list alone (v2.7608): what an empty list says, the calendar's filter, the run's
 * press on the Approved pile, and a row's press on a wide desk and on a stacked one. Inside the desk the list is
 * held by `LienDesk.render.test.tsx`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import type { ComponentProps } from 'react'
import type { LienDeskEntry } from '../../lib/jobs/lienDesk'
import { LienDeskNoticeList } from './LienDeskNoticeList'

vi.mock('../../lib/supabase', () => ({ supabase: {} }))

const entry = (jobId: string, pile: string, over: Record<string, unknown> = {}): LienDeskEntry =>
  ({ jobId, pile, gcCustomerId: 'gc-1', severity: 'amber', daysLeft: 5, earliestDeadline: '2026-11-22', openBalance: 1_000, dueMonths: ['2026-10'], missedMonths: [], missedUnrecorded: [], months: [], item: null, sentItem: null, policy: 'ask', ...over }) as unknown as LienDeskEntry

const ready = entry('job-a', 'ready')
const data = { jobsById: { 'job-a': { hcp_number: '9001', click_number: null, job_name: 'ZZ Test Job A' } }, gcsById: { 'gc-1': { name: 'ZZ Test Builder' } }, filingsByJob: {}, mailPiecesByFiling: {}, letterTwoByJob: {}, ownerByJob: {}, addressesById: {} }

function draw(over: Partial<ComponentProps<typeof LienDeskNoticeList>> = {}) {
  const rows = (over.visible ?? [ready]) as LienDeskEntry[]
  const props: ComponentProps<typeof LienDeskNoticeList> = {
    data: data as never,
    loading: false,
    isMobile: false,
    stacked: false,
    office: true,
    entries: rows,
    visible: rows,
    visibleAll: rows,
    pilesShown: rows.length ? [{ p: 'ready', rows, total: rows.length }] : [],
    noticeHeads: { listRef: { current: null }, lit: rows.length ? 'ready' : null, onScroll: () => {}, scrollToPile: () => {} },
    counts: { ready: rows.length } as never,
    runCount: 2,
    pile: null,
    setPile: vi.fn(),
    finding: false,
    find: '',
    findWords: [],
    findHits: new Map(),
    alsoSent: [],
    calendarJobFilter: null,
    setCalendarJobFilter: vi.fn(),
    deliveriesOnly: false,
    setDeliveriesOnly: vi.fn(),
    mailedJobIds: new Set(),
    selectedJobId: null,
    setSelectedJobId: vi.fn(),
    setMobileListShown: vi.fn(),
    setRunOpen: vi.fn(),
    setCallerJobId: vi.fn(),
    supplierMarks: new Map(),
    listLabel: (jobId) => <strong>{jobId}</strong>,
    ...over,
  }
  render(<LienDeskNoticeList {...props} />)
  return props
}
const list = () => document.querySelector('[data-lien-desk-list]') as HTMLElement

afterEach(() => cleanup())

describe('LienDeskNoticeList', () => {
  it('says it is still looking while the desk loads, and that nothing is due once it has', () => {
    draw({ loading: true, data: null, visible: [] })
    expect(list().textContent).toContain('Looking at every unpaid sub job…')
    cleanup()
    draw({ visible: [] })
    expect(list().textContent).toContain('Nothing is due')
  })

  it('an empty pressed pile offers every pile again', () => {
    const p = draw({ visible: [], pile: 'held', entries: [ready] })
    const press = [...list().querySelectorAll('button')].find((b) => /every pile/i.test(b.textContent ?? '')) as HTMLButtonElement
    fireEvent.click(press)
    expect(p.setPile).toHaveBeenCalledWith(null)
  })

  it('the calendar’s filter says its day and count, and its press lifts it', () => {
    const p = draw({ calendarJobFilter: { ymd: '2026-11-22', jobIds: new Set(['job-a', 'job-b']) } })
    expect(list().textContent).toContain('2 jobs from the calendar')
    fireEvent.click([...list().querySelectorAll('button')].find((b) => b.textContent === 'show every job') as HTMLButtonElement)
    expect(p.setCalendarJobFilter).toHaveBeenCalledWith(null)
  })

  it('a filter with words of its own says them: the Board’s Sign door narrows the list to the notices that take the leader’s signature (v2.7853)', () => {
    const p = draw({ calendarJobFilter: { ymd: '2026-11-22', jobIds: new Set(['job-a', 'job-b']), words: 'Only the notices that take your signature' } })
    const chip = document.querySelector('[data-testid="lien-desk-calendar-filter"]') as HTMLElement
    expect(chip.textContent).toContain('Only the notices that take your signature')
    expect(chip.textContent).not.toContain('from the calendar')
    fireEvent.click([...chip.querySelectorAll('button')].find((b) => b.textContent === 'show every job') as HTMLButtonElement)
    expect(p.setCalendarJobFilter).toHaveBeenCalledWith(null)
  })

  it('the Approved pile’s title carries the run’s press for the office', () => {
    const p = draw()
    fireEvent.click(document.querySelector('[data-lien-pile-run]') as HTMLButtonElement)
    expect(p.setRunOpen).toHaveBeenCalledWith(true)
    cleanup()
    draw({ office: false })
    expect(document.querySelector('[data-lien-pile-run]')).toBeNull()
  })

  it('a row’s press opens its pane on a wide desk, and hands the job to the host on a stacked one', () => {
    const wide = draw()
    fireEvent.click(document.querySelector('[data-lien-pile-rows="ready"] button') as HTMLButtonElement)
    expect(wide.setSelectedJobId).toHaveBeenCalledWith('job-a')
    expect(wide.setMobileListShown).toHaveBeenCalledWith(false)
    cleanup()
    const onOpenNotice = vi.fn()
    const stacked = draw({ stacked: true, onOpenNotice, pile: 'ready' })
    fireEvent.click(document.querySelector('[data-lien-pile-rows="ready"] button') as HTMLButtonElement)
    expect(onOpenNotice).toHaveBeenCalledWith('job-a', 'ready')
    expect(stacked.setSelectedJobId).not.toHaveBeenCalled()
  })

  it('the open row is marked', () => {
    draw({ selectedJobId: 'job-a' })
    expect(document.querySelector('[data-lien-pile-rows="ready"] button')?.getAttribute('aria-current')).toBe('true')
  })
})
