import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  JOB_ACTIVITY_EVENT_RENDER,
  bucketForEvent,
  eventRenderMeta,
  type JobActivityEventType,
} from './jobActivityEvent'

const ALL_TYPES: JobActivityEventType[] = [
  'status_change',
  'payment_added',
  'payment_removed',
  'invoice_created',
  'invoice_billed',
  'invoice_sent',
  'invoice_write_down',
  'invoice_stripe_email_sent',
  'crew_added',
  'crew_removed',
  'material_added',
  'fixture_added',
  'field_edited',
  'job_combined',
  'job_separated',
  'collections_change',
  'completeness_marked',
  'progress_updated',
  'lien_release_issued',
  'lien_release_signature_requested',
  'lien_release_signed',
  'lien_release_sent',
  'lien_release_voided',
  'contract_sent',
  'contract_viewed',
  'contract_signed',
  'contract_voided',
  'contract_shared',
  'contract_reminded',
  'demand_letter_sent',
  'lien_notice_sent',
  'invoice_resent',
  'sub_stage_change',
  'sub_progress',
  'job_auto_created_from_estimate',
  'job_renamed_from_work',
  'job_created',
  'discount_added',
  'discount_changed',
  'discount_removed',
  'payment_promise',
  'running_late',
  'hazmat_fee_edited',
  'hazmat_fee_voided',
  'hazmat_fee_deleted',
  'hazmat_notice_emailed',
]

describe('JOB_ACTIVITY_EVENT_RENDER', () => {
  it('has render meta for every event type with a non-empty tag and valid bucket', () => {
    for (const t of ALL_TYPES) {
      const meta = eventRenderMeta(t)
      expect(meta, `missing render meta for ${t}`).toBeTruthy()
      expect(meta.tag.length).toBeGreaterThan(0)
      expect(['status', 'billing', 'crew', 'other']).toContain(meta.bucket)
      expect(meta.tagColor).toMatch(/^#/)
      expect(meta.borderColor).toMatch(/^(#|var\()/)
    }
  })

  it('has no extra keys beyond the known event types', () => {
    expect(Object.keys(JOB_ACTIVITY_EVENT_RENDER).sort()).toEqual([...ALL_TYPES].sort())
  })

  it('buckets payments/invoices as billing, status as status, crew as crew', () => {
    expect(bucketForEvent('status_change')).toBe('status')
    expect(bucketForEvent('payment_added')).toBe('billing')
    expect(bucketForEvent('invoice_sent')).toBe('billing')
    expect(bucketForEvent('crew_added')).toBe('crew')
    expect(bucketForEvent('field_edited')).toBe('other')
    expect(bucketForEvent('collections_change')).toBe('billing')
    expect(bucketForEvent('completeness_marked')).toBe('status')
    expect(bucketForEvent('progress_updated')).toBe('status')
    expect(bucketForEvent('lien_release_issued')).toBe('billing')
    expect(bucketForEvent('lien_release_signed')).toBe('billing')
    expect(bucketForEvent('job_created')).toBe('status')
    expect(eventRenderMeta('job_created').tag).toBe('Opened')
  })

  it('files the customer sends of v2.5636 under Billing with their own tags', () => {
    expect(bucketForEvent('contract_reminded')).toBe('billing')
    expect(bucketForEvent('demand_letter_sent')).toBe('billing')
    expect(bucketForEvent('lien_notice_sent')).toBe('billing')
    expect(bucketForEvent('invoice_resent')).toBe('billing')
    expect(eventRenderMeta('contract_reminded').tag).toBe('Contract')
    expect(eventRenderMeta('demand_letter_sent').tag).toBe('Demand')
    expect(eventRenderMeta('lien_notice_sent').tag).toBe('Lien notice')
    expect(eventRenderMeta('invoice_resent').tag).toBe('Resent')
  })
})

describe('the hazmat fee and its notice (v2.5635)', () => {
  it('shows the fee’s edit, void and delete and the notice email under Billing', () => {
    expect(eventRenderMeta('hazmat_notice_emailed')).toMatchObject({ tag: 'Emailed', bucket: 'billing' })
    expect(eventRenderMeta('hazmat_notice_emailed').tagColor).toBe(eventRenderMeta('invoice_stripe_email_sent').tagColor)
    expect(eventRenderMeta('hazmat_fee_edited')).toMatchObject({ tag: 'Hazmat', bucket: 'billing' })
    expect(eventRenderMeta('hazmat_fee_voided')).toMatchObject({ tag: 'Hazmat', bucket: 'billing' })
    expect(eventRenderMeta('hazmat_fee_deleted')).toMatchObject({ tag: 'Hazmat', bucket: 'billing' })
  })

  it('knows every type the notice email and the fee’s RPCs write, word for word', () => {
    const root = resolve(__dirname, '../..')
    const edge = readFileSync(resolve(root, 'supabase/functions/send-hazmat-notice-email/index.ts'), 'utf8')
    const sql = readFileSync(resolve(root, 'supabase/migrations/20260728025542_hazmat_fee_edit_void_delete.sql'), 'utf8')
    const written = [...edge.matchAll(/event_type: '([a-z_]+)'/g), ...sql.matchAll(/'(hazmat_fee_[a-z]+)'/g)].map((m) => m[1]!)
    expect([...new Set(written)].sort()).toEqual(['hazmat_fee_deleted', 'hazmat_fee_edited', 'hazmat_fee_voided', 'hazmat_notice_emailed'])
    for (const t of written) expect(JOB_ACTIVITY_EVENT_RENDER, t).toHaveProperty(t)
  })
})
