import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { TICKET_USED_WORDS, ticketJobLine, ticketSavedWords, ticketWhenLine, ticketsOnPhoneWords } from './ticketRowWords'
import type { TicketJobFacts } from './ticketJobs'

const jobs = new Map<string, TicketJobFacts>([
  ['oak', { jobId: 'oak', label: 'JP1042', name: 'Oak Hollow Bldg C' }],
  ['cedar', { jobId: 'cedar', label: 'JP1038', name: 'Cedar Bend water heater' }],
  ['bare', { jobId: 'bare', label: 'J77', name: '' }],
])

describe('a ticket’s row', () => {
  it('names its job, its jobs, or that it has none', () => {
    expect(ticketJobLine({ job_id: 'oak', also_job_ids: [], no_one_job: false }, jobs)).toBe('JP1042, Oak Hollow Bldg C')
    expect(ticketJobLine({ job_id: 'bare', also_job_ids: [], no_one_job: false }, jobs)).toBe('J77')
    expect(ticketJobLine({ job_id: 'oak', also_job_ids: ['cedar'], no_one_job: false }, jobs)).toBe('JP1042 and JP1038')
    expect(ticketJobLine({ job_id: 'oak', also_job_ids: ['cedar', 'gone'], no_one_job: false }, jobs)).toBe('JP1042, JP1038 and a job')
    expect(ticketJobLine({ job_id: null, also_job_ids: [], no_one_job: true }, jobs)).toBe('Not for one job')
    expect(ticketJobLine({ job_id: null, also_job_ids: [], no_one_job: false }, jobs)).toBe('No job yet')
    expect(ticketJobLine({ job_id: 'gone', also_job_ids: [], no_one_job: false }, jobs)).toBe('A job')
  })

  it('says when it was taken and how many pages', () => {
    expect(ticketWhenLine({ taken_at: '2026-11-04T16:02:00Z', taken_at_from: 'press' }, 1)).toMatch(/^Nov 4.* at 10:02.*, 1 page$/)
    expect(ticketWhenLine({ taken_at: '2026-11-04T16:02:00Z', taken_at_from: 'photo' }, 3)).toMatch(/ at .*, 3 pages$/)
    const day = ticketWhenLine({ taken_at: '2026-11-04T16:02:00Z', taken_at_from: 'none' }, 2)
    expect(day).toMatch(/^Nov 4.*, 2 pages$/)
    expect(day).not.toContain(' at ')
    expect(ticketWhenLine({ taken_at: 'not a time', taken_at_from: 'press' }, 1)).toBe('1 page')
  })

  it('counts the tickets still on the phone', () => {
    expect(ticketsOnPhoneWords(0)).toBeNull()
    expect(ticketsOnPhoneWords(1)).toBe('1 ticket is on this phone. It sends when the signal is back.')
    expect(ticketsOnPhoneWords(3)).toBe('3 tickets are on this phone. They send when the signal is back.')
  })

  it('says what a save did', () => {
    expect(ticketSavedWords({ kind: 'sent' }, { label: 'JP1042', noOneJob: false })).toBe('Ticket saved to JP1042.')
    expect(ticketSavedWords({ kind: 'sent' }, { label: null, noOneJob: true })).toBe('Ticket saved. The office places it.')
    expect(ticketSavedWords({ kind: 'sent' }, { label: null, noOneJob: false })).toBe('Ticket saved. Pick its job when you can.')
    expect(ticketSavedWords({ kind: 'kept' }, { label: 'JP1042', noOneJob: false })).toBe('The ticket is on this phone. It sends when the signal is back.')
  })

  it('keeps its sentences to the plain words', () => {
    for (const line of [ticketsOnPhoneWords(1)!, ticketsOnPhoneWords(2)!, TICKET_USED_WORDS, ticketSavedWords({ kind: 'sent' }, { label: 'JP1042', noOneJob: false }), ticketSavedWords({ kind: 'sent' }, { label: null, noOneJob: true }), ticketSavedWords({ kind: 'sent' }, { label: null, noOneJob: false })]) expect(plainWordsFailures(line), line).toEqual([])
  })
})
