import { describe, expect, it } from 'vitest'
import { flowRows as editorRows } from './editor'
import type { FlowRows } from './load'
import { planNudgeRun } from './nudgeDispatch'
import {
  APP_SENDS_SETTING_KEY,
  PERSON_LINES,
  appSendsFrom,
  flowFirst,
  flowsByKind,
  newestLines,
  nudgeRunReads,
  nudgeSentFrom,
  portalLinkOf,
  quickRepliesFrom,
  textNumberOf,
  type NudgeRunRows,
  type RunChannelRow,
  type RunLineRow,
  type RunQuickReplyRow,
  type RunStepRow,
} from './nudgeRunInputs'
import { personFlowFrom } from './person'
import { SEED_FLOWS } from './seed'

/** The run's morning: Fri Oct 2, 9 AM Central. */
const MORNING = new Date('2026-10-02T14:00:00Z')
const ORIGIN = 'https://clicktooling.com'

/**
 * Tom of Bexar Mechanical, the prototype's demo trade partner, as `flow_rows` gives him: invited Fri Sep 25 and on
 * Portal opened since, his page never opened, with nothing from us since the invitation.
 */
const TOM_ROWS: FlowRows = {
  contact: { id: 'tom', kind: 'trade', off_since: null, off_why: null, off_by: null },
  userNames: { 'u-rosa': 'Rosa' },
  company: { id: 'bexar', portal_opened_on: null },
  tradeMessages: [{ company_id: 'bexar', kind: 'invite', sent_on: '2026-09-25', sent_by: 'u-rosa' }],
  previewPath: '/t/bexar-token?preview=1',
  card: { name: 'Tom Riddle', goes_by: null, company: 'Bexar Mechanical', trades: ['Mechanical'], gc_company_id: 'bexar' },
}

const TOM_PHONE: RunChannelRow = { id: 'ch-tom', contact_id: 'tom', kind: 'phone', value: '(210) 555-0130', opted_out_at: null, created_at: '2026-09-25T15:00:00Z' }
const INVITE_LINE: RunLineRow = { contact_id: 'tom', direction: 'out', at: '2026-09-25T15:00:00Z', channel_id: 'ch-tom' }

const rowsFor = (change: Partial<NudgeRunRows> = {}): NudgeRunRows => ({
  contacts: [{ id: 'tom', kind: 'trade', name: 'Tom Riddle', goes_by: null, snoozed_until: null }],
  flowRows: { tom: TOM_ROWS },
  steps: [],
  holds: [],
  sent: [],
  notes: [],
  lines: [INVITE_LINE],
  owed: [],
  channels: [TOM_PHONE],
  quickReplies: [],
  appSends: {},
  ...change,
})

const phone = (id: string, created: string, stopped: string | null = null): RunChannelRow => ({
  id,
  contact_id: 'tom',
  kind: 'phone',
  value: `(210) 555-01${id.slice(-2)}`,
  opted_out_at: stopped,
  created_at: created,
})

describe('appSendsFrom: the owner’s switch as stored', () => {
  it('is off for every step when nothing is stored, and for the seed’s empty object', () => {
    for (const value of [undefined, null, {}, [], 'on', 1]) expect(appSendsFrom(value)).toEqual({})
  })

  it('turns a step on only with true, under a kind the app knows', () => {
    expect(appSendsFrom({ trade: { portal: true, msa: 'yes', ask: 1, sow: false }, customer: { contract: true }, sub: { yes: true }, arch: [] })).toEqual({
      trade: { portal: true },
      customer: { contract: true },
    })
  })

  it('reads the row’s value_text as stored, and text that is not JSON as off', () => {
    expect(appSendsFrom('{}')).toEqual({})
    expect(appSendsFrom('{"trade":{"portal":true}}')).toEqual({ trade: { portal: true } })
    expect(appSendsFrom('{"trade":{"portal":"true"}}')).toEqual({})
    for (const text of ['', 'true', 'trade.portal', '{"trade":']) expect(appSendsFrom(text)).toEqual({})
  })

  it('keeps the same step id apart under two kinds', () => {
    expect(appSendsFrom({ customer: { yes: true }, trade: { yes: false } })).toEqual({ customer: { yes: true } })
  })

  it('names its app_settings key', () => {
    expect(APP_SENDS_SETTING_KEY).toBe('messages_nudge_app_sends_v1')
  })
})

