import { describe, expect, it } from 'vitest'
import type { Database } from '../types/database'
import {
  buildJobsLedgerFullDetailSelect,
  buildJobsListStagesPrimarySelect,
  JOBS_LEDGER_FIXTURES_EMBED,
  JOBS_LEDGER_INVOICES_EMBED,
  JOBS_LEDGER_MATERIALS_EMBED,
  JOBS_LEDGER_PAYMENTS_EMBED,
  JOBS_LEDGER_TEAM_MEMBERS_EMBED,
} from './jobsLedgerEmbedSelects'

/**
 * The explicit child-column lists under every `jobs_ledger` list and detail
 * fetch. `JobWithDetails` types each embedded child as the full DB Row, so a
 * column the embed leaves out is `undefined` at runtime with no type error —
 * the Split Bill modal's `stripe_mode` branch was dead for a month that way.
 * This suite makes the opt-in explicit: every embedded name must be a real
 * column (tsc), and every column NOT embedded must be listed here on purpose
 * (tsc again — a new DB column fails the build until someone decides).
 */
type Tables = Database['public']['Tables']
type Row<T extends keyof Tables> = Tables[T]['Row']
/** Compiles only when `T` is `never` — i.e. every Row column is either embedded or listed as omitted. */
const coversEveryColumn = <T extends never>(..._missing: T[]): boolean => true
type Missing<T extends keyof Tables, Covered extends string> = Exclude<keyof Row<T>, Covered>

const INVOICE_COLS = ['agreed_write_down_at', 'agreed_write_down_previous_amount', 'amount', 'bill_to_email', 'bill_to_name', 'bill_to_party', 'bill_to_phone', 'bill_to_stripe_customer_id', 'billed_at', 'copy_emails', 'created_at', 'estimated_bill_date', 'external_send_channel', 'external_send_note', 'hosted_invoice_url', 'id', 'is_primary_rtb_bundle', 'job_id', 'sent_to_customer_at', 'sequence_order', 'status', 'stripe_invoice_footer', 'stripe_invoice_id', 'stripe_invoice_memo', 'stripe_invoice_status', 'stripe_mode'] as const satisfies ReadonlyArray<keyof Row<'jobs_ledger_invoices'>>
/** Deliberately not embedded: only the Dashboard billing units read these, through their own select. */
const INVOICE_OMITTED = ['agreed_write_down_by', 'agreed_write_down_note', 'agreed_write_down_stripe_credit_note_id'] as const satisfies ReadonlyArray<keyof Row<'jobs_ledger_invoices'>>

const PAYMENT_COLS = ['amount', 'created_at', 'id', 'invoice_id', 'job_id', 'mercury_transaction_id', 'note', 'paid_on', 'payment_type', 'reference_number', 'sent_on', 'sequence_order'] as const satisfies ReadonlyArray<keyof Row<'jobs_ledger_payments'>>

const MATERIAL_COLS = ['amount', 'created_at', 'description', 'id', 'job_id', 'sequence_order'] as const satisfies ReadonlyArray<keyof Row<'jobs_ledger_materials'>>
/** Deliberately not embedded: the Plug-in Quotes memory writes it and never reads it back off a job. */
const MATERIAL_OMITTED = ['source_bid_id'] as const satisfies ReadonlyArray<keyof Row<'jobs_ledger_materials'>>

const FIXTURE_COLS = ['bill_to_party', 'count', 'created_at', 'discount_basis_positions', 'discount_pct', 'discount_reason', 'id', 'invoice_id', 'job_id', 'line_description', 'line_kind', 'line_unit_price', 'name', 'progress_at', 'progress_by', 'progress_pct', 'progress_report_id', 'sequence_order', 'shared_with_gc', 'stage_kind'] as const satisfies ReadonlyArray<keyof Row<'jobs_ledger_fixtures'>>

const TEAM_MEMBER_COLS = ['created_at', 'id', 'job_id', 'user_id'] as const satisfies ReadonlyArray<keyof Row<'jobs_ledger_team_members'>>

const cols = (embed: string) => embed.split(',').map((c) => c.trim())
const embedsIn = (select: string) => [...select.matchAll(/([a-z_]+)(?::[a-z_]+)?\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g)].map((m) => [m[1]!, m[2]!.replace(/\s+/g, ' ').trim()] as const)

