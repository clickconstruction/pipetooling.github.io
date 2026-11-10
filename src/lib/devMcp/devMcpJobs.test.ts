import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  BILL_TO_PARTIES,
  COMPANY_OWNER_USER_ID_KEY,
  JOB_KINDS,
  JOB_OWNER_OVERRIDE_DEFAULT_KEY,
  JOB_STATUSES,
  JOB_VERBS,
  STATUS_WORDS,
  UPDATE_COLUMNS,
  customerContact,
  isJobVerb,
  jobAppliedWords,
  jobInput,
  jobMasterUser,
  jobShortLabel,
  jobUpdateAppliedWords,
  jobUpdateDryRun,
  jobUpdateInput,
  newJobDryRun,
  newJobRow,
  readJobUpdateWorld,
  readNewJobWorld,
  statusSteps,
  type JobReads,
  type JobRow,
  type JobUpdatePayload,
  type NewJobPayload,
  type NewJobWorld,
} from '../../../supabase/functions/_shared/devMcpJobs'
import { WRITE_VERBS, alreadyApplied, isWriteVerb, planHash, planReply, planVerbFor, writeRpcBody } from '../../../supabase/functions/_shared/devMcpWrites'
import { JOB_KINDS as APP_JOB_KINDS } from '../jobs/jobKind'
import { COMPANY_OWNER_USER_ID_KEY as APP_COMPANY_KEY } from '../companyOwner'
import { chooseJobOwnerFromOverrideRows, JOB_OWNER_OVERRIDE_DEFAULT_KEY as APP_DEFAULT_KEY } from '../resolveEffectiveJobMasterUserId'
import { titleCaseAddress } from '../addressTitleCase'

const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')
const README = readFileSync('docs/dev-mcp/README.md', 'utf8')
const FORM = readFileSync('src/components/jobs/JobFormModal.tsx', 'utf8')

const CUSTOMER = 'aaaaaaaa-1111-4111-8111-111111111111'
const GC = 'aaaaaaaa-2222-4222-8222-222222222222'
const SERVICE = 'bbbbbbbb-1111-4111-8111-111111111111'
const SITE = 'cccccccc-1111-4111-8111-111111111111'
const PROJECT = 'dddddddd-1111-4111-8111-111111111111'
const BID = 'eeeeeeee-1111-4111-8111-111111111111'
const DEV = 'ffffffff-1111-4111-8111-111111111111'
const OWNER = 'ffffffff-2222-4222-8222-222222222222'
const HASH = 'a'.repeat(64)
const ME = { userId: DEV, name: 'Dev One' }

const JOB = { job_name: ' ZZ TEST seat walk ', job_address: '123 main st, austin tx 78701', customer_id: CUSTOMER, service_type_id: SERVICE, revenue: 1, kind: 'service' }

const world = (over: Partial<NewJobWorld> = {}): NewJobWorld => ({
  me: ME,
  customer: { id: CUSTOMER, name: 'ZZ Test Customer', customer_type: 'residential', contact_info: { email: 'zz@example.com', phone: '5125550100' } },
  gcCustomer: null,
  serviceType: { id: SERVICE, name: 'Plumbing' },
  development: null,
  project: null,
  bid: null,
  settings: [{ key: COMPANY_OWNER_USER_ID_KEY, value_text: OWNER }],
  sameName: [],
  ...over,
})

const p = (over: Partial<Record<string, unknown>> = {}): NewJobPayload => {
  const built = jobInput('plan_job', { job: { ...JOB, ...over } })
  if (!built.ok) throw new Error(built.error)
  return built.p
}

