import { describe, expect, it } from 'vitest'

import { cleanName, decideVerdict, decisionCounts, normalizeEmail, parseDecideBody, planDecideWrites, parseIdentifyBody, resolveIdentify, askTitle, decisionEntryBody, messageVerdict, parseMessageBody, MESSAGES_PER_HOUR, OFFICE_REFUSAL, OFFICE_ROLES, PREVIEW_REFUSAL, officeRoleOf, officeWriteVerdict, type RoomWriteAction } from '../../../supabase/functions/_shared/submittalReviewActions'
import { canOpenBids } from '../bids/bidsTabAccess'

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
    // 2026-10-02 · a person the office named without an email is the visitor who arrives on that person's own link.
    expect(resolveIdentify({ existingByEmail: null, viaPerson: { id: 'named', email: null }, email: 'pm@gc.com' })).toEqual({ kind: 'existing', personId: 'named', claimEmail: true })
    expect(resolveIdentify({ existingByEmail: { id: 'other' }, viaPerson: { id: 'named', email: null }, email: 'pm@gc.com' })).toEqual({ kind: 'existing', personId: 'other' })
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
    const base = { roomStatus: 'open', personClosed: false, mayDecide: true, submittalBelongs: true, submittalOnRecord: true, currentSubmittalId: 's2', submittalId: 's2' }
    expect(decideVerdict(base)).toEqual({ ok: true })
    expect(decideVerdict({ ...base, roomStatus: 'closed' })).toMatchObject({ ok: false, status: 410, code: 'closed' })
    expect(decideVerdict({ ...base, personClosed: true })).toMatchObject({ ok: false, status: 410 })
    expect(decideVerdict({ ...base, submittalBelongs: false })).toMatchObject({ ok: false, status: 404, code: 'not_found' })
    expect(decideVerdict({ ...base, submittalOnRecord: false })).toMatchObject({ ok: false, status: 404 })
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
    // Calls on parts: the rows and the parts they sit on, not one row per call (2026-10-01).
    expect(decisionEntryBody({ approved: 1, revise: 1, rejected: 0 }, { rows: 1, parts: 2 })).toBe('decided 1 row · 2 parts · 1 approve · 1 revise')
    expect(decisionEntryBody({ approved: 2, revise: 0, rejected: 0 }, { rows: 2, parts: 0 })).toBe('decided 2 rows · 2 approve')
    expect(askTitle({ personName: 'Dana Whitfield', roleLabel: 'architect', tags: ['WC-1'], bidLabel: 'B398 ZZ Test', revNumber: 2 })).toBe('Dana Whitfield (architect) asked about WC-1 on B398 ZZ Test Rev 2')
    expect(askTitle({ personName: 'Pat', roleLabel: 'builder', tags: [], bidLabel: 'B398', revNumber: null })).toBe('Pat (builder) asked on B398')
  })
})

describe('a call on a part (2026-10-01)', () => {
  it('the body may name a part', () => {
    const r = parseDecideBody({ token: 't', submittalId: 's', decisions: [{ itemId: 'wc', partId: 'valve', decision: 'revise', note: ' 1.0 gpf ' }, { itemId: 'fd', decision: 'approved' }] })
    expect(r).toEqual({ ok: true, value: { token: 't', submittalId: 's', decisions: [{ itemId: 'wc', partId: 'valve', decision: 'revise', note: '1.0 gpf' }, { itemId: 'fd', decision: 'approved', note: null }] } })
  })

  it('lands on the part named; a call on a row with parts lands on each part not called on its own; a row with no parts takes it; a stranger part is dropped', () => {
    const gc = new Map([['wc', ['bowl', 'valve', 'carrier']]])
    const plan = planDecideWrites([
      { itemId: 'wc', partId: 'valve', decision: 'revise', note: '1.0 gpf' },
      { itemId: 'wc', decision: 'approved', note: null },
      { itemId: 'wc', partId: 'not-mine', decision: 'approved', note: null },
      { itemId: 'fd', decision: 'approved', note: 'fine' },
    ], gc)
    expect(plan.parts.map((p) => [p.partId, p.decision])).toEqual([['valve', 'revise'], ['bowl', 'approved'], ['carrier', 'approved']])
    expect(plan.rows).toEqual([{ itemId: 'fd', decision: 'approved', note: 'fine' }])
    expect(plan.itemsWithParts).toEqual(['wc'])
  })
})

