/**
 * Hire (People spine PR 3, v2.3701): one form, one ordered run — the person row (or the invite
 * that creates it, born linked), the pay row, the workday template for a salaried hire, the
 * paperwork packet. `hirePlan` is the pure part: which steps this hire needs, in order, and what
 * stops it before anything is written. The writes are one function each so the modal can show a
 * result per step and offer Retry on the one that failed — there is no transaction across an
 * edge function and four tables, and the form says so.
 *
 * No new permission: the invite is `invite-user` (dev), the roster row is the Users tab's own
 * insert, the pay row is the desk's upsert, the template is the salaried-workday editor's upsert,
 * the packet is `materializePacketForPerson`.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { FunctionsHttpError } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import type { PersonKind } from '../../hooks/usePeopleRoster'
import { KIND_LABELS, KIND_TO_USER_ROLE } from '../../components/people/peopleUsersTabShared'
import { syncSalaryClockSessionsForUserDay, denverWorkDateToday } from '../salaryScheduleSync'
import { materializePacketForPerson, type PacketPersonDoc, type PacketTemplateDoc } from './materializePacket'

type Client = SupabaseClient<Database>

export type HireInput = {
  name: string
  kind: PersonKind
  /** Empty = roster only (no login). */
  email: string
  /** Send the invite that makes the login (dev only — `invite-user`). */
  invite: boolean
  startInTraining: boolean
  startDate: string
  hourlyWage: number | null
  isSalary: boolean
  /** HH:MM local, the salaried 8-hour day's start. */
  workdayStart: string
  packetTemplateId: string | null
}

export type HireCaps = { canInvite: boolean; canAccessPay: boolean; canAccessContracts: boolean }

export type HireStepId = 'account' | 'roster' | 'pay' | 'workday' | 'packet'
export type HireStep = { id: HireStepId; label: string; detail: string }

/** Roles that are never paid through the pay tables (personKey's NO_PAY set). */
const NO_PAY_KINDS = new Set<PersonKind>(['primary'])

export function hirePlan(input: HireInput, caps: HireCaps): { steps: HireStep[]; problems: string[] } {
  const problems: string[] = []
  const name = input.name.trim()
  const email = input.email.trim().toLowerCase()
  if (!name) problems.push('A name is required.')
  if (input.invite && !email) problems.push('An email is required to send an invite.')
  if (input.invite && !caps.canInvite) problems.push('Only a dev can send the invite — add them to the roster now and ask a dev to invite them.')
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) problems.push('That email does not look right.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startDate)) problems.push('Pick a start date.')
  const paid = !NO_PAY_KINDS.has(input.kind)
  if (paid && caps.canAccessPay && (input.hourlyWage == null || !(input.hourlyWage > 0))) {
    problems.push(input.isSalary ? 'A salaried hire needs the hourly rate the flat 8-hour day is priced at.' : 'An hourly wage is required — a pay row with no wage cannot be paid.')
  }
  if (input.isSalary && !input.invite) problems.push('A salaried hire needs a login: the workday template belongs to the account.')
  if (input.isSalary && !/^\d{2}:\d{2}$/.test(input.workdayStart)) problems.push('Pick the workday start time.')

  const steps: HireStep[] = []
  const kindLabel = KIND_LABELS[input.kind]
  if (input.invite) steps.push({ id: 'account', label: 'Invite', detail: `${email || 'their email'} as ${kindLabel} — the login and the roster row, linked` })
  else steps.push({ id: 'roster', label: 'Roster row', detail: `${name || 'the person'} as ${kindLabel}, starting ${input.startDate}` })
  if (paid && caps.canAccessPay) {
    steps.push({
      id: 'pay',
      label: 'Pay',
      detail: input.isSalary ? `Salaried at $${(input.hourlyWage ?? 0).toFixed(2)}/h (the flat 8-hour day)` : `$${(input.hourlyWage ?? 0).toFixed(2)}/h`,
    })
  }
  if (input.isSalary && input.invite) steps.push({ id: 'workday', label: 'Workday', detail: `8 hours from ${input.workdayStart}, weekdays — sessions appear on the clock strip by themselves` })
  if (input.packetTemplateId && caps.canAccessContracts) steps.push({ id: 'packet', label: 'Paperwork', detail: 'The packet is assigned; send each document from Contracts' })
  return { steps, problems }
}

/** A person or account already carrying this exact name — the pay tables are name-keyed, so a second one would share their pay. */
export async function findNameCollision(supabase: Client, name: string): Promise<{ where: 'account' | 'roster'; id: string } | null> {
  const n = name.trim()
  if (!n) return null
  const [{ data: u }, { data: p }] = await Promise.all([
    supabase.from('users').select('id').is('archived_at', null).eq('name', n).limit(1),
    supabase.from('people').select('id').is('archived_at', null).eq('name', n).limit(1),
  ])
  const user = (u ?? [])[0] as { id: string } | undefined
  if (user) return { where: 'account', id: user.id }
  const person = (p ?? [])[0] as { id: string } | undefined
  if (person) return { where: 'roster', id: person.id }
  return null
}