describe('flowsByKind: each kind’s flow, as the panel reads it', () => {
  it('reads the seed’s flow for a kind with no steps on the database', () => {
    const flows = flowsByKind([])
    expect(flows.trade).toBe(SEED_FLOWS.trade)
    expect(flows.customer).toBe(SEED_FLOWS.customer)
  })

  it('reads the office’s edit for a kind that has its steps, and the seed’s for the rest', () => {
    const edited: RunStepRow[] = editorRows(SEED_FLOWS.trade).map((r) => ({ ...r, ...(r.step_key === 'portal' ? { name: 'Their page opened' } : {}), flows: { kind: 'trade' } }))
    const flows = flowsByKind(edited)
    const portal = flows.trade.lanes.flatMap((l) => l.steps).find((s) => s.id === 'portal')
    expect(portal?.name).toBe('Their page opened')
    expect(flows.arch).toBe(SEED_FLOWS.arch)
  })
})

describe('flowFirst: what the flow calls them', () => {
  it('reads the name they go by, then their first name, then their company', () => {
    expect(flowFirst({ kind: 'trade', name: 'Tom Riddle', goes_by: null }, TOM_ROWS.card)).toBe('Tom')
    expect(flowFirst({ kind: 'trade', name: 'Thomas Riddle', goes_by: 'Tommy' }, TOM_ROWS.card)).toBe('Tommy')
    expect(flowFirst({ kind: 'unknown', name: null, goes_by: null }, { ...TOM_ROWS.card!, name: '' })).toBe('Bexar Mechanical')
    expect(flowFirst({ kind: 'unknown', name: null, goes_by: null }, null)).toBe('them')
  })
})

describe('newestLines: the lines their panel reads', () => {
  it('keeps the newest 50, newest first', () => {
    const lines = Array.from({ length: 60 }, (_, i) => ({ direction: 'in' as const, at: new Date(Date.UTC(2026, 7, 1 + i)).toISOString() }))
    const kept = newestLines(lines)
    expect(kept).toHaveLength(PERSON_LINES)
    expect(kept[0]!.at).toBe(lines[59]!.at)
    expect(kept[PERSON_LINES - 1]!.at).toBe(lines[10]!.at)
  })
})

describe('textNumberOf: the number a reminder goes to', () => {
  it('has no number when they have no phone, and an address is not one', () => {
    expect(textNumberOf([{ ...TOM_PHONE, kind: 'email', value: 'tom@bexar.example' }])).toEqual({ number: null, optedOut: false, channelId: null })
  })

  it('skips a number that sent STOP for one that did not', () => {
    const n = textNumberOf([phone('ch-01', '2026-09-01T00:00:00Z', '2026-09-20T00:00:00Z'), phone('ch-02', '2026-09-10T00:00:00Z')])
    expect(n).toEqual({ number: '(210) 555-0102', optedOut: false, channelId: 'ch-02' })
  })

  it('takes the number their thread last carried a line on, else the first added', () => {
    const both = [phone('ch-01', '2026-09-01T00:00:00Z'), phone('ch-02', '2026-09-10T00:00:00Z')]
    expect(textNumberOf(both).channelId).toBe('ch-01')
    const lines: RunLineRow[] = [
      { contact_id: 'tom', direction: 'in', at: '2026-09-28T15:00:00Z', channel_id: 'ch-02' },
      { contact_id: 'tom', direction: 'out', at: '2026-09-20T15:00:00Z', channel_id: 'ch-01' },
    ]
    expect(textNumberOf(both, lines).channelId).toBe('ch-02')
  })

  it('says it was stopped when every number sent STOP', () => {
    const n = textNumberOf([phone('ch-01', '2026-09-01T00:00:00Z', '2026-09-20T00:00:00Z'), phone('ch-02', '2026-09-10T00:00:00Z', '2026-09-22T00:00:00Z')])
    expect(n).toEqual({ number: '(210) 555-0102', optedOut: true, channelId: 'ch-02' })
  })
})

