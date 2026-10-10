/**
 * Our emails to a GC customer and its architect (O4b): the words (./customerEmail.ts), and what `gc-customer-email`
 * reads from a request and wraps around them (supabase/functions/_shared/gcCustomerEmails.ts).
 */
import { describe, expect, it } from 'vitest'
import {
  buildGcCustomerEmail,
  gcCustomerEmailCc,
  gcCustomerEmailCopyKinds,
  gcCustomerEmailTestSubject,
  gcWeeklyReportLines,
  GC_CUSTOMER_EMAIL_ADDRESS,
  GC_CUSTOMER_EMAIL_FILED_AS,
  GC_CUSTOMER_EMAIL_FRAMED,
  GC_CUSTOMER_EMAIL_GATE,
  GC_CUSTOMER_EMAIL_TEST_TYPE,
  GC_CUSTOMER_EMAIL_FROM_NAME,
  GC_CUSTOMER_EMAIL_KINDS,
  GC_CUSTOMER_EMAIL_MAX_PDF_BASE64,
  GC_CUSTOMER_EMAIL_PORTAL_LINE,
  GC_CUSTOMER_EMAIL_SOURCE,
  GC_CUSTOMER_EMAIL_TO,
  parseCustomerEmail,
} from '../../../supabase/functions/_shared/gcCustomerEmails'
import {
  certifiedMail,
  certifiedMailFacts,
  certifyAskMail,
  changeOrderMail,
  changeOrderMailFacts,
  emailedWords,
  gcCustomerEmailRefusal,
  interestBillMail,
  interestBillMailFacts,
  payAppMail,
  payAppMailFacts,
  readCustomerEmailAnswer,
  type CertifiedMailFacts,
  type ChangeOrderMailFacts,
  type PayAppMailFacts,
} from './customerEmail'
import { ownerExpectPaidOn } from './ownerBilling'
import type { ChangeOrder } from './types'
import { sentKindGroup } from '../sent/sentCopies'
import { isPayApplicationCopy } from '../aiaPayApplicationHistory'
import { money, weekdayDate } from './words'
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

describe('the words of the certified bill', () => {
  const cert: CertifiedMailFacts = { job: facts.job, greeting: 'Elena', architect: 'Garza Architects', number: 3, final: false, asked: 48600, certified: 48600, expectOn: '2026-11-20' }

  it('says what the architect certified and when we expect it, and asks for their day: no Pay', () => {
    expect(certifiedMail(cert)).toEqual({
      subject: `Garza Architects certified pay application 3, ${money(48600)}`,
      lines: [
        'Hello Elena,',
        `Garza Architects certified pay application 3 for Fair Oaks Shops, Building D at ${money(48600)}.`,
        `We expect it by ${weekdayDate('2026-11-20')}.`,
        'Reply with the day you will pay.',
      ],
    })
  })

  it('says what was cut and that it comes back on the next bill, never on the final one', () => {
    const cut = certifiedMail({ ...cert, certified: 45000, expectOn: null })
    expect(cut.lines.slice(2)).toEqual([`That is ${money(3600)} less than we asked. It comes back on the next bill once the work is done.`, 'Reply with the day you will pay.'])
    expect(certifiedMail({ ...cert, final: true, certified: 45000 }).lines[2]).toBe(`That is ${money(3600)} less than we asked.`)
    expect(certifiedMail({ ...cert, final: true }).subject).toBe(`Garza Architects certified our final pay application, ${money(48600)}`)
  })

  it('expects it by the certificate’s day plus their usual days, as the window does', () => {
    const state = initialGcState()
    const project = state.projects.find((p) => p.id === 'fairoaksd')!
    const app = project.ownerBilling!.payApps![0]!
    const f = certifiedMailFacts(state, project, app, 40000, '2026-10-30')
    expect([f.asked, f.certified, f.number]).toEqual([app.due, 40000, app.number])
    expect(f.expectOn).toBe(ownerExpectPaidOn(state, project, { ...app, certified: 40000, certifiedOn: '2026-10-30' }))
  })
})