describe('devMcpJobs — the verbs on the allowlist', () => {
  it('are two write verbs with no RPC, plan before apply, and the server names both', () => {
    expect(JOB_VERBS).toEqual(['plan_job', 'apply_job', 'plan_job_update', 'apply_job_update'])
    for (const v of JOB_VERBS) {
      expect(isJobVerb(v)).toBe(true)
      expect(isWriteVerb(v)).toBe(true)
      expect(WRITE_VERBS[v].rpc).toBeNull()
      expect(SERVER).toContain(`case '${v}':`)
      expect(SERVER).toContain(`name: '${v}',`)
    }
    expect(planVerbFor('apply_job')).toBe('plan_job')
    expect(planVerbFor('apply_job_update')).toBe('plan_job_update')
    expect(isJobVerb('plan_bid')).toBe(false)
    expect(SERVER).toContain('Writes are sixty-nine verbs and nothing else:')
    expect(README).toContain('`plan_job(job)` · `apply_job(job, plan_hash)`')
    expect(README).toContain('`plan_job_update(update)` · `apply_job_update(update, plan_hash)`')
  })
  it('holds the kinds and the owner keys to the app’s own', () => {
    expect([...JOB_KINDS]).toEqual([...APP_JOB_KINDS])
    expect(COMPANY_OWNER_USER_ID_KEY).toBe(APP_COMPANY_KEY)
    expect(JOB_OWNER_OVERRIDE_DEFAULT_KEY).toBe(APP_DEFAULT_KEY)
    expect([...BILL_TO_PARTIES]).toEqual(['customer', 'gc'])
  })
})

describe('jobInput — the shape', () => {
  it('trims the words, lowers the ids, rounds the price, and carries only what was given', () => {
    const built = writeRpcBody('plan_job', { job: { ...JOB, customer_id: CUSTOMER.toUpperCase(), revenue: 1.239, hcp_number: ' 4411 ' } })
    expect(built).toMatchObject({ ok: true, rpc: null, step: 'plan', target: 'ZZ TEST seat walk', body: { p: { action: 'create', job_name: 'ZZ TEST seat walk', job_address: '123 main st, austin tx 78701', customer_id: CUSTOMER, service_type_id: SERVICE, revenue: 1.24, hcp_number: '4411', kind: 'service' } } })
    const built2 = built as Extract<ReturnType<typeof writeRpcBody>, { ok: true }>
    const pp = built2.body.p as NewJobPayload
    expect(pp).not.toHaveProperty('click_number')
    expect(pp).not.toHaveProperty('development_id')
    expect(pp).not.toHaveProperty('allow_duplicate_name')
    expect(jobInput('plan_job', { job: { ...JOB, revenue: '12.50' } })).toMatchObject({ ok: true, p: { revenue: 12.5 } })
    expect(jobInput('plan_job', { job: { ...JOB, allow_duplicate_name: true, bill_to_party: 'gc', gc_customer_id: GC } })).toMatchObject({ ok: true, p: { allow_duplicate_name: true, bill_to_party: 'gc', gc_customer_id: GC } })
  })
  it('refuses a missing name or address, a bad id, a bad price, a bad kind, a GC bill-to with no GC, a bad link, a bad email — each in words', () => {
    expect(jobInput('plan_job', {})).toMatchObject({ ok: false, error: expect.stringContaining('plan_job needs job') })
    expect(jobInput('plan_job', { job: { ...JOB, job_name: ' ' } })).toMatchObject({ ok: false })
    expect(jobInput('plan_job', { job: { ...JOB, job_address: '' } })).toMatchObject({ ok: false })
    expect(jobInput('plan_job', { job: { ...JOB, customer_id: 'ZZ' } })).toMatchObject({ ok: false })
    expect(jobInput('plan_job', { job: { ...JOB, service_type_id: 'plumbing' } })).toMatchObject({ ok: false })
    expect(jobInput('plan_job', { job: { ...JOB, revenue: -1 } })).toMatchObject({ ok: false, error: expect.stringContaining('revenue') })
    expect(jobInput('plan_job', { job: { ...JOB, revenue: 'a dollar' } })).toMatchObject({ ok: false, error: expect.stringContaining('revenue') })
    expect(jobInput('plan_job', { job: { ...JOB, kind: 'repair' } })).toMatchObject({ ok: false, error: expect.stringContaining('kind') })
    expect(jobInput('plan_job', { job: { ...JOB, bill_to_party: 'gc' } })).toMatchObject({ ok: false, error: expect.stringContaining('gc_customer_id') })
    expect(jobInput('plan_job', { job: { ...JOB, bill_to_party: 'owner' } })).toMatchObject({ ok: false })
    expect(jobInput('plan_job', { job: { ...JOB, job_plans_link: 'drive folder' } })).toMatchObject({ ok: false, error: expect.stringContaining('job_plans_link') })
    expect(jobInput('plan_job', { job: { ...JOB, customer_email: 'not an email' } })).toMatchObject({ ok: false, error: expect.stringContaining('customer_email') })
    expect(jobInput('plan_job', { job: { ...JOB, development_id: 'the site' } })).toMatchObject({ ok: false })
  })
  it('apply needs the plan_hash', () => {
    expect(jobInput('apply_job', { job: JOB })).toMatchObject({ ok: false, error: expect.stringContaining('plan_hash') })
    expect(jobInput('apply_job', { job: JOB, plan_hash: HASH.toUpperCase() })).toMatchObject({ ok: true, planHash: HASH })
    expect(writeRpcBody('apply_job', { job: JOB, plan_hash: HASH })).toMatchObject({ ok: true, step: 'apply', planHash: HASH, dryRunBody: null })
  })
})

