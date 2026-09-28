// @vitest-environment jsdom
/**
 * Render smoke for the certify checklist: every bill is ticked before the
 * sign-off unlocks, the job link opens the job with the ticks kept, and the
 * certification records what was checked.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import GcReviewCertifyModal from './GcReviewCertifyModal'
import type { GcReviewGroup, GcReviewRow } from '../../lib/gcReviewRollup'

const io = vi.hoisted(() => ({ insert: vi.fn(), activity: vi.fn() }))
vi.mock('../../lib/gcReviewCertifications', () => ({ insertGcReviewCertification: io.insert }))
vi.mock('../../lib/fetchJobActivityEventsForJobLedger', () => ({ fetchJobActivityEventsForJobLedger: io.activity }))

const row = (key: string, remaining: number): GcReviewRow => ({ key, jobId: `job-${key}`, hcp: key, jobName: 'Dudley Mason', jobAddress: '', customerName: 'Cust', referenceDateDisplay: 'Sep 21, 2026', ageDays: 7, remaining, inCollections: false })
const group: GcReviewGroup = { key: 'gc-rmc', gcId: 'gc-rmc', gcName: 'RMC- Dudley Mason', isNoGc: false, rows: [row('651', 8780), row('186', 6200)], subtotal: 14980, jobCount: 2, oldestAgeDays: 7 }

function open() {
  const handlers = { onClose: vi.fn(), onCertified: vi.fn(), onOpenJobDetail: vi.fn() }
  render(<GcReviewCertifyModal group={group} weekStartYmd="2026-09-28" authUserId="u-taunya" authUserName="Taunya" {...handlers} />)
  return handlers
}

beforeEach(() => {
  io.insert.mockReset()
  io.insert.mockResolvedValue(undefined)
  io.activity.mockReset()
  io.activity.mockResolvedValue({ data: [], error: null })
})

describe('GcReviewCertifyModal', () => {
  it('lists the group’s bills and keeps the sign-off locked until each is ticked', () => {
    open()
    expect(screen.getByRole('dialog', { name: 'Certify RMC- Dudley Mason' })).toBeTruthy()
    expect(screen.getAllByTestId('gc-bill-line')).toHaveLength(2)
    expect(screen.getByText(/0 of 2/)).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Check only' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Reviewed 651 Dudley Mason' }))
    expect((screen.getByRole('button', { name: 'Check only' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Reviewed 186 Dudley Mason' }))
    expect(screen.getByText(/2 of 2/)).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Check only' }) as HTMLButtonElement).disabled).toBe(false)
    expect((screen.getByRole('button', { name: 'Check & send…' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('opening a job keeps the ticks', () => {
    const h = open()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Reviewed 651 Dudley Mason' }))
    fireEvent.click(screen.getByRole('button', { name: '186 · Dudley Mason' }))
    expect(h.onOpenJobDetail).toHaveBeenCalledWith('job-186')
    expect((screen.getByRole('checkbox', { name: 'Reviewed 651 Dudley Mason' }) as HTMLInputElement).checked).toBe(true)
  })

  it('records who checked what, then hands on', async () => {
    const h = open()
    screen.getAllByRole('checkbox').forEach((box) => fireEvent.click(box))
    fireEvent.click(screen.getByRole('button', { name: 'Check & send…' }))
    await waitFor(() => expect(h.onCertified).toHaveBeenCalledWith({ andSend: true }))
    expect(io.insert).toHaveBeenCalledWith(expect.objectContaining({ week_start: '2026-09-28', gc_customer_id: 'gc-rmc', certified_by: 'u-taunya', certified_by_name: 'Taunya', job_count: 2, total: 14980 }))
  })
})
