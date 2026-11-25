/**
 * A signing link for a job's paper built from settings (punch list #389, step 3). Such a paper has no body, form or
 * link of its own: its words are the Contract Book's clauses, put together for the job's picks. The two functions that
 * hand out a signing link refused it as a paper with nothing to sign, which the first walk on prod found. The kernel is
 * `jobPaperBuiltFromSettings` beside `hasSigningContent`; the last block holds both handlers to asking it.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  hasSigningContent,
  jobPaperBuiltFromSettings,
  signingDocRefusal,
  withJobPaperSettings,
  type JobPaperSettingsReader,
  type SigningDoc,
} from '../../supabase/functions/_shared/contractSigningSend'

const NOTHING_TO_SIGN = { status: 400, error: 'Add contract text, a canonical document URL, or a reference link before sending for signature.' }
const bare = (over: Partial<SigningDoc & { job_required_paper_id: string | null }> = {}) => ({
  status: 'unsent',
  signing_body_html: null,
  canonical_document_url: null,
  url: null,
  form_template_id: null,
  ...over,
})

/** A reader that answers one row and keeps what it was asked. */
function reader(answer: { data: unknown; error: unknown }) {
  const asked: Array<{ table: string; columns: string; column: string; value: string }> = []
  const admin: JobPaperSettingsReader = {
    from: (table) => ({
      select: (columns) => ({
        eq: (column, value) => ({
          maybeSingle: async () => {
            asked.push({ table, columns, column, value })
            return answer
          },
        }),
      }),
    }),
  }
  return { admin, asked }
}

describe('hasSigningContent, a job’s paper built from settings', () => {
  it('has something to sign when the job’s row carries settings', () => {
    expect(hasSigningContent(bare({ built_from_settings: true }))).toBe(true)
    expect(signingDocRefusal(bare({ built_from_settings: true }))).toBeNull()
  })

  it('refuses a bare paper as before when it does not', () => {
    expect(hasSigningContent(bare())).toBe(false)
    expect(hasSigningContent(bare({ built_from_settings: false }))).toBe(false)
    expect(hasSigningContent(bare({ built_from_settings: null }))).toBe(false)
    expect(signingDocRefusal(bare({ built_from_settings: false }))).toEqual(NOTHING_TO_SIGN)
  })

  it('keeps the order: a signed paper is refused as signed, and a status that is not sendable as that', () => {
    expect(signingDocRefusal(bare({ status: 'signed', built_from_settings: true }))).toEqual({ status: 400, error: 'This document is already signed' })
    expect(signingDocRefusal(bare({ status: 'void', built_from_settings: true }))).toEqual({ status: 400, error: 'Invalid status for sending' })
  })
})

describe('jobPaperBuiltFromSettings', () => {
  it('reads the one row by its id, and only its settings', async () => {
    const { admin, asked } = reader({ data: { settings: { photos: 'standard' } }, error: null })
    expect(await jobPaperBuiltFromSettings(admin, 'r1')).toBe(true)
    expect(asked).toEqual([{ table: 'job_required_papers', columns: 'settings', column: 'id', value: 'r1' }])
  })

  it('says no for a plain required paper, a row that is gone, and settings that are not a set of picks', async () => {
    expect(await jobPaperBuiltFromSettings(reader({ data: { settings: null }, error: null }).admin, 'r1')).toBe(false)
    expect(await jobPaperBuiltFromSettings(reader({ data: null, error: null }).admin, 'r1')).toBe(false)
    expect(await jobPaperBuiltFromSettings(reader({ data: { settings: [] }, error: null }).admin, 'r1')).toBe(false)
    expect(await jobPaperBuiltFromSettings(reader({ data: { settings: 'standard' }, error: null }).admin, 'r1')).toBe(false)
  })

  it('reads nothing for a copy that names no job', async () => {
    const { admin, asked } = reader({ data: { settings: {} }, error: null })
    expect(await jobPaperBuiltFromSettings(admin, null)).toBe(false)
    expect(await jobPaperBuiltFromSettings(admin, undefined)).toBe(false)
    expect(await jobPaperBuiltFromSettings(admin, '')).toBe(false)
    expect(asked).toEqual([])
  })

  it('throws when the read fails, so the office is never told to add a body', async () => {
    const failed = { message: 'timeout' }
    await expect(jobPaperBuiltFromSettings(reader({ data: null, error: failed }).admin, 'r1')).rejects.toBe(failed)
  })
})

