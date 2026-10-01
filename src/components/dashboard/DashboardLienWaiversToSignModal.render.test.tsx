// @vitest-environment jsdom
/**
 * The leader's seat (v2.4276): the list of waivers awaiting my signature on the left, the picked
 * one's page and pad on the right; signing writes one signature, sends to the payor when ticked,
 * and the next row loads. v2.4335: the pad is the page's own signature line; typing is the
 * second choice at my own desk.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import type { LienInboxRow } from '../../lib/jobs/lienReleaseInboxLanes'
import { DashboardLienWaiversToSignModal } from './DashboardLienWaiversToSignModal'

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'master-1' }, role: 'master_technician', profileName: 'Malachi Reyes' }) }))
// jsdom has no canvas: the pad is a stub whose ink the test puts on the line.
const pad = vi.hoisted(() => ({ empty: true }))
// jsdom draws nothing: the line's canvas gets no 2D context (and no "not implemented" noise).
HTMLCanvasElement.prototype.getContext = (() => null) as never
vi.mock('signature_pad', () => ({
  default: class {
    off() {}
    clear() {
      pad.empty = true
    }
    isEmpty() {
      return pad.empty
    }
    toDataURL() {
      return pad.empty ? null : 'data:image/png;base64,DRAWN'
    }
  },
}))
const io = vi.hoisted(() => ({ signs: [] as unknown[], sends: [] as unknown[] }))
vi.mock('../../lib/jobs/lienReleaseSignIo', () => ({
  signLienRelease: vi.fn(async (args: unknown) => {
    io.signs.push(args)
    return { ok: true, signedAtIso: '2026-09-30T20:00:00Z' }
  }),
  resolveLienWaiverRecipient: vi.fn(async () => ({ email: 'ap@knight.example', name: 'Knight Contracting' })),
}))
vi.mock('../../lib/sendLienReleaseEmail', () => ({
  sendLienReleaseEmailToCustomer: vi.fn(async (_r: unknown, _j: unknown, opts: unknown) => {
    io.sends.push(opts)
    return { ok: true, sentTo: 'ap@knight.example' }
  }),
}))
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
afterEach(() => {
  cleanup()
  io.signs = []
  io.sends = []
  pad.empty = true
})

function row(over: Partial<LienInboxRow> & { id: string; amount: number; form_type: string }): LienInboxRow {
  return {
    created_at: '2026-09-30T15:00:00Z',
    created_by: null,
    fields: { companyName: 'Click Plumbing and Electrical', checkFrom: 'Knight Contracting', amount: String(over.amount), projectDescription: 'Springtown — 415 Springtown Way', throughDate: '2026-09-30', signedDate: '2026-09-30', signerName: 'Malachi Reyes', signerTitle: 'Master Plumber' },
    invoice_ids: ['inv-2'],
    job_id: 'j977',
    minted_at: '2026-09-30T15:00:00Z',
    minted_pdf_path: null,
    sent_by: null,
    sent_channel: null,
    sent_to_customer_at: null,
    signature_requested_at: '2026-09-30T15:00:00Z',
    signature_requested_by: 'assistant-1',
    signed_at: null,
    signed_date: '2026-09-30',
    signed_on_device_of: null,
    signed_pdf_path: null,
    signer_consented_at: null,
    signer_printed_name: null,
    signer_signature_mode: null,
    signer_signature_storage_path: null,
    signer_user_id: 'master-1',
    status: 'awaiting_signature',
    through_date: '2026-09-30',
    voided_at: null,
    voided_by: null,
    job: { id: 'j977', job_name: 'Springtown', hcp_number: '977', click_number: null, customer_email: 'owner@example.com' },
    ...over,
  } as LienInboxRow
}

const rows = [row({ id: 'r1', amount: 15406, form_type: 'conditional_progress' }), row({ id: 'r2', amount: 4800, form_type: 'conditional_final', job: { id: 'j898', job_name: 'Reliant Health', hcp_number: '898', click_number: null, customer_email: null }, job_id: 'j898' })]

describe('DashboardLienWaiversToSignModal (v2.4276)', () => {
  it('lists the waivers, shows the picked page, and signing sends to the payor and loads the next', async () => {
    const onChanged = vi.fn()
    renderWithProviders(<DashboardLienWaiversToSignModal open onClose={() => undefined} rows={rows} onChanged={onChanged} />)
    await settle()
    const list = screen.getByTestId('lien-waivers-list')
    expect(list.textContent).toContain('$15,406')
    expect(list.textContent).toContain('Conditional · progress')
    expect(list.textContent).toContain('Conditional · final')
    expect(screen.getByTestId('lien-waivers-page').textContent).toContain('Conditional Waiver and Release on Progress Payment')
    await screen.findByTestId('lien-waivers-send-after')
    expect(screen.getByRole('button', { name: '✍ Sign · send to Knight Contracting' })).toBeTruthy()
    // v2.4335: he signs on the page's own line, his name printed under it.
    const line = within(screen.getByTestId('lien-waivers-page')).getByTestId('lien-waiver-sign-foot')
    expect(line.textContent).toContain('Malachi Reyes, Click Plumbing and Electrical')
    fireEvent.click(screen.getByLabelText(/I have read this release/))
    fireEvent.click(screen.getByRole('button', { name: '✍ Sign · send to Knight Contracting' }))
    expect(screen.getByRole('alert').textContent).toBe('Sign on the line first.')
    pad.empty = false
    fireEvent.click(screen.getByRole('button', { name: '✍ Sign · send to Knight Contracting' }))
    await waitFor(() => expect(io.signs).toHaveLength(1))
    expect(io.signs[0]).toMatchObject({ releaseId: 'r1', signer: { userId: 'master-1' }, onDevice: null, payload: { mode: 'draw', printedName: 'Malachi Reyes', signaturePngBase64: 'data:image/png;base64,DRAWN' } })
    await waitFor(() => expect(io.sends).toHaveLength(1))
    expect(io.sends[0]).toMatchObject({ recipient: 'ap@knight.example', billLabel: '977 Springtown' })
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
    // the next row is picked: the final form's page
    await waitFor(() => expect(screen.getByTestId('lien-waivers-page').textContent).toContain('on Final Payment'))
  })
  it('unticked, signing does not send; picking a row shows its page', async () => {
    renderWithProviders(<DashboardLienWaiversToSignModal open onClose={() => undefined} rows={rows} onChanged={() => undefined} />)
    await settle()
    fireEvent.click(within(screen.getByTestId('lien-waivers-list')).getByRole('button', { name: /Reliant Health/ }))
    await waitFor(() => expect(screen.getByTestId('lien-waivers-page').textContent).toContain('on Final Payment'))
    await screen.findByTestId('lien-waivers-send-after')
    fireEvent.click(screen.getByTestId('lien-waivers-send-after'))
    expect(screen.getByRole('button', { name: '✍ Sign' })).toBeTruthy()
    // At my own desk I may type instead: the name in a script hand on the line.
    fireEvent.click(screen.getByRole('button', { name: 'Type it instead' }))
    expect(screen.getByTestId('lien-waiver-sign-foot').textContent).toContain('Typed signature')
    fireEvent.click(screen.getByRole('button', { name: '✍ Sign' }))
    expect(screen.getByRole('alert').textContent).toBe('Tick the box to agree first.')
    fireEvent.click(screen.getByLabelText(/I have read this release/))
    fireEvent.click(screen.getByRole('button', { name: '✍ Sign' }))
    await waitFor(() => expect(io.signs).toHaveLength(1))
    expect(io.signs[0]).toMatchObject({ releaseId: 'r2', payload: { mode: 'type', printedName: 'Malachi Reyes' } })
    await settle()
    expect(io.sends).toHaveLength(0)
  })
})
