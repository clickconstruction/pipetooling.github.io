/**
 * The dev seat's affidavit draft (v2.7247; server 0.87.0): plan_affidavit_draft → apply_affidavit_draft. The kernel
 * runs here against a recording fake; the pins hold the server, its instructions, the README and the function docs to
 * it, and hold the verb to the Lien desk's own pane: its draft row, its queue and its gates.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  AFFIDAVIT_DESK_LEAD_DAYS,
  AFFIDAVIT_DRAFT_JOB_COLS,
  AFFIDAVIT_DRAFT_VERBS,
  AFFIDAVIT_DRAFT_WINDOW_DAYS,
  affidavitDraftAppliedWords,
  affidavitDraftDryRun,
  affidavitDraftInput,
  isAffidavitDraftVerb,
  readAffidavitDraftWorld,
  type AffidavitDraftPayload,
  type AffidavitDraftWorld,
  type AffidavitDraftWrite,
} from '../../../supabase/functions/_shared/devMcpAffidavitDraft'
import { WRITE_VERBS, isWriteVerb, planHash, planVerbFor, writeRpcBody } from '../../../supabase/functions/_shared/devMcpWrites'
import { LIEN_DESK_LEAD_DAYS } from '../jobs/lienDesk'
import { LIEN_DESK_SIGNATURE_CLEAR } from '../jobs/lienNoticeSignature'
import { buildLienNoticeFieldsForJob } from '../jobs/lienNoticeJobFields'
import type { LienAffidavitRow } from '../jobs/lienDeskAffidavits'

const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')
const README = readFileSync('docs/dev-mcp/README.md', 'utf8')
const EDGE = readFileSync('docs/EDGE_FUNCTIONS.md', 'utf8')
const PANE = readFileSync('src/components/jobs/LienDeskAffidavitPane.tsx', 'utf8')
const DESK_IO = readFileSync('src/lib/jobs/lienDeskIo.ts', 'utf8')
const DESK_DATA = readFileSync('src/hooks/useLienDeskData.ts', 'utf8')
const KERNELS = readFileSync('scripts/edge-kernels.mjs', 'utf8')

const JOB = '99999999-1111-4111-8111-111111111111'
const PROPERTY = 'aaaaaaaa-1111-4111-8111-111111111111'
const GC = 'cccccccc-1111-4111-8111-111111111111'
const DEV = 'ffffffff-1111-4111-8111-111111111111'
const MASTER = 'eeeeeeee-1111-4111-8111-111111111111'
const ITEM = 'dddddddd-1111-4111-8111-111111111111'
const HASH = 'a'.repeat(64)
const TODAY = '2026-11-14'
const WHO = { userId: DEV, name: 'Dev Person' }

const windowRow = (over: Partial<LienAffidavitRow> = {}): LienAffidavitRow => ({
  job_id: JOB, last_month: '2026-09', deadline: '2026-12-15', is_sub: true, noticed: true, filed: false, open_balance: 1200, customer_id: null, gc_customer_id: GC,
  property_kind: 'residential', has_owner: true, has_legal: true, homestead: false, desk_item_id: null, desk_status: null, month_source: 'hand',
  ...over,
})
const NOTICE = { kind: 'notice_53_056', months_covered: ['2026-04', '2026-06', '2026-07', '2026-08'], sends: [{ recipient: 'owner', method: 'certified_mail', sent_on: '2026-09-22', tracking: '9507 0000 0000 0000 0000 11' }], voided_at: null }
const world = (over: Partial<AffidavitDraftWorld> = {}): AffidavitDraftWorld => ({
  job: { id: JOB, job_name: 'ZZ Test 608', job_address: '12 Sample Rd, Marlow, TX 78000', hcp_number: '608', click_number: '', customer_address_id: PROPERTY, gc_customer_id: GC, master_user_id: MASTER, service_type_id: null, first_work_date: '2026-03-31', last_work_date: '2026-04-01', lien_last_work_on: '2026-09-11' },
  row: windowRow(),
  items: [],
  address: { id: PROPERTY, county: 'Marlow', legal_description: 'LOT 1 BLK 2', property_kind: 'residential', homestead: false, homestead_answered_at: '2026-11-01T00:00:00Z', owner_name: 'Pat Sample', owner_company: '', owner_mailing_address: '9 Owner Ln, Marlow, TX 78000', owner_mode: 'person' },
  ownerOverride: null,
  gc: { id: GC, name: 'ZZ Test Builders', address: '5 Builder Way, Marlow, TX 78000', email: 'gc@example.test' },
  correctionOff: null,
  filings: [NOTICE],
  signer: { id: MASTER, name: 'Sam Sample', notes: 'Sam Sample, Master Plumber' },
  issuer: { companyName: 'ZZ Test Plumbing', addressText: '1 Main St\nMarlow, TX 78000' },
  serviceTypeName: 'Plumbing',
  ...over,
})
const payload = (): AffidavitDraftPayload => {
  const built = affidavitDraftInput('plan_affidavit_draft', { affidavit: { job_id: JOB } })
  if (!built.ok) throw new Error(built.error)
  return built.p
}
const planned = (w: AffidavitDraftWorld) => {
  const dry = affidavitDraftDryRun(payload(), w, WHO, TODAY)
  if (!dry.ok) throw new Error(dry.refused)
  return dry
}
/** The fields of a planned new draft; throws when the plan refreshes a standing one instead. */
const insertedFields = (write: AffidavitDraftWrite): Record<string, unknown> => {
  if (write.kind !== 'insert') throw new Error('expected a new draft')
  return write.row.fields as Record<string, unknown>
}
const refusal = (w: AffidavitDraftWorld) => {
  const dry = affidavitDraftDryRun(payload(), w, WHO, TODAY)
  if (dry.ok) throw new Error('expected a refusal')
  return dry.refused
}

