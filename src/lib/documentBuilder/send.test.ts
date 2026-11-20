import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { firstName, resendPress, sendBatch, sendBatchOutcome, sendBox, sendChips, sendStanding, unreadGateWords, type SendParty, type SendRecord } from './send'

/** Made-up trades on a made-up job. */
const send = (over: Partial<SendRecord> = {}): SendRecord => ({ id: 's1', contactName: 'Ana Pruitt', about: null, sentOn: '2026-11-12', sentRevision: 1, timesSent: 1, openedOn: null, openedRevision: null, ...over })
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

  it('names the person on its press', () => {
    expect(firstName('Dana Whitlock')).toBe('Dana')
    expect(sendBox(party(), ana, OPEN)).toEqual({ note: { tone: 'quiet', words: 'They get an email with a link to their page. No login.' }, press: { label: 'Send to Ana', dead: false } })
  })

  it('makes a page for someone who never had one, and says so first', () => {
    expect(sendBox(party({ page: { state: 'none' } }), ana, OPEN)).toEqual({ note: { tone: 'warn', words: 'Cedar Fork Drain has no page yet. Sending makes one.' }, press: { label: 'Send to Ana', dead: false } })
  })

  it('never turns a page back on: the send is dead, and turning it on is its own press', () => {
    const box = sendBox(party({ page: { state: 'off', offOn: '2026-10-03' } }), ana, OPEN)
    expect(box.press.dead).toBe(true)
    expect(box.note).toEqual({ tone: 'warn', words: 'Their page was turned off on Oct 3. A send never turns a page back on.', turnOn: true })
  })

  it('is dead while nothing is published, with nobody to send to, and while an unread revision is not waved through', () => {
    expect(sendBox(party(), ana, { ...OPEN, published: false })).toEqual({ note: { tone: 'warn', words: "Publish this job's sheet first." }, press: { label: 'Send to Ana', dead: true } })
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
