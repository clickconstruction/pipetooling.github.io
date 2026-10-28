// @vitest-environment jsdom
/**
 * Punch list #195 PR 2: Settings → Phone and texts → Missed calls over a fake io. The owner turns the text back on after
 * the confirm and off without one; edits a line and saves it with the switch kept; a bad draft says why and cannot
 * save; everyone else reads the lines and the list; a refused save says why; the list words the last texts back.
 */
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MISSED_REPLY_WORDS as W, type ClaimRow } from '../../lib/messages/missedReplyCard'
import type { MissedReplyCardIo } from '../../lib/messages/missedReplyCardIo'
import { MISSED_REPLY_DEFAULTS, type MissedReplySettings } from '../../lib/quo/missedReply'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { MissedCallReplyCard } from './MissedCallReplyCard'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

const NOW = '2026-10-23T21:30:00.000Z'
const CLAIMS: ClaimRow[] = [
  { call_quo_id: 'CA-1', called_at: '2026-10-23T21:11:00.000Z', outcome: 'sent', line: 'in_hours', reason: null, words: MISSED_REPLY_DEFAULTS.inHours, decided_at: '2026-10-23T21:12:00.000Z', contact: { name: '(512) 555-0187' } },
  { call_quo_id: 'CA-2', called_at: '2026-10-23T16:31:00.000Z', outcome: 'not_sent', line: null, reason: 'stopped', words: 'They sent STOP.', decided_at: '2026-10-23T16:31:10.000Z', contact: { name: '(512) 555-0101' } },
]

function fakeIo(settings: MissedReplySettings = MISSED_REPLY_DEFAULTS, claims: ClaimRow[] = CLAIMS, over: Partial<MissedReplyCardIo> = {}): MissedReplyCardIo {
  return { load: vi.fn(async () => ({ settings, raw: JSON.stringify(settings), claims })), save: vi.fn(async () => undefined), ...over }
}

const card = () => within(document.querySelector<HTMLElement>('[data-settings-missed-calls]')!)
const stateLine = () => document.querySelector<HTMLElement>('[data-missed-calls-state]')!.textContent
const saveButton = () => card().getByRole('button', { name: W.save }) as HTMLButtonElement
const savedJson = (io: MissedReplyCardIo, n = 0) => JSON.parse((io.save as ReturnType<typeof vi.fn>).mock.calls[n]![0] as string) as Record<string, unknown>

afterEach(cleanup)

describe('MissedCallReplyCard', () => {
  it('turns the text back on after the confirm, with the lines kept, and off without one', async () => {
    const io = fakeIo()
    renderWithProviders(<MissedCallReplyCard role="master_technician" io={io} now={() => NOW} />)
    const sw = (await card().findByRole('switch', { name: W.switch })) as HTMLButtonElement
    expect(sw.getAttribute('aria-checked')).toBe('false')
    expect(stateLine()).toBe(W.off)
    fireEvent.click(sw)
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: W.confirm.confirmLabel }))
    await waitFor(() => expect(io.save).toHaveBeenCalledTimes(1))
    expect(savedJson(io)).toEqual({ ...MISSED_REPLY_DEFAULTS, on: true, savedAt: NOW })
    await waitFor(() => expect(stateLine()).toBe(W.on))
    fireEvent.click(card().getByRole('switch', { name: W.switch }))
    await waitFor(() => expect(io.save).toHaveBeenCalledTimes(2))
    expect(savedJson(io, 1)).toMatchObject({ on: false })
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('saves an edited line with the switch as it is, and a bad draft says why and cannot save', async () => {
    const io = fakeIo({ ...MISSED_REPLY_DEFAULTS, on: true })
    renderWithProviders(<MissedCallReplyCard role="dev" io={io} now={() => NOW} />)
    const voicemail = (await card().findByLabelText(W.lines.voicemail)) as HTMLTextAreaElement
    expect(saveButton().disabled).toBe(true)
    fireEvent.change(voicemail, { target: { value: 'We got your voicemail. We call you back today.' } })
    expect(saveButton().disabled).toBe(false)
    fireEvent.click(saveButton())
    await waitFor(() => expect(io.save).toHaveBeenCalledTimes(1))
    expect(savedJson(io)).toEqual({ ...MISSED_REPLY_DEFAULTS, on: true, voicemail: 'We got your voicemail. We call you back today.', savedAt: NOW })
    await waitFor(() => expect(saveButton().disabled).toBe(true))
    fireEvent.change(card().getByLabelText(W.lines.in_hours), { target: { value: '   ' } })
    expect(document.querySelector('[data-missed-calls-problem]')?.textContent).toBe(W.emptyLine)
    expect(saveButton().disabled).toBe(true)
    fireEvent.click(card().getByRole('button', { name: W.putBack }))
    expect((card().getByLabelText(W.lines.in_hours) as HTMLTextAreaElement).value).toBe(MISSED_REPLY_DEFAULTS.inHours)
  })

  it('reads the lines and the list for everyone else, with no switch and no boxes', async () => {
    renderWithProviders(<MissedCallReplyCard role="estimator" io={fakeIo()} now={() => NOW} />)
    await card().findByText(W.notAllowed)
    expect(card().queryByRole('switch')).toBeNull()
    expect(document.querySelector('[data-missed-calls-form]')).toBeNull()
    expect(card().getByText(MISSED_REPLY_DEFAULTS.voicemail, { exact: false })).toBeTruthy()
    const rows = document.querySelectorAll('[data-missed-calls-row]')
    expect([...rows].map((r) => r.textContent)).toEqual(['today · 4:11 PM · (512) 555-0187 · Sent, in office hours.', 'today · 11:31 AM · (512) 555-0101 · Not sent. They sent STOP.'])
  })

  it('says the list is empty in words, and a refused save in its own', async () => {
    const io = fakeIo(MISSED_REPLY_DEFAULTS, [], { save: vi.fn(async () => Promise.reject(new Error(W.notSaved))) })
    renderWithProviders(<MissedCallReplyCard role="dev" io={io} now={() => NOW} />)
    await card().findByText(W.empty)
    fireEvent.change(await card().findByLabelText(W.lines.after_hours), { target: { value: 'The office is closed. Text us here.' } })
    fireEvent.click(saveButton())
    expect((await screen.findByRole('alert')).textContent).toBe(W.notSaved)
    expect((card().getByLabelText(W.lines.after_hours) as HTMLTextAreaElement).value).toBe('The office is closed. Text us here.')
  })
})
