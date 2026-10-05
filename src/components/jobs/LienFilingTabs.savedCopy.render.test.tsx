// @vitest-environment jsdom
/**
 * The Saved copy link and note typed while recording (v2.4563): the record that is written
 * carries them. Before, the two record callbacks kept the values they were made with, so a
 * link typed on the record step was dropped from the insert.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { makeJob, renderWithProviders } from '../../test/renderSmokeMocks'
import LienFilingTabs from './LienFilingTabs'

const inserts: Array<Record<string, unknown>> = []

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'assistant' })
})
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      insert: (row: Record<string, unknown>) => {
        inserts.push(row)
        return { select: () => ({ single: async () => ({ data: { id: 'f1' }, error: null }) }) }
      },
    }),
  },
}))

afterEach(() => {
  cleanup()
  inserts.length = 0
})

const job = makeJob({ id: 'job-650', hcp_number: '650', job_name: 'ATI Schertz', job_address: '100 Main St, Schertz, TX 78154', status: 'billed', revenue: 15722.49 })
// Every gate of the affidavit clears: an owner with a mailing address, the county, the legal description, not a homestead.
const address = { id: 'addr-1', county: 'Guadalupe', legal_description: 'LOT 1 BLK 2 ATI SUBD', owner_name: 'ATI Holdings LLC', owner_company: '', owner_mailing_address: '1 Owner Way, Schertz, TX 78154', is_homestead: false, property_kind: 'commercial' }
const sentNotice = { id: 'n1', kind: 'notice_53_056', months_covered: ['2026-07'], sends: [], voided_at: null, created_at: '2026-08-01T00:00:00Z', amount: 1 }

type Props = Parameters<typeof LienFilingTabs>[0]
function props(over: Partial<Props>): Props {
  return {
    job,
    jobNumber: '650',
    activeTab: 'notice',
    issuer: null,
    signerNameFallback: 'Malachi Whites, Master Plumber',
    linkedAddress: address as never,
    jobOwnerRow: null,
    filings: [],
    clock: { workMonth: '2026-07', noticeDeadline: '2026-10-15', filingDeadline: '2026-11-16' },
    isSub: true,
    originalContractorName: 'RMC- Dudley Mason',
    ownerEmail: '',
    originalContractorEmail: '',
    onChanged: () => {},
    ...over,
  }
}

function typeSavedCopy() {
  fireEvent.change(screen.getByLabelText('Saved copy — link'), { target: { value: 'https://drive.google.com/file/d/abc/view' } })
  fireEvent.change(screen.getByLabelText('Saved copy — note'), { target: { value: 'the packet as printed' } })
}

describe('LienFilingTabs · the saved copy typed while recording', () => {
  it('a notice recorded with a link and a note typed on the record step saves both', async () => {
    renderWithProviders(<LienFilingTabs {...props({})} />)
    fireEvent.click(screen.getByRole('button', { name: 'Save & record sends…' }))
    typeSavedCopy()
    fireEvent.click(screen.getByRole('button', { name: 'Record both sends' }))
    await waitFor(() => expect(inserts.length).toBe(1))
    expect(inserts[0]!.kind).toBe('notice_53_056')
    expect(inserts[0]!.document_url).toBe('https://drive.google.com/file/d/abc/view')
    expect(inserts[0]!.document_note).toBe('the packet as printed')
  })

  it('a filing recorded with a link and a note typed on the record step saves both', async () => {
    renderWithProviders(<LienFilingTabs {...props({ activeTab: 'affidavit', isSub: false, filings: [sentNotice] as never })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Record filing…' }))
    typeSavedCopy()
    fireEvent.click(screen.getByRole('button', { name: 'Record filing' }))
    await waitFor(() => expect(inserts.length).toBe(1))
    expect(inserts[0]!.kind).toBe('affidavit')
    expect(inserts[0]!.document_url).toBe('https://drive.google.com/file/d/abc/view')
    expect(inserts[0]!.document_note).toBe('the packet as printed')
  })
})
