/**
 * The dev seat's numbers on a recorded lien notice, the pure half: plan_notice_numbers → apply_notice_numbers. The
 * kernel runs here against plain fixtures; the pins hold it to the desk's own add the number › door. Every job, name
 * and mail number here is made up.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  NOTICE_NUMBERS_FILING_COLS,
  NOTICE_NUMBERS_PLAN_MAX,
  NOTICE_NUMBERS_VERBS,
  isNoticeNumbersVerb,
  noticeNumbersAppliedWords,
  noticeNumbersApplyInput,
  noticeNumbersDryRun,
  noticeNumbersFilingOf,
  noticeNumbersPick,
  noticeNumbersPlanInput,
  noticeNumbersPlanReply,
  noticeNumbersSameNoticeWords,
  noticeNumbersShape,
  readNoticeNumbersWorld,
  uspsCheckDigitOk,
  type NoticeNumbersFiling,
  type NoticeNumbersPayload,
  type NoticeNumbersWorld,
} from '../../../supabase/functions/_shared/devMcpNoticeNumbers'
import { WRITE_VERBS, isWriteVerb, writeRpcBody } from '../../../supabase/functions/_shared/devMcpWrites'
import { withTracking } from '../jobs/lienSendTracking'

const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')
const README = readFileSync('docs/dev-mcp/README.md', 'utf8')
const EDGE = readFileSync('docs/EDGE_FUNCTIONS.md', 'utf8')
const EDITOR = readFileSync('src/components/jobs/LienTrackingOwedEditor.tsx', 'utf8')

const JOB = '99999999-2222-4222-8222-222222222222'
const JOB_B = '99999999-3333-4333-8333-333333333333'
const FILING = 'bbbbbbbb-2222-4222-8222-222222222222'
const FILING_B = 'bbbbbbbb-3333-4333-8333-333333333333'
const PACKET = 'dddddddd-2222-4222-8222-222222222222'
// Made-up numbers whose last digit checks, and one whose last digit does not.
const N1 = '9507000000000000000117'
const N2 = '9507000000000000000124'
const N3 = '9507000000000000000131'
const N20 = '70000000000000000016'
const BAD = '9507000000000000000118'

const job = { id: JOB, job_name: 'ZZ Test Maple Court', job_address: '14 Maple Ct, Marlow, TX 78000', hcp_number: '2291', click_number: '' }
const send = (recipient: string, tracking: string, over: Record<string, unknown> = {}) => ({ recipient, method: 'certified_mail', tracking, sent_on: '2026-11-16', ...over })
const notice = (over: Partial<NoticeNumbersFiling> = {}): NoticeNumbersFiling => ({ id: FILING, job_id: JOB, kind: 'notice_53_056', months: ['2026-07', '2026-08'], sends: [send('owner', N2), send('original_contractor', N2)], by_hand: true, packet_id: PACKET, applied_from: null, ...over })
const worldOf = (over: Partial<NoticeNumbersWorld> = {}): NoticeNumbersWorld => ({ job, notices: [notice()], paperMates: [], elsewhere: [], item: { status: 'sent', sent_at: '2026-11-16T18:00:00+00:00' }, ...over })
const payload = (over: Partial<NoticeNumbersPayload> = {}): NoticeNumbersPayload => ({ action: 'notice_numbers', job_id: JOB, months: null, paper: null, sent_on: null, owner: N1, contractor: null, ...over })

describe('the verbs', () => {
  it('are two write verbs with no RPC, a tool and a branch each', () => {
    expect(NOTICE_NUMBERS_VERBS).toEqual(['plan_notice_numbers', 'apply_notice_numbers'])
    for (const v of NOTICE_NUMBERS_VERBS) {
      expect(isNoticeNumbersVerb(v)).toBe(true)
      expect(isWriteVerb(v)).toBe(true)
      expect(WRITE_VERBS[v].rpc).toBeNull()
      expect(SERVER).toContain(`case '${v}':`)
      expect(SERVER).toContain(`name: '${v}',`)
    }
    expect(isNoticeNumbersVerb('plan_lien_service')).toBe(false)
    expect(Object.keys(WRITE_VERBS)).toHaveLength(121)
    expect(SERVER).toContain("const SERVER_VERSION = '0.99.0'")
    expect(SERVER).toContain('Writes are one hundred and twenty-one verbs and nothing else:')
    expect(README).toContain('`plan_notice_numbers(notice \\| notices)` · `apply_notice_numbers(notice, plan_hash)`')
    expect(EDGE).toContain('**v2.7687 (server 0.99.0)')
  })

  it('write what the desk’s add the number door writes: the sends alone, on a live notice', () => {
    expect(EDITOR).toContain("supabase.from('job_lien_filings').update({ sends } as never).eq('id', filing.id)")
    expect(EDITOR).toContain('const sends = withTracking(filing.sends, recipient, tracking)')
    expect(SERVER).toContain("await restRows(session, 'PATCH', 'job_lien_filings', `id=eq.${write.filingId}&kind=in.(notice_53_056,retainage_53_057)&voided_at=is.null&select=id`, { sends: write.sends }, 'return=representation')")
  })
})

describe('the shape', () => {
  it('takes a job and a copy, and normalises the rest', () => {
    const out = noticeNumbersShape({ job_id: JOB.toUpperCase(), owner: { tracking: ' 9507 0000 0000 0000 0001 17 ' }, months: ['2026-08', '2026-07', '2026-08'], paper: 'monthly', sent_on: '2026-11-16' })
    expect(out).toEqual({ ok: true, p: { action: 'notice_numbers', job_id: JOB, months: ['2026-07', '2026-08'], paper: 'notice_53_056', sent_on: '2026-11-16', owner: '9507 0000 0000 0000 0001 17', contractor: null } })
    expect(noticeNumbersShape({ job_id: JOB, contractor: { tracking: '' }, paper: 'retainage' })).toMatchObject({ ok: true, p: { owner: null, contractor: '', paper: 'retainage_53_057' } })
  })

  it('refuses in words', () => {
    const why = (src: unknown) => {
      const out = noticeNumbersShape(src)
      return out.ok ? '' : out.error
    }
    expect(why(null)).toContain('a notice is {')
    expect(why({ job_id: 'JP2291', owner: { tracking: N1 } })).toContain('find_job')
    expect(why({ job_id: JOB })).toContain('Name a copy')
    expect(why({ job_id: JOB, owner: N1 })).toContain('owner is { tracking }')
    expect(why({ job_id: JOB, owner: { tracking: 7 } })).toContain('owner is { tracking }')
    expect(why({ job_id: JOB, owner: { tracking: 'x'.repeat(81) } })).toContain('at most 80')
    expect(why({ job_id: JOB, owner: { tracking: N1 }, months: ['July'] })).toContain('YYYY-MM')
    expect(why({ job_id: JOB, owner: { tracking: N1 }, paper: 'affidavit' })).toContain('monthly')
    expect(why({ job_id: JOB, owner: { tracking: N1 }, sent_on: '11/16/2026' })).toContain('YYYY-MM-DD')
  })

  it('a plan takes one or several, an apply takes one and its hash', () => {
    expect(noticeNumbersPlanInput({})).toMatchObject({ ok: false })
    expect(noticeNumbersPlanInput({ notice: { job_id: JOB, owner: { tracking: N1 } }, notices: [] })).toMatchObject({ ok: false })
    expect(noticeNumbersPlanInput({ notices: Array.from({ length: NOTICE_NUMBERS_PLAN_MAX + 1 }, () => ({})) })).toMatchObject({ ok: false })
    const many = noticeNumbersPlanInput({ notices: [{ job_id: JOB, owner: { tracking: N1 } }, { job_id: 'nope' }] })
    expect(many).toMatchObject({ ok: true, target: '2 notices' })
    if (many.ok) expect(many.notices.map((n) => n.ok)).toEqual([true, false])
    expect(noticeNumbersPlanInput({ notice: { job_id: JOB, owner: { tracking: N1 } } })).toMatchObject({ ok: true, target: JOB })
    const hash = 'a'.repeat(64)
    expect(noticeNumbersApplyInput({ notices: [], plan_hash: hash })).toMatchObject({ ok: false })
    expect(noticeNumbersApplyInput({ notice: { job_id: JOB, owner: { tracking: N1 } } })).toMatchObject({ ok: false })
    expect(noticeNumbersApplyInput({ notice: { job_id: JOB, owner: { tracking: N1 } }, plan_hash: hash.toUpperCase() })).toMatchObject({ ok: true, planHash: hash, target: JOB })
    // The write table hands both on as they are.
    expect(writeRpcBody('plan_notice_numbers', { notice: { job_id: JOB, owner: { tracking: N1 } } })).toMatchObject({ ok: true, rpc: null, step: 'plan' })
    expect(writeRpcBody('apply_notice_numbers', { notice: { job_id: JOB, owner: { tracking: N1 } }, plan_hash: hash })).toMatchObject({ ok: true, rpc: null, step: 'apply', planHash: hash })
  })
})

describe('the check digit', () => {
  it('passes a number whose last digit is computed from the others, at 22 digits and at 20', () => {
    for (const n of [N1, N2, N3, N20, '9507 0000 0000 0000 0001 17']) expect(uspsCheckDigitOk(n)).toBe(true)
    expect(uspsCheckDigitOk(BAD)).toBe(false)
    // Two digits swapped is the slip a reading by eye makes.
    expect(uspsCheckDigitOk('9507000000000000001017')).toBe(false)
    expect(uspsCheckDigitOk('')).toBe(false)
  })
})

describe('which notice', () => {
  const retainage = notice({ id: FILING_B, kind: 'retainage_53_057', months: ['2026-09'] })
  it('is the job’s one notice, or the one the months and the paper name', () => {
    expect(noticeNumbersPick({ months: null, paper: null }, [notice()], 'JP2291')).toMatchObject({ ok: true, filing: { id: FILING } })
    expect(noticeNumbersPick({ months: ['2026-09'], paper: null }, [notice(), retainage], 'JP2291')).toMatchObject({ ok: true, filing: { id: FILING_B } })
    expect(noticeNumbersPick({ months: null, paper: 'notice_53_056' }, [notice(), retainage], 'JP2291')).toMatchObject({ ok: true, filing: { id: FILING } })
  })

  it('refuses none, several, and a row that stands for another job’s paper', () => {
    const why = (out: ReturnType<typeof noticeNumbersPick>) => (out.ok ? '' : out.refused)
    expect(why(noticeNumbersPick({ months: null, paper: null }, [], 'JP2291'))).toContain('no lien notice is on record')
    expect(why(noticeNumbersPick({ months: null, paper: null }, [notice(), retainage], 'JP2291'))).toContain('2 notices on record match')
    expect(why(noticeNumbersPick({ months: null, paper: null }, [notice(), retainage], 'JP2291'))).toContain('the retainage notice (§ 53.057) for 2026-09, mailed 2026-11-16')
    expect(why(noticeNumbersPick({ months: ['2026-10'], paper: null }, [notice()], 'JP2291'))).toContain('no notice on record matches the months 2026-10')
    expect(why(noticeNumbersPick({ months: null, paper: null }, [notice({ applied_from: FILING_B })], 'JP2291'))).toContain('recorded on another job')
    // An applied row beside a real one is passed over, not counted.
    expect(noticeNumbersPick({ months: null, paper: null }, [notice({ id: FILING_B, applied_from: FILING }), notice()], 'JP2291')).toMatchObject({ ok: true, filing: { id: FILING } })
  })
})

describe('the dry run', () => {
  it('replaces one copy’s number and leaves the other, the day and the rest of the send alone', () => {
    const world = worldOf({ notices: [notice({ sends: [send('owner', N2, { receipt_url: 'https://drive.example/receipt' }), send('original_contractor', N2)] })] })
    const dry = noticeNumbersDryRun(payload({ owner: '9507 0000 0000 0000 0001 17', sent_on: '2026-11-16' }), world)
    expect(dry.ok).toBe(true)
    if (!dry.ok) return
    expect(dry.write).toEqual({ filingId: FILING, set: [{ copy: 'owner', tracking: N1 }], sends: [send('owner', N1, { receipt_url: 'https://drive.example/receipt' }), send('original_contractor', N2)] })
    // The door's own kernel gives the same sends.
    expect(dry.write.sends).toEqual(withTracking(world.notices[0]!.sends, 'owner', N1))
    expect(dry.reply).toMatchObject({
      action: 'notice_numbers',
      job: { id: JOB, label: 'JP2291' },
      notice: { filing_id: FILING, paper: 'the monthly notice (§ 53.056)', months: ['2026-07', '2026-08'], mailed_on: '2026-11-16', recorded: 'by hand (Already mailed? Record it…)', desk_item: 'sent, sent 2026-11-16: left as it is' },
      before: [
        { copy: 'owner', to: 'Owner of record', how: 'certified mail', mailed_on: '2026-11-16', tracking: N2 },
        { copy: 'original_contractor', tracking: N2 },
      ],
      after: [
        { copy: 'owner', tracking: N1 },
        { copy: 'original_contractor', tracking: N2 },
      ],
      writes: { filing: FILING },
      says: `JP2291: Owner of record ${N1}`,
    })
    expect(dry.reply.not_done).toContain('no release is issued')
    expect(dry.reply).not.toHaveProperty('check_digit')
    expect(dry.reply).not.toHaveProperty('same_number')
  })

  it('fills a blank number as the door does, both copies in one write', () => {
    const dry = noticeNumbersDryRun(payload({ owner: N1, contractor: N3 }), worldOf({ notices: [notice({ by_hand: false, sends: [send('owner', ''), send('original_contractor', '')] })], item: null }))
    expect(dry.ok).toBe(true)
    if (!dry.ok) return
    expect(dry.write.sends.map((s) => s.tracking)).toEqual([N1, N3])
    expect(dry.reply).toMatchObject({ notice: { recorded: 'on the desk', desk_item: 'no desk item points at this notice' }, says: `JP2291: Owner of record ${N1} · Original contractor ${N3}` })
  })

  it('takes a number off, and says the copy then reads tracking owed', () => {
    const dry = noticeNumbersDryRun(payload({ owner: null, contractor: '' }), worldOf())
    expect(dry.ok).toBe(true)
    if (!dry.ok) return
    expect(dry.write.sends.map((s) => s.tracking)).toEqual([N2, ''])
    expect(dry.reply.takes_off).toContain('Original contractor: the number on record is taken off')
    expect(dry.reply.says).toBe('JP2291: Original contractor no number · 1 still owed')
  })

  it('says what the eye should check: a last digit that fails, one number twice, a number held elsewhere, the same paper on other jobs', () => {
    const bad = noticeNumbersDryRun(payload({ owner: BAD }), worldOf())
    expect(bad.ok && (bad.reply.check_digit as string[])[0]).toContain(`the last digit of ${BAD} does not check`)
    const same = noticeNumbersDryRun(payload({ owner: null, contractor: N1 }), worldOf({ notices: [notice({ sends: [send('owner', N1), send('original_contractor', N2)] })] }))
    expect(same.ok && same.reply.same_number).toContain('Two envelopes of this notice carry one number')
    const held = noticeNumbersDryRun(payload({ owner: N1 }), worldOf({ elsewhere: [{ filing_id: FILING_B, job: 'JP2304', sends: [send('owner', '9507 0000 0000 0000 0001 17')] }] }))
    expect(held.ok && held.reply.also_holds_this_number).toEqual(['JP2304: Owner of record 9507 0000 0000 0000 0001 17'])
    const mates = noticeNumbersDryRun(payload({ owner: N1 }), worldOf({ paperMates: [{ filing_id: FILING_B, job: 'JP2304', sends: [send('owner', N2), send('original_contractor', '')] }] }))
    expect(mates.ok && mates.reply.same_paper).toEqual([`JP2304: Owner of record ${N2} · Original contractor no number`])
    expect(mates.ok && mates.reply.same_paper_note).toContain('This plan changes this job’s row alone')
  })

  it('refuses in words, each with its reason', () => {
    const why = (p: NoticeNumbersPayload, world: NoticeNumbersWorld = worldOf()) => {
      const out = noticeNumbersDryRun(p, world)
      return out.ok ? '' : out.refused
    }
    expect(why(payload(), worldOf({ job: null }))).toContain('No job')
    expect(why(payload(), worldOf({ notices: [] }))).toContain('no lien notice is on record')
    expect(why(payload({ sent_on: '2026-11-17' }))).toContain('the record says this notice was mailed on 2026-11-16, and the call says 2026-11-17')
    expect(why(payload({ owner: null, contractor: N1 }), worldOf({ notices: [notice({ sends: [send('owner', N2)] })] }))).toContain('did not go to the original contractor')
    expect(why(payload(), worldOf({ notices: [notice({ sends: [send('owner', 'gc@example.test', { method: 'email' })] })] }))).toContain('went by email')
    expect(why(payload(), worldOf({ notices: [notice({ sends: [send('owner', '', { via: 'docsmit', piece_id: 'p1' })] })] }))).toContain('carried by a mail provider')
    expect(why(payload({ owner: '9507 0000 0000 0000 0001 1' }))).toContain('21 digits. A certified mail number has 20 or 22')
    expect(why(payload({ owner: '9507-ABCD' }))).toContain('digits alone')
    expect(why(payload({ owner: N2 }))).toContain('already holds this number')
    expect(why(payload({ owner: N2, contractor: '9507 0000 0000 0000 0001 24' }))).toContain('already holds these numbers')
    expect(why(payload({ owner: '' }), worldOf({ notices: [notice({ sends: [send('owner', ''), send('original_contractor', N2)] })] }))).toContain('Nothing to change')
  })

  it('a courier’s number is kept as typed', () => {
    const dry = noticeNumbersDryRun(payload({ owner: '1Z 999 AA1' }), worldOf({ notices: [notice({ sends: [send('owner', '', { method: 'traceable_courier' })] })] }))
    expect(dry.ok && dry.write.sends[0]!.tracking).toBe('1Z 999 AA1')
  })
})

describe('the read', () => {
  it('reads the job, its live notices, the paper’s other jobs, a number held elsewhere and the desk item', async () => {
    const asked: string[] = []
    const rows = {
      jobs_ledger: (q: string) => (q.includes(`id=eq.${JOB}`) ? [job] : [{ id: JOB_B, job_name: 'ZZ Test Birch Lane', job_address: '', hcp_number: '2304', click_number: '' }]),
      job_lien_filings: (q: string) => {
        if (q.includes(`job_id=eq.${JOB}`)) return [{ id: FILING, job_id: JOB, kind: 'notice_53_056', months_covered: ['2026-08', '2026-07'], sends: [send('owner', N2), send('original_contractor', N2)], by_hand: true, packet_id: PACKET, applied_from: null }]
        if (q.includes(`packet_id=eq.${PACKET}`)) return [{ id: FILING, job_id: JOB, sends: [] }, { id: FILING_B, job_id: JOB_B, sends: [send('owner', N2)] }]
        return [{ id: FILING_B, job_id: JOB_B, sends: [send('owner', N2)] }]
      },
      job_lien_desk_items: () => [{ id: 'item-1', status: 'sent', sent_at: '2026-11-16T18:00:00+00:00' }],
    }
    const world = await readNoticeNumbersWorld({ rows: async (table, query) => (asked.push(`${table}?${query}`), rows[table as keyof typeof rows](query)) }, payload())
    expect(world.notices).toEqual([notice()])
    expect(world.paperMates).toEqual([{ filing_id: FILING_B, job: 'JP2304', sends: [send('owner', N2)] }])
    // The same filing is a paper mate once, never also listed as holding the number.
    expect(world.elsewhere).toEqual([])
    expect(world.item).toEqual({ status: 'sent', sent_at: '2026-11-16T18:00:00+00:00' })
    expect(asked[1]).toBe(`job_lien_filings?select=${NOTICE_NUMBERS_FILING_COLS}&job_id=eq.${JOB}&kind=in.(notice_53_056,retainage_53_057)&voided_at=is.null&order=created_at.desc&limit=50`)
    expect(asked.some((q) => q.includes(`sends=cs.${encodeURIComponent(JSON.stringify([{ tracking: N1 }]))}`))).toBe(true)
    expect(noticeNumbersFilingOf({ id: FILING, job_id: JOB, kind: 'notice_53_056', months_covered: null, sends: null, by_hand: null, packet_id: null, applied_from: null })).toEqual(notice({ months: [], sends: null, by_hand: false, packet_id: null }))
  })

  it('stops at a job nobody sees, and at a job with no notice to pick', async () => {
    const none = await readNoticeNumbersWorld({ rows: async () => [] }, payload())
    expect(none).toEqual({ job: null, notices: [], paperMates: [], elsewhere: [], item: null })
    const asked: string[] = []
    const bare = await readNoticeNumbersWorld({ rows: async (table) => (asked.push(table), table === 'jobs_ledger' ? [job] : []) }, payload())
    expect(bare.notices).toEqual([])
    expect(asked).toEqual(['jobs_ledger', 'job_lien_filings'])
  })
})

describe('the replies', () => {
  it('a plan counts its verdicts and says what to do next', () => {
    const reply = noticeNumbersPlanReply([{ entry: 1, status: 'ready' }, { entry: 2, status: 'refused', why: 'x' }])
    expect(reply.notices).toBe('2 notices: 1 ready, 1 refused.')
    expect(reply.next).toContain('Read each ready entry’s before and after to the person')
    expect(noticeNumbersPlanReply([{ entry: 1, status: 'refused' }]).next).not.toContain('apply_notice_numbers')
    expect(noticeNumbersSameNoticeWords(1)).toContain('entry 1')
  })

  it('an apply reads the numbers back, and says so when they did not land', () => {
    const dry = noticeNumbersDryRun(payload({ owner: N1, contractor: '' }), worldOf())
    if (!dry.ok) throw new Error(dry.refused)
    const done = noticeNumbersAppliedWords(payload(), 'JP2291', dry.write, { sends: dry.write.sends })
    expect(done).toMatchObject({ ok: true, filing_id: FILING, still_owed: 1, copies: [{ copy: 'owner', tracking: N1, mailed_on: '2026-11-16' }, { copy: 'original_contractor', tracking: null }] })
    expect(done.next).toBe('JP2291: 1 envelope still owes a number, and the desk reads tracking owed.')
    const full = noticeNumbersDryRun(payload({ owner: N1 }), worldOf())
    if (!full.ok) throw new Error(full.refused)
    expect(noticeNumbersAppliedWords(payload(), 'JP2291', full.write, { sends: full.write.sends }).next).toBe('JP2291: every envelope of this notice has its number.')
    expect(noticeNumbersAppliedWords(payload(), 'JP2291', dry.write, null)).toMatchObject({ ok: false })
    expect(noticeNumbersAppliedWords(payload(), 'JP2291', dry.write, { sends: [send('owner', N2), send('original_contractor', N2)] })).toMatchObject({ ok: false })
  })
})
