// @vitest-environment jsdom
/**
 * Escape on a job's Lien window (finding 284 of the fixing thread's ledger; the rule is `lienWindowEscape.ts`): it
 * closes the window as the app's other windows close, stays where it is over words typed in one of its fields, and is
 * not this window's key while a window over it is up. Wiring only. Made-up names.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, waitFor } from '@testing-library/react'
import { makeInvoice, makeJob, renderWithProviders } from '../../test/renderSmokeMocks'
import { LIEN_WINDOW_HELD_WORDS, isWordField } from '../../lib/jobs/lienWindowEscape'
import { registerModal, resetModalStackForTests, unregisterModal } from '../../lib/modalStack'
import LienInstrumentsModal from './LienInstrumentsModal'
// The § Rules window is a lazy chunk that carries every help guide: loaded here, outside every case's clock.
import './LienRulesModal'

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'assistant' })
})
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../lib/fetchJobWithDetailsById', () => ({ fetchJobWithDetailsById: vi.fn(async () => null) }))
vi.mock('../../lib/jobs/lienJobPathIo', () => ({ readLienJobPath: vi.fn(() => new Promise(() => {})), setJobLienPathAnswer: vi.fn() }))
vi.mock('../../lib/jobs/lienNoticePayPageAssets', () => ({ buildPayPageAssets: async () => ({}) }))
vi.mock('../../lib/supabaseAccessTokenForEdge', () => ({ getAccessTokenForEdgeFunctions: async () => null }))

const INV = makeInvoice({ id: 'inv-zz', job_id: 'job-zz', amount: 1500, sequence_order: 1, status: 'billed', billed_at: '2026-08-18T14:28:00Z', sent_to_customer_at: '2026-08-18T14:28:10Z', estimated_bill_date: '2026-09-05' })
const JOB = makeJob({ id: 'job-zz', hcp_number: '9001', job_name: 'ZZ Test lien window', job_address: '1 ZZ Test Way, San Antonio, TX 78209', status: 'billed', customer_id: 'cust-zz', customer_name: 'ZZ Test Customer', customer_email: 'zz@example.test', invoices: [INV], payments: [] })

async function openWindow(open = true) {
  const onClose = vi.fn()
  renderWithProviders(<LienInstrumentsModal open={open} onClose={onClose} job={JOB} invoice={INV} signerNameFallback="ZZ Test Signer, Master Plumber" authEmail="office@example.test" />)
  if (open) await waitFor(() => expect(document.querySelector('[data-lien-window-card]')).toBeTruthy())
  return onClose
}
const escape = () => fireEvent.keyDown(document.body, { key: 'Escape' })
/** The dark backdrop around the window's card. */
const backdrop = () => document.querySelector<HTMLElement>('[data-lien-window]')!
/** The line under the title that says why the window stayed open. */
const heldLine = () => document.querySelector<HTMLElement>('[data-lien-window-held]')
/** The fields in the window a person types words or a day into. */
function wordFields(): Array<HTMLInputElement | HTMLTextAreaElement> {
  const all = Array.from(document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[data-lien-window-card] input, [data-lien-window-card] textarea'))
  const found = all.filter((el) => !el.disabled && !el.readOnly && isWordField({ tagName: el.tagName, type: el.getAttribute('type') }))
  if (found.length === 0) throw new Error('the window draws no typed field')
  return found
}
const aWordField = () => wordFields()[0]!
/** The letter's own pay-by day: a field that keeps what is typed into it. */
function theDayField(): HTMLInputElement {
  const found = wordFields().find((el) => el.getAttribute('type') === 'date')
  if (!found) throw new Error('the window draws no day field')
  return found as HTMLInputElement
}

afterEach(() => {
  cleanup()
  resetModalStackForTests()
  document.querySelectorAll('[data-test-layer]').forEach((el) => el.remove())
})

describe('LienInstrumentsModal · Escape', () => {
  it('closes a window nothing was typed in', async () => {
    const onClose = await openWindow()
    escape()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('stays where it is over typed words, and closes once the field reads as it did', async () => {
    const onClose = await openWindow()
    const field = theDayField()
    const was = field.value
    // A key in the field is the first touch: what it held then is kept.
    fireEvent.keyDown(field, { key: '2' })
    fireEvent.change(field, { target: { value: '2027-01-15' } })
    expect(field.value).toBe('2027-01-15')
    escape()
    expect(onClose).not.toHaveBeenCalled()
    // Escape pressed inside the field is the same key.
    fireEvent.keyDown(field, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.change(field, { target: { value: was } })
    escape()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('says why it stayed, in one line under the title, until the next press in the window', async () => {
    const onClose = await openWindow()
    expect(heldLine()).toBeNull()
    const field = theDayField()
    fireEvent.keyDown(field, { key: '2' })
    fireEvent.change(field, { target: { value: '2027-01-15' } })
    expect(heldLine()).toBeNull()
    escape()
    expect(onClose).not.toHaveBeenCalled()
    expect(heldLine()?.textContent).toBe(LIEN_WINDOW_HELD_WORDS)
    expect(heldLine()?.getAttribute('role')).toBe('status')
    // A second Escape keeps the line. A press inside the window takes it away.
    escape()
    expect(heldLine()).not.toBeNull()
    fireEvent.click(document.getElementById('lien-instruments-title')!)
    expect(heldLine()).toBeNull()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('a press on the backdrop closes a window nothing was typed in', async () => {
    const onClose = await openWindow()
    fireEvent.click(backdrop())
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('a press on the backdrop stays over typed words and says why, and the × still closes', async () => {
    const onClose = await openWindow()
    const field = theDayField()
    const was = field.value
    fireEvent.keyDown(field, { key: '2' })
    fireEvent.change(field, { target: { value: '2027-01-15' } })
    fireEvent.click(backdrop())
    expect(onClose).not.toHaveBeenCalled()
    expect(heldLine()?.textContent).toBe(LIEN_WINDOW_HELD_WORDS)
    // A press inside the card is never a press on the backdrop.
    fireEvent.click(document.querySelector('[data-lien-window-card]')!)
    expect(onClose).not.toHaveBeenCalled()
    // Once the field reads as it did, the backdrop closes the window again.
    fireEvent.change(field, { target: { value: was } })
    fireEvent.click(backdrop())
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('the × closes a window that holds typed words, with no question', async () => {
    const onClose = await openWindow()
    const field = theDayField()
    fireEvent.keyDown(field, { key: '2' })
    fireEvent.change(field, { target: { value: '2027-01-15' } })
    fireEvent.click(document.querySelector<HTMLButtonElement>('[data-lien-window-card] button[aria-label="Close"]')!)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('a field that took the focus and no words does not hold the window', async () => {
    const onClose = await openWindow()
    fireEvent.focus(aWordField())
    escape()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('is not this window’s key when something over it took the key first', async () => {
    const onClose = await openWindow()
    // What a value changed in place, a paper's preview and a nested field do: mark the key handled.
    const take = (e: KeyboardEvent) => e.preventDefault()
    document.addEventListener('keydown', take, true)
    escape()
    document.removeEventListener('keydown', take, true)
    expect(onClose).not.toHaveBeenCalled()
    // And what the confirm window does: stop the key before it reaches the page's listeners.
    const stop = (e: KeyboardEvent) => e.stopPropagation()
    document.addEventListener('keydown', stop, true)
    escape()
    document.removeEventListener('keydown', stop, true)
    expect(onClose).not.toHaveBeenCalled()
    escape()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('is not this window’s key while a later window is on the app’s window stack', async () => {
    const onClose = await openWindow()
    const over = registerModal()
    escape()
    expect(onClose).not.toHaveBeenCalled()
    unregisterModal(over)
    escape()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('is not this window’s key while a dialog is drawn after it on the page', async () => {
    const onClose = await openWindow()
    const layer = document.createElement('div')
    layer.setAttribute('role', 'dialog')
    layer.setAttribute('data-test-layer', '')
    document.body.appendChild(layer)
    escape()
    expect(onClose).not.toHaveBeenCalled()
    layer.remove()
    escape()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('a window that is shut hears nothing, and holds no place on the stack', async () => {
    const onClose = await openWindow(false)
    escape()
    expect(onClose).not.toHaveBeenCalled()
    // Another window's Escape still finds itself on top.
    const other = registerModal()
    expect(other).toBeGreaterThan(0)
  })
})
