import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { plainSentence } from '../valuesInPlace'
import { ABOUT_ALL_JOBS, SEND_LIST_FIRST_ROWS, aboutChoices, aboutJobId, pressName, resendPress, resendTo, shownParties, sendBatch, sendBatchOutcome, sendBox, sendChips, sendStanding, sentWords, unreadGateWords, type SendParty, type SendRecord } from './send'

/** Made-up trades on a made-up job. */
const send = (over: Partial<SendRecord> = {}): SendRecord => ({ id: 's1', contactName: 'Ana Pruitt', contactEmail: 'ana@cedarfork.test', about: null, sentOn: '2026-11-12', sentRevision: 1, timesSent: 1, openedOn: null, openedRevision: null, ...over })
const party = (over: Partial<SendParty> = {}): SendParty => ({ id: 'cedarfork', name: 'Cedar Fork Drain', page: { state: 'on' }, contacts: [{ name: 'Ana Pruitt', email: 'ana@cedarfork.test', role: 'owner' }], send: null, ...over })
const OPEN = { published: true, unpublishedWords: "Publish this job's sheet first.", unread: '', anyway: false }

describe('where a send stands', () => {
  it('is not sent, then sent, then opened', () => {
    expect(sendStanding(null, 1)).toBe('not-sent')
    expect(sendStanding(send(), 1)).toBe('sent')
    expect(sendStanding(send({ openedOn: '2026-11-14', openedRevision: 1 }), 1)).toBe('opened')
  })

  it('is changed once a new revision is out that they have not been told of', () => {
    const opened = send({ openedOn: '2026-11-14', openedRevision: 1 })
    expect(sendStanding(opened, 2)).toBe('changed')
    expect(resendPress(opened, 2)).toEqual({ why: 'changed', label: 'Tell them it changed' })
    expect(resendPress(opened, 1)).toEqual({ why: 'again', label: 'Send it again' })
  })

  it('reads as sent and not opened once they were told, until they open the new one', () => {
    const told = send({ openedOn: '2026-11-14', openedRevision: 1, sentRevision: 2, sentOn: '2026-11-24', timesSent: 2 })
    expect(sendStanding(told, 2)).toBe('sent')
    expect(sendStanding({ ...told, openedOn: '2026-11-25', openedRevision: 2 }, 2)).toBe('opened')
  })
})

describe('who the second press goes to', () => {
  /** Two people at one made-up trade who share a name. The second is the one the send went to. */
  const owner = { name: 'Ana Pruitt', email: 'ana@cedarfork.test', role: 'owner' }
  const office = { name: 'Ana Pruitt', email: 'office@cedarfork.test', role: 'office' }

  it('is nobody with no send', () => {
    expect(resendTo(party())).toBeNull()
  })

  it('is the person the send went to, by the address on its own row, and says who', () => {
    const got = resendTo(party({ contacts: [owner, office], send: send({ contactEmail: 'Office@CedarFork.test' }) }))
    expect(got?.to).toEqual(office)
    expect(plainSentence(got?.words ?? '')).toBe('It goes to Ana Pruitt at office@cedarfork.test.')
    expect(resendTo(party({ contacts: [owner, office], send: send() }))?.to).toEqual(owner)
  })

  it('reads the address alone for someone with no name on the record', () => {
    const desk = { name: 'desk@cedarfork.test', email: 'desk@cedarfork.test' }
    expect(plainSentence(resendTo(party({ contacts: [desk], send: send({ contactName: 'desk@cedarfork.test', contactEmail: 'desk@cedarfork.test' }) }))?.words ?? '')).toBe('It goes to desk@cedarfork.test.')
  })

  it('never goes to someone else once that person is off the record, namesake or not', () => {
    const got = resendTo(party({ contacts: [owner], send: send({ contactEmail: 'office@cedarfork.test' }) }))
    expect(got?.to).toBeNull()
    expect(plainSentence(got?.words ?? '')).toBe('Ana Pruitt at office@cedarfork.test is no longer on the record of Cedar Fork Drain. Take it off their page, then send it to someone who is.')
    expect(resendTo(party({ contacts: [], send: send() }))?.to).toBeNull()
  })

  it('goes by name for a row that kept no address, only when one person alone carries the name', () => {
    expect(resendTo(party({ contacts: [owner, { name: 'Bo Reyes', email: 'bo@cedarfork.test' }], send: send({ contactEmail: '' }) }))?.to).toEqual(owner)
    const two = resendTo(party({ contacts: [owner, office], send: send({ contactEmail: '' }) }))
    expect(two?.to).toBeNull()
    expect(plainSentence(two?.words ?? '')).toBe('2 people at Cedar Fork Drain are named Ana Pruitt, and this send does not say which. Take it off their page, then send it to the one you mean.')
    const gone = resendTo(party({ contacts: [{ name: 'Bo Reyes', email: 'bo@cedarfork.test' }], send: send({ contactEmail: '' }) }))
    expect(gone?.to).toBeNull()
    expect(plainSentence(gone?.words ?? '')).toBe('Ana Pruitt is no longer on the record of Cedar Fork Drain. Take it off their page, then send it to someone who is.')
  })

  it('reads in plain words', () => {
    const lines = [
      resendTo(party({ contacts: [owner, office], send: send() })),
      resendTo(party({ contacts: [owner], send: send({ contactEmail: 'office@cedarfork.test' }) })),
      resendTo(party({ contacts: [owner, office], send: send({ contactEmail: '' }) })),
      resendTo(party({ contacts: [], send: send({ contactEmail: '' }) })),
    ].map((r) => plainSentence(r?.words ?? '').replace(/\S+@\S+\.test/g, 'an address'))
    expect(lines.flatMap((t) => plainWordsFailures(t))).toEqual([])
  })
})

