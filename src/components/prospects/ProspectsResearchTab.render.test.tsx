// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { installDomShims, renderWithProviders } from '../../test/renderSmokeMocks'
import type { ResearchPermitRow } from '../../lib/research/permitResearch'

const io = vi.hoisted(() => ({
  loadResearchPermits: vi.fn(),
  loadLatestPull: vi.fn(),
  recordVerdict: vi.fn(),
  approachFromPermit: vi.fn(),
  pullPermitsNow: vi.fn(),
}))
vi.mock('../../lib/research/permitResearchIo', () => io)

import { ProspectsResearchTab } from './ProspectsResearchTab'

function row(over: Partial<ResearchPermitRow> = {}): ResearchPermitRow {
  return {
    id: 'p1',
    city: 'San Antonio',
    source: 'sa-issued',
    permit_number: 'COM-BLG-PMT26-00000001',
    permit_type: 'Comm New Building Permit',
    stage: 'issued',
    residential: false,
    work_type: 'New commercial',
    project_name: null,
    address: '100 SAMPLE ST',
    zip: '78245',
    lat: 29.4,
    lng: -98.5,
    submitted_on: '2026-10-02',
    issued_on: '2026-11-06',
    filed_on: '2026-11-06',
    declared_value: 1_400_000,
    area_sf: 6200,
    contact: 'Ridgeway Builders',
    plumber: null,
    plumber_permit_on: null,
    verdict: null,
    verdict_reason: null,
    verdict_look_again_on: null,
    verdict_prospect_id: null,
    verdict_by: null,
    verdict_by_name: null,
    verdict_at: null,
    ...over,
  }
}

describe('ProspectsResearchTab (v2.6782, punch list #292)', () => {
  beforeEach(() => {
    installDomShims()
    io.loadResearchPermits.mockReset().mockResolvedValue([row(), row({ id: 'p2', address: '300 HOPKINS ST', plumber: 'Lone Star Plumbing Co.', plumber_permit_on: '2026-11-04' })])
    io.loadLatestPull.mockReset().mockResolvedValue({ ranAt: new Date().toISOString(), error: null })
    io.recordVerdict.mockReset().mockResolvedValue(undefined)
    io.approachFromPermit.mockReset().mockResolvedValue({ prospectId: 'lead-1', companyName: 'Ridgeway Builders', reused: false })
    io.pullPermitsNow.mockReset().mockResolvedValue({ ok: true, feeds: [{ source: 'sa-issued', seen: 3, kept: 2, error: null }] })
  })
  afterEach(cleanup)

  it('draws the waiting rows with the plumber signal, and counts the taken row on its lens', async () => {
    renderWithProviders(<ProspectsResearchTab authUserId="u1" />)
    await waitFor(() => expect(screen.getByText('100 SAMPLE ST')).toBeTruthy())
    expect(screen.getByText('none yet')).toBeTruthy()
    expect(screen.queryByText('300 HOPKINS ST')).toBeNull()
    expect(screen.getByText(/1 wait on a look/)).toBeTruthy()
    expect(screen.getByText(/1 already have a plumber/)).toBeTruthy()
    expect(io.loadResearchPermits).toHaveBeenCalledWith('San Antonio', expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), false)
  })

  it('opens the sheet on Decide…, refuses an empty reason, then keeps an Approach with the lead it made', async () => {
    renderWithProviders(<ProspectsResearchTab authUserId="u1" />)
    await waitFor(() => expect(screen.getByText('100 SAMPLE ST')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Decide…' }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Approach them · make the lead' }))
    expect(io.recordVerdict).not.toHaveBeenCalled()
    expect(screen.getByText('Say why in a line. The next estimator reads it.')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Why'), { target: { value: 'Our size, and we have won with them.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Approach them · make the lead' }))
    await waitFor(() => expect(io.recordVerdict).toHaveBeenCalled())
    expect(io.approachFromPermit).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' }), 'gc', 'u1')
    expect(io.recordVerdict).toHaveBeenCalledWith(expect.objectContaining({ permitId: 'p1', verdict: 'approach', prospectId: 'lead-1', userId: 'u1' }))
  })

  it('shows the Already have a plumber lens with the feed-read row and its Decide anyway', async () => {
    renderWithProviders(<ProspectsResearchTab authUserId="u1" />)
    await waitFor(() => expect(screen.getByText('100 SAMPLE ST')).toBeTruthy())
    fireEvent.change(screen.getByLabelText('Showing'), { target: { value: 'taken' } })
    expect(screen.getByText('300 HOPKINS ST')).toBeTruthy()
    expect(screen.getByText('Lone Star Plumbing Co.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Decide anyway' })).toBeTruthy()
  })

  it('Pull now runs the feed and reads again', async () => {
    renderWithProviders(<ProspectsResearchTab authUserId="u1" />)
    await waitFor(() => expect(screen.getByText('100 SAMPLE ST')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Pull now' }))
    await waitFor(() => expect(io.pullPermitsNow).toHaveBeenCalled())
    await waitFor(() => expect(io.loadResearchPermits).toHaveBeenCalledTimes(2))
  })

  it('says what fills an empty ledger before the first pull', async () => {
    io.loadResearchPermits.mockResolvedValue([])
    io.loadLatestPull.mockResolvedValue({ ranAt: null, error: null })
    renderWithProviders(<ProspectsResearchTab authUserId="u1" />)
    await waitFor(() => expect(screen.getByText('No permits yet.')).toBeTruthy())
    expect(screen.getByText(/Not pulled yet/)).toBeTruthy()
  })
})
