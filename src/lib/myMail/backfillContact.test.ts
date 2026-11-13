import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  addressesOf,
  addressVerdict,
  BACKFILL_CONTACT_WORDS,
  BACKFILL_TEAM_ROLES,
  contactTally,
  contactVerdict,
  filedUnderWords,
  inOfficeHours,
  partyCandidates,
  unnamedWords,
  type ContactBook,
  type ContactMail,
  type JobParty,
  type KnownContact,
  type OurSide,
} from './backfillContact'

// Every person, address and customer here is made up.
const ours: OurSide = {
  account: 'rosa@clickplumbing.example',
  team: new Set(['rosa@clickplumbing.example', 'dale@clickplumbing.example']),
  boxes: new Set(['bids@clickplumbing.example']),
  domains: new Set(['clickplumbing.example']),
}
const mail = (from: string, to: string[] = ['rosa@clickplumbing.example'], over: Partial<ContactMail> = {}): ContactMail => ({ from, to, cc: [], labels: ['INBOX'], ...over })
const dana: KnownContact = { id: 'c-dana', kind: 'customer', name: 'Dana Reyes', customerId: 'cu-dana' }
const party = (over: Partial<JobParty> = {}): JobParty => ({ customerId: 'cu-dana', role: 'customer', own: 'dana@reyes.example', others: ['billing@reyes.example'], hasContact: false, ...over })
const book = (held: Record<string, KnownContact[]> = {}, parties: JobParty[] = [party()]): ContactBook => ({ byAddress: new Map(Object.entries(held)), parties })

describe('the addresses a header names', () => {
  it('reads them in order, lower case, through a name with a comma in it', () => {
    expect(addressesOf('"Reyes, Dana" <Dana@Reyes.example>, kai@brandt.example')).toEqual(['dana@reyes.example', 'kai@brandt.example'])
    expect(addressesOf(['Dana Reyes <dana@reyes.example>', 'kai@brandt.example'])).toEqual(['dana@reyes.example', 'kai@brandt.example'])
    expect(addressesOf('')).toEqual([])
    expect(addressesOf(null)).toEqual([])
  })
})

describe('whose thread a mail’s line could land on (the tag’s own reading)', () => {
  it('lands a mail in on its sender', () => {
    expect(partyCandidates(mail('Dana Reyes <dana@reyes.example>'), ours)).toEqual(['dana@reyes.example'])
  })

  it('lands a mail of ours on the first person outside it was written to', () => {
    const m = mail('rosa@clickplumbing.example', ['dale@clickplumbing.example', 'dana@reyes.example', 'kai@brandt.example'], { labels: ['SENT'] })
    expect(partyCandidates(m, ours)).toEqual(['dana@reyes.example'])
    // A teammate's mail to a customer, found in this box with no Sent label, reads the same.
    expect(partyCandidates(mail('dale@clickplumbing.example', ['dana@reyes.example'], { cc: ['rosa@clickplumbing.example'] }), ours)).toEqual(['dana@reyes.example'])
  })

  it('lands a mail between teammates on its sender’s own thread', () => {
    expect(partyCandidates(mail('dale@clickplumbing.example', ['rosa@clickplumbing.example']), ours)).toEqual(['dale@clickplumbing.example'])
  })

  it('writes no line for a box’s own copy, a draft, Spam, Trash or a chat', () => {
    expect(partyCandidates(mail('bids@clickplumbing.example', ['dana@reyes.example']), ours)).toEqual([])
    for (const label of ['DRAFT', 'SPAM', 'TRASH', 'CHAT']) expect(partyCandidates(mail('dana@reyes.example', undefined, { labels: [label] }), ours)).toEqual([])
    expect(partyCandidates(mail(''), ours)).toEqual([])
  })

  it('keeps every reading of an address at our domain it cannot tell from a box or an alias', () => {
    // An unknown address of ours as the sender: the tag may land the line on it.
    expect(partyCandidates(mail('office@clickplumbing.example', ['dana@reyes.example']), ours)).toEqual(['office@clickplumbing.example'])
    // One before the customer on a mail of ours: either could be the line's party.
    const m = mail('rosa@clickplumbing.example', ['office@clickplumbing.example', 'dana@reyes.example'], { labels: ['SENT'] })
    expect(partyCandidates(m, ours)).toEqual(['office@clickplumbing.example', 'dana@reyes.example'])
    // Nobody outside for sure: the unclear one, or the sender's own thread.
    expect(partyCandidates(mail('rosa@clickplumbing.example', ['office@clickplumbing.example'], { labels: ['SENT'] }), ours)).toEqual(['office@clickplumbing.example', 'rosa@clickplumbing.example'])
  })

  it('reads a mail in the person’s Sent as theirs whatever address sent it', () => {
    // An alias, a send-as: the first person outside; with nobody outside, the person's own thread.
    expect(partyCandidates(mail('rosa.v@gmail.example', ['dana@reyes.example'], { labels: ['SENT'] }), ours)).toEqual(['dana@reyes.example'])
    expect(partyCandidates(mail('rosa.v@gmail.example', ['dale@clickplumbing.example'], { labels: ['SENT'] }), ours)).toEqual(['rosa@clickplumbing.example'])
  })
})