describe('what a send to a GC is about', () => {
  const gc = party({ id: 'northgate', name: 'Northgate Builders', jobs: [{ id: 'j1', label: 'Pike Street clinic · Job 1180' }, { id: 'j2', label: 'Harbor annex · Job 1204' }] })

  it('offers all their jobs first, then each job', () => {
    expect(aboutChoices(gc)).toEqual([
      { value: ABOUT_ALL_JOBS, label: 'All their jobs with you' },
      { value: 'j1', label: 'Pike Street clinic · Job 1180' },
      { value: 'j2', label: 'Harbor annex · Job 1204' },
    ])
    expect(aboutChoices(party())).toEqual([{ value: ABOUT_ALL_JOBS, label: 'All their jobs with you' }])
  })

  it('is all their jobs when nobody picks, and never a job that is not theirs', () => {
    expect(aboutJobId(gc, ABOUT_ALL_JOBS)).toBeNull()
    expect(aboutJobId(gc, 'j2')).toBe('j2')
    expect(aboutJobId(gc, 'someone-elses-job')).toBeNull()
  })
})

describe('the rows a long list shows', () => {
  const many = Array.from({ length: SEND_LIST_FIRST_ROWS + 5 }, (_, i) => party({ id: `gc${i}`, name: `Made-up Builders ${i}` }))
  const sent = party({ id: 'northgate', name: 'Northgate Builders', send: send() })

  it('is everyone, with no find box', () => {
    expect(shownParties([...many, sent], null)).toEqual({ rows: [...many, sent], more: 0 })
  })

  it('is who was sent to and the first few others until someone types, with how many more', () => {
    const got = shownParties([...many, sent], '')
    expect(got.rows[0]).toBe(sent)
    expect(got.rows).toHaveLength(1 + SEND_LIST_FIRST_ROWS)
    expect(got.more).toBe(5)
  })

  it('is every party whose name holds each word typed', () => {
    expect(shownParties([...many, sent], ' north  build ').rows).toEqual([sent])
    expect(shownParties([...many, sent], 'builders 16').rows.map((p) => p.id)).toEqual(['gc16'])
    expect(shownParties([...many, sent], 'nobody at all')).toEqual({ rows: [], more: 0 })
  })
})

