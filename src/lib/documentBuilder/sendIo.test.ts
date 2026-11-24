import { describe, expect, it, vi } from 'vitest'

vi.mock('../supabase', () => ({ supabase: {} }))

import { builderPartiesFrom, contactsOf, gcPageFromLinks, pageFromLinks, sendRecordFromRow, sendRefusalWords, sendWentUnrecorded } from './sendIo'
import { BUILDER_SEND_NOTE, DOCUMENT_BUILDER_SEND_REFUSALS, builderSendEmail, customerPageUrl, gcJobLabel, gcPageLink, parseBuilderSend, parseSheetSend, resendGoesToWhoItWentTo, sendAskKind, sheetSendEmail, sheetSendMessageKey } from './sendWords'
import { plainWordsFailures } from '../plainWords'

describe('where a party’s own page stands', () => {
  it('is on with a link that is on, none with no link ever, and off once every link was turned off', () => {
    expect(pageFromLinks([{ revoked_at: '2026-10-03T15:00:00Z' }, { revoked_at: null }])).toEqual({ state: 'on' })
    expect(pageFromLinks([])).toEqual({ state: 'none' })
    expect(pageFromLinks([{ revoked_at: '2026-09-01T15:00:00Z' }, { revoked_at: '2026-10-03T15:00:00Z' }])).toEqual({ state: 'off', offOn: '2026-10-03' })
  })
})

describe('who a send can go to', () => {
  it('is the main contact, then the company’s people, each with an email and none twice', () => {
    expect(
      contactsOf({ contact_name: 'Ana Pruitt', email: 'ana@cedarfork.test' }, [
        { name: 'Ana Pruitt', email: 'ANA@cedarfork.test', role: 'owner' },
        { name: 'Bo Reyes', email: 'bo@cedarfork.test', role: ' office ' },
        { name: 'No Email', email: '', role: null },
      ]),
    ).toEqual([
      { name: 'Ana Pruitt', email: 'ana@cedarfork.test' },
      { name: 'Bo Reyes', email: 'bo@cedarfork.test', role: 'office' },
    ])
    expect(contactsOf({ contact_name: null, email: null }, [])).toEqual([])
    expect(contactsOf({ contact_name: '', email: 'desk@cedarfork.test' }, [])).toEqual([{ name: 'desk@cedarfork.test', email: 'desk@cedarfork.test' }])
  })
})

describe('a send as the table keeps it', () => {
  it('reads its days in the company’s own zone', () => {
    expect(sendRecordFromRow({ id: 's1', contact_name: 'Ana Pruitt', sent_at: '2026-11-13T03:30:00Z', sent_revision: 1, times_sent: 2, opened_at: null, opened_revision: null })).toEqual({ id: 's1', contactName: 'Ana Pruitt', contactEmail: '', about: null, sentOn: '2026-11-12', sentRevision: 1, timesSent: 2, openedOn: null, openedRevision: null })
  })

  it('keeps the address it went to, which is what says who a reminder goes to', () => {
    expect(sendRecordFromRow({ id: 's1', contact_name: 'Ana Pruitt', contact_email: ' ana@cedarfork.test ', sent_at: '2026-11-13T03:30:00Z', sent_revision: 1, times_sent: 1, opened_at: null, opened_revision: null }).contactEmail).toBe('ana@cedarfork.test')
  })
})

