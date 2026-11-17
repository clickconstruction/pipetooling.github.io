import { describe, expect, it } from 'vitest'
import { runPacketHtml, type RunNotice, type RunRecipient } from './lienDeskRun'
import { lienNoticeOneOffPlan, lienOneOffBundlePages, lienOneOffDividerCount, lienOneOffDividerHtml, lienOneOffFiledHtml, lienOneOffPrintHtml, LIEN_ONE_OFF_INK_WORDS } from './lienNoticeOneOff'
import { runDividerHtml } from './lienRunPaper'
import { plainWordsFailures } from '../plainWords'

// Made-up names and addresses throughout.
const owner = (over: Partial<RunRecipient> = {}): RunRecipient => ({ key: 'owner', label: 'Owner of record', name: 'Cedar Point Holdings LLC', address: 'PO Box 4410, Austin, TX 78765', email: '', method: 'certified_mail', tracking: '', ...over })
const gc = (over: Partial<RunRecipient> = {}): RunRecipient => ({ key: 'original_contractor', label: 'Original contractor', name: 'Northgate Builders Inc', address: '915 Example Pkwy, Suite 200, Round Rock, TX 78664', email: '', method: 'certified_mail', tracking: '', ...over })
const notice = (over: Partial<RunNotice> = {}): RunNotice => ({
  itemId: 'window:job-4127',
  jobId: 'job-4127',
  kind: 'notice_53_056',
  label: '4127 · Sample Creek Bldg C',
  jobNumber: '4127',
  months: ['2026-09'],
  amount: 27198.65,
  fields: { noticeDate: '2026-11-16', projectDescription: 'Sample Creek Bldg C, 2210 Sample Creek Dr, Kyle, TX 78640', claimantName: 'Sample Plumbing Co', laborMaterialsType: 'Plumbing labor and materials', originalContractorName: 'Northgate Builders Inc', contractedWithIfDifferent: '', claimAmount: '27198.65', contactPerson: 'Sam Rivera', claimantAddress: '100 Example Rd, Austin, TX 78701' },
  extras: {},
  coverLetter: null,
  coverNote: null,
  ownerUnconfirmed: false,
  recipients: [owner(), gc()],
  ...over,
})
const issuer = { companyName: 'Sample Plumbing Co', addressText: '100 Example Rd\nAustin, TX 78701', phone: '(512) 555-0100', email: 'office@example.com', tagline: '', licenseLine: '' }
const invoices = { 'job-4127': ['<p>Invoice A</p>', '<p>Invoice B</p>', '<p>Invoice C</p>'] }
// The pay page goes to the owner's copy alone, as the run's builder hands it in.
const pay = { 'job-4127': { owner: '<p>Pay codes page</p>' } }

