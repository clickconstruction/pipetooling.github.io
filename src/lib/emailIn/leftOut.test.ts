import { describe, expect, it } from 'vitest'
import { leftOut, outsideInbox } from './leftOut'
import { isOwnAddress, ownChannels } from '../messages/ownChannels'
import { kitCarries, type WalkKit } from '../walk/kit'

const THE_BOX = new Set(['bids@clickconstruction.example', 'app@clickconstruction.example'])
const isTheBox = (a: string) => THE_BOX.has(a.toLowerCase())

const email = (over: { labels?: string[]; from?: string; headers?: Record<string, string> } = {}) => ({
  labels: over.labels ?? ['INBOX', 'CATEGORY_PERSONAL'],
  from: { name: null, address: over.from ?? 'greg@hillside.example' },
  headers: over.headers ?? {},
})

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

  it("leaves out Gmail's Promotions, Social, Updates and Forums", () => {
    for (const c of ['CATEGORY_PROMOTIONS', 'CATEGORY_SOCIAL', 'CATEGORY_UPDATES', 'CATEGORY_FORUMS']) {
      expect(leftOut(email({ labels: ['INBOX', c] }), isTheBox)).toBe('category')
    }
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
