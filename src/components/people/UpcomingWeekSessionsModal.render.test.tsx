// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'

// Two sessions in one person's pay week: an ordinary Office shift, and a quick add (also on the
// Office job — every quick add is, which is why its sentence, not its job, must be what shows).
const rows = [
  { id: 'shift', work_date: '2026-09-21', clocked_in_at: '2026-09-21T13:00:00Z', clocked_out_at: '2026-09-21T21:30:00Z', approved_at: null, notes: 'Office day', quick_add_minutes: null, jobs_ledger: { hcp_number: '000', click_number: null, job_name: 'Office', job_address: null, service_type_id: null }, bids: null },
  { id: 'quick', work_date: '2026-09-22', clocked_in_at: '2026-09-22T00:40:00Z', clocked_out_at: '2026-09-22T00:50:00Z', approved_at: null, notes: 'Call — Acme, the Oak St invoice', quick_add_minutes: 10, jobs_ledger: { hcp_number: '000', click_number: null, job_name: 'Office', job_address: null, service_type_id: null }, bids: null },
]

vi.mock('../../lib/supabase', () => {
  const builder: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'gte', 'lte', 'is']) builder[m] = () => builder
  builder.order = async () => ({ data: rows, error: null })
  return { supabase: { from: () => builder, rpc: async () => ({ data: null, error: null }) } }
})

import { UpcomingWeekSessionsModal } from './UpcomingWeekSessionsModal'

describe('UpcomingWeekSessionsModal — quick adds are never hidden inside a punch', () => {
  it('marks the quick add, shows its sentence instead of "Office", and totals the week’s quick adds', async () => {
    renderWithProviders(
      <UpcomingWeekSessionsModal personName="Grace" userId="u1" weekStartYmd="2026-09-21" weekEndYmd="2026-09-27" weekLabel="9/21–9/27" authUserId="boss" zIndex={10} onClose={() => {}} onOpenDay={() => {}} onSessionsMutated={() => {}} />,
    )
    const sentence = await waitFor(() => screen.getByText('Call — Acme, the Oak St invoice'))
    const row = sentence.closest('li') as HTMLElement
    expect(within(row).getByText('quick add')).toBeTruthy()

    // the ordinary shift is untouched: its job label, and no chip
    const shiftRow = screen.getAllByRole('listitem').find((li) => li !== row) as HTMLElement
    expect(within(shiftRow).queryByText('quick add')).toBeNull()

    expect(screen.getByText(/10 m across 1 entry this week/)).toBeTruthy()
  })
})
