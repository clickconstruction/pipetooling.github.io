/**
 * The dev seat's served copies and its read of the filed liens, the pure half: plan_lien_service → apply_lien_service
 * and read_lien_filings. The kernel runs here against plain fixtures; the pins hold it to the Lien window's own
 * Enter mail numbers… and the copies window's batch.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  LIEN_FILINGS_READ_MAX,
  LIEN_SERVICE_FILING_COLS,
  LIEN_SERVICE_JOB_COLS,
  LIEN_SERVICE_PLAN_MAX,
  LIEN_SERVICE_VERBS,
  isLienServiceVerb,
  lienFilingLine,
  lienFilingsReadArgs,
  lienFilingsReadReply,
  lienReceiptStagePath,
  lienServiceAppliedWords,
  lienServiceApplyInput,
  lienServiceBatchClashes,
  lienServiceDryRun,
  lienServiceHasContractor,
  lienServicePlanInput,
  lienServicePlanReply,
  lienServiceSends,
  lienServiceShape,
  readLienServiceWorld,
  type LienServiceFiling,
  type LienServicePayload,
  type LienServiceWorld,
} from '../../../supabase/functions/_shared/devMcpLienService'
import { CATALOG_TABLES } from '../../../supabase/functions/dev-mcp/catalog'
import { WRITE_VERBS, isWriteVerb } from '../../../supabase/functions/_shared/devMcpWrites'
import { serviceSends } from '../jobs/lienServiceProof'

const WINDOW = readFileSync('src/components/jobs/LienFilingTabs.tsx', 'utf8')
const BATCH_IO = readFileSync('src/lib/jobs/lienServeNumbersIo.ts', 'utf8')
const BATCH = readFileSync('src/lib/jobs/lienServeNumbers.ts', 'utf8')
const KERNELS = readFileSync('scripts/edge-kernels.mjs', 'utf8')
const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')
const README = readFileSync('docs/dev-mcp/README.md', 'utf8')
const EDGE = readFileSync('docs/EDGE_FUNCTIONS.md', 'utf8')

const JOB = '99999999-2222-4222-8222-222222222222'
const JOB_B = '99999999-3333-4333-8333-333333333333'
const GC = 'cccccccc-2222-4222-8222-222222222222'
const DEV = 'ffffffff-2222-4222-8222-222222222222'
const FILING = 'bbbbbbbb-2222-4222-8222-222222222222'
const HASH = 'a'.repeat(64)
const SHA = 'c'.repeat(64)
const TODAY = '2026-11-20'

const filingRow = (over: Partial<LienServiceFiling> = {}): LienServiceFiling => ({ id: FILING, job_id: JOB, fields: { form: 'short', isSub: true }, filed_at: '2026-11-16', recording_number: '20260222921', county: 'Marlow', document_url: 'https://drive.google.com/file/d/abc/view', serve_due: '2026-11-23', served_at: null, sends: [], ...over })
const world = (over: Partial<LienServiceWorld> = {}): LienServiceWorld => ({
  job: { id: JOB, job_name: 'ZZ Test Maple Court', job_address: '14 Maple Ct, Marlow, TX 78000', hcp_number: '2291', click_number: '', gc_customer_id: GC },
  filing: filingRow(),
  ...over,
})
const service = (over: Record<string, unknown> = {}): Record<string, unknown> => ({ job_id: JOB, served_on: '2026-11-18', owner: { tracking: '9589 0710 5270 0000 0000 11' }, contractor: { tracking: '9589 0710 5270 0000 0000 28' }, ...over })
const shaped = (over: Record<string, unknown> = {}): LienServicePayload => {
  const s = lienServiceShape(service(over))
  if (!s.ok) throw new Error(s.error)
  return s.p
}
const planned = (p: LienServicePayload, w: LienServiceWorld) => {
  const dry = lienServiceDryRun(p, w, TODAY)
  if (!dry.ok) throw new Error(dry.refused)
  return dry
}
const refusal = (p: LienServicePayload, w: LienServiceWorld) => {
  const dry = lienServiceDryRun(p, w, TODAY)
  if (dry.ok) throw new Error('expected a refusal')
  return dry.refused
}

describe('the pair and what it stands on', () => {
  it('is plan_lien_service and apply_lien_service, over the form’s own write', () => {
    expect(LIEN_SERVICE_VERBS).toEqual(['plan_lien_service', 'apply_lien_service'])
    for (const v of LIEN_SERVICE_VERBS) {
      expect(isLienServiceVerb(v)).toBe(true)
      expect(isWriteVerb(v)).toBe(true)
      expect(WRITE_VERBS[v].rpc).toBeNull()
      expect(SERVER).toContain(`case '${v}':`)
      expect(SERVER).toContain(`name: '${v}',`)
    }
    // The read is a tool and a branch, and no write verb.
    expect(isWriteVerb('read_lien_filings')).toBe(false)
    expect(SERVER).toContain("case 'read_lien_filings': {")
    expect(SERVER).toContain("name: 'read_lien_filings',")
    expect(Object.keys(WRITE_VERBS)).toHaveLength(125)
    expect(SERVER).toContain("const SERVER_VERSION = '0.103.0'")
    expect(SERVER).toContain('Writes are one hundred and twenty-five verbs and nothing else:')
    expect(SERVER).toContain("await restRows(session, 'PATCH', 'job_lien_filings', target, { served_at: write.servedOn, sends: lienServiceSends(write) }, 'return=representation')")
    expect(README).toContain('`plan_lien_service(service \\| services)` · `apply_lien_service(service, plan_hash)`')
    expect(README).toContain('`read_lien_filings(show?, job_id?)`')
    expect(README).toContain("one hundred and thirteen since v2.7515's served copies")
    expect(EDGE).toContain('**v2.7515 (server 0.94.0)')
    expect(isLienServiceVerb('plan_lien_filing')).toBe(false)
    // The window and the batch: the same two columns, through the same kernel.
    expect(WINDOW).toContain("supabase.from('job_lien_filings').update({ served_at: serviceDate || null, sends: JSON.parse(JSON.stringify(sends)) }).eq('id', filedAffidavit.id)")
    expect(WINDOW).toContain('const sends = serviceSends({ servedOn: serviceDate, owner: ownerProof, contractor: isSub ? ocProof : null })')
    expect(BATCH_IO).toContain("supabase.from('job_lien_filings').update({ served_at: write.servedOn, sends: JSON.parse(JSON.stringify(write.sends)) }).eq('id', write.filingId)")
    // The batch's rule for who gets a copy: the filing's own answer, then the job's.
    expect(BATCH).toContain("return typeof kept === 'boolean' ? kept : job.isSub")
    expect(KERNELS).toContain("'lib/jobs/lienServiceProof.ts': { values: [], types: [] },")
  })

  it('names only columns the tables have', () => {
    for (const col of LIEN_SERVICE_JOB_COLS.split(',')) expect(CATALOG_TABLES.jobs_ledger!.columns).toHaveProperty(col)
    for (const col of LIEN_SERVICE_FILING_COLS.split(',')) expect(CATALOG_TABLES.job_lien_filings!.columns).toHaveProperty(col)
  })
})

describe('lienServiceShape — one service', () => {
  it('takes the day and each copy’s number, receipt or link', () => {
    expect(shaped()).toEqual({ action: 'lien_service', job_id: JOB, served_on: '2026-11-18', owner: { tracking: '9589 0710 5270 0000 0000 11', receipt: null, receipt_link: null }, contractor: { tracking: '9589 0710 5270 0000 0000 28', receipt: null, receipt_link: null } })
    expect(shaped({ owner: { receipt: { name: 'owner.JPG', size_bytes: 400000, sha256: SHA } }, contractor: undefined })).toMatchObject({ owner: { tracking: null, receipt: { name: 'owner.JPG', size_bytes: 400000, sha256: SHA } }, contractor: null })
    expect(shaped({ owner: { receipt_link: 'drive.google.com/file/d/r1/view' } }).owner).toMatchObject({ receipt_link: 'https://drive.google.com/file/d/r1/view' })
    // The day alone is a service: the number and the photo can wait, as the form says.
    expect(shaped({ owner: undefined, contractor: undefined })).toMatchObject({ owner: null, contractor: null })
  })

  it('refuses in words what it cannot read', () => {
    const cases: Array<[Record<string, unknown>, string]> = [
      [{ job_id: '2291' }, 'find_job'],
      [{ served_on: 'Nov 18' }, 'served_on'],
      [{ owner: 'mailed' }, 'owner is'],
      [{ owner: { receipt: { name: 'r.docx', size_bytes: 9, sha256: SHA } } }, 'not a photo or a scan'],
      [{ owner: { receipt: { name: 'r.jpg', size_bytes: 0, sha256: SHA } } }, 'size_bytes'],
      [{ owner: { receipt: { name: 'r.jpg', size_bytes: 9, sha256: 'x' } } }, 'shasum -a 256'],
      [{ owner: { receipt: { name: 'r.jpg', size_bytes: 9, sha256: SHA }, receipt_link: 'https://example.test/r' } }, 'not both'],
      [{ contractor: { receipt_link: 'n/a' } }, 'receipt_link'],
    ]
    for (const [over, words] of cases) {
      const r = lienServiceShape(service(over))
      expect(r.ok, JSON.stringify(over)).toBe(false)
      if (!r.ok) expect(r.error).toContain(words)
    }
  })

  it('a plan takes one or several and an apply takes one with its hash', () => {
    expect(lienServicePlanInput({ service: service() })).toMatchObject({ ok: true, target: JOB })
    const many = lienServicePlanInput({ services: [service(), { job_id: 'nope' }] })
    expect(many.ok && many.services.map((s) => s.ok)).toEqual([true, false])
    expect(lienServicePlanInput({}).ok).toBe(false)
    expect(lienServicePlanInput({ services: Array.from({ length: LIEN_SERVICE_PLAN_MAX + 1 }, () => service()) }).ok).toBe(false)
    expect(lienServiceApplyInput({ service: service(), plan_hash: HASH })).toMatchObject({ ok: true, target: JOB, planHash: HASH })
    expect(lienServiceApplyInput({ service: service() }).ok).toBe(false)
    expect(lienServiceApplyInput({ services: [service()], plan_hash: HASH }).ok).toBe(false)
    const clashes = lienServiceBatchClashes([shaped(), null, shaped({ job_id: JOB_B }), shaped()])
    expect([...clashes.keys()].sort()).toEqual([0, 3])
  })
})

describe('readLienServiceWorld', () => {
  it('reads the job and its newest live filed affidavit', async () => {
    const asked: string[] = []
    const w = await readLienServiceWorld(
      {
        rows: async (table, query) => {
          asked.push(`${table}?${query}`)
          if (table === 'jobs_ledger') return [world().job as never]
          return [{ ...filingRow(), served_at: '', serve_due: '2026-11-23' }]
        },
      },
      shaped(),
    )
    expect(asked[1]).toBe(`job_lien_filings?select=${LIEN_SERVICE_FILING_COLS}&job_id=eq.${JOB}&kind=eq.affidavit&voided_at=is.null&filed_at=not.is.null&order=created_at.desc&limit=1`)
    expect(w.filing).toMatchObject({ id: FILING, served_at: null, serve_due: '2026-11-23' })
    expect((await readLienServiceWorld({ rows: async () => [] }, shaped())).job).toBeNull()
  })
})

describe('lienServiceDryRun', () => {
  it('writes the day and the form’s own sends, a copy a number', () => {
    const p = shaped()
    const dry = planned(p, world())
    const sends = lienServiceSends(dry.write)
    expect(sends).toEqual(serviceSends({ servedOn: '2026-11-18', owner: { tracking: '9589 0710 5270 0000 0000 11', receiptUrl: '' }, contractor: { tracking: '9589 0710 5270 0000 0000 28', receiptUrl: '' } }))
    expect(sends).toEqual([
      { recipient: 'owner', method: 'certified_mail', tracking: '9589 0710 5270 0000 0000 11', sent_on: '2026-11-18' },
      { recipient: 'original_contractor', method: 'certified_mail', tracking: '9589 0710 5270 0000 0000 28', sent_on: '2026-11-18' },
    ])
    const reply = dry.reply as Record<string, never>
    expect(reply.writes).toEqual({ filing: FILING, served_at: '2026-11-18', sends })
    expect(reply.copies).toBe('two: the owner and the original contractor')
    expect(String(reply.says)).toBe('JP2291: Mailing recorded with its mail receipts. The serve-by watch is cleared.')
    expect(reply).not.toHaveProperty('late')
  })

  it('keeps what the filing already holds unless the call replaces it', () => {
    const kept = [{ recipient: 'owner', method: 'certified_mail', tracking: 'OLD-1', sent_on: '2026-11-17', receipt_url: 'https://drive.google.com/file/d/r-old/view' }]
    const dry = planned(shaped({ owner: undefined, contractor: { tracking: 'NEW-2' } }), world({ filing: filingRow({ served_at: '2026-11-17', sends: kept }) }))
    expect(lienServiceSends(dry.write)).toEqual([
      { recipient: 'owner', method: 'certified_mail', tracking: 'OLD-1', sent_on: '2026-11-18', receipt_url: 'https://drive.google.com/file/d/r-old/view' },
      { recipient: 'original_contractor', method: 'certified_mail', tracking: 'NEW-2', sent_on: '2026-11-18' },
    ])
    expect(String((dry.reply as Record<string, unknown>).changes_the_day)).toContain('mailed on 2026-11-17')
  })

  it('a receipt photo is filed at apply under the photo press’s own name, and its link joins the send', () => {
    const dry = planned(shaped({ owner: { tracking: 'T-1', receipt: { name: 'IMG_0412.HEIC', size_bytes: 500000, sha256: SHA } }, contractor: undefined }), world())
    expect(dry.write.receipts).toEqual([{ of: 'owner', staged: { name: 'IMG_0412.HEIC', size_bytes: 500000, sha256: SHA }, name: 'Lien affidavit, Job 2291, mail receipt, owner, 2026-11-18.heic', mime: 'image/heic' }])
    expect(lienServiceSends(dry.write, { owner: 'https://drive.google.com/file/d/r1/view' })[0]).toMatchObject({ recipient: 'owner', tracking: 'T-1', receipt_url: 'https://drive.google.com/file/d/r1/view' })
    expect(lienReceiptStagePath(DEV, { sha256: SHA, name: 'IMG_0412.HEIC' })).toBe(`${DEV}/lien-receipts/${'c'.repeat(32)}.heic`)
    expect(String((dry.reply as Record<string, unknown>).says)).toContain('Add the mail receipts when you have them')
  })

  it('says when the copies went late, and when both copies carry one number', () => {
    const dry = planned(shaped({ served_on: '2026-11-20', owner: { tracking: 'SAME' }, contractor: { tracking: 'SAME' } }), world({ filing: filingRow({ serve_due: '2026-11-18' }) }))
    expect(String((dry.reply as Record<string, unknown>).late)).toContain('went 2 days after')
    expect(String((dry.reply as Record<string, unknown>).same_number)).toContain('Each envelope has its own')
  })

  it('a job contracted with the owner mails one copy', () => {
    const own = world({ filing: filingRow({ fields: { form: 'short', isSub: false } }) })
    expect(refusal(shaped(), own)).toContain('mails one copy')
    const dry = planned(shaped({ contractor: undefined }), own)
    expect(dry.write.contractor).toBeNull()
    expect(lienServiceSends(dry.write)).toHaveLength(1)
    // A paper that keeps no answer falls back to the job: under a GC, two copies.
    expect(lienServiceHasContractor({ fields: {} }, { gc_customer_id: GC })).toBe(true)
    expect(lienServiceHasContractor({ fields: {} }, { gc_customer_id: null })).toBe(false)
  })

  it('refuses a job nobody sees, no filed affidavit, a day ahead or before the filing, and no change', () => {
    expect(refusal(shaped(), world({ job: null }))).toContain('find_job')
    expect(refusal(shaped(), world({ filing: null }))).toContain('Record the filing first (plan_lien_filing)')
    expect(refusal(shaped({ served_on: '2026-11-21' }), world())).toContain('ahead of today')
    expect(refusal(shaped({ served_on: '2026-11-15' }), world())).toContain('before the day the affidavit was filed')
    const done = world({ filing: filingRow({ served_at: '2026-11-18', sends: lienServiceSends(planned(shaped(), world()).write) }) })
    expect(refusal(shaped(), done)).toContain('Nothing to change')
  })
})

describe('the plan’s and the apply’s words', () => {
  it('counts the verdicts and names what each needs', () => {
    const reply = lienServicePlanReply([{ entry: 1, status: 'ready' }, { entry: 2, status: 'refused', why: 'x' }])
    expect(reply.services).toBe('2 services: 1 ready, 1 refused.')
    expect(String(reply.next)).toContain('apply_lien_service')
  })

  it('reads the filing back, and names a receipt that did not land', () => {
    const p = shaped()
    const dry = planned(p, world())
    const sends = lienServiceSends(dry.write)
    expect(lienServiceAppliedWords(p, 'JP2291', dry.write, { back: { served_at: '2026-11-18', sends }, receipts: [] }, true)).toMatchObject({ ok: true, served_on: '2026-11-18', still_missing: 0 })
    expect(lienServiceAppliedWords(p, 'JP2291', dry.write, { back: null, receipts: [] }, true)).toMatchObject({ ok: false })
    const partial = lienServiceAppliedWords(p, 'JP2291', dry.write, { back: { served_at: '2026-11-18', sends }, receipts: [{ of: 'owner', url: null, failed: 'the folder did not take the file' }] }, true)
    expect(partial.receipts_not_filed).toEqual([{ copy: 'owner', why: 'the folder did not take the file' }])
  })
})

describe('read_lien_filings', () => {
  it('says what each filed lien still lacks and where its serve-by day stands', () => {
    const job = world().job
    expect(lienFilingLine(filingRow(), job, '2026-11-20')).toMatchObject({ job: 'JP2291', left: ['service'], clock: '3 days left to mail the copies' })
    expect(lienFilingLine(filingRow(), job, '2026-11-23').clock).toBe('the copies are due today')
    expect(lienFilingLine(filingRow({ document_url: '', recording_number: '' }), job, '2026-11-25')).toMatchObject({ left: ['recording_number', 'saved_copy', 'service'], clock: 'the copies are 2 days late' })
    const oneCopy = [{ recipient: 'owner', method: 'certified_mail', tracking: 'T-1', sent_on: '2026-11-18' }]
    expect(lienFilingLine(filingRow({ served_at: '2026-11-18', sends: oneCopy }), job, '2026-11-25')).toMatchObject({ left: ['proof'], clock: null })
    expect(lienFilingLine(filingRow({ served_at: '2026-11-18', sends: oneCopy, fields: { isSub: false } }), job, '2026-11-25').left).toEqual([])
  })

  it('shows what is left by default, counts over all of them, and takes a job', () => {
    const job = world().job
    const lines = [lienFilingLine(filingRow(), job, TODAY), lienFilingLine(filingRow({ id: 'f2', served_at: '2026-11-18', fields: { isSub: false }, sends: [{ recipient: 'owner', method: 'certified_mail', tracking: 'T', sent_on: '2026-11-18' }] }), job, TODAY)]
    const left = lienFilingsReadReply(lines, 'left', false)
    expect(left.filings).toHaveLength(1)
    expect(left.counts).toEqual({ filed: 2, no_recording_number: 0, no_saved_copy: 0, copies_not_served: 1, served_without_proof: 0 })
    expect(lienFilingsReadReply(lines, 'all', true)).toMatchObject({ at_cap: expect.stringContaining(String(LIEN_FILINGS_READ_MAX)) })
    expect(String(lienFilingsReadReply([lines[1]!], 'left', false).reading)).toContain('nothing is left')
    expect(lienFilingsReadArgs({})).toEqual({ ok: true, show: 'left', jobId: null })
    expect(lienFilingsReadArgs({ show: 'all', job_id: JOB.toUpperCase() })).toEqual({ ok: true, show: 'all', jobId: JOB })
    expect(lienFilingsReadArgs({ show: 'open' }).ok).toBe(false)
    expect(lienFilingsReadArgs({ job_id: '2291' }).ok).toBe(false)
  })
})
