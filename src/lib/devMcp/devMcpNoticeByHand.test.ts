/**
 * The dev seat's notice recorded by hand (v2.7229; server 0.85.0): plan_notice_by_hand → apply_notice_by_hand. The
 * kernel runs here against a recording fake; the pins hold the server, its instructions, the README and the function
 * docs to it, and hold the verb to the Lien desk's own form: its rows, its rules and its mark on the desk item.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  BY_HAND_OTHER_COLS,
  BY_HAND_PRIMARY_COLS,
  ISSUER_SETTINGS_KEY,
  NOTICE_BY_HAND_JOBS_MAX,
  NOTICE_BY_HAND_NOTE_MAX,
  NOTICE_BY_HAND_VERBS,
  byHandInputOf,
  isNoticeByHandVerb,
  noticeByHandAppliedWords,
  noticeByHandDryRun,
  noticeByHandInput,
  noticeByHandItemPatches,
  noticeByHandRows,
  readNoticeByHandWorld,
  type ByHandJobRow,
  type NoticeByHandPayload,
  type NoticeByHandWorld,
} from '../../../supabase/functions/_shared/devMcpNoticeByHand'
import { WRITE_VERBS, isWriteVerb, planHash, planVerbFor, writeRpcBody } from '../../../supabase/functions/_shared/devMcpWrites'
import { byHandFilingPayloads } from '../jobs/lienNoticeByHand'
import { buildLienNoticeFieldsForJob } from '../jobs/lienNoticeJobFields'
import { sentAtForTypedDay } from '../jobs/lienSentAt'
import { APP_SETTINGS_KEY_PHYSICAL_INVOICE_ISSUER_V1 } from '../appSettingsKeys'

const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')
const README = readFileSync('docs/dev-mcp/README.md', 'utf8')
const EDGE = readFileSync('docs/EDGE_FUNCTIONS.md', 'utf8')
const FORM_IO = readFileSync('src/lib/jobs/lienNoticeByHandIo.ts', 'utf8')
const DESK_IO = readFileSync('src/lib/jobs/lienDeskIo.ts', 'utf8')
const KERNELS = readFileSync('scripts/edge-kernels.mjs', 'utf8')

const A = '99999999-1111-4111-8111-111111111111'
const B = '99999999-2222-4222-8222-222222222222'
const C = '99999999-3333-4333-8333-333333333333'
const D = '99999999-4444-4444-8444-444444444444'
const PROPERTY = 'aaaaaaaa-1111-4111-8111-111111111111'
const DEV = 'ffffffff-1111-4111-8111-111111111111'
const MASTER = 'eeeeeeee-1111-4111-8111-111111111111'
const HASH = 'a'.repeat(64)
const TODAY = '2026-11-13'

const jobRow = (id: string, number: string, revenue: number, paid: number, over: Partial<ByHandJobRow> = {}): ByHandJobRow => ({
  id, job_name: `ZZ Test ${number}`, job_address: '12 Sample Rd, Marlow, TX 78000', hcp_number: number, click_number: '', status: 'billed', revenue, payments_made: paid, customer_address_id: PROPERTY,
  ...over,
})
const PRIMARY = jobRow(A, '608', 5000, 3800, { gc_customer_id: 'cccccccc-1111-4111-8111-111111111111', master_user_id: MASTER, service_type_id: null, lien_retainage_held: null })
const world = (over: Partial<NoticeByHandWorld> = {}): NoticeByHandWorld => ({
  primary: PRIMARY,
  primaryBilledOpen: 1200,
  primaryCorrection: false,
  others: [jobRow(B, '790', 900, 0), jobRow(C, '226', 300, 0), jobRow(D, '867', 700, 0)],
  items: [],
  notices: [],
  property: { propertyKind: 'residential', homestead: false },
  gcName: 'ZZ Test Builders',
  signer: { id: MASTER, name: 'Sam Sample', notes: 'Sam Sample, Master Plumber' },
  issuer: { companyName: 'ZZ Test Plumbing', addressText: '1 Main St\nMarlow, TX 78000' },
  serviceTypeName: 'Plumbing',
  ...over,
})
const notice = (over: Record<string, unknown> = {}): NoticeByHandPayload => {
  const built = noticeByHandInput('plan_notice_by_hand', { notice: { job_id: A, also_covers: [B, C], sent_on: '2026-09-22', method: 'certified_mail', tracking: '9507 0000 0000 0000 0000 11', to: ['owner'], claim_as_printed: 4180.5, months_as_printed: ['2026-08', '2026-04'], saved_copy_link: 'https://drive.example/copy', saved_copy_note: 'receipt 9/22', ...over } })
  if (!built.ok) throw new Error(built.error)
  return built.p
}
const WHO = { userId: DEV, name: 'Dev Person' }
const planned = (p: NoticeByHandPayload, w: NoticeByHandWorld) => {
  const d = noticeByHandDryRun(p, w, WHO, TODAY)
  if (!d.ok) throw new Error(d.refused)
  return d
}

describe('the verbs — in the table, on the server, in the docs', () => {
  it('is a pair that names no RPC, declared and handled by the server at 0.85.0', () => {
    expect(NOTICE_BY_HAND_VERBS).toEqual(['plan_notice_by_hand', 'apply_notice_by_hand'])
    for (const v of NOTICE_BY_HAND_VERBS) {
      expect(isNoticeByHandVerb(v)).toBe(true)
      expect(isWriteVerb(v)).toBe(true)
      expect(WRITE_VERBS[v].rpc).toBeNull()
      expect(SERVER).toContain(`case '${v}':`)
      expect(SERVER).toContain(`name: '${v}',`)
    }
    expect(isNoticeByHandVerb('plan_last_work_day')).toBe(false)
    expect(planVerbFor('apply_notice_by_hand')).toBe('plan_notice_by_hand')
    expect(Object.keys(WRITE_VERBS)).toHaveLength(105)
    expect(SERVER).toContain("const SERVER_VERSION = '0.87.0'")
    expect(SERVER).toContain('Writes are one hundred and five verbs and nothing else:')
    expect(SERVER).toContain('plan_notice_by_hand → apply_notice_by_hand (a § 53.056 lien notice that already went out')
    expect(SERVER).toContain("if (who.role !== 'dev') return refused(`${name} writes, and only a dev's own key may write.`)")
    expect(README).toContain('`plan_notice_by_hand(notice)` · `apply_notice_by_hand(notice, plan_hash)`')
    expect(README).toContain("one hundred and three since v2.7229's notice recorded by hand")
    expect(EDGE).toContain('**v2.7229 (server 0.85.0)')
  })

  it('writes the form’s own rows and its own mark, with the form’s kernels from the mirror', () => {
    // The form: one insert of the kernel's payloads, then markLienDeskItemSent on each job's live item.
    expect(FORM_IO).toContain("supabase.from('job_lien_filings').insert(payloads as never).select('id, job_id')")
    expect(FORM_IO).toContain('const payloads = byHandFilingPayloads(input, { userId: opts.userId, packetId, fieldsFor: () => fields })')
    expect(FORM_IO).toContain('const fields: LienNoticeFields = { ...opts.fields, claimAmount: input.printedClaim.toFixed(2) }')
    expect(FORM_IO).toContain(".in('status', ['waiting', 'working', 'ready_to_bill', 'billed'])")
    expect(DESK_IO).toContain("update({ status: 'sent', sent_filing_id: filingId, ...(sentAt ? { sent_at: sentAt } : {}) } as never).eq('id', itemId)")
    expect(SERVER).toContain("await restRows(session, 'POST', 'job_lien_filings', 'select=id,job_id', noticeByHandRows(dry, { userId: who.userId }, packetId))")
    expect(SERVER).toContain("await restRows(session, 'PATCH', 'job_lien_desk_items', `id=eq.${it.itemId}`, it.patch)")
    expect(SERVER).toContain("restGet(session, 'rpc/lien_billed_open',")
    for (const f of ['lienNoticeByHand', 'lienSentAt', 'lienNoticeJobFields', 'lienSigner']) expect(KERNELS).toContain(`'lib/jobs/${f}.ts': { values: [], types: [] },`)
    expect(ISSUER_SETTINGS_KEY).toBe(APP_SETTINGS_KEY_PHYSICAL_INVOICE_ISSUER_V1)
    for (const col of ['revenue', 'payments_made', 'customer_address_id', 'job_address']) {
      expect(BY_HAND_PRIMARY_COLS).toContain(col)
      expect(BY_HAND_OTHER_COLS).toContain(col)
    }
  })
})

describe('noticeByHandInput — the shape', () => {
  it('takes the paper as typed, sorts its months and keeps who it went to in the statute’s order', () => {
    const p = notice({ to: ['original_contractor', 'owner'], claim_as_printed: '$4,180.50' })
    expect(p).toEqual({ action: 'notice_by_hand', job_id: A, also_covers: [B, C], sent_on: '2026-09-22', method: 'certified_mail', tracking: '9507 0000 0000 0000 0000 11', to: ['owner', 'original_contractor'], claim_as_printed: 4180.5, months_as_printed: ['2026-04', '2026-08'], saved_copy_link: 'https://drive.example/copy', saved_copy_note: 'receipt 9/22' })
    expect(notice({ also_covers: undefined, tracking: undefined, saved_copy_link: undefined, saved_copy_note: undefined })).toMatchObject({ also_covers: [], tracking: '', saved_copy_link: '', saved_copy_note: '' })
  })
  it('refuses the rest in words', () => {
    const bad = (over: Record<string, unknown>) => noticeByHandInput('plan_notice_by_hand', { notice: { job_id: A, sent_on: '2026-09-22', method: 'certified_mail', to: ['owner'], claim_as_printed: 100, months_as_printed: ['2026-08'], ...over } })
    expect(noticeByHandInput('plan_notice_by_hand', {})).toMatchObject({ ok: false, error: expect.stringContaining('plan_notice_by_hand needs notice') })
    expect(bad({ job_id: 'J608' })).toMatchObject({ ok: false, error: expect.stringContaining('find_job') })
    expect(bad({ also_covers: [A] })).toMatchObject({ ok: false, error: expect.stringContaining('named twice') })
    expect(bad({ also_covers: 'all' })).toMatchObject({ ok: false, error: expect.stringContaining('also_covers is a list') })
    expect(bad({ also_covers: Array.from({ length: NOTICE_BY_HAND_JOBS_MAX }, (_, i) => `99999999-0000-4000-8000-${String(i).padStart(12, '0')}`) })).toMatchObject({ ok: false, error: expect.stringContaining('at most 20 jobs') })
    expect(bad({ sent_on: 'Sep 22' })).toMatchObject({ ok: false, error: expect.stringContaining('sent_on is YYYY-MM-DD') })
    expect(bad({ method: 'pigeon' })).toMatchObject({ ok: false, error: expect.stringContaining('method is one of') })
    expect(bad({ to: ['homeowner'] })).toMatchObject({ ok: false, error: expect.stringContaining('only who the paper really went to') })
    expect(bad({ claim_as_printed: 'a lot' })).toMatchObject({ ok: false, error: expect.stringContaining('claim_as_printed') })
    expect(bad({ months_as_printed: ['Aug 2026'] })).toMatchObject({ ok: false, error: expect.stringContaining('months_as_printed is a list of YYYY-MM') })
    expect(bad({ saved_copy_link: 'drive.example/x' })).toMatchObject({ ok: false, error: expect.stringContaining('https link') })
    expect(bad({ saved_copy_note: 'x'.repeat(NOTICE_BY_HAND_NOTE_MAX + 1) })).toMatchObject({ ok: false, error: expect.stringContaining('under 500') })
    expect(noticeByHandInput('apply_notice_by_hand', { notice: { job_id: A, sent_on: '2026-09-22', method: 'mail', to: ['owner'], claim_as_printed: 1, months_as_printed: ['2026-08'] } })).toMatchObject({ ok: false, error: expect.stringContaining('plan_hash') })
  })
  it('goes through the seat’s one write door with no RPC and no dry-run body', () => {
    const body = writeRpcBody('apply_notice_by_hand', { notice: { job_id: A, sent_on: '2026-09-22', method: 'mail', to: ['owner'], claim_as_printed: 1, months_as_printed: ['2026-08'] }, plan_hash: HASH })
    expect(body).toMatchObject({ ok: true, rpc: null, step: 'apply', dryRunBody: null, target: A, planHash: HASH })
  })
})

describe('readNoticeByHandWorld — the form’s own reads', () => {
  it('reads the first job, the other unpaid jobs at its property, the live items, the notices and the nine values’ sources', async () => {
    const asked: string[] = []
    const reads = {
      rows: async (table: string, query: string) => {
        asked.push(`${table}?${query}`)
        if (table === 'jobs_ledger' && query.includes(`id=eq.${A}`)) return [PRIMARY as unknown as Record<string, unknown>]
        // One paid job and the job itself never reach the list: the form's kernel drops them.
        if (table === 'jobs_ledger') return [jobRow(B, '790', 900, 0), jobRow(C, '226', 300, 300), jobRow(D, '867', 700, 0, { customer_address_id: 'bbbbbbbb-1111-4111-8111-111111111111' })] as unknown as Record<string, unknown>[]
        if (table === 'job_lien_desk_items') return [{ id: 'item-new', job_id: B, status: 'approved', months: ['2026-09'], created_at: '2026-11-01' }, { id: 'item-old', job_id: B, status: 'drafted', months: ['2026-08'], created_at: '2026-10-01' }]
        if (table === 'job_lien_filings') return [{ id: 'f1', job_id: A, sends: [{ recipient: 'owner', sent_on: '2026-10-14', tracking: ' 9507 1 ' }], months_covered: ['2026-08'], by_hand: false, amount: 1200, printed_claim: null }]
        if (table === 'job_lien_claim_corrections') return []
        if (table === 'customer_addresses') return [{ property_kind: 'residential', homestead: false }]
        if (table === 'customers') return [{ name: ' ZZ Test Builders ' }]
        if (table === 'users') return [{ id: MASTER, name: 'Sam Sample', notes: 'Sam Sample, Master Plumber' }]
        if (table === 'app_settings') return [{ value_text: JSON.stringify({ companyName: 'ZZ Test Plumbing', addressText: '1 Main St', phone: '555' }) }]
        return []
      },
      billedOpen: async () => 1200,
    }
    const w = await readNoticeByHandWorld(reads, notice({ also_covers: [B] }))
    expect(w.others.map((j) => j.id)).toEqual([B])
    expect(w.items).toEqual([{ id: 'item-new', job_id: B, status: 'approved', months: ['2026-09'] }])
    expect(w.notices).toEqual([{ id: 'f1', job_id: A, first_sent_on: '2026-10-14', trackings: ['9507 1'], months: ['2026-08'], by_hand: false, amount: 1200, printed_claim: null }])
    expect(w).toMatchObject({ primaryBilledOpen: 1200, primaryCorrection: false, property: { propertyKind: 'residential', homestead: false }, gcName: 'ZZ Test Builders', issuer: { companyName: 'ZZ Test Plumbing', addressText: '1 Main St' } })
    expect(asked.some((q) => q.startsWith('jobs_ledger?') && q.includes('status=in.(waiting,working,ready_to_bill,billed)') && q.includes(`customer_address_id=eq.${PROPERTY}`) && q.includes(`id=neq.${A}`))).toBe(true)
    expect(asked.some((q) => q.startsWith('job_lien_desk_items?') && q.includes('kind=eq.notice_53_056') && q.includes('voided_at=is.null') && q.includes('status=not.in.(sent,missed)'))).toBe(true)
    expect(asked.some((q) => q.startsWith('app_settings?') && q.includes(`key=eq.${ISSUER_SETTINGS_KEY}`))).toBe(true)
  })
  it('a job nobody can see reads as no job', async () => {
    const w = await readNoticeByHandWorld({ rows: async () => [], billedOpen: async () => 0 }, notice())
    expect(w.primary).toBeNull()
  })
})

describe('noticeByHandDryRun — the form’s rows, and what the seat refuses', () => {
  it('plans one row a covered job on the form’s own payloads, each at its share, with the paper’s total beside it', () => {
    const p = notice()
    const d = planned(p, world())
    const reply = d.reply as { jobs: Array<{ id: string; share: number; printed_claim_on_its_row: number | null; desk_item: unknown }>; covered_total: number; difference: string | null; says: string; one_recipient?: string; other_unpaid_jobs_at_the_property_not_covered?: Array<{ id: string }>; snapshot: Record<string, unknown> }
    expect(reply.jobs.map((j) => [j.id, j.share])).toEqual([[A, 1200], [B, 900], [C, 300]])
    expect(reply.covered_total).toBe(2400)
    expect(reply.difference).toContain('printed $4,181')
    expect(reply.jobs.every((j) => j.printed_claim_on_its_row === 4180.5 && j.desk_item === null)).toBe(true)
    expect(reply.one_recipient).toContain('no copy to the original contractor is on record')
    expect(reply.other_unpaid_jobs_at_the_property_not_covered?.map((j) => j.id)).toEqual([D])
    expect(reply.says).toContain('goes on record for 3 jobs')
    // The snapshot is the form's nine values for the first job, the claim replaced by the paper's.
    const fields = { ...buildLienNoticeFieldsForJob({ jobName: PRIMARY.job_name, jobAddress: PRIMARY.job_address, homesteadStatement: true, originalContractorName: 'ZZ Test Builders', openBalance: 1200, contactPerson: 'Sam Sample, Master Plumber', issuer: { companyName: 'ZZ Test Plumbing', addressText: '1 Main St\nMarlow, TX 78000' }, todayYmd: TODAY, retainageHeld: null, serviceTypeName: 'Plumbing' }), claimAmount: '4180.50' }
    expect(reply.snapshot).toEqual(fields)
    // And the rows are the kernel's own, on one packet.
    const rows = noticeByHandRows(d, { userId: DEV }, 'packet-1')
    expect(rows).toEqual(byHandFilingPayloads(byHandInputOf(p, world()), { userId: DEV, packetId: 'packet-1', fieldsFor: () => fields }))
    expect(rows).toHaveLength(3)
    expect(rows[0]).toMatchObject({ job_id: A, kind: 'notice_53_056', amount: 1200, months_covered: ['2026-04', '2026-08'], by_hand: true, packet_id: 'packet-1', printed_claim: 4180.5, created_by: DEV, sends: [{ recipient: 'owner', method: 'certified_mail', tracking: '9507 0000 0000 0000 0000 11', sent_on: '2026-09-22' }] })
  })

  it('marks each covered job’s live item sent on the mailing day, as the form does, and leaves a job with none alone', () => {
    const w = world({ items: [{ id: 'item-b', job_id: B, status: 'approved', months: ['2026-09'] }] })
    const d = planned(notice(), w)
    const jobs = (d.reply as { jobs: Array<{ id: string; desk_item: { id: string; becomes: string; sent_at: string } | null }> }).jobs
    expect(jobs.find((j) => j.id === B)?.desk_item).toMatchObject({ id: 'item-b', becomes: 'sent', sent_at: sentAtForTypedDay('2026-09-22', TODAY) })
    expect(noticeByHandItemPatches(d, new Map([[A, 'fa'], [B, 'fb'], [C, 'fc']]), TODAY)).toEqual([{ itemId: 'item-b', jobId: B, patch: { status: 'sent', sent_filing_id: 'fb', sent_at: sentAtForTypedDay('2026-09-22', TODAY) } }])
    // A row that did not land marks nothing.
    expect(noticeByHandItemPatches(d, new Map([[A, 'fa']]), TODAY)).toEqual([])
    // Mailed today: the trigger stamps the moment, as the form leaves it.
    const today = planned(notice({ sent_on: TODAY }), w)
    expect(noticeByHandItemPatches(today, new Map([[B, 'fb']]), TODAY)).toEqual([{ itemId: 'item-b', jobId: B, patch: { status: 'sent', sent_filing_id: 'fb' } }])
  })

  it('refuses what the form refuses, a job the form would not offer, a claim set by hand and a mailing already on record', () => {
    const refusal = (p: NoticeByHandPayload, w: NoticeByHandWorld) => {
      const d = noticeByHandDryRun(p, w, WHO, TODAY)
      return d.ok ? '' : d.refused
    }
    expect(refusal(notice(), world({ primary: null }))).toContain('No job')
    expect(refusal(notice({ to: [] }), world())).toContain('Who received it')
    expect(refusal(notice({ months_as_printed: [] }), world())).toContain('The months as printed')
    expect(refusal(notice({ sent_on: '2026-11-14' }), world())).toContain('The send date is in the future')
    expect(refusal(notice({ method: 'email', tracking: '' }), world())).toContain('An email needs the address')
    expect(refusal(notice({ claim_as_printed: 0 }), world())).toContain('The claim as printed')
    expect(refusal(notice({ also_covers: [B, '99999999-5555-4555-8555-555555555555'] }), world())).toContain('not among the other unpaid jobs at this property')
    expect(refusal(notice(), world({ primaryCorrection: true }))).toContain('claim set by hand')
    const held = world({ notices: [{ id: 'f9', job_id: B, first_sent_on: '2026-09-22', trackings: ['9507000000000000000011'], months: ['2026-08'], by_hand: true, amount: 900, printed_claim: 4180.5 }] })
    expect(refusal(notice(), held)).toContain('Already on record: JP790 holds a notice mailed 2026-09-22')
    // Another day's notice on the job is no bar.
    expect(noticeByHandDryRun(notice(), world({ notices: [{ id: 'f8', job_id: B, first_sent_on: '2026-10-14', trackings: ['x'], months: ['2026-08'], by_hand: false, amount: 900, printed_claim: null }] }), WHO, TODAY).ok).toBe(true)
  })

  it('the hash moves with the paper and with what the jobs read', async () => {
    const base = await planHash('plan_notice_by_hand', notice(), planned(notice(), world()).reply)
    expect(await planHash('plan_notice_by_hand', notice(), planned(notice(), world()).reply)).toBe(base)
    expect(await planHash('plan_notice_by_hand', notice({ to: ['owner', 'original_contractor'] }), planned(notice({ to: ['owner', 'original_contractor'] }), world()).reply)).not.toBe(base)
    expect(await planHash('plan_notice_by_hand', notice(), planned(notice(), world({ primaryBilledOpen: 1100 })).reply)).not.toBe(base)
    expect(await planHash('plan_notice_by_hand', notice(), planned(notice(), world({ items: [{ id: 'item-b', job_id: B, status: 'approved', months: ['2026-09'] }] })).reply)).not.toBe(base)
  })
})

describe('noticeByHandAppliedWords — what landed', () => {
  it('names each job with its filing and its item, and a job whose row did not land with the rest', () => {
    const p = notice()
    const all = noticeByHandAppliedWords(p, 'packet-1', [
      { jobId: A, label: '608', filingId: 'fa', item: 'none' },
      { jobId: B, label: '790', filingId: 'fb', item: 'marked sent' },
      { jobId: C, label: '226', filingId: 'fc', item: { failed: 'refused' } },
    ])
    expect(all).toMatchObject({ ok: true, packet_id: 'packet-1' })
    expect((all.recorded as Array<{ desk_item: string }>).map((r) => r.desk_item)).toEqual(['none', 'marked sent', 'not marked sent: refused'])
    expect(String(all.next)).toContain('on record for 3 jobs; 1 desk item was not marked sent')
    const part = noticeByHandAppliedWords(p, 'packet-1', [{ jobId: A, label: '608', filingId: 'fa', item: 'none' }, { jobId: B, label: '790', filingId: null, item: 'none' }])
    expect(part).toMatchObject({ ok: false, not_recorded: [{ job: '790', job_id: B }] })
    expect(String(part.next)).toContain('Recorded on 1 of 2')
  })
})