describe('child embeds', () => {
  it('each embed is exactly its sorted, deduplicated column list — every name a real column, every omission deliberate (both enforced by tsc)', () => {
    expect(coversEveryColumn<Missing<'jobs_ledger_invoices', (typeof INVOICE_COLS)[number] | (typeof INVOICE_OMITTED)[number]>>()).toBe(true)
    expect(coversEveryColumn<Missing<'jobs_ledger_payments', (typeof PAYMENT_COLS)[number]>>()).toBe(true)
    expect(coversEveryColumn<Missing<'jobs_ledger_materials', (typeof MATERIAL_COLS)[number] | (typeof MATERIAL_OMITTED)[number]>>()).toBe(true)
    expect(coversEveryColumn<Missing<'jobs_ledger_fixtures', (typeof FIXTURE_COLS)[number]>>()).toBe(true)
    expect(coversEveryColumn<Missing<'jobs_ledger_team_members', (typeof TEAM_MEMBER_COLS)[number]>>()).toBe(true)
    expect(cols(JOBS_LEDGER_INVOICES_EMBED)).toEqual([...INVOICE_COLS])
    expect(cols(JOBS_LEDGER_PAYMENTS_EMBED)).toEqual([...PAYMENT_COLS])
    expect(cols(JOBS_LEDGER_MATERIALS_EMBED)).toEqual([...MATERIAL_COLS])
    expect(cols(JOBS_LEDGER_FIXTURES_EMBED)).toEqual([...FIXTURE_COLS])
    expect(cols(JOBS_LEDGER_TEAM_MEMBERS_EMBED)).toEqual([...TEAM_MEMBER_COLS, 'users(name)'])
    for (const e of [JOBS_LEDGER_INVOICES_EMBED, JOBS_LEDGER_PAYMENTS_EMBED, JOBS_LEDGER_MATERIALS_EMBED, JOBS_LEDGER_FIXTURES_EMBED]) {
      const c = cols(e)
      expect(c, e).toEqual([...c].sort())
      expect(new Set(c).size).toBe(c.length)
      expect(c).not.toContain('*')
    }
    for (const omitted of [...INVOICE_OMITTED]) expect(cols(JOBS_LEDGER_INVOICES_EMBED)).not.toContain(omitted)
    for (const omitted of [...MATERIAL_OMITTED]) expect(cols(JOBS_LEDGER_MATERIALS_EMBED)).not.toContain(omitted)
  })

  it('the invoices embed carries stripe_mode so the Split Bill modal voids under the bill’s recorded mode, not the role default', () => {
    expect(cols(JOBS_LEDGER_INVOICES_EMBED)).toContain('stripe_mode')
  })
})

describe('buildJobsListStagesPrimarySelect (Stages list)', () => {
  it('embeds invoices, payments and team members with the explicit lists, never materials or fixtures (batch-loaded later), plus the lean lookups', () => {
    const select = buildJobsListStagesPrimarySelect()
    const embeds = new Map(embedsIn(select))
    expect(select.trim().startsWith('*,')).toBe(true)
    expect(embeds.get('jobs_ledger_invoices')).toBe(JOBS_LEDGER_INVOICES_EMBED)
    expect(embeds.get('jobs_ledger_payments')).toBe(JOBS_LEDGER_PAYMENTS_EMBED)
    expect(embeds.get('jobs_ledger_team_members')).toBe(JOBS_LEDGER_TEAM_MEMBERS_EMBED)
    expect(select).not.toContain('jobs_ledger_materials')
    expect(select).not.toContain('jobs_ledger_fixtures')
    expect(embeds.get('reports')).toBe('job_ledger_id')
    expect(embeds.get('projects')).toBe('id, name')
    expect(embeds.get('bids')).toBe('id, project_name, bid_number, service_type_id')
    expect(embeds.get('gc_customer')).toBe('id, name')
    expect(embeds.get('development')).toBe('id, name')
    expect(embeds.get('account_manager')).toBe('id, name')
    expect(embeds.get('service_types')).toBe('name')
    expect(select).not.toMatch(/\(\*\)/)
  })
})

describe('buildJobsLedgerFullDetailSelect (single job)', () => {
  it('adds materials and fixtures, the newest-report meta, and the bid’s own GC for the "Use bid’s GC" chip; no child uses (*)', () => {
    const select = buildJobsLedgerFullDetailSelect()
    const embeds = new Map(embedsIn(select))
    expect(select.trim().startsWith('*,')).toBe(true)
    expect(embeds.get('jobs_ledger_materials')).toBe(JOBS_LEDGER_MATERIALS_EMBED)
    expect(embeds.get('jobs_ledger_fixtures')).toBe(JOBS_LEDGER_FIXTURES_EMBED)
    expect(embeds.get('jobs_ledger_payments')).toBe(JOBS_LEDGER_PAYMENTS_EMBED)
    expect(embeds.get('jobs_ledger_invoices')).toBe(JOBS_LEDGER_INVOICES_EMBED)
    expect(embeds.get('jobs_ledger_team_members')).toBe(JOBS_LEDGER_TEAM_MEMBERS_EMBED)
    expect(embeds.get('reports')).toBe('job_ledger_id, created_at, users:created_by_user_id(name), report_templates:template_id(name)')
    expect(embeds.get('bids')).toBe('id, project_name, bid_number, service_type_id, customer_id, customers:customer_id(id, name)')
    expect(embeds.get('gc_customer')).toBe('id, name')
    expect(select).not.toMatch(/\(\*\)/)
  })

  it('the list select is a strict subset of the detail select’s children', () => {
    const list = new Map(embedsIn(buildJobsListStagesPrimarySelect()))
    const detail = new Map(embedsIn(buildJobsLedgerFullDetailSelect()))
    for (const k of list.keys()) expect(detail.has(k), k).toBe(true)
    expect([...detail.keys()].filter((k) => !list.has(k)).sort()).toEqual(['jobs_ledger_fixtures', 'jobs_ledger_materials'])
  })
})