describe('who an address is filed under', () => {
  it('names the job’s customer, its GC, or another contact', () => {
    expect(addressVerdict('dana@reyes.example', book({ 'dana@reyes.example': [dana] }))).toEqual({ address: 'dana@reyes.example', named: true, name: 'Dana Reyes', kind: 'customer', relation: 'the job’s customer' })
    const gc = book({ 'pm@harbor.example': [{ id: 'c-gc', kind: 'customer', name: 'Harbor Builders', customerId: 'cu-harbor' }] }, [party(), party({ customerId: 'cu-harbor', role: 'gc', own: 'pm@harbor.example', others: [] })])
    expect(addressVerdict('pm@harbor.example', gc)).toMatchObject({ named: true, relation: 'the job’s GC' })
    expect(addressVerdict('kai@brandt.example', book({ 'kai@brandt.example': [{ id: 'c-kai', kind: 'trade_partner', name: '', customerId: null }] }))).toMatchObject({ named: true, name: 'kai@brandt.example', relation: 'a contact' })
  })

  it('holds an address an unnamed sender already holds, even beside a named contact', () => {
    const b = book({ 'dana@reyes.example': [dana, { id: 'c-x', kind: 'unknown', name: 'dana@reyes.example', customerId: null }] })
    expect(addressVerdict('dana@reyes.example', b)).toEqual({ address: 'dana@reyes.example', named: false, reason: 'whoIsThis', customerId: null })
  })

  it('tells the customer with no contact yet from an address nothing would put on their contact', () => {
    // The address contact_for_customer copies, and no contact made: one press names them.
    expect(addressVerdict('dana@reyes.example', book())).toEqual({ address: 'dana@reyes.example', named: false, reason: 'customerNoContact', customerId: 'cu-dana' })
    // The contact is made already and does not hold it: the press would add nothing.
    expect(addressVerdict('dana@reyes.example', book({}, [party({ hasContact: true })]))).toMatchObject({ reason: 'onRecordNoContact', customerId: 'cu-dana' })
    // A billing address or a person at the customer: on the record, on no contact.
    expect(addressVerdict('billing@reyes.example', book())).toMatchObject({ reason: 'onRecordNoContact', customerId: 'cu-dana' })
    expect(addressVerdict('nobody@elsewhere.example', book())).toEqual({ address: 'nobody@elsewhere.example', named: false, reason: 'stranger', customerId: null })
  })
})

