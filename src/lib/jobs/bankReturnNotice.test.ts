import { describe, expect, it } from 'vitest'
import {
  bankReturnNoticeLine,
  bankReturnNoticeSubject,
  bankReturnPaymentsPath,
  buildBankReturnNoticeEmail,
  buildBankReturnNoticePush,
  jobLabelForBankReturn,
  mercuryBankReturn,
  type BankReturnNoticeInput,
} from '../../../supabase/functions/_shared/bankReturnedDeposits'
import * as app from './bankReturnedDeposits'

const take5: BankReturnNoticeInput = {
  counterparty: 'Southern Post',
  amount: 13680,
  reason: 'Insufficient funds',
  postedYmd: '2026-09-18',
  jobs: [{ jobId: '6e30e4f4-da91-40a5-9c39-45dce996c1d2', jobLabel: 'J878 Take 5- Seguin', amount: 13680 }],
  appOrigin: 'https://clicktooling.com/',
}

describe('the office notice for a returned deposit (v2.3804)', () => {
  it('the app re-exports the rule the webhook runs', () => {
    expect(app.mercuryBankReturn).toBe(mercuryBankReturn)
    expect(app.jobLabelForBankReturn).toBe(jobLabelForBankReturn)
  })

  it('says who, how much, where and why in one line', () => {
    expect(bankReturnNoticeLine(take5)).toBe("Southern Post's check for $13,680 on J878 Take 5- Seguin came back: Insufficient funds.")
    expect(bankReturnNoticeLine({ ...take5, counterparty: 'Poolcorp Holdings', amount: 3125.5, reason: '' })).toBe(
      "Poolcorp Holdings' check for $3,125.50 on J878 Take 5- Seguin came back.",
    )
    expect(bankReturnNoticeLine({ ...take5, counterparty: '', jobs: [] })).toBe("A customer's check for $13,680 came back: Insufficient funds.")
    const split = { ...take5, jobs: [take5.jobs[0]!, { jobId: 'b', jobLabel: 'J858 Lenox', amount: 500 }] }
    expect(bankReturnNoticeLine(split)).toBe("Southern Post's check for $13,680 across 2 jobs came back: Insufficient funds.")
  })

  it('subject, text and html carry the deep link that lands on ③ Payments received', () => {
    expect(bankReturnNoticeSubject(take5)).toBe('Check returned · $13,680 · J878 Take 5- Seguin · Insufficient funds')
    const mail = buildBankReturnNoticeEmail(take5)
    expect(mail.subject).toBe(bankReturnNoticeSubject(take5))
    expect(mail.text).toContain('The bank took it Sep 18 and has now sent it back.')
    expect(mail.text).toContain('Open the job → ③ Payments received → Unlink and remove.')
    expect(mail.text).toContain(
      'J878 Take 5- Seguin · $13,680.00 · https://clicktooling.com/jobs?tab=stages&edit=6e30e4f4-da91-40a5-9c39-45dce996c1d2&editFocus=payments',
    )
    expect(mail.html).toContain('href="https://clicktooling.com/jobs?tab=stages&amp;edit=6e30e4f4-da91-40a5-9c39-45dce996c1d2&amp;editFocus=payments"')
    expect(mail.html).toContain('Nothing is taken off on its own')
    expect(buildBankReturnNoticeEmail({ ...take5, postedYmd: null }).text).not.toContain('The bank took it')
  })

  it('escapes the customer name in html', () => {
    const mail = buildBankReturnNoticeEmail({ ...take5, counterparty: 'M&M <Roofing>' })
    expect(mail.html).toContain('M&amp;M &lt;Roofing&gt;')
    expect(mail.text).toContain("M&M <Roofing>'s check")
  })

  it('the push is short, opens the biggest job and folds by transaction', () => {
    const push = buildBankReturnNoticePush(take5, 'tx-1')
    expect(push).toEqual({
      title: 'Check returned · $13,680',
      body: 'Southern Post on J878 Take 5- Seguin: Insufficient funds. Open the job → Unlink and remove.',
      url: '/jobs?tab=stages&edit=6e30e4f4-da91-40a5-9c39-45dce996c1d2&editFocus=payments',
      tag: 'bank-return-tx-1',
    })
    expect(buildBankReturnNoticePush({ ...take5, jobs: [] }, 'tx-2').url).toBe('/jobs?tab=stages')
    expect(bankReturnPaymentsPath('a b')).toBe('/jobs?tab=stages&edit=a%20b&editFocus=payments')
  })
})
