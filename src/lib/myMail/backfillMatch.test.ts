import { describe, expect, it } from 'vitest'
import {
  BACKFILL_FENCE_DAYS,
  BACKFILL_WORDS,
  backfillTally,
  backfillVerdict,
  conversationsOf,
  holdCrowdedJobs,
  namesStreet,
  ONLY_JOB_MAX,
  parseAddressList,
  streetOf,
  type BackfillConversation,
  type BackfillFacts,
  type BackfillJob,
  type BackfillMail,
} from './backfillMatch'

// Every person, company, address and job here is made up.
const OURS = parseAddressList('@clickplumbing.example\nbids@clickplumbing.example')
const NEVER = parseAddressList('# counsel and money\n@harlanlaw.example\npayroll@paywell.example\n')

const job = (key: string, over: Partial<BackfillJob> = {}): BackfillJob => ({
  key: `pipeline:${key}`,
  labels: [],
  name: 'Water heater swap',
  address: null,
  customerIds: [],
  startsAt: '2026-06-01T12:00:00Z',
  ...over,
})

const ELM = job('elm', { labels: ['JP1077'], name: 'Elm Court rough-in', address: '4 Elm Ct, Austin, TX 78701', customerIds: ['ridgeway'] })
const OAK = job('oak', { labels: ['JP1090'], name: 'Oak Hollow remodel', address: '212 N Oak Hollow Dr, Austin, TX', customerIds: ['ridgeway'] })
const DOCK = job('dock', { labels: ['JP1101'], name: 'Dock 3 floor drain', address: '12925 FM 20, Kingsbury, TX', customerIds: ['harlan'] })

const facts = (over: Partial<BackfillFacts> = {}): BackfillFacts => ({
  jobs: [ELM, OAK, DOCK],
  targets: new Set([ELM.key, OAK.key, DOCK.key]),
  customers: [
    { id: 'ridgeway', addresses: ['dale@ridgewaybuilders.example'] },
    { id: 'harlan', addresses: ['permits@harlanfreight.example'] },
    { id: 'vega', addresses: ['fixture.homeowner@gmail.com'] },
  ],
  ours: OURS,
  neverTag: NEVER,
  ...over,
})

const mail = (over: Partial<BackfillMail> = {}): BackfillMail => ({
  from: 'Dale Okafor <dale@ridgewaybuilders.example>',
  to: ['rosa@clickplumbing.example'],
  cc: [],
  subject: 'Schedule',
  snippet: 'Can you come Tuesday?',
  date: '2026-08-10T15:00:00Z',
  labels: ['INBOX'],
  ...over,
})
const conv = (...mails: BackfillMail[]): BackfillConversation => ({ account: 'rosa@clickplumbing.example', threadId: 't1', mails })

describe('the street an address names', () => {
  it('takes the number and the first word, drops a direction, keeps a route with its number', () => {
    expect(streetOf('4 Elm Ct, Austin, TX 78701')).toEqual({ number: '4', name: 'Elm' })
    expect(streetOf('212 N Oak Hollow Dr, Austin, TX')).toEqual({ number: '212', name: 'Oak' })
    expect(streetOf('12925 FM 20, Kingsbury, TX')).toEqual({ number: '12925', name: 'FM 20' })
    expect(streetOf('5501 Balcones Dr A141, Austin TX')).toEqual({ number: '5501', name: 'Balcones' })
    expect(streetOf('1200 W. 5th St')).toEqual({ number: '1200', name: '5th' })
  })

  it('names nothing for an address with no house number, or a name too short to be a street', () => {
    expect(streetOf('Elm Court, Austin')).toBeNull()
    expect(streetOf('12 A St')).toBeNull()
    expect(streetOf(null)).toBeNull()
    expect(streetOf('')).toBeNull()
  })

  it('is named by words that hold the number, an optional direction, then the name, each standing alone', () => {
    const oak = streetOf(OAK.address)!
    expect(namesStreet('Re: 212 Oak Hollow punch list', oak)).toBe(true)
    expect(namesStreet('the valve at 212 North Oak Hollow', oak)).toBe(true)
    expect(namesStreet('212 n. oak hollow', oak)).toBe(true)
    expect(namesStreet('1212 Oak Hollow', oak)).toBe(false)
    expect(namesStreet('212 Oakmont', oak)).toBe(false)
    expect(namesStreet('Invoice 212, Oak Hollow', oak)).toBe(false)
    expect(namesStreet('site is 12925 FM 20 past the gate', streetOf(DOCK.address)!)).toBe(true)
    expect(namesStreet('12925 FM 2001', streetOf(DOCK.address)!)).toBe(false)
  })
})

