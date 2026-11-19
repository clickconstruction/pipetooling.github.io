/**
 * Add discount on a job billed from the GC desk (v2.7862): the words Bill Customer shows in the press's place are
 * the function's own refusal, word for word, and no other job is told anything.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { GC_BILLING_JOB_DISCOUNT_WORDS, gcBillingJobDiscountWords } from './gcBillingJobDiscount'

describe('gcBillingJobDiscountWords', () => {
  it('says why on a GC billing job, and nothing on any other job', () => {
    expect(gcBillingJobDiscountWords(true)).toBe(GC_BILLING_JOB_DISCOUNT_WORDS)
    expect(gcBillingJobDiscountWords(false)).toBeNull()
  })

  it('names the desk and the change order', () => {
    expect(GC_BILLING_JOB_DISCOUNT_WORDS).toContain('Owner Billing on the GC desk')
    expect(GC_BILLING_JOB_DISCOUNT_WORDS).toContain('signed change order')
  })

  it('is the refusal apply_job_discount raises, word for word', () => {
    const sql = readFileSync('supabase/migrations/20261118223000_discount_refuses_gc_billing_job.sql', 'utf8')
    expect(sql).toContain(`raise exception '${GC_BILLING_JOB_DISCOUNT_WORDS}' using errcode = '22023';`)
    // The check comes before the line is written.
    expect(sql.indexOf('g.billing_job_id = p_job_id')).toBeGreaterThan(0)
    expect(sql.indexOf('g.billing_job_id = p_job_id')).toBeLessThan(sql.indexOf('insert into public.jobs_ledger_fixtures'))
  })
})
