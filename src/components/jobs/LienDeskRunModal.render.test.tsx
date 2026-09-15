// @vitest-environment jsdom
/**
 * Render smokes for the run (v2.3410): one row per recipient with method +
 * tracking, the envelope count, a missing address blocks Record, an email
 * method needs an address on file, and the desk's Send the run door.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import LienDeskRunModal from './LienDeskRunModal'
import type { RunNotice } from '../../lib/jobs/lienDeskRun'

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

function notice(partial: Partial<RunNotice> = {}): RunNotice {
  return {
    itemId: 'it1',
    jobId: 'j650',
    label: '650 · ATI Schertz',
    jobNumber: '650',
    months: ['2026-06', '2026-07'],
    amount: 33_500,
    fields: { noticeDate: '2026-09-14', projectDescription: 'ATI Schertz — 1204 Elbel Rd', claimantName: 'Click Plumbing and Electrical', laborMaterialsType: 'Plumbing labor and materials', originalContractorName: 'Loberg Contracting', contractedWithIfDifferent: '', claimAmount: '33500.00', contactPerson: 'Robert', claimantAddress: '5501 Balcones Dr' },
    extras: { refItems: ['Job #650'] },
    coverNote: 'This is a routine notice…',
    ownerUnconfirmed: false,
    recipients: [
      { key: 'owner', label: 'Owner of record', name: 'Elbel Holdings LLC', address: '4 Example Way, Schertz, TX', email: '', method: 'certified_mail', tracking: '' },
      { key: 'original_contractor', label: 'Original contractor', name: 'Loberg Contracting', address: '2904 Corporate Cr', email: 'office@loberg.test', method: 'certified_mail', tracking: '' },
    ],
    ...partial,
  }
}

describe('LienDeskRunModal', () => {
  it('lists a row per recipient with the method and tracking, counts the envelopes, and can record', () => {
    renderWithProviders(<LienDeskRunModal notices={[notice()]} issuer={null} todayYmd="2026-09-14" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
    expect(screen.getByRole('dialog', { name: 'Send the run' })).toBeTruthy()
    expect(screen.getByText('Send the run · 1 notice')).toBeTruthy()
    expect(screen.getByTestId('run-row-j650-owner').textContent).toContain('Elbel Holdings LLC')
    expect(screen.getByTestId('run-row-j650-original_contractor').textContent).toContain('office@loberg.test')
    expect(screen.getByText('June and July 2026')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Print the packet · 2 envelopes/ })).toBeTruthy()
    expect((screen.getByRole('button', { name: /Record the run/ }) as HTMLButtonElement).disabled).toBe(false)
    fireEvent.change(screen.getByLabelText('650 · ATI Schertz — Owner of record tracking'), { target: { value: '9407 1118 9922' } })
    expect((screen.getByLabelText('650 · ATI Schertz — Owner of record tracking') as HTMLInputElement).value).toBe('9407 1118 9922')
    // Email is offered only where an address is on file.
    const gcMethod = screen.getByLabelText('650 · ATI Schertz — Original contractor method') as HTMLSelectElement
    fireEvent.change(gcMethod, { target: { value: 'email' } })
    expect(screen.getByText(/the email id is the tracking/)).toBeTruthy()
  })

  it('a recipient with no mailing address blocks the run and says so', () => {
    const n = notice()
    n.recipients[0] = { ...n.recipients[0]!, name: '', address: '' }
    renderWithProviders(<LienDeskRunModal notices={[n]} issuer={null} todayYmd="2026-09-14" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
    expect(screen.getByText(/Owner of record: nobody to send to/)).toBeTruthy()
    expect((screen.getByRole('button', { name: /Record the run/ }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText(/Fix the recipients marked in red/)).toBeTruthy()
  })
})