describe('the send’s shared rules', () => {
  const ask = { builderKey: 'insurance', sheetId: '00000000-0000-0000-0000-0000004043a0', companyId: '00000000-0000-0000-0000-0000004043e1', contactEmail: ' Ana@CedarFork.test ', note: ' A made-up note. ', why: 'first' }

  it('reads a whole ask, trimmed, and nothing from one that is not whole', () => {
    expect(parseSheetSend(ask)).toEqual({ builderKey: 'insurance', sheetId: ask.sheetId, companyId: ask.companyId, contactEmail: 'ana@cedarfork.test', note: 'A made-up note.', why: 'first', anyway: false, test: false })
    expect(parseSheetSend({ ...ask, anyway: true, test: true })).toMatchObject({ anyway: true, test: true })
    for (const bad of [null, {}, { ...ask, sheetId: 'nope' }, { ...ask, contactEmail: 'not an email' }, { ...ask, why: 'whenever' }, { ...ask, builderKey: 'Insurance' }, { ...ask, note: 'x'.repeat(2001) }]) expect(parseSheetSend(bad)).toBeNull()
  })

  it('words the email by why it goes, with the note first and the sheet’s own link when it has one', () => {
    const first = sheetSendEmail({ job: 'Cedar Park Medical Office', note: 'A made-up note.', why: 'first', sheetUrl: 'https://app.example/d/abcdefgh23456789' })
    expect(first.subject).toBe('Insurance requirements for Cedar Park Medical Office')
    expect(first.lines).toEqual([
      'A made-up note.',
      'The sheet says what your certificate of insurance must show on Cedar Park Medical Office. It is on your page.',
      'Your insurance agent can open the sheet with this link. It needs no login: https://app.example/d/abcdefgh23456789',
      'Send us the certificate from your page. You can also reply to this email with it.',
    ])
    expect(sheetSendEmail({ job: 'Cedar Park Medical Office', note: '', why: 'again', sheetUrl: null }).subject).toBe('A reminder: insurance requirements for Cedar Park Medical Office')
    const changed = sheetSendEmail({ job: 'Cedar Park Medical Office', note: '', why: 'changed', sheetUrl: null })
    expect(changed.subject).toBe('The insurance requirements for Cedar Park Medical Office changed')
    expect(changed.lines[0]).toBe('The insurance requirements for Cedar Park Medical Office changed since you opened them. The new sheet is on your page.')
    expect(changed.lines).toHaveLength(2)
  })

  it('holds a reminder to the address the send went to, and lets a first send pick anyone', () => {
    expect(resendGoesToWhoItWentTo('again', 'ana@cedarfork.test', ' Ana@CedarFork.test ')).toBe(true)
    expect(resendGoesToWhoItWentTo('again', 'ana@cedarfork.test', 'office@cedarfork.test')).toBe(false)
    expect(resendGoesToWhoItWentTo('changed', 'ana@cedarfork.test', 'office@cedarfork.test')).toBe(false)
    expect(resendGoesToWhoItWentTo('first', 'ana@cedarfork.test', 'office@cedarfork.test')).toBe(true)
    // No live send, or a row that kept no address: nothing to hold it to.
    expect(resendGoesToWhoItWentTo('again', null, 'office@cedarfork.test')).toBe(true)
    expect(resendGoesToWhoItWentTo('again', '  ', 'office@cedarfork.test')).toBe(true)
  })

  it('keys the message on the company’s thread by the send and the time it went', () => {
    expect(sheetSendMessageKey('s1', 2)).toBe('builder-send:s1:2')
  })

  it('reads in plain words', () => {
    const texts = [...Object.values(DOCUMENT_BUILDER_SEND_REFUSALS).map((r) => r.words), ...sheetSendEmail({ job: 'a job', note: '', why: 'first', sheetUrl: 'a link' }).lines, ...sheetSendEmail({ job: 'a job', note: '', why: 'changed', sheetUrl: null }).lines]
    expect(texts.flatMap((t) => plainWordsFailures(t))).toEqual([])
  })
})