describe('readNewJobWorld — the reads the door sees', () => {
  it('reads the customer, the service type, the settings and the same-name jobs, and the optional rows only when named', async () => {
    const seen: string[] = []
    const reads: JobReads = {
      rows: async (table, query) => {
        seen.push(`${table}?${query}`)
        if (table === 'customers') return [{ id: CUSTOMER, name: 'ZZ Test Customer', customer_type: 'residential', contact_info: null }]
        if (table === 'service_types') return [{ id: SERVICE, name: 'Plumbing' }]
        if (table === 'app_settings') return [{ key: COMPANY_OWNER_USER_ID_KEY, value_text: OWNER }]
        if (table === 'jobs_ledger') return [{ id: 'j1', job_name: 'zz test seat walk', status: 'waiting', click_number: '', hcp_number: '' }, { id: 'j2', job_name: 'ZZ TEST seat walk two', status: 'working', click_number: '', hcp_number: '' }]
        return []
      },
    }
    const w = await readNewJobWorld(reads, p(), ME)
    expect(seen).toEqual([
      `customers?select=id,name,customer_type,contact_info&id=eq.${CUSTOMER}`,
      `service_types?select=id,name&id=eq.${SERVICE}`,
      `app_settings?select=key,value_text&key=in.(${COMPANY_OWNER_USER_ID_KEY},job_owner_override_${DEV},${JOB_OWNER_OVERRIDE_DEFAULT_KEY})`,
      `jobs_ledger?select=id,job_name,status,click_number,hcp_number&customer_id=eq.${CUSTOMER}&status=neq.paid&job_name=ilike.${encodeURIComponent('ZZ TEST seat walk')}`,
    ])
    // The ilike over-matches on purpose; the kernel keeps the exact name, case aside.
    expect(w.sameName.map((j) => j.id)).toEqual(['j1'])
    expect(w.development).toBeNull()
    expect(w.bid).toBeNull()
    const seen2: string[] = []
    await readNewJobWorld({ rows: async (table, query) => { seen2.push(`${table}?${query}`); return [] } }, p({ development_id: SITE, project_id: PROJECT, bid_id: BID, bill_to_party: 'gc', gc_customer_id: GC }), ME)
    expect(seen2).toContain(`developments?select=id,name&id=eq.${SITE}`)
    expect(seen2).toContain(`projects?select=id,name,master_user_id&id=eq.${PROJECT}`)
    expect(seen2).toContain(`bids?select=id,bid_number,project_name&id=eq.${BID}`)
    expect(seen2).toContain(`customers?select=id,name,customer_type,contact_info&id=eq.${GC}`)
  })
})

describe('jobMasterUser — the New Job form’s owner rule', () => {
  const rows = (...r: Array<{ key: string; value_text: string | null }>) => r
  it('agrees with resolveEffectiveJobMasterUserId’s pure half on every branch', () => {
    const cases = [
      rows({ key: COMPANY_OWNER_USER_ID_KEY, value_text: OWNER }, { key: `job_owner_override_${DEV}`, value_text: 'x' }),
      rows({ key: `job_owner_override_${DEV}`, value_text: 'personal' }, { key: JOB_OWNER_OVERRIDE_DEFAULT_KEY, value_text: 'org' }),
      rows({ key: JOB_OWNER_OVERRIDE_DEFAULT_KEY, value_text: 'org' }),
      rows({ key: COMPANY_OWNER_USER_ID_KEY, value_text: '  ' }),
      rows(),
    ]
    for (const settings of cases) {
      expect(jobMasterUser(world({ settings }), p()).id).toBe(chooseJobOwnerFromOverrideRows(settings, DEV))
    }
    expect(jobMasterUser(world({ settings: [] }), p()).how).toContain('you')
    expect(jobMasterUser(world(), p()).how).toContain('company owner')
  })
  it('a project-linked job belongs to the project’s master', () => {
    const w = world({ project: { id: PROJECT, name: 'Oak Hill', master_user_id: 'master-1' } })
    expect(jobMasterUser(w, p({ project_id: PROJECT }))).toEqual({ id: 'master-1', how: "the project's master (Oak Hill)" })
    expect(jobMasterUser(w, p()).id).toBe(OWNER)
  })
})

