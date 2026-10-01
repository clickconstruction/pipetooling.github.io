import { describe, expect, it } from 'vitest'
import {
  bankReturnNoticeLine,
  bankReturnNoticeLinks,
  bankReturnNoticeSentences,
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

  it('v2.4320: the headline says who and how much; the reason comes next', () => {
    expect(bankReturnNoticeLine(take5)).toBe("The bank sent back Southern Post's $13,680 check.")
    expect(bankReturnNoticeLine({ ...take5, counterparty: 'Poolcorp Holdings', amount: 3125.5 })).toBe("The bank sent back Poolcorp Holdings' $3,125.50 check.")
    expect(bankReturnNoticeLine({ ...take5, counterparty: '' })).toBe("The bank sent back A customer's $13,680 check.")
    expect(bankReturnNoticeLine({ ...take5, counterparty: 'Sal Iannotti', amount: 600, situation: 'rejected', failedYmd: '2026-09-25' })).toBe(
      "Mercury could not take in Sal Iannotti's $600 check on Sep 25.",
    )
  })

  it('on a job: the reason, the day, where it still counts as paid, and the press that takes it off', () => {
    expect(bankReturnNoticeSentences(take5)).toEqual([
      'The reason is Insufficient funds.',
      'The bank took it Sep 18.',
      'It is still counted as paid on J878 Take 5- Seguin.',
      'Take it off the job. In Edit Job, press Unlink and remove on that payment.',
    ])
    const split = { ...take5, jobs: [take5.jobs[0]!, { jobId: 'b', jobLabel: 'J858 Lenox', amount: 500 }] }
    expect(bankReturnNoticeSentences(split).slice(2)).toEqual(['It is still counted as paid on 2 jobs.', 'Take it off each job. In Edit Job, press Unlink and remove on each payment.'])
  })

  it('off its job (Loberg, Oct 1): where it was, and who owes the money again', () => {
    const loberg: BankReturnNoticeInput = {
      ...take5,
      counterparty: 'Loberg',
      amount: 5622.49,
      reason: 'Stop payment',
      postedYmd: '2026-09-28',
      jobs: [],
      situation: 'off_job',
      lastJob: { jobId: 'job-650', jobLabel: 'J650 ATI Schertz — As per plans', offYmd: '2026-09-30' },
    }
    expect(bankReturnNoticeSentences(loberg)).toEqual([
      'The reason is Stop payment.',
      'The bank took it Sep 28.',
      'It is on no job now.',
      'It was on J650 ATI Schertz — As per plans until Sep 30.',
      'J650 owes the money again. Ask Loberg for a new check.',
    ])
    expect(bankReturnNoticeSubject(loberg)).toBe('A check came back · Loberg · $5,622.49')
    expect(bankReturnNoticeLinks(loberg)).toEqual([{ label: 'Open it in Accounts Receivable', path: '/accounts-receivable' }])
    expect(buildBankReturnNoticePush(loberg, 'tx-l')).toEqual({
      title: 'A check came back · $5,622.49',
      body: 'Loberg · Stop payment. It is on no job now.',
      url: '/accounts-receivable',
      tag: 'bank-return-tx-l',
    })
  })

  it('never reached the bank (Iannotti): the job that reads paid, and the deposit to make again', () => {
    const iannotti: BankReturnNoticeInput = {
      ...take5,
      counterparty: 'Sal Iannotti',
      amount: 600,
      reason: 'There was an issue with this transaction.',
      postedYmd: null,
      jobs: [],
      situation: 'rejected',
      failedYmd: '2026-09-25',
      recorded: { jobId: 'job-1040', jobLabel: 'J1040 Iannotti PRV', amount: 600, paidYmd: '2026-09-29' },
    }
    expect(bankReturnNoticeSentences(iannotti)).toEqual([
      'It never posted.',
      'J1040 Iannotti PRV still reads paid.',
      '$600 was recorded there on Sep 29 with no deposit.',
      'Find the check and deposit it again.',
    ])
    expect(bankReturnNoticeSubject(iannotti)).toBe('A check never reached the bank · Sal Iannotti · $600')
    expect(buildBankReturnNoticePush(iannotti, 'tx-i')).toEqual({
      title: 'A check never reached the bank · $600',
      body: 'Sal Iannotti. J1040 Iannotti PRV still reads paid.',
      url: '/jobs?tab=stages&edit=job-1040&editFocus=payments',
      tag: 'bank-return-tx-i',
    })
  })

  it('never on a job but recorded by hand (Peter Garza): says where it reads paid', () => {
    const garza: BankReturnNoticeInput = {
      ...take5,
      counterparty: 'Peter Garza',
      amount: 2700,
      postedYmd: null,
      jobs: [],
      situation: 'never_on_job',
      recorded: { jobId: 'job-120', jobLabel: 'J120 Pete Garza', amount: 2700, paidYmd: '2025-07-07' },
    }
    expect(bankReturnNoticeSentences(garza)).toEqual([
      'The reason is Insufficient funds.',
      'No deposit was ever linked to a job.',
      'J120 Pete Garza still reads paid.',
      '$2,700 was recorded there on Jul 7 with no deposit.',
      'Ask Peter Garza for a new check.',
    ])
    expect(bankReturnNoticeSentences({ ...garza, recorded: null }).slice(1)).toEqual(['It was never on a job.', 'Ask Peter Garza for a new check, or close it in Accounts Receivable.'])
  })

  it('subject, text and html carry the deep link that lands on ③ Payments received', () => {
    expect(bankReturnNoticeSubject(take5)).toBe('A check came back · Southern Post · $13,680')
    const mail = buildBankReturnNoticeEmail(take5)
    expect(mail.subject).toBe(bankReturnNoticeSubject(take5))
    expect(mail.text.split('\n')[0]).toBe("The bank sent back Southern Post's $13,680 check.")
    expect(mail.text).toContain('The bank took it Sep 18.')
    expect(mail.text).toContain(
      'J878 Take 5- Seguin · $13,680.00 · https://clicktooling.com/jobs?tab=stages&edit=6e30e4f4-da91-40a5-9c39-45dce996c1d2&editFocus=payments',
    )
    expect(mail.html).toContain('href="https://clicktooling.com/jobs?tab=stages&amp;edit=6e30e4f4-da91-40a5-9c39-45dce996c1d2&amp;editFocus=payments"')
    expect(mail.html).toContain('Nothing comes off a job on its own.')
    expect(buildBankReturnNoticeEmail({ ...take5, postedYmd: null }).text).not.toContain('The bank took it')
  })

  it('escapes the customer name in html', () => {
    const mail = buildBankReturnNoticeEmail({ ...take5, counterparty: 'M&M <Roofing>' })
    expect(mail.html).toContain('M&amp;M &lt;Roofing&gt;')
    expect(mail.text).toContain("M&M <Roofing>'s $13,680 check")
  })

  it('the push is short, opens the biggest job and folds by transaction', () => {
    const push = buildBankReturnNoticePush(take5, 'tx-1')
    expect(push).toEqual({
      title: 'A check came back · $13,680',
      body: 'Southern Post · Insufficient funds. Still counted as paid on J878 Take 5- Seguin.',
      url: '/jobs?tab=stages&edit=6e30e4f4-da91-40a5-9c39-45dce996c1d2&editFocus=payments',
      tag: 'bank-return-tx-1',
    })
    expect(buildBankReturnNoticePush({ ...take5, jobs: [] }, 'tx-2').url).toBe('/accounts-receivable')
    expect(bankReturnPaymentsPath('a b')).toBe('/jobs?tab=stages&edit=a%20b&editFocus=payments')
  })
})
