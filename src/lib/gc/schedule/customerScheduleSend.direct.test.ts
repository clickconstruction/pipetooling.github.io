/**
 * Main's own test for the customer's schedule sent on its own (G-94). The schedule's PR 1b printed the page; PR 15a
 * moved the letter (`customerScheduleLetter`, the prototype's `gcCustomerScheduleSend.test.ts` on main's test state, its
 * reducer's send now the window's row) and added the row a press goes again on. The late finish is the real one with its
 * customer's words laid over it where a test asks, since the test state is not late.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { customerScheduleHtml, customerScheduleLetter, scheduleSendRetryRow } from './customerScheduleSend'
import { initialGcState } from './testState'
import { scheduleSendRowOf } from './writes'
import type { ScheduleSend } from './types'
import type { GcProject, GcState } from '../types'

let lateWords: string[] | null = null
vi.mock('../lateFinish', async (importOriginal) => {
  const real = await importOriginal<typeof import('../lateFinish')>()
  return {
    ...real,
    lateFinish: vi.fn((state: GcState, project: GcProject) => {
      const f = real.lateFinish(state, project)
      return lateWords ? { ...f, customerWords: lateWords } : f
    }),
  }
})

afterEach(() => {
  lateWords = null
})

const ID = 'fairoaksd'
const job = (state: GcState) => state.projects.find((p) => p.id === ID)!

describe('the customer’s schedule as a letter (G-94, PR 15a)', () => {
  it('writes the letter from the same picture their portal will show', () => {
    const state = initialGcState()
    const letter = customerScheduleLetter(state, job(state), 'Robert Douglas')
    expect(letter.to).toBe('Elena Marchetti, Cibolo Creek Partners')
    expect(letter.subject).toBe('Your schedule on Fair Oaks Shops, Building D, Oct 2')
    expect(letter.lines.slice(0, 4)).toEqual(['Hello Elena,', 'Here is where Fair Oaks Shops, Building D stands as of Fri Oct 2.', 'We finish Fri Dec 11. Your contract says Dec 11.', '72% of the work is done. We planned 76% by today.'])
    expect(letter.lines).toContain('Dry-in: Sep 25, 7 days late.')
    expect(letter.lines.some((l) => /^Rough-in: /.test(l))).toBe(true)
    expect(letter.lines).toContain('Nothing moved this week. The schedule stands as planned.')
    expect(letter.lines.slice(-2)).toEqual(['Call me with any question.', 'Robert Douglas, Click Construction'])
    const html = customerScheduleHtml(letter)
    expect(html).toContain('<title>Your schedule on Fair Oaks Shops, Building D, Oct 2</title>')
    expect(html).toContain('<p>Hello Elena,</p>')
  })

  it('carries the late finish in the customer’s words after the finish, and never a fee or a company', () => {
    lateWords = ['Those 3 days came from a decision we were waiting on from you.']
    const s = initialGcState()
    const withFee: GcState = { ...s, projects: s.projects.map((p) => (p.id === ID ? { ...p, ownerLateFinish: { perDay: 500 } } : p)) }
    const lines = customerScheduleLetter(withFee, job(withFee), 'Robert Douglas').lines
    const at = lines.indexOf('We finish Fri Dec 11. Your contract says Dec 11.')
    expect(lines.slice(at, at + 3)).toEqual(['We finish Fri Dec 11. Your contract says Dec 11.', 'Those 3 days came from a decision we were waiting on from you.', '72% of the work is done. We planned 76% by today.'])
    const companies = withFee.partners.map((c) => c.company)
    expect(companies.length).toBeGreaterThan(0)
    for (const line of lines) {
      expect(line).not.toMatch(/\$/)
      for (const name of companies) expect(line).not.toContain(name)
    }
  })

  it('greets no one by name when the customer row has no contact, and goes to the company alone (call 4)', () => {
    const s = initialGcState()
    const p = job(s)
    const nameless: GcState = { ...s, customers: s.customers.map((c) => (c.id === p.customerId ? { ...c, contact: '' } : c)) }
    const letter = customerScheduleLetter(nameless, p, 'Robert Douglas')
    expect(letter.lines[0]).toBe('Hello,')
    expect(letter.to).toBe('Cibolo Creek Partners')
  })

  it('prints the letter under its subject, to its reader, one paragraph a line', () => {
    const html = customerScheduleHtml({ to: 'Elena Ruiz, Cibolo Creek Partners', subject: 'Your schedule on Fair Oaks Shops, Building D, Oct 2', lines: ['Hello Elena,', 'Call me with any question.', 'Robert Douglas, Click Construction'] })
    expect(html).toContain('<title>Your schedule on Fair Oaks Shops, Building D, Oct 2</title>')
    expect(html).toContain('<h1>Your schedule on Fair Oaks Shops, Building D, Oct 2</h1><div class="to">To Elena Ruiz, Cibolo Creek Partners</div>')
    expect(html).toContain('<p>Hello Elena,</p><p>Call me with any question.</p><p>Robert Douglas, Click Construction</p></body></html>')
  })

  it('keeps what the page would read as its own marks as words', () => {
    expect(customerScheduleHtml({ to: 'A & B', subject: '<b>', lines: ['1 < 2'] })).toContain('<title>&lt;b&gt;</title><style>')
    expect(customerScheduleHtml({ to: 'A & B', subject: 'x', lines: ['1 < 2'] })).toContain('<div class="to">To A &amp; B</div><p>1 &lt; 2</p>')
  })
})

describe('the letter kept, and the row a press goes again on (PR 15a, call 2)', () => {
  const s = initialGcState()
  const letter = customerScheduleLetter(s, job(s), 'Robert Douglas')
  const kept = (id: string, over: Partial<ScheduleSend> = {}): ScheduleSend => ({ id, on: s.today, by: 'Robert Douglas', to: letter.to, subject: letter.subject, lines: letter.lines, ...over })
  const on = (sends: ScheduleSend[]): GcProject => ({ ...job(s), scheduleSends: sends })

  it('keeps the letter as its row, dated the app’s day, who sent it left to the column', () => {
    expect(scheduleSendRowOf('p-1', letter, '2026-10-02')).toEqual({ project_id: 'p-1', sent_on: '2026-10-02', sent_to: letter.to, subject: letter.subject, lines: letter.lines })
  })

  it('goes again on the newest row kept the same day with the same letter and not emailed', () => {
    expect(scheduleSendRetryRow(on([kept('a'), kept('b')]), letter, s.today)?.id).toBe('b')
    expect(scheduleSendRetryRow(on([]), letter, s.today)).toBeNull()
  })

  it('keeps a new row once the letter went, or reads otherwise, or another day', () => {
    expect(scheduleSendRetryRow(on([kept('a', { emailed: true })]), letter, s.today)).toBeNull()
    expect(scheduleSendRetryRow(on([kept('a', { lines: [...letter.lines.slice(0, -1), 'Rosa, Click Construction'] })]), letter, s.today)).toBeNull()
    expect(scheduleSendRetryRow(on([kept('a', { to: 'Cibolo Creek Partners' })]), letter, s.today)).toBeNull()
    expect(scheduleSendRetryRow(on([kept('a', { on: '2026-10-01' })]), letter, s.today)).toBeNull()
  })
})
