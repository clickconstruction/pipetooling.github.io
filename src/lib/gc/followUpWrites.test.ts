/**
 * GC mode, the real build, the Board's B2b-viii-a: what the Follow up sheet writes (`followUpWrites.ts`), on the prototype's
 * fixture. Each press is one of main's writes: a line on an ask, a line of the company's own, a promise, a customer's line.
 */
import { describe, expect, it, vi } from 'vitest'
import { followCustomerId, followUpCallWrites, followUpNudgeRequest, followUpSentWrites, logLine, nudgeBody, nudgeKey, nudgeLines, runFollowUpWrites, type FollowUpWriters } from './followUpWrites'
import type { FollowPerson } from './followUpSheet'
import { allFollowPeople } from './projectPeople'
import { initialGcState } from './schedule/testState'

const person = (id: string): FollowPerson => {
  const p = allFollowPeople(initialGcState()).find((x) => x.partner.id === id)
  if (!p) throw new Error(`no ${id}`)
  return p
}
const text = { from: 'me', via: 'text', length: 'nudge' } as const
const email = { from: 'me', via: 'email', length: 'note' } as const

describe('what a text or an email from me logs', () => {
  it('a line on each ask, with the message on one line', () => {
    const greg = person('hillside')
    expect(followUpSentWrites(greg, greg.items, text, 'Hi Greg,\n\nAny word   on the quote?')).toEqual([
      { kind: 'ask', companyId: 'hillside', inviteId: greg.items[0]!.ask!.inviteId, how: 'text', note: 'Hi Greg, Any word on the quote?', promisedBy: null },
      { kind: 'ask', companyId: 'hillside', inviteId: greg.items[1]!.ask!.inviteId, how: 'text', note: 'Hi Greg, Any word on the quote?', promisedBy: null },
    ])
  })

  it('one line of the company’s own for everything else, naming it', () => {
    const marcus = person('pecanvalley')
    const papers = marcus.items.filter((i) => i.kind === 'insurance' || i.kind === 'waiver')
    expect(followUpSentWrites(marcus, papers, email, 'Could you send them?')).toEqual([
      { kind: 'company', companyId: 'pecanvalley', how: 'email', note: `Emailed about ${papers[0]!.label.toLowerCase()} and ${papers[1]!.label.toLowerCase()}: Could you send them?` },
    ])
  })

  it('a customer gets one line in their own log, with the job when the items share one', () => {
    const elena = person('customer:cibolo')
    expect(followCustomerId(elena)).toBe('cibolo')
    expect(followUpSentWrites(elena, elena.items, text, 'Any word on the payment?')).toEqual([
      { kind: 'customer', customerId: 'cibolo', projectId: 'fairoaksd', how: 'text', note: `Texted about ${elena.items[0]!.label.toLowerCase()}: Any word on the payment?` },
    ])
    // The architect's items are on two jobs: the line names none.
    const jonah = person('customer:marshvale')
    expect(followUpSentWrites(jonah, jonah.items, email, 'Hello')[0]).toMatchObject({ kind: 'customer', customerId: 'marshvale', projectId: null })
  })

  it('nothing ticked writes nothing', () => {
    expect(followUpSentWrites(person('pecanvalley'), [], text, 'Hello')).toEqual([])
    expect(followUpSentWrites(person('customer:cibolo'), [], text, 'Hello')).toEqual([])
  })

  it('a long message is cut to one short line', () => {
    expect(logLine('x'.repeat(200))).toBe(`${'x'.repeat(139)}…`)
  })
})

