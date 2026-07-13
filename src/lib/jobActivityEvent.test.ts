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
  })
})
