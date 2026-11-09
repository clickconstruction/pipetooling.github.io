// The stage plan_job / apply_job name is the stage the row lands at. The verb writes no status (as New Job writes
// none), so the row takes jobs_ledger.status's column default — and the words have to name that default, whatever
// the newest migration says it is. The first fifteen jobs made from the seat (2026-11-09) were told "Waiting" and
// read back as working: the words had been written from the baseline's default, which 20260722264000 had moved.
// This test reads the default out of the migrations, so a later move of it fails here until the words follow.

import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  COMPANY_OWNER_USER_ID_KEY,
  jobAppliedWords,
  jobInput,
  newJobDryRun,
  newJobRow,
  type NewJobWorld,
} from '../../../supabase/functions/_shared/devMcpJobs'
import { JOB_STEPPER_LABELS, type JobStepperStatus } from '../jobs/jobStatusStepper'

const MIGRATIONS = 'supabase/migrations'
const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')
const README = readFileSync('docs/dev-mcp/README.md', 'utf8')

/** The default a new jobs_ledger row's status takes: the newest SET DEFAULT on the column, else the baseline's. */
function newJobStageByMigration(): { stage: string; file: string } {
  const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()
  let found: { stage: string; file: string } | null = null
  for (const file of files) {
    const sql = readFileSync(`${MIGRATIONS}/${file}`, 'utf8')
    const created = /CREATE TABLE[^;]*?"public"\."jobs_ledger" \([^;]*?"status" "text" DEFAULT '([a-z_]+)'/s.exec(sql)
    if (created?.[1]) found = { stage: created[1], file }
    const altered = /ALTER TABLE\s+(?:ONLY\s+)?(?:public\.|"public"\.)?"?jobs_ledger"?\s+ALTER COLUMN\s+"?status"?\s+SET DEFAULT\s+'([a-z_]+)'/gi
    for (let m = altered.exec(sql); m; m = altered.exec(sql)) if (m[1]) found = { stage: m[1], file }
  }
  if (!found) throw new Error('no migration sets a default on jobs_ledger.status')
  return found
}

const CUSTOMER = 'aaaaaaaa-1111-4111-8111-111111111111'
const SERVICE = 'bbbbbbbb-1111-4111-8111-111111111111'
const OWNER = 'ffffffff-2222-4222-8222-222222222222'

const WORLD: NewJobWorld = {
  me: { userId: 'ffffffff-1111-4111-8111-111111111111', name: 'Dev One' },
  customer: { id: CUSTOMER, name: 'ZZ Test Customer', customer_type: 'residential', contact_info: { email: 'zz@example.com' } },
  gcCustomer: null,
  serviceType: { id: SERVICE, name: 'Plumbing' },
  development: null,
  project: null,
  bid: null,
  settings: [{ key: COMPANY_OWNER_USER_ID_KEY, value_text: OWNER }],
  sameName: [],
}

function payload() {
  const built = jobInput('plan_job', { job: { job_name: 'ZZ TEST seat walk', job_address: '123 main st', customer_id: CUSTOMER, service_type_id: SERVICE, revenue: 1 } })
  if (!built.ok) throw new Error(built.error)
  return built.p
}

describe('the stage the job verbs name', () => {
  const { stage, file } = newJobStageByMigration()
  const label = JOB_STEPPER_LABELS[stage as JobStepperStatus]

  it('is read from the migrations, and it is a stage the Pipeline has a name for', () => {
    expect(file).toMatch(/^\d{14}_/)
    expect(label).toBeTruthy()
  })

  it('is the column default because the verb, like the form, writes no status', () => {
    expect(Object.keys(newJobRow(payload(), WORLD))).not.toContain('status')
  })

  it('is the stage the plan says the row will land at', () => {
    const dry = newJobDryRun(payload(), WORLD)
    if (!dry.ok) throw new Error(dry.refused)
    const said = String((dry.reply.readiness as Record<string, string>).status)
    expect(said.startsWith(`${stage} — `)).toBe(true)
    expect(said).toContain(file.slice(0, 14))
  })

  it('is the stage the apply says the job is at, and no other stage is named as where it is', () => {
    const next = String(jobAppliedWords({ id: 'j9', job_name: 'ZZ TEST seat walk' }, { asked: null, saved: false }).next)
    expect(next).toContain(`is on the Pipeline at ${label}`)
    for (const other of Object.values(JOB_STEPPER_LABELS)) if (other !== label) expect(next).not.toContain(`at ${other}`)
  })

  it('is the stage the tool description and the README give', () => {
    expect(SERVER).toContain(`The Pipeline shows it at ${label} at once`)
    expect(README).toContain(`The job starts at ${label} (`)
  })
})