describe('the office is never the GC (v2.4599, #62)', () => {
  const actions: RoomWriteAction[] = ['identify', 'message', 'decide']

  it('a verified office session is refused on every write, with the reason the page shows; the office wins over the preview', () => {
    for (const action of actions) {
      expect(officeWriteVerdict(action, { preview: false, officeRole: 'estimator' })).toEqual({ ok: false, status: 403, code: 'office', error: OFFICE_REFUSAL[action] })
      expect(officeWriteVerdict(action, { preview: true, officeRole: 'assistant' })).toMatchObject({ ok: false, code: 'office' })
    }
    expect(OFFICE_REFUSAL.decide).toBe('You are signed in as the office. Enter their answer from the Submittals tab.')
    expect(OFFICE_REFUSAL.message).toBe('You are signed in as the office. Answer their questions from the Submittals tab.')
  })

  it('the office’s preview is refused on every write; a reviewer with neither signal goes ahead as before', () => {
    for (const action of actions) {
      expect(officeWriteVerdict(action, { preview: true, officeRole: null })).toEqual({ ok: false, status: 403, code: 'preview', error: PREVIEW_REFUSAL })
      expect(officeWriteVerdict(action, { preview: false, officeRole: null })).toEqual({ ok: true })
    }
  })

  it('the office is every role that opens Bids, and no other', () => {
    for (const role of ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent', 'subcontractor', 'helpers']) {
      expect(OFFICE_ROLES.includes(role)).toBe(canOpenBids(role))
    }
  })

  describe('officeRoleOf: verified by the function, never read off a header', () => {
    const anon = 'anon-key'
    const fake = (o: { user?: { id: string } | null; role?: string | null; usersThrow?: boolean } = {}) => {
      const calls = { getUser: 0, users: 0 }
      const admin = {
        auth: { getUser: async (_jwt: string) => { calls.getUser += 1; return o.user ? { data: { user: o.user }, error: null } : { data: { user: null }, error: { message: 'invalid JWT' } } } },
        from: (table: string) => {
          if (table !== 'users') throw new Error(`read ${table}`)
          calls.users += 1
          if (o.usersThrow) throw new Error('boom')
          return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: o.role === undefined ? null : { role: o.role } }) }) }) }
        },
      }
      return { admin, calls }
    }
    const req = (authorization?: string) => ({ headers: { get: (name: string) => (name.toLowerCase() === 'authorization' ? authorization ?? null : null) } })

    it('no header, or the anon key a reviewer’s page sends: no session, and the auth server is never asked', async () => {
      for (const header of [undefined, `Bearer ${anon}`]) {
        const { admin, calls } = fake({ user: { id: 'u1' }, role: 'dev' })
        expect(await officeRoleOf(req(header), admin, anon)).toBeNull()
        expect(calls).toEqual({ getUser: 0, users: 0 })
      }
    })

    it('a token the auth server does not resolve is no session, whatever role it claims', async () => {
      const { admin, calls } = fake({ user: null, role: 'dev' })
      expect(await officeRoleOf(req('Bearer forged'), admin, anon)).toBeNull()
      expect(calls).toEqual({ getUser: 1, users: 0 })
    })

    it('a resolved user is the office only when their users.role is an office role', async () => {
      expect(await officeRoleOf(req('Bearer jwt'), fake({ user: { id: 'u1' }, role: 'estimator' }).admin, anon)).toBe('estimator')
      expect(await officeRoleOf(req('Bearer jwt'), fake({ user: { id: 'u1' }, role: 'subcontractor' }).admin, anon)).toBeNull()
      expect(await officeRoleOf(req('Bearer jwt'), fake({ user: { id: 'u1' }, role: 'helpers' }).admin, anon)).toBeNull()
      expect(await officeRoleOf(req('Bearer jwt'), fake({ user: { id: 'u1' } }).admin, anon)).toBeNull()
      expect(await officeRoleOf(req('Bearer jwt'), fake({ user: { id: 'u1' }, usersThrow: true }).admin, anon)).toBeNull()
    })
  })
})

