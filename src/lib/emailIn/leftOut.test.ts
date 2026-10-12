import { describe, expect, it } from 'vitest'
import { leftOut, outsideInbox } from './leftOut'

const OURS = new Set(['bids@clickconstruction.example', 'app@clickconstruction.example', 'rosa@clickconstruction.example'])
const isOurs = (a: string) => OURS.has(a.toLowerCase())

const email = (over: { labels?: string[]; from?: string; headers?: Record<string, string> } = {}) => ({
  labels: over.labels ?? ['INBOX', 'CATEGORY_PERSONAL'],
  from: { name: null, address: over.from ?? 'greg@hillside.example' },
  headers: over.headers ?? {},
})

describe('leftOut: the mail the reader leaves in Gmail', () => {
  it('takes a person writing to the Inbox', () => {
    expect(leftOut(email(), isOurs)).toBeNull()
  })

  it('leaves out spam and trash, then anything not in the Inbox', () => {
    expect(leftOut(email({ labels: ['SPAM', 'INBOX'] }), isOurs)).toBe('spamOrTrash')
    expect(leftOut(email({ labels: ['TRASH'] }), isOurs)).toBe('spamOrTrash')
    expect(leftOut(email({ labels: ['SENT'] }), isOurs)).toBe('notInbox')
    expect(outsideInbox(email())).toBeNull()
  })

  it('leaves out our own addresses, in any case', () => {
    expect(leftOut(email({ from: 'Rosa@ClickConstruction.example' }), isOurs)).toBe('ours')
  })

  it('leaves out lists, bulk and mail a machine sent, an out-of-office reply too', () => {
    expect(leftOut(email({ headers: { 'list-unsubscribe': '<mailto:x@y.example>' } }), isOurs)).toBe('bulk')
    expect(leftOut(email({ headers: { 'list-id': 'news.y.example' } }), isOurs)).toBe('bulk')
    expect(leftOut(email({ headers: { precedence: 'Bulk' } }), isOurs)).toBe('bulk')
    expect(leftOut(email({ headers: { 'auto-submitted': 'auto-replied' } }), isOurs)).toBe('bulk')
    expect(leftOut(email({ headers: { 'auto-submitted': 'no' } }), isOurs)).toBeNull()
  })

  it('leaves out a no-reply sender and a bounce', () => {
    for (const from of ['noreply@y.example', 'no-reply@y.example', 'do-not-reply@y.example', 'DoNotReply@y.example', 'mailer-daemon@y.example', 'notifications+abc@y.example', 'bounce-123@y.example']) {
      expect(leftOut(email({ from }), isOurs)).toBe('noReply')
    }
    expect(leftOut(email({ from: 'norma@y.example' }), isOurs)).toBeNull()
  })

  it("leaves out Gmail's Promotions, Social, Updates and Forums", () => {
    for (const c of ['CATEGORY_PROMOTIONS', 'CATEGORY_SOCIAL', 'CATEGORY_UPDATES', 'CATEGORY_FORUMS']) {
      expect(leftOut(email({ labels: ['INBOX', c] }), isOurs)).toBe('category')
    }
  })
})