describe('withJobPaperSettings', () => {
  it('asks only for a copy with nothing else to sign', async () => {
    for (const doc of [
      bare({ job_required_paper_id: 'r1', signing_body_html: '<p>Words</p>' }),
      bare({ job_required_paper_id: 'r1', canonical_document_url: 'https://x' }),
      bare({ job_required_paper_id: 'r1', url: 'https://x' }),
      bare({ job_required_paper_id: 'r1', form_template_id: 'f1' }),
      bare({ job_required_paper_id: null }),
      bare(),
    ]) {
      const { admin, asked } = reader({ data: { settings: { photos: 'standard' } }, error: null })
      expect(await withJobPaperSettings(admin, doc)).toBe(doc)
      expect(asked).toEqual([])
    }
  })

  it('lets a job’s settings paper out, and still refuses a job’s copy whose row carries none', async () => {
    const doc = bare({ job_required_paper_id: 'r1' })
    const yes = await withJobPaperSettings(reader({ data: { settings: { photos: 'standard' } }, error: null }).admin, doc)
    expect(yes.built_from_settings).toBe(true)
    expect(signingDocRefusal(yes)).toBeNull()
    const no = await withJobPaperSettings(reader({ data: { settings: null }, error: null }).admin, doc)
    expect(no.built_from_settings).toBe(false)
    expect(signingDocRefusal(no)).toEqual(NOTHING_TO_SIGN)
  })
})

describe('the two functions that hand out a signing link, and the one that reminds', () => {
  const read = (name: string) => readFileSync(resolve(__dirname, `../../supabase/functions/${name}/index.ts`), 'utf8')

  it('send-contract-for-signature reads the job the copy names and asks before it refuses', () => {
    const source = read('send-contract-for-signature')
    const personPath = source.slice(source.indexOf('if (body.trade_email !== undefined)'))
    expect(personPath).toMatch(/\.select\('[^']*\bjob_required_paper_id\b[^']*'\)/)
    expect(personPath).toContain('signingDocRefusal(await withJobPaperSettings(')
    // The company branch sends a company's paper, never a job's: it is as main has it.
    const companyPath = source.slice(0, source.indexOf('if (body.trade_email !== undefined)'))
    expect(companyPath).toContain('signingDocRefusal(doc)')
    expect(companyPath).not.toContain('withJobPaperSettings(')
  })

  it('get-contract-signing-link-for-self asks before it refuses, after it has said whose paper it is', () => {
    const source = read('get-contract-signing-link-for-self')
    const ask = source.indexOf('!hasSigningContent(doc) && !(await jobPaperBuiltFromSettings(')
    expect(ask).toBeGreaterThan(-1)
    expect(source.indexOf('This paper was made for someone else.')).toBeLessThan(ask)
    expect(source.indexOf('This paper was made for someone else.')).toBeGreaterThan(-1)
  })

  it('remind-person-papers asks the job’s row before it holds a paper as one with nothing to sign', () => {
    // Punch list #376, call 1: a job's paper built from settings took a first reminder date at its send, and the
    // hourly run then held it as a paper with nothing to sign and cleared the date. It asks as the send asks.
    const source = read('remind-person-papers')
    expect(source).toMatch(/const DUE_COLUMNS =\s*'[^']*\bjob_required_paper_id\b[^']*'/)
    const ask = source.indexOf('!hasSigningContent(await withJobPaperSettings(')
    expect(ask).toBeGreaterThan(-1)
    expect(source).not.toContain('!hasSigningContent(c)')
    // The hold comes from the ask alone, and a read that fails is named and left for the next hour, never held.
    expect(source.indexOf("hold = 'nothing_to_sign'")).toBeGreaterThan(ask)
    expect(source.split("hold = 'nothing_to_sign'")).toHaveLength(2)
    const afterAsk = source.slice(ask, source.indexOf('if (hold) {'))
    expect(afterAsk).toMatch(/catch \(e\) \{\s*failed\.push\([^\n]*\n\s*continue/)
  })
})