describe('a builder to a GC, as the function is asked', () => {
  const ask = { builderKey: 'sub-nda', customerId: '00000000-0000-0000-0000-0000004049c1', aboutJobId: '00000000-0000-0000-0000-0000004049a1', contactEmail: ' Dana@Northgate.test ', note: ' A made-up note. ', why: 'first' }

  it('is told from a sheet\u2019s send by who it names', () => {
    expect(sendAskKind(ask)).toBe('builder')
    expect(sendAskKind({ builderKey: 'insurance', sheetId: 'x', companyId: 'y' })).toBe('sheet')
    expect(sendAskKind(null)).toBe('sheet')
  })

  it('reads a whole ask, trimmed, about one job or about all their jobs', () => {
    expect(parseBuilderSend(ask)).toEqual({ builderKey: 'sub-nda', customerId: ask.customerId, aboutJobId: ask.aboutJobId, contactEmail: 'dana@northgate.test', note: 'A made-up note.', why: 'first', anyway: false, test: false })
    expect(parseBuilderSend({ ...ask, aboutJobId: null })?.aboutJobId).toBeNull()
    expect(parseBuilderSend({ ...ask, aboutJobId: '' })?.aboutJobId).toBeNull()
    const { aboutJobId: _none, ...noAbout } = ask
    expect(parseBuilderSend(noAbout)?.aboutJobId).toBeNull()
    expect(parseBuilderSend({ ...ask, anyway: true, test: true })).toMatchObject({ anyway: true, test: true })
  })

  it('reads nothing from an ask that is not whole', () => {
    for (const bad of [null, {}, { ...ask, customerId: 'nope' }, { ...ask, aboutJobId: 'nope' }, { ...ask, contactEmail: 'not an email' }, { ...ask, why: 'whenever' }, { ...ask, builderKey: 'Sub NDA' }, { ...ask, note: 'x'.repeat(2001) }]) expect(parseBuilderSend(bad)).toBeNull()
  })

  it('words the email by why it goes, with the note first and the job it sits under', () => {
    const first = builderSendEmail({ company: 'Made-up Plumbing', aboutJob: null, note: BUILDER_SEND_NOTE, why: 'first' })
    expect(first.subject).toBe('Secrecy on your jobs with Made-up Plumbing')
    expect(first.lines).toEqual([BUILDER_SEND_NOTE, 'It is on your page.', 'You can look. Nothing is sent from it.'])
    expect(builderSendEmail({ company: 'Made-up Plumbing', aboutJob: 'Pike Street clinic · Job 1180', note: '', why: 'again' })).toEqual({
      subject: 'A reminder: secrecy on your jobs with Made-up Plumbing',
      lines: ['It is on your page, under Pike Street clinic · Job 1180.', 'You can look. Nothing is sent from it.'],
    })
    const changed = builderSendEmail({ company: 'Made-up Plumbing', aboutJob: 'Pike Street clinic · Job 1180', note: '', why: 'changed' })
    expect(changed.subject).toBe('We changed the secrecy builder you looked at')
    expect(changed.lines[0]).toBe('It has changed since you opened it. The new one is on your page.')
  })

  it('names a job as their page does, and their page by its link', () => {
    expect(gcJobLabel({ job_name: ' Pike Street clinic ', hcp_number: '1180', click_number: null })).toBe('Pike Street clinic · Job 1180')
    expect(gcJobLabel({ job_name: '', hcp_number: null, click_number: 'C-77' })).toBe('Job C-77')
    expect(gcJobLabel({ job_name: 'Harbor annex', hcp_number: null, click_number: null })).toBe('Harbor annex')
    expect(gcJobLabel({ job_name: null, hcp_number: null, click_number: null })).toBe('Job')
    expect(customerPageUrl('https://app.example/', 'abc 123')).toBe('https://app.example/portal?t=abc%20123')
  })

  it('reads in plain words', () => {
    const texts = [BUILDER_SEND_NOTE, ...builderSendEmail({ company: 'a company', aboutJob: 'a job', note: '', why: 'first' }).lines, ...builderSendEmail({ company: 'a company', aboutJob: null, note: '', why: 'changed' }).lines, DOCUMENT_BUILDER_SEND_REFUSALS.notAGc.words, DOCUMENT_BUILDER_SEND_REFUSALS.notTheirJob.words]
    expect(texts.flatMap((t) => plainWordsFailures(t))).toEqual([])
  })
})

