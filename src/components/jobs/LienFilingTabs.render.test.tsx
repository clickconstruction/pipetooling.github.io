// @vitest-environment jsdom
/**
 * The record steps of the § 53.056 notice and the lien on a phone (v2.4422): each opens as a
 * sheet over the Lien window's card, with the same fields the box in the tab has on a
 * computer. Wiring only: the writes are the tab's own and are not pressed here.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { makeJob, renderWithProviders } from '../../test/renderSmokeMocks'
import LienFilingTabs from './LienFilingTabs'

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'assistant' })
})
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

vi.mock('../../lib/jobs/lienNoticeByHandIo', () => ({
  loadJobsAtProperty: async () => [],
  recordLienNoticeByHand: async () => ({ packetId: 'p1', filingIds: ['f1'] }),
}))

afterEach(() => cleanup())

const job = makeJob({ id: 'job-650', hcp_number: '650', job_name: 'ATI Schertz — As per plans', job_address: '100 Main St, Schertz, TX 78154', status: 'billed', revenue: 15722.49, payments_made: 0 })
// Every gate of the affidavit clears: an owner with a mailing address, the county, the legal description, not a homestead.
const address = { id: 'addr-1', county: 'Guadalupe', legal_description: 'LOT 1 BLK 2 ATI SUBD', owner_name: 'ATI Holdings LLC', owner_company: '', owner_mailing_address: '1 Owner Way, Schertz, TX 78154', owner_mode: 'company', homestead: false, property_kind: 'non_residential' }

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

/** Run `body` with the window reporting a phone (≤ 640 px), then put matchMedia back. */
function onPhone(body: () => void) {
  const before = window.matchMedia
  window.matchMedia = ((query: string) => ({ matches: query.includes('max-width: 640px'), media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false })) as typeof window.matchMedia
  try {
    body()
  } finally {
    window.matchMedia = before
  }
}

const sheet = () => document.querySelector('[data-lien-record-sheet]') as HTMLElement | null