describe('the words of a change order to sign', () => {
  const co: ChangeOrderMailFacts = { job: facts.job, greeting: 'Elena', number: 2, description: 'Add a coffee bar cabinet, per the customer. ', price: 1100, days: 3, timeOnly: false }

  it('says the change, what it adds to the price and the job, and asks them to sign by reply', () => {
    expect(changeOrderMail(co)).toEqual({
      subject: `Change order 2 for Fair Oaks Shops, Building D, +${money(1100)}`,
      lines: [
        'Hello Elena,',
        'Change order 2 for Fair Oaks Shops, Building D is ready for your signature: Add a coffee bar cabinet, per the customer.',
        `It adds ${money(1100)} to your price.`,
        'It adds 3 days to the job.',
        'Reply to sign it, or with any questions.',
      ],
    })
  })

  it('takes a credit off the price, and a time extension changes no price', () => {
    const credit = changeOrderMail({ ...co, price: -500, days: 0 })
    expect(credit.subject).toBe(`Change order 2 for Fair Oaks Shops, Building D, −${money(500)}`)
    expect(credit.lines.slice(2)).toEqual([`It takes ${money(500)} off your price.`, 'Reply to sign it, or with any questions.'])
    const time = changeOrderMail({ ...co, price: 0, days: 1, timeOnly: true })
    expect(time.subject).toBe('Change order 2 for Fair Oaks Shops, Building D, 1 day more')
    expect(time.lines.slice(2, 4)).toEqual(['It does not change your price.', 'It adds 1 day to the job.'])
  })

  it('reads the facts off the change order', () => {
    const state = initialGcState()
    const project = state.projects.find((p) => p.id === 'fairoaksd')!
    const order: ChangeOrder = { id: 'co-2', number: 2, description: 'Move the grease trap', reason: 'owner', schedule: '+2 days', packageId: null, cost: 900, price: 990, pctDone: 0, status: 'sent', sentOn: '2026-10-01', answeredOn: null, days: 2 }
    expect(changeOrderMailFacts(state, project, order)).toEqual({ job: project.name, greeting: payAppMailFacts(state, project, project.ownerBilling!.payApps![0]!).greeting, number: 2, description: 'Move the grease trap', price: 990, days: 2, timeOnly: false })
    expect(changeOrderMailFacts(state, project, { ...order, daysOnChart: [] }).timeOnly).toBe(true)
  })
})

describe('the words of an interest bill (O6b-2)', () => {
  it('says the bills went past their day, what the interest comes to at the rate, and asks for their day: no Pay', () => {
    expect(interestBillMail({ job: facts.job, greeting: 'Elena', amount: 284.92, pctPerMonth: 1.5 })).toEqual({
      subject: `Interest on late bills for Fair Oaks Shops, Building D, ${money(284.92)}`,
      lines: [
        'Hello Elena,',
        'Some of your bills on Fair Oaks Shops, Building D went past the day they were due by the contract.',
        `The interest on them comes to ${money(284.92)}, at 1.5% a month.`,
        'Reply with the day you will pay.',
      ],
    })
    expect(interestBillMail({ job: 'J', greeting: 'E', amount: 10, pctPerMonth: null }).lines[2]).toBe(`The interest on them comes to ${money(10)}.`)
  })

  it('reads the rate off the job', () => {
    const state = initialGcState()
    const project = { ...state.projects.find((p) => p.id === 'fairoaksd')!, ownerLateInterest: { pctPerMonth: 1.5 } }
    expect(interestBillMailFacts(state, project, 100)).toMatchObject({ job: project.name, amount: 100, pctPerMonth: 1.5 })
  })
})

describe('the window’s line for each email that went', () => {
  it('names who got the pay application, then who got the certified bill, each once', () => {
    expect(emailedWords([])).toEqual([])
    expect(
      emailedWords([
        { what: 'payApp', to: 'Cibolo Creek Partners', on: '2026-07-25' },
        { what: 'payApp', to: 'Garza Architects', on: '2026-07-25' },
        { what: 'certified', to: 'Cibolo Creek Partners', on: '2026-08-02' },
        { what: 'certified', to: 'Cibolo Creek Partners', on: '2026-08-03' },
      ]),
    ).toEqual(['Emailed to Cibolo Creek Partners and Garza Architects on Jul 25.', 'The certified bill was emailed to Cibolo Creek Partners on Aug 2.'])
  })
})

