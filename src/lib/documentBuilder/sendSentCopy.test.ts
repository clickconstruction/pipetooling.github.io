/**
 * The filed copy of a sheet's send (punch list #404): the email carries the trade's own page link, which is a key, and
 * four office roles read the filed copies. So the copy is kept as a trade email's is, with the key cut out, while the
 * sheet's own link, which is made to be handed on, stays. The function's source is read to hold the wiring. Every name
 * here is made up.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildGcTradeEmail } from '../../../supabase/functions/_shared/gcTradeEmail'
import { sentCopyKeptHtml } from '../../../supabase/functions/_shared/sentCopyEmail'
import { sentKindGroup } from '../sent/sentCopies'
import { BUILDER_SEND_SENT_KIND, SHEET_SEND_SENT_KIND, builderSendEmail, customerPageUrl, sentCopyJobIds, sheetSendEmail } from './sendWords'

const SOURCE = readFileSync(resolve(__dirname, '../../../supabase/functions/document-builder-send/index.ts'), 'utf8')

describe('the filed copy of a sheet\u2019s send', () => {
  const token = 'a'.repeat(32) + '0123456789abcdef0123456789abcdef'
  const sheetLink = 'https://app.example/d/abcdefgh23456789'
  const words = sheetSendEmail({ job: 'Cedar Park Medical Office', note: 'A made-up note.', why: 'first', sheetUrl: sheetLink })
  const { html } = buildGcTradeEmail({ lang: 'en', recipients: ['Ana Pruitt'], company: 'Cedar Fork Drain', subject: words.subject, lines: words.lines, linkUrl: `https://app.example/t/${token}`, signer: 'A made-up sender', gc: 'Made-up Construction' })

  it('would keep the trade\u2019s page key under the sheet\u2019s own kind, which has no rule', () => {
    expect(html).toContain(token)
    expect(sentCopyKeptHtml(SHEET_SEND_SENT_KIND, html)).toContain(token)
  })

  it('keeps the page link as /t/… and never the token, and keeps the sheet\u2019s own link', () => {
    const kept = sentCopyKeptHtml('gc_trade_email', html)
    expect(kept).not.toContain(token)
    expect(kept).toContain('href="https://app.example/t/\u2026"')
    expect(kept).toContain(sheetLink)
  })

  it('keeps a GC\u2019s page link out of the copy of a builder\u2019s send too: ?t=\u2026 and never the token', () => {
    const page = 'b'.repeat(64)
    const gcWords = builderSendEmail({ company: 'Made-up Plumbing', aboutJob: null, note: 'A made-up note.', why: 'first' })
    const gc = buildGcTradeEmail({ lang: 'en', recipients: ['Dana Whitlock'], company: 'Northgate Builders', subject: gcWords.subject, lines: gcWords.lines, linkUrl: customerPageUrl('https://app.example', page), signer: 'A made-up sender', gc: 'Made-up Plumbing' })
    expect(gc.html).toContain(page)
    expect(sentCopyKeptHtml(BUILDER_SEND_SENT_KIND, gc.html)).toContain(page)
    const kept = sentCopyKeptHtml('gc_trade_email', gc.html)
    expect(kept).not.toContain(page)
    expect(kept).toContain('href="https://app.example/portal?t=\u2026"')
  })

  it('is filed that way by the function', () => {
    expect(SOURCE).toContain("const SENT_COPY_KEPT_AS = 'gc_trade_email'")
    // Every copy the function files goes through the rule: none hands the email's own HTML over.
    const filings = SOURCE.split('fileSentEmailBestEffort(').slice(1)
    expect(filings.length).toBeGreaterThan(0)
    for (const call of filings) {
      const args = call.slice(0, call.indexOf('\n  )'))
      if (!args.includes('html:')) continue
      expect(args).toContain('html: sentCopyKeptHtml(SENT_COPY_KEPT_AS, email.html)')
    }
  })

  it('files both sends under Contracts and estimates, not Other', () => {
    expect(sentKindGroup(SHEET_SEND_SENT_KIND)).toBe('contracts')
    expect(sentKindGroup(BUILDER_SEND_SENT_KIND)).toBe('contracts')
  })

  it('files a copy under the job it is about, and under none when there is none', () => {
    expect(sentCopyJobIds('00000000-0000-0000-0000-0000004043f1')).toEqual(['00000000-0000-0000-0000-0000004043f1'])
    expect(sentCopyJobIds(' 00000000-0000-0000-0000-0000004043f1 ')).toEqual(['00000000-0000-0000-0000-0000004043f1'])
    expect(sentCopyJobIds(null)).toEqual([])
    expect(sentCopyJobIds(undefined)).toEqual([])
    expect(sentCopyJobIds('  ')).toEqual([])
  })

  it('has the function name the job on every copy it files, and the customer on a GC\u2019s', () => {
    const filings = SOURCE.split('fileSentEmailBestEffort(').slice(1).map((call) => call.slice(0, call.indexOf('\n  )')))
    expect(filings).toHaveLength(2)
    for (const args of filings) expect(args).toContain('jobIds: sentCopyJobIds(')
    const [sheet, builder] = filings as [string, string]
    expect(sheet).toContain('kind: SHEET_SEND_SENT_KIND')
    expect(sheet).toContain('billing_job_id')
    expect(builder).toContain('kind: BUILDER_SEND_SENT_KIND')
    expect(builder).toContain('jobIds: sentCopyJobIds(aboutJobId)')
    expect(builder).toContain('customerId: m.customerId')
    // The project's billing job is read with the project, in the one read that was already there.
    expect(SOURCE).toContain(".select('project_manager_user_id, billing_job_id')")
  })
})
