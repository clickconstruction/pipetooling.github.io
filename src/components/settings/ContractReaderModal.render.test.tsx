// @vitest-environment jsdom
/**
 * The reader (v2.4098): the customer's page in sample mode in a modal, the surfaces as chips, the
 * sample named over the frame, and the footer's doors.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { installDomShims, renderWithProviders } from '../../test/renderSmokeMocks'
import ContractReaderModal from './ContractReaderModal'
import { CUSTOMER_CONTRACT_CATALOG, resolveContractTexts } from '../../lib/contracts/customerContractCatalog'
import { readerSurfacesFor } from '../../lib/contracts/contractReader'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

installDomShims()
afterEach(cleanup)

const entry = CUSTOMER_CONTRACT_CATALOG.find((e) => e.id === 'job-standard-terms')!
const text = resolveContractTexts(entry, { settings: new Map(), bookDocs: [] })[0]!

describe('ContractReaderModal', () => {
  it('shows the customer’s page in sample mode, names the sample, offers the surfaces as chips, and carries the doors', () => {
    window.localStorage.removeItem('modal_full_screen_contract-reader')
    const onClose = vi.fn()
    const edit = vi.fn()
    renderWithProviders(<ContractReaderModal entry={entry} text={text} surfaces={readerSurfacesFor(entry)} editDoor={{ label: 'Edit the wording', onClick: edit }} onClose={onClose} />)
    expect(screen.getByRole('heading', { name: /as the customer sees it/ }).textContent).toContain('Job service agreement — standard terms')
    const frame = screen.getByTitle('Agreement to sign') as HTMLIFrameElement
    expect(frame.getAttribute('src')).toContain('/contract/sign?t=sample')
    expect(screen.getByTestId('contract-reader-sample').textContent).toContain('Sam Sample · 100 Sample St, Kyle, TX 78640 · Job 1042 · $1,850.00')
    expect(screen.getByRole('button', { name: 'Agreement to sign' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('link', { name: 'Open in new tab ↗' }).getAttribute('href')).toContain('/contract/sign?t=sample')
    // The signed page is a page too; the email is built from Settings (srcDoc, no scripts).
    fireEvent.click(screen.getByRole('button', { name: 'Signed' }))
    expect((screen.getByTitle('Signed') as HTMLIFrameElement).getAttribute('src')).toContain('t=sample-done')
    fireEvent.click(screen.getByTestId('contract-reader-edit'))
    expect(edit).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByTestId('contract-reader-close'))
    expect(onClose).toHaveBeenCalledTimes(1)
    // The full-screen toggle rides along from the shell.
    expect(screen.getByRole('button', { name: 'Full screen' })).toBeTruthy()
  })
})
