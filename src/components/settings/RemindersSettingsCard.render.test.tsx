// @vitest-environment jsdom
/**
 * v2.5720: Settings → Phone and texts → Reminders the app offers over a fake io and fake flows. The owner reads every
 * step the app can text under its flow, with its way and its morning line; a press writes the one setting through the
 * Flows tab's io and says what it did; a refused press says why and changes nothing; an assistant sees nothing; a flow
 * with no such step says so; a failed read says why.
 */
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { APP_SENDS_NOT_SAVED, appSendsFrom, withAppSend, type AppSendMode } from '../../lib/flows/appSends'
import type { AppSendsIo, AppSendsRead } from '../../lib/flows/appSendsIo'
import type { FlowKind } from '../../lib/flows/facts'
import type { AppSends } from '../../lib/flows/nudgeDispatch'
import { SEED_FLOWS } from '../../lib/flows/seed'
import { REMINDERS_CARD_WORDS as W, type ReminderFlows } from '../../lib/messages/remindersCard'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { RemindersSettingsCard } from './RemindersSettingsCard'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

const FLOWS: ReminderFlows = { trade: SEED_FLOWS.trade, residential: SEED_FLOWS.residential }

function fakeIo(sends: AppSends = appSendsFrom('{"residential":{"approved":"offer"}}'), over: Partial<AppSendsIo> = {}): AppSendsIo {
  let now = sends
  const read: AppSendsRead = { sends, lastRun: null, quickReplies: [] }
  return {
    load: vi.fn(async () => read),
    set: vi.fn(async (kind: FlowKind, stepId: string, mode: AppSendMode) => {
      now = withAppSend(now, kind, stepId, mode)
      return now
    }),
    ...over,
  }
}
const flows = (f: ReminderFlows = FLOWS) => vi.fn(async () => f)

const card = () => document.querySelector<HTMLElement>('[data-settings-reminders]')
const group = (name: string) => screen.getByRole('radiogroup', { name })
const checked = (name: string) => within(group(name)).getAllByRole('radio').filter((r) => r.getAttribute('aria-checked') === 'true').map((r) => r.textContent)

afterEach(cleanup)

describe('RemindersSettingsCard (v2.5720)', () => {
  it('reads every step the app can text under its flow, each with its way and the morning line', async () => {
    renderWithProviders(<RemindersSettingsCard role="master_technician" io={fakeIo()} loadFlows={flows()} />)
    expect(await screen.findByRole('heading', { name: 'Residential customer' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Trade partner' })).toBeTruthy()
    expect([...document.querySelectorAll('[data-reminder-step]')].map((el) => el.getAttribute('data-reminder-step'))).toEqual(['trade:portal', 'residential:approved', 'residential:paid', 'residential:review'])
    expect(checked('Residential customer, Approved: The app and this reminder')).toEqual(['Offers'])
    expect(checked('Residential customer, Paid: The app and this reminder')).toEqual(['Off'])
    expect(checked('Trade partner, Portal opened: The app and this reminder')).toEqual(['Off'])
    const approved = within(document.querySelector<HTMLElement>('[data-reminder-step="residential:approved"]')!)
    expect(approved.getByText('“Dana, any word on the estimate? Happy to answer any questions.”')).toBeTruthy()
    const legend = within(screen.getByRole('list', { name: W.legend }))
    expect(legend.getAllByRole('listitem')).toHaveLength(3)
    expect(legend.getByText('Offers')).toBeTruthy()
    expect(within(card()!).getByText(W.note)).toBeTruthy()
    expect(within(card()!).getByRole('link', { name: W.flowsDoor }).getAttribute('href')).toBe('/settings?tab=settings-flows')
  })

  it('writes a press through the Flows tab’s io, says what it did, and reads the new way back', async () => {
    const io = fakeIo()
    renderWithProviders(<RemindersSettingsCard role="dev" io={io} loadFlows={flows()} />)
    await screen.findByRole('heading', { name: 'Residential customer' })
    fireEvent.click(within(group('Residential customer, Paid: The app and this reminder')).getByRole('radio', { name: 'Sends' }))
    await waitFor(() => expect(io.set).toHaveBeenCalledWith('residential', 'paid', 'send'))
    expect(await screen.findByText('The app sends the Paid reminder from its next morning run at 9 AM.')).toBeTruthy()
    await waitFor(() => expect(checked('Residential customer, Paid: The app and this reminder')).toEqual(['Sends']))
    // The other steps keep their way.
    expect(checked('Residential customer, Approved: The app and this reminder')).toEqual(['Offers'])
  })

  it('does nothing on a press of the way already on', async () => {
    const io = fakeIo()
    renderWithProviders(<RemindersSettingsCard role="master_technician" io={io} loadFlows={flows()} />)
    await screen.findByRole('heading', { name: 'Residential customer' })
    fireEvent.click(within(group('Residential customer, Approved: The app and this reminder')).getByRole('radio', { name: 'Offers' }))
    expect(io.set).not.toHaveBeenCalled()
  })

  it('says why when the write is refused, and changes nothing', async () => {
    const io = fakeIo(appSendsFrom('{}'), { set: vi.fn(async () => Promise.reject(new Error(APP_SENDS_NOT_SAVED))) })
    renderWithProviders(<RemindersSettingsCard role="master_technician" io={io} loadFlows={flows()} />)
    await screen.findByRole('heading', { name: 'Residential customer' })
    fireEvent.click(within(group('Residential customer, Approved: The app and this reminder')).getByRole('radio', { name: 'Offers' }))
    expect(await screen.findByText(APP_SENDS_NOT_SAVED)).toBeTruthy()
    expect(checked('Residential customer, Approved: The app and this reminder')).toEqual(['Off'])
  })

  it('shows an assistant nothing, and makes no read for them', async () => {
    const io = fakeIo()
    const load = flows()
    renderWithProviders(<RemindersSettingsCard role="assistant" io={io} loadFlows={load} />)
    expect(card()).toBeNull()
    expect(io.load).not.toHaveBeenCalled()
    expect(load).not.toHaveBeenCalled()
  })

  it('says so when no step texts its reminder from the app', async () => {
    renderWithProviders(<RemindersSettingsCard role="master_technician" io={fakeIo()} loadFlows={flows({ sub: SEED_FLOWS.sub })} />)
    expect(await screen.findByText(W.none)).toBeTruthy()
    expect(screen.queryByRole('radiogroup')).toBeNull()
  })

  it('says why when the flows or the switch cannot be read', async () => {
    renderWithProviders(<RemindersSettingsCard role="master_technician" io={fakeIo()} loadFlows={vi.fn(async () => Promise.reject(new Error('Could not read the flows.')))} />)
    expect((await screen.findByRole('alert')).textContent).toContain('Could not read the flows.')
    cleanup()
    renderWithProviders(<RemindersSettingsCard role="master_technician" io={fakeIo(undefined, { load: vi.fn(async () => Promise.reject(new Error('Could not read the switch.'))) })} loadFlows={flows()} />)
    expect((await screen.findByRole('alert')).textContent).toContain('Could not read the switch.')
    expect(screen.queryByText(W.loading)).toBeNull()
  })
})
