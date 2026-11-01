import { describe, expect, it } from 'vitest'
import { emailFileRows, KEEP_FILE_BYTES } from '../emailIn/emailLine'
import type { EmailFile, EmailIn, GmailPart } from '../emailIn/gmailMessage'
import { GC_OFFICE_TEAM } from '../gc/access'
import { buildLedgerPrefixMap } from '../ledgerDisplayPrefixes'
import { plainWordsFailures } from '../plainWords'
import { MY_MAIL_REFUSAL_WORDS, type MyMailJobChip, type MyMailRow } from './contract'
import { orFilter } from './gmailMineFakes'
import { guessJob } from './mailGuess'
import {
  bidIsOpen,
  columnNotPushed,
  contactJobsOf,
  contactsByAddress,
  customerOpenJobs,
  domainCustomers,
  domainFilter,
  fencedQuery,
  filledRow,
  FOLLOW_ROWS_PER_RUN,
  FOLLOW_WINDOW_DAYS,
  followPeople,
  followSince,
  followWindow,
  gcProjectIsOpen,
  gmailRefusal,
  isFollowRequest,
  knownLines,
  MY_MAIL_EML_MIME,
  MY_MAIL_FOLLOW_GONE,
  MY_MAIL_HTML_MAX,
  MY_MAIL_OFFICE_ROLES,
  MY_MAIL_QUERY_MAX,
  MY_MAIL_REFUSAL_STATUS,
  myMailAddressKey,
  myMailBodyHtml,
  myMailEmlPath,
  myMailFileList,
  myMailFilePath,
  myMailFileRow,
  myMailGuessAsks,
  myMailGuessFacts,
  myMailJobs,
  myMailLineRow,
  myMailOurDomains,
  myMailParties,
  myMailQuery,
  myMailTagEventKey,
  myMailTagEventRow,
  myMailTagEventWords,
  myMailTeam,
  neverRead,
  parseMyMailRequest,
  pipelineIsOpen,
  planFollow,
  planUntag,
  safeFileName,
  stoppedRefusal,
  tagRowJob,
  tokenRefusal,
  wantsGuess,
  type MyMailFollowLine,
  type MyMailFollowUserRow,
  type MyMailPageFacts,
  type MyMailPipelineRow,
} from './mineFunction'
import { planTag, type MyMailTagStep } from './tagPlan'

// Made-up people and jobs: Marisol Vega (the estimator whose box it is), Dale Okafor at Ridgeway Builders (4 Elm Ct,
// JP1077), Priya Nair at the Cedar Bend HOA (the clubhouse bid, BP523), the Harbor clinic GC project (#42).
const MARISOL = 'u-marisol'
const ELM = '0f6c1a3e-2b4d-4e8f-9a1b-1c2d3e4f5a01'
const HARBOR = '0f6c1a3e-2b4d-4e8f-9a1b-1c2d3e4f5a02'
const CLUB = '0f6c1a3e-2b4d-4e8f-9a1b-1c2d3e4f5a03'
const CLINIC = '0f6c1a3e-2b4d-4e8f-9a1b-1c2d3e4f5a04'
const prefixes = buildLedgerPrefixMap([{ id: 'st-plumb', ledger_job_prefix: 'JP', ledger_bid_prefix: 'BP' }])

const pipeline = (id: string, hcp: string, name: string, over: Partial<MyMailPipelineRow> = {}): MyMailPipelineRow => ({
  id,
  hcp_number: hcp,
  click_number: '',
  job_name: name,
  service_type_id: 'st-plumb',
  status: 'working',
  customer_id: 'cust-ridgeway',
  gc_customer_id: null,
  ...over,
})

const row = (gmailId: string, over: Partial<MyMailRow> = {}): MyMailRow => ({
  gmailId,
  threadId: `t-${gmailId}`,
  direction: 'in',
  who: { name: 'Dale Okafor', address: 'dale@ridgeway.example' },
  subject: 'Thursday',
  snippet: '',
  at: '2026-11-01T15:12:00.000Z',
  files: 0,
  folded: null,
  tagged: null,
  guess: null,
  inMessages: null,
  ...over,
})

describe('parseMyMailRequest: what the tab may ask', () => {
  it('reads a list, To tag when no view is named, the search trimmed and the labels once each in Gmail’s order', () => {
    expect(parseMyMailRequest({ action: 'list' })).toEqual({ action: 'list', view: 'toTag' })
    expect(parseMyMailRequest({ action: 'list', view: 'all', q: '  from:dale  ', pageToken: '0589483613', labels: ['SENT', 'INBOX', 'SENT'] })).toEqual({
      action: 'list',
      view: 'all',
      q: 'from:dale',
      pageToken: '0589483613',
      labels: ['INBOX', 'SENT'],
    })
    expect(parseMyMailRequest({ action: 'list', view: 'tagged', labels: [], q: '', pageToken: null })).toEqual({ action: 'list', view: 'tagged' })
  })

  it('refuses a list it cannot read: a view, a label or a page token it does not know, a search too long', () => {
    expect(parseMyMailRequest({ action: 'list', view: 'inbox' })).toBeNull()
    expect(parseMyMailRequest({ action: 'list', labels: ['DRAFT'] })).toBeNull()
    expect(parseMyMailRequest({ action: 'list', labels: 'INBOX' })).toBeNull()
    expect(parseMyMailRequest({ action: 'list', pageToken: '../../x' })).toBeNull()
    expect(parseMyMailRequest({ action: 'list', q: 42 })).toBeNull()
    expect(parseMyMailRequest({ action: 'list', q: 'x'.repeat(MY_MAIL_QUERY_MAX + 1) })).toBeNull()
  })

  it('reads an open, a tag and an untag by Gmail’s ids alone, and a job by its kind and uuid, lower-case', () => {
    expect(parseMyMailRequest({ action: 'open', gmailId: '18c2f0a9b3d4e5f6' })).toEqual({ action: 'open', gmailId: '18c2f0a9b3d4e5f6' })
    expect(parseMyMailRequest({ action: 'tag', threadId: '18c2f0a9b3d4e5f6', job: { kind: 'pipeline', id: ELM.toUpperCase() } })).toEqual({
      action: 'tag',
      threadId: '18c2f0a9b3d4e5f6',
      job: { kind: 'pipeline', id: ELM },
    })
    expect(parseMyMailRequest({ action: 'untag', threadId: '18c2f0a9b3d4e5f6' })).toEqual({ action: 'untag', threadId: '18c2f0a9b3d4e5f6' })
  })

  it('refuses an id that is not Gmail’s, a job that is not one, an action it does not know, and no body at all', () => {
    expect(parseMyMailRequest({ action: 'open', gmailId: 'a/b' })).toBeNull()
    expect(parseMyMailRequest({ action: 'open' })).toBeNull()
    expect(parseMyMailRequest({ action: 'tag', threadId: 't1', job: { kind: 'customer', id: ELM } })).toBeNull()
    expect(parseMyMailRequest({ action: 'tag', threadId: 't1', job: { kind: 'bid', id: 'BP523' } })).toBeNull()
    expect(parseMyMailRequest({ action: 'tag', threadId: 't1' })).toBeNull()
    expect(parseMyMailRequest({ action: 'untag', threadId: '' })).toBeNull()
    expect(parseMyMailRequest({ action: 'delete', threadId: 't1' })).toBeNull()
    expect(parseMyMailRequest(null)).toBeNull()
    expect(parseMyMailRequest('list')).toBeNull()
  })
})