describe('the office’s address list', () => {
  it('reads addresses and domains a line, and leaves comments and blanks out', () => {
    const list = parseAddressList('# who is never filed\n@HarlanLaw.example\npayroll@paywell.example  # the payroll desk\n\nfirstbank.example\n')
    expect([...list.domains].sort()).toEqual(['firstbank.example', 'harlanlaw.example'])
    expect([...list.addresses]).toEqual(['payroll@paywell.example'])
  })
})

describe('which job a conversation belongs to', () => {
  it('is sure when a subject names the job’s number', () => {
    expect(backfillVerdict(conv(mail({ subject: 'RE: JP1090 fixture count' })), facts())).toEqual({ kind: 'sure', jobKey: OAK.key, rule: 'subject', why: BACKFILL_WORDS.subject })
  })

  it('is sure when the words name the job’s street and the other party is on the job', () => {
    const v = backfillVerdict(conv(mail({ subject: 'Rough-in dates', snippet: 'We can start at 4 Elm Ct on the 9th.' })), facts())
    expect(v).toMatchObject({ kind: 'sure', jobKey: ELM.key, rule: 'street' })
  })

  it('takes a street the search found in the mail’s whole words, when the subject and first words do not hold it', () => {
    const deep = { ...conv(mail({ subject: 'Rough-in dates', snippet: 'Hi Rosa, a few things below.' })), streetJobs: [ELM.key] }
    expect(backfillVerdict(deep, facts())).toMatchObject({ kind: 'sure', jobKey: ELM.key, rule: 'street' })
    // Found for two jobs: held, as two named jobs are.
    expect(backfillVerdict({ ...deep, streetJobs: [ELM.key, OAK.key] }, facts())).toMatchObject({ kind: 'held', reason: 'twoJobsNamed' })
    // Found, and nobody on the job is on the mail: still a person's to place.
    const stranger = { ...conv(mail({ from: 'someone@elsewhere.example', subject: 'Parking' })), streetJobs: [ELM.key] }
    expect(backfillVerdict(stranger, facts())).toMatchObject({ kind: 'held', reason: 'streetUnknownParty' })
  })

  it('holds a street that nobody on the job is on the mail for', () => {
    const stranger = mail({ from: 'someone@elsewhere.example', subject: 'Parking at 4 Elm Ct' })
    expect(backfillVerdict(conv(stranger), facts())).toEqual({ kind: 'held', reason: 'streetUnknownParty', jobKeys: [ELM.key], why: BACKFILL_WORDS.streetUnknownParty })
  })

  it('is sure when the other party’s customer has exactly one job the mail’s date covers', () => {
    const v = backfillVerdict(conv(mail({ from: 'permits@harlanfreight.example', subject: 'Following up' })), facts())
    expect(v).toEqual({ kind: 'sure', jobKey: DOCK.key, rule: 'onlyJob', why: BACKFILL_WORDS.onlyJob })
  })

  it('holds a mail from someone else at the customer’s company, and files it once it names the street', () => {
    const colleague = mail({ from: 'ann@harlanfreight.example', subject: 'Following up' })
    expect(backfillVerdict(conv(colleague), facts())).toEqual({ kind: 'held', reason: 'companyOnly', jobKeys: [DOCK.key], why: BACKFILL_WORDS.companyOnly })
    const named = mail({ from: 'ann@harlanfreight.example', subject: 'Gate code', snippet: 'for 12925 FM 20' })
    expect(backfillVerdict(conv(named), facts())).toMatchObject({ kind: 'sure', jobKey: DOCK.key, rule: 'street' })
  })

  it('holds a one-job customer who also has a bid or a project', () => {
    const v = backfillVerdict(conv(mail({ from: 'permits@harlanfreight.example', subject: 'Following up' })), facts({ busyCustomers: new Set(['harlan']) }))
    expect(v).toEqual({ kind: 'held', reason: 'alsoBids', jobKeys: [DOCK.key], why: BACKFILL_WORDS.alsoBids })
    const numbered = mail({ from: 'permits@harlanfreight.example', subject: 'JP1101 drain' })
    expect(backfillVerdict(conv(numbered), facts({ busyCustomers: new Set(['harlan']) }))).toMatchObject({ kind: 'sure', rule: 'subject' })
  })

  it('never takes an open mail service’s domain as a company', () => {
    const gmail = mail({ from: 'fixture.stranger@gmail.com', subject: 'Following up' })
    expect(backfillVerdict(conv(gmail), facts({ jobs: [job('vega', { customerIds: ['vega'] })], targets: new Set(['pipeline:vega']) }))).toMatchObject({ kind: 'out', reason: 'noJob' })
  })

  it('holds a customer with several jobs when the mail names none', () => {
    expect(backfillVerdict(conv(mail()), facts())).toEqual({ kind: 'held', reason: 'severalJobs', jobKeys: [ELM.key, OAK.key], why: BACKFILL_WORDS.severalJobs })
  })

  it('counts a customer’s past jobs too: one open job is not the only job', () => {
    const paid = job('paid', { customerIds: ['harlan'], startsAt: '2025-01-05T12:00:00Z' })
    const v = backfillVerdict(conv(mail({ from: 'permits@harlanfreight.example' })), facts({ jobs: [ELM, OAK, DOCK, paid] }))
    expect(v).toMatchObject({ kind: 'held', reason: 'severalJobs', jobKeys: [DOCK.key, paid.key].sort() })
  })

  it('holds a mail that names two jobs', () => {
    const both = conv(mail({ subject: 'JP1077 and JP1090 invoices' }), mail({ subject: 'Re: JP1090', snippet: 'and the valve at 4 Elm Ct' }))
    expect(backfillVerdict(both, facts())).toMatchObject({ kind: 'held', reason: 'twoJobsNamed', jobKeys: [ELM.key, OAK.key] })
  })

  it('files on the job a subject numbers when other jobs share its street, and holds a street they share alone', () => {
    const rough = job('rough', { labels: ['JP2001'], address: '9 Birch Ln, Austin', customerIds: ['ridgeway'] })
    const top = job('top', { labels: ['JP2002'], address: '9 Birch Lane, Austin', customerIds: ['ridgeway'] })
    const f = facts({ jobs: [rough, top, ELM], targets: new Set([rough.key, top.key, ELM.key]) })
    const numbered = conv(mail({ subject: 'JP2002 top-out', snippet: 'at 9 Birch Ln tomorrow' }))
    expect(backfillVerdict(numbered, f)).toMatchObject({ kind: 'sure', jobKey: top.key, rule: 'subject' })
    const street = conv(mail({ subject: 'Tomorrow', snippet: 'at 9 Birch Ln' }))
    expect(backfillVerdict(street, f)).toEqual({ kind: 'held', reason: 'sameStreet', jobKeys: [rough.key, top.key].sort(), why: BACKFILL_WORDS.sameStreet })
    // A number for one job and another job's street: two jobs named.
    const mixed = conv(mail({ subject: 'JP2002 top-out', snippet: 'and the valve at 4 Elm Ct' }))
    expect(backfillVerdict(mixed, f)).toMatchObject({ kind: 'held', reason: 'twoJobsNamed' })
  })

  it('tells two jobs at one street apart by their dates, and holds them when it cannot', () => {
    const first = job('first', { address: '4 Elm Ct, Austin', customerIds: ['ridgeway'], startsAt: '2025-01-10T12:00:00Z' })
    const second = job('second', { address: '4 Elm Court, Austin', customerIds: ['ridgeway'], startsAt: '2026-06-01T12:00:00Z' })
    const f = facts({ jobs: [first, second], targets: new Set([first.key, second.key]) })
    const early = conv(mail({ snippet: 'at 4 Elm Ct', date: '2025-02-01T15:00:00Z' }))
    expect(backfillVerdict(early, f)).toMatchObject({ kind: 'sure', jobKey: first.key, rule: 'street' })
    const late = conv(mail({ snippet: 'at 4 Elm Ct', date: '2026-08-01T15:00:00Z' }))
    expect(backfillVerdict(late, f)).toMatchObject({ kind: 'held', reason: 'sameStreet' })
  })

  it('leaves out a mail older than the only job it could be, past the fence', () => {
    expect(BACKFILL_FENCE_DAYS).toBe(90)
    const old = conv(mail({ from: 'permits@harlanfreight.example', date: '2026-01-15T15:00:00Z' }))
    expect(backfillVerdict(old, facts())).toEqual({ kind: 'out', reason: 'beforeTheJob', why: BACKFILL_WORDS.beforeTheJob })
    const inside = conv(mail({ from: 'permits@harlanfreight.example', date: '2026-03-20T15:00:00Z' }))
    expect(backfillVerdict(inside, facts())).toMatchObject({ kind: 'sure', jobKey: DOCK.key })
  })

  it('leaves out a conversation with nobody outside the company on it', () => {
    const inside = mail({ from: 'rosa@clickplumbing.example', to: ['marisol@clickplumbing.example'], cc: ['bids@clickplumbing.example'], subject: 'JP1077 notes' })
    expect(backfillVerdict(conv(inside), facts())).toMatchObject({ kind: 'out', reason: 'noOutsideParty' })
  })

  it('leaves out anything with a never-tag address or domain on it, whatever it names', () => {
    const counsel = mail({ subject: 'JP1077 lien', cc: ['Pat Harlan <pat@harlanlaw.example>'] })
    expect(backfillVerdict(conv(counsel), facts())).toMatchObject({ kind: 'out', reason: 'neverTag' })
    const payroll = mail({ to: ['rosa@clickplumbing.example', 'payroll@paywell.example'], subject: 'JP1077' })
    expect(backfillVerdict(conv(payroll), facts())).toMatchObject({ kind: 'out', reason: 'neverTag' })
  })

  it('leaves out a conversation whose every mail sits under a label that is never filed', () => {
    expect(backfillVerdict(conv(mail({ subject: 'JP1077 sale', labels: ['CATEGORY_PROMOTIONS'] })), facts())).toMatchObject({ kind: 'out', reason: 'leftOutLabel' })
    expect(backfillVerdict(conv(mail({ subject: 'JP1077', labels: ['CATEGORY_PROMOTIONS'] }), mail({ subject: 'Re: JP1077' })), facts())).toMatchObject({ kind: 'sure' })
  })

  it('leaves out a party nobody knows when nothing is named', () => {
    expect(backfillVerdict(conv(mail({ from: 'someone@elsewhere.example' })), facts())).toMatchObject({ kind: 'out', reason: 'noJob' })
  })

  it('counts a sure match to a job this run does not file onto, and files nothing', () => {
    const v = backfillVerdict(conv(mail({ subject: 'JP1090 fixture count' })), facts({ targets: new Set([ELM.key]) }))
    expect(v).toEqual({ kind: 'out', reason: 'notThisRun', why: BACKFILL_WORDS.notThisRun, jobKey: OAK.key })
  })

  it('reads a display name around an address, and an address in any case', () => {
    const v = backfillVerdict(conv(mail({ from: '"Permits Desk" <Permits@HarlanFreight.example>', subject: 'Hello' })), facts())
    expect(v).toMatchObject({ kind: 'sure', jobKey: DOCK.key })
  })
})

