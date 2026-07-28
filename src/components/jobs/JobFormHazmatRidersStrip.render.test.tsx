// @vitest-environment jsdom
/**
 * Render-smoke tests for the ① Line Items rider rows (v2.1029 — formerly the
 * "Riders" strip in the invoices area): a RIDERS group label plus one labeled
 * table row per persisted hazmat incident with its fee, its linked invoice's
 * status, and the notice re-open/download actions; renders nothing when the
 * job has none. Rows are `<tr>`s, so tests mount them inside a table.
 */
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

import { JobFormHazmatRiderRows } from './JobFormHazmatRidersStrip'
import type { JobHazmatIncidentRow } from '../../lib/hazmatIncidents'
import type { JobWithDetails } from '../../types/jobWithDetails'
import { renderWithProviders } from '../../test/renderSmokeMocks'

function makeJob(overrides: Partial<JobWithDetails> = {}): JobWithDetails {
  return {
    id: 'job-1',
    hcp_number: '857',
    click_number: null,
    job_name: 'TJ Brace',
    job_address: '123 Main St',
    customer_name: 'Acme GC',
    invoices: [
      { id: 'inv-rider', status: 'ready_to_bill', amount: 500 },
      { id: 'inv-main', status: 'billed', amount: 12000 },
    ],
    ...overrides,
  } as unknown as JobWithDetails
}

function makeIncident(overrides: Partial<JobHazmatIncidentRow> = {}): JobHazmatIncidentRow {
  return {
    id: 'inc-1',
    job_id: 'job-1',
    created_by: null,
    incident_at: '2026-07-20T15:30:00.000Z',
    description: 'Waste discharged down an open pipe.',
    exposed_people: 'Abraham',
    stage_label: null,
    photo_links: ['https://drive.example.com/p1'],
    testimonials: [{ name: 'Abraham', statement: 'I was underneath.', given_at: '2026-07-20T16:00:00.000Z' }],
    tos_clause_snapshot: '11. Biohazard / Hazmat Exposure Fee — …',
    fee_amount: 500,
    invoice_id: 'inv-rider',
    public_token: '11111111-1111-4111-8111-111111111111',
    created_at: '2026-07-20T16:05:00.000Z',
    ...overrides,
  }
}

function renderRows(job: JobWithDetails, incidents: JobHazmatIncidentRow[]) {
  return renderWithProviders(
    <table>
      <tbody>
        <JobFormHazmatRiderRows job={job} incidents={incidents} />
      </tbody>
    </table>,
  )
}

describe('JobFormHazmatRiderRows', () => {
  it('renders the RIDERS group label and a rider row with fee, invoice status, and notice actions', () => {
    renderRows(makeJob(), [makeIncident()])

    expect(screen.getByText('RIDERS')).toBeTruthy()
    expect(screen.getByText(/Biohazard remediation fee — incident/)).toBeTruthy()
    expect(screen.getByText('$500.00')).toBeTruthy()
    expect(screen.getByText('Draft')).toBeTruthy()
    expect(screen.getByText('Open notice')).toBeTruthy()
    expect(screen.getByText('Download PDF')).toBeTruthy()
  })

  it('shows "In job total" for an unlinked (job-total) fee and "Invoice removed" for a dangling link', () => {
    renderRows(makeJob({ invoices: [] } as Partial<JobWithDetails>), [
      makeIncident({ id: 'inc-unlinked', invoice_id: null }),
      makeIncident({ id: 'inc-dangling', invoice_id: 'inv-gone' }),
    ])
    expect(screen.getByText('In job total')).toBeTruthy()
    expect(screen.getByText('Invoice removed')).toBeTruthy()
  })

  it('renders nothing when the job has no incidents', () => {
    const { container } = renderRows(makeJob(), [])
    expect(container.querySelectorAll('tr').length).toBe(0)
  })

  it('shows the notice-email pill: amber until first send, green with date after (v2.1039)', () => {
    renderRows(makeJob(), [
      makeIncident({ id: 'inc-unsent' }),
      makeIncident({
        id: 'inc-sent',
        notice_emailed_at: '2026-07-28T15:00:00.000Z',
        notice_emailed_to: 'brace.tj@example.com',
      } as Partial<JobHazmatIncidentRow>),
    ])
    expect(screen.getByText('Notice not emailed')).toBeTruthy()
    expect(screen.getByText(/Notice emailed Jul 28/)).toBeTruthy()
    expect(screen.getByText('Email notice…')).toBeTruthy()
    expect(screen.getByText('Re-email notice…')).toBeTruthy()
  })
})
