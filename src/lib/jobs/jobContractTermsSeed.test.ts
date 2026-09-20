/**
 * The seeded Contract Book document is the built-in wording, word for word (v2.3642). The
 * migration cannot import the constant, so this holds the two together: change one without the
 * other and an office with no customer document would send different terms from one that has the seed.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DEFAULT_JOB_CONTRACT_TERMS_PLAIN } from './jobContractDocument'

describe('20260920190000_seed_customer_standard_terms.sql', () => {
  const sql = readFileSync(join(process.cwd(), 'supabase/migrations/20260920190000_seed_customer_standard_terms.sql'), 'utf8')
  it('seeds exactly the built-in terms', () => {
    const seeded = sql.match(/\$terms\$([\s\S]*?)\$terms\$/)?.[1]
    expect(seeded).toBe(DEFAULT_JOB_CONTRACT_TERMS_PLAIN)
  })
  it('never overwrites an office that already has a customer document', () => {
    expect(sql).toContain("IF EXISTS (SELECT 1 FROM public.contract_template_documents WHERE audience = 'customer') THEN\n    RETURN;")
  })
})