describe('newJobRow — the form’s payload, column for column', () => {
  it('Title-Cases the address, fills the customer’s email and phone when left out, and keeps the typed ones', () => {
    const row = newJobRow(p(), world())
    expect(row).toEqual({
      master_user_id: OWNER,
      hcp_number: '',
      click_number: '',
      job_name: 'ZZ TEST seat walk',
      job_address: titleCaseAddress('123 main st, austin tx 78701'),
      customer_id: CUSTOMER,
      gc_customer_id: null,
      bill_to_party: 'customer',
      bill_copy_other_party: false,
      show_bills_to_other_party: false,
      customer_address_id: null,
      development_id: null,
      customer_name: 'ZZ Test Customer',
      customer_email: 'zz@example.com',
      customer_phone: '5125550100',
      google_drive_link: null,
      job_pictures_link: null,
      job_plans_link: null,
      revenue: 1,
      project_id: null,
      bid_id: null,
      service_type_id: SERVICE,
      account_manager_user_id: null,
      account_manager_relationship: null,
    })
    expect(row.job_address).toBe('123 Main St, Austin TX 78701')
    const typed = newJobRow(p({ customer_name: 'Robert', customer_email: 'r@example.com', customer_phone: '5125550199' }), world())
    expect(typed).toMatchObject({ customer_name: 'Robert', customer_email: 'r@example.com', customer_phone: '5125550199' })
    expect(customerContact({ id: CUSTOMER, name: null, customer_type: null, contact_info: { phone: ' ' } })).toEqual({ email: null, phone: null })
    // Every column the form inserts is one the row carries (createJob's insert).
    const insert = FORM.slice(FORM.indexOf("async function createJob()"), FORM.indexOf('.select(\'id\')', FORM.indexOf("async function createJob()")))
    for (const col of Object.keys(row)) expect(insert).toContain(`${col}:`)
  })
  it('a GC bill-to with the GC read holds; with no GC row it falls back to the customer (v2.3345)', () => {
    const w = world({ gcCustomer: { id: GC, name: 'Big GC', customer_type: 'commercial', contact_info: null } })
    expect(newJobRow(p({ bill_to_party: 'gc', gc_customer_id: GC }), w)).toMatchObject({ bill_to_party: 'gc', gc_customer_id: GC })
    expect(newJobRow(p({ bill_to_party: 'gc', gc_customer_id: GC }), world())).toMatchObject({ bill_to_party: 'customer', gc_customer_id: null })
  })
})