describe('the verbs — in the table, on the server, in the docs', () => {
  it('is a pair that names no RPC, declared and handled by the server at 0.87.0', () => {
    expect(AFFIDAVIT_DRAFT_VERBS).toEqual(['plan_affidavit_draft', 'apply_affidavit_draft'])
    for (const v of AFFIDAVIT_DRAFT_VERBS) {
      expect(isAffidavitDraftVerb(v)).toBe(true)
      expect(isWriteVerb(v)).toBe(true)
      expect(WRITE_VERBS[v].rpc).toBeNull()
      expect(SERVER).toContain(`case '${v}':`)
      expect(SERVER).toContain(`name: '${v}',`)
    }
    expect(isAffidavitDraftVerb('plan_notice_by_hand')).toBe(false)
    expect(planVerbFor('apply_affidavit_draft')).toBe('plan_affidavit_draft')
    expect(Object.keys(WRITE_VERBS)).toHaveLength(109)
    expect(SERVER).toContain("const SERVER_VERSION = '0.87.0'")
    expect(SERVER).toContain('Writes are one hundred and nine verbs and nothing else:')
    expect(SERVER).toContain('plan_affidavit_draft → apply_affidavit_draft (a lien affidavit drafted on the Lien desk as its Affidavits pane saves one')
    expect(README).toContain('`plan_affidavit_draft(affidavit)` · `apply_affidavit_draft(affidavit, plan_hash)`')
    expect(README).toContain("one hundred and nine since v2.7247's affidavit draft")
    expect(EDGE).toContain('**v2.7247 (server 0.87.0)')
  })

  it('writes the pane’s own draft row, and reads the desk’s own reader with the desk’s kernels from the mirror', () => {
    // The pane: the draft's months and fields, saved as an affidavit item in status drafted.
    expect(PANE).toContain("months: [entry.lastMonth], fields: draftFields(), coverNote: false, userId: authUserId, kind: 'affidavit' })")
    expect(PANE).toContain("gcEmail: gc?.email ?? '', ...(entry.lastMonthFromCreation ? { monthsDatedFromCreation: true as const } : {}), ...(form === 'short' ? LIEN_AFFIDAVIT_SHORT_FORM_MARK : {}) })")
    expect(DESK_IO).toContain("const payload = { months: input.months, fields: draftJson(input.fields), cover_note: input.coverNote }")
    expect(DESK_IO).toContain(".insert({ job_id: input.jobId, kind: input.kind ?? 'notice_53_056', status: 'drafted', drafted_by: input.userId, ...payload } as never)")
    expect(DESK_IO).toContain(".update({ ...payload, status: 'drafted', ...LIEN_DESK_SIGNATURE_CLEAR } as never).eq('id', input.itemId as string)")
    // The desk: the same reader, and the same three fills before the queue.
    expect(DESK_DATA).toContain("supabase.rpc('list_lien_affidavit_windows', { p_within_days: LIEN_DESK_LEAD_DAYS } as never)")
    expect(DESK_DATA).toContain('withHomesteadAnswer(withPublicOwner(withContractorAddress(affidavitRowsKept, gcsById), affidavitAddressIdByJob, affidavitPropertiesById), affidavitAddressIdByJob, affidavitPropertiesById)')
    expect(SERVER).toContain("windows: (days) => rowsOf('rpc/list_lien_affidavit_windows', `p_within_days=${days}`)")
    expect(SERVER).toContain("await restRows(session, 'POST', 'job_lien_desk_items', 'select=id', dry.write.row)")
    expect(SERVER).toContain("await restRows(session, 'PATCH', 'job_lien_desk_items', `id=eq.${dry.write.itemId}&kind=eq.affidavit&status=eq.drafted`, dry.write.patch)")
    for (const f of ['lienDeskAffidavits', 'lienAffidavitNotices', 'lienAffidavitNoticeCheck', 'lienClaimCorrection', 'lienProperty', 'lienAffidavitForm']) expect(KERNELS).toContain(`'lib/jobs/${f}.ts': { values: [], types: [] },`)
    expect(AFFIDAVIT_DESK_LEAD_DAYS).toBe(LIEN_DESK_LEAD_DAYS)
    expect(AFFIDAVIT_DRAFT_WINDOW_DAYS).toBeGreaterThan(LIEN_DESK_LEAD_DAYS)
    for (const col of ['first_work_date', 'last_work_date', 'lien_last_work_on', 'customer_address_id', 'gc_customer_id', 'master_user_id']) expect(AFFIDAVIT_DRAFT_JOB_COLS).toContain(col)
  })
})

