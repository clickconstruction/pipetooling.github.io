/**
 * The dev seat's recorded lien filing, the pure half (v2.7510): the shapes, the world's reads, the dry run and its
 * words. The kernel runs here against a recording fake; the pins hold it to the Lien window's own press — its row, its
 * scan's name and landing, its mark on the desk — and to the staging bucket's migration.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  LIEN_FILING_FILING_COLS,
  LIEN_FILING_JOB_COLS,
  LIEN_FILING_PLAN_MAX,
  LIEN_FILING_SYNC_STATUSES,
  LIEN_FILING_VERBS,
  LIEN_FILING_WINDOW_DAYS,
  LIEN_SCAN_LANDING,
  LIEN_SCAN_STAGING_BUCKET,
  daysInWords,
  isLienFilingVerb,
  lienFilingAppliedWords,
  lienFilingApplyInput,
  lienFilingBatchClashes,
  lienFilingDryRun,
  lienFilingPlanInput,
  lienFilingPlanReply,
  lienFilingRecordCheck,
  lienFilingShape,
  lienScanStagePath,
  lienScanUploadHow,
  readLienFilingWorld,
  sameWords,
  savedCopyFileWords,
  scanMime,
  stagedScanProblem,
  streetLine,
  type LienFilingPayload,
  type LienFilingWorld,
} from '../../../supabase/functions/_shared/devMcpLienFiling'
import { CATALOG_TABLES } from '../../../supabase/functions/dev-mcp/catalog'
import { WRITE_VERBS, isWriteVerb, planVerbFor, writeRpcBody } from '../../../supabase/functions/_shared/devMcpWrites'
import { serveDueForFiling } from '../jobs/lienDeadlines'
import { LIEN_CLERK_SCAN_NOTE, lienFiledScanName } from '../jobs/lienScanFile'
import { buildLienDeskAffidavitFields } from '../jobs/lienDeskAffidavitFields'
import { buildLienAffidavitFieldsForJob } from '../jobs/lienNoticeDraft'
import { buildLienAffidavitFieldsForJob as movedRecipe } from '../jobs/lienAffidavitJobFields'
import { LIEN_AFFIDAVIT_SHORT_FORM_MARK } from '../jobs/lienAffidavitForm'
import type { LienAffidavitRow } from '../jobs/lienDeskAffidavits'

const WINDOW = readFileSync('src/components/jobs/LienFilingTabs.tsx', 'utf8')
const SCAN_PRESS = readFileSync('src/components/jobs/LienFiledScanPress.tsx', 'utf8')
const DESK_IO = readFileSync('src/lib/jobs/lienDeskIo.ts', 'utf8')
const KERNELS = readFileSync('scripts/edge-kernels.mjs', 'utf8')
const MIGRATION = readFileSync('supabase/migrations/20261117100000_dev_seat_staging_bucket.sql', 'utf8')
const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')
const README = readFileSync('docs/dev-mcp/README.md', 'utf8')
const EDGE = readFileSync('docs/EDGE_FUNCTIONS.md', 'utf8')

const JOB = '99999999-2222-4222-8222-222222222222'
const JOB_B = '99999999-3333-4333-8333-333333333333'
const PROPERTY = 'aaaaaaaa-2222-4222-8222-222222222222'
const PROPERTY_B = 'aaaaaaaa-3333-4333-8333-333333333333'
const GC = 'cccccccc-2222-4222-8222-222222222222'
const DEV = 'ffffffff-2222-4222-8222-222222222222'
const MASTER = 'eeeeeeee-2222-4222-8222-222222222222'
const ITEM = 'dddddddd-2222-4222-8222-222222222222'
const FILING = 'bbbbbbbb-2222-4222-8222-222222222222'
const HASH = 'a'.repeat(64)
const SHA = 'c'.repeat(64)
const TODAY = '2026-11-16'
const WHO = { userId: DEV, name: 'Dev Person' }

const windowRow = (over: Partial<LienAffidavitRow> = {}): LienAffidavitRow => ({
  job_id: JOB, last_month: '2026-09', deadline: '2026-12-15', is_sub: true, noticed: true, filed: false, open_balance: 4180, customer_id: null, gc_customer_id: GC,
  property_kind: 'commercial', has_owner: true, has_legal: true, homestead: false, desk_item_id: ITEM, desk_status: 'approved', month_source: 'hand',
  ...over,
})
const NOTICE = { id: 'n1', job_id: JOB, kind: 'notice_53_056', months_covered: ['2026-09'], sends: [{ recipient: 'owner', method: 'certified_mail', sent_on: '2026-10-09', tracking: '9507 0000 0000 0000 0000 22' }], filed_at: null, recording_number: '', county: '', document_url: '', serve_due: null, served_at: null, amount: 0, fields: null }
const APPROVED = { id: ITEM, job_id: JOB, kind: 'affidavit', status: 'approved', months: ['2026-09'], fields: { notice: { claimAmount: '4180.00' }, ...LIEN_AFFIDAVIT_SHORT_FORM_MARK }, approved_at: '2026-11-10T15:00:00Z', created_at: '2026-11-09T15:00:00Z' }

const world = (over: Partial<LienFilingWorld> = {}): LienFilingWorld => ({
  job: { id: JOB, job_name: 'ZZ Test Maple Court', job_address: '14 Maple Ct, Marlow, TX 78000', hcp_number: '2291', click_number: '', customer_name: 'ZZ Test Builders', customer_address_id: PROPERTY, gc_customer_id: GC, master_user_id: MASTER, service_type_id: null, revenue: 9000, payments_made: 4820, first_work_date: '2026-09-02', last_work_date: '2026-09-24', lien_last_work_on: null },
  row: windowRow(),
  items: [APPROVED],
  address: { id: PROPERTY, county: 'Marlow', legal_description: 'LOT 4 BLK 7 MAPLE ADDITION', property_kind: 'commercial', homestead: false, homestead_answered_at: '2026-11-01T00:00:00Z', owner_name: 'Pat Sample', owner_company: '', owner_mailing_address: '9 Owner Ln, Marlow, TX 78000', owner_mode: 'person' },
  ownerOverride: null,
  gc: { id: GC, name: 'ZZ Test Builders', address: '5 Builder Way, Marlow, TX 78000' },
  correctionOff: null,
  monthsByHand: null,
  filings: [NOTICE],
  sameNumber: [],
  siblings: [],
  signer: { id: MASTER, name: 'Sam Sample', notes: 'Sam Sample, Master Plumber' },
  issuer: { companyName: 'ZZ Test Plumbing', addressText: '1 Main St\nMarlow, TX 78000', physicalAddressText: '', signingCounty: 'Marlow' },
  serviceTypeName: 'Plumbing',
  ...over,
})

const filing = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  job_id: JOB,
  county: 'Marlow County',
  recording_number: '2026 9990001',
  filed_on: '2026-11-16',
  scan: { name: 'maple-court.pdf', size_bytes: 485026, sha256: SHA },
  paper_states: { claim: 4180, months: ['2026-09'], notice_sent_on: ['2026-10-09'], property_address: '14 Maple Ct, Marlow, TX 78000', legal_description: 'Lot 4, Blk 7, Maple Addition', owner: 'Pat Sample' },
  matched_because: 'The paper names 14 Maple Ct and Pat Sample, and swears $4,180.00.',
  ...over,
})
const shaped = (over: Record<string, unknown> = {}): LienFilingPayload => {
  const s = lienFilingShape(filing(over))
  if (!s.ok) throw new Error(s.error)
  return s.p
}
const ready = (p: LienFilingPayload, w: LienFilingWorld) => {
  const dry = lienFilingDryRun(p, w, WHO, TODAY)
  if (!dry.ok) throw new Error(dry.refused)
  if (dry.status !== 'ready') throw new Error(`held: ${String(dry.reply.held_because)}`)
  return dry
}
const held = (p: LienFilingPayload, w: LienFilingWorld) => {
  const dry = lienFilingDryRun(p, w, WHO, TODAY)
  if (!dry.ok) throw new Error(dry.refused)
  if (dry.status !== 'held') throw new Error('expected a hold')
  return dry.reply as { differences: Array<{ what: string; paper: string; desk: string; door: string }>; held_because: string; plan_hash?: string }
}
const refusal = (p: LienFilingPayload, w: LienFilingWorld) => {
  const dry = lienFilingDryRun(p, w, WHO, TODAY)
  if (dry.ok) throw new Error('expected a refusal')
  return dry.refused
}

describe('the pair and what it stands on', () => {
  it('is a pair that names no RPC, declared and handled by the server, with its row in the docs', () => {
    expect(LIEN_FILING_VERBS).toEqual(['plan_lien_filing', 'apply_lien_filing'])
    for (const v of LIEN_FILING_VERBS) {
      expect(isLienFilingVerb(v)).toBe(true)
      expect(isWriteVerb(v)).toBe(true)
      expect(WRITE_VERBS[v].rpc).toBeNull()
      expect(SERVER).toContain(`case '${v}':`)
      expect(SERVER).toContain(`name: '${v}',`)
    }
    expect(isLienFilingVerb('plan_affidavit_draft')).toBe(false)
    expect(planVerbFor('apply_lien_filing')).toBe('plan_lien_filing')
    expect(Object.keys(WRITE_VERBS)).toHaveLength(156)
    expect(SERVER).toContain("const SERVER_VERSION = '0.133.0'")
    expect(SERVER).toContain('Writes are one hundred and fifty-six verbs and nothing else:')
    expect(SERVER).toContain("plan_lien_filing → apply_lien_filing (a filed lien affidavit recorded as the job's Lien window records it once the clerk has stamped it")
    expect(README).toContain('`plan_lien_filing(filing \\| filings)` · `apply_lien_filing(filing, plan_hash)`')
    expect(README).toContain("one hundred and eleven since v2.7511's recorded lien filing")
    expect(EDGE).toContain('**v2.7511 (server 0.93.0)')
  })

  it('the registry shapes a plan’s filings one by one and an apply’s one, and the server writes through the window’s own doors', () => {
    const plan = writeRpcBody('plan_lien_filing', { filings: [filing(), { job_id: 'nope' }] })
    expect(plan).toMatchObject({ ok: true, rpc: null, step: 'plan', target: '2 filings', planHash: null })
    const apply = writeRpcBody('apply_lien_filing', { filing: filing(), plan_hash: HASH })
    expect(apply).toMatchObject({ ok: true, rpc: null, step: 'apply', target: JOB, planHash: HASH })
    expect(writeRpcBody('apply_lien_filing', { filing: filing() }).ok).toBe(false)
    expect(SERVER).toContain("windows: (days) => (windowsRead ??= rowsOf('rpc/list_lien_affidavit_windows', `p_within_days=${days}`))")
    expect(SERVER).toContain("await invokeAsDev(session, 'drive-link', { action: 'put', job: { jobs_ledger_id: p.job_id }, name: scan.name, mime: scan.mime, where: LIEN_SCAN_LANDING, base64: bytesToBase64(scanBytes) })")
    expect(SERVER).toContain("await restRows(session, 'POST', 'job_lien_filings', 'select=id', write.row)")
    expect(SERVER).toContain("await restRows(session, 'PATCH', 'job_lien_filings', `id=eq.${filingId}&document_url=eq.${replaces ? encodeURIComponent(replaces) : ''}&select=id`, filingDocumentPayload({ url, note }, { clear: true }), 'return=representation')")
    // A replaced copy's old file goes through drive-link's own trash door, once the filing carries the new one.
    expect(SERVER).toContain("await invokeAsDev(session, 'drive-link', { action: 'trash', job: { jobs_ledger_id: p.job_id }, driveFileId: oldId })")
    expect(SERVER).toContain("if (dry.status === 'on_record') return refused(")
    expect(SERVER).toContain("await restRows(session, 'PATCH', 'job_lien_desk_items', `id=eq.${write.item.id}&kind=eq.affidavit&status=eq.${write.item.from}&select=id`, { ...write.item.patch, sent_filing_id: filingId }, 'return=representation')")
    expect(SERVER).toContain('await stagedUploadUrl(session, lienScanStagePath(who.userId, f.p.scan), LIEN_SCAN_STAGING_BUCKET)')
  })

  it('writes the Lien window’s own row, files the scan where its press does, and marks the desk as its sync does', () => {
    // The window: the insert, key for key.
    expect(WINDOW).toContain(".insert({ job_id: job.id, created_by: authUser?.id ?? null, ...filingDocumentPayload({ url: docUrl, note: docNote }), ...payload } as never)")
    expect(WINDOW).toContain("kind: 'affidavit',")
    expect(WINDOW).toContain('amount: Number(affidavitFields.unpaidAmount),')
    expect(WINDOW).toContain('serve_due: filingDate ? serveDueForFiling(filingDate) : null,')
    // The scan press: the same landing and the same name.
    expect(SCAN_PRESS).toContain("const added = await put(jobId, 'sent', named)")
    expect(SCAN_PRESS).toContain('lienFiledScanName(jobNumber, day, file)')
    expect(LIEN_SCAN_LANDING).toBe('sent')
    // The window's scan on a recorded filing: the link and the scan's note.
    expect(WINDOW).toContain('filingDocumentPayload({ url, note: LIEN_CLERK_SCAN_NOTE }, { clear: true })')
    // The desk's sync after a record: the statuses it moves and the mark it makes.
    expect(DESK_IO).toContain(".in('status', ['approved', 'drafted', 'awaiting_approval', 'held'])")
    expect(LIEN_FILING_SYNC_STATUSES).toEqual(['approved', 'drafted', 'awaiting_approval', 'held'])
    expect(DESK_IO).toContain("update({ status: 'sent', sent_filing_id: filingId, ...(sentAt ? { sent_at: sentAt } : {}) } as never)")
    expect(DESK_IO).toContain('sentAtForTypedDay(filed[0].filed_at, todayYmd)')
  })

  it('reads its kernels from the mirror, and the recipe that moved is the one recipe', () => {
    for (const f of ['lienDeskAffidavitFields', 'lienScanFile', 'lienDeskAffidavits', 'lienProperty']) expect(KERNELS).toContain(`'lib/jobs/${f}.ts': { values: [], types: [] },`)
    expect(buildLienAffidavitFieldsForJob).toBe(movedRecipe)
  })

  it('names only columns the tables have', () => {
    for (const col of LIEN_FILING_JOB_COLS.split(',')) expect(CATALOG_TABLES.jobs_ledger!.columns).toHaveProperty(col)
    for (const col of LIEN_FILING_FILING_COLS.split(',')) expect(CATALOG_TABLES.job_lien_filings!.columns).toHaveProperty(col)
  })

  it('stages in a private bucket a dev reaches only inside their own folder', () => {
    expect(MIGRATION.startsWith("SET lock_timeout = '3s';")).toBe(true)
    expect(MIGRATION).toContain(`VALUES ('${LIEN_SCAN_STAGING_BUCKET}', '${LIEN_SCAN_STAGING_BUCKET}', false, 10485760,`)
    expect(MIGRATION.match(/public\.is_dev\(\) AND \(storage\.foldername\(name\)\)\[1\] = auth\.uid\(\)::text/g)).toHaveLength(5)
    expect(lienScanStagePath(DEV, { sha256: SHA, name: 'scan.PDF' })).toBe(`${DEV}/lien-scans/${'c'.repeat(32)}.pdf`)
    expect(lienScanUploadHow('application/pdf')).toContain('curl -sS -X PUT "<upload_url>" -H "Content-Type: application/pdf" -H "x-upsert: true" --data-binary @"<the file>"')
  })
})

describe('lienFilingShape — one filing', () => {
  it('takes the clerk’s facts, the scan and what the paper says', () => {
    const p = shaped()
    expect(p).toMatchObject({ action: 'lien_filing', job_id: JOB, county: 'Marlow', recording_number: '2026 9990001', filed_on: '2026-11-16', scan: { name: 'maple-court.pdf', size_bytes: 485026, sha256: SHA }, saved_copy: null, filed_outside_the_desk: false, accept_differences: false })
    expect(p.paper_states).toEqual({ claim: 4180, months: ['2026-09'], notice_sent_on: ['2026-10-09'], property_address: '14 Maple Ct, Marlow, TX 78000', legal_description: 'Lot 4, Blk 7, Maple Addition', owner: 'Pat Sample' })
  })

  it('takes a typed link in place of a file, or neither, never both', () => {
    expect(shaped({ scan: undefined, saved_copy: { link: 'drive.google.com/file/d/abc/view', note: 'the clerk’s copy' } }).saved_copy).toEqual({ link: 'https://drive.google.com/file/d/abc/view', note: 'the clerk’s copy' })
    expect(shaped({ scan: null })).toMatchObject({ scan: null, saved_copy: null })
    const both = lienFilingShape(filing({ saved_copy: { link: 'https://example.test/x' } }))
    expect(both.ok).toBe(false)
    if (!both.ok) expect(both.error).toContain('not both')
  })

  it('refuses in words what it cannot read', () => {
    const cases: Array<[Record<string, unknown>, string]> = [
      [{ job_id: '2291' }, 'find_job'],
      [{ county: '' }, 'county'],
      [{ recording_number: 'ab;cd' }, 'recording_number'],
      [{ filed_on: '11/16/2026' }, 'filed_on'],
      [{ scan: { name: 'x.docx', size_bytes: 10, sha256: SHA } }, 'not a scan or a photo'],
      [{ scan: { name: 'x.pdf', size_bytes: 0, sha256: SHA } }, 'empty'],
      [{ scan: { name: 'x.pdf', size_bytes: 11 * 1024 * 1024, sha256: SHA } }, 'Scan this affidavit alone'],
      [{ scan: { name: 'x.pdf', size_bytes: 10, sha256: 'abc' } }, 'shasum -a 256'],
      [{ scan: { name: 'a/b.pdf', size_bytes: 10, sha256: SHA } }, 'no folders'],
      [{ saved_copy: { link: 'n/a' }, scan: undefined }, 'a note alone is not a saved copy'],
      [{ paper_states: undefined }, 'Read the scan before you plan'],
      [{ paper_states: { claim: '4180' } }, 'paper_states.claim'],
      [{ paper_states: { claim: 1, months: ['Sep 2026'] } }, 'YYYY-MM'],
      [{ paper_states: { claim: 1, notice_sent_on: ['2026-10'] } }, 'YYYY-MM-DD'],
      [{ matched_because: 'same' }, 'matched_because'],
    ]
    for (const [over, words] of cases) {
      const r = lienFilingShape(filing(over))
      expect(r.ok, JSON.stringify(over)).toBe(false)
      if (!r.ok) expect(r.error).toContain(words)
    }
    expect(scanMime('A.PDF')).toBe('application/pdf')
    expect(scanMime('page.jpeg')).toBe('image/jpeg')
  })
})

describe('the plan’s and the apply’s input', () => {
  it('a plan takes one filing or a visit’s worth, and names a bad entry without losing the rest', () => {
    const one = lienFilingPlanInput({ filing: filing() })
    expect(one).toMatchObject({ ok: true, target: JOB })
    const many = lienFilingPlanInput({ filings: [filing(), { job_id: 'nope' }, filing({ job_id: JOB_B })] })
    expect(many.ok).toBe(true)
    if (many.ok) {
      expect(many.filings.map((f) => f.ok)).toEqual([true, false, true])
      expect(many.target).toBe('3 filings')
    }
    for (const bad of [{}, { filings: [] }, { filing: filing(), filings: [filing()] }]) expect(lienFilingPlanInput(bad).ok).toBe(false)
    const tooMany = lienFilingPlanInput({ filings: Array.from({ length: LIEN_FILING_PLAN_MAX + 1 }, () => filing()) })
    expect(tooMany.ok).toBe(false)
    if (!tooMany.ok) expect(tooMany.error).toContain(`at most ${LIEN_FILING_PLAN_MAX}`)
  })

  it('an apply takes one filing and its own hash', () => {
    expect(lienFilingApplyInput({ filing: filing(), plan_hash: HASH })).toMatchObject({ ok: true, target: JOB, planHash: HASH })
    const noHash = lienFilingApplyInput({ filing: filing() })
    expect(noHash.ok).toBe(false)
    if (!noHash.ok) expect(noHash.error).toContain('plan_lien_filing gave this filing')
    const list = lienFilingApplyInput({ filings: [filing()], plan_hash: HASH })
    expect(list.ok).toBe(false)
    if (!list.ok) expect(list.error).toContain('one filing a call')
  })

  it('names two entries of one call that cannot both stand', () => {
    const a = shaped()
    const clashes = lienFilingBatchClashes([a, null, shaped({ job_id: JOB_B, recording_number: '999', scan: { name: 'b.pdf', size_bytes: 9, sha256: 'd'.repeat(64) } }), shaped({ job_id: JOB, recording_number: '777', scan: { name: 'c.pdf', size_bytes: 9, sha256: SHA } })])
    expect(clashes.get(0)).toContain('same job twice (entry 4)')
    expect(clashes.get(3)).toContain('same job twice (entry 1)')
    expect(clashes.has(1)).toBe(false)
    expect(clashes.has(2)).toBe(false)
    const sameNumber = lienFilingBatchClashes([a, shaped({ job_id: JOB_B, recording_number: '2026-9990001', scan: null })])
    expect(sameNumber.get(1)).toContain('same recording number twice (entry 1)')
    const sameFile = lienFilingBatchClashes([a, shaped({ job_id: JOB_B, recording_number: '888' })])
    expect(sameFile.get(0)).toContain('one file, one lien')
  })
})

describe('readLienFilingWorld — the reads', () => {
  it('reads the job, the desk, the property, the filings, the number elsewhere and the jobs at the same street', async () => {
    const asked: string[] = []
    const tables: Record<string, Record<string, unknown>[]> = {
      job_lien_desk_items: [APPROVED],
      customer_addresses: [world().address as never],
      customers: [{ id: GC, name: ' ZZ Test Builders ', address: '5 Builder Way' }],
      job_lien_claim_corrections: [{ job_id: JOB, amount_off: '80' }],
      job_lien_affidavit_months: [{ job_id: JOB, months: ['2026-08', '2026-09'], reason: 'counsel', set_by_name: 'Sam', set_at: '2026-11-12T00:00:00Z' }],
      users: [{ id: MASTER, name: 'Sam Sample', notes: '' }],
      app_settings: [{ value_text: JSON.stringify({ companyName: 'ZZ Test Plumbing', addressText: '1 Main St', signingCounty: 'Marlow' }) }],
    }
    const w = await readLienFilingWorld(
      {
        rows: async (table, query) => {
          asked.push(`${table}?${query}`)
          if (table === 'jobs_ledger' && query.includes(`id=eq.${JOB}`)) return [world().job as never]
          if (table === 'jobs_ledger' && query.includes('job_address=ilike.')) return [{ id: JOB_B, job_name: 'ZZ Test Maple B', hcp_number: '2304', click_number: '', customer_address_id: PROPERTY_B }]
          if (table === 'jobs_ledger' && query.includes('id=in.(')) return [{ id: JOB_B, job_name: 'ZZ Test Maple B', hcp_number: '2304', click_number: '' }]
          if (table === 'job_lien_filings' && query.includes('recording_number=ilike.')) return [{ id: FILING, job_id: JOB_B, county: 'Marlow', filed_at: '2026-11-16', recording_number: '2026-9990001' }, { id: 'near', job_id: JOB_B, county: 'Marlow', filed_at: '2026-11-16', recording_number: '2026x9990001' }]
          if (table === 'job_lien_filings') return [NOTICE]
          return tables[table] ?? []
        },
        windows: async (days) => {
          asked.push(`windows:${days}`)
          return [{ ...windowRow(), open_balance: '4180.00' }] as never
        },
      },
      shaped(),
    )
    expect(asked).toContain(`windows:${LIEN_FILING_WINDOW_DAYS}`)
    // The number is read loosely and compared by its letters and digits, so punctuation never hides the same instrument.
    expect(asked.find((q) => q.includes('recording_number=ilike.'))).toContain(`recording_number=ilike.2*0*2*6*9*9*9*0*0*0*1&job_id=neq.${JOB}`)
    expect(asked.find((q) => q.includes('job_address=ilike.'))).toContain(`job_address=ilike.${encodeURIComponent('14 Maple Ct*')}&id=neq.${JOB}`)
    expect(w.row?.open_balance).toBe(4180)
    expect(w.gc).toEqual({ id: GC, name: 'ZZ Test Builders', address: '5 Builder Way' })
    expect(w.correctionOff).toBe(80)
    expect(w.monthsByHand).toEqual(['2026-08', '2026-09'])
    expect(w.sameNumber).toEqual([{ id: FILING, job_id: JOB_B, county: 'Marlow', filed_at: '2026-11-16', job_label: 'JP2304' }])
    expect(w.siblings).toEqual([{ id: JOB_B, label: 'JP2304', customer_address_id: PROPERTY_B }])
    expect(w.issuer).toEqual({ companyName: 'ZZ Test Plumbing', addressText: '1 Main St', physicalAddressText: '', signingCounty: 'Marlow' })
    expect(streetLine(' 14  Maple Ct , Marlow')).toBe('14 Maple Ct')
  })

  it('a job nobody can see reads as no job', async () => {
    const none = await readLienFilingWorld({ rows: async () => [], windows: async () => [] }, shaped())
    expect(none.job).toBeNull()
  })
})

describe('lienFilingDryRun — a paper that matches the desk', () => {
  it('is ready, with the window’s own row, the desk item’s move and the file’s landing', () => {
    const p = shaped()
    const w = world()
    const dry = ready(p, w)
    if (dry.write.kind !== 'record') throw new Error('expected a record')
    const fields = buildLienDeskAffidavitFields({
      job: { ...w.job!, service_type: { name: 'Plumbing' } },
      entry: { isSub: true, openBalance: 4180, lastMonth: '2026-09', gates: [] },
      gc: w.gc,
      ownerName: 'Pat Sample',
      ownerAddress: '9 Owner Ln, Marlow, TX 78000',
      county: 'Marlow',
      legalDescription: 'LOT 4 BLK 7 MAPLE ADDITION',
      correction: null,
      contactPerson: 'Sam Sample, Master Plumber',
      issuer: w.issuer,
      todayYmd: TODAY,
      form: 'short',
      filings: w.filings,
      homestead: false,
      monthsByHand: null,
    })
    const wrote = dry.write.row.fields as Record<string, unknown>
    // The desk's own recipe: the amount, the months and the notice as the paper printed them.
    expect(wrote.unpaidAmount).toBe('4180.00')
    expect(wrote.workMonthsWords).toBe(fields.workMonthsWords)
    expect(wrote.noticesSentWords).toBe(fields.noticesSentWords)
    expect(wrote.ownerName).toBe('Pat Sample')
    expect(wrote.signingCounty).toBe('Marlow')
    expect(dry.write.row).toMatchObject({ job_id: JOB, created_by: DEV, kind: 'affidavit', amount: 4180, county: 'Marlow', recording_number: '2026 9990001', filed_at: '2026-11-16', serve_due: serveDueForFiling('2026-11-16') })
    // A staged scan's link is the server's to add once the file lands.
    expect(dry.write.row).not.toHaveProperty('document_url')
    expect(Object.keys(dry.write.row).sort()).toEqual(['amount', 'county', 'created_by', 'fields', 'filed_at', 'job_id', 'kind', 'recording_number', 'serve_due'])
    expect(dry.write.item).toEqual({ id: ITEM, from: 'approved', patch: { status: 'sent', sent_filing_id: '(the new filing)' } })
    expect(dry.write.scan).toEqual({ name: lienFiledScanName('2291', '2026-11-16', { name: 'maple-court.pdf', type: 'application/pdf' }), mime: 'application/pdf', size_bytes: 485026, sha256: SHA })
    expect(dry.write.scan!.name).toBe(`Lien affidavit, Job 2291, ${LIEN_CLERK_SCAN_NOTE}, 2026-11-16.pdf`)
    const reply = dry.reply as Record<string, never>
    expect(reply.status).toBe('ready')
    expect(reply.differences).toEqual([])
    expect(reply.job).toMatchObject({ label: 'JP2291', name: 'ZZ Test Maple Court', address: '14 Maple Ct, Marlow, TX 78000', general_contractor: 'ZZ Test Builders', owner: 'Pat Sample' })
    expect(reply.serve_by).toBe('2026-11-23')
    expect(String(reply.says)).toBe('JP2291: affidavit filed 2026-11-16 in Marlow County as instrument 2026 9990001, claim $4,180.00. Copies go to the owner and the original contractor by 2026-11-23.')
    expect(String(reply.not_done)).toContain('nobody is told')
  })

  it('a day before today carries its day onto the desk item, and a typed link rides on the row', () => {
    const dry = ready(shaped({ filed_on: '2026-11-13', scan: undefined, saved_copy: { link: 'https://drive.google.com/file/d/abc/view', note: 'stamped' } }), world())
    if (dry.write.kind !== 'record') throw new Error('expected a record')
    expect(dry.write.item?.patch).toMatchObject({ status: 'sent', sent_at: expect.stringMatching(/^2026-11-13T/) })
    expect(dry.write.row).toMatchObject({ document_url: 'https://drive.google.com/file/d/abc/view', document_note: 'stamped', serve_due: '2026-11-18' })
    expect(dry.write.scan).toBeNull()
  })

  it('says what was not compared when the caller read less off the paper', () => {
    const dry = ready(shaped({ paper_states: { claim: 4180 } }), world())
    expect(String((dry.reply as Record<string, unknown>).not_checked)).toContain('months, notice_sent_on, property_address, legal_description, owner')
  })

  it('a job contracted with the owner names no months and no notice, and mails one copy', () => {
    const dry = ready(shaped({ paper_states: { claim: 4180 } }), world({ row: windowRow({ is_sub: false, gc_customer_id: null }), gc: null, job: { ...world().job!, gc_customer_id: null }, filings: [] }))
    expect(String((dry.reply as Record<string, unknown>).says)).toContain('Copies go to the owner by')
    expect(String((dry.reply as Record<string, unknown>).not_checked)).not.toContain('months')
  })
})

describe('lienFilingDryRun — what the print of the copies does with the record (v2.7916: the copy is the stamped scan)', () => {
  it('says a filing with no saved copy is held at the print, and never says the copy is redrawn', () => {
    const dry = ready(shaped({ scan: undefined }), world())
    const file = String((dry.reply.writes as { file: unknown }).file)
    expect(file).toContain('recorded with no saved copy')
    expect(file).toContain('Print the copies to mail holds this lien until then, since the copy it mails is the saved stamped scan')
    expect(JSON.stringify(dry.reply)).not.toMatch(/redraw|photocopy/)
  })

  it('says a snapshot with no owner prints the stamped copy with no cover letter', () => {
    const w = world({ address: { ...world().address!, owner_name: '', owner_company: '' } })
    const dry = lienFilingDryRun(shaped({ paper_states: { claim: 4180, months: ['2026-09'], notice_sent_on: ['2026-10-09'] }, accept_differences: true }), w, WHO, TODAY)
    if (!dry.ok) throw new Error(dry.refused)
    const reply = dry.reply as Record<string, unknown>
    expect(reply.no_cover_letter).toBe('The snapshot has no ownerName, so Print the copies to mail prints this lien’s stamped copy with no cover letter in front.')
    expect(reply).not.toHaveProperty('no_copy_to_print')
  })

  it('keeps the seat’s description and its README off the redraw', () => {
    expect(SERVER).toContain("Print the copies to mail mails the saved copy itself, the clerk's stamped scan")
    expect(README).toContain("*Print the copies to mail* mails the filing's saved copy, the clerk's stamped scan")
    for (const words of [SERVER, README]) {
      expect(words).not.toMatch(/Print the copies to mail\*? redraws/)
      expect(words).not.toContain('mail a photocopy')
    }
  })
})

describe('lienFilingDryRun — a paper the desk disagrees with', () => {
  it('holds on the claim, the months and the notice day, each with its door, and carries no write', () => {
    const p = shaped({ paper_states: { claim: 4500, months: ['2026-08', '2026-09'], notice_sent_on: ['2026-10-12'] } })
    const reply = held(p, world())
    expect(reply.differences.map((d) => d.what)).toEqual(['claim', 'months', 'notice_day'])
    expect(reply.differences[0]).toMatchObject({ paper: '$4,500.00', desk: '$4,180.00' })
    expect(reply.differences[0]!.door).toContain('set the claim by hand on the Lien desk')
    expect(reply.differences[1]).toMatchObject({ paper: '2026-08, 2026-09', desk: '2026-09' })
    expect(reply.differences[2]!.door).toContain('plan_notice_by_hand')
    expect(reply.held_because).toContain('accept_differences: true')
    // The copy in the envelope is the stamped scan; of the three, the cover letter states the claim alone.
    expect(reply.held_because).toContain('mails the filing’s saved copy, the clerk’s stamped scan')
    expect(reply.held_because).toContain('recorded as it stands, would not say what the paper says on claim: leave the letter out')
    expect(reply.held_because).not.toMatch(/redraw|photocopy/)
    expect(lienFilingDryRun(p, world(), WHO, TODAY)).not.toHaveProperty('write')
  })

  it('a notice sworn on the paper and missing from the desk points at the verb that records it', () => {
    const reply = held(shaped(), world({ filings: [] }))
    const notice = reply.differences.find((d) => d.what === 'notice_day')!
    expect(notice).toMatchObject({ paper: '2026-10-09', desk: 'none' })
    expect(notice.door).toContain('The desk holds no notice to the owner with its day')
  })

  it('says when the bills moved since the paper was approved', () => {
    const reply = held(shaped(), world({ row: windowRow({ open_balance: 3900 }) }))
    expect(reply.differences[0]!.door).toContain('The paper approved on the desk claimed $4,180.00')
  })

  it('holds on the address, the owner, the legal description and the county', () => {
    const reply = held(shaped({ county: 'Harlan', paper_states: { claim: 4180, months: ['2026-09'], notice_sent_on: ['2026-10-09'], property_address: '22 Birch Ln, Marlow, TX', legal_description: 'LOT 9 BLK 1', owner: 'Lee Other' } }), world())
    expect(reply.differences.map((d) => d.what)).toEqual(['property_address', 'legal_description', 'owner', 'county'])
    expect(reply.differences[0]!.door).toContain('a wrong match files a lien on the wrong job')
  })

  it('reads words as a person would: case, punctuation and a shorter address are not differences', () => {
    expect(sameWords('Lot 4, Blk 7, Maple Addition', 'LOT 4 BLK 7 MAPLE ADDITION')).toBe(true)
    ready(shaped({ paper_states: { claim: 4180, months: ['2026-09'], notice_sent_on: ['2026-10-09'], property_address: '14 MAPLE CT', owner: 'pat sample' } }), world())
  })

  it('holds when a job at the same street sits on another property record', () => {
    const reply = held(shaped(), world({ siblings: [{ id: JOB_B, label: 'JP2304', customer_address_id: PROPERTY_B }, { id: 'x', label: 'JP2305', customer_address_id: PROPERTY }] }))
    expect(reply.differences).toHaveLength(1)
    expect(reply.differences[0]).toMatchObject({ what: 'property_record', desk: 'JP2304 at the same street address sits on another property record' })
  })

  it('records as the desk reads it once the call accepts the differences, and says so', () => {
    const dry = ready(shaped({ accept_differences: true, paper_states: { claim: 4500 } }), world())
    if (dry.write.kind !== 'record') throw new Error('expected a record')
    expect(dry.write.row.amount).toBe(4180)
    expect(String((dry.reply as Record<string, unknown>).differences_accepted)).toContain('1 difference from the paper accepted')
  })
})

describe('lienFilingDryRun — what it refuses', () => {
  it('a job nobody can see, a day ahead of today, and a job the desk does not list', () => {
    expect(refusal(shaped(), world({ job: null }))).toContain('find_job')
    expect(refusal(shaped({ filed_on: '2026-11-17' }), world())).toContain('ahead of today')
    expect(refusal(shaped(), world({ row: null }))).toContain('Already filed — record it…')
  })

  it('a job with no approved affidavit, unless the filing was made outside the desk', () => {
    expect(refusal(shaped(), world({ items: [] }))).toContain('the desk holds no affidavit for it')
    expect(refusal(shaped(), world({ items: [{ ...APPROVED, status: 'awaiting_approval' }] }))).toContain('sent for approval and not yet approved')
    const outside = ready(shaped({ filed_outside_the_desk: true }), world({ items: [{ ...APPROVED, status: 'drafted' }] }))
    if (outside.write.kind !== 'record') throw new Error('expected a record')
    expect(outside.write.item).toMatchObject({ id: ITEM, from: 'drafted' })
    expect(JSON.stringify(outside.reply)).toContain('The desk never approved a paper for this job')
    const none = ready(shaped({ filed_outside_the_desk: true }), world({ items: [] }))
    if (none.write.kind !== 'record') throw new Error('expected a record')
    expect(none.write.item).toBeNull()
  })

  it('an affidavit record with no filed day on the job', () => {
    const dateless = { ...NOTICE, id: FILING, kind: 'affidavit', filed_at: null, recording_number: '', county: '' }
    expect(refusal(shaped(), world({ filings: [NOTICE, dateless] }))).toContain('an affidavit record with no filed day is already on this job')
  })

  it('a second filing on the job, and a recording number that is already on another job', () => {
    const onFile = { ...NOTICE, id: FILING, kind: 'affidavit', filed_at: '2026-11-10', recording_number: '555', county: 'Marlow', document_url: 'https://example.test/copy', serve_due: '2026-11-16' }
    expect(refusal(shaped(), world({ filings: [NOTICE, onFile] }))).toContain('an affidavit is already on file for this job (instrument 555, filed 2026-11-10, with its saved copy), and it is not instrument 2026 9990001')
    expect(refusal(shaped({ replace_saved_copy: true, replace_because: 'The copy on record is the whole stack.' }), world())).toContain('replace_saved_copy is for a filing already on record')
    expect(refusal(shaped(), world({ sameNumber: [{ id: FILING, job_id: JOB_B, county: 'Marlow', filed_at: '2026-11-16', job_label: 'JP2304' }] }))).toContain('instrument 2026 9990001 is already on JP2304')
  })
})

describe('lienFilingDryRun — a filing already on record with no saved copy', () => {
  const onFile = { ...NOTICE, id: FILING, kind: 'affidavit', filed_at: '2026-11-16', recording_number: '20269990001', county: 'Marlow', document_url: '', serve_due: '2026-11-23', amount: 4180, fields: null }

  it('takes the scan alone', () => {
    const dry = ready(shaped(), world({ filings: [NOTICE, onFile], items: [{ ...APPROVED, status: 'sent' }] }))
    expect(dry.write).toEqual({ kind: 'attach_scan', filingId: FILING, scan: { name: `Lien affidavit, Job 2291, ${LIEN_CLERK_SCAN_NOTE}, 2026-11-16.pdf`, mime: 'application/pdf', size_bytes: 485026, sha256: SHA } })
    expect(String((dry.reply as Record<string, unknown>).says)).toContain('Nothing else on the filing changes')
  })

  it('takes a link alone when the copy is already in Drive, with no file to upload', () => {
    const dry = ready(shaped({ scan: undefined, saved_copy: { link: 'https://drive.google.com/file/d/abc/view' } }), world({ filings: [NOTICE, onFile] }))
    expect(dry.write).toEqual({ kind: 'attach_link', filingId: FILING, link: { url: 'https://drive.google.com/file/d/abc/view', note: LIEN_CLERK_SCAN_NOTE } })
    expect(String((dry.reply as Record<string, unknown>).says)).toContain('no file is uploaded')
  })

  it('refuses when the day or the county is not the record’s, and when no scan is sent', () => {
    expect(refusal(shaped({ filed_on: '2026-11-13' }), world({ filings: [onFile] }))).toContain('is on record for this job as filed 2026-11-16')
    // No scan and no link: a check of the record, which says how to add the copy.
    const dry = lienFilingDryRun(shaped({ scan: null }), world({ filings: [onFile] }), WHO, TODAY)
    expect(dry).toMatchObject({ ok: true, status: 'on_record' })
    expect(String((dry as { reply: Record<string, unknown> }).reply.next)).toContain('plan again with scan (the file) or saved_copy (a link) to add it')
  })
})

describe('lienFilingDryRun — a paper already on record (v2.7837)', () => {
  const FIELDS = { isSub: true, workMonthsWords: 'September 2026', noticesSentWords: 'certified mail on October 9, 2026', propertyAddress: '14 Maple Ct, Marlow, TX 78000', legalDescription: 'LOT 4 BLK 7 MAPLE ADDITION', ownerName: 'Pat Sample', unpaidAmount: '4180.00' }
  const COPY = 'https://drive.google.com/file/d/1oldOldOldOldOldOldOldOldOld/view'
  const onFile = { ...NOTICE, id: FILING, kind: 'affidavit', filed_at: '2026-11-16', recording_number: '20269990001', county: 'Marlow', document_url: COPY, serve_due: '2026-11-23', amount: 4180, fields: FIELDS }
  const w = (over: Record<string, unknown> = {}) => world({ filings: [NOTICE, { ...onFile, ...over }], items: [{ ...APPROVED, status: 'sent' }] })
  const check = (p: LienFilingPayload, wd: LienFilingWorld) => {
    const dry = lienFilingDryRun(p, wd, WHO, TODAY)
    if (!dry.ok || dry.status !== 'on_record') throw new Error('expected a check')
    return dry.reply as { agrees: boolean; differences: Array<{ what: string; paper: string; record: string }>; says: string; next: string; copy_to_mail?: string; not_checked?: string; writes: string }
  }

  it('answers on_record, with nothing to write, when the record says what the paper says', () => {
    const reply = check(shaped(), w())
    expect(reply).toMatchObject({ agrees: true, differences: [], writes: 'nothing: a check alone, with no plan_hash' })
    expect(reply.says).toBe('JP2291: instrument 20269990001 is on record, filed 2026-11-16 in Marlow County, and its record says what the paper says.')
    expect(reply.next).toContain('replace_saved_copy: true and replace_because')
    expect(reply).not.toHaveProperty('copy_to_mail')
    expect(reply).not.toHaveProperty('plan_hash')
  })

  it('names each thing the record says that the paper does not, and what that does to the copy to mail', () => {
    // The record was drawn after the job's last day moved: it names another month than the paper that was filed.
    const reply = check(shaped({ paper_states: { claim: 4180, months: ['2026-08'], notice_sent_on: ['2026-10-09'], property_address: '14 Maple Ct', legal_description: 'Lot 4, Blk 7, Maple Addition', owner: 'Pat Sample' } }), w())
    expect(reply.agrees).toBe(false)
    expect(reply.differences).toEqual([{ what: 'months', paper: 'August 2026', record: 'September 2026' }])
    expect(reply.says).toContain('The record and the paper differ on months.')
    // The months are on the stamped page and nowhere in the cover letter: the copy is right and so is the letter.
    expect(reply.copy_to_mail).toContain('the copy in the envelope is the filed paper whatever the record says')
    expect(reply.copy_to_mail).not.toContain('cover letter')
    expect(reply.copy_to_mail).not.toMatch(/redraw|photocopy/)
    const many = check(shaped({ county: 'Elm', filed_on: '2026-11-13', paper_states: { claim: 4500, months: ['2026-09'], notice_sent_on: ['2026-10-01', '2026-10-09'], property_address: '9 Other St', legal_description: 'LOT 9', owner: 'Someone Else' } }), w())
    expect(many.differences.map((d) => d.what)).toEqual(['claim', 'months', 'notice_day', 'property_address', 'legal_description', 'owner', 'county', 'filed_on'].filter((x) => x !== 'months'))
    // The cover letter states the claim, the property and the owner, so those three are the ones it would get wrong.
    expect(many.copy_to_mail).toContain('would not say what the paper says on claim, property_address, owner: leave the letter out')
    // A day or a county that is not the record's changes no word of the paper.
    expect(check(shaped({ filed_on: '2026-11-13' }), w())).not.toHaveProperty('copy_to_mail')
  })

  it('says what it did not compare: a fact not sent, and a fact the record’s paper does not hold', () => {
    expect(check(shaped({ paper_states: { claim: 4180 } }), w()).not_checked).toBe('Not compared: months, notice_sent_on, property_address, legal_description, owner.')
    expect(check(shaped(), w({ fields: { ...FIELDS, workMonthsWords: '', noticesSentWords: '' } })).not_checked).toBe('Not compared: months (the record’s paper names none), notice_sent_on (the record’s paper names no notice).')
    expect(lienFilingRecordCheck(shaped(), { ...onFile, sends: [], fields: null }).differences.map((d) => d.what)).toEqual(['property_address', 'legal_description', 'owner'])
  })

  it('reads the days a paper writes out', () => {
    expect(daysInWords('certified mail on September 22, 2026 and October 14, 2026')).toEqual(['2026-09-22', '2026-10-14'])
    expect(daysInWords('certified mail on October 9, 2026, and by email on October 9, 2026')).toEqual(['2026-10-09'])
    expect(daysInWords('no day here')).toEqual([])
  })

  it('a saved copy gives way only to a call that says so, with its reason', () => {
    // The same scan with no word to replace: a check, never a write.
    expect(lienFilingDryRun(shaped(), w(), WHO, TODAY)).toMatchObject({ ok: true, status: 'on_record' })
    expect(lienFilingShape(filing({ replace_saved_copy: true }))).toMatchObject({ ok: false, error: expect.stringContaining('needs replace_because') })
    expect(lienFilingShape(filing({ replace_saved_copy: true, replace_because: 'The copy on record is the whole stack.', scan: undefined }))).toMatchObject({ ok: false, error: expect.stringContaining('send scan') })
    expect(lienFilingShape(filing({ replace_because: 'The copy on record is the whole stack.' }))).toMatchObject({ ok: false, error: expect.stringContaining('goes with replace_saved_copy: true') })
    const dry = ready(shaped({ replace_saved_copy: true, replace_because: 'The copy on record is the whole stack.' }), w())
    expect(dry.write).toEqual({ kind: 'attach_scan', filingId: FILING, replaces: COPY, scan: { name: `Lien affidavit, Job 2291, ${LIEN_CLERK_SCAN_NOTE}, 2026-11-16.pdf`, mime: 'application/pdf', size_bytes: 485026, sha256: SHA } })
    expect(dry.reply).toMatchObject({ mode: 'replace_scan', replaces: COPY, replace_because: 'The copy on record is the whole stack.', agrees: true, filing_on_record: { saved_copy: COPY } })
    expect(String((dry.reply as Record<string, unknown>).says)).toContain('carries a saved copy that this call replaces')
    expect(String((dry.reply as Record<string, unknown>).old_copy)).toContain('goes to Drive’s trash')
    const link = ready(shaped({ scan: undefined, saved_copy: { link: 'https://drive.google.com/file/d/1newNewNewNewNewNewNewNewNew/view' }, replace_saved_copy: true, replace_because: 'The copy on record is the whole stack.' }), w())
    expect(link.write).toMatchObject({ kind: 'attach_link', filingId: FILING, replaces: COPY })
    expect(refusal(shaped({ scan: undefined, saved_copy: { link: COPY }, replace_saved_copy: true, replace_because: 'The copy on record is the whole stack.' }), w())).toContain('already carries that link')
    expect(refusal(shaped({ filed_on: '2026-11-13', replace_saved_copy: true, replace_because: 'The copy on record is the whole stack.' }), w())).toContain('is on record for this job as filed 2026-11-16')
  })

  it('the plan counts what is on record, and the apply says where the old file went', () => {
    const reply = lienFilingPlanReply([{ status: 'on_record', agrees: true }, { status: 'on_record', agrees: false }, { status: 'ready' }])
    expect(reply.filings).toBe('3 filings: 1 ready, 2 already on record (1 whose record and paper differ).')
    expect(String(reply.next)).toContain('An entry already on record writes nothing and carries no plan_hash')
    const p = shaped({ replace_saved_copy: true, replace_because: 'The copy on record is the whole stack.' })
    const dry = ready(p, w())
    const NEW = 'https://drive.google.com/file/d/1newNewNewNewNewNewNewNewNew/view'
    const done = lienFilingAppliedWords(p, 'JP2291', dry.write, { file: { url: NEW, driveFileId: '1newNewNewNewNewNewNewNewNew' }, filing: { id: FILING, serve_due: '2026-11-23', document_url: NEW }, item: 'none', stagedRemoved: true, oldCopy: 'trashed' })
    expect(done).toMatchObject({ ok: true, wrote: 'the scan, in place of the saved copy the filing carried', saved_copy: NEW, old_copy: { was: COPY, now: 'in Drive’s trash, where Drive keeps it 30 days' } })
    expect(String(done.next)).toContain('the filing has its new saved copy')
    const left = lienFilingAppliedWords(p, 'JP2291', dry.write, { file: { url: NEW, driveFileId: 'x' }, filing: { id: FILING, serve_due: '2026-11-23', document_url: NEW }, item: 'none', stagedRemoved: true, oldCopy: { left: 'That file is not in the job’s Sent by us folder, so the app leaves it alone.' } })
    expect((left.old_copy as { now: string }).now).toBe('left where it is: That file is not in the job’s Sent by us folder, so the app leaves it alone.')
    const failed = lienFilingAppliedWords(p, 'JP2291', dry.write, { file: { url: NEW, driveFileId: 'x' }, filing: { id: FILING, serve_due: '2026-11-23', document_url: COPY }, item: 'none', stagedRemoved: true, scanFailed: 'the filing no longer carried the copy the plan read, so it was left as it is' })
    expect(failed).not.toHaveProperty('old_copy')
    expect(String(failed.saved_copy_not_added)).toContain(`Plan again with replace_saved_copy: true and saved_copy: { link: "${NEW}" }`)
  })

  it('sets the saved copy’s file beside the scan that was sent', () => {
    const scan = { name: 'x.pdf', size_bytes: 472378, sha256: SHA }
    expect(savedCopyFileWords({ name: 'stack.pdf', size_bytes: 4048441, sha256: 'd'.repeat(64), trashed: false, path: ['Drive', 'Jobs', 'A customer', 'A job', 'Team only', 'Sent by us'] }, scan)).toEqual({ name: 'stack.pdf', size_bytes: 4048441, in: 'A job › Team only › Sent by us', against_your_scan: 'not the bytes you sent: 4048441 bytes on record against your 472378. A split of the same pages differs by a few hundred bytes. A file several times the size holds more than this lien’s pages.' })
    expect(savedCopyFileWords({ name: 'x.pdf', size_bytes: 472378, sha256: SHA.toUpperCase(), trashed: true, path: [] }, scan)).toEqual({ name: 'x.pdf', size_bytes: 472378, in: null, trashed: 'This file is in Drive’s trash.', against_your_scan: 'the same bytes as the file you sent' })
    expect(savedCopyFileWords({ name: 'x.pdf', size_bytes: 1, sha256: null, trashed: false, path: [] }, null)).toEqual({ name: 'x.pdf', size_bytes: 1, in: null })
  })
})

describe('the staged copy and the apply’s words', () => {
  it('checks the staged bytes against the plan', () => {
    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])
    expect(stagedScanProblem(pdf, { name: 'x.pdf', mime: 'application/pdf', size_bytes: 5 })).toBeNull()
    expect(stagedScanProblem(pdf, { name: 'x.pdf', mime: 'application/pdf', size_bytes: 6 })).toContain('The staged file is 5 bytes; the plan says 6')
    expect(stagedScanProblem(new Uint8Array([1, 2, 3, 4, 5]), { name: 'x.pdf', mime: 'application/pdf', size_bytes: 5 })).toContain('not a PDF')
    expect(stagedScanProblem(new Uint8Array([0xff, 0xd8, 0xff]), { name: 'x.jpg', mime: 'image/jpeg', size_bytes: 3 })).toBeNull()
  })

  it('names what landed, what did not, and the next press', () => {
    const p = shaped()
    const dry = ready(p, world())
    const done = lienFilingAppliedWords(p, 'JP2291', dry.write, { file: { url: 'https://drive.google.com/file/d/abc/view', driveFileId: 'abc' }, filing: { id: FILING, serve_due: '2026-11-23', document_url: 'https://drive.google.com/file/d/abc/view' }, item: 'marked sent', stagedRemoved: true })
    expect(done).toMatchObject({ ok: true, filing_id: FILING, wrote: 'the filing', serve_by: '2026-11-23', desk_item: 'marked sent' })
    expect(String(done.next)).toContain('plan_lien_service')
    const noRow = lienFilingAppliedWords(p, 'JP2291', dry.write, { file: null, filing: null, item: 'none', stagedRemoved: null })
    expect(noRow.ok).toBe(false)
    expect(String(noRow.why)).toContain('Nothing else was written')
    const noScan = lienFilingAppliedWords(p, 'JP2291', dry.write, { file: null, filing: { id: FILING, serve_due: '2026-11-23', document_url: '' }, item: { failed: 'refused by the guard' }, stagedRemoved: null, scanFailed: 'the job’s Drive folder did not take the file: 502' })
    expect(noScan.ok).toBe(true)
    expect(String(noScan.saved_copy_not_added)).toContain('takes the scan alone')
    // A file that reached Drive is never sent again: the words carry its link.
    const inDrive = lienFilingAppliedWords(p, 'JP2291', dry.write, { file: { url: 'https://drive.google.com/file/d/abc/view', driveFileId: 'abc' }, filing: { id: FILING, serve_due: '2026-11-23', document_url: '' }, item: 'marked sent', stagedRemoved: true, scanFailed: 'its link was not saved on the filing: 403' })
    expect(String(inDrive.saved_copy_not_added)).toContain('saved_copy: { link: "https://drive.google.com/file/d/abc/view" }')
    expect(String(lienFilingAppliedWords(p, 'JP2291', dry.write, { file: null, filing: { id: FILING, serve_due: null, document_url: '' }, item: 'none', stagedRemoved: null, duplicates: ['other-id'] }).second_affidavit_on_record)).toContain('Void the extra one')
    expect(String(noScan.desk_item_not_marked)).toContain('refused by the guard')
    expect(String(lienFilingAppliedWords(p, 'JP2291', dry.write, { file: null, filing: { id: FILING, serve_due: null, document_url: '' }, item: 'none', stagedRemoved: false }).staged_copy_left)).toContain('private to you')
  })
})
