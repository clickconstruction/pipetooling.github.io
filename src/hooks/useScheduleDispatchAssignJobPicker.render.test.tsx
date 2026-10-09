// @vitest-environment jsdom
/**
 * The Dispatch hub's assign-job picker list (the SCHEDULE_DISPATCH map's step 6), on the hook: the
 * search and number query narrow the job and bid rows, the reset empties both as the picker opens,
 * the money-rail evidence is fetched only while the picker is open over a short list (debounced,
 * accumulating, failure-silent), the same-address notice shows only while a search narrows the
 * list, and the subtitle names the cells or the person and day the picker was opened for.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, renderHook } from '@testing-library/react'
import type { ScheduleDispatchHubBidRow, ScheduleDispatchHubMergedRow } from '../lib/scheduleDispatchHub'
import type { JobScheduleBlockRow } from '../lib/jobScheduleBlocks'

const h = vi.hoisted(() => ({
  fetchEvidence: vi.fn<(ids: string[], mode: unknown) => Promise<Map<string, unknown>>>(),
}))
vi.mock('../lib/jobSearchEvidence', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/jobSearchEvidence')>()),
  fetchJobSearchEvidence: h.fetchEvidence,
}))

import { useScheduleDispatchAssignJobPicker, type UseScheduleDispatchAssignJobPickerInput } from './useScheduleDispatchAssignJobPicker'

const job = (id: string, hcp: string, name: string, address: string, createdAt: string) =>
  ({
    id,
    hcp_number: hcp,
    job_name: name,
    displayTitle: `J${hcp} · ${name}`,
    job_address: address,
    customer_name: null,
    created_at: createdAt,
    status: 'working',
    service_type: null,
    totalBlocks: 0,
    byDay: {},
  }) as unknown as ScheduleDispatchHubMergedRow
const ROWS = [
  job('job-1', '1004', 'Ridgeway Builders', '12 Elm St', '2026-09-01T00:00:00Z'),
  job('job-2', '1010', 'Maple Court', '40 Oak Ave', '2026-09-03T00:00:00Z'),
  job('job-3', '2001', 'Alder Lane', '12 Elm St', '2026-09-02T00:00:00Z'),
]
const BIDS = [
  { id: 'bid-1', bid_number: 'B408', project_name: 'Ridgeway Clinic', address: '9 Pine Rd', outcome: null, created_at: '2026-09-04T00:00:00Z', service_type: null },
  { id: 'bid-2', bid_number: 'B512', project_name: 'Harbor Office', address: '77 Bay St', outcome: null, created_at: '2026-09-05T00:00:00Z', service_type: null },
] as ScheduleDispatchHubBidRow[]
const WEEK_BLOCKS = [{ bid_id: 'bid-1' }] as unknown as JobScheduleBlockRow[]

let input: UseScheduleDispatchAssignJobPickerInput

beforeEach(() => {
  vi.useFakeTimers()
  h.fetchEvidence.mockReset()
  h.fetchEvidence.mockImplementation(async (ids) => new Map(ids.map((id) => [id, { id, paid: true }])))
  input = {
    hubAssignJobPickerOpen: true,
    hubAssignJobPickerIntent: 'toolbar',
    hubCellAddContext: null,
    hubMultiCellAddSelection: new Set(),
    hubMergedRows: ROWS,
    hubBids: BIDS,
    hubWeekBlocks: WEEK_BLOCKS,
    hubPeopleNameById: new Map([['u-dana', 'Dana Ruiz']]),
    role: 'dev',
  }
})

afterEach(() => {
  vi.useRealTimers()
})

function mount(over: Partial<UseScheduleDispatchAssignJobPickerInput> = {}) {
  return renderHook((props: UseScheduleDispatchAssignJobPickerInput) => useScheduleDispatchAssignJobPicker(props), {
    initialProps: { ...input, ...over },
  })
}
const ids = (rows: readonly { id: string }[]) => rows.map((r) => r.id)
async function tick(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

describe('the rows', () => {
  it('lists every job, newest first, and every bid, until a search narrows both', () => {
    const { result } = mount()
    expect(ids(result.current.hubAssignJobPickerRows)).toEqual(['job-2', 'job-3', 'job-1'])
    expect(ids(result.current.hubAssignBidPickerRows).sort()).toEqual(['bid:bid-1', 'bid:bid-2'])

    act(() => result.current.setHubAssignJobPickerSearch('ridgeway'))
    expect(ids(result.current.hubAssignJobPickerRows)).toEqual(['job-1'])
    expect(ids(result.current.hubAssignBidPickerRows)).toEqual(['bid:bid-1'])
  })

  it('the number query matches the job number’s start and the bid number’s digits', () => {
    const { result } = mount()
    act(() => result.current.setHubAssignJobPickerNumberQuery('10'))
    expect(ids(result.current.hubAssignJobPickerRows).sort()).toEqual(['job-1', 'job-2'])
    act(() => result.current.setHubAssignJobPickerNumberQuery('408'))
    expect(ids(result.current.hubAssignJobPickerRows)).toEqual([])
    expect(ids(result.current.hubAssignBidPickerRows)).toEqual(['bid:bid-1'])
  })

  it('the reset empties the search and the number query as the picker opens', () => {
    const { result } = mount()
    act(() => {
      result.current.setHubAssignJobPickerSearch('elm')
      result.current.setHubAssignJobPickerNumberQuery('20')
    })
    act(() => result.current.onPickerOpened())
    expect(result.current.hubAssignJobPickerSearch).toBe('')
    expect(result.current.hubAssignJobPickerNumberQuery).toBe('')
    expect(result.current.hubAssignJobPickerRows).toHaveLength(3)
  })
})

describe('the money-rail evidence', () => {
  it('is fetched 250 ms after a short list shows, and kept for the rows it covers', async () => {
    const { result } = mount()
    await tick(249)
    expect(h.fetchEvidence).not.toHaveBeenCalled()
    await tick(1)
    expect(h.fetchEvidence).toHaveBeenCalledTimes(1)
    expect([...h.fetchEvidence.mock.calls[0]![0]].sort()).toEqual(['job-1', 'job-2', 'job-3'])
    expect([...result.current.hubJobEvidence.keys()].sort()).toEqual(['job-1', 'job-2', 'job-3'])
  })

  it('asks only for rows it has not seen', async () => {
    const { result, rerender } = mount({ hubMergedRows: ROWS.slice(0, 2) })
    await tick(250)
    rerender({ ...input, hubMergedRows: ROWS })
    await tick(250)
    expect(h.fetchEvidence.mock.calls.map((c) => [...c[0]].sort())).toEqual([['job-1', 'job-2'], ['job-3']])
    expect(result.current.hubJobEvidence.size).toBe(3)
  })

  it('is not fetched with the picker shut, or for a list longer than 30', async () => {
    mount({ hubAssignJobPickerOpen: false })
    const many = Array.from({ length: 31 }, (_, i) => job(`job-x${i}`, `${5000 + i}`, `Job ${i}`, `${i} Main St`, '2026-09-01T00:00:00Z'))
    mount({ hubMergedRows: many })
    await tick(1000)
    expect(h.fetchEvidence).not.toHaveBeenCalled()
  })

  it('a failed read leaves the rows without the rail', async () => {
    h.fetchEvidence.mockRejectedValue(new Error('rls'))
    const { result } = mount()
    await tick(250)
    expect(h.fetchEvidence).toHaveBeenCalledTimes(1)
    expect(result.current.hubJobEvidence.size).toBe(0)
  })
})

describe('the notice and the subtitle', () => {
  it('names two jobs at one address only while a search narrows the list', () => {
    const { result } = mount()
    expect(result.current.hubAssignJobPickerDuplicateAddressNotice).toBeNull()
    act(() => result.current.setHubAssignJobPickerSearch('elm'))
    expect(result.current.hubAssignJobPickerDuplicateAddressNotice).toBe('2 jobs at 12 Elm St — check the status before picking')
  })

  it('names the selected cells for a multi-cell add, one or several', () => {
    const one = mount({ hubAssignJobPickerIntent: 'multi', hubMultiCellAddSelection: new Set(['u-dana|2026-10-07']) })
    expect(render(<>{one.result.current.hubAssignJobPickerSubtitle}</>).container.textContent).toBe(
      "Adding the same job to 1 selected person/day cell (this week's hub list).",
    )
    const two = mount({ hubAssignJobPickerIntent: 'multi', hubMultiCellAddSelection: new Set(['u-dana|2026-10-07', 'u-dana|2026-10-08']) })
    expect(render(<>{two.result.current.hubAssignJobPickerSubtitle}</>).container.textContent).toBe(
      "Adding the same job to 2 selected person/day cells (this week's hub list).",
    )
  })

  it('names the person and day for a cell, and nothing for the toolbar or a shut picker', () => {
    const cell = mount({ hubAssignJobPickerIntent: 'cell', hubCellAddContext: { assigneeUserId: 'u-dana', workDate: '2026-10-07' } })
    expect(render(<>{cell.result.current.hubAssignJobPickerSubtitle}</>).container.textContent).toBe(
      "Pick a job to add a block for Dana Ruiz · Wednesday, October 7, 2026 (2026-10-07) (this week's hub list).",
    )
    expect(mount().result.current.hubAssignJobPickerSubtitle).toBeNull()
    expect(mount({ hubAssignJobPickerOpen: false, hubAssignJobPickerIntent: 'multi' }).result.current.hubAssignJobPickerSubtitle).toBeNull()
  })
})