describe('a job that takes too many by the one-job rule', () => {
  it('holds them all for a person, and lets a subject’s or a street’s match stand', () => {
    expect(ONLY_JOB_MAX).toBe(40)
    const only = { kind: 'sure' as const, jobKey: DOCK.key, rule: 'onlyJob' as const, why: BACKFILL_WORDS.onlyJob }
    const named = { kind: 'sure' as const, jobKey: DOCK.key, rule: 'subject' as const, why: BACKFILL_WORDS.subject }
    const other = { kind: 'sure' as const, jobKey: ELM.key, rule: 'onlyJob' as const, why: BACKFILL_WORDS.onlyJob }
    const out = holdCrowdedJobs([only, only, only, named, other], 2)
    expect(out.map((v) => (v.kind === 'sure' ? v.rule : v.kind === 'held' ? v.reason : v.kind))).toEqual(['crowdedJob', 'crowdedJob', 'crowdedJob', 'subject', 'onlyJob'])
    expect(out[0]).toEqual({ kind: 'held', reason: 'crowdedJob', jobKeys: [DOCK.key], why: BACKFILL_WORDS.crowdedJob })
    expect(holdCrowdedJobs([only, only], 2)).toEqual([only, only])
  })
})

describe('the conversations and the count', () => {
  it('groups hits by mailbox and thread, oldest first, and tallies the verdicts', () => {
    const hit = (account: string, threadId: string, date: string, subject: string) => ({ account, threadId, ...mail({ date, subject }) })
    const convs = conversationsOf([
      hit('rosa@clickplumbing.example', 't1', '2026-08-12T15:00:00Z', 'Re: JP1077'),
      hit('rosa@clickplumbing.example', 't1', '2026-08-10T15:00:00Z', 'JP1077'),
      hit('marisol@clickplumbing.example', 't1', '2026-08-10T15:00:00Z', 'JP1077'),
      hit('rosa@clickplumbing.example', 't2', '2026-08-11T15:00:00Z', 'Schedule'),
    ])
    expect(convs.map((c) => [c.account.split('@')[0], c.threadId, c.mails.map((m) => m.subject)])).toEqual([
      ['rosa', 't1', ['JP1077', 'Re: JP1077']],
      ['marisol', 't1', ['JP1077']],
      ['rosa', 't2', ['Schedule']],
    ])
    expect(backfillTally(convs.map((c) => backfillVerdict(c, facts())))).toEqual({ sure: 2, held: 1, out: 0, by: { subject: 2, severalJobs: 1 } })
    // A hit a street search found keeps the job on its conversation, whichever of its mails it was.
    const found = conversationsOf([hit('rosa@clickplumbing.example', 't9', '2026-08-10T15:00:00Z', 'Dates'), { ...hit('rosa@clickplumbing.example', 't9', '2026-08-11T15:00:00Z', 'Re: Dates'), streetJobs: [OAK.key] }])
    expect(found).toHaveLength(1)
    expect(found[0]!.streetJobs).toEqual([OAK.key])
    expect(convs[0]!.streetJobs).toBeUndefined()
  })
})