describe('affidavitDraftInput — the shape', () => {
  it('takes one job, and an apply needs the plan’s hash', () => {
    expect(affidavitDraftInput('plan_affidavit_draft', { affidavit: { job_id: JOB.toUpperCase() } })).toEqual({ ok: true, p: { action: 'affidavit_draft', job_id: JOB }, target: JOB, planHash: null })
    expect(affidavitDraftInput('apply_affidavit_draft', { affidavit: { job_id: JOB }, plan_hash: HASH })).toMatchObject({ ok: true, planHash: HASH })
    for (const bad of [{}, { affidavit: {} }, { affidavit: { job_id: '608' } }, { affidavit: [JOB] }]) {
      const r = affidavitDraftInput('plan_affidavit_draft', bad)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.error).toContain('needs affidavit')
    }
    const noHash = affidavitDraftInput('apply_affidavit_draft', { affidavit: { job_id: JOB } })
    expect(noHash.ok).toBe(false)
    if (!noHash.ok) expect(noHash.error).toContain('plan_affidavit_draft replied with')
  })

  it('goes through the seat’s one write door with no RPC and no dry-run body', () => {
    const built = writeRpcBody('apply_affidavit_draft', { affidavit: { job_id: JOB }, plan_hash: HASH })
    expect(built).toMatchObject({ ok: true, rpc: null, step: 'apply', dryRunBody: null, target: JOB, planHash: HASH })
  })
})