describe('what saving a call logs', () => {
  it('what they said on each ask, with the day they gave', () => {
    const greg = person('hillside')
    const writes = followUpCallWrites(greg, greg.items.slice(0, 1), 'Pricing it now.', '2026-10-06')
    expect(writes).toEqual([{ kind: 'ask', companyId: 'hillside', inviteId: greg.items[0]!.ask!.inviteId, how: 'call', note: 'Pricing it now.', promisedBy: '2026-10-06' }])
  })

  it('a day on a paper is a promise of its kind, with what it is, then the company’s line', () => {
    const marcus = person('pecanvalley')
    const insurance = marcus.items.find((i) => i.kind === 'insurance')!
    const waiver = marcus.items.find((i) => i.kind === 'waiver')!
    expect(followUpCallWrites(marcus, [insurance, waiver], '', '2026-10-08')).toEqual([
      { kind: 'promise', companyId: 'pecanvalley', promise: 'insurance', projectId: null, packageId: null, dueOn: '2026-10-08', what: insurance.words.en.about },
      { kind: 'promise', companyId: 'pecanvalley', promise: 'closeout', projectId: 'fairoaksd', packageId: 'felec', dueOn: '2026-10-08', what: waiver.words.en.about },
      { kind: 'company', companyId: 'pecanvalley', how: 'call', note: `Call about ${insurance.label.toLowerCase()} and ${waiver.label.toLowerCase()}: Gave a day.` },
    ])
  })

  it('a scope of work for the job and its trade', () => {
    const bright = person('brightline')
    expect(followUpCallWrites(bright, bright.items, 'Sending it Friday.', '2026-10-09')[0]).toMatchObject({ kind: 'promise', promise: 'sow', projectId: 'helotes', packageId: 'delec' })
  })

  it('a promise already made moves: its own kind, job and trade', () => {
    const base = person('pecanvalley')
    const promise = { id: 'pr1', partnerId: 'pecanvalley', kind: 'submittals' as const, projectId: 'fairoaksd', packageId: 'felec', what: 'the panel submittals', by: '2026-10-01', madeOn: '2026-09-25', from: 'office' as const }
    const item = { ...base.items[0]!, key: 'promise-pr1', kind: 'promise' as const, promise, projectId: 'fairoaksd', packageId: 'felec' }
    expect(followUpCallWrites({ ...base, items: [item] }, [item], 'Next week.', '2026-10-09')[0]).toEqual({
      kind: 'promise',
      companyId: 'pecanvalley',
      promise: 'submittals',
      projectId: 'fairoaksd',
      packageId: 'felec',
      dueOn: '2026-10-09',
      what: 'the panel submittals',
    })
  })

  it('a day for the schedule is only logged; no day, no promise', () => {
    const summit = person('summit')
    expect(followUpCallWrites(summit, summit.items, 'Back Monday.', '2026-10-05').map((w) => w.kind)).toEqual(['company'])
    const marcus = person('pecanvalley')
    expect(followUpCallWrites(marcus, marcus.items, 'Soon.', null).map((w) => w.kind)).toEqual(['company'])
  })

  it('a customer’s call is one line in their log, never a promise', () => {
    const elena = person('customer:cibolo')
    expect(followUpCallWrites(elena, elena.items, 'Paying Friday.', '2026-10-09')).toEqual([
      { kind: 'customer', customerId: 'cibolo', projectId: 'fairoaksd', how: 'call', note: `Call about ${elena.items[0]!.label.toLowerCase()}: Paying Friday.` },
    ])
  })
})

describe('making the writes', () => {
  const writers = (): FollowUpWriters & { calls: string[] } => {
    const calls: string[] = []
    return {
      calls,
      logAsk: vi.fn(async (l) => void calls.push(`ask:${l.inviteId ?? 'company'}`)),
      logCustomer: vi.fn(async (l) => void calls.push(`customer:${l.customerId}`)),
      recordPromise: vi.fn(async (p) => void calls.push(`promise:${p.kind}`)),
    }
  }

  it('each through its own press, in order', async () => {
    const w = writers()
    const marcus = person('pecanvalley')
    await runFollowUpWrites(followUpCallWrites(marcus, marcus.items.slice(0, 2), '', '2026-10-08'), w)
    expect(w.calls).toEqual(['promise:insurance', 'promise:closeout', 'ask:company'])
    expect(w.logAsk).toHaveBeenCalledWith({ companyId: 'pecanvalley', inviteId: null, how: 'call', note: expect.stringMatching(/^Call about /), promisedBy: null })
  })

  it('the first refusal stops the rest and its words come back', async () => {
    const w = writers()
    w.recordPromise = vi.fn(() => Promise.reject(new Error('Say what they promised.')))
    const marcus = person('pecanvalley')
    await expect(runFollowUpWrites(followUpCallWrites(marcus, marcus.items.slice(0, 2), '', '2026-10-08'), w)).rejects.toThrow('Say what they promised.')
    expect(w.logAsk).not.toHaveBeenCalled()
  })
})

