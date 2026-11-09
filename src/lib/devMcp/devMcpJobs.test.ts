import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  BILL_TO_PARTIES,
  COMPANY_OWNER_USER_ID_KEY,
  JOB_KINDS,
  JOB_OWNER_OVERRIDE_DEFAULT_KEY,
  JOB_VERBS,
  customerContact,
  isJobVerb,
  jobAppliedWords,
  jobInput,
  jobMasterUser,
  jobShortLabel,
  newJobDryRun,
  newJobRow,
  readNewJobWorld,
  type JobReads,
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
    expect(JOB_VERBS).toEqual(['plan_job', 'apply_job'])
    for (const v of JOB_VERBS) {
      expect(isJobVerb(v)).toBe(true)
      expect(isWriteVerb(v)).toBe(true)
      expect(WRITE_VERBS[v].rpc).toBeNull()
      expect(SERVER).toContain(`case '${v}':`)
      expect(SERVER).toContain(`name: '${v}',`)
    }
    expect(planVerbFor('apply_job')).toBe('plan_job')
    expect(isJobVerb('plan_bid')).toBe(false)
    expect(SERVER).toContain('Writes are sixty-three verbs and nothing else:')
    expect(README).toContain('`plan_job(job)` · `apply_job(job, plan_hash)`')
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
