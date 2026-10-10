// @vitest-environment jsdom
/**
 * GC mode, the real build, the schedule's PR 15a: the customer's letter (G-94) on main's test state, the card rendered
 * alone with its press stood in for. Ported from the prototype's `ScheduleSendCard`, whose press went through its reducer:
 * here the window keeps the row and sends it. Read, Print the letter (its copy filed, no letter row), a test to me and the
 * send, each refusal in the card's words, and each send kept as it went.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, within } from '@testing-library/react'
import { GcScheduleLetter } from './GcScheduleLetter'
import { printAndFile } from '../../lib/sent/sentCopiesIo'
import type { CustomerEmailAnswer } from '../../lib/gc/customerEmail'
import { customerScheduleLetter, type ScheduleLetter } from '../../lib/gc/schedule/customerScheduleSend'
import { initialGcState } from '../../lib/gc/schedule/testState'
import type { ScheduleSend } from '../../lib/gc/schedule/types'
import type { GcProject } from '../../lib/gc/types'
import { plainWordsFailures } from '../../lib/plainWords'

vi.mock('../../lib/sent/sentCopiesIo', () => ({ printAndFile: vi.fn(() => true) }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const s = initialGcState()
const fairOaks = s.projects.find((p) => p.id === 'fairoaksd')!
const letter = customerScheduleLetter(s, fairOaks, 'Robert Douglas')
const card = () => document.querySelector('[data-gc-schedule-letter]') as HTMLElement
const show = (onSend?: (l: ScheduleLetter, test: boolean) => Promise<CustomerEmailAnswer>, project: GcProject = fairOaks) =>
  render(<GcScheduleLetter state={s} project={project} by="Robert Douglas" {...(onSend ? { onSend } : {})} />)

describe('the customer’s letter (PR 15a, G-94)', () => {
  it('reads the letter as it would go today, to whom, in a first-timer’s words', () => {
    show(vi.fn())
    expect(within(card()).getByText('Send Cibolo Creek Partners their schedule')).toBeTruthy()
    const sentences = [...card().querySelectorAll('span > span')].map((el) => el.textContent ?? '')
    expect(sentences).toEqual(['Their schedule as a dated letter.', 'It has the finish, each stage, what changed and what we need from them.', 'Each letter is kept as it went.'])
    for (const sentence of sentences) expect(plainWordsFailures(sentence), sentence).toEqual([])
    expect(card().querySelector('[data-gc-schedule-letter-text]')).toBeNull()
    fireEvent.click(within(card()).getByRole('button', { name: 'Read the letter' }))
    const text = card().querySelector('[data-gc-schedule-letter-text]') as HTMLElement
    expect(text.textContent).toContain('To Elena Marchetti, Cibolo Creek Partners')
    expect(within(text).getByText('Hello Elena,')).toBeTruthy()
    expect(within(text).getByText('Robert Douglas, Click Construction')).toBeTruthy()
  })

  it('prints the letter as a page and files its copy, with no letter row (call 7)', () => {
    const onSend = vi.fn()
    show(onSend)
    fireEvent.click(within(card()).getByRole('button', { name: 'Print the letter' }))
    expect(printAndFile).toHaveBeenCalledWith(expect.stringContaining('<title>Your schedule on Fair Oaks Shops, Building D, Oct 2</title>'), {
      kind: 'field_report_gc_schedule',
      title: 'Your schedule on Fair Oaks Shops, Building D, Oct 2',
      recipientName: 'Cibolo Creek Partners',
      customerId: fairOaks.customerId,
      source: { table: 'gc_schedules', id: 'fairoaksd' },
    })
    expect(onSend).not.toHaveBeenCalled()
    expect(within(card()).queryByRole('alert')).toBeNull()
  })

  it('says so when the print window was blocked', () => {
    vi.mocked(printAndFile).mockReturnValueOnce(false)
    show(vi.fn())
    fireEvent.click(within(card()).getByRole('button', { name: 'Print the letter' }))
    expect(within(card()).getByRole('alert').textContent).toBe('The print window was blocked. Allow pop-ups for this site and press it again.')
  })

  it('sends a test to me, then the letter, each saying where it went', async () => {
    const onSend = vi.fn(async (_l: ScheduleLetter, test: boolean): Promise<CustomerEmailAnswer> => (test ? { ok: true, to: 'Robert Douglas', email: 'robert@example.com', test: true } : { ok: true, to: 'Cibolo Creek Partners', email: 'elena@example.com' }))
    show(onSend)
    fireEvent.click(within(card()).getByRole('button', { name: 'Send a test to me' }))
    expect(await within(card()).findByText('A test copy went to robert@example.com.')).toBeTruthy()
    expect(onSend).toHaveBeenLastCalledWith(letter, true)
    fireEvent.click(within(card()).getByRole('button', { name: 'Send to Elena Marchetti' }))
    expect(await within(card()).findByText('Sent to Cibolo Creek Partners at elena@example.com.')).toBeTruthy()
    expect(onSend).toHaveBeenLastCalledWith(letter, false)
  })

  it('says a refusal in the card’s words, and a row that was not kept', async () => {
    show(vi.fn(async (): Promise<CustomerEmailAnswer> => ({ ok: false, key: 'noEmail' })))
    fireEvent.click(within(card()).getByRole('button', { name: 'Send to Elena Marchetti' }))
    expect((await within(card()).findByRole('alert')).textContent).toBe('There is no email address on file for them. Add one on the customer, then send it again.')
    cleanup()
    show(vi.fn(async (): Promise<CustomerEmailAnswer> => ({ ok: false, key: 'alreadySent' })))
    fireEvent.click(within(card()).getByRole('button', { name: 'Send to Elena Marchetti' }))
    expect((await within(card()).findByRole('alert')).textContent).toBe('That letter went already.')
    cleanup()
    show(vi.fn(async () => Promise.reject(new Error('Read-only (training) mode: changes are blocked.'))))
    fireEvent.click(within(card()).getByRole('button', { name: 'Send to Elena Marchetti' }))
    expect((await within(card()).findByRole('alert')).textContent).toBe('Read-only (training) mode: changes are blocked.')
  })

  it('keeps each send as it went, newest first, and a row not emailed says so', () => {
    const sent = (id: string, on: string, emailed: boolean): ScheduleSend => ({ id, on, by: 'Robert Douglas', to: letter.to, subject: letter.subject, lines: letter.lines, ...(emailed ? { emailed: true as const } : {}) })
    show(vi.fn(), { ...fairOaks, scheduleSends: [sent('a', '2026-09-25', true), sent('b', '2026-10-02', false)] })
    expect(within(card()).getByText('sent once')).toBeTruthy()
    const rows = [...card().querySelectorAll('[data-gc-schedule-send]')]
    expect(rows.map((r) => r.getAttribute('data-gc-schedule-send'))).toEqual(['kept', 'emailed'])
    expect(rows[0]!.textContent).toBe('Fri Oct 2 · Robert Douglas kept “Your schedule on Fair Oaks Shops, Building D, Oct 2”, not emailed yet.')
    expect(rows[1]!.textContent).toBe(`Fri Sep 25 · Robert Douglas sent Elena Marchetti, Cibolo Creek Partners “Your schedule on Fair Oaks Shops, Building D, Oct 2”, ${letter.lines.length} lines.`)
  })

  it('reads and prints only, with no press to send', () => {
    show()
    expect(within(card()).getByRole('button', { name: 'Read the letter' })).toBeTruthy()
    expect(within(card()).getByRole('button', { name: 'Print the letter' })).toBeTruthy()
    expect(within(card()).queryByRole('button', { name: 'Send a test to me' })).toBeNull()
    expect(within(card()).queryByRole('button', { name: /^Send to / })).toBeNull()
  })
})
