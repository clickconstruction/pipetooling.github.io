import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { EMAIL_CATALOG, EMAIL_CATALOG_GROUP_LABELS, emailCatalogByGroup } from './emailCatalog'

describe('EMAIL_CATALOG', () => {
  it('ids are unique, snake_case, and non-empty', () => {
    const ids = EMAIL_CATALOG.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z][a-z0-9_]+$/)
  })

  it('every group used has a label, and every label group has rows', () => {
    for (const e of EMAIL_CATALOG) expect(EMAIL_CATALOG_GROUP_LABELS[e.group]).toBeTruthy()
    for (const g of Object.keys(EMAIL_CATALOG_GROUP_LABELS) as (keyof typeof EMAIL_CATALOG_GROUP_LABELS)[]) {
      expect(emailCatalogByGroup(g).length, `group ${g} has no rows`).toBeGreaterThan(0)
    }
  })

  it('templates-editable rows name at least one template type; workflow row carries all 11', () => {
    for (const e of EMAIL_CATALOG) {
      if (e.editable.kind === 'templates') expect(e.editable.templateTypes.length).toBeGreaterThan(0)
    }
    const wf = EMAIL_CATALOG.find((e) => e.id === 'workflow_notifications')!
    expect(wf.editable.kind).toBe('templates')
    // The § 53.056 notice email registers under the lien group with its
    // edge-fn sender; wording stays hardcoded until the wording plan reaches it.
    const notice = EMAIL_CATALOG.find((e) => e.id === 'lien_filing_notice')!
    expect(notice.group).toBe('lien')
    expect(notice.sender).toBe('send-lien-filing-email')
    expect(notice.editable.kind).toBe('hardcoded')
    if (wf.editable.kind === 'templates') expect(wf.editable.templateTypes).toHaveLength(11)
  })

  it('covers the full inventory: 49 rows, every sender named, no blank subjects', () => {
    // 33 composition paths from the 2026-09-02 inventory, folded: the 11
    // workflow templates ride one aggregate row, pure variants (resends,
    // reminders, [TEST] twins) ride their parent row. +1 (v2.2664): the
    // § 53.056 notice email (send-lien-filing-email) the inventory missed.
    // +1 (v2.2743): the Signed agreements staff notice (accept-estimate · sign-bid-room).
    // +1 (v2.3359): the copy of a Stripe bill (send-stripe-invoice, one per address on copy_emails).
    // +1 (v2.3804): the "check returned" notice to the office (mercury-webhook, once per deposit).
    // +1 (v2.3985): the ask-by-link email to an account man (gc-word-ask).
    // +1 (v2.4020): the payer's own Stripe bill email (send-stripe-invoice), which Stripe used to send.
    // +1 (v2.4311): where the liens stand, from the Lien desk's Share (send-lien-desk-summary).
    // +1 (v2.4624): the law firm's portal link, sent from the Legal desk (legal-send-firm-link).
    // +1 (v2.4936): every email to a GC mode trade partner (gc-trade-email).
    // +1 (v2.4998): our emails to a GC customer and its architect (gc-customer-email).
    // +1 (v2.5026): a submittal reviewer's own link to the review room (send-submittal-room-link).
    // +1 (v2.5024): the money team's Monday email about our GC jobs (gc-money-monday-email).
    // +2 (O10b): the architect's reminder to certify and the office's notices (gc-office-notices).
    // +1 (O12b): the customer's notice 3 days before a bill is due (gc-office-notices).
    expect(EMAIL_CATALOG).toHaveLength(52)
    for (const e of EMAIL_CATALOG) {
      expect(e.sender.trim().length).toBeGreaterThan(0)
      expect(e.subjectExample.trim().length).toBeGreaterThan(0)
    }
  })
})

// v2.4132 (punch list #53): every email a customer, GC, supply house or law firm reads sends as the
// company — `COMPANY_EMAIL_FROM` on `EMAIL_FROM`'s address — never as bare `EMAIL_FROM`. A source
// scan, like appDirectoryCheck: a new customer sender cannot ship as "ClickTooling".
describe('customer-facing senders send as the company', () => {
  const root = resolve(__dirname, '../..')
  const customerSenders = Array.from(
    new Set(EMAIL_CATALOG.filter((e) => e.audience === 'customer').map((e) => e.sender)),
  )
  it('names at least the eighteen customer rows across their senders', () => {
    expect(customerSenders.length).toBeGreaterThanOrEqual(14)
  })
  for (const sender of customerSenders) {
    it(`${sender} sends as COMPANY_EMAIL_FROM (or a company name built by mailboxWithName)`, () => {
      const src = readFileSync(resolve(root, `supabase/functions/${sender}/index.ts`), 'utf8')
      const usesCompany = src.includes('COMPANY_EMAIL_FROM') || src.includes('mailboxWithName(')
      expect(usesCompany, `${sender} never imports COMPANY_EMAIL_FROM / mailboxWithName`).toBe(true)
      expect(src, `${sender} still sends as bare EMAIL_FROM`).not.toMatch(/\bfrom: EMAIL_FROM\b/)
      expect(src, `${sender} still aliases bare EMAIL_FROM as its FROM`).not.toMatch(/=\s*EMAIL_FROM\s*$/m)
    })
  }
})
