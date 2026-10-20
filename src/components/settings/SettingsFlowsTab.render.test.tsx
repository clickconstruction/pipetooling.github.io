// @vitest-environment jsdom
/**
 * Render smokes for Settings → Flows (Messages, cut 4): the trade partners' flow in its lanes; Remove tried on everyone
 * first, Tom moving on, and Save sending it all at once; a fork made from the join word; a library paper and its one
 * fact from the New paper window; Put it back; a refused Save saying why; History with its first line and Removed; and
 * How it is going. The reminders the app sends itself (cut 5): the newest morning run above the flow, and the owner's
 * switch on Portal opened, read only for the office. The residential customer's and the sub's flows (v2.5498), whose
 * people are not read. The reads and the Save are mocked at the loader; the people are the flows' fixture, read on its day.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'

const auth = vi.hoisted(() => ({ role: 'assistant', profileName: 'Rosa' }))
const appSendsIo = vi.hoisted(() => ({ load: vi.fn(), set: vi.fn() }))

vi.mock('../../lib/supabase', async () => ({ supabase: (await import('../../test/renderSmokeMocks')).makeSupabaseStub() }))
vi.mock('../../hooks/useAuth', async () => {
  const m = await import('../../test/renderSmokeMocks')
  return { ...m.useAuthModuleMock(), useAuth: () => m.makeUseAuthValue({ role: auth.role, profileName: auth.profileName }) }
})
vi.mock('../../lib/flows/flowEditorIo', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/flows/flowEditorIo')>()),
  loadFlowForEditing: vi.fn(),
  saveFlow: vi.fn(),
  askForFact: vi.fn(),
  loadSeats: vi.fn(),
  loadTradeNames: vi.fn(),
  loadDocNames: vi.fn(),
}))
vi.mock('../../lib/flows/flowsIo', () => ({ loadFlowRowsKind: vi.fn(), clearFlowDefCache: vi.fn(), loadFlowDef: vi.fn() }))
vi.mock('../../lib/flows/appSendsIo', () => ({ supabaseAppSendsIo: () => appSendsIo }))
// Each person's stamps are the flows' fixture's, by contact id, as `flow_rows_kind` would give them.
vi.mock('../../lib/flows/load', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../lib/flows/load')>()
  const { flowFixture } = await import('../../lib/flows/flowFixtures')
  return { ...real, flowStampsFor: (_kind: unknown, rows: { contact: { id: string } }) => flowFixture(rows.contact.id).stamps }
})
vi.mock('../gc/flows/GcNewPaperWindow', () => ({
  GcNewPaperWindow: (props: { step: { name: string }; onSaved: (p: unknown) => void; onClose: () => void }) => (
    <div role="dialog" aria-label="A new paper">
      <span>A new paper for {props.step.name}</span>
      <button
        type="button"
        onClick={() =>
          props.onSaved({
            paperId: 'doc:7d0c3f4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f',
            factIds: ['doc:7d0c3f4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f:current'],
            label: 'Safety plan',
            kind: 'upload',
            state: 'published',
          })
        }
      >
        Save the paper
      </button>
    </div>
  ),
}))

import { APP_SENDS_NOT_SAVED, APP_SENDS_OWNER_ONLY, APP_SENDS_SAVE_FIRST, LAST_RUN_NONE } from '../../lib/flows/appSends'
import { PEOPLE_NOT_READ } from '../../lib/flows/editorKinds'
import { loadFlowForEditing, loadDocNames, loadSeats, loadTradeNames, saveFlow } from '../../lib/flows/flowEditorIo'
import { FLOW_FIXTURE_NOW, FLOW_FIXTURE_PEOPLE } from '../../lib/flows/flowFixtures'
import { loadFlowRowsKind } from '../../lib/flows/flowsIo'
import { SEED_FLOWS } from '../../lib/flows/seed'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { DatabaseError } from '../../utils/errorHandling'
import { SettingsFlowsTab } from './SettingsFlowsTab'

const trade = FLOW_FIXTURE_PEOPLE.filter((p) => p.stamps.kind === 'trade')

async function open() {
  renderWithProviders(<SettingsFlowsTab now={() => FLOW_FIXTURE_NOW} />)
  await waitFor(() => expect(screen.getByLabelText('Papers in: its name')).toBeTruthy())
}
const row = (stepId: string) => document.querySelector(`[data-step="${stepId}"]`) as HTMLElement
const saveBox = () => screen.getByLabelText('Before you save')

beforeEach(() => {
  vi.mocked(loadFlowForEditing).mockReset().mockResolvedValue({
    flow: SEED_FLOWS.trade,
    history: [{ stepId: 'portal', what: 'Portal opened: the nudge on, 3 days, a text', before: null, after: null, by: 'Maria', at: '2026-09-28T14:05:00.000Z' }],
    removed: [],
    basedOn: '2026-09-28T14:05:00.000Z',
    drawnAt: '2026-09-01T13:00:00.000Z',
    fromSeed: false,
  })
  vi.mocked(loadFlowRowsKind).mockReset().mockResolvedValue(
    Object.fromEntries(
      trade.map((p) => [
        p.contactId,
        { contact: { id: p.contactId, kind: 'trade' }, card: { name: p.name, goes_by: null, company: null, trades: [], gc_company_id: null, customer_id: null }, projects: [] },
      ]),
    ) as never,
  )
  vi.mocked(saveFlow).mockReset().mockResolvedValue('2026-10-02T16:46:00.000Z')
  vi.mocked(loadSeats).mockReset().mockResolvedValue([
    { id: 'u-robert', name: 'Robert' },
    { id: 'u-rosa', name: 'Rosa' },
  ])
  vi.mocked(loadTradeNames).mockReset().mockResolvedValue(['Electrical', 'Sitework'])
  vi.mocked(loadDocNames).mockReset().mockResolvedValue({})
  auth.role = 'assistant'
  appSendsIo.load.mockReset().mockResolvedValue({ sends: {}, lastRun: null, quickReplies: [] })
  appSendsIo.set.mockReset().mockImplementation(async (kind: string, stepId: string, mode: string) => (mode === 'off' ? {} : { [kind]: { [stepId]: mode === 'send' ? true : 'offer' } }))
})

const portalGroup = () => within(row('portal')).getByRole('radiogroup', { name: 'Portal opened: The app and this reminder' })
/** One of the three ways on Portal opened: Off, Offers or Sends (v2.5595). */
const portalWay = (name: string) => within(portalGroup()).getByRole('radio', { name }) as HTMLButtonElement

