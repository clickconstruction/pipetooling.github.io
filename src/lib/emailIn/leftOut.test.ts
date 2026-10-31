import { describe, expect, it } from 'vitest'
import { BODY_FOOT_LINES, bulkByBody, leftOut, outsideInbox } from './leftOut'
import { isOwnAddress, ownChannels } from '../messages/ownChannels'
import { kitCarries, type WalkKit } from '../walk/kit'

const THE_BOX = new Set(['bids@clickconstruction.example', 'app@clickconstruction.example'])
const isTheBox = (a: string) => THE_BOX.has(a.toLowerCase())

const email = (over: { labels?: string[]; from?: string; headers?: Record<string, string>; text?: string } = {}) => ({
  labels: over.labels ?? ['INBOX', 'CATEGORY_PERSONAL'],
  from: { name: null, address: over.from ?? 'greg@hillside.example' },
  headers: over.headers ?? {},
  ...(over.text === undefined ? {} : { text: over.text }),
})

// Made-up mail of the three kinds New held on 2026-10-30 (punch list #223): a newsletter with no list header, a bid
// platform's invitation with its footer, and a person's plain words. Nothing here is a real sender.
const NEWSLETTER = [
  'Five surety trends for Texas contractors',
  'Bond capacity is loosening for subs with clean WIP schedules. Here is what we are seeing this quarter.',
  '1. Underwriters want quarterly financials.',
  '2. Single-job limits are up for mechanical trades.',
  'Read the full article on our site.',
  'Alamo Surety Partners · 100 Example St, San Antonio, TX',
  'You are receiving this email because you signed up for our newsletter.',
  'Unsubscribe | Manage your preferences | View this email in your browser',
].join('\n')

const INVITATION = [
  'Ridgeway Builders invites you to bid on Oak Hill Clinic, Boerne.',
  'Trade: Plumbing. Bids are due Thursday, November 12 at 2:00 PM.',
  'Open the invitation on BuildLink to download the plans.',
  'You are receiving this because Ridgeway Builders invited you to bid through BuildLink.',
  'To stop receiving invitations from this contractor, update your BuildLink settings.',
].join('\n')

const PERSON = 'Greg here. We can start the pad Monday if the permit is in. Who do we check in with on site?'


describe('leftOut: the mail the reader leaves in Gmail', () => {
  it('takes a person writing to the Inbox', () => {
    expect(leftOut(email(), isTheBox)).toBeNull()
  })

  it('leaves out spam and trash, then anything not in the Inbox', () => {
    expect(leftOut(email({ labels: ['SPAM', 'INBOX'] }), isTheBox)).toBe('spamOrTrash')
    expect(leftOut(email({ labels: ['TRASH'] }), isTheBox)).toBe('spamOrTrash')
    expect(leftOut(email({ labels: ['SENT'] }), isTheBox)).toBe('notInbox')
    expect(outsideInbox(email())).toBeNull()
  })

  it("leaves out the box's own address and the app's, in any case, and takes a teammate's mail (v2.5722)", () => {
    expect(leftOut(email({ from: 'Bids@ClickConstruction.example' }), isTheBox)).toBe('ours')
    expect(leftOut(email({ from: 'app@clickconstruction.example' }), isTheBox)).toBe('ours')
    expect(leftOut(email({ from: 'Rosa@ClickConstruction.example' }), isTheBox)).toBeNull()
  })

  it('leaves out lists, bulk and mail a machine sent, an out-of-office reply too', () => {
    expect(leftOut(email({ headers: { 'list-unsubscribe': '<mailto:x@y.example>' } }), isTheBox)).toBe('bulk')
    expect(leftOut(email({ headers: { 'list-id': 'news.y.example' } }), isTheBox)).toBe('bulk')
    expect(leftOut(email({ headers: { precedence: 'Bulk' } }), isTheBox)).toBe('bulk')
    expect(leftOut(email({ headers: { 'auto-submitted': 'auto-replied' } }), isTheBox)).toBe('bulk')
    expect(leftOut(email({ headers: { 'auto-submitted': 'no' } }), isTheBox)).toBeNull()
  })

  it('leaves out a no-reply sender and a bounce', () => {
    for (const from of ['noreply@y.example', 'no-reply@y.example', 'do-not-reply@y.example', 'DoNotReply@y.example', 'mailer-daemon@y.example', 'notifications+abc@y.example', 'bounce-123@y.example']) {
      expect(leftOut(email({ from }), isTheBox)).toBe('noReply')
    }
    expect(leftOut(email({ from: 'norma@y.example' }), isTheBox)).toBeNull()
  })

  it("leaves out a newsletter by its foot when it has no list header (v2.6200), and takes a platform's invitation with its footer", () => {
    expect(leftOut(email({ text: NEWSLETTER }), isTheBox)).toBe('bulk')
    expect(leftOut(email({ text: INVITATION }), isTheBox)).toBeNull()
    expect(leftOut(email({ text: PERSON }), isTheBox)).toBeNull()
    // No body given: the headers alone decide, as before.
    expect(leftOut(email(), isTheBox)).toBeNull()
    // The headers still come first: a list header on an invitation is bulk by the header.
    expect(leftOut(email({ text: INVITATION, headers: { 'list-id': 'news.y.example' } }), isTheBox)).toBe('bulk')
  })

  it("leaves out Gmail's Promotions, Social, Updates and Forums", () => {
    for (const c of ['CATEGORY_PROMOTIONS', 'CATEGORY_SOCIAL', 'CATEGORY_UPDATES', 'CATEGORY_FORUMS']) {
      expect(leftOut(email({ labels: ['INBOX', c] }), isTheBox)).toBe('category')
    }
  })
})

