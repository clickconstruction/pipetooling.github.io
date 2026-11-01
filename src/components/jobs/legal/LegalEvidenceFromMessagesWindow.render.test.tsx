// @vitest-environment jsdom
/**
 * The Legal desk's Evidence door, From the job's messages… (punch list #230 PR 5): the window over a fake io. The rows,
 * the ticks and the counted press, the outcome, the empty state, and a read that fails. Made-up names, as the mock-up.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'

vi.mock('../../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'assistant' })
})
vi.mock('../../../lib/navClickTelemetry', () => ({ recordNavClick: () => {} }))

import LegalEvidenceFromMessagesWindow from './LegalEvidenceFromMessagesWindow'
import { renderSettled } from '../../../test/renderSmokeMocks'
import { conversationsOf, lineItemKey, sentItemKey, type EvidenceLine, type EvidencePutOutcome, type EvidencePutPlan } from '../../../lib/legal/evidenceFromMessages'
import type { EvidenceFromMessagesData, EvidenceFromMessagesIo } from '../../../lib/legal/evidenceFromMessagesIo'
import { DatabaseError } from '../../../utils/errorHandling'

afterEach(cleanup)

const TODAY = '2026-11-01'
const JOB = 'pipeline:11111111-1111-4111-8111-111111111111'
const SENT = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const line = (id: string, over: Partial<EvidenceLine> = {}): EvidenceLine => ({ id, contactId: 'c-dale', contactName: 'Dale Okafor', contactKind: 'customer', contactAddress: 'dale@ridgeway.example', jobKey: JOB, direction: 'in', at: '2026-10-24T19:03:00Z', subject: 'Re: 4 Elm Ct water heater', body: 'Go ahead.', whoUserId: null, whoText: '', mailbox: 'mine', mailUserId: 'u-marisol', gmailId: `g-${id}`, gmailThreadId: 't-elm', rfcMessageId: null, files: [], ...over })
const people = { users: { 'u-marisol': { name: 'Marisol Vega', email: 'marisol@clickplumbing.example' } } }

function dataWith(onMatter: string[] = []): EvidenceFromMessagesData {
  const conversations = conversationsOf(
    [line('m-1'), line('m-2', { at: '2026-11-01T14:00:00Z', direction: 'out' }), line('m-4', { gmailThreadId: 't-oak', subject: 'Fwd: JP1062 final walk', at: '2026-09-30T16:00:00Z', mailbox: 'bids', mailUserId: null })],
    [{ id: SENT, kind: 'estimate_sent', title: 'Estimate 1044', subject: 'Estimate 1044 sent', recipientName: 'Dale Okafor', recipientEmails: ['dale@ridgeway.example'], sentAt: '2026-10-02T15:00:00Z', sentByName: 'Rosa', copyPath: `${SENT}/copy.html`, copyType: 'text/html', copyBytes: 900, attachments: [], jobKey: JOB }],
    people,
    { words: { [JOB]: 'J1077 · 4 Elm Ct' }, todayYmd: TODAY },
  )
  return { conversations, onMatter: new Set(onMatter), rawBytes: { 'm-1': 2000, 'm-2': 3000 }, ctx: { todayYmd: TODAY, boxes: {}, users: people.users, appFrom: 'x <x@y.example>' }, people }
}

function fakeIo(load: () => Promise<EvidenceFromMessagesData> = vi.fn(async () => dataWith([lineItemKey('m-4')]))) {
  const put = vi.fn(async (plan: EvidencePutPlan): Promise<EvidencePutOutcome> => ({ done: plan.ready.slice(0, 1).map((s) => ({ key: s.item.key, title: s.title, copy: s.copy })), failed: plan.ready.slice(1).map((s) => ({ key: s.item.key, title: s.title, reason: 'Could not store the file.' })), held: plan.held }))
  return { load: vi.fn(load), put } satisfies EvidenceFromMessagesIo
}

const open = (io: EvidenceFromMessagesIo, onPut = vi.fn(), onClose = vi.fn()) =>
  renderSettled(<LegalEvidenceFromMessagesWindow accountName="Ridgeway Builders" jobNumbers={['J1077', 'J1062']} io={io} onClose={onClose} onPut={onPut} />, { loaded: () => screen.findByText('Re: 4 Elm Ct water heater · 2 emails, Oct 24 to today') })

describe('LegalEvidenceFromMessagesWindow (punch list #230 PR 5)', () => {
  it('lists the conversations, then the app’s own sends; one on the matter has no tick; the press counts the emails', async () => {
    const io = fakeIo()
    const onPut = vi.fn()
    await open(io, onPut)
    const sheet = screen.getByRole('dialog', { name: 'From the job’s messages' })
    expect(within(sheet).getByText('Ridgeway Builders')).toBeTruthy()
    expect(within(sheet).getByText('· emails on J1077 and J1062')).toBeTruthy()
    const elm = document.querySelector(`[data-evidence-row="thread:t-elm|${JOB}"]`)!
    expect(elm.textContent).toContain('tagged by Marisol Vega from their mail · J1077 · 4 Elm Ct')
    const oak = document.querySelector(`[data-evidence-row="thread:t-oak|${JOB}"]`)!
    expect(oak.getAttribute('data-on-matter')).toBe('yes')
    expect(oak.querySelector('input')).toBeNull()
    expect(oak.textContent).toContain('on the matter')
    expect(document.querySelector('[data-evidence-sends]')!.textContent).toContain('The app’s own sends')
    expect(document.querySelector('[data-evidence-sends]')!.textContent).toContain('Estimate 1044 sent · Oct 2')
    const press = document.querySelector('[data-evidence-put]') as HTMLButtonElement
    expect(press.textContent).toBe('Put on the matter')
    expect(press.disabled).toBe(true)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Re: 4 Elm Ct water heater · 2 emails, Oct 24 to today' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Estimate 1044 sent · Oct 2' }))
    expect(press.textContent).toBe('Put 3 on the matter')
    expect(press.disabled).toBe(false)
    fireEvent.click(press)
    await waitFor(() => expect(io.put).toHaveBeenCalledTimes(1))
    const plan = io.put.mock.calls[0]![0] as EvidencePutPlan
    expect(plan.ready.map((s) => s.item.key)).toEqual([lineItemKey('m-1'), lineItemKey('m-2'), sentItemKey(SENT)])
    const outcome = await screen.findByText('Put 1 email. 2 did not go on the matter.')
    expect(outcome.closest('[data-evidence-outcome]')!.textContent).toContain('2 emails did not go on the matter. They stay here with the reason.')
    expect(document.querySelector(`[data-evidence-failed="${sentItemKey(SENT)}"]`)!.textContent).toBe('Estimate 1044 sent · Oct 2, 2026: Could not store the file.')
    expect(onPut).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(io.load).toHaveBeenCalledTimes(2))
    expect(document.querySelector('[data-evidence-close]')!.textContent).toBe('Close')
    expect((document.querySelector('[data-evidence-put]') as HTMLButtonElement).textContent).toBe('Put on the matter')
  })

  it('holds an email already on the matter, says so under the press, and counts only the rest', async () => {
    const io = fakeIo(async () => dataWith([lineItemKey('m-1')]))
    await open(io)
    const elm = document.querySelector(`[data-evidence-row="thread:t-elm|${JOB}"]`)!
    expect(elm.textContent).toContain('1 of 2 already on the matter')
    fireEvent.click(screen.getByRole('checkbox', { name: 'Re: 4 Elm Ct water heater · 2 emails, Oct 24 to today' }))
    expect(document.querySelector('[data-evidence-put]')!.textContent).toBe('Put 1 on the matter')
    expect(screen.getByText('1 email is held. It stays off the matter with its reason below.')).toBeTruthy()
    expect(document.querySelector('[data-evidence-plan-held]')!.textContent).toBe('Re: 4 Elm Ct water heater · 1 of 2 · Oct 24, 2026: Already on the matter.')
  })

  it('an account with no email says what fills it and offers Messages', async () => {
    const io = fakeIo(async () => ({ ...dataWith(), conversations: [] }))
    await renderSettled(<LegalEvidenceFromMessagesWindow accountName="Ridgeway Builders" jobNumbers={['J1077']} io={io} onClose={() => {}} onPut={() => {}} />, { loaded: () => screen.findByText('No email on this account’s jobs yet.') })
    const link = screen.getByRole('link', { name: 'Tag one from Messages' })
    expect(link.getAttribute('href')).toBe('/messages')
    expect(document.querySelector('[data-empty-state]')!.textContent).toBe('No email on this account’s jobs yet. Tag one from Messages or copy bids@ on your next email.')
  })

  it('a read that loses the signal offers Retry and reads again; a refusal shows its reason with no Retry', async () => {
    const load = vi.fn<() => Promise<EvidenceFromMessagesData>>()
    load.mockRejectedValueOnce(new DatabaseError('Failed to load the email', undefined, undefined, { kind: 'network', status: 0 }))
    load.mockResolvedValueOnce(dataWith())
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => false })
    await renderSettled(<LegalEvidenceFromMessagesWindow accountName="Ridgeway Builders" jobNumbers={['J1077']} io={fakeIo(load)} onClose={() => {}} onPut={() => {}} />, { loaded: () => screen.findByRole('button', { name: 'Retry' }) })
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await screen.findByText('Re: 4 Elm Ct water heater · 2 emails, Oct 24 to today')
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => true })
    cleanup()
    const refused = vi.fn(async (): Promise<EvidenceFromMessagesData> => { throw new Error('This door opens once its database update is pushed. Ask a dev to push it, then open it again.') })
    await renderSettled(<LegalEvidenceFromMessagesWindow accountName="Ridgeway Builders" jobNumbers={['J1077']} io={fakeIo(refused)} onClose={() => {}} onPut={() => {}} />, { loaded: () => screen.findByText(/This door opens once its database update is pushed/) })
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()
  })

  it('Not now closes the window', async () => {
    const onClose = vi.fn()
    await open(fakeIo(), vi.fn(), onClose)
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