describe('where a GC\u2019s own page stands', () => {
  const on = { token: 'tok-on', revoked_at: null }
  const off = { token: 'tok-off', revoked_at: '2026-10-03T15:00:00Z' }

  it('is the view made for the jobs they are the GC on, else the whole account\u2019s', () => {
    expect(gcPageLink([{ audience: 'all', ...on, token: 'tok-all' }, { audience: 'gc', ...on, token: 'tok-gc' }])).toEqual({ state: 'on', token: 'tok-gc' })
    expect(gcPageLink([{ audience: 'all', ...on, token: 'tok-all' }, { audience: 'gc', ...off }])).toEqual({ state: 'on', token: 'tok-all' })
  })

  it('is none when no such page was ever made, and off once every one was turned off', () => {
    expect(gcPageLink([])).toEqual({ state: 'none' })
    // A link that shows only their own jobs is not a GC's page.
    expect(gcPageLink([{ audience: 'customer', ...on }])).toEqual({ state: 'none' })
    expect(gcPageLink([{ audience: 'all', ...off }, { audience: 'customer', ...on }])).toEqual({ state: 'off' })
    expect(gcPageFromLinks([{ audience: 'customer', revoked_at: null }])).toEqual({ state: 'none' })
    expect(gcPageFromLinks([{ audience: 'all', revoked_at: '2026-10-03T15:00:00Z' }])).toEqual({ state: 'off', offOn: '2026-10-03' })
    expect(gcPageFromLinks([{ audience: 'gc', revoked_at: null }])).toEqual({ state: 'on' })
  })
})

describe('the GCs a builder can go to', () => {
  const jobs = [
    { id: 'j1', gc_customer_id: 'northgate', job_name: 'Pike Street clinic', hcp_number: '1180', click_number: null },
    { id: 'j2', gc_customer_id: 'northgate', job_name: 'Harbor annex', hcp_number: '1204', click_number: null },
    { id: 'j3', gc_customer_id: 'harlan', job_name: 'Mill Road shell', hcp_number: '1190', click_number: null },
    { id: 'j4', gc_customer_id: 'quiet', job_name: 'Quiet Lane', hcp_number: null, click_number: null },
  ]
  const customers = [
    { id: 'quiet', name: 'Quiet Glass Builders', contact_info: null },
    { id: 'harlan', name: 'Harlan Construction', contact_info: { email: 'office@harlan.test' } },
    { id: 'northgate', name: 'Northgate Builders', contact_info: { email: 'desk@northgate.test', phone: '555' } },
  ]
  const people = [{ customer_id: 'northgate', name: 'Dana Whitlock', email: 'dana@northgate.test' }, { customer_id: 'northgate', name: 'No Email', email: null }]
  const links = [{ customer_id: 'northgate', audience: 'all', revoked_at: null }, { customer_id: 'harlan', audience: 'gc', revoked_at: '2026-10-03T15:00:00Z' }]
  const sendRow = { id: 's9', company_id: null, customer_id: 'harlan', about_job_id: 'j3', contact_name: 'Harlan Construction', contact_email: 'office@harlan.test', sent_at: '2026-11-18T18:00:00Z', sent_revision: 2, times_sent: 1, opened_at: null, opened_revision: null }

  it('is one row a GC, with their jobs, who can be sent to, where their page stands and the live send', () => {
    const got = builderPartiesFrom({ jobs, customers, people, links, sends: [sendRow] })
    // Who was sent to comes first, then the GC with the most jobs.
    expect(got.map((p) => p.id)).toEqual(['harlan', 'northgate', 'quiet'])
    const [harlan, northgate, quiet] = got
    expect(harlan).toMatchObject({ name: 'Harlan Construction', sub: '1 job with you', page: { state: 'off', offOn: '2026-10-03' }, contacts: [{ name: 'Harlan Construction', email: 'office@harlan.test' }] })
    expect(harlan?.send).toMatchObject({ id: 's9', contactEmail: 'office@harlan.test', about: 'Mill Road shell · Job 1190', sentRevision: 2 })
    expect(northgate).toMatchObject({ sub: '2 jobs with you', page: { state: 'on' }, send: null })
    expect(northgate?.contacts).toEqual([{ name: 'Northgate Builders', email: 'desk@northgate.test' }, { name: 'Dana Whitlock', email: 'dana@northgate.test' }])
    expect(northgate?.jobs).toEqual([{ id: 'j2', label: 'Harbor annex · Job 1204' }, { id: 'j1', label: 'Pike Street clinic · Job 1180' }])
    expect(quiet).toMatchObject({ page: { state: 'none' }, contacts: [], send: null })
  })

  it('says all their jobs for a send about none, and says so when the job has left them', () => {
    expect(builderPartiesFrom({ jobs, customers, people, links, sends: [{ ...sendRow, about_job_id: null }] })[0]?.send?.about).toBeNull()
    expect(builderPartiesFrom({ jobs, customers, people, links, sends: [{ ...sendRow, about_job_id: 'j1' }] })[0]?.send?.about).toBe('A job that is no longer theirs')
  })
})