describe('myMailQuery: the Gmail search a page reads', () => {
  const FENCE = '-in:drafts -in:spam -in:trash -in:chats'

  it('reads the Inbox and Sent, never Drafts, Spam, Trash or Chats, and To tag leaves out what a tag labelled', () => {
    expect(myMailQuery({ view: 'toTag' })).toBe(`(in:inbox OR in:sent) ${FENCE} -label:"Tagged in ClickTooling"`)
    expect(myMailQuery({ view: 'all' })).toBe(`(in:inbox OR in:sent) ${FENCE}`)
    expect(myMailQuery({ view: 'tagged' })).toBe(`(in:inbox OR in:sent) ${FENCE} label:"Tagged in ClickTooling"`)
  })

  it('reads one box when one is asked for, and leaves out each label the person named, once, its quotes dropped', () => {
    expect(myMailQuery({ view: 'all', labels: ['SENT'], hidden: ['Personal', ' personal ', 'Kids "soccer"', '  '] })).toBe(`in:sent ${FENCE} -label:"Personal" -label:"Kids soccer"`)
  })

  it('puts the person’s own search in a group of its own, so it can never reach past the fence', () => {
    expect(myMailQuery({ view: 'all', q: 'from:dale OR from:priya' })).toBe(`(in:inbox OR in:sent) ${FENCE} (from:dale OR from:priya)`)
    expect(fencedQuery('x) OR (in:drafts')).toBe('(x OR in:drafts)')
    expect(fencedQuery('{in:drafts in:spam}')).toBe('(in:drafts in:spam)')
    expect(fencedQuery('subject:"water heater"')).toBe('(subject:"water heater")')
    expect(fencedQuery('"water heater')).toBe('(water heater)')
    expect(fencedQuery(' ( ) ')).toBe('')
  })

  it('knows a draft, a mail in Spam or Trash and a chat by their labels', () => {
    expect(neverRead(['INBOX', 'CATEGORY_PERSONAL'])).toBe(false)
    expect(neverRead(['SENT', 'DRAFT'])).toBe(true)
    expect(neverRead(['SPAM'])).toBe(true)
    expect(neverRead(['TRASH'])).toBe(true)
    expect(neverRead(['CHAT'])).toBe(true)
    expect(neverRead(['toString'])).toBe(false)
    expect(neverRead(undefined)).toBe(false)
  })
})

describe('the refusals: their statuses and their words', () => {
  it('gives every refusal its status', () => {
    expect(Object.keys(MY_MAIL_REFUSAL_STATUS).sort()).toEqual(Object.keys(MY_MAIL_REFUSAL_WORDS).sort())
    expect(MY_MAIL_REFUSAL_STATUS).toMatchObject({ signIn: 401, readOnly: 403, officeOnly: 403, off: 403, imitated: 403, offWorkspace: 403, badRequest: 400, notFound: 404, google: 502 })
  })

  it('reads an address Google will not hand the app as off the Workspace, with Google’s reason after ours', () => {
    const r = tokenRefusal('Google token exchange failed (401): Client is unauthorized to retrieve access tokens using this method, or client not authorized for any of the scopes requested.')
    expect(r).toEqual({
      ok: false,
      error: 'offWorkspace',
      words: `${MY_MAIL_REFUSAL_WORDS.offWorkspace} Google said: Client is unauthorized to retrieve access tokens using this method, or client not authorized for any of the scopes requested.`,
    })
    expect(tokenRefusal('Google token exchange failed (400): Invalid email or User ID')).toMatchObject({ error: 'offWorkspace', words: `${MY_MAIL_REFUSAL_WORDS.offWorkspace} Google said: Invalid email or User ID.` })
    expect(tokenRefusal('Google token exchange failed (403): admin_policy_enforced').error).toBe('offWorkspace')
  })

  it('reads any other failure at the token step as Google’s own', () => {
    expect(tokenRefusal('Google token exchange failed (503): backendError')).toEqual({ ok: false, error: 'google', words: `${MY_MAIL_REFUSAL_WORDS.google} Google said: backendError.` })
    expect(tokenRefusal('error sending request for url (https://oauth2.googleapis.com/token)')).toMatchObject({ error: 'google', words: `${MY_MAIL_REFUSAL_WORDS.google} The reason: error sending request for url (https://oauth2.googleapis.com/token).` })
  })

  it('reads a mail Gmail no longer has as not there, and any other Gmail failure as Google’s, with Gmail’s reason', () => {
    expect(gmailRefusal({ status: 404, message: 'Gmail /messages/abc failed (404): Requested entity was not found.' }, true)).toEqual({ ok: false, error: 'notFound', words: MY_MAIL_REFUSAL_WORDS.notFound })
    expect(gmailRefusal({ status: 404, message: 'Gmail /history failed (404): Not Found' })).toMatchObject({ error: 'google' })
    expect(gmailRefusal({ status: 429, message: 'Gmail /messages/abc failed (429): User-rate limit exceeded' }, true)).toEqual({ ok: false, error: 'google', words: `${MY_MAIL_REFUSAL_WORDS.google} Gmail said: User-rate limit exceeded.` })
  })

  it('says what stopped, that what was done stays, and the database’s reason, our part in plain words', () => {
    const r = stoppedRefusal('The tag stopped partway. A line could not be written.', 'permission denied for table messages')
    expect(r).toEqual({ ok: false, error: 'google', words: 'The tag stopped partway. A line could not be written. What was done stays. Try again in a minute. The database said: permission denied for table messages.' })
    expect(plainWordsFailures('The tag stopped partway. A line could not be written. What was done stays. Try again in a minute.')).toEqual([])
    expect(stoppedRefusal('The app could not finish that.', 'boom', 'The reason').words).toBe('The app could not finish that. What was done stays. Try again in a minute. The reason: boom.')
  })
})

