// @vitest-environment jsdom
/**
 * Render-smoke tests for the Edit Job "Riders" strip: one labeled line per
 * persisted hazmat incident with its fee, its rider invoice's status, and the
 * notice re-open/download actions; renders nothing when the job has none.
 */
import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'

import { JobFormHazmatRidersStrip } from './JobFormHazmatRidersStrip'
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

describe('JobFormHazmatRidersStrip', () => {
  it('renders a labeled rider line with fee, invoice status, and notice actions', () => {
    renderWithProviders(<JobFormHazmatRidersStrip job={makeJob()} incidents={[makeIncident()]} />)

    expect(screen.getByText('Riders')).toBeTruthy()
    expect(screen.getByText(/Biohazard remediation fee — incident/)).toBeTruthy()
    expect(screen.getByText('$500.00')).toBeTruthy()
    expect(screen.getByText('Draft')).toBeTruthy()
    expect(screen.getByText('Open notice')).toBeTruthy()
    expect(screen.getByText('Download PDF')).toBeTruthy()
  })

  it('shows "Invoice removed" when the rider invoice no longer exists', () => {
    renderWithProviders(
      <JobFormHazmatRidersStrip job={makeJob({ invoices: [] } as Partial<JobWithDetails>)} incidents={[makeIncident({ invoice_id: null })]} />,
    )
    expect(screen.getByText('Invoice removed')).toBeTruthy()
  })

  it('renders nothing when the job has no incidents', () => {
    const { container } = renderWithProviders(<JobFormHazmatRidersStrip job={makeJob()} incidents={[]} />)
    expect(container.innerHTML).toBe('')
  })
})