describe('LienFilingTabs · record steps', () => {
  it('a computer records the notice’s sends in a box inside the tab, never a sheet', () => {
    renderWithProviders(<LienFilingTabs {...props({})} />)
    fireEvent.click(screen.getByRole('button', { name: 'Save & record sends…' }))
    expect(document.querySelector('[data-lien-record-box="notice_sends"]')).toBeTruthy()
    expect(sheet()).toBeNull()
  })

  it('a phone records the notice’s sends on a sheet: both recipients, the saved copy, Back to the tab, × closes the window', () => {
    onPhone(() => {
      const onClose = vi.fn()
      renderWithProviders(<LienFilingTabs {...props({ onClose })} />)
      fireEvent.click(screen.getByRole('button', { name: 'Save & record sends…' }))
      expect(sheet()!.getAttribute('data-lien-record-sheet')).toBe('notice_sends')
      expect(document.querySelector('[data-lien-record-box]')).toBeNull()
      expect(sheet()!.querySelector('[data-lien-record-summary]')!.textContent).toContain('§ 53.056 notice · $15,722.49')
      expect(sheet()!.querySelector('[data-lien-record-summary]')!.textContent).toContain('ATI Schertz — As per plans · 650')
      for (const who of ['Owner', 'Original contractor']) {
        expect((screen.getByLabelText(`${who} send method`) as HTMLSelectElement).value).toBe('certified_mail')
        expect((screen.getByLabelText(`${who} tracking number`) as HTMLInputElement).style.fontSize).toBe('1rem')
        expect((screen.getByLabelText(`${who} sent on`) as HTMLInputElement).type).toBe('date')
      }
      // a recipient set to email says where the PDF goes, or that no address is on file
      fireEvent.change(screen.getByLabelText('Owner send method'), { target: { value: 'email' } })
      expect(sheet()!.textContent).toContain('no email on file for this recipient')
      expect(screen.getByLabelText('Saved copy — link')).toBeTruthy()
      expect(screen.getByLabelText('Saved copy — note')).toBeTruthy()
      expect(sheet()!.querySelector('[data-lien-record-action]')!.textContent).toBe('Record both sends')
      fireEvent.click(screen.getByRole('button', { name: 'Close' }))
      expect(onClose).toHaveBeenCalledTimes(1)
      fireEvent.click(screen.getByRole('button', { name: 'Back' }))
      expect(sheet()).toBeNull()
      expect(screen.getByRole('button', { name: 'Save & record sends…' })).toBeTruthy()
    })
  })

  it('a phone records the lien’s filing on a sheet: county from the property, recording number, filed on, the saved copy', () => {
    onPhone(() => {
      renderWithProviders(<LienFilingTabs {...props({ activeTab: 'affidavit', isSub: false })} />)
      fireEvent.click(screen.getByRole('button', { name: 'Record filing…' }))
      expect(sheet()!.getAttribute('data-lien-record-sheet')).toBe('affidavit_filing')
      expect(sheet()!.querySelector('[data-lien-record-summary]')!.textContent).toMatch(/^Lien affidavit · \$[\d,.]+ unpaid/)
      expect((screen.getByLabelText('County') as HTMLInputElement).value).toBe('Guadalupe')
      expect(screen.getByLabelText('Recording #')).toBeTruthy()
      expect((screen.getByLabelText('Filed on') as HTMLInputElement).type).toBe('date')
      expect(screen.getByLabelText('Saved copy — link')).toBeTruthy()
      expect(sheet()!.textContent).toContain('§ 53.055')
      expect(sheet()!.querySelector('[data-lien-record-action]')!.textContent).toBe('Record filing')
      fireEvent.click(screen.getByRole('button', { name: 'Back' }))
      expect(sheet()).toBeNull()
    })
  })

  it('Already filed — record it… (v2.4835): with a gate still ✗ the door is drawn under the list, and opens the same record box with Filed on', () => {
    // No legal description and no owner mailing address: the paper cannot be drawn, but a lien filed by counsel is on record all the same.
    const bare = { ...address, legal_description: '', owner_mailing_address: '' }
    renderWithProviders(<LienFilingTabs {...props({ activeTab: 'affidavit', isSub: false, linkedAddress: bare as never })} />)
    expect(screen.getByText(/Clear the ✗ items above/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Record filing…' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Already filed — record it…' }))
    const box = document.querySelector('[data-lien-record-box="affidavit_filing"]') as HTMLElement
    expect(box).toBeTruthy()
    expect((within(box).getByLabelText('County') as HTMLInputElement).value).toBe('Guadalupe')
    expect(within(box).getByLabelText('Recording #')).toBeTruthy()
    expect((within(box).getByLabelText('Filed on') as HTMLInputElement).type).toBe('date')
    expect(within(box).getByLabelText('Saved copy — link')).toBeTruthy()
    expect(within(box).getByRole('button', { name: 'Record filing' })).toBeTruthy()
    fireEvent.click(within(box).getByRole('button', { name: 'Back' }))
    expect(document.querySelector('[data-lien-record-box="affidavit_filing"]')).toBeNull()
    expect(screen.getByRole('button', { name: 'Already filed — record it…' })).toBeTruthy()
  })

  it('Already filed — record it… on a phone opens the filing sheet without the gate, and says the paper was filed elsewhere', () => {
    onPhone(() => {
      const bare = { ...address, legal_description: '' }
      renderWithProviders(<LienFilingTabs {...props({ activeTab: 'affidavit', isSub: false, linkedAddress: bare as never })} />)
      fireEvent.click(screen.getByRole('button', { name: 'Already filed — record it…' }))
      expect(sheet()!.getAttribute('data-lien-record-sheet')).toBe('affidavit_filing')
      expect(sheet()!.textContent).toContain('Filed without this tab')
      expect((screen.getByLabelText('Filed on') as HTMLInputElement).type).toBe('date')
    })
  })

  it('a phone records service of the filed copy on a sheet that says when it is due', () => {
    onPhone(() => {
      const filed = { id: 'f-1', job_id: 'job-650', kind: 'affidavit', filed_at: '2026-10-01', serve_due: '2026-10-06', served_at: null, voided_at: null, county: 'Guadalupe', recording_number: '2026-0001', months_covered: [], sends: [], fields: {}, created_at: '2026-10-01T15:00:00Z' }
      renderWithProviders(<LienFilingTabs {...props({ activeTab: 'affidavit', isSub: false, filings: [filed as never] })} />)
      fireEvent.click(screen.getByRole('button', { name: 'Record service…' }))
      expect(sheet()!.getAttribute('data-lien-record-sheet')).toBe('affidavit_service')
      expect(sheet()!.querySelector('[data-lien-record-summary]')!.textContent).toContain('Service is due October 6, 2026.')
      expect((screen.getByLabelText('Served on') as HTMLInputElement).type).toBe('date')
      expect(sheet()!.querySelector('[data-lien-record-action]')!.textContent).toBe('Record service')
    })
  })

  it('Already sent — record it… (v2.4423): a box in the tab on a computer, a sheet on a phone', () => {
    renderWithProviders(<LienFilingTabs {...props({})} />)
    fireEvent.click(screen.getByRole('button', { name: 'Already sent — record it…' }))
    expect(screen.getByTestId('lien-notice-by-hand')).toBeTruthy()
    expect(sheet()).toBeNull()
    cleanup()
    onPhone(() => {
      const onClose = vi.fn()
      renderWithProviders(<LienFilingTabs {...props({ onClose })} />)
      fireEvent.click(screen.getByRole('button', { name: 'Already sent — record it…' }))
      expect(sheet()!.getAttribute('data-lien-record-sheet')).toBe('notice_by_hand')
      expect(sheet()!.querySelector('[data-lien-record-summary]')!.textContent).toContain('650 · ATI Schertz — As per plans')
      expect((screen.getByLabelText('Claim as printed') as HTMLInputElement).value).toBe('15722.49')
      fireEvent.click(screen.getByRole('button', { name: 'Close' }))
      expect(onClose).toHaveBeenCalledTimes(1)
      fireEvent.click(screen.getByRole('button', { name: 'Back' }))
      expect(sheet()).toBeNull()
      expect(screen.getByRole('button', { name: 'Already sent — record it…' })).toBeTruthy()
    })
  })

  it('Release of record (v2.4423): no sheet, since nothing opens; a phone gets the same fields at full width and the buttons as a grid', () => {
    const filed = { id: 'f-1', job_id: 'job-650', kind: 'affidavit', filed_at: '2026-10-01', serve_due: '2026-10-06', served_at: '2026-10-03', voided_at: null, county: 'Guadalupe', recording_number: '2026-0001', months_covered: [], sends: [], fields: {}, created_at: '2026-10-01T15:00:00Z' }
    renderWithProviders(<LienFilingTabs {...props({ activeTab: 'release_record', isSub: false, filings: [filed as never] })} />)
    const computer = document.querySelector('[data-lien-release-actions]') as HTMLElement
    expect(computer.style.display).toBe('flex')
    expect((screen.getByLabelText('Payment / satisfaction date') as HTMLInputElement).style.fontSize).toBe('0.8125rem')
    cleanup()
    onPhone(() => {
      renderWithProviders(<LienFilingTabs {...props({ activeTab: 'release_record', isSub: false, filings: [filed as never] })} />)
      expect(sheet()).toBeNull()
      const date = screen.getByLabelText('Payment / satisfaction date') as HTMLInputElement
      expect(date.type).toBe('date')
      expect(date.style.fontSize).toBe('1rem')
      expect(date.style.width).toBe('100%')
      expect((screen.getByLabelText('Saved copy — link') as HTMLInputElement).style.width).toBe('100%')
      const actions = document.querySelector('[data-lien-release-actions]') as HTMLElement
      expect(actions.style.display).toBe('grid')
      expect([...actions.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['Print for notarization', 'Download PDF', 'Save release record'])
      expect((actions.querySelectorAll('button')[2] as HTMLElement).style.gridColumn).toBe('1 / -1')
    })
  })
})