/** Text as Gmail sends a part's bytes: base64url of its bytes. */
const b64url = (bytes: Uint8Array): string => {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
const utf8 = (text: string) => b64url(new TextEncoder().encode(text))

describe('the mail, for the reader', () => {
  const html: GmailPart = { mimeType: 'text/html', headers: [{ name: 'Content-Type', value: 'text/html; charset="UTF-8"' }], body: { data: utf8('<p>Owner wants the <b>50-gal</b>.</p>') } }
  const plain: GmailPart = { mimeType: 'text/plain', headers: [{ name: 'Content-Type', value: 'text/plain; charset="UTF-8"' }], body: { data: utf8('Owner wants the 50-gal.') } }

  it('answers the HTML part of a mail as sent, and none for a plain mail', () => {
    expect(myMailBodyHtml({ payload: { mimeType: 'multipart/alternative', parts: [plain, html] } })).toBe('<p>Owner wants the <b>50-gal</b>.</p>')
    expect(myMailBodyHtml({ payload: { mimeType: 'multipart/mixed', parts: [plain] } })).toBeNull()
    expect(myMailBodyHtml({})).toBeNull()
  })

  it('reads the HTML by its charset, and leaves out an HTML file sent as an attachment', () => {
    const latin = { mimeType: 'text/html', headers: [{ name: 'Content-Type', value: 'text/html; charset=ISO-8859-1' }], body: { data: b64url(new Uint8Array([0x3c, 0x70, 0x3e, 0x43, 0x61, 0x66, 0xe9, 0x3c, 0x2f, 0x70, 0x3e])) } }
    expect(myMailBodyHtml({ payload: latin })).toBe('<p>Café</p>')
    const attached: GmailPart = { ...html, filename: 'invoice.html', headers: [{ name: 'Content-Disposition', value: 'attachment; filename="invoice.html"' }] }
    expect(myMailBodyHtml({ payload: { mimeType: 'multipart/mixed', parts: [plain, attached] } })).toBeNull()
  })

  it('leaves a body longer than an open answers to its words', () => {
    const long = { mimeType: 'text/html', body: { data: utf8(`<p>${'x'.repeat(MY_MAIL_HTML_MAX)}</p>`) } }
    expect(myMailBodyHtml({ payload: long })).toBeNull()
  })

  it('draws a header’s addresses with their names, and the files the row counts, a signature’s logo left out', () => {
    expect(myMailParties([{ name: ' Dale Okafor ', address: 'dale@ridgeway.example ' }, { name: null, address: 'ap@harlanfreight.example' }])).toEqual([
      { name: 'Dale Okafor', address: 'dale@ridgeway.example' },
      { name: '', address: 'ap@harlanfreight.example' },
    ])
    const files: EmailFile[] = [
      { partId: '1', name: 'elm-ct-spec-sheet.pdf', mime: 'application/pdf', size: 212_000, attachmentId: 'a1', data: null, inline: false },
      { partId: '2', name: 'logo.png', mime: 'image/png', size: 4_100, attachmentId: 'a2', data: null, inline: true },
    ]
    expect(myMailFileList({ files })).toEqual([{ name: 'elm-ct-spec-sheet.pdf', mime: 'application/pdf', size: 212_000 }])
  })
})

describe('which jobs are open, and their chips', () => {
  it('holds a bid open until it has an outcome, a GC project until it is closed or lost, a Pipeline job until it is paid', () => {
    expect(bidIsOpen({ outcome: null })).toBe(true)
    expect(bidIsOpen({ outcome: ' ' })).toBe(true)
    expect(bidIsOpen({ outcome: 'won' })).toBe(false)
    expect(bidIsOpen({ outcome: 'started_or_complete' })).toBe(false)
    expect(gcProjectIsOpen({ stage: 'building', lost_on: null })).toBe(true)
    expect(gcProjectIsOpen({ stage: 'Closed', lost_on: null })).toBe(false)
    expect(gcProjectIsOpen({ stage: 'bidding', lost_on: '2026-10-02' })).toBe(false)
    expect(pipelineIsOpen({ status: 'billed' })).toBe(true)
    expect(pipelineIsOpen({ status: 'paid' })).toBe(false)
  })

  it('draws each job’s chip as the app numbers it, and says whether it is open', () => {
    const got = myMailJobs({
      bids: [{ id: CLUB, bid_number: '523', project_name: 'Cedar Bend clubhouse', service_type_id: 'st-plumb', outcome: null }],
      projects: [{ id: CLINIC, project_number: '42', name: 'Harbor clinic', stage: 'closed', lost_on: null }],
      pipeline: [pipeline(ELM, '1077', '4 Elm Ct'), pipeline(HARBOR, '1081', '19 Harbor Ln', { status: 'paid' })],
      prefixes,
    })
    expect(got.chips).toEqual({
      [`bid:${CLUB}`]: { kind: 'bid', id: CLUB, key: `bid:${CLUB}`, num: 'BP523', name: 'Cedar Bend clubhouse' },
      [`project:${CLINIC}`]: { kind: 'project', id: CLINIC, key: `project:${CLINIC}`, num: '#42', name: 'Harbor clinic' },
      [`pipeline:${ELM}`]: { kind: 'pipeline', id: ELM, key: `pipeline:${ELM}`, num: 'JP1077', name: '4 Elm Ct' },
      [`pipeline:${HARBOR}`]: { kind: 'pipeline', id: HARBOR, key: `pipeline:${HARBOR}`, num: 'JP1081', name: '19 Harbor Ln' },
    })
    expect(got.open).toEqual({ [`bid:${CLUB}`]: true, [`project:${CLINIC}`]: false, [`pipeline:${ELM}`]: true, [`pipeline:${HARBOR}`]: false })
    expect(got.jobs.map((j) => j.key)).toEqual([`bid:${CLUB}`, `project:${CLINIC}`, `pipeline:${ELM}`, `pipeline:${HARBOR}`])
  })
})

describe('the facts a page’s guesses read', () => {
  const elmChip: MyMailJobChip = { kind: 'pipeline', id: ELM, key: `pipeline:${ELM}`, num: 'JP1077', name: '4 Elm Ct' }

  it('asks for the parties’ addresses, the subjects’ numbers and the domains worth asking about', () => {
    const asks = myMailGuessAsks(
      [
        row('a', { who: { name: 'Dale', address: ' Dale@Ridgeway.example ' }, subject: 'Re: JP1077 water heater' }),
        row('b', { who: { name: '', address: 'ana.ruiz@gmail.com' }, subject: '(no subject)' }),
        row('c', { who: { name: 'Rosa', address: 'rosa@clickplumbing.example' }, subject: 'BP523 and #42' }),
        row('d', { who: { name: '', address: 'not-an-address' } }),
      ],
      myMailOurDomains(['marisol@clickplumbing.example', 'team@noreply.clicktooling.example']),
    )
    expect(asks).toEqual({ addresses: ['dale@ridgeway.example', 'ana.ruiz@gmail.com', 'rosa@clickplumbing.example'], numbers: ['1077', '523', '42'], domains: ['ridgeway.example'] })
  })

  it('writes a domain filter for PostgREST, a domain it cannot name safely left out', () => {
    expect(domainFilter(['email'], ['ridgeway.example', 'cedar-bend.example'])).toBe('email.ilike.*@ridgeway.example,email.ilike.*@cedar-bend.example')
    expect(domainFilter(['contact_info->>email', 'billing_email'], ['ridgeway.example', 'x),id.eq.1'])).toBe('contact_info->>email.ilike.*@ridgeway.example,billing_email.ilike.*@ridgeway.example')
  })

  it('folds the reads into maps: the contacts on an address, a contact’s jobs with its star', () => {
    expect(contactsByAddress([{ contact_id: 'c-dale', key: 'dale@ridgeway.example' }, { contact_id: 'c-dale', value: 'Dale@Ridgeway.example' }, { contact_id: 'c-dale-2', key: 'dale@ridgeway.example' }])).toEqual({
      'dale@ridgeway.example': ['c-dale', 'c-dale-2'],
    })
    expect(
      contactJobsOf([
        { contact_id: 'c-dale', bid_id: null, project_id: null, jobs_ledger_id: ELM, is_default: false },
        { contact_id: 'c-dale', bid_id: null, project_id: null, jobs_ledger_id: ELM, is_default: true },
        { contact_id: 'c-dale', bid_id: CLUB, project_id: null, jobs_ledger_id: null, is_default: null },
        { contact_id: 'c-odd', bid_id: null, project_id: null, jobs_ledger_id: null },
      ]),
    ).toEqual({ 'c-dale': [{ key: `pipeline:${ELM}`, star: true }, { key: `bid:${CLUB}`, star: false }] })
  })

  it('finds the customers on a domain by their own emails and their people’s, and a customer with no name says nothing', () => {
    expect(
      domainCustomers(
        ['ridgeway.example', 'cedarbend.example'],
        [
          { id: 'cust-ridgeway', name: 'Ridgeway Builders', contact_info: { email: 'office@ridgeway.example' }, billing_email: 'ap@ridgeway.example' },
          { id: 'cust-cedar', name: 'Cedar Bend HOA', contact_info: null, billing_email: null },
          { id: 'cust-blank', name: ' ', contact_info: { email: 'x@cedarbend.example' } },
        ],
        [
          { customer_id: 'cust-cedar', email: 'Priya@CedarBend.example' },
          { customer_id: 'cust-ridgeway', email: 'dale@ridgeway.example' },
          { customer_id: 'cust-gone', email: 'old@cedarbend.example' },
        ],
      ),
    ).toEqual({ 'ridgeway.example': [{ customerId: 'cust-ridgeway', name: 'Ridgeway Builders' }], 'cedarbend.example': [{ customerId: 'cust-cedar', name: 'Cedar Bend HOA' }] })
  })

  it('lists each customer’s open Pipeline jobs, as the billed customer and as the GC', () => {
    expect(
      customerOpenJobs([
        pipeline(ELM, '1077', '4 Elm Ct'),
        pipeline(HARBOR, '1081', '19 Harbor Ln', { status: 'paid' }),
        pipeline('j-3', '1090', '7 Mill Rd', { customer_id: 'cust-owner', gc_customer_id: 'cust-ridgeway' }),
      ]),
    ).toEqual({ 'cust-ridgeway': [`pipeline:${ELM}`, 'pipeline:j-3'], 'cust-owner': ['pipeline:j-3'] })
  })

  const page = (over: Partial<MyMailPageFacts> = {}): MyMailPageFacts => ({
    ...myMailJobs({ bids: [], projects: [], pipeline: [pipeline(ELM, '1077', '4 Elm Ct'), pipeline(HARBOR, '1081', '19 Harbor Ln')], prefixes }),
    contactsByAddress: {},
    contactJobs: {},
    domainCustomers: {},
    customerOpenJobs: {},
    ...over,
  })

  it('guesses from the party’s one contact and its star, and from nothing when two contacts hold the address', () => {
    const facts = page({ contactsByAddress: { 'dale@ridgeway.example': ['c-dale'] }, contactJobs: { 'c-dale': [{ key: `pipeline:${ELM}`, star: true }, { key: `pipeline:${HARBOR}`, star: false }] } })
    const dale = row('a')
    expect(guessJob(dale, myMailGuessFacts(dale, facts))).toEqual({ ...elmChip, why: 'Dale Okafor is on this job' })
    const two = page({ contactsByAddress: { 'dale@ridgeway.example': ['c-dale', 'c-dale-2'] }, contactJobs: facts.contactJobs })
    expect(myMailGuessFacts(dale, two).partyJobs).toEqual([])
    expect(guessJob(dale, myMailGuessFacts(dale, two))).toBeNull()
  })

  it('marks the party’s own jobs as theirs for the subject, so a job’s name in it counts', () => {
    const facts = page({ contactsByAddress: { 'dale@ridgeway.example': ['c-dale'] }, contactJobs: { 'c-dale': [{ key: `pipeline:${HARBOR}`, star: false }, { key: `pipeline:${ELM}`, star: false }] } })
    const named = row('a', { subject: 'Re: 4 Elm Ct water heater' })
    expect(guessJob(named, myMailGuessFacts(named, facts))).toEqual({ ...elmChip, why: 'the subject names 4 Elm Ct' })
  })

  it('guesses from a customer’s domain with one open job, and not from one with two', () => {
    const one = page({ domainCustomers: { 'ridgeway.example': [{ customerId: 'cust-ridgeway', name: 'Ridgeway Builders' }] }, customerOpenJobs: { 'cust-ridgeway': [`pipeline:${ELM}`] } })
    const ana = row('a', { who: { name: 'Ana Ruiz', address: 'ana@ridgeway.example' } })
    expect(guessJob(ana, myMailGuessFacts(ana, one))).toEqual({ ...elmChip, why: 'ridgeway.example is Ridgeway Builders' })
    const two = page({ domainCustomers: one.domainCustomers, customerOpenJobs: { 'cust-ridgeway': [`pipeline:${ELM}`, `pipeline:${HARBOR}`] } })
    expect(guessJob(ana, myMailGuessFacts(ana, two))).toBeNull()
  })

  it('fills a row with its tag, its line and its guess, and draws no guess on a tagged row', () => {
    const line = { id: 'm-1', bid_id: null, project_id: null, jobs_ledger_id: ELM }
    expect(filledRow(row('a'), { tagged: elmChip, line, guess: { ...elmChip, why: 'x' } })).toMatchObject({ tagged: { ...elmChip, messageId: 'm-1' }, inMessages: { messageId: 'm-1', jobKey: `pipeline:${ELM}` }, guess: null })
    expect(filledRow(row('a'), { tagged: null, line: null, guess: { ...elmChip, why: 'x' } })).toMatchObject({ tagged: null, inMessages: null, guess: { why: 'x' } })
    expect(filledRow(row('a'), { tagged: elmChip, line: null, guess: null }).tagged).toEqual({ ...elmChip, messageId: null })
    // The person's own tag line is theirs: drawn through tagged, never as a line someone else holds.
    const mine = { ...line, mail_user_id: 'u-me' }
    expect(filledRow(row('a'), { tagged: elmChip, line: mine, guess: null }, 'u-me')).toMatchObject({ tagged: { ...elmChip, messageId: 'm-1' }, inMessages: null })
    expect(filledRow(row('a'), { tagged: elmChip, line: { ...line, mail_user_id: 'u-other' }, guess: null }, 'u-me').inMessages).toEqual({ messageId: 'm-1', jobKey: `pipeline:${ELM}` })
  })

  it('wants a guess only on a row not tagged, not folded, and with no line on a job yet', () => {
    expect(wantsGuess(row('a'), { tagKey: null, line: null })).toBe(true)
    expect(wantsGuess(row('a'), { tagKey: null, line: { id: 'm-1', bid_id: null, project_id: null, jobs_ledger_id: null } })).toBe(true)
    expect(wantsGuess(row('a'), { tagKey: `pipeline:${ELM}`, line: null })).toBe(false)
    expect(wantsGuess(row('a', { folded: 'bulk' }), { tagKey: null, line: null })).toBe(false)
    expect(wantsGuess(row('a'), { tagKey: null, line: { id: 'm-1', bid_id: CLUB, project_id: null, jobs_ledger_id: null } })).toBe(false)
  })
})

describe('what a tag writes', () => {
  const marisolAt = { name: 'Marisol Vega', address: 'marisol@clickplumbing.example' }
  const daleAt = { name: 'Dale Okafor', address: 'dale@ridgeway.example' }
  const spec: EmailFile = { partId: '1', name: 'elm ct / spec sheet.pdf', mime: 'application/pdf', size: 212_000, attachmentId: 'att-spec', data: null, inline: false }
  const mail = (gmailId: string, over: Partial<EmailIn> = {}): EmailIn => ({
    gmailId,
    threadId: 't-elm',
    labels: ['INBOX'],
    at: '2026-11-01T15:12:00.000Z',
    from: daleAt,
    to: [marisolAt],
    cc: [],
    subject: 'Re: 4 Elm Ct water heater',
    text: 'Owner wants the 50-gal.',
    links: [],
    files: [],
    headers: { 'message-id': `<${gmailId}@mail.example>` },
    ...over,
  })
  const elm: MyMailJobChip = { kind: 'pipeline', id: ELM, key: `pipeline:${ELM}`, num: 'JP1077', name: '4 Elm Ct' }

  it('reads the held lines by Message-ID, the person’s own as theirs, the first line of an id standing', () => {
    expect(
      knownLines(
        [
          { id: 'm-box', rfc_message_id: '<a@x>', bid_id: null, project_id: null, jobs_ledger_id: null, mailbox: 'bids', mail_user_id: null },
          { id: 'm-mine', rfc_message_id: ' <b@x> ', bid_id: null, project_id: null, jobs_ledger_id: ELM, mailbox: 'mine', mail_user_id: MARISOL },
          { id: 'm-rosa', rfc_message_id: '<c@x>', bid_id: CLUB, project_id: null, jobs_ledger_id: null, mailbox: 'mine', mail_user_id: 'u-rosa' },
          { id: 'm-twice', rfc_message_id: '<a@x>', bid_id: null, project_id: null, jobs_ledger_id: null },
          { id: 'm-none', rfc_message_id: null, bid_id: null, project_id: null, jobs_ledger_id: null },
        ],
        MARISOL,
      ),
    ).toEqual({
      '<a@x>': { messageId: 'm-box', jobKey: null, mine: false },
      '<b@x>': { messageId: 'm-mine', jobKey: `pipeline:${ELM}`, mine: true },
      '<c@x>': { messageId: 'm-rosa', jobKey: `bid:${CLUB}`, mine: false },
    })
  })

  it('reads the team’s addresses as the bids@ reader does', () => {
    expect(myMailTeam([{ id: MARISOL, name: ' Marisol Vega ', email: 'Marisol@ClickPlumbing.example' }, { id: 'u-x', name: null, email: 'x@clickplumbing.example' }, { id: 'u-none', name: 'No Mail', email: null }])).toEqual({
      'marisol@clickplumbing.example': { userId: MARISOL, name: 'Marisol Vega' },
      'x@clickplumbing.example': { userId: 'u-x', name: 'x@clickplumbing.example' },
    })
  })

  it('writes a tagged line as the bids@ reader writes one, column for column, with the box mine and the person', () => {
    const plan = planTag({ threadId: 't-elm', messages: [mail('g-dale-1'), mail('g-marisol-1', { labels: ['SENT'], from: marisolAt, to: [daleAt] })] }, { userId: MARISOL, address: marisolAt.address, name: 'Marisol Vega' }, elm, { byMessageId: {} })
    const [inStep, outStep] = plan.steps as Extract<MyMailTagStep, { kind: 'write' }>[]
    expect(myMailLineRow(inStep!, plan, { contactId: 'c-dale', channelId: 'ch-dale' }, { kind: 'invitation' })).toEqual({
      invitation: { kind: 'invitation' },
      contact_id: 'c-dale',
      channel_id: 'ch-dale',
      direction: 'in',
      who_user_id: null,
      who_text: "Dale Okafor <dale@ridgeway.example> to Marisol Vega's mail",
      at: '2026-11-01T15:12:00.000Z',
      subject: 'Re: 4 Elm Ct water heater',
      body: 'Owner wants the 50-gal.',
      gmail_thread_id: 't-elm',
      mailbox: 'mine',
      rfc_message_id: '<g-dale-1@mail.example>',
      mail_user_id: MARISOL,
      bid_id: null,
      project_id: null,
      jobs_ledger_id: ELM,
    })
    expect(myMailLineRow(outStep!, plan, { contactId: 'c-dale', channelId: null })).toMatchObject({ invitation: null, direction: 'out', who_user_id: MARISOL, channel_id: null })
  })

  it('copies a file under the person and the mail, keeps the raw mail by the line, and writes each file’s row as the reader does', () => {
    expect(myMailFilePath(MARISOL, 'g-dale-1', '1', 0, spec.name)).toBe('mine/u-marisol/g-dale-1/1-elm ct _ spec sheet.pdf')
    expect(myMailFilePath(MARISOL, 'g-dale-1', '', 3, '')).toBe('mine/u-marisol/g-dale-1/3-file')
    expect(safeFileName('a'.repeat(200)).length).toBe(120)
    expect(myMailEmlPath('m-1')).toBe('mine/m-1.eml')
    expect(MY_MAIL_EML_MIME).toBe('message/rfc822')
    const [copy, big, link] = emailFileRows(
      { files: [{ ...spec, name: 'COI 2026.pdf' }, { ...spec, partId: '2', name: 'plans.zip', mime: 'application/zip', size: KEEP_FILE_BYTES + 1 }], links: ['https://www.dropbox.com/scl/fi/abc/elm-plans.pdf?dl=0'] },
      'trade',
    )
    expect(myMailFileRow(copy!, { path: 'mine/u-marisol/g/1-COI 2026.pdf' })).toEqual({ kind: 'file', name: 'COI 2026.pdf', mime: 'application/pdf', size_bytes: 212_000, gmail_attachment_id: 'att-spec', paper: 'coi', bucket_path: 'mine/u-marisol/g/1-COI 2026.pdf' })
    expect(myMailFileRow(copy!, { left: 'not_copied' })).toMatchObject({ left_in_gmail: 'not_copied' })
    expect(myMailFileRow(copy!)).toMatchObject({ left_in_gmail: 'not_copied' })
    expect(myMailFileRow(big!)).toMatchObject({ kind: 'file', name: 'plans.zip', left_in_gmail: 'too_big' })
    expect(myMailFileRow(link!)).toEqual({ kind: 'link', name: 'elm-plans.pdf', url: 'https://www.dropbox.com/scl/fi/abc/elm-plans.pdf?dl=0', host: 'dropbox' })
  })
})

describe('planUntag: what an untag removes', () => {
  it('removes the person’s own lines, and unties a box’s line only when the tag tied it', () => {
    const plan = planUntag({
      userId: MARISOL,
      tagJobKey: `pipeline:${ELM}`,
      own: [{ id: 'm-mine-1' }, { id: 'm-mine-2' }, { id: 'm-mine-1' }],
      box: [
        { id: 'm-box-tied', bid_id: null, project_id: null, jobs_ledger_id: ELM, mail_user_id: null, tied_by: MARISOL },
        { id: 'm-box-office', bid_id: null, project_id: null, jobs_ledger_id: ELM, mail_user_id: null, tied_by: 'u-rosa' },
        { id: 'm-box-elsewhere', bid_id: CLUB, project_id: null, jobs_ledger_id: null, mail_user_id: null, tied_by: MARISOL },
        { id: 'm-box-untied', bid_id: null, project_id: null, jobs_ledger_id: null, mail_user_id: null, tied_by: MARISOL },
      ],
    })
    expect(plan).toEqual({ remove: ['m-mine-1', 'm-mine-2'], untie: ['m-box-tied'] })
  })

  it('unties nothing when no tag row is left to say which job it tied', () => {
    expect(planUntag({ userId: MARISOL, tagJobKey: null, own: [{ id: 'm-1' }], box: [{ id: 'm-box', bid_id: null, project_id: null, jobs_ledger_id: ELM, mail_user_id: null, tied_by: MARISOL }] })).toEqual({ remove: ['m-1'], untie: [] })
  })

  it('keys an address as the database keys it', () => {
    expect(myMailAddressKey(' Dale@Ridgeway.Example ')).toBe('dale@ridgeway.example')
    expect(myMailAddressKey('nobody')).toBe('')
    expect(myMailAddressKey(null)).toBe('')
  })
})

describe('the tag’s grey line on the thread', () => {
  it('is the app’s own event in the other party’s thread, keyed by the tag’s row and on its job', () => {
    expect(myMailTagEventKey('tag-1')).toBe('mytag:tag-1')
    expect(
      myMailTagEventRow({ tagRowId: 'tag-1', who: { name: ' Marisol Vega ', email: 'marisol@clickplumbing.example' }, contactId: 'c-dale', jobColumns: { bid_id: null, project_id: null, jobs_ledger_id: ELM } }),
    ).toEqual({
      contact_id: 'c-dale',
      channel: 'event',
      direction: 'team',
      who_text: 'The app',
      body: 'Marisol Vega tagged this conversation from their mail. Later mail in it lands here by itself.',
      quo_id: 'mytag:tag-1',
      bid_id: null,
      project_id: null,
      jobs_ledger_id: ELM,
    })
  })

  it('names the address when the person has no name, and says it in plain words', () => {
    expect(myMailTagEventWords({ name: ' ', email: 'marisol@clickplumbing.example' })).toBe(
      'marisol@clickplumbing.example tagged this conversation from their mail. Later mail in it lands here by itself.',
    )
    expect(plainWordsFailures(myMailTagEventWords({ name: 'Marisol Vega', email: '' }))).toEqual([])
    expect(plainWordsFailures(MY_MAIL_FOLLOW_GONE)).toEqual([])
  })

  it('reads a column the push has not added yet as not there, and any other failure as a failure', () => {
    expect(['42703', 'PGRST200', 'PGRST204'].map(columnNotPushed)).toEqual([true, true, true])
    expect(['42P01', '23505', null, undefined].map(columnNotPushed)).toEqual([false, false, false, false])
  })
})

describe('the follow: whose conversations, which, and what it does with each mail', () => {
  it('is the cron’s alone: the tab’s parser refuses it', () => {
    expect(isFollowRequest({ action: 'follow' })).toBe(true)
    expect(isFollowRequest({ action: 'list' })).toBe(false)
    expect(isFollowRequest('follow')).toBe(false)
    expect(isFollowRequest(null)).toBe(false)
    expect(parseMyMailRequest({ action: 'follow' })).toBeNull()
  })

  it('reads a conversation read, or tagged and not yet read, in the last 60 days, and 100 a run', () => {
    expect([FOLLOW_ROWS_PER_RUN, FOLLOW_WINDOW_DAYS]).toEqual([100, 60])
    expect(followSince(Date.parse('2026-11-01T12:00:00.000Z'))).toBe('2026-09-02T12:00:00.000Z')
    expect(followSince(new Date('2026-11-01T12:00:00.000Z'))).toBe('2026-09-02T12:00:00.000Z')
    expect(followWindow('2026-09-02T12:00:00.000Z')).toBe('last_read_at.gt.2026-09-02T12:00:00.000Z,and(last_read_at.is.null,tagged_at.gt.2026-09-02T12:00:00.000Z)')
    // As PostgREST reads the filter: coalesce(last_read_at, tagged_at) after the window's start.
    const inWindow = orFilter(followWindow('2026-09-02T12:00:00.000Z'))
    expect(inWindow({ last_read_at: '2026-10-30T00:00:00.000Z', tagged_at: '2026-01-01T00:00:00.000Z' })).toBe(true)
    expect(inWindow({ last_read_at: '2026-08-01T00:00:00.000Z', tagged_at: '2026-10-30T00:00:00.000Z' })).toBe(false)
    expect(inWindow({ last_read_at: null, tagged_at: '2026-10-30T00:00:00.000Z' })).toBe(true)
    expect(inWindow({ last_read_at: null, tagged_at: '2026-08-01T00:00:00.000Z' })).toBe(false)
  })

  it('reads as each office member whose switch is on: never a sample, a twin, the walk tester, an archived or training account', () => {
    const u = (id: string, over: Partial<MyMailFollowUserRow> = {}): MyMailFollowUserRow => ({
      id,
      name: ` ${id} `,
      email: `${id}@clickplumbing.example`,
      role: 'estimator',
      read_only: false,
      is_sample: false,
      is_digital_twin: false,
      is_walk_tester: false,
      my_mail_on: true,
      archived_at: null,
      ...over,
    })
    expect(
      followPeople([
        u('marisol'),
        u('off', { my_mail_on: false }),
        u('sample', { is_sample: true }),
        u('twin', { is_digital_twin: true }),
        u('tester', { is_walk_tester: true }),
        u('gone', { archived_at: '2026-10-01T00:00:00.000Z' }),
        u('trainee', { read_only: true }),
        u('sub', { role: 'subcontractor' }),
        u('nomail', { email: 'nobody' }),
        u('rosa', { role: 'assistant', email: ' rosa@clickplumbing.example ' }),
      ]),
    ).toEqual([
      { id: 'marisol', name: 'marisol', email: 'marisol@clickplumbing.example' },
      { id: 'rosa', name: 'rosa', email: 'rosa@clickplumbing.example' },
    ])
    expect([...MY_MAIL_OFFICE_ROLES]).toEqual([...GC_OFFICE_TEAM])
  })

  it('reads the tag’s job as planTag takes it, and none from a row that names none', () => {
    expect(tagRowJob({ bid_id: null, project_id: null, jobs_ledger_id: ELM })).toEqual({ kind: 'pipeline', id: ELM, key: `pipeline:${ELM}`, num: '', name: '' })
    expect(tagRowJob({ bid_id: CLUB, project_id: null, jobs_ledger_id: null })).toMatchObject({ kind: 'bid', id: CLUB, key: `bid:${CLUB}` })
    expect(tagRowJob({ bid_id: null, project_id: CLINIC, jobs_ledger_id: null })).toMatchObject({ kind: 'project', id: CLINIC })
    expect(tagRowJob({ bid_id: null, project_id: null, jobs_ledger_id: null })).toBeNull()
  })

  describe('planFollow', () => {
    const marisol = { userId: MARISOL, address: 'marisol@clickplumbing.example', name: 'Marisol Vega' }
    const elm: MyMailJobChip = { kind: 'pipeline', id: ELM, key: `pipeline:${ELM}`, num: '', name: '' }
    const m = (gmailId: string, over: Partial<EmailIn> = {}): EmailIn => ({
      gmailId,
      threadId: 't-elm',
      labels: ['INBOX'],
      at: null,
      from: { name: 'Dale Okafor', address: 'dale@ridgeway.example' },
      to: [{ name: '', address: marisol.address }],
      cc: [],
      subject: 'Re: 4 Elm Ct water heater',
      text: '',
      links: [],
      files: [],
      headers: { 'message-id': `<${gmailId}@x>` },
      ...over,
    })
    const line = (id: string, rfc: string | null, over: Partial<MyMailFollowLine> = {}): MyMailFollowLine => ({
      id,
      gmail_id: null,
      rfc_message_id: rfc,
      bid_id: null,
      project_id: null,
      jobs_ledger_id: null,
      mail_user_id: null,
      tied_by: null,
      ...over,
    })

    it('writes a mail no line holds, ties a box’s line nobody placed, and leaves every placed line where it is', () => {
      const steps = planFollow(
        { threadId: 't-elm', messages: [m('g-new'), m('g-loose'), m('g-mine'), m('g-moved'), m('g-untied'), m('g-elsewhere'), m('g-bare', { headers: {} })] },
        marisol,
        elm,
        {
          lines: [
            line('m-loose', '<g-loose@x>'),
            line('m-mine', '<g-mine@x>', { mail_user_id: MARISOL, jobs_ledger_id: ELM }),
            line('m-moved', '<g-moved@x>', { mail_user_id: MARISOL, jobs_ledger_id: HARBOR, tied_by: 'u-rosa' }),
            line('m-untied', '<g-untied@x>', { tied_by: 'u-rosa' }),
            line('m-elsewhere', '<g-elsewhere@x>', { bid_id: CLUB }),
            line('m-bare', null, { gmail_id: 'g-bare', mail_user_id: MARISOL, jobs_ledger_id: ELM }),
          ],
        },
      )
      expect(steps).toEqual([
        { kind: 'write', gmailId: 'g-new' },
        { kind: 'tie', gmailId: 'g-loose', messageId: 'm-loose' },
        { kind: 'held', gmailId: 'g-mine', messageId: 'm-mine' },
        { kind: 'held', gmailId: 'g-moved', messageId: 'm-moved' },
        { kind: 'held', gmailId: 'g-untied', messageId: 'm-untied' },
        { kind: 'held', gmailId: 'g-elsewhere', messageId: 'm-elsewhere' },
        { kind: 'held', gmailId: 'g-bare', messageId: 'm-bare' },
      ])
    })

    it('leaves out what a tag leaves out, and finds a mail with no Message-ID only in this person’s box', () => {
      const steps = planFollow(
        {
          threadId: 't-elm',
          messages: [
            m('g-draft', { labels: ['DRAFT'] }),
            m('g-trash', { labels: ['TRASH'], headers: { 'message-id': '<g-held@x>' } }),
            m('g-box', { from: { name: 'Bids', address: 'bids@clickplumbing.example' } }),
            m('g-1'),
            m('g-1-again', { headers: { 'message-id': '<g-1@x>' } }),
            m('g-held', { headers: { 'message-id': '<g-held@x>' } }),
            m('g-held-again', { headers: { 'message-id': '<g-held@x>' } }),
            m('g-rosas', { headers: {} }),
          ],
        },
        marisol,
        elm,
        { boxes: ['bids@clickplumbing.example'], lines: [line('m-held', '<g-held@x>'), line('m-rosa', null, { gmail_id: 'g-rosas', mail_user_id: 'u-rosa', jobs_ledger_id: ELM })] },
      )
      expect(steps).toEqual([
        { kind: 'skip', gmailId: 'g-draft', why: 'draft' },
        { kind: 'skip', gmailId: 'g-trash', why: 'spamOrTrash' },
        { kind: 'skip', gmailId: 'g-box', why: 'noParty' },
        { kind: 'write', gmailId: 'g-1' },
        { kind: 'skip', gmailId: 'g-1-again', why: 'twice' },
        { kind: 'tie', gmailId: 'g-held', messageId: 'm-held' },
        { kind: 'skip', gmailId: 'g-held-again', why: 'twice' },
        { kind: 'write', gmailId: 'g-rosas' },
      ])
    })
  })
})