describe('the words for a send the function refused', () => {
  it('are the key’s own words with no reason beside them, and the fallback with no answer at all', () => {
    expect(sendRefusalWords({ error: 'pageOff', words: DOCUMENT_BUILDER_SEND_REFUSALS.pageOff.words })).toBe(DOCUMENT_BUILDER_SEND_REFUSALS.pageOff.words)
    expect(sendRefusalWords(null)).toBe(DOCUMENT_BUILDER_SEND_REFUSALS.failed.words)
    expect(sendRefusalWords({ error: 'failed', words: '', detail: '  ' })).toBe(DOCUMENT_BUILDER_SEND_REFUSALS.failed.words)
  })
  it('never say Try again when the email went and only its record did not land', () => {
    const words = sendRefusalWords({ error: 'failed', words: DOCUMENT_BUILDER_SEND_REFUSALS.failed.words, detail: 'Sent, but not recorded: a made-up reason' })
    expect(words).toBe('The email went, but the send was not recorded here. Do not send it again. The reason: a made-up reason')
    expect(words).not.toMatch(/try again/i)
    expect(sendRefusalWords({ error: 'failed', words: 'x', detail: 'Sent, but not recorded: ' })).toBe('The email went, but the send was not recorded here. Do not send it again.')
  })
  it('read the function\u2019s own key for it, with the reason beside it and with none (punch list #416)', () => {
    const own = DOCUMENT_BUILDER_SEND_REFUSALS.sentNotRecorded
    expect(own).toEqual({ status: 500, words: 'The email went, but the send was not recorded here. Do not send it again.' })
    expect(own.words).not.toMatch(/try again/i)
    // The new function: its key, its words, and the database's reason alone in `detail`.
    expect(sendRefusalWords({ error: 'sentNotRecorded', words: own.words, detail: 'a made-up reason' })).toBe('The email went, but the send was not recorded here. Do not send it again. The reason: a made-up reason')
    expect(sendRefusalWords({ error: 'sentNotRecorded', words: own.words })).toBe(own.words)
    // The key alone decides: an answer whose words were lost on the way still never says to try again.
    expect(sendRefusalWords({ error: 'sentNotRecorded' })).toBe(own.words)
    expect(sendRefusalWords({ error: 'sentNotRecorded', words: 'Something went wrong. Try again in a moment.', detail: 'a made-up reason' })).not.toMatch(/try again/i)
  })
  it('read both functions the same: the one deployed before the key, and the one after', () => {
    const before = { error: 'failed', words: DOCUMENT_BUILDER_SEND_REFUSALS.failed.words, detail: 'Sent, but not recorded: a made-up reason' }
    const after = { error: 'sentNotRecorded', words: DOCUMENT_BUILDER_SEND_REFUSALS.sentNotRecorded.words, detail: 'a made-up reason' }
    expect(sendRefusalWords(before)).toBe(sendRefusalWords(after))
    expect(sendWentUnrecorded(before)).toBe(true)
    expect(sendWentUnrecorded(after)).toBe(true)
    // Every other refusal, and no answer at all, is a send that did not go.
    expect(sendWentUnrecorded({ error: 'sendFailed', words: 'x', detail: 'a made-up answer from the mail service' })).toBe(false)
    expect(sendWentUnrecorded({ error: 'failed', words: 'x', detail: 'The page was not made: a made-up reason' })).toBe(false)
    expect(sendWentUnrecorded({ error: 'failed' })).toBe(false)
    expect(sendWentUnrecorded(null)).toBe(false)
  })
  it('name the reason the function gave for any other refusal', () => {
    expect(sendRefusalWords({ error: 'sendFailed', words: DOCUMENT_BUILDER_SEND_REFUSALS.sendFailed.words, detail: 'a made-up answer from the mail service' })).toBe(
      'The email did not go. Nothing was recorded. Try again. The reason: a made-up answer from the mail service',
    )
  })
})