describe('portalLinkOf: a trade partner’s live page', () => {
  it('drops the preview mark from the office’s link and puts it on the app’s address', () => {
    expect(portalLinkOf('/t/bexar-token?preview=1', ORIGIN)).toBe('https://clicktooling.com/t/bexar-token')
    expect(portalLinkOf('/t/bexar-token?preview=1', `${ORIGIN}/`)).toBe('https://clicktooling.com/t/bexar-token')
  })

  it('gives no link for no page, or a path that is not a trade partner’s page', () => {
    expect(portalLinkOf(null, ORIGIN)).toBeNull()
    expect(portalLinkOf('/jobs?tab=stages', ORIGIN)).toBeNull()
    expect(portalLinkOf('/t/bexar-token?preview=1', '')).toBeNull()
  })
})

describe('quickRepliesFrom: the team’s lines', () => {
  const line = (id: string, change: Partial<RunQuickReplyRow> = {}): RunQuickReplyRow => ({
    id,
    text: 'Tom, did the invite come through?',
    for_kind: 'trade',
    step_key: 'portal',
    scope: 'team',
    added_by: 'u-rosa',
    added_at: '2026-09-01T15:00:00Z',
    removed_at: null,
    ...change,
  })

  it('keeps the team’s lines with their presses, and leaves out a line marked mine', () => {
    const lines = quickRepliesFrom(
      [line('q1'), line('q2', { scope: 'mine' }), line('q3', { removed_at: '2026-09-20T15:00:00Z', added_by: null })],
      [
        { quick_reply_id: 'q1', user_id: 'u-rosa' },
        { quick_reply_id: 'q1', user_id: 'u-rosa' },
        { quick_reply_id: 'q1', user_id: null },
      ],
    )
    expect(lines.map((q) => q.id)).toEqual(['q1', 'q3'])
    expect(lines[0]).toMatchObject({ for: 'trade', stepId: 'portal', addedBy: 'u-rosa', removed: false, uses: { 'u-rosa': 2, '': 1 } })
    expect(lines[1]).toMatchObject({ addedBy: '', removed: true, uses: {} })
  })
})

describe('nudgeSentFrom: the reminders sent', () => {
  it('reads the app’s as the app’s and one of ours by who sent it, on the GC project', () => {
    expect(
      nudgeSentFrom([
        { contact_id: 'tom', step_key: 'portal', project_id: null, sent_at: '2026-09-28T14:00:00Z', sent_by: 'app', how: 'text', by_user_id: null },
        { contact_id: 'tom', step_key: 'sow', project_id: 'boerne', sent_at: '2026-09-29T15:00:00Z', sent_by: 'person', how: 'call', by_user_id: 'u-rosa' },
      ]),
    ).toEqual([
      { contactId: 'tom', stepId: 'portal', jobId: null, at: '2026-09-28T14:00:00Z', by: 'app', how: 'text' },
      { contactId: 'tom', stepId: 'sow', jobId: 'boerne', at: '2026-09-29T15:00:00Z', by: 'u-rosa', how: 'call' },
    ])
  })
})

