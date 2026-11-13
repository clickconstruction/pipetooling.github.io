// @vitest-environment jsdom
/**
 * Punch list #299, PR 2: Settings → Phone and texts → Text a receipt link when a card charge posts, over a fake io. The
 * switch reads off as it ships; turning it on asks first, with a button that names the act, and off does not ask; a
 * trial names the person pressing alone; while it is on the card says who and since when, and says so when Send texts
 * is off; a refused change keeps the switch and its words. Every name is made up.
 */
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RECEIPT_TEXTS_OFF, RECEIPT_TEXTS_WORDS as W, type ReceiptTextsSetting } from '../../lib/tickets/receiptText'
import type { ReceiptTextsIo } from '../../lib/tickets/receiptTextsIo'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { ReceiptTextsSettingsCard } from './ReceiptTextsSettingsCard'

const ME = '00000000-0000-0000-0000-0000000000a1'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'master_technician', user: { id: '00000000-0000-0000-0000-0000000000a1', email: 'owner@example.com' } })
})

const SINCE = '2026-11-13T20:04:00.000Z'

function fakeIo(start: ReceiptTextsSetting, over: Partial<ReceiptTextsIo> = {}): ReceiptTextsIo {
  return {
    load: vi.fn(async () => start),
    sendTextsOn: vi.fn(async () => true),
    // The database stamps the day: what comes back is the row, not what was sent.
    set: vi.fn(async (next: { on: boolean; only?: readonly string[] }) => (next.on ? { on: true, since: SINCE, only: [...(next.only ?? [])] } : RECEIPT_TEXTS_OFF)),
    ...over,
  }
}

const card = () => within(document.querySelector<HTMLElement>('[data-settings-receipt-texts]')!)
const toggle = () => screen.findByRole('switch', { name: W.title })

afterEach(cleanup)

describe('ReceiptTextsSettingsCard', () => {
  it('reads off as it ships, and says what it does and what it needs', async () => {
    renderWithProviders(<ReceiptTextsSettingsCard io={fakeIo(RECEIPT_TEXTS_OFF)} />)
    expect((await toggle()).getAttribute('aria-checked')).toBe('false')
    expect(card().getByText(W.what)).toBeTruthy()
    expect(card().getByText(W.rules)).toBeTruthy()
    expect(card().getByText(W.needs)).toBeTruthy()
    expect((card().getByLabelText(W.everyone) as HTMLInputElement).checked).toBe(true)
    expect(document.querySelector('[data-receipt-texts-on]')).toBeNull()
  })

  it('asks before it turns on, with a button that names the act, and turns on only on a yes', async () => {
    const io = fakeIo(RECEIPT_TEXTS_OFF)
    renderWithProviders(<ReceiptTextsSettingsCard io={io} />)
    fireEvent.click(await toggle())
    const ask = await screen.findByRole('alertdialog')
    expect(within(ask).getByText(W.confirm.message)).toBeTruthy()
    fireEvent.click(within(ask).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(io.set).not.toHaveBeenCalled()

    fireEvent.click(await toggle())
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Turn it on' }))
    await waitFor(() => expect(io.set).toHaveBeenCalledWith({ on: true, only: [] }))
    expect(await screen.findByText(W.onToast)).toBeTruthy()
    expect((await toggle()).getAttribute('aria-checked')).toBe('true')
    // The day it went on is the one the row came back with.
    expect(document.querySelector('[data-receipt-texts-on]')!.textContent).toBe('On for everyone with a card since Nov 13, 2:04 PM. A charge that posted before then gets no text.')
  })

  it('a trial turns it on for the person pressing alone', async () => {
    const io = fakeIo(RECEIPT_TEXTS_OFF)
    renderWithProviders(<ReceiptTextsSettingsCard io={io} />)
    await toggle()
    fireEvent.click(card().getByLabelText(W.onlyMe))
    fireEvent.click(await toggle())
    const ask = await screen.findByRole('alertdialog')
    expect(within(ask).getByText(W.confirmTrial.message)).toBeTruthy()
    fireEvent.click(within(ask).getByRole('button', { name: 'Turn it on for me' }))
    await waitFor(() => expect(io.set).toHaveBeenCalledWith({ on: true, only: [ME] }))
    expect(await screen.findByText(W.trialToast)).toBeTruthy()
    expect(document.querySelector('[data-receipt-texts-on]')!.textContent).toMatch(/^On for you alone since /)
  })

  it('turns off without asking, and who gets the texts cannot change while it is on', async () => {
    const io = fakeIo({ on: true, since: SINCE, only: [ME] })
    renderWithProviders(<ReceiptTextsSettingsCard io={io} />)
    expect((await toggle()).getAttribute('aria-checked')).toBe('true')
    expect((card().getByLabelText(W.onlyMe) as HTMLInputElement).checked).toBe(true)
    expect((card().getByLabelText(W.everyone) as HTMLInputElement).closest('fieldset')!.disabled).toBe(true)
    expect(card().getByText(W.changeWho)).toBeTruthy()
    fireEvent.click(await toggle())
    await waitFor(() => expect(io.set).toHaveBeenCalledWith({ on: false, only: [] }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(await screen.findByText(W.offToast)).toBeTruthy()
    expect((await toggle()).getAttribute('aria-checked')).toBe('false')
  })

  it('says no text goes while it is on and Send texts is off', async () => {
    renderWithProviders(<ReceiptTextsSettingsCard io={fakeIo({ on: true, since: SINCE, only: [] }, { sendTextsOn: vi.fn(async () => false) })} />)
    await toggle()
    await waitFor(() => expect(document.querySelector('[data-receipt-texts-held]')?.textContent).toBe(W.sendTextsOff))
  })

  it('does not say it while this switch is off', async () => {
    renderWithProviders(<ReceiptTextsSettingsCard io={fakeIo(RECEIPT_TEXTS_OFF, { sendTextsOn: vi.fn(async () => false) })} />)
    await toggle()
    await waitFor(() => expect(document.querySelector('[data-receipt-texts-held]')).toBeNull())
  })

  it('keeps the switch and says why when the change is refused', async () => {
    const io = fakeIo(RECEIPT_TEXTS_OFF, { set: vi.fn(async () => Promise.reject(new Error(W.notSaved))) })
    renderWithProviders(<ReceiptTextsSettingsCard io={io} />)
    fireEvent.click(await toggle())
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Turn it on' }))
    expect((await screen.findByRole('alert')).textContent).toContain(W.notSaved)
    expect((await toggle()).getAttribute('aria-checked')).toBe('false')
  })

  it('a switch that cannot be read shows why and offers no press', async () => {
    renderWithProviders(<ReceiptTextsSettingsCard io={fakeIo(RECEIPT_TEXTS_OFF, { load: vi.fn(async () => Promise.reject(new Error('The database did not answer.'))) })} />)
    expect((await screen.findByRole('alert')).textContent).toContain('The database did not answer.')
    expect(screen.queryByRole('switch')).toBeNull()
  })
})