describe('the email from Click (B2b-viii-b)', () => {
  const company = { from: 'company', via: 'email', length: 'nudge' } as const
  const fromClick = 'Hello Marcus,\n\nClick Construction is following up on your insurance.\n\nEverything is in your portal: clicktooling.com/t/ABC\n\nThank you,\nClick Construction'

  it('carries only what the email says between its own greeting and sign-off', () => {
    expect(nudgeBody(fromClick)).toBe('Click Construction is following up on your insurance.')
    expect(nudgeLines('Hi Greg,\n\nOne thing.\n\n- The W-9. Could you send it?\n- Insurance. It ran out.\n\nThanks,\nRobert Douglas\nClick Construction')).toEqual([
      'One thing.',
      { items: ['The W-9. Could you send it?', 'Insurance. It ran out.'] },
    ])
    // What the reader typed in place of the draft is kept as typed.
    expect(nudgeLines('Could you call me today?')).toEqual(['Could you call me today?'])
  })

  it('asks gc-trade-email for a nudge to everyone who gets the kinds ticked, about the one job they share', () => {
    const s = initialGcState()
    const marcus = person('pecanvalley')
    const papers = marcus.items.filter((i) => i.kind === 'insurance' || i.kind === 'waiver')
    const req = followUpNudgeRequest(s, marcus, papers, 'Your papers', fromClick, false)
    expect(req).toMatchObject({ companyId: 'pecanvalley', kind: 'nudge', projectId: 'fairoaksd', lang: 'en', subject: 'Your papers', group: null, groups: ['pay'], lines: ['Click Construction is following up on your insurance.'] })
    expect(req && 'test' in req).toBe(false)
    const withSchedule = followUpNudgeRequest(s, marcus, marcus.items, 'Your papers', fromClick, true)
    expect(withSchedule?.groups).toEqual(['job', 'pay'])
    expect(withSchedule?.test).toBe(true)
    // A quote and the plans not opened, on a job we bid: the quotes people.
    const greg = person('hillside')
    expect(followUpNudgeRequest(s, greg, greg.items, 'Your quote', 'Any word?', false)).toMatchObject({ groups: ['quotes'] })
  })

  it('sends nothing for a customer, nothing ticked, or nothing to say', () => {
    const s = initialGcState()
    const elena = person('customer:cibolo')
    expect(followUpNudgeRequest(s, elena, elena.items, 'Payment', 'Any word?', false)).toBeNull()
    const marcus = person('pecanvalley')
    expect(followUpNudgeRequest(s, marcus, [], 'Papers', 'Any word?', false)).toBeNull()
    expect(followUpNudgeRequest(s, marcus, marcus.items, 'Papers', 'Hello Marcus,\n\nThank you,\nClick Construction', false)).toBeNull()
    expect(followUpNudgeRequest(s, marcus, marcus.items, '  ', 'Any word?', false)).toBeNull()
  })

  it('keys the email once a day for the same things, and again for other things', () => {
    const marcus = person('pecanvalley')
    const [a, b] = marcus.items
    expect(nudgeKey('2026-10-10', [a!, b!])).toBe(nudgeKey('2026-10-10', [b!, a!]))
    expect(nudgeKey('2026-10-10', [a!])).not.toBe(nudgeKey('2026-10-10', [a!, b!]))
    expect(nudgeKey('2026-10-11', [a!])).not.toBe(nudgeKey('2026-10-10', [a!]))
    expect(nudgeKey('2026-10-10', marcus.items).length).toBeLessThanOrEqual(200)
  })

  it('logs each line as a nudge from Click, once it went; a customer is never sent to from Click', () => {
    const greg = person('hillside')
    expect(followUpSentWrites(greg, greg.items.slice(0, 1), company, 'Hello Greg,\n\nAny word on the quote?\n\nThank you,\nClick Construction')).toEqual([
      { kind: 'ask', companyId: 'hillside', inviteId: greg.items[0]!.ask!.inviteId, how: 'nudge', note: 'From Click Construction: Any word on the quote?', promisedBy: null },
    ])
    const marcus = person('pecanvalley')
    const insurance = marcus.items.find((i) => i.kind === 'insurance')!
    expect(followUpSentWrites(marcus, [insurance], company, fromClick)).toEqual([
      { kind: 'company', companyId: 'pecanvalley', how: 'nudge', note: `From Click Construction: emailed about ${insurance.label.toLowerCase()}: Click Construction is following up on your insurance.` },
    ])
    const elena = person('customer:cibolo')
    expect(followUpSentWrites(elena, elena.items, company, 'Any word?')).toEqual([])
  })
})
