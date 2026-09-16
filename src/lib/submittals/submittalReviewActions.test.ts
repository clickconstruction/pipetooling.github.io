import { describe, expect, it } from 'vitest'

import { cleanName, decideVerdict, decisionCounts, normalizeEmail, parseDecideBody, parseIdentifyBody, resolveIdentify, askTitle, decisionEntryBody, messageVerdict, parseMessageBody, MESSAGES_PER_HOUR } from '../../../supabase/functions/_shared/submittalReviewActions'

describe('identify', () => {
  it('cleans the name and email, reads the role, spots the honeypot and the forwarded token', () => {
    expect(normalizeEmail('  Dana@Whitfield-Arch.com ')).toBe('dana@whitfield-arch.com')
    expect(normalizeEmail('nope')).toBeNull()
    expect(cleanName('  Dana   Whitfield ')).toBe('Dana Whitfield')
    expect(cleanName('')).toBeNull()
    const ok = parseIdentifyBody({ token: 'r', name: 'Dana', email: 'dana@x.com', role: 'architect', viaToken: 'p1', website: '' })
    expect(ok).toEqual({ ok: true, value: { token: 'r', name: 'Dana', email: 'dana@x.com', role: 'architect', viaToken: 'p1', honeypot: false } })
    expect(parseIdentifyBody({ token: 'r', name: 'Bot', email: 'b@x.com', website: 'http://spam' })).toMatchObject({ ok: true, value: { honeypot: true, role: 'other' } })
    expect(parseIdentifyBody({ token: 'r', name: '', email: 'b@x.com' })).toEqual({ ok: false, error: 'Tell us your name.' })
    expect(parseIdentifyBody({ token: '', name: 'x', email: 'b@x.com' })).toEqual({ ok: false, error: 'This link is incomplete.' })
  })

  it('attaches to a pre-named row by email, recognises the same person on their own link, else makes a new one', () => {
    expect(resolveIdentify({ existingByEmail: { id: 'named' }, viaPerson: null, email: 'dana@x.com' })).toEqual({ kind: 'existing', personId: 'named' })
    expect(resolveIdentify({ existingByEmail: null, viaPerson: { id: 'p1', email: 'Dana@x.com' }, email: 'dana@x.com' })).toEqual({ kind: 'existing', personId: 'p1' })
    expect(resolveIdentify({ existingByEmail: null, viaPerson: { id: 'p1', email: 'dana@x.com' }, email: 'tom@x.com' })).toEqual({ kind: 'new', how: 'forwarded' })
    expect(resolveIdentify({ existingByEmail: null, viaPerson: null, email: 'tom@x.com' })).toEqual({ kind: 'new', how: 'identified' })
  })
})

describe('decide', () => {
  it('parses decisions, drops junk rows, trims notes, refuses an empty set', () => {
    const r = parseDecideBody({ token: 'p', submittalId: 's', decisions: [{ itemId: 'a', decision: 'revise', note: '  hold 1.0 gpf ' }, { itemId: 'b', decision: 'maybe' }, { itemId: '', decision: 'approved' }, { itemId: 'c', decision: 'approved' }] })
    expect(r).toEqual({ ok: true, value: { token: 'p', submittalId: 's', decisions: [{ itemId: 'a', decision: 'revise', note: 'hold 1.0 gpf' }, { itemId: 'c', decision: 'approved', note: null }] } })
    expect(parseDecideBody({ token: 'p', submittalId: 's', decisions: [{ itemId: 'b', decision: 'maybe' }] })).toEqual({ ok: false, error: 'Nothing to record.' })
    expect(parseDecideBody({ token: '', submittalId: 's', decisions: [] })).toEqual({ ok: false, error: 'Tell us who you are first.' })
  })

  it('the verdict: closed, not on this link, watching, stale, then ok', () => {
    const base = { roomStatus: 'open', personClosed: false, mayDecide: true, submittalBelongs: true, submittalShared: true, currentSubmittalId: 's2', submittalId: 's2' }
    expect(decideVerdict(base)).toEqual({ ok: true })
    expect(decideVerdict({ ...base, roomStatus: 'closed' })).toMatchObject({ ok: false, status: 410, code: 'closed' })
    expect(decideVerdict({ ...base, personClosed: true })).toMatchObject({ ok: false, status: 410 })
    expect(decideVerdict({ ...base, submittalBelongs: false })).toMatchObject({ ok: false, status: 404, code: 'not_found' })
    expect(decideVerdict({ ...base, submittalShared: false })).toMatchObject({ ok: false, status: 404 })
    expect(decideVerdict({ ...base, mayDecide: false })).toMatchObject({ ok: false, status: 403, code: 'watching' })
    expect(decideVerdict({ ...base, submittalId: 's1' })).toMatchObject({ ok: false, status: 409, code: 'stale_revision' })
    expect(decisionCounts([{ decision: 'approved' }, { decision: 'approved' }, { decision: 'revise' }])).toEqual({ approved: 2, revise: 1, rejected: 0 })
  })
})

describe('stage 5a — the conversation', () => {
  it('parses an ask: token, body trimmed and capped, tags cleaned, the honeypot', () => {
    const p = parseMessageBody({ token: ' t1 ', submittalId: 'rev-2', body: '  Is the 50 gal ok?  ', tags: ['WC-1', ' WC-1', '', 'DWH-1'], website: '' })
    expect(p.ok).toBe(true)
    if (!p.ok) return
    expect(p.value).toEqual({ token: 't1', submittalId: 'rev-2', body: 'Is the 50 gal ok?', tags: ['WC-1', 'DWH-1'], honeypot: false })
    expect(parseMessageBody({ token: 't', body: '   ' }).ok).toBe(false)
    expect(parseMessageBody({ body: 'x' }).ok).toBe(false)
    const bot = parseMessageBody({ token: 't', body: 'x', website: 'http://spam' })
    expect(bot.ok && bot.value.honeypot).toBe(true)
  })

  it('a watcher may ask; a closed room may not; five an hour is the limit', () => {
    expect(messageVerdict({ roomStatus: 'open', personClosed: false, askedThisHour: 0 })).toEqual({ ok: true })
    expect(messageVerdict({ roomStatus: 'closed', personClosed: false, askedThisHour: 0 })).toMatchObject({ ok: false, status: 410, code: 'closed' })
    expect(messageVerdict({ roomStatus: 'open', personClosed: true, askedThisHour: 0 })).toMatchObject({ ok: false, status: 410 })
    expect(messageVerdict({ roomStatus: 'open', personClosed: false, askedThisHour: MESSAGES_PER_HOUR })).toMatchObject({ ok: false, status: 429, code: 'rate_limited' })
    expect(messageVerdict({ roomStatus: 'open', personClosed: false, askedThisHour: MESSAGES_PER_HOUR - 1 })).toEqual({ ok: true })
  })

  it('words the system entry and the inbox title', () => {
    expect(decisionEntryBody({ approved: 0, revise: 2, rejected: 1 })).toBe('decided 3 rows · 2 revise · 1 reject')
    expect(decisionEntryBody({ approved: 1, revise: 0, rejected: 0 })).toBe('decided 1 row · 1 approve')
    expect(askTitle({ personName: 'Dana Whitfield', roleLabel: 'architect', tags: ['WC-1'], bidLabel: 'B398 ZZ Test', revNumber: 2 })).toBe('Dana Whitfield (architect) asked about WC-1 on B398 ZZ Test Rev 2')
    expect(askTitle({ personName: 'Pat', roleLabel: 'builder', tags: [], bidLabel: 'B398', revNumber: null })).toBe('Pat (builder) asked on B398')
  })
})
