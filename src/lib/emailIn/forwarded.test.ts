import { describe, expect, it } from 'vitest'
import { readForwarded, readForwardedWhen } from './forwarded'

const rosa = { name: 'Rosa Diaz', address: 'rosa@clickconstruction.example' }
const isOurs = (a: string) => a.toLowerCase().endsWith('@clickconstruction.example')

describe('readForwarded: a copy one of us sent on to bids@', () => {
  it("reads Gmail's block: the first sender, the subject, the time, the words and the forwarder's note", () => {
    const text = [
      'Please put this on Fair Oaks.',
      '',
      '---------- Forwarded message ---------',
      'From: Elena Marchetti <elena@cibolocreek.example>',
      'Date: Thu, Oct 1, 2026 at 4:02 PM',
      'Subject: Pay application 3',
      'To: Rosa Diaz <rosa@clickconstruction.example>',
      '',
      'Rosa, the check for pay application 3 goes out Friday.',
      '',
      'Elena',
    ].join('\n')
    expect(readForwarded({ from: rosa, text }, isOurs)).toEqual({
      from: { name: 'Elena Marchetti', address: 'elena@cibolocreek.example' },
      by: rosa,
      to: [{ name: 'Rosa Diaz', address: 'rosa@clickconstruction.example' }],
      subject: 'Pay application 3',
      at: '2026-10-01T21:02:00.000Z',
      text: 'Rosa, the check for pay application 3 goes out Friday.\n\nElena',
      note: 'Please put this on Fair Oaks.',
    })
  })

  it("reads Apple Mail's block, with its time zone", () => {
    const text = ['Begin forwarded message:', '', 'From: Jonah Vale <jonah@marshvale.example>', 'Subject: Addendum 2', 'Date: October 1, 2026 at 4:02:12 PM EDT', 'To: Rosa <rosa@clickconstruction.example>', '', 'Here it is.'].join('\n')
    const f = readForwarded({ from: rosa, text }, isOurs)!
    expect(f.from.address).toBe('jonah@marshvale.example')
    expect(f.at).toBe('2026-10-01T20:02:12.000Z')
    expect(f.note).toBeNull()
    expect(f.text).toBe('Here it is.')
  })

  it("reads Outlook's block, bold field names and a Sent line", () => {
    const text = ['FYI', '________________________________', '*From:* Dee <dee@alamoconcrete.example>', '*Sent:* Thursday, October 1, 2026 4:02 PM', '*To:* Rosa Diaz <rosa@clickconstruction.example>', '*Subject:* Flatwork', '', 'Our quote is attached.'].join('\n')
    const f = readForwarded({ from: rosa, text }, isOurs)!
    expect(f.from).toEqual({ name: 'Dee', address: 'dee@alamoconcrete.example' })
    expect(f.subject).toBe('Flatwork')
    expect(f.at).toBe('2026-10-01T21:02:00.000Z')
    expect(f.note).toBe('FYI')
  })

  it('is no forward when someone outside forwards, with no block, or with no address in the block', () => {
    const text = '---------- Forwarded message ---------\nFrom: Elena <elena@cibolocreek.example>\n\nHi'
    expect(readForwarded({ from: { name: null, address: 'gc@builder.example' }, text }, isOurs)).toBeNull()
    expect(readForwarded({ from: rosa, text: 'Just a note to bids@.' }, isOurs)).toBeNull()
    expect(readForwarded({ from: rosa, text: '---------- Forwarded message ---------\nFrom: Elena\n\nHi' }, isOurs)).toBeNull()
    expect(readForwarded({ from: null, text }, isOurs)).toBeNull()
  })

  it('reads a block where a field runs onto a second line', () => {
    const text = '---------- Forwarded message ---------\nFrom: Elena <elena@cibolocreek.example>\nTo: Rosa <rosa@clickconstruction.example>,\n Robert <robert@clickconstruction.example>\n\nHi'
    expect(readForwarded({ from: rosa, text }, isOurs)!.to.map((a) => a.address)).toEqual(['rosa@clickconstruction.example', 'robert@clickconstruction.example'])
  })
})

describe('readForwardedWhen', () => {
  it('reads the ways mail programs write a day, in Chicago when no zone is given', () => {
    expect(readForwardedWhen('Thu, Oct 1, 2026 at 4:02 PM')).toBe('2026-10-01T21:02:00.000Z')
    expect(readForwardedWhen('Thursday, October 1, 2026 4:02 PM')).toBe('2026-10-01T21:02:00.000Z')
    expect(readForwardedWhen('Sept 30, 2026 at 12:05 AM')).toBe('2026-09-30T05:05:00.000Z')
    expect(readForwardedWhen('Jan 5, 2026 at 9:00 AM')).toBe('2026-01-05T15:00:00.000Z')
    expect(readForwardedWhen('Mon 5 Oct, then October 6, 2026 at 8:00 AM CDT')).toBe('2026-10-06T13:00:00.000Z')
    expect(readForwardedWhen('2026-10-01 16:02')).toBeNull()
    expect(readForwardedWhen('Oct 1, 2026 at 25:00')).toBeNull()
  })
})
