import { describe, expect, it } from 'vitest'
import { shareRecipientLabel, shareRecipientSplit, shareSendFailures, shareSendOutcome, shareSendWords, type ShareRecipient } from './scheduleShareRecipients'
import { plainWordsFailures } from './plainWords'

const users = new Map<string, ShareRecipient>([
  ['u1', { id: 'u1', name: 'Marisol', email: 'marisol@example.com' }],
  ['u2', { id: 'u2', name: 'Todd', email: '  ' }],
  ['u3', { id: 'u3', name: 'Ana', email: 'ana@example.com' }],
  ['u4', { id: 'u4', name: '', email: 'lee@example.com' }],
])

describe('shareRecipientSplit — no email on file is held (punch list #184)', () => {
  it('splits the picks in pick order', () => {
    const split = shareRecipientSplit(['u2', 'u1', 'u3'], users)
    expect(split.ready.map((r) => r.id)).toEqual(['u1', 'u3'])
    expect(split.held.map((r) => r.id)).toEqual(['u2'])
  })
  it('a pick the list does not know is held', () => {
    expect(shareRecipientSplit(['zzzz-unknown-id'], users).held).toEqual([{ id: 'zzzz-unknown-id', name: '', email: '' }])
  })
})

describe('shareSendWords — the button says both counts', () => {
  it('some held: Send to 3 · 1 has no email ▸', () => {
    const w = shareSendWords({ ready: [1, 2, 3], held: [4] })
    expect(w.button).toBe('Send to 3 · 1 has no email ▸')
    expect(w.dead).toBe(false)
    expect(w.foot).toBe('1 is held. It stays here with the reason. The 3 ready ones send now.')
    expect(shareSendWords({ ready: [1], held: [2, 3] }).button).toBe('Send to 1 · 2 have no email ▸')
  })
  it('nobody held: Send to 3', () => {
    expect(shareSendWords({ ready: [1, 2, 3], held: [] })).toEqual({ button: 'Send to 3', foot: null, dead: false })
  })
  it('dead only when nobody picked has an email', () => {
    expect(shareSendWords({ ready: [], held: [1] })).toEqual({ button: 'Send now ▸', foot: 'Nothing is ready to send. Fix what is marked in red, then send.', dead: true })
    expect(shareSendWords({ ready: [], held: [] })).toEqual({ button: 'Send now', foot: null, dead: true })
  })
  it('the foot keeps to plain words', () => {
    expect(plainWordsFailures(shareSendWords({ ready: [1, 2], held: [3] }).foot ?? '')).toEqual([])
    expect(plainWordsFailures(shareSendWords({ ready: [], held: [3] }).foot ?? '')).toEqual([])
  })
})

describe('shareSendFailures — who the send did not reach, from the function', () => {
  it('names each with the function’s reason', () => {
    const out = shareSendFailures(
      [
        { recipientUserId: 'u1', ok: true },
        { recipientUserId: 'u3', ok: false, error: 'Resend: domain not verified' },
        { recipientUserId: 'u4', ok: false },
      ],
      users,
    )
    expect(out).toEqual([
      { id: 'u3', name: 'Ana', why: 'Resend: domain not verified' },
      { id: 'u4', name: 'lee@example.com', why: 'The email did not send.' },
    ])
  })
  it('reads nothing from a body with no results', () => {
    expect(shareSendFailures(undefined, users)).toEqual([])
    expect(shareSendFailures({ sent: 2 }, users)).toEqual([])
  })
})

describe('shareSendOutcome and shareRecipientLabel', () => {
  it('says what sent and what did not', () => {
    expect(shareSendOutcome(3, 0)).toEqual({ line: 'Sent 3 emails.', head: null, tone: 'success' })
    expect(shareSendOutcome(2, 1).line).toBe('Sent 2 emails. 1 did not send.')
  })
  it('labels by name, then email, then the id’s tail', () => {
    expect(shareRecipientLabel({ id: 'abcdefghijkl', name: ' Todd ', email: '' })).toBe('Todd')
    expect(shareRecipientLabel({ id: 'abcdefghijkl', name: '', email: 'x@y.z' })).toBe('x@y.z')
    expect(shareRecipientLabel({ id: 'abcdefghijkl', name: '', email: '' })).toBe('efghijkl')
  })
})