describe('readAffidavitDraftWorld — the desk’s own reads', () => {
  it('reads the job, its row from the desk’s reader, its items, its property, its GC, its claim and its notices', async () => {
    const asked: string[] = []
    const tables: Record<string, Record<string, unknown>[]> = {
      jobs_ledger: [world().job as never],
      job_lien_desk_items: [],
      customer_addresses: [world().address as never],
      job_property_owners: [],
      customers: [{ id: GC, name: ' ZZ Test Builders ', address: '5 Builder Way', contact_info: { email: 'gc@example.test' } }],
      job_lien_claim_corrections: [{ job_id: JOB, amount_off: '200' }],
      job_lien_filings: [{ id: 'f1', ...NOTICE, created_at: '2026-11-14T04:42:00Z' }],
      users: [{ id: MASTER, name: 'Sam Sample', notes: 'Sam Sample, Master Plumber' }],
      app_settings: [{ value_text: JSON.stringify({ companyName: 'ZZ Test Plumbing', addressText: '1 Main St' }) }],
    }
    const w = await readAffidavitDraftWorld(
      {
        rows: async (table, query) => {
          asked.push(`${table}?${query}`)
          return tables[table] ?? []
        },
        windows: async (days) => {
          asked.push(`windows:${days}`)
          return [{ ...windowRow({ job_id: 'other' }) }, { ...windowRow(), open_balance: '1200.00' }] as never
        },
      },
      payload(),
    )
    expect(asked).toContain(`windows:${AFFIDAVIT_DRAFT_WINDOW_DAYS}`)
    expect(asked.find((q) => q.startsWith('job_lien_desk_items?'))).toContain('kind=eq.affidavit&voided_at=is.null')
    expect(asked.find((q) => q.startsWith('job_lien_filings?'))).toContain('voided_at=is.null')
    expect(w.row?.open_balance).toBe(1200)
    expect(w.gc).toEqual({ id: GC, name: 'ZZ Test Builders', address: '5 Builder Way', email: 'gc@example.test' })
    expect(w.correctionOff).toBe(200)
    expect(w.filings).toHaveLength(1)
    expect(w.issuer).toEqual({ companyName: 'ZZ Test Plumbing', addressText: '1 Main St' })
  })

  it('a job nobody can see reads as no job, and a job the desk does not list reads with no row', async () => {
    const none = await readAffidavitDraftWorld({ rows: async () => [], windows: async () => [] }, payload())
    expect(none.job).toBeNull()
    const unlisted = await readAffidavitDraftWorld({ rows: async (table) => (table === 'jobs_ledger' ? [world().job as never] : []), windows: async () => [] }, payload())
    expect(unlisted.job?.id).toBe(JOB)
    expect(unlisted.row).toBeNull()
  })
})

