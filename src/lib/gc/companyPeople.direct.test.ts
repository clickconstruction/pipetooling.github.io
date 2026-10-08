/**
 * Main's own tests for who at a company gets which emails and its work with us (the Board's B3-c),
 * run through the kernels on the test data. The spike's own cases: Pecan Valley Electric named a
 * bookkeeper who gets pay, and Tri-County Site was awarded Fair Oaks Shops, Building D's sitework.
 */
import { describe, expect, it } from 'vitest'
import { partnerWork } from './companyFile'
import { companyPeople, mailGroupList, mailGroupName } from './companyPeople'
import { initialGcState } from './schedule/testState'

const partner = (company: string) => {
  const state = initialGcState()
  const p = state.partners.find((x) => x.company === company)
  if (!p) throw new Error(`the made-up data lost ${company}`)
  return { state, p }
}

describe('who at a company gets which emails', () => {
  it('lists the main contact first with the emails they get, then each person the company named', () => {
    const { p } = partner('Pecan Valley Electric')
    expect(companyPeople(p).map((x) => [x.name, x.role, x.main, x.gets.join('+')])).toEqual([
      ['Marcus Bell', 'Main contact', true, 'quotes+job+contracts'],
      ['Dana Whitfield', 'Bookkeeper', false, 'pay'],
    ])
  })

  it('marks a main contact whose address the record does not have, so a screen can say so', () => {
    const { p } = partner('Pecan Valley Electric')
    expect(companyPeople(p)[0]?.madeUp).toBe(true)
    expect(companyPeople({ ...p, email: 'marcus@pve.test' })[0]).toMatchObject({ email: 'marcus@pve.test', madeUp: false })
  })

  it('names each kind of email in the portal’s words, in either language', () => {
    expect(mailGroupName('pay')).toBe('Pay and papers')
    expect(mailGroupName('quotes', 'es')).toBe('Cotizaciones y planos')
    expect(mailGroupList(['quotes', 'job', 'pay'])).toBe('quotes and plans, the job, and pay and papers')
    expect(mailGroupList(['pay'])).toBe('pay and papers')
  })
})

describe('a company’s work with us', () => {
  it('adds up the jobs awarded to them, what was paid and what we hold', () => {
    const { state, p } = partner('Tri-County Site')
    const work = partnerWork(state, p)
    expect(work.jobs.map((j) => [j.project.name, j.pkg.trade, j.price, j.signed])).toEqual([['Fair Oaks Shops, Building D', 'Sitework', 168000, true]])
    expect([work.underContract, work.paid, work.approved, work.held]).toEqual([168000, 151200, 0, 16800])
  })

  it('is nothing for a company with no award', () => {
    const { state, p } = partner('Alamo Concrete')
    expect(partnerWork(state, p)).toEqual({ jobs: [], underContract: 0, paid: 0, approved: 0, held: 0 })
  })
})
