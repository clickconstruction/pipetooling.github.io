// @vitest-environment jsdom
/**
 * Render smoke for the AIA G702-G703 window with its paper preview: wide, the paper sits left of
 * the form and follows it as you type; a box left empty is empty; a box pressed on
 * the paper puts the cursor in its field; narrow, Form / Preview swap the two.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { makeJob, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import AiaG702G703Modal from './AiaG702G703Modal'

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, role: 'dev' }) }))
vi.mock('../../lib/physicalInvoiceIssuer', () => ({
  fetchPhysicalInvoiceIssuerFromAppSettings: () => Promise.resolve(),
  getPhysicalInvoiceIssuerDraft: () => ({
    companyName: 'Click Plumbing and Electrical',
    addressText: '5501 Balcones Dr A141\nAustin, TX 78731',
    phone: '',
    email: '',
    tagline: '',
    licenseLine: '',
  }),
}))

vi.mock('../../lib/aiaG702G703PrefillIo', () => ({
  loadAiaPrefillFacts: () =>
    Promise.resolve({ ownerName: 'Heron Construction Group', ownerAddress: '900 Broadway St, San Antonio, TX 78215', contractSignedOn: '2026-07-14' }),
}))

function setWide(wide: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: wide,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia
}

const job = makeJob({ job_name: 'Water Sample Test', customer_name: 'Heron Construction Group', revenue: 48500, pct_complete: 40 })
const cell = (key: string) => document.querySelector(`[data-aia-cell="${key}"]`) as HTMLButtonElement
const field = (key: string) => document.getElementById(`aia-field-${key}`) as HTMLInputElement

afterEach(() => {
  // @ts-expect-error the next test installs its own
  delete window.matchMedia
})

describe('AiaG702G703Modal', () => {
  it('draws the paper beside the form and follows what is typed', async () => {
    setWide(true)
    renderWithProviders(<AiaG702G703Modal open onClose={() => undefined} job={job} hcpForFilename="1023" />)
    await waitFor(() => expect(field('g702_h18_original_contract_sum').value).toBe('48500'))

    expect(screen.getByTestId('aia-preview-pane')).toBeTruthy()
    expect(cell('g702_h18_original_contract_sum').textContent).toBe('$48,500.00')
    expect(cell('g702_h18_original_contract_sum').dataset.aiaSource).toBe('typed')
    // The job is the project; the payer read beside it is the owner; the number waits to be typed.
    expect(cell('g702_h6_project_name').textContent).toBe('Water Sample Test')
    expect(cell('g702_d6_owner_name').textContent).toBe('Heron Construction Group')
    expect(cell('g702_d7_owner_address').textContent).toBe('900 Broadway St')
    expect(cell('g702_n9_contract_date').textContent).toBe('07/14/2026')
    expect(cell('g702_n5_project').dataset.aiaSource).toBe('blank')
    expect(field('g702_c28_retainage_percent').value).toBe('10')
    // Nothing typed for the period: the box is empty, on the paper and in the download.
    expect(cell('g702_n6_period_to').textContent?.trim()).toBe('')
    expect(cell('g702_n6_period_to').dataset.aiaSource).toBe('blank')

    fireEvent.change(field('g702_n6_period_to'), { target: { value: 'October 31, 2026' } })
    expect(cell('g702_n6_period_to').textContent).toBe('October 31, 2026')
    expect(cell('g703_k4_period_to').textContent).toBe('October 31, 2026')

    // 40% of 48,500 = 19,400 this period, less the 10% retainage the form starts with.
    expect(screen.getByLabelText('G702 page').textContent).toContain('CURRENT PAYMENT DUE$17,460.00')
  })

  it('puts the cursor in the field of a box pressed on the paper, opening Change Orders for its boxes', async () => {
    setWide(true)
    renderWithProviders(<AiaG702G703Modal open onClose={() => undefined} job={job} hcpForFilename="1023" />)
    await settle()

    fireEvent.click(cell('g702_f50_this_month_change_order_additions'))
    await waitFor(() => expect(document.activeElement).toBe(field('g702_f50_this_month_change_order_additions')))
    expect((document.querySelector('details.aia-g702-details-wrap') as HTMLDetailsElement).open).toBe(true)
  })

  it('swaps the form for the paper on a narrow screen', async () => {
    setWide(false)
    renderWithProviders(<AiaG702G703Modal open onClose={() => undefined} job={job} hcpForFilename="1023" />)
    await settle()

    expect(screen.queryByTestId('aia-preview-pane')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }))
    expect(screen.getByTestId('aia-preview-pane')).toBeTruthy()
    fireEvent.click(cell('g702_n7_project_no'))
    await waitFor(() => expect(document.activeElement).toBe(field('g702_n7_project_no')))
    expect(screen.queryByTestId('aia-preview-pane')).toBeNull()
  })
})
