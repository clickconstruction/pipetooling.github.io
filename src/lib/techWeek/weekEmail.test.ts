import { describe, expect, it } from 'vitest'
import { buildWeekEmail, weekEmailFor, weekEmailRecipients } from './weekEmail'
import type { YourWeekCard } from './weekSignal'

const WEEK = { start: '2026-11-01', end: '2026-11-07' }

describe('weekEmailRecipients', () => {
  it('takes everyone with a signal on a real, unarchived account with an address, once each', () => {
    const rows = [
      { id: 'a', name: 'Marcus Lee', email: 'Marcus@Example.com', week_signal: 'jobs_without_callback', archived_at: null },
      { id: 'b', name: 'No signal', email: 'b@example.com', week_signal: null, archived_at: null },
      { id: 'c', name: 'Gone', email: 'c@example.com', week_signal: 'license_hours', archived_at: '2026-01-01' },
      { id: 'd', name: 'Sample', email: 'd@example.com', week_signal: 'license_hours', archived_at: null, is_sample: true },
      { id: 'e', name: 'No address', email: '', week_signal: 'license_hours', archived_at: null },
      { id: 'f', name: 'Twice', email: 'marcus@example.com', week_signal: 'license_hours', archived_at: null },
    ]
    expect(weekEmailRecipients(rows)).toEqual([{ id: 'a', email: 'marcus@example.com', name: 'Marcus Lee' }])
  })
})

const card: YourWeekCard = { signal: 'jobs_without_callback', title: 'Your week', range: 'Nov 1 to Nov 7', kicker: 'Jobs without a callback', head: '29 of your last 30 jobs', sub: '', move: { tone: 'up', text: '▲ 5 jobs this week, none came back' }, bar: null, mark: '', note: '', dots: [], dashed: false }

describe('buildWeekEmail', () => {
  it('writes the subject, the text and the html from the card and the quote', () => {
    const e = buildWeekEmail(card, 'Marcus', { stars: 5, words: 'Marcus explained everything.', who: 'Dana W. · water heater · Thursday' }, 'https://clicktooling.com/dashboard')
    expect(e.subject).toBe('Your week, Nov 1 to Nov 7: 29 of your last 30 jobs')
    expect(e.text).toContain('Marcus, here is your week, Nov 1 to Nov 7.')
    expect(e.text).toContain('▲ 5 jobs this week, none came back')
    expect(e.text).toContain('★★★★★ “Marcus explained everything.”')
    expect(e.text).toContain('Compared to yourself, never to anyone else.')
    expect(e.html).toContain('29 of your last 30 jobs')
    expect(e.html).toContain('https://clicktooling.com/dashboard')
    expect(e.html).not.toContain('<script')
  })

  it('escapes the words', () => {
    const e = buildWeekEmail(card, 'Marcus', { stars: 4, words: '<b>bold</b> & more', who: 'Tom R.' }, 'https://x')
    expect(e.html).toContain('&lt;b&gt;bold&lt;/b&gt; &amp; more')
  })
})

describe('weekEmailFor', () => {
  const raw = {
    signal: 'jobs_without_callback',
    name: 'Marcus Lee',
    role: 'primary',
    hours: [],
    licenses: [],
    office_job_id: null,
    jobs: [{ job_id: 'a', job_number: '1184', job_name: 'Water heater', finished_ymd: '2026-11-03', expected_hours: null, budget_hours: 40, crew_hours: 36, my_first_ymd: '2026-11-02' }],
    callbacks: [],
    words: [{ id: 'r', customer_name: 'Dana Whitfield', score: 5, words: 'Great.', answered_at: '2026-11-05T22:12:00Z', job_id: 'a', job_number: '1184', job_name: 'Water heater', job_address: '', seen_at: null }],
  }

  it('builds last week’s card as of the week’s last day, with that week’s words', () => {
    const e = weekEmailFor(raw, WEEK, 'https://clicktooling.com/dashboard', new Date('2026-11-09T12:00:00Z'))!
    expect(e.subject).toBe('Your week, Nov 1 to Nov 7: 1 of your last 1 job')
    expect(e.text).toContain('▲ 1 job this week, none came back')
    expect(e.text).toContain('“Great.”')
    expect(e.text).toContain('Dana W. · water heater · Thursday')
  })

  it('is null with no signal, and null for nothing', () => {
    expect(weekEmailFor({ ...raw, signal: null }, WEEK, 'https://x')).toBeNull()
    expect(weekEmailFor(null, WEEK, 'https://x')).toBeNull()
  })
})
