// @vitest-environment jsdom
/**
 * The customer page and a recommended add-on (v2.5018, the owner's call of 2026-10-09): the add-on
 * the office pre-ticked starts ticked with a Recommended badge, the customer unticks it freely, and
 * the approval carries exactly what is ticked — what `accept-estimate` freezes and records in
 * `accepted_option_keys`. The edge functions are stand-ins; the job and the prices are made up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

import { installDomShims, settle } from '../test/renderSmokeMocks'
import EstimateAccept from './EstimateAccept'

const line = (description: string, cents: number) => ({ line_item: '', description, quantity: 1, unit_price_cents: cents, amount_cents: cents })
const ESTIMATE = {
  id: 'est-1',
  title: 'Water heater',
  line_items_snapshot: [line('Heater', 480000)],
  terms_snapshot: 'Net 15.',
  total_cents: 480000,
  valid_until: null,
  options: [
    { key: 'replace', name: 'Replace 50-gal', description: '', recommended: true, kind: 'choice', line_items: [line('Heater', 480000)] },
    { key: 'repair', name: 'Repair', description: '', kind: 'choice', line_items: [line('Valve', 45000)] },
    { key: 'softener', name: 'Water softener', description: '', kind: 'add_on', preticked: true, line_items: [line('Softener', 150000)] },
    { key: 'bibs', name: 'Hose bibs', description: '', kind: 'add_on', line_items: [line('Bibs', 24000)] },
  ],
}

let accepted: Record<string, unknown> | null = null
beforeEach(() => {
  accepted = null
  installDomShims()
  vi.stubGlobal('scrollTo', vi.fn())
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: { body?: string }) => {
    const json = (body: unknown) => ({ ok: true, json: async () => body }) as unknown as Response
    if (url.includes('get-estimate-for-customer')) return json(ESTIMATE)
    if (url.includes('accept-estimate')) {
      accepted = JSON.parse(init?.body ?? '{}') as Record<string, unknown>
      return json({ ok: true })
    }
    return json({})
  }))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('EstimateAccept · a recommended add-on (the owner’s call of 2026-10-09)', () => {
  it('starts ticked with its badge, unticks freely, and the approval sends only what is ticked', async () => {
    render(
      <MemoryRouter initialEntries={['/estimate?t=tok-1']}>
        <EstimateAccept />
      </MemoryRouter>,
    )
    const softener = await screen.findByRole('checkbox', { name: /Water softener/ })
    const bibs = screen.getByRole('checkbox', { name: /Hose bibs/ })
    expect(softener.getAttribute('aria-checked')).toBe('true')
    expect(within(softener).getByText('Recommended')).toBeTruthy()
    expect(bibs.getAttribute('aria-checked')).toBe('false')
    expect(within(bibs).queryByText('Recommended')).toBeNull()

    fireEvent.click(softener)
    await settle()
    expect(screen.getByRole('checkbox', { name: /Water softener/ }).getAttribute('aria-checked')).toBe('false')
    fireEvent.click(screen.getByRole('checkbox', { name: /Water softener/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: /Water softener/ }))
    await settle()

    // The customer kept the ★ choice and unticked the softener: the approval names one option.
    fireEvent.click(screen.getAllByRole('button', { name: /^Approve “Replace 50-gal” — \$4,800\.00$|^Approve "Replace 50-gal" — \$4,800\.00$/ })[0]!)
    await settle()
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'Pat Customer' } })
    for (const box of within(dialog).getAllByRole('checkbox')) if (!(box as HTMLInputElement).checked) fireEvent.click(box)
    await settle()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Submit acceptance' }))
    await settle()
    expect(accepted).toMatchObject({ token: 'tok-1', optionKey: 'replace', optionKeys: ['replace'] })
  })

  it('kept as it started, the pre-ticked add-on rides the approval', async () => {
    render(
      <MemoryRouter initialEntries={['/estimate?t=tok-1']}>
        <EstimateAccept />
      </MemoryRouter>,
    )
    await screen.findByRole('checkbox', { name: /Water softener/ })
    fireEvent.click(screen.getAllByRole('button', { name: /^Approve .Replace 50-gal. \+ 1 add-on — \$6,300\.00$/ })[0]!)
    await settle()
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'Pat Customer' } })
    for (const box of within(dialog).getAllByRole('checkbox')) if (!(box as HTMLInputElement).checked) fireEvent.click(box)
    fireEvent.click(within(dialog).getByRole('button', { name: 'Submit acceptance' }))
    await settle()
    expect(accepted).toMatchObject({ optionKey: 'replace', optionKeys: ['replace', 'softener'] })
  })
})
