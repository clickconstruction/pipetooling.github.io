/**
 * Our emails to a GC customer and its architect (O4b): the words (./customerEmail.ts), and what `gc-customer-email`
 * reads from a request and wraps around them (supabase/functions/_shared/gcCustomerEmails.ts).
 */
import { describe, expect, it } from 'vitest'
import {
  buildGcCustomerEmail,
  GC_CUSTOMER_EMAIL_FILED_AS,
  GC_CUSTOMER_EMAIL_FROM_NAME,
  GC_CUSTOMER_EMAIL_MAX_PDF_BASE64,
  GC_CUSTOMER_EMAIL_TO,
  parseCustomerEmail,
} from '../../../supabase/functions/_shared/gcCustomerEmails'
import { certifyAskMail, gcCustomerEmailRefusal, payAppMail, payAppMailFacts, readCustomerEmailAnswer, type PayAppMailFacts } from './customerEmail'
import { sentKindGroup } from '../sent/sentCopies'
import { isPayApplicationCopy } from '../aiaPayApplicationHistory'
import { money } from './words'
import { GC_COMPANY } from './company'
import { initialGcState } from './schedule/testState'

const facts: PayAppMailFacts = {
  job: 'Fair Oaks Shops, Building D',
  greeting: 'Elena',
  owner: 'Cibolo Creek Partners',
  architect: 'Garza Architects',
  number: 3,
  final: false,
  due: 48600,
  periodTo: '2026-10-25',
  retainagePct: 10,
}

describe('the words of a pay application\'s emails', () => {
  it('asks the customer for what it bills, says the architect certifies first, and sends the waiver on its own', () => {
    expect(payAppMail(facts)).toEqual({
      subject: `Pay application 3 for Fair Oaks Shops, Building D, ${money(48600)}`,
      lines: [
        'Hello Elena,',
        `Pay application 3 for Fair Oaks Shops, Building D asks for ${money(48600)}. It bills the work done through Oct 25, less the 10% you hold and the bills before it.`,
        'Garza Architects certifies it first. We will tell you when they do.',
        'Our conditional lien waiver comes in its own email.',
        'The pay application is attached.',
      ],
    })
  })

  it('asks for what they held on the final one', () => {
    expect(payAppMail({ ...facts, final: true }).lines[1]).toBe(`Our final pay application for Fair Oaks Shops, Building D asks for the ${money(48600)} you held. Every line is done.`)
  })

  it('asks the architect to certify it, by reply', () => {
    expect(certifyAskMail(facts)).toEqual({
      subject: 'Please certify pay application 3 for Fair Oaks Shops, Building D',
      lines: [
        'Hello Garza Architects,',
        `Pay application 3 for Fair Oaks Shops, Building D asks Cibolo Creek Partners for ${money(48600)}, for the work done through Oct 25.`,
        'The G702 and G703 are attached.',
        'Please certify it, or tell us what you would change. Reply to this email with your certificate.',
      ],
    })
  })

  it('reads the facts off the job and its bill, greeting the customer as the reminder does', () => {
    const state = initialGcState()
    const project = state.projects.find((p) => p.id === 'fairoaksd')!
    const app = project.ownerBilling!.payApps![0]!
    const f = payAppMailFacts(state, project, app)
    expect([f.job, f.owner, f.architect, f.number, f.due]).toEqual([project.name, project.owner, project.architect, app.number, app.due])
    expect(f.greeting.length).toBeGreaterThan(0)
  })
})

describe('what gc-customer-email reads and sends', () => {
  const ok = { projectId: '11111111-1111-4111-8111-111111111111', kind: 'pay_app', sourceId: '22222222-2222-4222-8222-222222222222', subject: 'Pay application 3', lines: ['Hello Elena,', 'It asks for $1.'] }

  it('takes a request with its form, and refuses one that is not whole', () => {
    const read = parseCustomerEmail({ ...ok, pdf: { filename: 'Fair Oaks pay application 3.pdf', base64: 'JVBERi0xLjQK' } })
    expect(read.ok && [read.req.kind, read.req.pdf?.filename]).toEqual(['pay_app', 'Fair Oaks pay application 3.pdf'])
    expect(parseCustomerEmail({ ...ok, kind: 'certified' }).ok).toBe(false)
    expect(parseCustomerEmail({ ...ok, projectId: 'not-an-id' }).ok).toBe(false)
    expect(parseCustomerEmail({ ...ok, lines: [] }).ok).toBe(false)
    expect(parseCustomerEmail({ ...ok, lines: ['Hello', ' '] }).ok).toBe(false)
    expect(parseCustomerEmail({ ...ok, pdf: { filename: 'form.exe', base64: 'JVBERi0xLjQK' } }).ok).toBe(false)
    expect(parseCustomerEmail({ ...ok, pdf: { filename: 'form.pdf', base64: 'A'.repeat(GC_CUSTOMER_EMAIL_MAX_PDF_BASE64 + 4) } }).ok).toBe(false)
    expect(parseCustomerEmail(null).ok).toBe(false)
  })

  it('sends the pay application to the customer and the ask to the architect, both filed as the pay application under Bills', () => {
    expect([GC_CUSTOMER_EMAIL_TO.pay_app, GC_CUSTOMER_EMAIL_TO.certify_ask]).toEqual(['customer', 'architect'])
    expect([GC_CUSTOMER_EMAIL_FILED_AS.pay_app, GC_CUSTOMER_EMAIL_FILED_AS.certify_ask]).toEqual(['bill_gc_pay_app', 'bill_gc_pay_app'])
    expect(sentKindGroup(GC_CUSTOMER_EMAIL_FILED_AS.pay_app)).toBe('bills')
    // Never the Pipeline's G702 workbook copy, whose history reads its own kind.
    expect(isPayApplicationCopy({ kind: GC_CUSTOMER_EMAIL_FILED_AS.pay_app })).toBe(false)
  })

  it('sends under the name on our G702, never the Pipeline company', () => {
    expect(GC_CUSTOMER_EMAIL_FROM_NAME).toBe(GC_COMPANY.name)
  })

  it('frames the lines under our name and signs it, escaping what it prints', () => {
    const email = buildGcCustomerEmail({ subject: ' Pay application 3 ', lines: ['Hello <Elena>,', 'It asks for $1 & more.'], signer: 'Robert', gc: 'Click Construction' })
    expect(email.subject).toBe('Pay application 3')
    expect(email.text).toBe('Hello <Elena>,\n\nIt asks for $1 & more.\n\nThank you,\nRobert\nClick Construction')
    expect(email.html).toContain('Hello &lt;Elena&gt;,')
    expect(email.html).toContain('It asks for $1 &amp; more.')
    expect(email.html).toContain('Thank you,<br>Robert<br>Click Construction')
  })

  it('reads the answer, or the refusal from the error body, and says each refusal in words', () => {
    expect(readCustomerEmailAnswer({ to: 'Cibolo Creek Partners', email: 'ap@cibolo.test' }, null)).toEqual({ ok: true, to: 'Cibolo Creek Partners', email: 'ap@cibolo.test' })
    expect(readCustomerEmailAnswer(null, { error: 'noEmail' })).toEqual({ ok: false, key: 'noEmail' })
    expect(readCustomerEmailAnswer(null, { error: 'mystery', detail: 'x' })).toEqual({ ok: false, key: 'failed', detail: 'x' })
    expect(gcCustomerEmailRefusal('noEmail')).toBe('There is no email address on file for them. Add one on the customer, then send it again.')
  })
})