describe('the contact step for a conversation', () => {
  const named = book({ 'dana@reyes.example': [dana], 'dale@clickplumbing.example': [{ id: 'c-dale', kind: 'team', name: 'Dale Okafor', customerId: null }] })

  it('is named when every line lands on a named contact, each once', () => {
    const v = contactVerdict([mail('dana@reyes.example'), mail('rosa@clickplumbing.example', ['dana@reyes.example'], { labels: ['SENT'] }), mail('dale@clickplumbing.example')], ours, named)
    expect(v.kind).toBe('named')
    expect(filedUnderWords(v.under)).toBe('Dana Reyes (the job’s customer) · Dale Okafor (a contact)')
  })

  it('holds the whole conversation for one sender nobody can name, and says the hardest reason', () => {
    const v = contactVerdict([mail('dana@reyes.example'), mail('nobody@elsewhere.example')], ours, book())
    expect(v).toMatchObject({ kind: 'held', reason: 'stranger', why: BACKFILL_CONTACT_WORDS.stranger.why, door: BACKFILL_CONTACT_WORDS.stranger.door })
    if (v.kind !== 'held') throw new Error('held')
    expect(v.unnamed.map((u) => u.reason)).toEqual(['customerNoContact', 'stranger'])
    expect(unnamedWords(v.unnamed)).toBe(
      'dana@reyes.example: The sender is the customer, and the customer has no contact yet. · nobody@elsewhere.example: Nobody the app knows holds the sender’s address.',
    )
  })

  it('holds a customer with no contact for the one press that makes it', () => {
    const v = contactVerdict([mail('dana@reyes.example')], ours, book())
    expect(v).toMatchObject({ kind: 'held', reason: 'customerNoContact' })
    expect(BACKFILL_CONTACT_WORDS.customerNoContact.door).toContain('speech bubble')
  })

  it('tells an address of ours with no contact from a stranger', () => {
    // A teammate nobody has a thread with, or an address at our domain the run cannot place.
    const v = contactVerdict([mail('dale@clickplumbing.example'), mail('office@clickplumbing.example', ['dana@reyes.example'])], ours, book({ 'dana@reyes.example': [dana] }))
    expect(v).toMatchObject({ kind: 'held', reason: 'oursNoContact' })
    if (v.kind !== 'held') throw new Error('held')
    expect(v.unnamed.map((u) => [u.address, u.reason])).toEqual([
      ['dale@clickplumbing.example', 'oursNoContact'],
      ['office@clickplumbing.example', 'oursNoContact'],
    ])
    // A stranger beside it is the harder reason.
    expect(contactVerdict([mail('dale@clickplumbing.example'), mail('nobody@elsewhere.example')], ours, book())).toMatchObject({ reason: 'stranger' })
  })

  it('is named with nothing to write: no line, no sender', () => {
    expect(contactVerdict([mail('dana@reyes.example', undefined, { labels: ['TRASH'] })], ours, book())).toEqual({ kind: 'named', under: [] })
  })

  it('counts the named, the held by reason, and what one press a customer would name', () => {
    const one = contactVerdict([mail('dana@reyes.example')], ours, book())
    const t = contactTally([contactVerdict([mail('dana@reyes.example')], ours, named), one, one, contactVerdict([mail('nobody@elsewhere.example')], ours, book())])
    expect(t).toEqual({ named: 1, held: 3, by: { customerNoContact: 2, stranger: 1 }, onePress: { customers: 1, conversations: 2 } })
  })
})

describe('the team, as the tag reads it', () => {
  it('is the same roles gmail-mine’s loadTeam reads', () => {
    const fn = readFileSync('supabase/functions/gmail-mine/index.ts', 'utf8')
    const m = /const STAFF_ROLES = \[([^\]]+)\]/.exec(fn)
    expect(m).not.toBeNull()
    expect(m![1]!.split(',').map((s) => s.trim().replace(/'/g, ''))).toEqual([...BACKFILL_TEAM_ROLES])
  })
})

describe('office hours, Central time', () => {
  it('is Monday to Saturday, six in the morning to seven at night', () => {
    // 2026-11-13 is a Friday; Central is UTC−6 in November.
    expect(inOfficeHours(new Date('2026-11-13T12:00:00Z'))).toBe(true) // 6:00 am Friday
    expect(inOfficeHours(new Date('2026-11-13T11:59:00Z'))).toBe(false) // 5:59 am Friday
    expect(inOfficeHours(new Date('2026-11-14T00:59:00Z'))).toBe(true) // 6:59 pm Friday
    expect(inOfficeHours(new Date('2026-11-14T01:00:00Z'))).toBe(false) // 7:00 pm Friday
    expect(inOfficeHours(new Date('2026-11-14T18:00:00Z'))).toBe(true) // noon Saturday
    expect(inOfficeHours(new Date('2026-11-15T18:00:00Z'))).toBe(false) // noon Sunday
    // Summer time: Central is UTC−5 in July. 2026-07-15 is a Wednesday.
    expect(inOfficeHours(new Date('2026-07-15T11:00:00Z'))).toBe(true) // 6:00 am
    expect(inOfficeHours(new Date('2026-07-15T10:59:00Z'))).toBe(false)
  })
})