describe('what gc-customer-email reads and sends', () => {
  const ok = { projectId: '11111111-1111-4111-8111-111111111111', kind: 'pay_app', sourceId: '22222222-2222-4222-8222-222222222222', subject: 'Pay application 3', lines: ['Hello Elena,', 'It asks for $1.'] }

  it('takes a request with its form, and refuses one that is not whole', () => {
    const read = parseCustomerEmail({ ...ok, pdf: { filename: 'Fair Oaks pay application 3.pdf', base64: 'JVBERi0xLjQK' } })
    expect(read.ok && [read.req.kind, read.req.pdf?.filename]).toEqual(['pay_app', 'Fair Oaks pay application 3.pdf'])
    expect(parseCustomerEmail({ ...ok, kind: 'accept_work' }).ok).toBe(false)
    expect([parseCustomerEmail({ ...ok, kind: 'certified' }).ok, parseCustomerEmail({ ...ok, kind: 'change_order' }).ok]).toEqual([true, true])
    expect(parseCustomerEmail({ ...ok, projectId: 'not-an-id' }).ok).toBe(false)
    expect(parseCustomerEmail({ ...ok, lines: [] }).ok).toBe(false)
    expect(parseCustomerEmail({ ...ok, lines: ['Hello', ' '] }).ok).toBe(false)
    expect(parseCustomerEmail({ ...ok, pdf: { filename: 'form.exe', base64: 'JVBERi0xLjQK' } }).ok).toBe(false)
    expect(parseCustomerEmail({ ...ok, pdf: { filename: 'form.pdf', base64: 'A'.repeat(GC_CUSTOMER_EMAIL_MAX_PDF_BASE64 + 4) } }).ok).toBe(false)
    expect(parseCustomerEmail(null).ok).toBe(false)
  })

  it('sends each kind to its party about its row, the bills and reminders filed under Bills and the change order under Contracts', () => {
    const each = GC_CUSTOMER_EMAIL_KINDS.map((k) => [k, GC_CUSTOMER_EMAIL_TO[k], GC_CUSTOMER_EMAIL_SOURCE[k], GC_CUSTOMER_EMAIL_FILED_AS[k], sentKindGroup(GC_CUSTOMER_EMAIL_FILED_AS[k])])
    expect(each).toEqual([
      ['pay_app', 'customer', 'gc_owner_pay_apps', 'bill_gc_pay_app', 'bills'],
      ['certify_ask', 'architect', 'gc_owner_pay_apps', 'bill_gc_pay_app', 'bills'],
      ['certified', 'customer', 'gc_owner_pay_apps', 'bill_gc_certified', 'bills'],
      ['change_order', 'customer', 'gc_change_orders', 'job_contract_gc_change_order', 'contracts'],
      ['reminder', 'customer', 'gc_owner_pay_reminders', 'bill_gc_reminder', 'bills'],
      ['interest_bill', 'customer', 'gc_owner_interest_bills', 'bill_gc_interest', 'bills'],
      ['weekly', 'customer', 'gc_weekly_reports', 'field_report_gc_weekly', 'statements'],
    ])
    // Never the Pipeline's G702 workbook copy, whose history reads its own kind.
    expect(GC_CUSTOMER_EMAIL_KINDS.some((k) => isPayApplicationCopy({ kind: GC_CUSTOMER_EMAIL_FILED_AS[k] }))).toBe(false)
    expect(gcCustomerEmailCopyKinds('gc_owner_pay_apps')).toEqual(['bill_gc_pay_app', 'bill_gc_certified'])
    expect(gcCustomerEmailCopyKinds('gc_change_orders')).toEqual(['job_contract_gc_change_order'])
    expect(gcCustomerEmailCopyKinds('gc_owner_pay_reminders')).toEqual(['bill_gc_reminder'])
    expect(gcCustomerEmailCopyKinds('gc_owner_interest_bills')).toEqual(['bill_gc_interest'])
    expect(gcCustomerEmailCopyKinds('gc_weekly_reports')).toEqual(['field_report_gc_weekly'])
    expect(GC_CUSTOMER_EMAIL_KINDS.filter((k) => GC_CUSTOMER_EMAIL_PORTAL_LINE[k])).toEqual(['certified', 'reminder', 'interest_bill'])
  })

  it('sends the weekly report as Building’s (U7b): its row decides who may, to the contact first, unframed, no portal line yet', () => {
    const others = GC_CUSTOMER_EMAIL_KINDS.filter((k) => k !== 'weekly')
    expect(others.every((k) => GC_CUSTOMER_EMAIL_GATE[k] === 'moneyTeam' && GC_CUSTOMER_EMAIL_ADDRESS[k] === 'billing' && GC_CUSTOMER_EMAIL_FRAMED[k])).toBe(true)
    expect([GC_CUSTOMER_EMAIL_GATE.weekly, GC_CUSTOMER_EMAIL_ADDRESS.weekly, GC_CUSTOMER_EMAIL_FRAMED.weekly, GC_CUSTOMER_EMAIL_PORTAL_LINE.weekly]).toEqual(['row', 'contact', false, false])
    const read = parseCustomerEmail({ ...ok, kind: 'weekly' })
    expect(read.ok && read.req.kind).toBe('weekly')
  })

  it('splits a weekly report into its paragraphs, each keeping its own lines', () => {
    const body = 'Hi Dana,\n\nHere is where it stands.\r\n\r\nAt a glance\n- Finish: about Fri Dec 18.\n- 62% done.\n  \nThanks,\nRosa\nClick Construction'
    expect(gcWeeklyReportLines(body)).toEqual(['Hi Dana,', 'Here is where it stands.', 'At a glance\n- Finish: about Fri Dec 18.\n- 62% done.', 'Thanks,\nRosa\nClick Construction'])
  })

  it('frames nothing around an unframed email, escapes its text and keeps its line breaks', () => {
    const email = buildGcCustomerEmail({ subject: 'Fair Oaks · week of Oct 5', lines: ['Hi Dana,', 'At a glance\n- Under <budget> & on time.', 'Thanks,\nRosa\nClick Construction'], signer: 'Robert', gc: 'Click Construction', framed: false })
    expect(email.text).toBe('Hi Dana,\n\nAt a glance\n- Under <budget> & on time.\n\nThanks,\nRosa\nClick Construction')
    expect(email.html).toContain('At a glance<br>- Under &lt;budget&gt; &amp; on time.')
    expect(email.html).not.toContain('Under <budget>')
    expect(email.html).not.toContain('Thank you,')
    // A framed one keeps the signature as before.
    expect(buildGcCustomerEmail({ subject: 'S', lines: ['Hello Elena,'], signer: 'Robert', gc: 'Click Construction' }).text).toBe('Hello Elena,\n\nThank you,\nRobert\nClick Construction')
  })

  it('makes a test copy of any kind: [TEST] before the subject, its own email type, and nobody copied', () => {
    expect(gcCustomerEmailTestSubject(' Fair Oaks · week of Oct 5 ')).toBe('[TEST] Fair Oaks · week of Oct 5')
    expect(GC_CUSTOMER_EMAIL_TEST_TYPE).toBe('gc_customer_email_test')
    const read = parseCustomerEmail({ ...ok, test: true })
    expect(read.ok && read.req.test).toBe(true)
    const plain = parseCustomerEmail({ ...ok, test: 'yes' })
    expect(plain.ok && plain.req.test).toBeUndefined()
    expect(gcCustomerEmailCc({ copyArchitect: true, test: true, architectAddress: 'arch@mesquite.com', address: 'dana@cibolo.com' })).toEqual([])
  })

  it('copies the architect on a weekly report that says so, at an address of its own', () => {
    const base = { copyArchitect: true, test: false, architectAddress: ' arch@mesquite.com ', address: 'dana@cibolo.com' }
    expect(gcCustomerEmailCc(base)).toEqual(['arch@mesquite.com'])
    expect(gcCustomerEmailCc({ ...base, copyArchitect: false })).toEqual([])
    expect(gcCustomerEmailCc({ ...base, architectAddress: '' })).toEqual([])
    expect(gcCustomerEmailCc({ ...base, architectAddress: 'DANA@cibolo.com' })).toEqual([])
  })

  it('adds the customer’s portal link before the signature when there is one, and only an https one', () => {
    const email = buildGcCustomerEmail({ subject: 'S', lines: ['Hello Elena,'], signer: 'Robert', gc: 'Click Construction', portalUrl: 'https://my.clickplumbing.com/cibolo' })
    expect(email.text).toBe('Hello Elena,\n\nYou can see this bill in your portal: https://my.clickplumbing.com/cibolo\n\nThank you,\nRobert\nClick Construction')
    expect(email.html).toContain('You can see this bill in your portal: <a href="https://my.clickplumbing.com/cibolo"')
    expect(email.html).toContain('>my.clickplumbing.com/cibolo</a>')
    for (const portalUrl of [null, '', 'javascript:alert(1)', 'http://x.test/p']) {
      expect(buildGcCustomerEmail({ subject: 'S', lines: ['Hi'], signer: 'R', gc: 'G', portalUrl }).text).not.toContain('portal')
    }
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
    expect(readCustomerEmailAnswer(null, { error: 'notCertified' })).toEqual({ ok: false, key: 'notCertified' })
    expect([gcCustomerEmailRefusal('notSent'), gcCustomerEmailRefusal('otherProject'), gcCustomerEmailRefusal('alreadySent')]).toEqual([
      'That change order is not waiting on their signature.',
      'That belongs to another job.',
      'That reminder went already.',
    ])
  })
})