describe('affidavitDraftDryRun — the pane’s draft, and what the seat refuses', () => {
  it('plans the pane’s own row: the last work month, the nine values at the claim, and the short form’s mark', () => {
    const dry = planned(world())
    const w = world()
    const notice = buildLienNoticeFieldsForJob({ jobName: w.job!.job_name, jobAddress: w.job!.job_address, homesteadStatement: true, originalContractorName: 'ZZ Test Builders', openBalance: 1200, contactPerson: 'Sam Sample, Master Plumber', issuer: w.issuer, todayYmd: TODAY, serviceTypeName: 'Plumbing' })
    expect(dry.write).toEqual({ kind: 'insert', row: { job_id: JOB, kind: 'affidavit', status: 'drafted', drafted_by: DEV, months: ['2026-09'], fields: { notice, gcEmail: 'gc@example.test', affidavitForm: 'short' }, cover_note: false } })
    expect(dry.reply.writes).toEqual({ a_new_draft: true })
    expect(dry.reply.not_done).toContain('A draft alone.')
  })

  it('reads back what the paper would say today: the notice’s months inside the work span, the send to the owner, the claim', () => {
    const dry = planned(world())
    const paper = dry.reply.paper_today as Record<string, unknown>
    // The span runs from the first clock day to the day set by hand, so all four noticed months are inside it; September is not noticed.
    expect(paper.months_it_names).toBe('April, June, July and August 2026')
    expect(paper.notice_to_the_owner).toBe('certified mail on September 22, 2026')
    expect(paper.claim).toBe(1200)
    expect(paper.owner).toBe('Pat Sample')
    expect(paper.county).toBe('Marlow')
    expect(paper.original_contractor).toBe('ZZ Test Builders')
    expect(paper.signer).toBe('Sam Sample, Master Plumber')
    expect(dry.reply.desk).toEqual({ pile: 'To draft', last_work_month: '2026-09', last_work_month_from: 'the last day of work set by hand', file_by: '2026-12-15', days_left: 31 })
    // Thirty-one days out is one past what the desk shows.
    expect(String(dry.reply.not_on_the_desk_yet)).toContain('due in 31')
    // No copy to the original contractor is on record: the desk's own line for the attorney.
    expect(dry.reply.ask_the_attorney_before_this_is_filed).toEqual(expect.arrayContaining([expect.stringContaining('original contractor')]))
  })

  it('a claim set by hand comes off, a job made with no hours says so, and a paper with no month in its span says the blank', () => {
    const off = planned(world({ correctionOff: 200 }))
    expect((off.reply.paper_today as Record<string, unknown>).claim).toBe(1000)
    expect((off.reply.paper_today as Record<string, unknown>).claim_set_by_hand).toBe(true)
    expect(insertedFields(off.write).notice).toMatchObject({ claimAmount: '1000.00' })
    const made = planned(world({ row: windowRow({ month_source: 'job_created', last_month: '2026-08', deadline: '2026-11-16' }), job: { ...world().job!, first_work_date: null, last_work_date: null, lien_last_work_on: null } }))
    expect(insertedFields(made.write).monthsDatedFromCreation).toBe(true)
    expect((made.reply.desk as Record<string, unknown>).last_work_month_from).toContain('the month the job was made')
    expect(made.reply.not_on_the_desk_yet).toBeUndefined()
    const blank = planned(world({ filings: [{ ...NOTICE, months_covered: ['2026-10'] }] }))
    expect((blank.reply.paper_today as Record<string, unknown>).months_it_names).toBeNull()
    expect(String(blank.reply.no_month)).toContain('prints a blank')
  })

  it('refreshes a standing draft in place, clearing any signature, as the pane does', () => {
    const dry = planned(world({ items: [{ id: ITEM, job_id: JOB, kind: 'affidavit', status: 'drafted', fields: { affidavitForm: 'short' }, voided_at: null, created_at: '2026-11-13T00:00:00Z', sent_at: null }] }))
    expect(dry.write).toMatchObject({ kind: 'update', itemId: ITEM, patch: { months: ['2026-09'], cover_note: false, status: 'drafted', ...LIEN_DESK_SIGNATURE_CLEAR } })
    expect(dry.reply.writes).toEqual({ refreshes_the_draft: ITEM })
  })

  it('refuses a job nobody sees, one the desk does not list, one a gate holds, and a paper past a draft', () => {
    expect(refusal(world({ job: null }))).toContain('find_job')
    expect(refusal(world({ row: null }))).toContain('lists no affidavit window')
    const gated = refusal(world({ row: windowRow({ noticed: false, has_legal: false }) }))
    expect(gated).toContain('will not draft this yet')
    expect(gated).toContain('County + legal description on the property record')
    expect(gated).toContain('§ 53.056 notice recorded on the job')
    expect(refusal(world({ gc: { id: GC, name: 'ZZ Test Builders', address: '', email: '' } }))).toContain('will not draft this yet')
    const item = (status: string) => [{ id: ITEM, job_id: JOB, kind: 'affidavit', status, fields: {}, voided_at: null, created_at: '2026-11-13T00:00:00Z', sent_at: null }]
    expect(refusal(world({ items: item('awaiting_approval') }))).toContain('already sent for approval')
    expect(refusal(world({ items: item('approved') }))).toContain('already approved')
    expect(refusal(world({ items: item('held') }))).toContain('on hold')
    expect(refusal(world({ row: windowRow({ deadline: '2026-11-01' }) }))).toContain('filing window has closed')
  })

  it('the hash moves with what the desk reads', async () => {
    const a = await planHash('plan_affidavit_draft', payload(), planned(world()).reply)
    const b = await planHash('plan_affidavit_draft', payload(), planned(world({ row: windowRow({ open_balance: 1300 }) })).reply)
    const c = await planHash('plan_affidavit_draft', payload(), planned(world()).reply)
    expect(a).not.toBe(b)
    expect(a).toBe(c)
  })
})

describe('affidavitDraftAppliedWords — what landed', () => {
  it('names the item and the press that comes next, and says so when no row came back', () => {
    const dry = planned(world())
    const done = affidavitDraftAppliedWords(payload(), 'JP608 · ZZ Test 608', dry.write, { id: ITEM, status: 'drafted' })
    expect(done).toMatchObject({ ok: true, item_id: ITEM, wrote: 'a new draft' })
    expect(String(done.next)).toContain('Send for approval')
    expect(String(done.next)).toContain('Nothing was sent for approval, approved, printed or filed.')
    const none = affidavitDraftAppliedWords(payload(), 'JP608 · ZZ Test 608', dry.write, null)
    expect(none.ok).toBe(false)
    expect(String(none.why)).toContain('Plan again')
  })
})
