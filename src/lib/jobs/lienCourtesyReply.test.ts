import { describe, expect, it } from 'vitest'
import {
  courtesyRepliedAt,
  courtesyRepliedAtByJob,
  courtesyReplyChannelKeys,
  courtesyReplyContacts,
  courtesyRepliesSince,
  emailChannelKey,
  lastCourtesyAtByJob,
  type CourtesyReplyNotice,
} from './lienCourtesyReply'

const record = (at: string) => ({ at, by: 'Grace', lienDay: '2027-01-15', claim: 4850, to: [{ who: 'original_contractor', channel: 'email', address: 'x@y.example', ok: true, id: 'e1', reason: '' }] })

describe('a reply in Messages closes the courtesy notice (punch list #249, row 3)', () => {
  it('emailChannelKey mirrors the spine: lower-cased, trimmed, nothing without an @', () => {
    expect(emailChannelKey('  Pat@Example.COM ')).toBe('pat@example.com')
    expect(emailChannelKey('no address')).toBe('')
    expect(emailChannelKey(null)).toBe('')
  })

  it('whose line counts: every contact on the GC’s customer row, and the contact whose channel holds the owner’s number or address', () => {
    const contacts = [
      { id: 'c-gc', customer_id: 'gc1' },
      { id: 'c-gc-pm', customer_id: 'gc1' },
      { id: 'c-other', customer_id: 'gc2' },
      { id: 'c-owner', customer_id: null },
      { id: 'c-owner-mail', customer_id: null },
    ]
    const channels = [
      { contact_id: 'c-owner', kind: 'phone', key: '2105550113' },
      { contact_id: 'c-owner-mail', kind: 'email', key: 'owner@example.com' },
      { contact_id: 'c-other', kind: 'phone', key: '2105550199' },
      { contact_id: 'c-gc', kind: 'phone', key: null },
    ]
    const party = { gcCustomerId: 'gc1', ownerPhone: '1 (210) 555-0113', ownerEmail: 'Owner@Example.com' }
    expect(courtesyReplyContacts(party, contacts, channels).sort()).toEqual(['c-gc', 'c-gc-pm', 'c-owner', 'c-owner-mail'])
    // No GC on the job, no owner number: nothing is matched by accident.
    expect(courtesyReplyContacts({ gcCustomerId: null, ownerPhone: '', ownerEmail: '' }, contacts, channels)).toEqual([])
    // A number the spine would keep no channel for matches nothing.
    expect(courtesyReplyContacts({ gcCustomerId: null, ownerPhone: '555', ownerEmail: '' }, contacts, channels)).toEqual([])
    // A phone key never matches an email channel of the same text, and the other way round.
    expect(courtesyReplyContacts({ gcCustomerId: null, ownerPhone: '', ownerEmail: '2105550113' }, contacts, channels)).toEqual([])
  })

  it('the channel keys to read, once each', () => {
    expect(
      courtesyReplyChannelKeys([
        { ownerPhone: '(210) 555-0113', ownerEmail: 'Owner@Example.com' },
        { ownerPhone: '210-555-0113', ownerEmail: '' },
        { ownerPhone: '', ownerEmail: 'no address' },
      ]),
    ).toEqual(['2105550113', 'owner@example.com'])
  })

  it('the newest courtesy per job comes off the first packet, as courtesyByJobFrom reads it; a packet with no record is left out', () => {
    const items = [
      { id: 'first', fields: { courtesy: [record('2026-10-31T14:00:00.000Z'), record('2026-10-20T14:00:00.000Z')] } },
      { id: 'bare', fields: { notice: {} } },
      { id: 'junk', fields: { courtesy: 'not a list' } },
    ]
    expect(lastCourtesyAtByJob({ j1: { firstItemId: 'first' }, j2: { firstItemId: 'bare' }, j3: { firstItemId: 'junk' }, j4: { firstItemId: null }, j5: undefined }, items)).toEqual({ j1: '2026-10-31T14:00:00.000Z' })
  })

  const notice: CourtesyReplyNotice = { jobId: 'j1', lastCourtesyAt: '2026-10-31T14:00:00.000Z', contactIds: ['c-gc', 'c-owner'] }

  it('the newest inbound line after the last courtesy on any of the notice’s contacts closes it, normalised to the record’s Z form', () => {
    const lines = [
      { contactId: 'c-gc', at: '2026-11-01T09:00:00+00:00' },
      { contactId: 'c-owner', at: '2026-11-02T16:30:00.5+00:00' },
      { contactId: 'c-gc', at: '2026-10-31T13:59:00+00:00' },
      { contactId: 'c-stranger', at: '2026-11-03T09:00:00+00:00' },
    ]
    expect(courtesyRepliedAt(notice, lines)).toBe('2026-11-02T16:30:00.500Z')
    // The answer compares above the record's own `at` as a string, which is what courtesyStatus does.
    expect(courtesyRepliedAt(notice, lines)! > notice.lastCourtesyAt).toBe(true)
  })

  it('a line before or at the last courtesy, on a stranger’s thread, or with no instant closes nothing', () => {
    expect(courtesyRepliedAt(notice, [{ contactId: 'c-gc', at: '2026-10-31T14:00:00+00:00' }])).toBeNull()
    expect(courtesyRepliedAt(notice, [{ contactId: 'c-stranger', at: '2026-11-03T09:00:00Z' }])).toBeNull()
    expect(courtesyRepliedAt(notice, [{ contactId: 'c-gc', at: 'yesterday' }])).toBeNull()
    expect(courtesyRepliedAt({ ...notice, lastCourtesyAt: '' }, [{ contactId: 'c-gc', at: '2026-11-03T09:00:00Z' }])).toBeNull()
    expect(courtesyRepliedAt(notice, [])).toBeNull()
  })

  it('by job: each notice reads its own contacts and its own clock; a job nobody answered is left out', () => {
    const two: CourtesyReplyNotice[] = [notice, { jobId: 'j2', lastCourtesyAt: '2026-11-02T00:00:00.000Z', contactIds: ['c-gc'] }]
    const lines = [{ contactId: 'c-gc', at: '2026-11-01T09:00:00+00:00' }]
    expect(courtesyRepliedAtByJob(two, lines)).toEqual({ j1: '2026-11-01T09:00:00.000Z' })
    // The same thread answers two jobs at once when both notices are older than the line.
    expect(courtesyRepliedAtByJob(two, [{ contactId: 'c-gc', at: '2026-11-05T09:00:00Z' }])).toEqual({ j1: '2026-11-05T09:00:00.000Z', j2: '2026-11-05T09:00:00.000Z' })
  })

  it('the read’s floor is the oldest last courtesy', () => {
    expect(courtesyRepliesSince([{ lastCourtesyAt: '2026-11-02T00:00:00.000Z' }, { lastCourtesyAt: '2026-10-31T14:00:00+00:00' }])).toBe('2026-10-31T14:00:00.000Z')
    expect(courtesyRepliesSince([])).toBeNull()
    expect(courtesyRepliesSince([{ lastCourtesyAt: 'nope' }])).toBeNull()
  })
})