describe('nudgeRunReads: everyone’s flow for the morning run', () => {
  it('puts Tom together as his own panel does', () => {
    const { input, channelIds, unread } = nudgeRunReads(rowsFor(), MORNING, { origin: ORIGIN })
    const panel = personFlowFrom({ id: 'tom', first: 'Tom', flow: SEED_FLOWS.trade, rows: TOM_ROWS, now: MORNING, holds: [], sent: [], notes: [], lines: [INVITE_LINE], owed: [], portal: null })
    expect(input.people).toEqual([panel])
    expect(input.numbers).toEqual({ tom: { number: '(210) 555-0130', optedOut: false } })
    expect(channelIds).toEqual({ tom: 'ch-tom' })
    expect(input.links).toEqual({ tom: 'https://clicktooling.com/t/bexar-token' })
    expect(unread).toEqual([])
  })

  it('sends nothing while the switch is the seed’s empty object, and keeps Tom’s reminder back as off', () => {
    const run = planNudgeRun(nudgeRunReads(rowsFor(), MORNING, { origin: ORIGIN }).input)
    expect(run.texts).toEqual([])
    expect(run.notSent).toEqual([{ contactId: 'tom', stepId: 'portal', jobId: null, why: 'off', words: 'the app does not send this step yet' }])
  })

  it('sends Tom one text with his page once Portal opened is on, and none on a second run that morning', () => {
    const on = rowsFor({ appSends: { trade: { portal: true } } })
    const first = planNudgeRun(nudgeRunReads(on, MORNING, { origin: ORIGIN }).input)
    expect(first.texts).toHaveLength(1)
    expect(first.texts[0]).toMatchObject({ contactId: 'tom', stepId: 'portal', body: 'Tom, did the invite come through? Your portal is at https://clicktooling.com/t/bexar-token.' })
    const r = first.texts[0]!.record
    const again = rowsFor({
      appSends: { trade: { portal: true } },
      sent: [{ contact_id: r.contactId, step_key: r.stepId, project_id: r.jobId, sent_at: r.at, sent_by: 'app', how: r.how, by_user_id: null }],
    })
    const second = planNudgeRun(nudgeRunReads(again, new Date('2026-10-02T15:00:00Z'), { origin: ORIGIN }).input)
    expect(second.texts).toEqual([])
    expect(second.notSent.map((k) => k.why)).toEqual(['sent lately'])
  })

  it('reads only their newest 50 lines, as their panel does: an older text of ours drops out', () => {
    const ours: RunLineRow = { contact_id: 'tom', direction: 'out', at: '2026-06-01T15:00:00Z', channel_id: 'ch-tom' }
    const theirs: RunLineRow[] = Array.from({ length: 55 }, (_, i) => ({ contact_id: 'tom', direction: 'in', at: new Date(Date.UTC(2026, 6, 1 + i, 15)).toISOString(), channel_id: null }))
    const lines = [ours, ...theirs]
    const { input } = nudgeRunReads(rowsFor({ lines }), MORNING, { origin: ORIGIN })
    expect(input.people[0]!.lastOutAt).toBeNull()
    const panel = personFlowFrom({ id: 'tom', first: 'Tom', flow: SEED_FLOWS.trade, rows: TOM_ROWS, now: MORNING, lines: newestLines(lines) })
    expect(input.people[0]).toEqual(panel)
  })

  it('carries a snooze, what we owe them, and a stopped number into the run', () => {
    const { input, channelIds } = nudgeRunReads(
      rowsFor({
        contacts: [{ id: 'tom', kind: 'trade', name: 'Tom Riddle', goes_by: null, snoozed_until: '2026-10-05' }],
        owed: [{ contact_id: 'tom', done_at: null }],
        channels: [{ ...TOM_PHONE, opted_out_at: '2026-09-30T15:00:00Z' }],
      }),
      MORNING,
      { origin: ORIGIN },
    )
    expect(input.snoozed).toEqual({ tom: '2026-10-05' })
    expect(input.people[0]!.owe).toBe(true)
    expect(input.numbers.tom).toEqual({ number: '(210) 555-0130', optedOut: true })
    expect(channelIds).toEqual({})
  })

  it('leaves out a contact whose rows did not come back, and names them for the log', () => {
    const { input, unread } = nudgeRunReads(
      rowsFor({ contacts: [{ id: 'tom', kind: 'trade', name: 'Tom Riddle', goes_by: null, snoozed_until: null }, { id: 'greg', kind: 'trade', name: 'Greg Hill', goes_by: null, snoozed_until: null }] }),
      MORNING,
      { origin: ORIGIN },
    )
    expect(input.people.map((p) => p.id)).toEqual(['tom'])
    expect(unread).toEqual(['greg'])
  })

  it('gives a customer their page link only when the run has one', () => {
    const elena: FlowRows = {
      contact: { id: 'elena', kind: 'customer', off_since: null, off_why: null, off_by: null },
      card: { name: 'Elena Bell', goes_by: null, company: 'Bell Family Dental', trades: [], customer_id: 'cust-bell' },
      previewPath: '/t/should-not-be-used?preview=1',
    }
    const base = rowsFor({ contacts: [{ id: 'elena', kind: 'customer', name: 'Elena Bell', goes_by: null, snoozed_until: null }], flowRows: { elena }, lines: [], channels: [] })
    expect(nudgeRunReads(base, MORNING, { origin: ORIGIN }).input.links).toEqual({})
    const linked = nudgeRunReads({ ...base, customerLinks: { 'cust-bell': 'https://clicktooling.com/c/bell' } }, MORNING, { origin: ORIGIN })
    expect(linked.input.links).toEqual({ elena: 'https://clicktooling.com/c/bell' })
  })
})