describe('newJobDryRun — the plan', () => {
  it('replies with the row, the owner and why, the readiness and what it does not do', () => {
    const dry = newJobDryRun(p(), world())
    expect(dry.ok).toBe(true)
    if (!dry.ok) return
    expect(dry.reply).toMatchObject({
      action: 'create',
      customer: { id: CUSTOMER, name: 'ZZ Test Customer', type: 'residential' },
      service_type: { id: SERVICE, name: 'Plumbing' },
      master_user: { id: OWNER },
      row: { job_name: 'ZZ TEST seat walk', revenue: 1 },
      kind_after: 'service',
      same_name_live_jobs: [],
    })
    const readiness = dry.reply.readiness as Record<string, string>
    expect(readiness.revenue).toContain('1')
    expect(readiness.customer_email).toContain('zz@example.com')
    expect(readiness.status).toContain('plan_job_update')
    // v2.6826: a Stripe bill is numbered from the HCP or Click number, and the plan says when the job has none.
    expect(readiness.number).toContain('none')
    const numbered = newJobDryRun(p({ click_number: '9293' }), world())
    if (!numbered.ok) throw new Error(numbered.refused)
    expect((numbered.reply.readiness as Record<string, string>).number).toBe('9293')
    expect(dry.reply.not_done).toHaveLength(3)
    const noPrice = newJobDryRun(p({ revenue: 0 }), world({ customer: { id: CUSTOMER, name: 'ZZ', customer_type: null, contact_info: null } }))
    if (!noPrice.ok) throw new Error(noPrice.refused)
    expect((noPrice.reply.readiness as Record<string, string>).revenue).toContain('none')
    expect((noPrice.reply.readiness as Record<string, string>).customer_email).toContain('none')
  })
  it('refuses a customer, service type, development, project, bid or GC that is not visible, each naming the finder', () => {
    expect(newJobDryRun(p(), world({ customer: null }))).toMatchObject({ ok: false, refused: expect.stringContaining('find_customer') })
    expect(newJobDryRun(p(), world({ serviceType: null }))).toMatchObject({ ok: false, refused: expect.stringContaining('service_types') })
    expect(newJobDryRun(p({ development_id: SITE }), world())).toMatchObject({ ok: false, refused: expect.stringContaining('developments') })
    expect(newJobDryRun(p({ project_id: PROJECT }), world())).toMatchObject({ ok: false, refused: expect.stringContaining('projects') })
    expect(newJobDryRun(p({ bid_id: BID }), world())).toMatchObject({ ok: false, refused: expect.stringContaining('find_bid') })
    expect(newJobDryRun(p({ bill_to_party: 'gc', gc_customer_id: GC }), world())).toMatchObject({ ok: false, refused: expect.stringContaining('GC customer') })
  })
  it('refuses a live job already wearing the name unless allow_duplicate_name, naming the jobs', () => {
    const w = world({ sameName: [{ id: 'j1', job_name: 'ZZ TEST seat walk', status: 'working', click_number: '972', hcp_number: '' }] })
    expect(newJobDryRun(p(), w)).toMatchObject({ ok: false, refused: expect.stringContaining('JP972 (working)') })
    const dry = newJobDryRun(p({ allow_duplicate_name: true }), w)
    expect(dry).toMatchObject({ ok: true, reply: { same_name_live_jobs: [{ id: 'j1', label: 'JP972', status: 'working' }] } })
  })
  it('hashes the payload with the row and the owner, so a changed customer email or owner refuses the apply', async () => {
    const a = newJobDryRun(p(), world())
    const b = newJobDryRun(p(), world({ customer: { id: CUSTOMER, name: 'ZZ Test Customer', customer_type: 'residential', contact_info: { email: 'other@example.com' } } }))
    const c = newJobDryRun(p(), world({ settings: [] }))
    if (!a.ok || !b.ok || !c.ok) throw new Error('refused')
    const ha = await planHash('plan_job', p(), a.reply)
    expect(await planHash('plan_job', p(), a.reply)).toBe(ha)
    expect(await planHash('plan_job', p(), b.reply)).not.toBe(ha)
    expect(await planHash('plan_job', p(), c.reply)).not.toBe(ha)
    expect(planReply('plan_job', a.reply, ha).next).toContain('apply_job')
  })
})

describe('the words after', () => {
  it('names the job by its number, else its name, and says the next press', () => {
    expect(jobShortLabel({ click_number: '972' })).toBe('JP972')
    expect(jobShortLabel({ hcp_number: 'HCP-12' })).toBe('HCP-12')
    expect(jobShortLabel({ job_name: 'ZZ TEST seat walk' })).toBe('ZZ TEST seat walk')
    const words = jobAppliedWords({ id: 'j9', job_name: 'ZZ TEST seat walk', click_number: '', hcp_number: '' }, { asked: 'service', saved: true })
    expect(words).toMatchObject({ job_id: 'j9', label: 'ZZ TEST seat walk', kind: 'service' })
    expect(String(words.next)).toContain('plan_job_update')
    expect(jobAppliedWords({ id: 'j9' }, { asked: 'project', saved: false, why: 'refused' }).kind).toBe('not saved: refused')
    expect(jobAppliedWords({ id: 'j9' }, { asked: null, saved: false }).kind).toBeNull()
    expect(alreadyApplied('apply_job', { target: 'j9', at: null })).toContain('as job j9')
  })
})