describe('bulkByBody: the foot of a body as a list signs it (v2.6200)', () => {
  it('reads each cue, in any case, on its own line or beside others', () => {
    for (const foot of [
      'Unsubscribe',
      'Click here to unsubscribe from this list.',
      'View this email in your browser',
      'View it online',
      'View in browser',
      "You're receiving this email because you opted in at our booth.",
      'You received this message because you are on our list.',
      'Manage your email preferences',
      'Update preferences | Forward to a friend',
    ]) {
      expect(bulkByBody(`Some words first.\n\n${foot}`), foot).toBe(true)
    }
  })

  it("never reads a platform's footer as a list, since it names the reader's choice about a contractor's invitations", () => {
    expect(bulkByBody(INVITATION)).toBe(false)
    expect(bulkByBody('You are receiving this because Ridgeway Builders invited you to bid.')).toBe(false)
    expect(bulkByBody('To unsubscribe from invitations from this contractor, press here.')).toBe(false)
    // The same words with no invitation, bid or contractor in the line are a list's.
    expect(bulkByBody('To unsubscribe from these emails, press here.')).toBe(true)
  })

  it('reads only the foot: a cue buried above the last lines is quoted words, not a sign-off', () => {
    const filler = Array.from({ length: BODY_FOOT_LINES }, (_, i) => `Line ${i + 1} of a long email about the pad.`).join('\n')
    expect(bulkByBody(`Please unsubscribe me from the old list, I moved companies.\n${filler}`)).toBe(false)
    expect(bulkByBody(`${filler}\nUnsubscribe`)).toBe(true)
    expect(bulkByBody('')).toBe(false)
    expect(bulkByBody(PERSON)).toBe(false)
  })
})

describe("the walk kit's rule (punch list #142 PR 1): our own address is a person only while the kit's contact carries it", () => {
  // As gmail-sync's loadTeam composes it: the box set answers false for an own address the kit carries.
  const own = ownChannels(null, 'app@clickconstruction.example', ['bids@clickconstruction.example'])
  const kit: WalkKit = {
    customerId: 'cu-walk',
    contactId: 'c-walk',
    emailChannelId: 'ch-walk-email',
    phoneChannelId: null,
    estimateId: null,
    email: 'bids@clickconstruction.example',
    phone: null,
    testerId: null,
    sharedPhone: false,
    madeAt: null,
  }
  const theBoxWith = (k: WalkKit | null) => (a: string) => !(isOwnAddress(own, a) && kitCarries(k, 'email', a)) && isOwnAddress(own, a)

  it('takes mail from bids@ while the kit carries it', () => {
    expect(leftOut(email({ from: 'Bids@ClickConstruction.example' }), theBoxWith(kit))).toBeNull()
  })

  it('leaves mail from bids@ out with no kit, as before', () => {
    expect(leftOut(email({ from: 'bids@clickconstruction.example' }), theBoxWith(null))).toBe('ours')
  })

  it("leaves the app's own sender out while the kit carries bids@: the kit carries the one address, not every own one", () => {
    expect(leftOut(email({ from: 'app@clickconstruction.example' }), theBoxWith(kit))).toBe('ours')
  })
})
