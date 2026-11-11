// @vitest-environment jsdom
/**
 * Settings → Jobs, bills and liens → the company block (punch list #305, item 5): one input under the address,
 * *Physical address, if different*. It opens on what Settings hold, Save hands the typed address over with the
 * rest of the block, and the Lien desk's door can land on it. Made-up addresses only.
 */
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import PhysicalInvoiceIssuerDevSettingsBlock from './PhysicalInvoiceIssuerDevSettingsBlock'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', async () => {
  const { makeUseAuthValue, useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  const value = () => makeUseAuthValue({ role: 'dev' })
  return { ...useAuthModuleMock(), useAuth: value, useOptionalAuth: value }
})

const issuerIo = vi.hoisted(() => ({
  draft: { companyName: 'Sample Plumbing LLC', addressText: 'PO Box 9\nSan Antonio, TX 78201', physicalAddressText: '', phone: '', email: '', tagline: '', licenseLine: '', signerName: '', signerTitle: '' },
  save: vi.fn(async (_issuer: Record<string, unknown>) => undefined),
}))
vi.mock('../../lib/physicalInvoiceIssuer', () => ({
  fetchPhysicalInvoiceIssuerFromAppSettings: vi.fn(async () => ({ rowExists: true })),
  getPhysicalInvoiceIssuerDraft: () => ({ ...issuerIo.draft }),
  savePhysicalInvoiceIssuerDraft: issuerIo.save,
}))

const field = () => screen.getByLabelText('Physical address, if different') as HTMLTextAreaElement

beforeEach(() => {
  issuerIo.draft.physicalAddressText = ''
  issuerIo.save.mockClear()
})
afterEach(() => {
  cleanup()
})

describe('the company block · Physical address, if different', () => {
  it('sits under the address, empty until one is typed, and Save hands it over with the rest of the block', async () => {
    renderWithProviders(<PhysicalInvoiceIssuerDevSettingsBlock />)
    await waitFor(() => expect(field().value).toBe(''))
    expect(document.body.textContent).toContain('A lien affidavit gives the address above as the mailing address.')
    fireEvent.change(field(), { target: { value: '1 Shop Rd\nSan Antonio, TX 78201' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(issuerIo.save).toHaveBeenCalledTimes(1))
    expect(issuerIo.save.mock.calls[0]![0]).toMatchObject({ addressText: 'PO Box 9\nSan Antonio, TX 78201', physicalAddressText: '1 Shop Rd\nSan Antonio, TX 78201' })
  })

  it('County where lien papers are signed sits under it, and Save hands the county over (punch list #314)', async () => {
    renderWithProviders(<PhysicalInvoiceIssuerDevSettingsBlock focusField="signingCounty" />)
    const county = (await screen.findByLabelText('County where lien papers are signed')) as HTMLInputElement
    expect(county.value).toBe('')
    expect(county.getAttribute('data-settings-focus')).toBe('issuer.signingCounty')
    expect(county.style.boxShadow).not.toBe('')
    expect(document.body.textContent).toContain('A lien affidavit prints it on both county lines. It is not the property’s county.')
    fireEvent.change(county, { target: { value: 'Travis' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(issuerIo.save).toHaveBeenCalled())
    expect(issuerIo.save.mock.calls[issuerIo.save.mock.calls.length - 1]![0]).toMatchObject({ signingCounty: 'Travis' })
  })

  it('County clerks takes one clerk a line, and Save hands the list over (punch list #314, change 10)', async () => {
    renderWithProviders(<PhysicalInvoiceIssuerDevSettingsBlock />)
    const clerks = (await screen.findByLabelText('County clerks, for the lien help sheets')) as HTMLTextAreaElement
    expect(clerks.value).toBe('')
    expect(clerks.getAttribute('data-settings-focus')).toBe('issuer.countyClerksText')
    expect(document.body.textContent).toContain('One clerk on each line: County | where to file | fee | hours.')
    fireEvent.change(clerks, { target: { value: 'Alder | 100 Court St, Marlow | $26 first page | 8 to 5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(issuerIo.save).toHaveBeenCalled())
    expect(issuerIo.save.mock.calls[issuerIo.save.mock.calls.length - 1]![0]).toMatchObject({ countyClerksText: 'Alder | 100 Court St, Marlow | $26 first page | 8 to 5' })
  })

  it('opens on the address Settings hold, and a door that names the field lands on it', async () => {
    issuerIo.draft.physicalAddressText = '1 Shop Rd\nSan Antonio, TX 78201'
    renderWithProviders(<PhysicalInvoiceIssuerDevSettingsBlock focusField="physicalAddressText" />)
    await waitFor(() => expect(field().value).toBe('1 Shop Rd\nSan Antonio, TX 78201'))
    expect(field().getAttribute('data-settings-focus')).toBe('issuer.physicalAddressText')
    expect(field().style.boxShadow).not.toBe('')
  })
})