describe('the update verbs (v2.6793, PR 2)', () => {
  const JOBID = '99999999-1111-4111-8111-111111111111'
  const AM = 'ffffffff-3333-4333-8333-333333333333'
  const row = (over: Partial<JobRow> = {}): JobRow => ({
    id: JOBID, status: 'waiting', updated_at: '2026-11-09T15:00:00+00:00', master_user_id: OWNER,
    job_name: 'ZZ TEST seat walk', job_address: '123 Main St, Austin TX 78701', hcp_number: '', click_number: '', customer_id: CUSTOMER, customer_name: 'ZZ Test Customer', customer_email: 'zz@example.com', customer_phone: null, service_type_id: SERVICE,
    development_id: null, project_id: null, bid_id: null, bill_to_party: 'customer', gc_customer_id: null, google_drive_link: null, job_pictures_link: null, job_plans_link: null, account_manager_user_id: null, revenue: 1, pct_complete: 0, kind: null,
    ...over,
  })
  const up = (over: Record<string, unknown>): JobUpdatePayload => {
    const built = jobUpdateInput('plan_job_update', { update: { job_id: JOBID, ...over } })
    if (!built.ok) throw new Error(built.error)
    return built.p
  }
  it('holds the columns to the Edit Job form’s own payload and the statuses to the table’s CHECK', () => {
    const SLICES = readFileSync('src/lib/jobs/jobFormAutosaveSlices.ts', 'utf8')
    const payload = SLICES.slice(SLICES.indexOf('export function buildEditJobIdentityUpdatePayload'), SLICES.indexOf('export function identitySliceReadyToSave'))
    for (const col of UPDATE_COLUMNS) {
      if (col === 'revenue' || col === 'pct_complete' || col === 'kind') continue // the price slice, the Stages percent, the kind press
      expect(payload).toContain(`${col}:`)
    }
    const BASELINE = readFileSync('supabase/migrations/20250101000000_baseline.sql', 'utf8')
    expect(BASELINE).toContain(`CONSTRAINT "jobs_ledger_status_check" CHECK (("status" = ANY (ARRAY[${JOB_STATUSES.map((s) => `'${s}'::"text"`).join(', ')}])))`)
    expect(Object.keys(STATUS_WORDS)).toEqual([...JOB_STATUSES])
  })
  it('shapes the set column by column, the status, the reason, and refuses an unknown column, a cleared required column or nothing to change', () => {
    expect(up({ set: { job_address: ' 500 oak st ', revenue: '12.5', pct_complete: 40, kind: 'Project', customer_email: 'a@b.co', customer_phone: '' }, status: 'READY_TO_BILL', reason: 'the walk' })).toEqual({
      action: 'update', job_id: JOBID, set: { job_address: '500 Oak St', revenue: 12.5, pct_complete: 40, kind: 'project', customer_email: 'a@b.co', customer_phone: null }, status: 'ready_to_bill', reason: 'the walk',
    })
    expect(up({ set: { development_id: null, kind: null } })).toMatchObject({ set: { development_id: null, kind: null } })
    expect(jobUpdateInput('plan_job_update', { update: { job_id: JOBID } })).toMatchObject({ ok: false, error: expect.stringContaining('nothing to change') })
    expect(jobUpdateInput('plan_job_update', { update: { job_id: JOBID, set: { status: 'billed' } } })).toMatchObject({ ok: false, error: expect.stringContaining('A status is `status`') })
    expect(jobUpdateInput('plan_job_update', { update: { job_id: JOBID, set: { payments_made: 5 } } })).toMatchObject({ ok: false, error: expect.stringContaining('not a column this verb changes') })
    expect(jobUpdateInput('plan_job_update', { update: { job_id: JOBID, set: { job_name: null } } })).toMatchObject({ ok: false, error: expect.stringContaining('cannot be cleared') })
    expect(jobUpdateInput('plan_job_update', { update: { job_id: JOBID, set: { job_name: ' ' } } })).toMatchObject({ ok: false, error: expect.stringContaining('required') })
    expect(jobUpdateInput('plan_job_update', { update: { job_id: JOBID, set: { pct_complete: 101 } } })).toMatchObject({ ok: false, error: expect.stringContaining('0 to 100') })
    expect(jobUpdateInput('plan_job_update', { update: { job_id: JOBID, set: { customer_id: 'robert' } } })).toMatchObject({ ok: false, error: expect.stringContaining('find_customer') })
    expect(jobUpdateInput('plan_job_update', { update: { job_id: JOBID, set: { kind: 'repair' } } })).toMatchObject({ ok: false, error: expect.stringContaining('kind') })
    expect(jobUpdateInput('plan_job_update', { update: { job_id: JOBID, status: 'done' } })).toMatchObject({ ok: false, error: expect.stringContaining('status is one of') })
    expect(jobUpdateInput('plan_job_update', { update: { job_id: 'JP972', status: 'working' } })).toMatchObject({ ok: false, error: expect.stringContaining('find_job') })
    expect(jobUpdateInput('apply_job_update', { update: { job_id: JOBID, status: 'working' } })).toMatchObject({ ok: false, error: expect.stringContaining('plan_hash') })
    expect(writeRpcBody('apply_job_update', { update: { job_id: JOBID, status: 'working' }, plan_hash: HASH })).toMatchObject({ ok: true, rpc: null, step: 'apply', planHash: HASH, target: JOBID })
  })
  it('reads the job with every column and each row a new id names', async () => {
    const seen: string[] = []
    const reads: JobReads = { rows: async (table, query) => { seen.push(`${table}?${query}`); return table === 'jobs_ledger' ? [row()] : table === 'bids' ? [{ id: BID, project_name: 'Oak Hill' }] : [{ id: AM, name: 'Ana' }] } }
    const w = await readJobUpdateWorld(reads, up({ set: { bid_id: BID, account_manager_user_id: AM, job_name: 'x' } }))
    expect(seen[0]).toBe(`jobs_ledger?select=id,status,updated_at,master_user_id,${UPDATE_COLUMNS.join(',')}&id=eq.${JOBID}`)
    expect(seen).toContain(`bids?select=id,project_name&id=eq.${BID}`)
    expect(seen).toContain(`users?select=id,name&id=eq.${AM}`)
    expect(seen).toHaveLength(3)
    expect(w.named).toEqual({ bid_id: { id: BID, name: 'Oak Hill' }, account_manager_user_id: { id: AM, name: 'Ana' } })
  })
  it('walks the status one neighbour at a time, forward and back', () => {
    expect(statusSteps('waiting', 'ready_to_bill')).toEqual(['working', 'ready_to_bill'])
    expect(statusSteps('paid', 'working')).toEqual(['billed', 'ready_to_bill', 'working'])
    expect(statusSteps('billed', 'billed')).toEqual([])
    expect(statusSteps('waiting', 'paid')).toEqual(['working', 'ready_to_bill', 'billed', 'paid'])
  })
  it('the plan shows before → after with the no-ops dropped, the steps with the send-back warning, and refuses a plan that changes nothing', () => {
    const dry = jobUpdateDryRun(up({ set: { revenue: 25, job_name: 'ZZ TEST seat walk', customer_phone: '5125550199' }, status: 'ready_to_bill' }), { job: row(), named: {} })
    if (!dry.ok) throw new Error(dry.refused)
    expect(dry.reply).toMatchObject({
      action: 'update',
      job: { id: JOBID, label: 'ZZ TEST seat walk', status: 'waiting', status_words: 'Waiting' },
      changes: [{ column: 'revenue', before: 1, after: 25 }, { column: 'customer_phone', before: null, after: '5125550199' }],
      patch: { revenue: 25, customer_phone: '5125550199' },
      status: { from: 'waiting', to: 'ready_to_bill', steps: [{ to: 'working', words: 'Waiting → Working' }, { to: 'ready_to_bill', words: 'Working → Ready to Bill' }] },
    })
    const back = jobUpdateDryRun(up({ status: 'working' }), { job: row({ status: 'ready_to_bill' }), named: {} })
    if (!back.ok) throw new Error(back.refused)
    expect(String((back.reply.status as { steps: Array<{ words: string }> }).steps[0]?.words)).toContain('deletes the job')
    const billed = jobUpdateDryRun(up({ status: 'billed' }), { job: row({ status: 'ready_to_bill' }), named: {} })
    if (!billed.ok) throw new Error(billed.refused)
    expect(String((billed.reply.status as { steps: Array<{ words: string }> }).steps[0]?.words)).toContain('plan_bill')
    // A price typed as the row holds it is a no-op; so is the status it already has.
    expect(jobUpdateDryRun(up({ set: { revenue: '1' }, status: 'waiting' }), { job: row(), named: {} })).toMatchObject({ ok: false, refused: expect.stringContaining('already reads that way') })
    expect(jobUpdateDryRun(up({ set: { job_name: 'ZZ TEST seat walk' } }), { job: row(), named: {} })).toMatchObject({ ok: false, refused: expect.stringContaining('Nothing to apply') })
  })
  it('refuses a job or a named row not visible, a GC bill-to with no GC, and names the new row’s name in the change', () => {
    expect(jobUpdateDryRun(up({ status: 'working' }), { job: null, named: {} })).toMatchObject({ ok: false, refused: expect.stringContaining('find_job') })
    expect(jobUpdateDryRun(up({ set: { bid_id: BID } }), { job: row(), named: { bid_id: null } })).toMatchObject({ ok: false, refused: expect.stringContaining('find_bid') })
    expect(jobUpdateDryRun(up({ set: { bill_to_party: 'gc' } }), { job: row(), named: {} })).toMatchObject({ ok: false, refused: expect.stringContaining('gc_customer_id') })
    const dry = jobUpdateDryRun(up({ set: { bid_id: BID } }), { job: row(), named: { bid_id: { id: BID, name: 'Oak Hill' } } })
    expect(dry).toMatchObject({ ok: true, reply: { changes: [{ column: 'bid_id', before: null, after: BID, named: 'Oak Hill' }] } })
  })
  it('hashes the before values and updated_at, so a row changed since refuses the apply', async () => {
    const p1 = up({ set: { revenue: 25 } })
    const a = jobUpdateDryRun(p1, { job: row(), named: {} })
    const b = jobUpdateDryRun(p1, { job: row({ updated_at: '2026-11-09T15:01:00+00:00' }), named: {} })
    const c = jobUpdateDryRun(p1, { job: row({ revenue: 2 }), named: {} })
    if (!a.ok || !b.ok || !c.ok) throw new Error('refused')
    const ha = await planHash('plan_job_update', p1, a.reply)
    expect(await planHash('plan_job_update', p1, a.reply)).toBe(ha)
    expect(await planHash('plan_job_update', p1, b.reply)).not.toBe(ha)
    expect(await planHash('plan_job_update', p1, c.reply)).not.toBe(ha)
    expect(planReply('plan_job_update', a.reply, ha).next).toContain('apply_job_update')
    expect(alreadyApplied('apply_job_update', { target: JOBID, at: null })).toContain('on this job')
  })
  it('the words after: what landed, where the steps stopped, and the next press', () => {
    const job = { id: JOBID, job_name: 'ZZ TEST seat walk' }
    const fine = jobUpdateAppliedWords(job, { changes: [{ column: 'revenue', before: 1, after: 25 }], held: null }, { from: 'waiting', steps: [{ to: 'working', ok: true }, { to: 'ready_to_bill', ok: true }] })
    expect(fine).toMatchObject({ job_id: JOBID, label: 'ZZ TEST seat walk', status: { from: 'waiting', now: 'ready_to_bill' } })
    expect(String(fine.next)).toContain('plan_bill')
    const stopped = jobUpdateAppliedWords(job, { changes: [], held: null }, { from: 'waiting', steps: [{ to: 'working', ok: true }, { to: 'ready_to_bill', ok: false, error: 'Not authorized to update job status' }] })
    expect(stopped).toMatchObject({ status: { now: 'working' } })
    expect(String(stopped.next)).toContain('stopped at Working: Not authorized')
    const held = jobUpdateAppliedWords(job, { changes: [], held: 'This account could not change revenue on this job (RLS let no row through).' }, null)
    expect(held.held).toContain('RLS')
    expect(String(held.next)).toContain('get_job')
  })
  it('the server declares both verbs, PATCHes the row and walks update_job_status step by step', () => {
    expect(SERVER).toContain("case 'plan_job_update':")
    expect(SERVER).toContain("name: 'apply_job_update',")
    expect(SERVER).toContain("await restRows(session, 'PATCH', 'jobs_ledger', `id=eq.${job.id}`, patch)")
    expect(SERVER).toContain("await restPost(session, 'rpc/update_job_status', { p_job_id: job.id, p_to_status: to })")
  })
})
