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

  it('a job contracted with the owner names our own company as the original contractor, at its own address', () => {
    // The window always named the company here; it now gives the address too, as the desk's draft does (`lienOriginalContractor`).
    const issuer = { companyName: 'Sample Plumbing LLC', addressText: '1 Shop Rd\nSan Antonio, TX 78201' } as never
    renderWithProviders(<LienFilingTabs {...props({ activeTab: 'affidavit', isSub: false, issuer, originalContractorName: 'Sample Plumbing LLC', affidavitForm: 'long' })} />)
    expect(document.body.textContent).toContain('The name and address of the original contractor is: Sample Plumbing LLC, 1 Shop Rd, San Antonio, TX 78201.')
  })

  it('the notice claims what the sent bills owe less the claim set by hand, and prints the months a person split it by', () => {
    const staged = makeJob({ id: 'job-651', hcp_number: '651', job_name: 'Sample Remodel', status: 'working', revenue: 5000, payments_made: 0, invoices: [{ id: 'i1', job_id: 'job-651', status: 'billed', amount: 4000, sequence_order: 1, billed_at: '2026-08-20T15:00:00Z' }] as never, payments: [] })
    const correction = { jobId: 'job-651', amountOff: 1000, perMonth: { '2026-07': 1200 }, reason: 'GC disputes a fixture', carry: true, setByName: 'Rey', setAt: '2026-10-20T16:00:00Z', lookedAt: null, lookedByName: '' }
    renderWithProviders(<LienFilingTabs {...props({ job: staged, jobNumber: '651', noticeMonths: ['2026-07', '2026-08'], claimCorrection: correction })} />)
    expect(document.body.textContent).toContain('Claim amount: $3,000.00 (what the sent bills still owe, with the claim set by hand)')
    expect(document.querySelector('[data-lien-window-claim-note="by_hand"]')!.textContent).toContain('Claim set by hand on the Lien desk: $3,000 · $1,000 under the $4,000 unpaid in the app')
    expect(document.querySelector('[data-lien-window-claim-note="unbilled"]')!.textContent).toBe('Not billed yet · $1,000 of the job’s $5,000 · not claimed until it is billed')
    // The paper: the corrected claim, and the split as typed (July its own figure, August the rest).
    expect(document.body.textContent).toContain('$3,000.00')
    expect(document.body.textContent).toContain('Jul 2026 $1,200.00 · Aug 2026 $1,800.00')
  })

  it('says so when the claim set by hand could not be read', () => {
    renderWithProviders(<LienFilingTabs {...props({ claimCorrectionUnread: true })} />)
    expect(document.querySelector('[data-lien-window-claim-note="unread"]')!.textContent).toContain('Check the job on the Lien desk before you print.')
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

describe('LienFilingTabs · the kind of work is the trade (v2.6118)', () => {
  // A job named for its customer, on an electrical job: the papers name the trade, never the name.
  const electrical = makeJob({ id: 'job-838', hcp_number: '838', job_name: 'Bruce Hall', job_address: '100 Main St, Schertz, TX 78154', status: 'billed', revenue: 15722.49, payments_made: 0, serviceType: { name: 'Electrical' } })
  const paper = () => document.body.textContent ?? ''

  it('the affidavit’s ¶4 swears the trade’s labor and materials, not the job’s name', () => {
    renderWithProviders(<LienFilingTabs {...props({ job: electrical, activeTab: 'affidavit', isSub: false, affidavitForm: 'long' })} />)
    expect(paper()).toContain('The kind of work and/or materials furnished by Claimant was: Electrical labor and materials.')
    expect(paper()).not.toContain('was: Bruce Hall')
  })

  it('the short form names the trade inside its sentence (punch list #305)', () => {
    renderWithProviders(<LienFilingTabs {...props({ job: electrical, activeTab: 'affidavit', isSub: false })} />)
    expect(paper()).toContain('Claimant furnished electrical labor and materials to improve this property in')
    expect(paper()).not.toContain('furnished Bruce Hall')
  })

  it('the § 53.056 notice’s type of labor reads the same trade', () => {
    renderWithProviders(<LienFilingTabs {...props({ job: electrical, activeTab: 'notice', isSub: true })} />)
    expect(document.querySelector('[data-field="laborMaterialsType"]')?.textContent).toBe('Electrical labor and materials')
  })

  it('a job with no trade on its row reads plumbing, as before', () => {
    renderWithProviders(<LienFilingTabs {...props({ activeTab: 'affidavit', isSub: false, affidavitForm: 'long' })} />)
    expect(paper()).toContain('was: Plumbing labor and materials.')
    expect(paper()).not.toContain('was: ATI Schertz')
  })
})

describe('LienFilingTabs · the affidavit is the desk’s paper (v2.6809)', () => {
  // A sub's job never clocked, no day set by hand, created in August: the desk's draft swore the month, this tab printed blanks.
  const unclocked = makeJob({ id: 'job-853', click_number: '853', job_name: 'Service Visit', job_address: '100 Main St, Schertz, TX 78154', status: 'billed', revenue: 595, payments_made: 0, created_at: '2026-08-18T05:40:28Z', first_work_date: null, last_work_date: null, lien_last_work_on: null })
  // The sub's gate: a § 53.056 notice on record.
  const notice = { id: 'f-n', job_id: 'job-853', kind: 'notice_53_056', filed_at: '2026-10-14', serve_due: null, served_at: null, voided_at: null, county: '', recording_number: null, months_covered: ['2026-08'], sends: [], fields: {}, created_at: '2026-10-14T15:00:00Z' }
  const paper = () => document.body.textContent ?? ''

  it('paragraph 5 swears the creation month, and the original contractor line carries the address on file', () => {
    renderWithProviders(<LienFilingTabs {...props({ job: unclocked, activeTab: 'affidavit', isSub: true, filings: [notice as never], originalContractorName: 'Harborline Builders', originalContractorAddress: '9 Yard St, Devine TX 78016', affidavitForm: 'long' })} />)
    expect(paper()).toContain('The work was performed and/or materials delivered during the period from August 1, 2026 through August 31, 2026.')
    expect(paper()).not.toContain('from — through —')
    expect(paper()).toContain('The name and address of the original contractor is: Harborline Builders, 9 Yard St, Devine TX 78016.')
  })

  it('the window’s fresh last-day read reaches the paper: the first of that month through the day set by hand', () => {
    renderWithProviders(<LienFilingTabs {...props({ job: unclocked, activeTab: 'affidavit', isSub: true, filings: [notice as never], workDays: { lien_last_work_on: '2026-08-15' }, affidavitForm: 'long' })} />)
    expect(paper()).toContain('during the period from August 1, 2026 through August 15, 2026.')
  })
})

describe('LienFilingTabs · the affidavit prints on the short form (punch list #305)', () => {
  const sub = makeJob({ id: 'job-853', click_number: '853', job_name: 'Service Visit', job_address: '100 Main St, Schertz, TX 78154', status: 'billed', revenue: 595, payments_made: 0, created_at: '2026-08-18T05:40:28Z', first_work_date: null, last_work_date: null, lien_last_work_on: null })
  // The notice on record: August named, mailed to the owner and the GC on October 14.
  const notice = { id: 'f-n', job_id: 'job-853', kind: 'notice_53_056', filed_at: null, serve_due: null, served_at: null, voided_at: null, county: '', recording_number: null, months_covered: ['2026-08'], sends: [{ recipient: 'owner', method: 'certified_mail', tracking: '9407 1', sent_on: '2026-10-14' }, { recipient: 'original_contractor', method: 'certified_mail', tracking: '9407 2', sent_on: '2026-10-14' }], fields: {}, created_at: '2026-10-14T15:00:00Z' }
  const paper = () => document.body.textContent ?? ''
  const gcProps = { job: sub, activeTab: 'affidavit' as const, isSub: true, filings: [notice as never], originalContractorName: 'Harborline Builders', originalContractorAddress: '9 Yard St, Devine TX 78016' }

  it('a GC whose row was read with no address holds the paper: the gate says so and nothing is drawn (punch list #305)', () => {
    renderWithProviders(<LienFilingTabs {...props({ ...gcProps, originalContractorAddress: '', originalContractorAddressRead: true })} />)
    expect(paper()).toContain('✗ The general contractor has no address on its customer record. The affidavit gives its last known address (§ 53.054)')
    expect(paper()).not.toContain('Claimant did so under a contract with')
    expect(paper()).not.toContain('The claim it swears:')
  })

  it('a GC row not read yet holds nothing, and a job contracted with the owner names no GC', () => {
    renderWithProviders(<LienFilingTabs {...props({ ...gcProps, originalContractorAddress: '' })} />)
    expect(paper()).toContain("✓ The general contractor's last known address")
    expect(paper()).toContain('The claim it swears:')
  })

  it('a job under a GC: the months and the notice come from the record, and nothing prints above the title', () => {
    renderWithProviders(<LienFilingTabs {...props(gcProps)} />)
    expect(paper()).toContain('Claimant did so under a contract with Harborline Builders, 9 Yard St, Devine TX 78016, the original contractor.')
    expect(paper()).toContain('Payment is requested for work done and materials furnished in August 2026.')
    expect(paper()).toContain('Notice of the claim was sent to the owner by certified mail on October 14, 2026.')
    expect(paper()).toContain('The amount of the claim is $595.00. Claimant claims a lien on the property for that amount.')
    expect(paper()).toContain('Printed name: ')
    // Gone from the paper: the period, the contract and paid amounts, the general notices sentence, the fees.
    expect(paper()).not.toContain('during the period from')
    expect(paper()).not.toContain('The original contract amount was')
    expect(paper()).not.toContain('All statutory notices')
    expect(paper()).not.toContain("attorney's fees")
    // The county above the opening is the notary's to fill; the property's county is in paragraph 2.
    expect(paper()).not.toContain('COUNTY OF GUADALUPE')
    expect(paper()).toContain('The claim it swears:')
    expect(document.querySelector('[data-lien-window-form-note]')).toBeNull()
  })

  it('a paper drafted on the earlier form prints on it, and the tab says so', () => {
    renderWithProviders(<LienFilingTabs {...props({ ...gcProps, affidavitForm: 'long' })} />)
    expect(paper()).toContain('The work was performed and/or materials delivered during the period from')
    expect(paper()).toContain('Sworn amounts (¶8):')
    expect(document.querySelector('[data-lien-window-form-note="long"]')?.textContent).toContain('earlier form')
  })

  it('a form that could not be read draws the earlier form and says to check the desk', () => {
    renderWithProviders(<LienFilingTabs {...props({ ...gcProps, affidavitForm: 'long', affidavitFormUnread: true })} />)
    expect(document.querySelector('[data-lien-window-form-note="unread"]')?.textContent).toContain('Check the job on the Lien desk before you print.')
  })
})