describe('SettingsFlowsTab', () => {
  it('lays the trade partners’ flow out by lane, each step with what finishes it and whose move it is', async () => {
    await open()
    expect(screen.getByText(/One flow for each kind of person/)).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Trade partner', selected: true })).toBeTruthy()
    const lanes = [...document.querySelectorAll('[data-lane]')].map((l) => l.getAttribute('data-lane'))
    expect(lanes).toEqual(['once', 'per_job', 'any_time'])
    const steps = [...document.querySelectorAll('[data-step]')].map((s) => s.getAttribute('data-step'))
    expect(steps).toEqual(SEED_FLOWS.trade.lanes.flatMap((l) => l.steps.map((s) => s.id)))
    expect((within(row('compare')).getByLabelText('Compared: whose move') as HTMLSelectElement).value).toBe('us')
    // Compared is a fork: its two facts join with or.
    expect(within(row('compare')).getByRole('button', { name: 'or' })).toBeTruthy()
    expect(screen.queryByLabelText('Before you save')).toBeNull()
  })

  it('tries a removal on everyone before Save, and Save sends the whole flow at once', async () => {
    await open()
    fireEvent.click(within(row('papers')).getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(screen.getByText('Remove Papers in?')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Remove it' }))
    await waitFor(() => expect(saveBox()).toBeTruthy())
    expect(within(saveBox()).getByText('Tom Riddle: Papers in → MSA signed')).toBeTruthy()
    expect(within(saveBox()).getByText('− Papers in.')).toBeTruthy()
    expect(row('papers')).toBeNull()
    fireEvent.click(within(saveBox()).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(saveFlow).toHaveBeenCalledTimes(1))
    const [kind, saved, , basedOn] = vi.mocked(saveFlow).mock.calls[0] ?? []
    expect(kind).toBe('trade')
    expect(basedOn).toBe('2026-09-28T14:05:00.000Z')
    expect(saved?.rows.map((r) => r.step_key)).not.toContain('papers')
    expect(saved?.history.map((h) => [h.stepId, h.what, h.by])).toEqual([['papers', '− Papers in', 'Rosa']])
    await waitFor(() => expect(screen.getByText(/^Saved\. \d+ (people|person) moved with it\.$/)).toBeTruthy())
  })

  it('makes a step a fork from its join word, and Put it back returns the flow as saved', async () => {
    await open()
    fireEvent.click(within(row('papers')).getByRole('button', { name: 'and' }))
    await waitFor(() => expect(within(saveBox()).getByText('Papers in: facts joined with or.')).toBeTruthy())
    expect(within(row('papers')).getByRole('button', { name: 'or' })).toBeTruthy()
    fireEvent.click(within(saveBox()).getByRole('button', { name: 'Put it back' }))
    await waitFor(() => expect(screen.queryByLabelText('Before you save')).toBeNull())
    expect(within(row('papers')).getByRole('button', { name: 'and' })).toBeTruthy()
  })

  it('adds a library paper and its one fact from the New paper window, named as the library names it', async () => {
    await open()
    fireEvent.click(within(row('papers')).getByRole('button', { name: 'A paper for Papers in' }))
    fireEvent.click(screen.getByRole('button', { name: '+ Add a new paper' }))
    expect(screen.getByText('A new paper for Papers in')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Save the paper' }))
    await waitFor(() => expect(within(saveBox()).getByText('Papers in: + paper Safety plan; Papers in: + the Safety plan is current.')).toBeTruthy())
    expect(within(row('papers')).getByText('Safety plan')).toBeTruthy()
    expect(within(row('papers')).getByText('the Safety plan is current')).toBeTruthy()
  })

  it('says why a Save was refused, in the server’s words', async () => {
    vi.mocked(saveFlow).mockRejectedValue(
      new DatabaseError('savedMeanwhile', 'P0001', 'Someone saved this flow while you edited it. Put it back to see theirs, then make your change again.'),
    )
    await open()
    fireEvent.click(within(row('papers')).getByRole('button', { name: 'and' }))
    await waitFor(() => expect(saveBox()).toBeTruthy())
    fireEvent.click(within(saveBox()).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.getByText('Someone saved this flow while you edited it. Put it back to see theirs, then make your change again.')).toBeTruthy())
  })

  it('lists History with its first line from the seed, and brings a removed step back from Removed', async () => {
    await open()
    fireEvent.click(within(row('draws')).getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Remove it' })).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Remove it' }))
    await waitFor(() => expect(row('draws')).toBeNull())
    fireEvent.click(screen.getByRole('tab', { name: 'History · 2' }))
    const history = document.querySelector('[data-flow-history]') as HTMLElement
    expect(within(history).getByText(/^Maria · Sep 28, .* · Portal opened: the nudge on, 3 days, a text$/)).toBeTruthy()
    expect(within(history).getByText(/^PipeTooling · Sep 1, .* · the flow drawn, (\w+) steps$/)).toBeTruthy()
    expect(within(history).getByText(/^Draws · Per job · removed by Rosa/)).toBeTruthy()
    fireEvent.click(within(history).getByRole('button', { name: 'Put it back' }))
    fireEvent.click(screen.getByRole('tab', { name: 'The flow' }))
    await waitFor(() => expect(row('draws')).toBeTruthy())
  })

  it('reads How it is going for the steps, from who is on the flow', async () => {
    await open()
    fireEvent.click(screen.getByRole('tab', { name: 'How it is going' }))
    const going = await waitFor(() => document.querySelector('[data-flow-going]') as HTMLElement)
    expect(within(going).getByLabelText('The funnel')).toBeTruthy()
    const rows = [...going.querySelectorAll('[data-going-step]')].map((r) => r.getAttribute('data-going-step'))
    expect(rows).toEqual(SEED_FLOWS.trade.lanes.flatMap((l) => l.steps.map((s) => s.id)))
  })

  it('shows the office the app’s three-way control read only, on the one step the app sends, with the words it would send', async () => {
    await open()
    expect(screen.getByText(LAST_RUN_NONE)).toBeTruthy()
    await waitFor(() => expect(portalGroup()).toBeTruthy())
    expect(portalWay('Off').getAttribute('aria-checked')).toBe('true')
    expect(portalWay('Sends').disabled).toBe(true)
    expect(within(row('portal')).getByText(APP_SENDS_OWNER_ONLY)).toBeTruthy()
    expect(within(row('portal')).getByText('“Chris, did the invite come through?”')).toBeTruthy()
    expect(document.querySelectorAll('[data-app-sends]')).toHaveLength(1)
  })

  it('lets the owner turn the reminder on at once, apart from the flow’s Save', async () => {
    auth.role = 'master_technician'
    await open()
    await waitFor(() => expect(portalWay('Sends').disabled).toBe(false))
    fireEvent.click(portalWay('Sends'))
    await waitFor(() => expect(appSendsIo.set).toHaveBeenCalledWith('trade', 'portal', 'send'))
    await waitFor(() => expect(portalWay('Sends').getAttribute('aria-checked')).toBe('true'))
    expect(screen.getByText('The app sends the Portal opened reminder from its next morning run at 9 AM.')).toBeTruthy()
    expect(screen.queryByLabelText('Before you save')).toBeNull()
    // Offers (v2.5595): the morning run prepares the text and the office presses it on Today's sends.
    fireEvent.click(portalWay('Offers'))
    await waitFor(() => expect(appSendsIo.set).toHaveBeenCalledWith('trade', 'portal', 'offer'))
    await waitFor(() => expect(portalWay('Offers').getAttribute('aria-checked')).toBe('true'))
    expect(screen.getByText('The app prepares the Portal opened reminder each morning for Today’s sends on the Dashboard.')).toBeTruthy()
  })

  it('says so when the switch did not change, and waits for Save on a step the draft hands to the app', async () => {
    auth.role = 'dev'
    appSendsIo.set.mockRejectedValue(new Error(APP_SENDS_NOT_SAVED))
    await open()
    await waitFor(() => expect(portalWay('Sends').disabled).toBe(false))
    fireEvent.click(portalWay('Sends'))
    await waitFor(() => expect(screen.getByText(APP_SENDS_NOT_SAVED)).toBeTruthy())
    expect(portalWay('Off').getAttribute('aria-checked')).toBe('true')
    fireEvent.change(within(row('msa')).getByLabelText(/: who sends it$/), { target: { value: 'app' } })
    await waitFor(() => expect(within(row('msa')).getByText(APP_SENDS_SAVE_FIRST)).toBeTruthy())
    expect(within(row('msa')).getAllByRole('radio').every((b) => (b as HTMLButtonElement).disabled)).toBe(true)
  })

  it('reads the newest morning run above the flow, and its own sentences on Read the run', async () => {
    appSendsIo.load.mockResolvedValue({
      sends: { trade: { portal: true } },
      lastRun: { at: FLOW_FIXTURE_NOW.toISOString(), dry: false, sent: 0, kept: { off: 11, 'no number': 1 }, textsOff: 0, refusedCount: 0, unread: 0, words: ['No text went.', 'Customers wait until the run can read their page.'] },
      quickReplies: [],
    })
    await open()
    const line = document.querySelector('[data-flows-last-run]') as HTMLElement
    await waitFor(() => expect(within(line).getByText(/^Last morning run today at .*: no text went, 12 kept back\. 11 are off and 1 has no number\.$/)).toBeTruthy())
    expect(portalWay('Sends').getAttribute('aria-checked')).toBe('true')
    fireEvent.click(within(line).getByRole('button', { name: 'Read the run' }))
    expect(within(screen.getByLabelText('The morning run')).getByText('Customers wait until the run can read their page.')).toBeTruthy()
  })

  it('edits the residential customer’s and the sub’s flows too, saying who is on them is not read here yet', async () => {
    vi.mocked(loadFlowForEditing).mockImplementation(async (kind) =>
      kind === 'sub'
        ? { flow: SEED_FLOWS.sub, history: [], removed: [], basedOn: '2026-10-13T17:00:00.000Z', drawnAt: '2026-10-13T17:00:00.000Z', fromSeed: false }
        : { flow: SEED_FLOWS.trade, history: [], removed: [], basedOn: '2026-09-28T14:05:00.000Z', drawnAt: '2026-09-01T13:00:00.000Z', fromSeed: false },
    )
    await open()
    const tabs = screen.getByRole('tablist', { name: 'Which flow' })
    expect(within(tabs).getAllByRole('tab').slice(0, 5).map((t) => t.textContent)).toEqual(['Customer', 'Trade partner', 'Architect', 'Residential customer', 'Sub'])
    fireEvent.click(within(tabs).getByRole('tab', { name: 'Sub' }))
    await waitFor(() => expect(row('onsite')).toBeTruthy())
    expect(vi.mocked(loadFlowForEditing)).toHaveBeenLastCalledWith('sub')
    expect(vi.mocked(loadFlowRowsKind).mock.calls.map((c) => c[0])).not.toContain('sub')
    const name = screen.getByLabelText('Asked: its name')
    fireEvent.change(name, { target: { value: 'Offered' } })
    fireEvent.blur(name)
    expect(within(saveBox()).getByText(PEOPLE_NOT_READ)).toBeTruthy()
    // How it is going says it too, with the unsaved change's box still open below.
    fireEvent.click(within(tabs).getByRole('tab', { name: 'How it is going' }))
    expect(screen.getAllByText(PEOPLE_NOT_READ)).toHaveLength(2)
    expect(document.querySelector('[data-flow-going]')).toBeNull()
  })
  it('shows The app and this move on the Residential customer flow’s Done, two ways, and Asks writes offer (v2.5627)', async () => {
    auth.role = 'dev'
    vi.mocked(loadFlowForEditing).mockImplementation(async (kind: string) => ({
      flow: SEED_FLOWS[kind as keyof typeof SEED_FLOWS],
      history: [],
      removed: [],
      basedOn: '2026-09-28T14:05:00.000Z',
      drawnAt: '2026-09-01T13:00:00.000Z',
      fromSeed: false,
    }))
    await open()
    fireEvent.click(screen.getByRole('tab', { name: 'Residential customer' }))
    await waitFor(() => expect(row('done')).toBeTruthy())
    const group = within(row('done')).getByRole('radiogroup', { name: 'Done: The app and this move' })
    expect(within(group).getAllByRole('radio').map((r) => r.textContent)).toEqual(['Off', 'Asks'])
    expect(within(row('done')).getByText('Nothing happens on the board when a job reaches this stage.')).toBeTruthy()
    expect(within(row('done')).getByText(/The work on the water heater is done/)).toBeTruthy()
    expect(within(row('paid')).getByRole('radiogroup', { name: 'Paid: The app and this reminder' })).toBeTruthy()
    expect(within(row('booked')).queryByRole('radiogroup')).toBeNull()
    fireEvent.click(within(group).getByRole('radio', { name: 'Asks' }))
    await waitFor(() => expect(appSendsIo.set).toHaveBeenCalledWith('residential', 'done', 'offer'))
    await waitFor(() => expect(within(group).getByRole('radio', { name: 'Asks' }).getAttribute('aria-checked')).toBe('true'))
    expect(screen.getByText('When a job is moved to Done on the Pipeline, the office is asked before the text goes.')).toBeTruthy()
  })
})