describe('the chips on a row', () => {
  it('say nothing for a party with a page and no send, and say so for no page or a page that is off', () => {
    expect(sendChips(party(), 1, { showAbout: false })).toEqual([])
    expect(sendChips(party({ page: { state: 'none' } }), 1, { showAbout: false })).toEqual([{ tone: 'wait', words: 'No page yet' }])
    expect(sendChips(party({ page: { state: 'off', offOn: '2026-10-03' } }), 1, { showAbout: false })).toEqual([{ tone: 'warn', words: 'Their page is off' }])
  })

  it('name who it went to and the day, then whether they opened it', () => {
    expect(sendChips(party({ send: send() }), 1, { showAbout: false })).toEqual([
      { tone: 'wait', words: 'Sent Nov 12 to Ana Pruitt' },
      { tone: 'warn', words: 'Not opened yet' },
    ])
    expect(sendChips(party({ send: send({ openedOn: '2026-11-14', openedRevision: 1 }) }), 1, { showAbout: false })).toEqual([
      { tone: 'wait', words: 'Sent Nov 12 to Ana Pruitt' },
      { tone: 'ok', words: 'Opened Nov 14' },
    ])
  })

  it('say how many times it went once it went more than once, with the last day', () => {
    expect(sentWords(send())).toBe('Sent Nov 12 to Ana Pruitt')
    // Sent again on the day of the first send: the day is the same, and the row still changes.
    expect(sentWords(send({ timesSent: 2 }))).toBe('Sent 2 times, last Nov 12 to Ana Pruitt')
    expect(sentWords(send({ timesSent: 3, sentOn: '2026-11-24' }))).toBe('Sent 3 times, last Nov 24 to Ana Pruitt')
    expect(sendChips(party({ send: send({ timesSent: 2 }) }), 1, { showAbout: false })).toEqual([
      { tone: 'wait', words: 'Sent 2 times, last Nov 12 to Ana Pruitt' },
      { tone: 'warn', words: 'Not opened yet' },
    ])
    expect(plainWordsFailures(sentWords(send({ timesSent: 2 })))).toEqual([])
  })

  it('say it changed since they opened it, and for a GC what it is about', () => {
    expect(sendChips(party({ send: send({ openedOn: '2026-11-14', openedRevision: 1, about: 'J1180 Pike Street clinic' }) }), 2, { showAbout: true })).toEqual([
      { tone: 'wait', words: 'Sent Nov 12 to Ana Pruitt' },
      { tone: 'ok', words: 'Opened Nov 14' },
      { tone: 'wait', words: 'J1180 Pike Street clinic' },
      { tone: 'warn', words: 'Changed since they opened it' },
    ])
    expect(sendChips(party({ send: send() }), 1, { showAbout: true })[2]).toEqual({ tone: 'wait', words: 'All their jobs' })
  })
})

describe('the box that sends to one', () => {
  const ana = party().contacts[0] ?? null

  it('names the contact whole on its press, never by a first word alone', () => {
    expect(pressName({ name: 'Dana Whitlock', email: 'dana@northgate.test' })).toBe('Dana Whitlock')
    // A GC's first contact is the customer's own record, named for the company. A contact can be a desk, or a test row.
    expect(pressName({ name: 'Northgate Builders', email: 'office@northgate.test' })).toBe('Northgate Builders')
    expect(pressName({ name: 'Accounts Payable', email: 'ap@northgate.test' })).toBe('Accounts Payable')
    expect(pressName({ name: 'ZZ Test Sink', email: 'sink@zz.test' })).toBe('ZZ Test Sink')
    expect(pressName({ name: '  Dana   Whitlock ', email: 'dana@northgate.test' })).toBe('Dana Whitlock')
    // A record that keeps no name reads by its address.
    expect(pressName({ name: ' ', email: 'office@northgate.test' })).toBe('office@northgate.test')
    expect(sendBox(party(), { name: 'ZZ Test Sink', email: 'sink@zz.test' }, OPEN).press.label).toBe('Send to ZZ Test Sink')
    expect(sendBox(party(), ana, OPEN)).toEqual({ note: { tone: 'quiet', words: 'They get an email with a link to their page. No login.' }, press: { label: 'Send to Ana Pruitt', dead: false } })
  })

  it('makes a page for someone who never had one, and says so first', () => {
    expect(sendBox(party({ page: { state: 'none' } }), ana, OPEN)).toEqual({ note: { tone: 'warn', words: 'Cedar Fork Drain has no page yet. Sending makes one.' }, press: { label: 'Send to Ana Pruitt', dead: false } })
  })

  it('never turns a page back on: the send is dead, and turning it on is its own press', () => {
    const box = sendBox(party({ page: { state: 'off', offOn: '2026-10-03' } }), ana, OPEN)
    expect(box.press.dead).toBe(true)
    expect(box.note).toEqual({ tone: 'warn', words: 'Their page was turned off on Oct 3. A send never turns a page back on.', turnOn: true })
  })

  it('is dead while nothing is published, with nobody to send to, and while an unread revision is not waved through', () => {
    expect(sendBox(party(), ana, { ...OPEN, published: false })).toEqual({ note: { tone: 'warn', words: "Publish this job's sheet first." }, press: { label: 'Send to Ana Pruitt', dead: true } })
    expect(sendBox(party({ contacts: [] }), null, OPEN).press).toEqual({ label: 'Send', dead: true })
    const unread = { ...OPEN, unread: 'Your insurance agent has not checked your usual sheet.' }
    expect(sendBox(party(), ana, unread).press.dead).toBe(true)
    expect(sendBox(party(), ana, { ...unread, anyway: true }).press.dead).toBe(false)
    expect(unreadGateWords(unread.unread)).toBe('Your insurance agent has not checked your usual sheet. Send it anyway.')
  })
})