describe('a notice printed by itself, an envelope at a time (the owner, 2026-11-16)', () => {
  it('makes a bundle for each envelope, the owner first, each holding that copy’s pages as the run prints them', () => {
    const plan = lienNoticeOneOffPlan(notice(), invoices, pay)
    expect(plan.bundles.map((b) => [b.env.n, b.env.label, b.env.name])).toEqual([
      [1, 'Owner of record', 'Cedar Point Holdings LLC'],
      [2, 'Original contractor', 'Northgate Builders Inc'],
    ])
    expect(plan.bundles[0]!.labels).toEqual(['§ 53.056 notice · copy for owner of record', 'Pay codes', 'Unpaid invoice 1 of 3', 'Unpaid invoice 2 of 3', 'Unpaid invoice 3 of 3'])
    expect(plan.bundles[1]!.labels).toEqual(['§ 53.056 notice · copy for original contractor', 'Unpaid invoice 1 of 3', 'Unpaid invoice 2 of 3', 'Unpaid invoice 3 of 3'])
    expect(plan.held).toEqual([])
    expect(plan.press).toEqual({ button: 'Print 2 envelopes', foot: null, dead: false })
    expect(plan.reprints).toEqual([
      { n: 1, label: 'Reprint envelope 1 · the owner' },
      { n: 2, label: 'Reprint envelope 2 · the original contractor' },
    ])
  })

  it('a divider’s count and its amount are the pages behind it, and the claim those pages print', () => {
    const plan = lienNoticeOneOffPlan(notice(), invoices, pay)
    const html = lienOneOffPrintHtml(plan, { issuer, title: 'Job 4127', sheetHtml: '<div data-sheet>sheet</div>' })
    const sections = [...html.matchAll(/<section[^>]*>([\s\S]*?)<\/section>/g)].map((m) => m[1]!)
    // The help sheet once, then each envelope's divider followed by exactly the pages it counts.
    expect(sections[0]).toContain('data-sheet')
    let i = 1
    for (const b of plan.bundles) {
      const divider = sections[i]!
      expect(divider).toContain(`data-run-divider="${b.env.n}"`)
      const { count } = lienOneOffDividerCount(b)
      expect(divider).toContain(`${count} ${count === 1 ? 'document follows' : 'documents follow'} this page`)
      const behind = sections.slice(i + 1, i + 1 + count)
      expect(behind).toHaveLength(b.pages.length)
      expect(behind.every((p) => !p.includes('data-run-divider'))).toBe(true)
      // The divider's amount is the claim the notice behind it prints.
      expect(divider).toContain('Inside: 4127 · Sample Creek Bldg C · $27,198.65')
      expect(behind[0]).toContain('$27,198.65')
      i += 1 + count
    }
    expect(sections).toHaveLength(i)
    expect(sections[1]).toContain('Envelope 1 of 2 · Owner of record')
    expect(sections[1 + 1 + plan.bundles[0]!.pages.length]).toContain('Envelope 2 of 2 · Original contractor')
  })

  it('the divider is the run’s own, page for page: the same notice in the run prints the same divider', () => {
    const plan = lienNoticeOneOffPlan(notice(), invoices, pay)
    const run = runPacketHtml([notice()], '2026-11-16', issuer, invoices, pay)
    for (const b of plan.bundles) {
      const mine = lienOneOffDividerHtml(plan, b, issuer)
      expect(mine).toBe(runDividerHtml(b.env, 2, issuer, b.labels))
      expect(run).toContain(mine)
      // And the pages behind it, with their feet.
      for (const page of lienOneOffBundlePages(b)) expect(run).toContain(page)
    }
  })

  it('a job with no original contractor prints one bundle behind a divider that says 1 of 1', () => {
    const plan = lienNoticeOneOffPlan(notice({ recipients: [owner()] }), invoices, pay)
    expect(plan.bundles).toHaveLength(1)
    expect(plan.press.button).toBe('Print 1 envelope')
    expect(plan.reprints).toEqual([])
    expect(lienOneOffDividerHtml(plan, plan.bundles[0]!, issuer)).toContain('Envelope 1 of 1 · Owner of record')
  })

  it('an envelope with no mailing address is held with the run’s reason, and the press says so', () => {
    const plan = lienNoticeOneOffPlan(notice({ recipients: [owner(), gc({ address: '' })] }), invoices, pay)
    expect(plan.bundles.map((b) => b.env.name)).toEqual(['Cedar Point Holdings LLC'])
    expect(plan.held.map((h) => [h.env.name, h.why])).toEqual([['Northgate Builders Inc', 'No mailing address. Set it on the customer, then print this envelope from the run.']])
    expect(plan.press.button).toBe('Print 1 envelope · 1 held ▸')
    expect(plan.press.dead).toBe(false)
    const none = lienNoticeOneOffPlan(notice({ recipients: [owner({ address: '' })] }), invoices, pay)
    expect(none.press.dead).toBe(true)
  })

  it('one name at one address folds into one envelope, as the run folds it', () => {
    const plan = lienNoticeOneOffPlan(notice({ recipients: [owner({ name: 'Northgate Builders Inc', address: '915 Example Pkwy, Suite 200, Round Rock, TX 78664' }), gc()] }), invoices, pay)
    expect(plan.bundles).toHaveLength(1)
    expect(plan.bundles[0]!.labels.filter((l) => l.startsWith('§ 53.056 notice'))).toHaveLength(2)
  })

  it('a reprint is one envelope’s divider and pages, and the filed copy is the pages alone', () => {
    const plan = lienNoticeOneOffPlan(notice(), invoices, pay)
    const one = lienOneOffPrintHtml(plan, { issuer, title: 'Job 4127', sheetHtml: '<div data-sheet>sheet</div>', only: 2 })
    expect(one).not.toContain('data-sheet')
    expect(one).not.toContain('data-run-divider="1"')
    expect(one).toContain('data-run-divider="2"')
    const filed = lienOneOffFiledHtml(plan, 'Job 4127')
    expect(filed).not.toContain('data-run-divider')
    expect((filed.match(/§ 53\.056 notice · copy for/g) ?? []).length).toBe(2)
    expect((lienOneOffFiledHtml(plan, 'Job 4127', 1).match(/copy for/g) ?? []).length).toBeGreaterThan(0)
  })

  it('the line beside the press reads as plain words', () => {
    expect(plainWordsFailures(LIEN_ONE_OFF_INK_WORDS)).toEqual([])
  })
})