async function fnErrorMessage(e: unknown): Promise<string> {
  if (e instanceof FunctionsHttpError && e.context) {
    try {
      const b = (await e.context.json()) as { error?: string } | null
      if (b?.error) return b.error
    } catch {
      /* fall through */
    }
  }
  return e instanceof Error ? e.message : 'That did not save'
}

/** `invite-user`: the login, the emailed link, and (v2.3701) the linked roster row. */
export async function inviteHire(
  supabase: Client,
  args: { email: string; kind: PersonKind; name: string; startInTraining: boolean; startDate: string; redirectTo: string },
): Promise<{ userId: string | null; personId: string | null }> {
  try {
    const { data, error } = await supabase.functions.invoke('invite-user', {
      body: { email: args.email.trim().toLowerCase(), role: KIND_TO_USER_ROLE[args.kind], name: args.name.trim(), read_only: args.startInTraining, start_date: args.startDate, redirectTo: args.redirectTo },
    })
    if (error) throw error
    const body = data as { error?: string; user_id?: string; person_id?: string | null } | null
    if (body?.error) throw new Error(body.error)
    return { userId: body?.user_id ?? null, personId: body?.person_id ?? null }
  } catch (e) {
    throw new Error(await fnErrorMessage(e))
  }
}

/** The roster row on its own (no login), or the one a pre-v2.3701 invite did not make. */
export async function createRosterRow(
  supabase: Client,
  args: { masterUserId: string; kind: PersonKind; name: string; email: string | null; accountUserId: string | null; startDate: string | null },
): Promise<string> {
  const { data, error } = await supabase
    .from('people')
    .insert({ master_user_id: args.masterUserId, kind: args.kind, name: args.name.trim(), email: args.email?.trim().toLowerCase() || null, account_user_id: args.accountUserId, start_date: args.startDate })
    .select('id')
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Could not create the roster row')
  return (data as { id: string }).id
}

/** The pay row, keyed by the pay name (the account name, else the roster name — the same string for a hire). */
export async function upsertPayConfigRow(
  supabase: Client,
  args: { payName: string; personId: string | null; hourlyWage: number | null; officeWage: number | null; isSalary: boolean; recordHoursButSalary: boolean },
): Promise<void> {
  const { error } = await supabase
    .from('people_pay_config')
    .upsert(
      { person_name: args.payName.trim(), person_id: args.personId, hourly_wage: args.hourlyWage, office_hourly_wage: args.officeWage, is_salary: args.isSalary, record_hours_but_salary: args.recordHoursButSalary },
      { onConflict: 'person_name' },
    )
  if (error) throw new Error(error.message)
}

function toPgTime(hhmm: string): string {
  return hhmm.length === 5 ? `${hhmm}:00` : hhmm
}

/** The salaried workday template — one continuous 8-hour block from `startLocal`, weekdays — and today's sessions. */
export async function saveSalaryTemplate(
  supabase: Client,
  args: { userId: string; startLocal: string; timezone: string; excludeWeekends?: boolean },
): Promise<void> {
  const { error } = await supabase.from('salary_work_schedule_templates').upsert(
    {
      user_id: args.userId,
      timezone: args.timezone,
      exclude_weekends: args.excludeWeekends ?? true,
      mode: 'continuous',
      segment_a_start_local: toPgTime(args.startLocal),
      segment_a_duration_minutes: 480,
      segment_b_start_local: null,
      segment_b_duration_minutes: null,
      use_split_focus: false,
      job_ledger_id: null,
      bid_id: null,
      segment_b_job_ledger_id: null,
      segment_b_bid_id: null,
    },
    { onConflict: 'user_id' },
  )
  if (error) throw new Error(error.message)
  const sync = await syncSalaryClockSessionsForUserDay(args.userId, denverWorkDateToday())
  if (sync.error) throw new Error(sync.error)
}

/** Assign a packet by name — loads what `materializePacketForPerson` needs, then writes through it. */
export async function assignPacketToPerson(supabase: Client, args: { payName: string; templateId: string }): Promise<void> {
  const name = args.payName.trim()
  const [{ data: td }, { data: pd }] = await Promise.all([
    supabase.from('contract_template_documents').select('id, template_id, document_name, book_body_html, book_body_format, canonical_document_url').eq('template_id', args.templateId),
    supabase.from('person_contract_documents').select('id, person_name, document_name, signing_body_html, lineage_version').eq('person_name', name),
  ])
  await materializePacketForPerson({
    personName: name,
    templateId: args.templateId,
    templateDocs: (td ?? []) as PacketTemplateDoc[],
    personDocs: ((pd ?? []) as Array<{ id: string; person_name: string; document_name: string; signing_body_html: string | null; lineage_version: number | null }>).map((d) => ({ ...d, lineage_version: d.lineage_version ?? 1 })) as PacketPersonDoc[],
  })
}