describe('the one press for everyone who is ready', () => {
  const parties = [
    party({ send: send() }),
    party({ id: 'lonemesa', name: 'Lone Mesa Excavation', contacts: [{ name: 'Ben Winters', email: 'ben@lonemesa.test' }] }),
    party({ id: 'pecos', name: 'Pecos Insulation', contacts: [{ name: 'Gil Marsh', email: 'gil@pecos.test' }] }),
    party({ id: 'hilltop', name: 'Hilltop Electric', page: { state: 'none' } }),
    party({ id: 'tollgate', name: 'Tollgate Mechanical', page: { state: 'off', offOn: '2026-10-03' } }),
    party({ id: 'quiet', name: 'Quiet Glass', contacts: [] }),
  ]

  it('says its count, acts on those with a page that is on, and names who it held and why', () => {
    const batch = sendBatch(parties, 'trade', { published: true, unread: '', anyway: false })
    expect(batch.ready.map((p) => p.id)).toEqual(['lonemesa', 'pecos'])
    expect(batch.press).toEqual({ label: 'Send to 2 trades who are ready', dead: false })
    expect(batch.held.map((h) => h.why)).toEqual(['Held: Hilltop Electric has no page yet. Send to them alone to make one.', 'Held: Tollgate Mechanical. Their page is off.', 'Held: Quiet Glass has nobody with an email to send to.'])
  })

  it('leaves a trade that was asked and not awarded out of the one press, and says to send to them alone', () => {
    const asked = [...parties, party({ id: 'brazos', name: 'Brazos Fire Sprinkler', alone: true, contacts: [{ name: 'Lee Ortiz', email: 'lee@brazos.test' }] }), party({ id: 'caddo', name: 'Caddo Roofing', alone: true, page: { state: 'none' } })]
    const batch = sendBatch(asked, 'trade', { published: true, unread: '', anyway: false })
    expect(batch.ready.map((p) => p.id)).toEqual(['lonemesa', 'pecos'])
    expect(batch.press.label).toBe('Send to 2 trades who are ready')
    expect(batch.held.map((h) => h.why).slice(-2)).toEqual(['Held: Brazos Fire Sprinkler was asked and not awarded. Send to them alone.', 'Held: Caddo Roofing was asked and not awarded. Send to them alone.'])
    // A job still being bid has no awarded trade: the one press is dead, and each row's own press still sends.
    const bidding = sendBatch(asked.slice(-2), 'trade', { published: true, unread: '', anyway: false })
    expect(bidding.press).toEqual({ label: 'Nothing to send', dead: true })
    expect(sendBox(asked[asked.length - 2]!, asked[asked.length - 2]!.contacts[0]!, { published: true, unpublishedWords: '', unread: '', anyway: false }).press.dead).toBe(false)
  })

  it('reads in the singular for one, and is dead with nobody ready', () => {
    expect(sendBatch(parties.slice(0, 2), 'trade', { published: true, unread: '', anyway: false }).press.label).toBe('Send to 1 trade who is ready')
    expect(sendBatch(parties.slice(0, 2), ['GC', 'GCs'], { published: true, unread: '', anyway: false }).press.label).toBe('Send to 1 GC who is ready')
    expect(sendBatch(parties.slice(3), 'trade', { published: true, unread: '', anyway: false }).press).toEqual({ label: 'Nothing to send', dead: true })
  })

  it('is dead while nothing is published, and while an unread revision is not waved through', () => {
    expect(sendBatch(parties, 'trade', { published: false, unread: '', anyway: false }).press.dead).toBe(true)
    expect(sendBatch(parties, 'trade', { published: true, unread: 'No attorney has read revision 2.', anyway: false }).press.dead).toBe(true)
    expect(sendBatch(parties, 'trade', { published: true, unread: 'No attorney has read revision 2.', anyway: true }).press.dead).toBe(false)
  })

  it('says afterwards what went, what was held and what did not go', () => {
    expect(sendBatchOutcome(2, 3, 0, 'trade')).toBe('Sent to 2 trades. Held 3.')
    expect(sendBatchOutcome(1, 0, 1, 'trade')).toBe('Sent to 1 trade. 1 did not send.')
    expect(sendBatchOutcome(0, 0, 2, 'trade')).toBe('Nothing sent. 2 did not send.')
  })

  it('reads in plain words', () => {
    const batch = sendBatch(parties, 'trade', { published: true, unread: '', anyway: false })
    const texts = [...batch.held.map((h) => h.why), batch.press.label, sendBatchOutcome(2, 3, 1, 'trade'), sendBox(party({ page: { state: 'off', offOn: '2026-10-03' } }), null, OPEN).note?.words ?? '', sendBox(party({ page: { state: 'none' } }), party().contacts[0] ?? null, OPEN).note?.words ?? '']
    expect(texts.flatMap((t) => plainWordsFailures(t))).toEqual([])
  })
})
